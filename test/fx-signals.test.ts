/**
 * @file fx-signals.test.ts
 * @description Comprehensive tests for the FX Signal System
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
    SignalStream,
    SignalEmitter,
    SignalKind,
    ChildOp,
    MemoryWAL,
    initSignalSystem,
    getSignalStream,
    getSignalEmitter,
    type SignalRecord,
    type SignalCallback,
} from "../modules/fx-signals.ts";
import { FXCore } from "../fxn.ts";

//////////////////////////////
// Basic Signal Tests       //
//////////////////////////////

Deno.test("SignalStream - create and append signals", async () => {
    const stream = new SignalStream();

    const signal = await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "test-node",
        delta: {
            kind: 'value',
            oldValue: null,
            newValue: "hello"
        }
    });

    assertEquals(signal.seq, 0);
    assertEquals(signal.kind, SignalKind.VALUE);
    assertExists(signal.timestamp);
});

Deno.test("SignalStream - append multiple signals in sequence", async () => {
    const stream = new SignalStream();

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "a" }
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "a", newValue: "b" }
    });

    const all = stream.readAll();
    assertEquals(all.length, 2);
    assertEquals(all[0].seq, 0);
    assertEquals(all[1].seq, 1);
});

//////////////////////////////
// Subscription Tests       //
//////////////////////////////

Deno.test("SignalStream - subscribe from beginning", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    // Add some historical signals
    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "v1", newValue: "v2" }
    });

    // Subscribe from beginning
    stream.subscribe({ cursor: 0 }, (sig) => {
        received.push(sig);
    });

    // Should receive historical signals
    assertEquals(received.length, 2);
    if (received[0].delta.kind === 'value') {
        assertEquals(received[0].delta.newValue, "v1");
    }
    if (received[1].delta.kind === 'value') {
        assertEquals(received[1].delta.newValue, "v2");
    }
});

Deno.test("SignalStream - subscribe from cursor", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    // Add signals
    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "v1", newValue: "v2" }
    });

    // Subscribe from cursor 1 (should skip first signal)
    stream.subscribe({ cursor: 1 }, (sig) => {
        received.push(sig);
    });

    assertEquals(received.length, 1);
    if (received[0].delta.kind === 'value') {
        assertEquals(received[0].delta.newValue, "v2");
    }
});

Deno.test("SignalStream - tail mode (only new signals)", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    // Add historical signal
    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "old" }
    });

    // Subscribe in tail mode
    stream.tail(SignalKind.VALUE, (sig) => {
        received.push(sig);
    });

    // Should not receive historical signal
    assertEquals(received.length, 0);

    // Add new signal
    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "old", newValue: "new" }
    });

    // Should receive new signal
    assertEquals(received.length, 1);
    if (received[0].delta.kind === 'value') {
        assertEquals(received[0].delta.newValue, "new");
    }
});

Deno.test("SignalStream - multiple subscribers", async () => {
    const stream = new SignalStream();
    const received1: SignalRecord[] = [];
    const received2: SignalRecord[] = [];

    stream.subscribe({ cursor: 0 }, (sig) => { received1.push(sig); });
    stream.subscribe({ cursor: 0 }, (sig) => { received2.push(sig); });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "test" }
    });

    assertEquals(received1.length, 1);
    assertEquals(received2.length, 1);
    assertEquals(received1[0].seq, received2[0].seq);
});

Deno.test("SignalStream - unsubscribe", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    const unsubscribe = stream.subscribe({ cursor: 0 }, (sig) => {
        received.push(sig);
        return;
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    assertEquals(received.length, 1);

    // Unsubscribe
    unsubscribe();

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "v1", newValue: "v2" }
    });

    // Should not receive new signal after unsubscribe
    assertEquals(received.length, 1);
});

//////////////////////////////
// Filter Tests             //
//////////////////////////////

Deno.test("SignalStream - filter by signal kind", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    stream.subscribe({ cursor: 0, kind: SignalKind.VALUE }, (sig) => {
        received.push(sig);
        return;
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    await stream.append({
        kind: SignalKind.CHILDREN,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'children', op: ChildOp.ADD, key: "child1", childId: "c1" }
    });

    // Should only receive VALUE signal
    assertEquals(received.length, 1);
    assertEquals(received[0].kind, SignalKind.VALUE);
});

Deno.test("SignalStream - filter by node ID", async () => {
    const stream = new SignalStream();
    const received: SignalRecord[] = [];

    stream.subscribe({ cursor: 0, nodeId: "node1" }, (sig) => {
        received.push(sig);
        return;
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node2",
        delta: { kind: 'value', oldValue: null, newValue: "v2" }
    });

    // Should only receive signal from node1
    assertEquals(received.length, 1);
    assertEquals(received[0].sourceNodeId, "node1");
});

//////////////////////////////
// Signal Emitter Tests     //
//////////////////////////////

Deno.test("SignalEmitter - emit value change", async () => {
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    const signal = await emitter.emitValue("node1", "old", "new", 0, 1);

    assertEquals(signal.kind, SignalKind.VALUE);
    assertEquals(signal.sourceNodeId, "node1");
    assertEquals(signal.baseVersion, 0);
    assertEquals(signal.newVersion, 1);
    if (signal.delta.kind === 'value') {
        assertEquals(signal.delta.oldValue, "old");
        assertEquals(signal.delta.newValue, "new");
    }
});

Deno.test("SignalEmitter - emit child add", async () => {
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    const signal = await emitter.emitChildAdd("parent1", "childKey", "child1", 0, 1);

    assertEquals(signal.kind, SignalKind.CHILDREN);
    if (signal.delta.kind === 'children') {
        assertEquals(signal.delta.op, ChildOp.ADD);
        assertEquals(signal.delta.key, "childKey");
        assertEquals(signal.delta.childId, "child1");
    }
});

Deno.test("SignalEmitter - emit child remove", async () => {
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    const signal = await emitter.emitChildRemove("parent1", "childKey", "child1", 1, 2);

    assertEquals(signal.kind, SignalKind.CHILDREN);
    if (signal.delta.kind === 'children') {
        assertEquals(signal.delta.op, ChildOp.REMOVE);
        assertEquals(signal.delta.key, "childKey");
        assertEquals(signal.delta.childId, "child1");
    }
});

Deno.test("SignalEmitter - emit metadata change", async () => {
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    const signal = await emitter.emitMetadata("node1", "color", "red", "blue", 0, 1);

    assertEquals(signal.kind, SignalKind.METADATA);
    if (signal.delta.kind === 'metadata') {
        assertEquals(signal.delta.key, "color");
        assertEquals(signal.delta.oldValue, "red");
        assertEquals(signal.delta.newValue, "blue");
    }
});

Deno.test("SignalEmitter - emit custom signal", async () => {
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    const signal = await emitter.emitCustom("node1", "user-action", { action: "click" }, 0, 1);

    assertEquals(signal.kind, SignalKind.CUSTOM);
    if (signal.delta.kind === 'custom') {
        assertEquals(signal.delta.event, "user-action");
        assertEquals(signal.delta.payload.action, "click");
    }
});

//////////////////////////////
// WAL Backend Tests        //
//////////////////////////////

Deno.test("MemoryWAL - append and read", async () => {
    const wal = new MemoryWAL();
    const stream = new SignalStream({ wal });

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "test" }
    });

    const signals = await wal.read(0, 1);
    assertEquals(signals.length, 1);
    assertEquals(signals[0].sourceNodeId, "node1");
});

Deno.test("MemoryWAL - compact", async () => {
    const wal = new MemoryWAL();

    await wal.append({
        seq: 0,
        timestamp: 0n,
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    await wal.append({
        seq: 1,
        timestamp: 1n,
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "v1", newValue: "v2" }
    });

    await wal.compact(1);

    const signals = await wal.read(0, 10);
    assertEquals(signals.length, 1);
    assertEquals(signals[0].seq, 1);
});

//////////////////////////////
// Integration Tests        //
//////////////////////////////

Deno.test({
    name: "FXCore - signals on value change",
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
    const fx = new FXCore();
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    fx.enableSignals(stream, emitter);

    const received: SignalRecord[] = [];
    // Subscribe to VALUE signals only after path creation
    const node = fx.setPath("test.value", undefined, fx.root);

    stream.subscribe({ cursor: stream.getCursor(), kind: SignalKind.VALUE }, (sig) => { received.push(sig); });

    // Change a value
    fx.set(node, "hello");

    // Should emit signal
    assertEquals(received.length, 1);
    assertEquals(received[0].kind, SignalKind.VALUE);
    if (received[0].delta.kind === 'value') {
        const val = received[0].delta.newValue as any;
        assertEquals(val.raw, "hello");
    }
}});

Deno.test({
    name: "FXCore - signals on child add",
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
    const fx = new FXCore();
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    fx.enableSignals(stream, emitter);

    const received: SignalRecord[] = [];
    stream.subscribe({ cursor: 0, kind: SignalKind.CHILDREN }, (sig) => { received.push(sig); });

    // Create child node
    fx.setPath("parent.child", "value", fx.root);

    // Should emit child add signals
    assertEquals(received.length >= 1, true);
    assertEquals(received[0].kind, SignalKind.CHILDREN);
    if (received[0].delta.kind === 'children') {
        assertEquals(received[0].delta.op, ChildOp.ADD);
    }
}});

Deno.test({
    name: "FXCore - version tracking",
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
    const fx = new FXCore();
    const stream = new SignalStream();
    const emitter = new SignalEmitter(stream);

    fx.enableSignals(stream, emitter);

    const node = fx.setPath("test.versioned", undefined, fx.root);

    // Version should increment with each set operation
    const initialVersion = node.__version || 0;

    fx.set(node, "v1");
    assertEquals(node.__version, initialVersion + 1);

    fx.set(node, "v2");
    assertEquals(node.__version, initialVersion + 2);

    fx.set(node, "v3");
    assertEquals(node.__version, initialVersion + 3);
}});

//////////////////////////////
// Performance Tests        //
//////////////////////////////

Deno.test("SignalStream - performance: 1000 appends", async () => {
    const stream = new SignalStream();
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
        await stream.append({
            kind: SignalKind.VALUE,
            baseVersion: i,
            newVersion: i + 1,
            sourceNodeId: `node${i}`,
            delta: { kind: 'value', oldValue: i, newValue: i + 1 }
        });
    }

    const elapsed = performance.now() - start;
    const stats = stream.getStats();

    console.log(`Performance: ${elapsed.toFixed(2)}ms for 1000 appends`);
    console.log(`Average: ${stats.avgAppendTime.toFixed(3)}ms per append`);
    console.log(`Max: ${stats.maxAppendTime.toFixed(3)}ms`);

    // Each append should be fast (<1ms average)
    assertEquals(stats.avgAppendTime < 1, true, `Average append time ${stats.avgAppendTime}ms should be < 1ms`);
});

Deno.test("SignalStream - performance: 100 subscribers", async () => {
    const stream = new SignalStream();
    const subscribers: SignalRecord[][] = [];

    // Create 100 subscribers
    for (let i = 0; i < 100; i++) {
        const received: SignalRecord[] = [];
        subscribers.push(received);
        stream.subscribe({ cursor: 0 }, (sig) => { received.push(sig); });
    }

    const start = performance.now();

    // Emit 100 signals
    for (let i = 0; i < 100; i++) {
        await stream.append({
            kind: SignalKind.VALUE,
            baseVersion: i,
            newVersion: i + 1,
            sourceNodeId: `node${i}`,
            delta: { kind: 'value', oldValue: i, newValue: i + 1 }
        });
    }

    const elapsed = performance.now() - start;

    console.log(`Performance: ${elapsed.toFixed(2)}ms for 100 signals to 100 subscribers`);

    // All subscribers should receive all signals
    for (const received of subscribers) {
        assertEquals(received.length, 100);
    }
});

//////////////////////////////
// Crash Recovery Tests     //
//////////////////////////////

Deno.test("SignalStream - crash recovery simulation", async () => {
    const wal = new MemoryWAL();

    // First session: create stream and append signals
    {
        const stream = new SignalStream({ wal });

        await stream.append({
            kind: SignalKind.VALUE,
            baseVersion: 0,
            newVersion: 1,
            sourceNodeId: "node1",
            delta: { kind: 'value', oldValue: null, newValue: "before-crash" }
        });

        await stream.append({
            kind: SignalKind.VALUE,
            baseVersion: 1,
            newVersion: 2,
            sourceNodeId: "node1",
            delta: { kind: 'value', oldValue: "before-crash", newValue: "also-before-crash" }
        });
    }

    // Simulate crash (stream goes out of scope)

    // Second session: create new stream with same WAL
    {
        const stream = new SignalStream({ wal });
        const recovered: SignalRecord[] = [];

        // Replay from WAL
        const walSignals = await wal.read(0, 100);
        for (const sig of walSignals) {
            recovered.push(sig);
        }

        // Should recover both signals
        assertEquals(recovered.length, 2);
        if (recovered[0].delta.kind === 'value') {
            assertEquals(recovered[0].delta.newValue, "before-crash");
        }
        if (recovered[1].delta.kind === 'value') {
            assertEquals(recovered[1].delta.newValue, "also-before-crash");
        }
    }
});

//////////////////////////////
// Global API Tests         //
//////////////////////////////

Deno.test("Global API - initSignalSystem", () => {
    const stream = initSignalSystem();
    assertExists(stream);
    assertEquals(stream instanceof SignalStream, true);
});

Deno.test("Global API - getSignalStream", () => {
    const stream1 = getSignalStream();
    const stream2 = getSignalStream();

    // Should return same instance
    assertEquals(stream1, stream2);
});

Deno.test("Global API - getSignalEmitter", () => {
    const emitter = getSignalEmitter();
    assertExists(emitter);
    assertEquals(emitter instanceof SignalEmitter, true);
});

//////////////////////////////
// Edge Cases               //
//////////////////////////////

Deno.test("SignalStream - read range", () => {
    const stream = new SignalStream();

    // No setup needed, just test the range reading
    const range = stream.readRange(0, 5);
    assertEquals(Array.isArray(range), true);
    assertEquals(range.length, 0);
});

Deno.test("SignalStream - get cursor", () => {
    const stream = new SignalStream();
    assertEquals(stream.getCursor(), 0);
});

Deno.test("SignalStream - clear", async () => {
    const stream = new SignalStream();

    await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "test" }
    });

    assertEquals(stream.getCursor(), 1);

    stream.clear();

    assertEquals(stream.getCursor(), 0);
    assertEquals(stream.readAll().length, 0);
});

Deno.test("SignalStream - timestamp precision", async () => {
    const stream = new SignalStream();

    const signal1 = await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 0,
        newVersion: 1,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: null, newValue: "v1" }
    });

    const signal2 = await stream.append({
        kind: SignalKind.VALUE,
        baseVersion: 1,
        newVersion: 2,
        sourceNodeId: "node1",
        delta: { kind: 'value', oldValue: "v1", newValue: "v2" }
    });

    // Timestamps should be different
    assertEquals(signal2.timestamp > signal1.timestamp, true);
});
