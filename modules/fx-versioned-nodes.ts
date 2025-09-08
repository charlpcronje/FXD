/**
 * FX Versioned Nodes Integration
 * Combines time-travel, safe patterns, and atomics for comprehensive node versioning
 */

import { FXTimeTravelPlugin } from "../plugins/web/fx-time-travel.ts";
import { FXSafePlugin } from "../plugins/web/fx-safe.ts";
import { FXAtomicsPlugin } from "../plugins/web/fx-atomics.ts";
import type { FXCore, FXNodeProxy } from "../fx.ts";

export interface VersionedNodeOptions {
    enableTimeTravel?: boolean;
    enableSafePatterns?: boolean;
    enableAtomics?: boolean;
    maxSnapshots?: number;
    autoSnapshot?: boolean;
    circuitBreaker?: boolean;
}

/**
 * Enhanced node with versioning, safety, and synchronization
 */
export class VersionedNode {
    private fx: FXCore;
    private nodePath: string;
    private node: FXNodeProxy;
    private timeTravel?: FXTimeTravelPlugin;
    private safe?: FXSafePlugin;
    private atomics?: FXAtomicsPlugin;
    private localHistory: any[] = [];
    private currentBranch: string = "main";

    constructor(
        fx: FXCore,
        nodePath: string,
        options: VersionedNodeOptions = {}
    ) {
        this.fx = fx;
        this.nodePath = nodePath;
        this.node = $$(nodePath);

        // Initialize plugins
        if (options.enableTimeTravel !== false) {
            this.timeTravel = new FXTimeTravelPlugin(fx, {
                maxHistorySize: options.maxSnapshots || 50
            });
        }

        if (options.enableSafePatterns !== false) {
            this.safe = new FXSafePlugin(fx);
        }

        if (options.enableAtomics !== false) {
            this.atomics = new FXAtomicsPlugin(fx);
            this.setupAtomicHooks();
        }

        // Auto-snapshot on changes
        if (options.autoSnapshot !== false) {
            this.setupAutoSnapshot();
        }

        // Circuit breaker for safe operations
        if (options.circuitBreaker) {
            this.setupCircuitBreaker();
        }
    }

    /**
     * Set value with automatic versioning
     */
    set(value: any, message?: string): void {
        // Create snapshot before change
        if (this.timeTravel) {
            this.timeTravel.snapshot(message || `Update ${this.nodePath}`);
        }

        // Store in local history
        this.localHistory.push({
            timestamp: Date.now(),
            value: this.node.val(),
            newValue: value,
            message,
            branch: this.currentBranch
        });

        // Safe set with retry and timeout
        if (this.safe) {
            const result = this.safe.timeout(
                this.nodePath,
                () => {
                    this.node.set(value);
                    return value;
                },
                5000
            );

            if (!result.success) {
                // Rollback on failure
                this.undo();
                throw new Error(result.error);
            }
        } else {
            this.node.set(value);
        }
    }

    /**
     * Get current value
     */
    get(): any {
        return this.node.val();
    }

    /**
     * Undo last change
     */
    undo(steps: number = 1): void {
        if (this.timeTravel) {
            this.timeTravel.undo(steps);
        } else if (this.localHistory.length > steps) {
            const target = this.localHistory[this.localHistory.length - steps - 1];
            this.node.set(target.value);
        }
    }

    /**
     * Redo change
     */
    redo(steps: number = 1): void {
        if (this.timeTravel) {
            this.timeTravel.redo(steps);
        }
    }

    /**
     * Create a branch for experimentation
     */
    branch(name: string): void {
        if (this.timeTravel) {
            this.timeTravel.branch(name, () => {
                this.currentBranch = name;
            });
        } else {
            // Simple branching without time-travel
            this.currentBranch = name;
            this.localHistory.push({
                timestamp: Date.now(),
                type: "branch",
                branch: name,
                fromBranch: this.currentBranch
            });
        }
    }

    /**
     * Compare two branches
     */
    compare(branch1: string, branch2: string): any {
        if (this.timeTravel) {
            return this.timeTravel.compare(branch1, branch2);
        }
        
        // Simple comparison using local history
        const b1State = this.localHistory
            .filter(h => h.branch === branch1)
            .pop();
        const b2State = this.localHistory
            .filter(h => h.branch === branch2)
            .pop();
            
        return {
            branch1: b1State?.value,
            branch2: b2State?.value,
            different: JSON.stringify(b1State?.value) !== JSON.stringify(b2State?.value)
        };
    }

    /**
     * Entangle with another node for synchronization
     */
    entangle(otherPath: string, options?: any): void {
        if (this.atomics) {
            this.atomics.entangle(this.nodePath, otherPath, {
                bidirectional: true,
                syncInitialValue: true,
                ...options
            });
        }
    }

    /**
     * Add validation guard
     */
    addGuard(validator: (value: any) => boolean): void {
        if (this.atomics) {
            this.atomics.addHook(this.nodePath, "beforeSet", (node, value) => {
                return validator(value) ? undefined : false;
            });
        }
    }

    /**
     * Get full history
     */
    getHistory(): any[] {
        return this.localHistory;
    }

    /**
     * Get visual timeline for 3D visualization
     */
    getTimeline3D(): any {
        const timeline = this.localHistory.map((entry, index) => ({
            id: `v${index}`,
            position: {
                x: Math.cos(index * 0.5) * (50 + index * 2),
                y: index * 10,
                z: Math.sin(index * 0.5) * (50 + index * 2)
            },
            timestamp: entry.timestamp,
            message: entry.message || "Change",
            branch: entry.branch,
            size: JSON.stringify(entry.value || "").length / 100,
            color: entry.branch === "main" ? "#00ff00" : "#0088ff"
        }));

        const connections = timeline.slice(1).map((v, i) => ({
            from: timeline[i].id,
            to: v.id,
            type: v.branch !== timeline[i].branch ? "branch" : "parent"
        }));

        return { timeline, connections };
    }

    /**
     * Setup automatic snapshots on change
     */
    private setupAutoSnapshot(): void {
        this.node.watch((newValue: any, oldValue: any) => {
            if (this.timeTravel && newValue !== oldValue) {
                this.timeTravel.snapshot(`Auto: ${this.nodePath} changed`);
            }
        });
    }

    /**
     * Setup circuit breaker for resilience
     */
    private setupCircuitBreaker(): void {
        if (this.safe) {
            const breaker = this.safe.circuit(this.nodePath, {
                threshold: 3,
                timeout: 30000,
                resetThreshold: 2
            });

            // Wrap set operations with circuit breaker
            const originalSet = this.set.bind(this);
            this.set = (value: any, message?: string) => {
                const result = breaker.execute(() => originalSet(value, message));
                if (!result.success) {
                    throw new Error(`Circuit breaker open: ${result.error}`);
                }
            };
        }
    }

    /**
     * Setup atomic hooks for enhanced synchronization
     */
    private setupAtomicHooks(): void {
        if (this.atomics) {
            // Add before hook to validate and log
            this.atomics.addHook(this.nodePath, "beforeSet", (node, value, prev) => {
                console.log(`[VersionedNode] ${this.nodePath} changing from`, prev, "to", value);
                return value;
            });

            // Add after hook to trigger updates
            this.atomics.addHook(this.nodePath, "afterSet", (node, value) => {
                // Could trigger UI updates, save to disk, etc.
                console.log(`[VersionedNode] ${this.nodePath} changed to`, value);
            });
        }
    }
}

/**
 * Factory for creating versioned nodes with different strategies
 */
export class VersionedNodeFactory {
    private fx: FXCore;
    private nodes: Map<string, VersionedNode> = new Map();

    constructor(fx: FXCore) {
        this.fx = fx;
    }

    /**
     * Create a simple versioned node
     */
    createSimple(path: string): VersionedNode {
        const node = new VersionedNode(this.fx, path, {
            enableTimeTravel: false,
            enableSafePatterns: false,
            enableAtomics: false
        });
        this.nodes.set(path, node);
        return node;
    }

    /**
     * Create a safe versioned node with resilience
     */
    createSafe(path: string): VersionedNode {
        const node = new VersionedNode(this.fx, path, {
            enableTimeTravel: true,
            enableSafePatterns: true,
            enableAtomics: false,
            circuitBreaker: true
        });
        this.nodes.set(path, node);
        return node;
    }

    /**
     * Create a synchronized versioned node
     */
    createSynchronized(path: string, syncWith?: string[]): VersionedNode {
        const node = new VersionedNode(this.fx, path, {
            enableTimeTravel: true,
            enableSafePatterns: true,
            enableAtomics: true
        });

        // Entangle with other nodes
        if (syncWith) {
            syncWith.forEach(otherPath => {
                node.entangle(otherPath);
            });
        }

        this.nodes.set(path, node);
        return node;
    }

    /**
     * Create a full-featured versioned node
     */
    createFull(path: string): VersionedNode {
        const node = new VersionedNode(this.fx, path, {
            enableTimeTravel: true,
            enableSafePatterns: true,
            enableAtomics: true,
            maxSnapshots: 100,
            autoSnapshot: true,
            circuitBreaker: true
        });
        this.nodes.set(path, node);
        return node;
    }

    /**
     * Get all versioned nodes
     */
    getAll(): Map<string, VersionedNode> {
        return this.nodes;
    }

    /**
     * Create visual representation for 3D
     */
    getVisualization3D(): any {
        const nodes: any[] = [];
        const connections: any[] = [];

        this.nodes.forEach((node, path) => {
            const timeline = node.getTimeline3D();
            nodes.push({
                id: path,
                type: "versioned",
                position: {
                    x: Math.random() * 200 - 100,
                    y: 0,
                    z: Math.random() * 200 - 100
                },
                timeline: timeline.timeline,
                historyLength: node.getHistory().length
            });

            // Add timeline connections
            connections.push(...timeline.connections.map(c => ({
                ...c,
                nodeId: path
            })));
        });

        return { nodes, connections };
    }
}

/**
 * Example usage for your bank statement colleague
 */
export function exampleVersionedWorkflow() {
    const factory = new VersionedNodeFactory(globalThis.fx);

    // Create versioned header component
    const header = factory.createFull("statements.components.header");
    
    // Set initial value
    header.set("<div>Original Header</div>", "Initial header design");
    
    // Create experimental branch
    header.branch("new-design");
    header.set("<div>New Header Design</div>", "Trying new layout");
    
    // Create A/B test branch
    header.branch("ab-test");
    header.set("<div>A/B Test Header</div>", "Testing conversion");
    
    // Compare branches
    const comparison = header.compare("main", "new-design");
    console.log("Branch differences:", comparison);
    
    // If new design is bad, just undo
    header.undo();
    
    // Or switch back to main
    header.branch("main");
    
    // Entangle header with footer for synchronized updates
    const footer = factory.createSynchronized("statements.components.footer", [
        "statements.components.header"
    ]);
    
    // Now header and footer stay in sync
    header.set("<div>Updated Header</div>");
    console.log("Footer automatically updated:", footer.get());
    
    // Add validation
    header.addGuard((value) => {
        // Ensure it's valid HTML
        return value.includes("<") && value.includes(">");
    });
    
    // Get 3D visualization data
    const viz = factory.getVisualization3D();
    console.log("3D Timeline:", viz);
    
    return factory;
}