# 🎯 FXD Master Feature Specifications for Sub-Agents

**Purpose:** Detailed implementation specs for sub-agents to execute
**Pattern:** Spec → Implement Agent → Verify Agent → Compile Report
**Goal:** Build all features using <5% of my context

---

## FEATURE 1: Complete fx-filesystem Plugin

### Design Specification

**File:** `C:\dev\fxd\plugins\fx-filesystem.ts` (already created, needs fixes)

**Current Issue:** Plugin creates directories but doesn't actually write files

**What to Fix:**

1. **File Writing Issue** (lines 140-160)
   - Current: Creates directories but files are missing
   - Fix: Ensure `writeNodeValue()` actually writes content
   - Test: Check files exist after sync

2. **Path Construction** (lines 365-380)
   - Current: May have Windows path issues
   - Fix: Use Deno's `join()` correctly
   - Test: Works on Windows and Linux

3. **Watcher Integration** (lines 255-280)
   - Current: Watcher starts but may not detect changes
   - Fix: Ensure Deno.watchFs properly configured
   - Test: External file changes sync back to nodes

**Success Criteria:**
- ✅ Creates /tmp/fx-nodes/ (or C:\tmp\fx-nodes\ on Windows)
- ✅ Each node becomes a directory
- ✅ value.fxval file contains actual value
- ✅ .fxmeta file contains metadata JSON
- ✅ Changes to FX nodes → files update
- ✅ Changes to files → FX nodes update
- ✅ Works on Windows and Linux

**Test Requirements:**

Create `test/fx-filesystem.test.ts` with:
```typescript
describe("fx-filesystem", () => {
  it("should create RAMDisk directory structure", async () => {
    const plugin = await loadFilesystemPlugin({ baseDir: "./test-ramdisk" });
    $$("test.value").val("hello");
    await delay(200);

    // Verify file exists
    const content = await Deno.readTextFile("./test-ramdisk/test/value/value.fxval");
    assertEquals(content, "hello");
  });

  it("should sync external file changes to FX", async () => {
    const plugin = await loadFilesystemPlugin({ baseDir: "./test-ramdisk" });

    // External app writes file
    await Deno.writeTextFile("./test-ramdisk/external/data/value.fxval", "from-outside");
    await delay(300);

    // Should sync to FX
    assertEquals($$("external.data").val(), "from-outside");
  });

  it("should handle rapid changes without corruption", async () => {
    // Test burst of changes
    for (let i = 0; i < 100; i++) {
      $$("burst.counter").val(i);
    }
    await delay(500);

    const content = await Deno.readTextFile("./test-ramdisk/burst/counter/value.fxval");
    assertEquals(Number(content), 99);
  });
});
```

**Documentation Requirements:**

Create `docs/FX-FILESYSTEM-PLUGIN.md`:
```markdown
# fx-filesystem Plugin

## Overview
Mirrors FX nodes to filesystem for cross-language/cross-app IPC.

## Installation
```typescript
import { loadFilesystemPlugin } from "./plugins/fx-filesystem.ts";
const fs = await loadFilesystemPlugin({ baseDir: "/tmp/fx-nodes" });
```

## How It Works
(explain architecture)

## Cross-Language Usage
(examples with TypeScript, Go, Python, Rust)

## Performance
(benchmarks)

## Troubleshooting
(common issues)
```

**Reflection Questions:**
- What was the hardest bug to fix?
- Are there edge cases not covered?
- What would make this more robust?
- Performance concerns with 1000+ nodes?

---

## FEATURE 2: Cross-Language IPC Demo

### Design Specification

**Objective:** Prove TypeScript ↔ Go reactive communication via RAMDisk

**Files to Create:**

1. **`examples/cross-language-ipc/typescript-app.ts`**
   - Creates reactive snippets
   - Maps params to /tmp/fx-nodes/
   - Watches for Go app results

2. **`examples/cross-language-ipc/go-app/main.go`**
   - Watches /tmp/fx-nodes/ via fsnotify
   - Executes Go functions when params change
   - Writes results back to filesystem

3. **`examples/cross-language-ipc/README.md`**
   - Complete explanation
   - How to run both apps
   - What to observe

**TypeScript App Pseudocode:**
```typescript
import { createReactiveSnippet } from "../../modules/fx-reactive-snippets.ts";
import { loadFilesystemPlugin } from "../../plugins/fx-filesystem.ts";

// Start filesystem plugin
const fs = await loadFilesystemPlugin({
  baseDir: "/tmp/fx-nodes"
});

// Create reactive snippet that needs processing
createReactiveSnippet("process.calculateTax", function(income, rate) {
  // This will execute in TypeScript
  return income * rate;
}, {
  id: "calc-tax",
  params: {
    income: "inputs.userIncome",
    rate: "inputs.taxRate"
  },
  output: "processing.needsValidation",
  reactive: true
});

// Watch for Go app validation result
$$("results.validatedTax").watch((val) => {
  console.log("✅ Go validation complete:", val);
});

// Set inputs
$$("inputs.userIncome").val(50000);
$$("inputs.taxRate").val(0.21);

console.log("TypeScript: Waiting for Go app to validate...");
```

**Go App Pseudocode:**
```go
package main

import (
    "github.com/fsnotify/fsnotify"
    "io/ioutil"
    "path/filepath"
)

func main() {
    watcher, _ := fsnotify.NewWatcher()
    watcher.Add("/tmp/fx-nodes/processing/needsValidation")

    for event := range watcher.Events {
        if event.Op&fsnotify.Write == fsnotify.Write {
            // Read value
            data, _ := ioutil.ReadFile(event.Name)
            taxAmount, _ := strconv.ParseFloat(string(data), 64)

            // Validate in Go
            validated := validateTax(taxAmount)

            // Write result
            resultPath := "/tmp/fx-nodes/results/validatedTax/value.fxval"
            ioutil.WriteFile(resultPath, []byte(fmt.Sprintf("%f", validated)), 0644)

            fmt.Println("Go: Validated tax amount:", validated)
        }
    }
}

func validateTax(amount float64) float64 {
    // Go-specific validation logic
    if amount > 100000 {
        return amount * 0.9 // Cap for high earners
    }
    return amount * 1.1 // Standard adjustment
}
```

**Success Criteria:**
- ✅ TypeScript app writes to /tmp/fx-nodes/
- ✅ Go app detects changes via fsnotify
- ✅ Go app processes data
- ✅ Go app writes results
- ✅ TypeScript app sees results
- ✅ Round-trip under 100ms
- ✅ Both apps run simultaneously
- ✅ Live data flow demonstrated

**Test Requirements:**

Create automated test that:
- Starts both apps
- Sends data through pipeline
- Verifies output
- Measures latency

**Documentation:**
- README with setup instructions
- Architecture diagram
- Performance benchmarks
- Troubleshooting guide

**Reflection:**
- Latency measurements?
- Scalability concerns?
- Error handling robustness?
- How to add more languages?

---

## FEATURE 3: RAMDisk Polyglot Visualizer

### Design Specification

**File:** `public/fxd-ramdisk-visualizer.html`

**Objective:** Real-time visualization of data flowing across languages

**Features:**

1. **Live File Watcher**
   - Watch /tmp/fx-nodes/**/* for changes
   - Detect new nodes, value changes, deletions
   - Update graph in real-time

2. **Multi-Language Node Types**
   - Blue circles: TypeScript nodes
   - Green squares: Go nodes
   - Yellow triangles: Python nodes
   - Orange hexagons: Rust nodes
   - Auto-detect language from metadata

3. **Data Flow Animation**
   - When value changes, highlight node
   - Animate arrow from source to destination
   - Show value in tooltip
   - Fade after 2 seconds

4. **Connection Graph**
   - Force-directed layout (D3.js or similar)
   - Nodes sized by value size
   - Edges show data flow direction
   - Click node to inspect

5. **Live Inspector Panel**
   ```
   Node: processing.needsValidation
   Language: TypeScript
   Value: 10500.0
   Type: number
   Last Updated: 2ms ago

   Connections:
   ← inputs.userIncome (TypeScript)
   ← inputs.taxRate (TypeScript)
   → results.validatedTax (Go)

   History: [10500, 11000, 10500] (last 3 values)
   ```

**Implementation Approach:**

Use WebSocket server to stream filesystem changes:
```typescript
// Server side (Deno)
const watcher = Deno.watchFs("/tmp/fx-nodes", { recursive: true });
for await (const event of watcher) {
  ws.send(JSON.stringify({
    type: "file-change",
    path: event.paths[0],
    kind: event.kind
  }));
}

// Client side (HTML)
ws.onmessage = (e) => {
  const change = JSON.parse(e.data);
  updateGraph(change);
  animateDataFlow(change);
};
```

**Success Criteria:**
- ✅ Shows all nodes from /tmp/fx-nodes/
- ✅ Updates in real-time (<100ms latency)
- ✅ Animates data flow between languages
- ✅ Inspector panel shows details
- ✅ Works with 100+ nodes without lag
- ✅ Beautiful, modern UI

**Test Requirements:**
- Performance test with 1000 nodes
- Rapid change test (100 updates/sec)
- Multi-language demo running simultaneously

**Documentation:**
- User guide with screenshots
- Architecture explanation
- WebSocket protocol spec
- Performance tuning guide

**Reflection:**
- Performance bottlenecks?
- UI/UX improvements?
- Additional visualizations needed?
- How to show execution flow (not just data)?

---

## FEATURE 4: WAL/UArr Prototype (FXOS Migration Start!)

### Design Specification

**Objective:** Replace SQLite with FXOS-style WAL + UArr format

**Files to Create:**

1. **`modules/fx-wal.ts`** - Write-Ahead Log implementation
2. **`modules/fx-uarr.ts`** - Universal Array encoder/decoder
3. **`modules/fx-persistence-wal.ts`** - Persistence using WAL+UArr
4. **`test/fx-wal.test.ts`** - WAL tests
5. **`test/fx-uarr.test.ts`** - UArr tests

**WAL Format Design:**

```typescript
// Record types (from FXOS design)
enum RecordType {
  NODE_CREATE = 1,
  NODE_PATCH = 2,
  LINK_ADD = 3,
  LINK_DEL = 4,
  SIGNAL = 5,
  CHECKPOINT = 6
}

interface WALRecord {
  seq: bigint;           // Sequence number
  timestamp: bigint;     // Nanosecond timestamp
  type: RecordType;
  nodeId: string;        // Subject node
  data: Uint8Array;      // UArr-encoded payload
  checksum: number;      // CRC32
}

// File format:
// [Magic: 'FXWAL'][Version: u16][Records...]
```

**UArr Format Design:**

```typescript
interface UArrHeader {
  magic: number;         // 'UARR' (0x55415252)
  version: number;       // Schema version
  flags: number;         // Compression, encryption, etc.
  fieldCount: number;    // Number of fields
  schemaOffset: number;  // Offset to FieldDesc[]
  dataOffset: number;    // Offset to data region
  totalBytes: bigint;    // Total size for integrity
}

interface FieldDesc {
  nameHash: bigint;      // Hash of field name
  typeTag: number;       // Type enumeration
  offsetOrIndex: number; // Offset in data or table index
}

// Type tags
enum TypeTag {
  I8, I16, I32, I64,
  U8, U16, U32, U64,
  F32, F64,
  BOOL,
  STRING_UTF8,
  BYTES,
  ARRAY,
  MAP,
  NODEREF,               // Reference to another node
  TIMESTAMP,
  UUID
}
```

**Implementation Phases:**

Phase A: UArr Encoder/Decoder (2 hours)
- Implement header writing/reading
- Implement field descriptors
- Implement basic types (numbers, strings, booleans)
- Implement nested types (arrays, maps)
- Test round-trip encoding/decoding

Phase B: WAL Writer/Reader (2 hours)
- Implement append-only log
- Implement sequence numbering
- Implement checksum validation
- Implement log compaction
- Test crash recovery

Phase C: Persistence Integration (2 hours)
- Replace SQLite writes with WAL
- Keep SQLite reads for compatibility
- Benchmark: Should be 3-10x faster
- Test: Full graph save/load via WAL

**Success Criteria:**
- ✅ UArr encodes all FX value types
- ✅ UArr round-trip is byte-perfect
- ✅ WAL appends are atomic
- ✅ WAL replay reconstructs state exactly
- ✅ Performance: 3-10x faster than SQLite
- ✅ Crash recovery works
- ✅ All 17 persistence tests still pass

**Test Requirements:**

```typescript
describe("uarr-encoding", () => {
  it("should encode/decode primitives", () => {
    const original = { str: "hello", num: 42, bool: true };
    const encoded = encodeUArr(original);
    const decoded = decodeUArr(encoded);
    assertEquals(decoded, original);
  });

  it("should handle nested structures", () => {
    const complex = {
      user: { name: "Alice", age: 30 },
      items: [1, 2, 3],
      config: { theme: "dark" }
    };
    const encoded = encodeUArr(complex);
    const decoded = decodeUArr(encoded);
    assertEquals(decoded, complex);
  });

  it("should be zero-copy readable", () => {
    // Should be able to read fields without deserializing entire structure
  });
});

describe("wal-operations", () => {
  it("should append records atomically", async () => {
    const wal = new WAL("test.wal");
    await wal.append({ type: NODE_CREATE, nodeId: "test", data: ... });
    await wal.append({ type: NODE_PATCH, nodeId: "test", data: ... });

    const records = await wal.readAll();
    assertEquals(records.length, 2);
  });

  it("should recover from crash", async () => {
    // Write partial record
    // Simulate crash
    // Replay should handle gracefully
  });
});
```

**Documentation:**

Create `docs/WAL-UARR-FORMAT.md`:
- Binary format specification
- Field type reference
- Record type reference
- Migration guide from SQLite
- Performance comparisons

**Reflection:**
- Is UArr truly zero-copy in practice?
- WAL compaction strategy needed?
- How does this compare to FXOS design?
- What optimizations are critical?

---

## FEATURE 5: Signal System Basics

### Design Specification

**Objective:** Implement durable reactive event streams (FXOS Signals)

**File:** `modules/fx-signals.ts`

**Concept from FXOS:**
```rust
struct SignalRecord {
  ts: Timestamp,
  kind: SignalKind,  // VALUE, CHILDREN, CAPS, META
  base_ver: VerID,
  new_ver: VerID,
  source: NodeID,
  delta: UArr
}
```

**Implementation:**

```typescript
export enum SignalKind {
  VALUE = 'value',
  CHILDREN = 'children',
  METADATA = 'metadata',
  CUSTOM = 'custom'
}

export interface SignalRecord {
  timestamp: bigint;
  kind: SignalKind;
  baseVersion: number;
  newVersion: number;
  sourceNodeId: string;
  delta: any;  // What changed
}

export class SignalStream {
  private log: SignalRecord[] = [];
  private subscribers = new Map<string, Set<SignalCallback>>();

  // Append signal to stream
  async append(record: SignalRecord): Promise<void> {
    this.log.push(record);

    // Persist to WAL
    await this.persistSignal(record);

    // Notify subscribers
    this.notify(record);
  }

  // Subscribe from cursor (supports resume after crash)
  subscribe(kind: SignalKind, cursor: number, callback: SignalCallback): Unsubscribe {
    // Return signals from cursor onwards
    // Call callback for each new signal
  }

  // Tail (follow live signals)
  tail(kind: SignalKind, callback: SignalCallback): Unsubscribe {
    // Like subscribe but from end of log
  }
}
```

**Integration with FX:**

Intercept all node changes and emit signals:
```typescript
// In FXCore.set() - after value changes
const signal: SignalRecord = {
  timestamp: BigInt(Date.now() * 1_000_000), // nanoseconds
  kind: SignalKind.VALUE,
  baseVersion: node.__version || 0,
  newVersion: (node.__version || 0) + 1,
  sourceNodeId: node.__id,
  delta: { old: oldValue, new: newValue }
};

node.__version = signal.newVersion;
await signalStream.append(signal);
```

**Success Criteria:**
- ✅ All value changes emit VALUE signals
- ✅ Signals persist to disk (survive restart)
- ✅ Subscribers can resume from cursor
- ✅ tail() provides live updates
- ✅ Performance: <1ms overhead per change
- ✅ Crash recovery: Replay signals after reboot

**Test Requirements:**

```typescript
describe("signals", () => {
  it("should emit signals on value changes", () => {
    const signals: SignalRecord[] = [];
    signalStream.subscribe(SignalKind.VALUE, 0, (sig) => signals.push(sig));

    $$("test").val("v1");
    $$("test").val("v2");

    assertEquals(signals.length, 2);
    assertEquals(signals[1].delta.new, "v2");
  });

  it("should support resume from cursor", async () => {
    // Emit 100 signals
    // Subscribe from cursor 50
    // Should receive 50 signals
  });

  it("should survive restart", async () => {
    $$("test").val("before restart");
    // Simulate restart
    // Reload signals
    // Subscribe from beginning
    // Should see "before restart" signal
  });
});
```

**Documentation:**

Create `docs/SIGNALS.md`:
- Signal concepts
- Subscription patterns
- Cursor management
- Performance characteristics
- Comparison to traditional events
- Migration from watchers

**Reflection:**
- How does this compare to FXOS Signals?
- Backpressure handling needed?
- Network shipping strategy?
- CRDT integration points?

---

## AGENT DEPLOYMENT INSTRUCTIONS

### For Implementation Agents:

**Your Task Structure:**
1. ✅ Read the design spec carefully
2. ✅ Implement the feature
3. ✅ Write all required tests
4. ✅ Create all documentation
5. ✅ Answer reflection questions
6. ✅ Create summary report

**Your Report Must Include:**
- Files created/modified (with line counts)
- Test results (X/Y passing)
- Documentation created (file names)
- Reflection answers
- Issues encountered
- Recommendations for next agent

**Report Format:**
```markdown
# Feature X Implementation Report

## Implementation Summary
- Files created: X
- Lines of code: Y
- Time taken: Z minutes

## Test Results
- Test file: path/to/test.ts
- Tests: X/Y passing
- Coverage: Z%

## Documentation
- Created: docs/FEATURE.md (X lines)
- Updated: README.md (Y changes)

## Reflection
(answers to reflection questions)

## Issues Encountered
(any problems)

## Recommendations
(what next agent should focus on)

## Handoff
Ready for verification: YES/NO
```

### For Verification Agents:

**Your Task:**
1. ✅ Read implementation agent's report
2. ✅ Run all tests they created
3. ✅ Test the feature manually
4. ✅ Verify documentation accuracy
5. ✅ Check for edge cases
6. ✅ Validate reflection answers

**Your Report:**
```markdown
# Feature X Verification Report

## Tests Verified
- ✅/❌ All tests pass: (Y/N)
- ✅/❌ Test coverage adequate: (Y/N)

## Feature Verified
- ✅/❌ Feature works as specified: (Y/N)
- ✅/❌ Performance acceptable: (Y/N)

## Documentation Verified
- ✅/❌ Docs accurate: (Y/N)
- ✅/❌ Examples work: (Y/N)

## Issues Found
(list any problems)

## Overall Assessment
APPROVED / NEEDS FIXES / REJECTED

## Recommendations
(suggestions for improvement)
```

---

## ORCHESTRATION SEQUENCE

**Total Estimated:** 10-12 hours of agent work, ~300K tokens

```
Feature 1: fx-filesystem
├─ Design Spec (done above)
├─ Implementation Agent (2-3 hours, haiku, ~15K tokens)
├─ Verification Agent (30 min, sonnet, ~5K tokens)
└─ Report compiled → Feature 2

Feature 2: Cross-Language IPC
├─ Design Spec (done above)
├─ Implementation Agent (3-4 hours, sonnet, ~50K tokens)
├─ Verification Agent (30 min, sonnet, ~5K tokens)
└─ Report compiled → Feature 3

Feature 3: Visualizer
├─ Design Spec (done above)
├─ Implementation Agent (2-3 hours, sonnet, ~40K tokens)
├─ Verification Agent (30 min, haiku, ~3K tokens)
└─ Report compiled → Feature 4

Feature 4: WAL/UArr
├─ Design Spec (done above)
├─ Implementation Agent (4-6 hours, sonnet, ~80K tokens)
├─ Verification Agent (1 hour, sonnet, ~10K tokens)
└─ Report compiled → Feature 5

Feature 5: Signals
├─ Design Spec (done above)
├─ Implementation Agent (3-4 hours, sonnet, ~60K tokens)
├─ Verification Agent (30 min, sonnet, ~5K tokens)
└─ Report compiled → DONE!

Total: ~273K tokens (vs 500K+ if I did it)
Context saved: ~227K tokens
My role: Orchestration, not implementation!
```

---

**SPEC COMPLETE!** Ready to deploy agents?

Say "Deploy Feature 1" and I'll launch the implementation + verification pipeline! 🚀

Or suggest amendments to any spec first!
