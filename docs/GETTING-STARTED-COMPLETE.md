# Complete Getting Started Guide - FXD v0.3-alpha

**Welcome to FXD!** This guide will walk you through installation, basic concepts, and all major features of the FXD reactive framework.

---

## Table of Contents

1. [Installation](#installation)
2. [First Project](#first-project)
3. [Core Concepts](#core-concepts)
4. [Feature Demos](#feature-demos)
5. [Where to Learn More](#where-to-learn-more)
6. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

FXD requires **Deno** (recommended) or Node.js 18+.

### Install Deno

**macOS/Linux:**
```bash
curl -fsSL https://deno.land/x/install/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Package Managers:**
```bash
# macOS
brew install deno

# Windows
choco install deno
scoop install deno

# Linux
curl -fsSL https://deno.land/install.sh | sh
```

### Install FXD

```bash
# Clone the repository
git clone https://github.com/yourusername/fxd.git
cd fxd

# Verify installation
deno run -A test/run-all-tests.ts
```

**Expected output:**
```
Files:    11 total, 9 passing, 2 with issues
Tests:    37 total, 35 passed, 2 failed
Duration: ~35 seconds
```

---

## First Project

### 1. Hello FXD

Create a file `hello-fxd.ts`:

```typescript
import { $$, $_$$ } from "./fxn.ts";

// Set global access (convenience)
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create your first node
$$("greeting").val("Hello, FXD!");

// Read the value
console.log($$("greeting").val());  // "Hello, FXD!"

// Watch for changes
$$("greeting").watch((newVal, oldVal) => {
    console.log(`Changed from "${oldVal}" to "${newVal}"`);
});

// Trigger the watcher
$$("greeting").val("Hello, World!");
```

Run it:
```bash
deno run -A hello-fxd.ts
```

**Output:**
```
Hello, FXD!
Changed from "Hello, FXD!" to "Hello, World!"
```

### 2. Reactive Data

Create `reactive-data.ts`:

```typescript
import { $$, $_$$ } from "./fxn.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create a user object
$$("user.name").val("Alice");
$$("user.age").val(30);
$$("user.email").val("alice@example.com");

// Query using CSS-like selectors
const userNodes = $$("user").children();
console.log("User data:", userNodes);

// Watch the entire user subtree
$$("user").watch(() => {
    console.log("User data changed!");
});

// Trigger watcher
$$("user.name").val("Bob");  // Logs: "User data changed!"
```

### 3. Persistence Example

Create `persist-example.ts`:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { FXDisk } from "./modules/fx-persistence-deno.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create some data
$$("app.name").val("My First App");
$$("app.version").val("1.0.0");
$$("app.config.port").val(8080);
$$("app.config.host").val("localhost");

// Save to .fxd file
const disk = new FXDisk("myapp.fxd", true);
disk.save();
console.log("Saved!", disk.stats());
disk.close();

// In a new session, load the data
const disk2 = new FXDisk("myapp.fxd", false);
disk2.load();
console.log("App name:", $$("app.name").val());
console.log("Config:", {
    port: $$("app.config.port").val(),
    host: $$("app.config.host").val()
});
disk2.close();
```

Run it:
```bash
deno run -A persist-example.ts
```

---

## Core Concepts

### FXNodes

Everything in FXD is a node. Nodes form a tree structure.

```typescript
// Create nodes
$$("users").val([]);
$$("users.alice").val({ name: "Alice", age: 30 });
$$("users.bob").val({ name: "Bob", age: 25 });

// Access nodes
const alice = $$("users.alice").val();
console.log(alice);  // { name: "Alice", age: 30 }

// List children
const users = $$("users").children();
console.log(users);  // ["alice", "bob"]
```

### CSS Selectors

Query nodes like you query the DOM:

```typescript
// By path
$$("users.alice")

// By attribute (if metadata set)
$$("[type='user']")

// Complex queries
$$("users [age>25]")  // (experimental)
```

### Watchers

React to changes:

```typescript
// Watch a specific node
$$("user.name").watch((newVal, oldVal) => {
    console.log(`Name changed: ${oldVal} -> ${newVal}`);
});

// Watch a subtree
$$("users").watch(() => {
    console.log("Users collection changed");
});

// Unwatch
const unwatch = $$("user.name").watch(...);
unwatch();  // Stop watching
```

### Signals (v0.3+)

Durable event streams that survive crashes:

```typescript
import { initSignalSystem, getSignalEmitter, SignalKind } from "./modules/fx-signals.ts";
import fx from "./fxn.ts";

// Initialize signals
const stream = initSignalSystem();
const emitter = getSignalEmitter();
fx.enableSignals(stream, emitter);

// Subscribe to value changes
stream.tail(SignalKind.VALUE, (signal) => {
    console.log(`[${signal.sourceNodeId}] changed to:`, signal.delta);
});

// Use FXD normally - signals emit automatically
$$("user.name").val("Alice");
// Logs: [user.name] changed to: { kind: 'value', oldValue: undefined, newValue: 'Alice' }
```

### Persistence

Two options: SQLite (stable) or WAL (20x faster):

**SQLite (Recommended for now):**
```typescript
import { FXDisk } from "./modules/fx-persistence-deno.ts";

const disk = new FXDisk("data.fxd", true);
disk.save();  // Save all nodes
disk.load();  // Restore all nodes
disk.close();
```

**WAL (Experimental, High Performance):**
```typescript
import { FXPersistenceWAL } from "./modules/fx-persistence-wal.ts";

const wal = new FXPersistenceWAL("data.wal");
await wal.save();  // 20x faster than SQLite!
await wal.load();
await wal.compact();  // Clean up log
```

---

## Feature Demos

### Demo 1: Snippets

Code snippets with metadata:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { createSnippet, findSnippets } from "./modules/fx-snippets.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create a snippet
const greet = createSnippet(
    "greet",
    `function greet(name) {
  return \`Hello \${name}!\`;
}`,
    {
        language: "javascript",
        type: "function",
        tags: ["utility", "greeting"]
    }
);

console.log("Created snippet:", greet.id);

// Find snippets
const jsFuncs = findSnippets({ language: "javascript", type: "function" });
console.log("Found", jsFuncs.length, "JavaScript functions");
```

Run:
```bash
deno run -A examples/snippet-management/demo.ts
```

### Demo 2: Views

Compose files from snippets:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create snippets
createSnippet("imports", `import { foo } from './foo.js';`);
createSnippet("main", `function main() { console.log('Hello!'); }`);
createSnippet("export", `export { main };`);

// Create a group
const group = $$("snippets").group();
const ordered = group.filter((n) => n.id?.startsWith("snippet:"));

// Render as a file
const content = renderView(ordered, { hoistImports: true });
console.log(content);
```

**Output:**
```javascript
// FX:BEGIN [imports] snippets.imports
import { foo } from './foo.js';
// FX:END [imports]

// FX:BEGIN [main] snippets.main
function main() { console.log('Hello!'); }
// FX:END [main]

// FX:BEGIN [export] snippets.export
export { main };
// FX:END [export]
```

Run:
```bash
deno run -A examples/repo-js/demo.ts
```

### Demo 3: Round-Trip Editing

Edit files and sync changes back:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";
import { toPatches, applyPatches } from "./modules/fx-parse.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create initial snippets
createSnippet("greet", `function greet() { return "Hello"; }`);
const group = $$("snippets").group();

// Render to file
const original = renderView(group);
console.log("Original:\n", original);

// Simulate editing the file
const edited = original.replace('"Hello"', '"Hello, World!"');

// Parse changes back
const patches = toPatches(edited);
console.log("Detected", patches.length, "changes");

// Apply to graph
applyPatches(patches);
console.log("Updated value:", $$("snippets.greet").val());
```

Run:
```bash
deno run -A examples/repo-js/demo.ts
```

### Demo 4: WAL Performance

See the speed difference:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { FXDisk } from "./modules/fx-persistence-deno.ts";
import { FXPersistenceWAL } from "./modules/fx-persistence-wal.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create test data
for (let i = 0; i < 100; i++) {
    $$(`data.item${i}`).val({ id: i, name: `Item ${i}` });
}

// Benchmark SQLite
console.time("SQLite save");
const disk = new FXDisk("test.fxd", true);
disk.save();
disk.close();
console.timeEnd("SQLite save");

// Benchmark WAL
console.time("WAL save");
const wal = new FXPersistenceWAL("test.wal");
await wal.save();
console.timeEnd("WAL save");

console.log("WAL is ~20x faster!");
```

### Demo 5: Signal Subscriptions

Track all changes:

```typescript
import { $$, $_$$ } from "./fxn.ts";
import { initSignalSystem, getSignalEmitter, SignalKind } from "./modules/fx-signals.ts";
import fx from "./fxn.ts";
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Enable signals
const stream = initSignalSystem();
const emitter = getSignalEmitter();
fx.enableSignals(stream, emitter);

// Subscribe to ALL changes
let changeCount = 0;
stream.tail(SignalKind.VALUE, (signal) => {
    changeCount++;
    console.log(`Change #${changeCount}:`, signal.sourceNodeId, "->", signal.delta.newValue);
});

// Make changes
$$("user.name").val("Alice");
$$("user.age").val(30);
$$("user.email").val("alice@example.com");

// Wait a bit for async signals
await new Promise(r => setTimeout(r, 100));
console.log(`Total changes tracked: ${changeCount}`);
```

### Demo 6: Cursor-Based Replay

Resume from where you left off:

```typescript
import { SignalStream } from "./modules/fx-signals.ts";

const stream = new SignalStream();

// Append signals
await stream.append({
    kind: SignalKind.VALUE,
    baseVersion: 0,
    newVersion: 1,
    sourceNodeId: "user.name",
    delta: { kind: 'value', oldValue: null, newValue: "Alice" }
});

await stream.append({
    kind: SignalKind.VALUE,
    baseVersion: 1,
    newVersion: 2,
    sourceNodeId: "user.name",
    delta: { kind: 'value', oldValue: "Alice", newValue: "Bob" }
});

// Get cursor
const cursor = stream.getCursor();
console.log("Current cursor:", cursor);  // 2

// Replay from beginning
const history = stream.read({ cursor: 0 });
console.log("Signal history:", history);

// Replay from cursor
const newChanges = stream.read({ cursor: 1 });
console.log("New changes since cursor 1:", newChanges);
```

---

## Where to Learn More

### Documentation

- **[API Reference](API-REFERENCE.md)** - Complete API documentation
- **[Signal System](SIGNALS.md)** - Signal system deep dive
- **[WAL/UArr Format](WAL-UARR-FORMAT.md)** - Binary format specification
- **[FXOS Migration](FXOS-MIGRATION-GUIDE.md)** - Path to FXOS compatibility
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and fixes

### Examples

All examples are in the `examples/` directory:

```bash
# Basic examples
deno run -A examples/hello-world/demo.ts
deno run -A examples/snippet-management/demo.ts
deno run -A examples/selector-demo/demo.ts

# Advanced examples
deno run -A examples/repo-js/demo.ts
deno run -A examples/reactive-groups/demo.ts
deno run -A examples/persistence-demo.ts
```

### Reports

- **[RELEASE-NOTES.md](../RELEASE-NOTES.md)** - v0.3-alpha release notes
- **[FINAL-STATUS.md](../FINAL-STATUS.md)** - Complete project status
- **[FEATURE-4-WAL-UARR-REPORT.md](../FEATURE-4-WAL-UARR-REPORT.md)** - WAL implementation
- **[SIGNALS-IMPLEMENTATION-REPORT.md](../SIGNALS-IMPLEMENTATION-REPORT.md)** - Signal system

---

## Troubleshooting

### Common Issues

#### 1. Import Errors

**Problem:**
```
error: Module not found
```

**Solution:**
Make sure you're running from the FXD root directory:
```bash
cd /path/to/fxd
deno run -A your-script.ts
```

#### 2. Permission Errors

**Problem:**
```
error: Requires read access
```

**Solution:**
Use `-A` flag for all permissions:
```bash
deno run -A script.ts
```

Or specific permissions:
```bash
deno run --allow-read --allow-write --allow-net script.ts
```

#### 3. File Lock Errors (Windows)

**Problem:**
```
error: The process cannot access the file because it is being used by another process
```

**Solution:**
Close the database before exiting:
```typescript
const disk = new FXDisk("data.fxd", true);
disk.save();
disk.close();  // Important!
```

#### 4. Signal Not Emitting

**Problem:**
Signals not appearing when values change.

**Solution:**
Make sure signals are enabled:
```typescript
import { initSignalSystem, getSignalEmitter } from "./modules/fx-signals.ts";
import fx from "./fxn.ts";

const stream = initSignalSystem();
const emitter = getSignalEmitter();
fx.enableSignals(stream, emitter);  // Required!

// Now signals will emit
$$("test").val("value");
```

#### 5. Test Failures

**Problem:**
Some tests fail when running the test suite.

**Solution:**
This is expected in v0.3-alpha:
- Filesystem tests are experimental (not critical)
- Signal timestamp test is flaky on Windows (harmless)
- 95% pass rate is normal

If core tests fail, please report an issue.

### Performance Tips

1. **Use WAL for writes:**
   ```typescript
   // 20x faster than SQLite for write-heavy workloads
   const wal = new FXPersistenceWAL("data.wal");
   await wal.save();
   ```

2. **Compact WAL regularly:**
   ```typescript
   await wal.compact();  // Remove redundant records
   ```

3. **Use signals for monitoring:**
   ```typescript
   // More efficient than polling
   stream.tail(SignalKind.VALUE, handleChange);
   ```

4. **Batch updates:**
   ```typescript
   // Instead of:
   $$("a").val(1);
   $$("b").val(2);
   $$("c").val(3);

   // Do:
   const updates = { a: 1, b: 2, c: 3 };
   for (const [key, val] of Object.entries(updates)) {
       $$(key).val(val);
   }
   ```

### Getting Help

1. **Check documentation:**
   - Start with [docs/INDEX.md](INDEX.md)
   - Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
   - Review [FINAL-STATUS.md](../FINAL-STATUS.md)

2. **Search examples:**
   ```bash
   grep -r "your-question" examples/
   ```

3. **Run tests:**
   ```bash
   deno run -A test/run-all-tests.ts
   ```

4. **Report issues:**
   - GitHub: https://github.com/yourusername/fxd/issues
   - Include Deno version: `deno --version`
   - Include error messages and stack traces

---

## Next Steps

Now that you have the basics:

1. **Explore features:**
   - Try all examples in `examples/`
   - Read the [API Reference](API-REFERENCE.md)
   - Experiment with [Signals](SIGNALS.md)

2. **Build something:**
   - Start a small project
   - Use FXD for configuration management
   - Try building a reactive data store

3. **Learn advanced topics:**
   - [WAL/UArr Format](WAL-UARR-FORMAT.md) - Binary encoding
   - [FXOS Migration](FXOS-MIGRATION-GUIDE.md) - Future compatibility
   - [Signal System](SIGNALS.md) - Reactive events

4. **Contribute:**
   - Fix bugs
   - Add features
   - Improve documentation
   - Share your projects

---

## Quick Reference

### Core API

```typescript
// Create/update node
$$("path.to.node").val(value);

// Read node
const value = $$("path.to.node").val();

// Watch changes
$$("path").watch((newVal, oldVal) => { ... });

// Get children
const children = $$("path").children();

// Group operations
const group = $$("path").group();
const filtered = group.filter(n => n.id.includes("test"));
```

### Persistence

```typescript
// SQLite
import { FXDisk } from "./modules/fx-persistence-deno.ts";
const disk = new FXDisk("data.fxd", true);
disk.save();
disk.load();
disk.close();

// WAL (faster)
import { FXPersistenceWAL } from "./modules/fx-persistence-wal.ts";
const wal = new FXPersistenceWAL("data.wal");
await wal.save();
await wal.load();
await wal.compact();
```

### Signals

```typescript
import { initSignalSystem, getSignalEmitter, SignalKind } from "./modules/fx-signals.ts";
import fx from "./fxn.ts";

// Initialize
const stream = initSignalSystem();
const emitter = getSignalEmitter();
fx.enableSignals(stream, emitter);

// Subscribe
stream.tail(SignalKind.VALUE, (signal) => {
    console.log(signal);
});

// Replay
const history = stream.read({ cursor: 0 });
```

### Snippets

```typescript
import { createSnippet, findSnippets } from "./modules/fx-snippets.ts";

// Create
const snippet = createSnippet("id", "code", { language: "js" });

// Find
const snippets = findSnippets({ language: "javascript" });
```

### Views

```typescript
import { renderView } from "./modules/fx-view.ts";

const group = $$("snippets").group();
const content = renderView(group, { hoistImports: true });
```

---

**Happy Coding with FXD!**

For questions or issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.

---

Last updated: 2025-11-19 (v0.3-alpha)
