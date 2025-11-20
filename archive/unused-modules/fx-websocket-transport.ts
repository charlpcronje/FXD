/**
 * FX WebSocket Transport Layer
 * Real-time communication backbone for collaborative FXD
 */

import { FXCore } from '../fx.ts';

// Protocol message types
export interface FXMessage {
  type: string;
  id: string;
  timestamp: number;
  userId?: string;
  data: any;
}

export interface FXPatch extends FXMessage {
  type: 'patch';
  path: string;
  operation: 'set' | 'delete' | 'create';
  value?: any;
  checksum?: string;
}

export interface FXPresence extends FXMessage {
  type: 'presence';
  userId: string;
  status: 'online' | 'offline' | 'editing';
  cursor?: { path: string; position: number };
  selection?: { path: string; start: number; end: number };
}

export interface FXHeartbeat extends FXMessage {
  type: 'heartbeat';
  connectionId: string;
}

// Connection management
export interface ConnectionInfo {
  id: string;
  userId: string;
  connectedAt: number;
  lastSeen: number;
  userAgent?: string;
  ip?: string;
}

// WebSocket Server
export class FXWebSocketServer {
  private connections = new Map<string, WebSocket>();
  private connectionInfo = new Map<string, ConnectionInfo>();
  private messageQueue = new Map<string, FXMessage[]>();
  private heartbeatInterval: number | null = null;
  
  constructor(private fx: typeof FXCore, private port: number = 8765) {}
  
  async start(): Promise<void> {
    const { serve } = await import("https://deno.land/std@0.224.0/http/server.ts");
    
    console.log(`🔌 FX WebSocket server starting on port ${this.port}`);
    
    await serve((req) => {
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 400 });
      }
      
      const { socket, response } = Deno.upgradeWebSocket(req);
      const connectionId = this.generateConnectionId();
      
      socket.onopen = () => this.handleConnection(connectionId, socket, req);
      socket.onmessage = (event) => this.handleMessage(connectionId, event);
      socket.onclose = () => this.handleDisconnection(connectionId);
      socket.onerror = (error) => this.handleError(connectionId, error);
      
      return response;
    }, { port: this.port });
  }
  
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private handleConnection(connectionId: string, socket: WebSocket, req: Request): void {
    console.log(`📡 Client connected: ${connectionId}`);
    
    // Store connection
    this.connections.set(connectionId, socket);
    this.connectionInfo.set(connectionId, {
      id: connectionId,
      userId: this.extractUserId(req),
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      userAgent: req.headers.get('user-agent') || undefined,
      ip: this.extractIP(req)
    });
    
    // Start heartbeat
    this.startHeartbeat(connectionId);
    
    // Send welcome message
    this.send(connectionId, {
      type: 'welcome',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: {
        connectionId,
        serverVersion: '2.0.0-alpha',
        features: ['real-time-sync', 'presence', 'collaboration']
      }
    });
    
    // Broadcast presence
    this.broadcastPresence(connectionId, 'online');
  }
  
  private handleMessage(connectionId: string, event: MessageEvent): void {
    try {
      const message: FXMessage = JSON.parse(event.data);
      const conn = this.connectionInfo.get(connectionId);
      
      if (conn) {
        conn.lastSeen = Date.now();
        this.connectionInfo.set(connectionId, conn);
      }
      
      console.log(`📨 Message from ${connectionId}:`, message.type);
      
      switch (message.type) {
        case 'patch':
          this.handlePatch(connectionId, message as FXPatch);
          break;
          
        case 'presence':
          this.handlePresenceUpdate(connectionId, message as FXPresence);
          break;
          
        case 'heartbeat':
          this.handleHeartbeat(connectionId, message as FXHeartbeat);
          break;
          
        case 'sync-request':
          this.handleSyncRequest(connectionId, message);
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error(`Error parsing message from ${connectionId}:`, error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }
  
  private handlePatch(connectionId: string, patch: FXPatch): void {
    try {
      // Apply patch to FX graph
      const node = this.fx(patch.path);
      
      switch (patch.operation) {
        case 'set':
          node.val(patch.value);
          break;
        case 'delete':
          // Implement delete operation
          break;
        case 'create':
          node.val(patch.value);
          break;
      }
      
      // Broadcast to all other clients
      this.broadcast(patch, [connectionId]);
      
      // Send acknowledgment
      this.send(connectionId, {
        type: 'patch-ack',
        id: patch.id,
        timestamp: Date.now(),
        data: { success: true }
      });
      
    } catch (error) {
      console.error(`Error applying patch:`, error);
      this.sendError(connectionId, `Failed to apply patch: ${error.message}`);
    }
  }
  
  private handlePresenceUpdate(connectionId: string, presence: FXPresence): void {
    // Update connection info
    const conn = this.connectionInfo.get(connectionId);
    if (conn) {
      conn.lastSeen = Date.now();
    }
    
    // Broadcast presence to all other clients
    this.broadcast(presence, [connectionId]);
  }
  
  private handleHeartbeat(connectionId: string, heartbeat: FXHeartbeat): void {
    const conn = this.connectionInfo.get(connectionId);
    if (conn) {
      conn.lastSeen = Date.now();
      
      // Send heartbeat response
      this.send(connectionId, {
        type: 'heartbeat-ack',
        id: heartbeat.id,
        timestamp: Date.now(),
        data: { serverTime: Date.now() }
      });
    }
  }
  
  private handleSyncRequest(connectionId: string, message: FXMessage): void {
    // Send current state snapshot
    const snapshot = this.generateSnapshot(message.data.path || '');
    
    this.send(connectionId, {
      type: 'sync-response',
      id: message.id,
      timestamp: Date.now(),
      data: snapshot
    });
  }
  
  private handleDisconnection(connectionId: string): void {
    console.log(`📡 Client disconnected: ${connectionId}`);
    
    // Clean up
    this.connections.delete(connectionId);
    this.connectionInfo.delete(connectionId);
    this.messageQueue.delete(connectionId);
    
    // Broadcast offline presence
    this.broadcastPresence(connectionId, 'offline');
  }
  
  private handleError(connectionId: string, error: Event | ErrorEvent): void {
    console.error(`WebSocket error for ${connectionId}:`, error);
  }
  
  private send(connectionId: string, message: FXMessage): void {
    const socket = this.connections.get(connectionId);
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to ${connectionId}:`, error);
        this.handleDisconnection(connectionId);
      }
    } else {
      // Queue message for later delivery
      if (!this.messageQueue.has(connectionId)) {
        this.messageQueue.set(connectionId, []);
      }
      this.messageQueue.get(connectionId)!.push(message);
    }
  }
  
  private broadcast(message: FXMessage, exclude: string[] = []): void {
    for (const [connectionId] of this.connections) {
      if (!exclude.includes(connectionId)) {
        this.send(connectionId, message);
      }
    }
  }
  
  private broadcastPresence(connectionId: string, status: string): void {
    const conn = this.connectionInfo.get(connectionId);
    if (!conn) return;
    
    const presence: FXPresence = {
      type: 'presence',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      userId: conn.userId,
      status: status as any,
      data: { connectionId }
    };
    
    this.broadcast(presence, [connectionId]);
  }
  
  private sendError(connectionId: string, error: string): void {
    this.send(connectionId, {
      type: 'error',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: { message: error }
    });
  }
  
  private startHeartbeat(connectionId: string): void {
    // Individual heartbeat per connection
    const interval = setInterval(() => {
      const conn = this.connectionInfo.get(connectionId);
      if (!conn) {
        clearInterval(interval);
        return;
      }
      
      // Check if connection is stale
      const staleDuration = Date.now() - conn.lastSeen;
      if (staleDuration > 60000) { // 60 seconds
        console.log(`🔌 Closing stale connection: ${connectionId}`);
        const socket = this.connections.get(connectionId);
        if (socket) {
          socket.close();
        }
        clearInterval(interval);
        return;
      }
      
      // Send heartbeat
      this.send(connectionId, {
        type: 'heartbeat',
        id: this.generateMessageId(),
        timestamp: Date.now(),
        connectionId,
        data: {}
      });
      
    }, 30000); // Every 30 seconds
  }
  
  private extractUserId(req: Request): string {
    // TODO: Extract from JWT or session
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `user_${ip}_${Date.now()}`;
  }
  
  private extractIP(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0] : 'unknown';
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSnapshot(path: string): any {
    // TODO: Generate current state snapshot for sync
    return {
      path,
      nodes: {},
      timestamp: Date.now()
    };
  }
  
  // Public API
  getConnectedUsers(): ConnectionInfo[] {
    return Array.from(this.connectionInfo.values());
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  broadcastSystemMessage(message: string): void {
    this.broadcast({
      type: 'system',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: { message }
    });
  }
}

// WebSocket Client
export class FXWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, (message: FXMessage) => void>();
  private heartbeatInterval: number | null = null;
  
  constructor(
    private url: string, 
    private fx: typeof FXCore,
    private userId?: string
  ) {}
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
        
        this.socket.onopen = () => {
          console.log('🔌 Connected to FX WebSocket server');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };
        
        this.socket.onclose = (event) => {
          console.log('📡 WebSocket connection closed:', event.code);
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.stopHeartbeat();
  }
  
  send(message: FXMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }
  
  // Send patch to server
  sendPatch(path: string, operation: string, value?: any): void {
    const patch: FXPatch = {
      type: 'patch',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      userId: this.userId,
      path,
      operation: operation as any,
      value,
      data: {}
    };
    
    this.send(patch);
  }
  
  // Update presence
  updatePresence(status: string, cursor?: any, selection?: any): void {
    const presence: FXPresence = {
      type: 'presence',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      userId: this.userId || 'anonymous',
      status: status as any,
      cursor,
      selection,
      data: {}
    };
    
    this.send(presence);
  }
  
  // Message handlers
  onMessage(type: string, handler: (message: FXMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }
  
  private handleMessage(message: FXMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else if (message.type === 'patch') {
      this.handleIncomingPatch(message as FXPatch);
    }
  }
  
  private handleIncomingPatch(patch: FXPatch): void {
    try {
      const node = this.fx(patch.path);
      
      switch (patch.operation) {
        case 'set':
          node.val(patch.value);
          break;
        case 'delete':
          // Implement delete
          break;
        case 'create':
          node.val(patch.value);
          break;
      }
      
      console.log(`✅ Applied patch: ${patch.operation} at ${patch.path}`);
      
    } catch (error) {
      console.error('Failed to apply incoming patch:', error);
    }
  }
  
  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'heartbeat',
        id: this.generateMessageId(),
        timestamp: Date.now(),
        connectionId: '',
        data: {}
      });
    }, 30000);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Public getters
  get connected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  get connectionState(): string {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}

// Integration with FX Core
export function enableRealtimeSync(fx: typeof FXCore, wsUrl: string, userId?: string): FXWebSocketClient {
  const client = new FXWebSocketClient(wsUrl, fx, userId);
  
  // Auto-sync node changes
  fx.watch('**', (value: any, path: string) => {
    if (client.connected) {
      client.sendPatch(path, 'set', value);
    }
  });
  
  return client;
}