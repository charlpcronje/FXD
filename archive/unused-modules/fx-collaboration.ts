/**
 * FX Real-time Collaboration
 * WebSocket-based multi-user editing with conflict resolution
 */

import type { FXCore } from "../fx.ts";

export interface CollaborationConfig {
    serverUrl?: string;
    userId?: string;
    projectId?: string;
    autoReconnect?: boolean;
    reconnectDelay?: number;
}

export interface CollaborativeEdit {
    id: string;
    userId: string;
    nodeId: string;
    operation: 'set' | 'delete' | 'move' | 'create';
    value?: any;
    timestamp: number;
    vector?: number[]; // Vector clock for ordering
}

export interface UserPresence {
    userId: string;
    name: string;
    color: string;
    cursor?: {
        nodeId: string;
        position?: number;
    };
    selection?: {
        nodeIds: string[];
    };
    lastSeen: number;
}

/**
 * Collaboration Client
 */
export class CollaborationClient {
    private fx: FXCore;
    private config: CollaborationConfig;
    private ws?: WebSocket;
    private userId: string;
    private vectorClock: Map<string, number> = new Map();
    private pendingEdits: CollaborativeEdit[] = [];
    private presence: Map<string, UserPresence> = new Map();
    private reconnectTimer?: number;
    private eventHandlers: Map<string, Set<Function>> = new Map();

    constructor(fx: FXCore, config?: CollaborationConfig) {
        this.fx = fx;
        this.userId = config?.userId || this.generateUserId();
        this.config = {
            serverUrl: 'ws://localhost:8080/collab',
            autoReconnect: true,
            reconnectDelay: 5000,
            ...config
        };
    }

    /**
     * Connect to collaboration server
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.config.serverUrl!);

            this.ws.onopen = () => {
                console.log('Connected to collaboration server');
                this.sendJoin();
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                console.log('Disconnected from collaboration server');
                if (this.config.autoReconnect) {
                    this.scheduleReconnect();
                }
            };
        });
    }

    /**
     * Send join message
     */
    private sendJoin(): void {
        this.send('join', {
            userId: this.userId,
            projectId: this.config.projectId,
            name: this.getUserName(),
            color: this.getUserColor()
        });
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: any): void {
        const { type, data } = message;

        switch (type) {
            case 'edit':
                this.handleRemoteEdit(data);
                break;
            case 'presence':
                this.handlePresenceUpdate(data);
                break;
            case 'sync':
                this.handleSync(data);
                break;
            case 'conflict':
                this.handleConflict(data);
                break;
        }

        // Emit to handlers
        this.emit(type, data);
    }

    /**
     * Send local edit
     */
    sendEdit(nodeId: string, operation: CollaborativeEdit['operation'], value?: any): void {
        const edit: CollaborativeEdit = {
            id: this.generateEditId(),
            userId: this.userId,
            nodeId,
            operation,
            value,
            timestamp: Date.now(),
            vector: this.incrementVector()
        };

        this.pendingEdits.push(edit);
        this.send('edit', edit);
    }

    /**
     * Handle remote edit
     */
    private handleRemoteEdit(edit: CollaborativeEdit): void {
        // Update vector clock
        this.updateVector(edit.userId, edit.vector![this.vectorClock.size] || 0);

        // Apply operation
        switch (edit.operation) {
            case 'set':
                $$(edit.nodeId).set(edit.value);
                break;
            case 'delete':
                // Mark as deleted
                $$(edit.nodeId + '.__deleted').set(true);
                break;
            case 'move':
                // Move node to new path
                const node = $$(edit.nodeId).val();
                $$(edit.value.newPath).set(node);
                $$(edit.nodeId + '.__deleted').set(true);
                break;
            case 'create':
                $$(edit.nodeId).set(edit.value);
                break;
        }

        // Remove from pending if acknowledged
        this.pendingEdits = this.pendingEdits.filter(e => e.id !== edit.id);
    }

    /**
     * Handle presence update
     */
    private handlePresenceUpdate(data: UserPresence): void {
        this.presence.set(data.userId, data);
        
        // Clean up stale presence
        const staleThreshold = Date.now() - 30000; // 30 seconds
        for (const [userId, presence] of this.presence) {
            if (presence.lastSeen < staleThreshold) {
                this.presence.delete(userId);
            }
        }
    }

    /**
     * Handle sync request
     */
    private handleSync(data: any): void {
        // Full state sync from server
        const { state, vector } = data;
        
        // Update local state
        for (const [path, value] of Object.entries(state)) {
            $$(path).set(value);
        }
        
        // Update vector clock
        this.vectorClock = new Map(Object.entries(vector));
    }

    /**
     * Handle conflict
     */
    private handleConflict(data: any): void {
        const { local, remote, resolution } = data;
        
        if (resolution === 'auto') {
            // Server resolved automatically
            $$(local.nodeId).set(remote.value);
        } else {
            // Manual resolution required
            this.emit('conflict', {
                local,
                remote,
                resolve: (value: any) => {
                    this.send('resolve', {
                        conflictId: data.id,
                        value
                    });
                }
            });
        }
    }

    /**
     * Send cursor position
     */
    sendCursor(nodeId: string, position?: number): void {
        this.send('presence', {
            userId: this.userId,
            cursor: { nodeId, position }
        });
    }

    /**
     * Send selection
     */
    sendSelection(nodeIds: string[]): void {
        this.send('presence', {
            userId: this.userId,
            selection: { nodeIds }
        });
    }

    /**
     * Get all active users
     */
    getActiveUsers(): UserPresence[] {
        return Array.from(this.presence.values());
    }

    /**
     * Subscribe to events
     */
    on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler);
    }

    /**
     * Unsubscribe from events
     */
    off(event: string, handler: Function): void {
        this.eventHandlers.get(event)?.delete(handler);
    }

    /**
     * Emit event
     */
    private emit(event: string, data: any): void {
        this.eventHandlers.get(event)?.forEach(handler => handler(data));
    }

    /**
     * Send message to server
     */
    private send(type: string, data: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }

    /**
     * Increment vector clock
     */
    private incrementVector(): number[] {
        const current = this.vectorClock.get(this.userId) || 0;
        this.vectorClock.set(this.userId, current + 1);
        return Array.from(this.vectorClock.values());
    }

    /**
     * Update vector clock
     */
    private updateVector(userId: string, value: number): void {
        const current = this.vectorClock.get(userId) || 0;
        this.vectorClock.set(userId, Math.max(current, value));
    }

    /**
     * Schedule reconnection
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                this.scheduleReconnect();
            });
        }, this.config.reconnectDelay);
    }

    /**
     * Generate unique IDs
     */
    private generateUserId(): string {
        return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateEditId(): string {
        return `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getUserName(): string {
        return $$('user.name').val() || `User ${this.userId.substr(0, 8)}`;
    }

    private getUserColor(): string {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        const index = parseInt(this.userId.substr(-1), 36) % colors.length;
        return colors[index];
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.ws?.close();
        this.presence.clear();
        this.pendingEdits = [];
    }
}

/**
 * Collaboration Server
 */
export class CollaborationServer {
    private fx: FXCore;
    private clients: Map<string, any> = new Map();
    private projects: Map<string, Set<string>> = new Map();
    private editHistory: Map<string, CollaborativeEdit[]> = new Map();
    private vectorClocks: Map<string, Map<string, number>> = new Map();

    constructor(fx: FXCore) {
        this.fx = fx;
    }

    /**
     * Handle client connection
     */
    handleConnection(ws: any, req: any): void {
        const clientId = this.generateClientId();
        
        ws.on('message', (message: string) => {
            const { type, data } = JSON.parse(message);
            this.handleMessage(clientId, type, data, ws);
        });

        ws.on('close', () => {
            this.handleDisconnect(clientId);
        });

        this.clients.set(clientId, ws);
    }

    /**
     * Handle client message
     */
    private handleMessage(clientId: string, type: string, data: any, ws: any): void {
        switch (type) {
            case 'join':
                this.handleJoin(clientId, data);
                break;
            case 'edit':
                this.handleEdit(clientId, data);
                break;
            case 'presence':
                this.handlePresence(clientId, data);
                break;
            case 'resolve':
                this.handleResolve(clientId, data);
                break;
        }
    }

    /**
     * Handle join
     */
    private handleJoin(clientId: string, data: any): void {
        const { projectId, userId } = data;
        
        // Add to project
        if (!this.projects.has(projectId)) {
            this.projects.set(projectId, new Set());
            this.editHistory.set(projectId, []);
            this.vectorClocks.set(projectId, new Map());
        }
        this.projects.get(projectId)!.add(clientId);
        
        // Send current state
        const state = this.getProjectState(projectId);
        const vector = this.vectorClocks.get(projectId);
        
        this.sendToClient(clientId, 'sync', {
            state,
            vector: Object.fromEntries(vector!)
        });
        
        // Notify others
        this.broadcast(projectId, 'presence', {
            userId,
            ...data,
            lastSeen: Date.now()
        }, clientId);
    }

    /**
     * Handle edit
     */
    private handleEdit(clientId: string, edit: CollaborativeEdit): void {
        const projectId = this.getClientProject(clientId);
        if (!projectId) return;
        
        // Check for conflicts
        const conflict = this.detectConflict(projectId, edit);
        
        if (conflict) {
            // Try auto-resolution
            const resolved = this.autoResolve(edit, conflict);
            
            if (resolved) {
                edit = resolved;
            } else {
                // Send conflict to client
                this.sendToClient(clientId, 'conflict', {
                    id: this.generateConflictId(),
                    local: edit,
                    remote: conflict,
                    resolution: 'manual'
                });
                return;
            }
        }
        
        // Store edit
        this.editHistory.get(projectId)!.push(edit);
        
        // Update vector clock
        const projectVector = this.vectorClocks.get(projectId)!;
        projectVector.set(edit.userId, (edit.vector?.length || 0));
        
        // Broadcast to all clients
        this.broadcast(projectId, 'edit', edit);
    }

    /**
     * Detect conflicts
     */
    private detectConflict(projectId: string, edit: CollaborativeEdit): CollaborativeEdit | null {
        const history = this.editHistory.get(projectId)!;
        
        // Find concurrent edits to same node
        for (const existing of history) {
            if (existing.nodeId === edit.nodeId &&
                existing.userId !== edit.userId &&
                this.isConcurrent(existing.vector!, edit.vector!)) {
                return existing;
            }
        }
        
        return null;
    }

    /**
     * Check if edits are concurrent
     */
    private isConcurrent(v1: number[], v2: number[]): boolean {
        // Two edits are concurrent if neither happened-before the other
        let v1BeforeV2 = false;
        let v2BeforeV1 = false;
        
        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const a = v1[i] || 0;
            const b = v2[i] || 0;
            
            if (a < b) v2BeforeV1 = true;
            if (a > b) v1BeforeV2 = true;
        }
        
        return v1BeforeV2 && v2BeforeV1;
    }

    /**
     * Auto-resolve conflicts
     */
    private autoResolve(edit1: CollaborativeEdit, edit2: CollaborativeEdit): CollaborativeEdit | null {
        // Simple last-write-wins for now
        if (edit1.timestamp > edit2.timestamp) {
            return edit1;
        }
        return null;
    }

    /**
     * Handle presence update
     */
    private handlePresence(clientId: string, data: any): void {
        const projectId = this.getClientProject(clientId);
        if (!projectId) return;
        
        this.broadcast(projectId, 'presence', {
            ...data,
            lastSeen: Date.now()
        });
    }

    /**
     * Handle conflict resolution
     */
    private handleResolve(clientId: string, data: any): void {
        const projectId = this.getClientProject(clientId);
        if (!projectId) return;
        
        const { conflictId, value } = data;
        
        // Create resolved edit
        const edit: CollaborativeEdit = {
            id: conflictId,
            userId: this.getClientUserId(clientId),
            nodeId: data.nodeId,
            operation: 'set',
            value,
            timestamp: Date.now(),
            vector: this.incrementProjectVector(projectId, this.getClientUserId(clientId))
        };
        
        // Store and broadcast
        this.editHistory.get(projectId)!.push(edit);
        this.broadcast(projectId, 'edit', edit);
    }

    /**
     * Handle disconnect
     */
    private handleDisconnect(clientId: string): void {
        const projectId = this.getClientProject(clientId);
        if (projectId) {
            this.projects.get(projectId)?.delete(clientId);
        }
        this.clients.delete(clientId);
    }

    /**
     * Helper methods
     */
    private sendToClient(clientId: string, type: string, data: any): void {
        const ws = this.clients.get(clientId);
        if (ws) {
            ws.send(JSON.stringify({ type, data }));
        }
    }

    private broadcast(projectId: string, type: string, data: any, exclude?: string): void {
        const clients = this.projects.get(projectId);
        if (!clients) return;
        
        for (const clientId of clients) {
            if (clientId !== exclude) {
                this.sendToClient(clientId, type, data);
            }
        }
    }

    private getProjectState(projectId: string): any {
        // Get current FX state for project
        const projectNode = $$(`projects.${projectId}`).val();
        return projectNode || {};
    }

    private getClientProject(clientId: string): string | null {
        for (const [projectId, clients] of this.projects) {
            if (clients.has(clientId)) {
                return projectId;
            }
        }
        return null;
    }

    private getClientUserId(clientId: string): string {
        // Would track this properly in production
        return clientId;
    }

    private incrementProjectVector(projectId: string, userId: string): number[] {
        const vector = this.vectorClocks.get(projectId)!;
        const current = vector.get(userId) || 0;
        vector.set(userId, current + 1);
        return Array.from(vector.values());
    }

    private generateClientId(): string {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateConflictId(): string {
        return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Create collaboration client
 */
export function createCollaborationClient(fx: FXCore, config?: CollaborationConfig): CollaborationClient {
    return new CollaborationClient(fx, config);
}

/**
 * Example usage
 */
export async function exampleCollaborationWorkflow() {
    const client = new CollaborationClient(globalThis.fx, {
        projectId: 'my-project',
        userId: 'user-123'
    });

    // Connect to server
    await client.connect();

    // Subscribe to events
    client.on('edit', (edit: CollaborativeEdit) => {
        console.log('Remote edit:', edit);
    });

    client.on('presence', (presence: UserPresence) => {
        console.log('User presence:', presence);
    });

    client.on('conflict', ({ local, remote, resolve }) => {
        console.log('Conflict detected:', { local, remote });
        // Resolve conflict
        resolve(local.value); // Keep local change
    });

    // Send edits
    client.sendEdit('snippets.example', 'set', 'Hello collaborative world!');

    // Send cursor position
    client.sendCursor('snippets.example', 42);

    // Send selection
    client.sendSelection(['snippets.a', 'snippets.b']);

    // Get active users
    const users = client.getActiveUsers();
    console.log('Active users:', users);

    // Disconnect when done
    // client.disconnect();
}