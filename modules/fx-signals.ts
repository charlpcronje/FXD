/**
 * @file fx-signals.ts
 * @version 1.0.0
 * @description FXD Signal System - Durable reactive event streams
 *
 * Signals are how FXOS makes reactivity durable. Instead of in-memory callbacks,
 * changes append to logs that can be replayed, shipped over network, and survive crashes.
 *
 * Core Concepts:
 * - Signals are append-only (never modify history)
 * - Cursors are stable (same cursor = same signals)
 * - Performance overhead <1ms per change
 * - Works with OR without WAL (graceful degradation)
 *
 * Architecture by: Charl Cronje (FXOS compatibility layer)
 */

//////////////////////////////
// Signal Types & Enums     //
//////////////////////////////

/**
 * Signal kinds represent different types of node mutations
 */
export enum SignalKind {
    VALUE = 'value',         // Node value changed
    CHILDREN = 'children',   // Child added/removed
    METADATA = 'metadata',   // Metadata changed
    CUSTOM = 'custom'        // Custom user signals
}

/**
 * Child operation types
 */
export enum ChildOp {
    ADD = 'add',
    REMOVE = 'remove',
    MOVE = 'move'
}

/**
 * Signal record structure (FXOS-compatible)
 */
export interface SignalRecord {
    /** Sequence number (auto-incremented) */
    seq: number;

    /** Nanosecond-precision timestamp */
    timestamp: bigint;

    /** Signal type */
    kind: SignalKind;

    /** Base version before change */
    baseVersion: number;

    /** New version after change */
    newVersion: number;

    /** Source node ID that emitted this signal */
    sourceNodeId: string;

    /** Delta (what changed) */
    delta: SignalDelta;
}

/**
 * Delta payload for different signal kinds
 */
export type SignalDelta =
    | ValueDelta
    | ChildrenDelta
    | MetadataDelta
    | CustomDelta;

export interface ValueDelta {
    kind: 'value';
    oldValue: any;
    newValue: any;
}

export interface ChildrenDelta {
    kind: 'children';
    op: ChildOp;
    key: string;
    childId?: string;
    oldChildId?: string;
}

export interface MetadataDelta {
    kind: 'metadata';
    key: string;
    oldValue: any;
    newValue: any;
}

export interface CustomDelta {
    kind: 'custom';
    event: string;
    payload: any;
}

/**
 * Callback for signal subscribers
 */
export type SignalCallback = (signal: SignalRecord) => void | Promise<void>;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Subscription options
 */
export interface SubscribeOptions {
    /** Filter by specific node ID */
    nodeId?: string;

    /** Filter by signal kind */
    kind?: SignalKind;

    /** Start from cursor position */
    cursor?: number;

    /** Only get new signals (tail mode) */
    tail?: boolean;

    /** Batch size for initial replay */
    batchSize?: number;
}

//////////////////////////////
// Signal Stream Core       //
//////////////////////////////

/**
 * Signal Stream - Append-only log of node mutations
 */
export class SignalStream {
    private log: SignalRecord[] = [];
    private nextSeq = 0;
    private subscribers = new Map<number, SubscriberState>();
    private nextSubId = 0;

    // Performance tracking
    private stats = {
        totalSignals: 0,
        totalSubscribers: 0,
        avgAppendTime: 0,
        maxAppendTime: 0
    };

    // Optional WAL backend (will be set if WAL is available)
    private walBackend?: SignalWAL;

    constructor(options?: { wal?: SignalWAL }) {
        this.walBackend = options?.wal;
    }

    /**
     * Append a signal to the stream
     * Performance: Target <1ms
     */
    async append(record: Omit<SignalRecord, 'seq' | 'timestamp'>): Promise<SignalRecord> {
        const start = performance.now();

        // Create full signal record
        const signal: SignalRecord = {
            seq: this.nextSeq++,
            timestamp: this.getNanoTimestamp(),
            ...record
        };

        // Append to in-memory log
        this.log.push(signal);
        this.stats.totalSignals++;

        // Persist to WAL if available
        if (this.walBackend) {
            await this.walBackend.append(signal);
        }

        // Notify subscribers
        this.notifySubscribers(signal);

        // Track performance
        const elapsed = performance.now() - start;
        this.updatePerformanceStats(elapsed);

        return signal;
    }

    /**
     * Subscribe to signals from a cursor position
     */
    subscribe(options: SubscribeOptions, callback: SignalCallback): Unsubscribe {
        const subId = this.nextSubId++;
        const cursor = options.cursor ?? 0;
        const tail = options.tail ?? false;

        const state: SubscriberState = {
            id: subId,
            cursor: tail ? this.log.length : cursor,
            callback,
            options,
            active: true
        };

        this.subscribers.set(subId, state);
        this.stats.totalSubscribers++;

        // Replay historical signals if not in tail mode
        if (!tail && cursor < this.log.length) {
            this.replaySignals(state);
        }

        // Return unsubscribe function
        return () => {
            state.active = false;
            this.subscribers.delete(subId);
            this.stats.totalSubscribers--;
        };
    }

    /**
     * Tail - subscribe to only new signals
     */
    tail(kind?: SignalKind, callback?: SignalCallback): Unsubscribe {
        if (callback) {
            return this.subscribe({ tail: true, kind }, callback);
        }
        return this.subscribe({ tail: true }, kind as any);
    }

    /**
     * Read a range of signals
     */
    readRange(from: number, to: number): SignalRecord[] {
        return this.log.slice(from, to);
    }

    /**
     * Read all signals
     */
    readAll(): SignalRecord[] {
        return [...this.log];
    }

    /**
     * Get current cursor position (end of log)
     */
    getCursor(): number {
        return this.log.length;
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear all signals (use with caution!)
     */
    clear(): void {
        this.log = [];
        this.nextSeq = 0;
        this.stats.totalSignals = 0;
    }

    /**
     * Replay signals to a subscriber
     */
    private replaySignals(state: SubscriberState): void {
        const batchSize = state.options.batchSize ?? 100;
        let batch: SignalRecord[] = [];

        for (let i = state.cursor; i < this.log.length; i++) {
            const signal = this.log[i];

            if (this.matchesFilter(signal, state.options)) {
                batch.push(signal);

                if (batch.length >= batchSize) {
                    this.deliverBatch(state, batch);
                    batch = [];
                }
            }

            state.cursor = i + 1;
        }

        // Deliver remaining batch
        if (batch.length > 0) {
            this.deliverBatch(state, batch);
        }
    }

    /**
     * Deliver a batch of signals to subscriber
     */
    private deliverBatch(state: SubscriberState, batch: SignalRecord[]): void {
        for (const signal of batch) {
            if (state.active) {
                try {
                    state.callback(signal);
                } catch (e) {
                    console.error('[FX Signals] Subscriber error:', e);
                }
            }
        }
    }

    /**
     * Notify subscribers of new signal
     */
    private notifySubscribers(signal: SignalRecord): void {
        for (const state of this.subscribers.values()) {
            if (!state.active) continue;

            if (this.matchesFilter(signal, state.options)) {
                try {
                    state.callback(signal);
                } catch (e) {
                    console.error('[FX Signals] Subscriber error:', e);
                }
            }

            state.cursor = signal.seq + 1;
        }
    }

    /**
     * Check if signal matches subscription filter
     */
    private matchesFilter(signal: SignalRecord, options: SubscribeOptions): boolean {
        if (options.nodeId && signal.sourceNodeId !== options.nodeId) {
            return false;
        }

        if (options.kind && signal.kind !== options.kind) {
            return false;
        }

        return true;
    }

    /**
     * Get nanosecond timestamp
     */
    private getNanoTimestamp(): bigint {
        // JavaScript's Date.now() gives milliseconds
        // For nanosecond precision, we use performance.now() and scale
        const ms = Date.now();
        const nanos = BigInt(Math.floor(ms * 1_000_000));

        // Add sub-millisecond precision from performance.now()
        const perfNanos = BigInt(Math.floor((performance.now() % 1) * 1_000_000));
        return nanos + perfNanos;
    }

    /**
     * Update performance statistics
     */
    private updatePerformanceStats(elapsed: number): void {
        this.stats.maxAppendTime = Math.max(this.stats.maxAppendTime, elapsed);

        // Rolling average
        const count = this.stats.totalSignals;
        this.stats.avgAppendTime = (this.stats.avgAppendTime * (count - 1) + elapsed) / count;
    }
}

/**
 * Subscriber state
 */
interface SubscriberState {
    id: number;
    cursor: number;
    callback: SignalCallback;
    options: SubscribeOptions;
    active: boolean;
}

//////////////////////////////
// WAL Backend Interface    //
//////////////////////////////

/**
 * Write-Ahead Log backend for durable signal storage
 */
export interface SignalWAL {
    /**
     * Append signal to WAL
     */
    append(signal: SignalRecord): Promise<void>;

    /**
     * Read signals from WAL
     */
    read(from: number, to: number): Promise<SignalRecord[]>;

    /**
     * Compact WAL (remove old signals)
     */
    compact(beforeSeq: number): Promise<void>;

    /**
     * Close WAL
     */
    close(): Promise<void>;
}

/**
 * In-memory WAL implementation (for testing)
 */
export class MemoryWAL implements SignalWAL {
    private log: SignalRecord[] = [];

    async append(signal: SignalRecord): Promise<void> {
        this.log.push(signal);
    }

    async read(from: number, to: number): Promise<SignalRecord[]> {
        return this.log.slice(from, to);
    }

    async compact(beforeSeq: number): Promise<void> {
        this.log = this.log.filter(s => s.seq >= beforeSeq);
    }

    async close(): Promise<void> {
        // No-op for memory
    }
}

//////////////////////////////
// Signal Emitter Helpers   //
//////////////////////////////

/**
 * Signal emitter utilities
 */
export class SignalEmitter {
    constructor(private stream: SignalStream) {}

    /**
     * Emit value change signal
     */
    async emitValue(
        nodeId: string,
        oldValue: any,
        newValue: any,
        baseVersion: number,
        newVersion: number
    ): Promise<SignalRecord> {
        return this.stream.append({
            kind: SignalKind.VALUE,
            baseVersion,
            newVersion,
            sourceNodeId: nodeId,
            delta: {
                kind: 'value',
                oldValue,
                newValue
            }
        });
    }

    /**
     * Emit child add signal
     */
    async emitChildAdd(
        nodeId: string,
        key: string,
        childId: string,
        baseVersion: number,
        newVersion: number
    ): Promise<SignalRecord> {
        return this.stream.append({
            kind: SignalKind.CHILDREN,
            baseVersion,
            newVersion,
            sourceNodeId: nodeId,
            delta: {
                kind: 'children',
                op: ChildOp.ADD,
                key,
                childId
            }
        });
    }

    /**
     * Emit child remove signal
     */
    async emitChildRemove(
        nodeId: string,
        key: string,
        childId: string,
        baseVersion: number,
        newVersion: number
    ): Promise<SignalRecord> {
        return this.stream.append({
            kind: SignalKind.CHILDREN,
            baseVersion,
            newVersion,
            sourceNodeId: nodeId,
            delta: {
                kind: 'children',
                op: ChildOp.REMOVE,
                key,
                childId
            }
        });
    }

    /**
     * Emit metadata change signal
     */
    async emitMetadata(
        nodeId: string,
        key: string,
        oldValue: any,
        newValue: any,
        baseVersion: number,
        newVersion: number
    ): Promise<SignalRecord> {
        return this.stream.append({
            kind: SignalKind.METADATA,
            baseVersion,
            newVersion,
            sourceNodeId: nodeId,
            delta: {
                kind: 'metadata',
                key,
                oldValue,
                newValue
            }
        });
    }

    /**
     * Emit custom signal
     */
    async emitCustom(
        nodeId: string,
        event: string,
        payload: any,
        baseVersion: number,
        newVersion: number
    ): Promise<SignalRecord> {
        return this.stream.append({
            kind: SignalKind.CUSTOM,
            baseVersion,
            newVersion,
            sourceNodeId: nodeId,
            delta: {
                kind: 'custom',
                event,
                payload
            }
        });
    }
}

//////////////////////////////
// Global Signal System     //
//////////////////////////////

// Global signal stream instance
let globalSignalStream: SignalStream | null = null;

/**
 * Initialize global signal system
 */
export function initSignalSystem(options?: { wal?: SignalWAL }): SignalStream {
    if (!globalSignalStream) {
        globalSignalStream = new SignalStream(options);
    }
    return globalSignalStream;
}

/**
 * Get global signal stream
 */
export function getSignalStream(): SignalStream {
    if (!globalSignalStream) {
        globalSignalStream = new SignalStream();
    }
    return globalSignalStream;
}

/**
 * Get signal emitter
 */
export function getSignalEmitter(): SignalEmitter {
    return new SignalEmitter(getSignalStream());
}

//////////////////////////////
// Exports                  //
//////////////////////////////

export default SignalStream;
