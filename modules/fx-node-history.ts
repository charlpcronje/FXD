/**
 * FX Node History Module
 * Per-node version control with atomic commits and time-travel debugging
 */

import { FXNodeProxy } from "../fx.ts";

export interface NodeVersion {
    id: string;
    nodeId: string;
    timestamp: number;
    value: any;
    metadata: {
        author?: string;
        message?: string;
        checksum: string;
        size: number;
        parentVersion?: string;
    };
    diff?: {
        added: number;
        removed: number;
        changed: string[];
    };
}

export interface NodeHistory {
    nodeId: string;
    versions: NodeVersion[];
    branches: Map<string, string>; // branch name -> version id
    currentBranch: string;
    currentVersion: string;
}

/**
 * Node-level version control system
 * Every change to a node is automatically versioned
 */
export class NodeHistoryManager {
    private histories: Map<string, NodeHistory> = new Map();
    private autoCommit: boolean = true;
    private maxVersionsPerNode: number = 100;

    /**
     * Initialize history tracking for a node
     */
    trackNode(nodeId: string, initialValue?: any) {
        if (this.histories.has(nodeId)) return;

        const firstVersion: NodeVersion = {
            id: this.generateVersionId(),
            nodeId,
            timestamp: Date.now(),
            value: initialValue || null,
            metadata: {
                author: this.getCurrentUser(),
                message: "Initial version",
                checksum: this.calculateChecksum(initialValue),
                size: this.calculateSize(initialValue)
            }
        };

        this.histories.set(nodeId, {
            nodeId,
            versions: [firstVersion],
            branches: new Map([["main", firstVersion.id]]),
            currentBranch: "main",
            currentVersion: firstVersion.id
        });
    }

    /**
     * Record a new version of a node
     */
    commit(nodeId: string, value: any, message?: string): NodeVersion {
        const history = this.getOrCreateHistory(nodeId);
        const previousVersion = this.getCurrentVersion(nodeId);
        
        const newVersion: NodeVersion = {
            id: this.generateVersionId(),
            nodeId,
            timestamp: Date.now(),
            value: this.cloneValue(value),
            metadata: {
                author: this.getCurrentUser(),
                message: message || this.generateCommitMessage(previousVersion?.value, value),
                checksum: this.calculateChecksum(value),
                size: this.calculateSize(value),
                parentVersion: previousVersion?.id
            },
            diff: this.calculateDiff(previousVersion?.value, value)
        };

        history.versions.push(newVersion);
        history.currentVersion = newVersion.id;
        history.branches.set(history.currentBranch, newVersion.id);

        // Cleanup old versions if limit exceeded
        this.pruneOldVersions(history);

        return newVersion;
    }

    /**
     * Get all versions of a node
     */
    getHistory(nodeId: string): NodeVersion[] {
        const history = this.histories.get(nodeId);
        return history ? [...history.versions] : [];
    }

    /**
     * Get specific version of a node
     */
    getVersion(nodeId: string, versionId: string): NodeVersion | null {
        const history = this.histories.get(nodeId);
        if (!history) return null;
        return history.versions.find(v => v.id === versionId) || null;
    }

    /**
     * Get current version of a node
     */
    getCurrentVersion(nodeId: string): NodeVersion | null {
        const history = this.histories.get(nodeId);
        if (!history) return null;
        return history.versions.find(v => v.id === history.currentVersion) || null;
    }

    /**
     * Checkout a specific version (time travel)
     */
    checkout(nodeId: string, versionId: string): any {
        const history = this.histories.get(nodeId);
        if (!history) throw new Error(`No history for node ${nodeId}`);

        const version = history.versions.find(v => v.id === versionId);
        if (!version) throw new Error(`Version ${versionId} not found`);

        history.currentVersion = versionId;
        return this.cloneValue(version.value);
    }

    /**
     * Create a new branch from current version
     */
    branch(nodeId: string, branchName: string): void {
        const history = this.histories.get(nodeId);
        if (!history) throw new Error(`No history for node ${nodeId}`);
        
        if (history.branches.has(branchName)) {
            throw new Error(`Branch ${branchName} already exists`);
        }

        history.branches.set(branchName, history.currentVersion);
    }

    /**
     * Switch to a different branch
     */
    switchBranch(nodeId: string, branchName: string): any {
        const history = this.histories.get(nodeId);
        if (!history) throw new Error(`No history for node ${nodeId}`);
        
        const versionId = history.branches.get(branchName);
        if (!versionId) throw new Error(`Branch ${branchName} not found`);

        history.currentBranch = branchName;
        return this.checkout(nodeId, versionId);
    }

    /**
     * Get diff between two versions
     */
    diff(nodeId: string, versionId1: string, versionId2: string): any {
        const v1 = this.getVersion(nodeId, versionId1);
        const v2 = this.getVersion(nodeId, versionId2);
        
        if (!v1 || !v2) throw new Error("Version not found");
        
        return this.calculateDiff(v1.value, v2.value);
    }

    /**
     * Find versions by criteria
     */
    findVersions(nodeId: string, criteria: {
        author?: string;
        since?: Date;
        until?: Date;
        message?: string;
    }): NodeVersion[] {
        const history = this.histories.get(nodeId);
        if (!history) return [];

        return history.versions.filter(v => {
            if (criteria.author && v.metadata.author !== criteria.author) return false;
            if (criteria.since && v.timestamp < criteria.since.getTime()) return false;
            if (criteria.until && v.timestamp > criteria.until.getTime()) return false;
            if (criteria.message && !v.metadata.message?.includes(criteria.message)) return false;
            return true;
        });
    }

    /**
     * Revert to a previous version (creates new commit)
     */
    revert(nodeId: string, versionId: string): NodeVersion {
        const version = this.getVersion(nodeId, versionId);
        if (!version) throw new Error(`Version ${versionId} not found`);

        return this.commit(
            nodeId, 
            version.value, 
            `Revert to ${versionId.substring(0, 7)}: ${version.metadata.message}`
        );
    }

    /**
     * Get visual timeline data for UI
     */
    getTimeline(nodeId: string): any {
        const history = this.histories.get(nodeId);
        if (!history) return null;

        return {
            nodeId,
            currentVersion: history.currentVersion,
            currentBranch: history.currentBranch,
            branches: Array.from(history.branches.entries()).map(([name, vid]) => ({
                name,
                versionId: vid,
                isCurrent: name === history.currentBranch
            })),
            timeline: history.versions.map(v => ({
                id: v.id,
                timestamp: v.timestamp,
                author: v.metadata.author,
                message: v.metadata.message,
                size: v.metadata.size,
                isCurrent: v.id === history.currentVersion,
                diff: v.diff
            }))
        };
    }

    /**
     * Merge two branches (simple merge, no conflict resolution yet)
     */
    merge(nodeId: string, fromBranch: string, toBranch: string): NodeVersion {
        const history = this.histories.get(nodeId);
        if (!history) throw new Error(`No history for node ${nodeId}`);

        const fromVersionId = history.branches.get(fromBranch);
        const toVersionId = history.branches.get(toBranch);
        
        if (!fromVersionId || !toVersionId) {
            throw new Error("Branch not found");
        }

        const fromVersion = this.getVersion(nodeId, fromVersionId);
        const toVersion = this.getVersion(nodeId, toVersionId);
        
        if (!fromVersion || !toVersion) {
            throw new Error("Version not found");
        }

        // Simple merge - take the newer version
        const mergedValue = fromVersion.timestamp > toVersion.timestamp 
            ? fromVersion.value 
            : toVersion.value;

        history.currentBranch = toBranch;
        return this.commit(
            nodeId,
            mergedValue,
            `Merge ${fromBranch} into ${toBranch}`
        );
    }

    // Private helper methods

    private getOrCreateHistory(nodeId: string): NodeHistory {
        if (!this.histories.has(nodeId)) {
            this.trackNode(nodeId);
        }
        return this.histories.get(nodeId)!;
    }

    private generateVersionId(): string {
        return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getCurrentUser(): string {
        // In real implementation, get from session
        return globalThis.$$?.("session.currentUser")?.val() || "anonymous";
    }

    private calculateChecksum(value: any): string {
        const str = JSON.stringify(value);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    private calculateSize(value: any): number {
        return JSON.stringify(value).length;
    }

    private cloneValue(value: any): any {
        if (value === null || value === undefined) return value;
        if (typeof value !== 'object') return value;
        return JSON.parse(JSON.stringify(value));
    }

    private calculateDiff(oldValue: any, newValue: any): any {
        // Simplified diff - in production use diff-match-patch or similar
        const oldStr = JSON.stringify(oldValue);
        const newStr = JSON.stringify(newValue);
        
        if (oldStr === newStr) {
            return { added: 0, removed: 0, changed: [] };
        }

        // Basic metrics
        return {
            added: Math.max(0, newStr.length - oldStr.length),
            removed: Math.max(0, oldStr.length - newStr.length),
            changed: ["value"] // In production, calculate actual changed paths
        };
    }

    private generateCommitMessage(oldValue: any, newValue: any): string {
        const oldType = typeof oldValue;
        const newType = typeof newValue;
        
        if (oldValue === null || oldValue === undefined) {
            return `Set initial value (${newType})`;
        }
        
        if (newValue === null || newValue === undefined) {
            return `Clear value`;
        }
        
        if (oldType !== newType) {
            return `Change type from ${oldType} to ${newType}`;
        }
        
        if (typeof newValue === 'string') {
            const oldLen = (oldValue as string).length;
            const newLen = newValue.length;
            if (newLen > oldLen) {
                return `Add ${newLen - oldLen} characters`;
            } else if (newLen < oldLen) {
                return `Remove ${oldLen - newLen} characters`;
            }
        }
        
        return "Update value";
    }

    private pruneOldVersions(history: NodeHistory): void {
        if (history.versions.length <= this.maxVersionsPerNode) return;
        
        // Keep important versions: branches, current, and recent
        const keep = new Set<string>();
        
        // Keep branch heads
        history.branches.forEach(versionId => keep.add(versionId));
        
        // Keep current
        keep.add(history.currentVersion);
        
        // Keep last N versions
        const recent = history.versions
            .slice(-Math.floor(this.maxVersionsPerNode / 2))
            .map(v => v.id);
        recent.forEach(id => keep.add(id));
        
        // Filter versions
        history.versions = history.versions.filter(v => keep.has(v.id));
    }
}

// Global instance
export const nodeHistory = new NodeHistoryManager();

/**
 * Enhance FX nodes with automatic history tracking
 */
export function enhanceNodeWithHistory(node: FXNodeProxy, nodeId: string) {
    // Track initial state
    nodeHistory.trackNode(nodeId, node.val());
    
    // Watch for changes
    node.watch((newValue: any, oldValue: any) => {
        if (nodeHistory.autoCommit) {
            nodeHistory.commit(nodeId, newValue);
        }
    });
    
    // Add history methods to node
    (node as any).history = () => nodeHistory.getHistory(nodeId);
    (node as any).checkout = (versionId: string) => {
        const value = nodeHistory.checkout(nodeId, versionId);
        node.set(value);
        return value;
    };
    (node as any).revert = (versionId: string) => {
        const version = nodeHistory.revert(nodeId, versionId);
        node.set(version.value);
        return version;
    };
    (node as any).timeline = () => nodeHistory.getTimeline(nodeId);
    
    return node;
}

/**
 * Visual history component for 3D visualizer
 */
export interface NodeHistoryVisualization {
    nodeId: string;
    position: { x: number; y: number; z: number };
    timeline: {
        versions: Array<{
            id: string;
            position: { x: number; y: number; z: number };
            size: number;
            color: string;
            label: string;
        }>;
        connections: Array<{
            from: string;
            to: string;
            type: 'parent' | 'branch' | 'merge';
        }>;
    };
}

export function generateHistoryVisualization(
    nodeId: string, 
    centerPosition: { x: number; y: number; z: number }
): NodeHistoryVisualization {
    const timeline = nodeHistory.getTimeline(nodeId);
    if (!timeline) return null;
    
    const viz: NodeHistoryVisualization = {
        nodeId,
        position: centerPosition,
        timeline: {
            versions: [],
            connections: []
        }
    };
    
    // Layout versions in a spiral timeline
    timeline.timeline.forEach((version, index) => {
        const angle = (index / timeline.timeline.length) * Math.PI * 2;
        const radius = 50 + index * 2;
        
        viz.timeline.versions.push({
            id: version.id,
            position: {
                x: centerPosition.x + Math.cos(angle) * radius,
                y: centerPosition.y + index * 5, // Stack vertically in time
                z: centerPosition.z + Math.sin(angle) * radius
            },
            size: Math.log(version.size + 1) * 2,
            color: version.isCurrent ? '#00ff00' : '#0088ff',
            label: `${version.message} (${new Date(version.timestamp).toLocaleString()})`
        });
        
        // Add parent connection
        if (index > 0) {
            viz.timeline.connections.push({
                from: timeline.timeline[index - 1].id,
                to: version.id,
                type: 'parent'
            });
        }
    });
    
    return viz;
}