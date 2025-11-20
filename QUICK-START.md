# FXD Quick Start Guide

Get up and running with FXD in 5 minutes!

## What is FXD?

FXD is a **reactive node graph system** with:
- **Code Snippets** - Manage code fragments with metadata
- **Views** - Compose snippets into files
- **Persistence** - Save/load with SQLite or WAL
- **Signals** - Reactive event streams
- **Atomics** - Entangle nodes for auto-sync
- **Reactive Functions** - Code that auto-executes when inputs change

## Installation

```bash
# Clone the repo
git clone <repo-url>
cd fxd

# Run demo (no install needed - uses Deno)
deno run -A examples/comprehensive-demo.ts
```

## 5-Minute Tutorial

### 1. Create Nodes & Values

```typescript
import { $$ } from "./fxn.ts";

// Create a value
$$("user.name").val("Alice");
$$("user.age").val(28);

// Read it back
console.log($$("user.name").val()); // "Alice"

// Watch for changes
$$("user.age").watch((newVal, oldVal) => {
  console.log(`Age changed: ${oldVal} → ${newVal}`);
});

$$("user.age").val(29); // Watcher fires!
```

### 2. Create Code Snippets

```typescript
import { createSnippet } from "./modules/fx-snippets.ts";

// Create a snippet with metadata
createSnippet(
  "code.utils",
  `export function add(a, b) {
    return a + b;
  }`,
  {
    id: "utils-001",
    lang: "js",
    file: "src/utils.js"
  }
);
```

### 3. Create Views

```typescript
import { renderView } from "./modules/fx-view.ts";

// Group snippets into a view
$$("views.myApp")
  .group(["code.utils", "code.main"])
  .reactive(true);

// Render to text
const code = renderView("views.myApp", {
  hoistImports: true
});

console.log(code);
```

### 4. Round-Trip Editing

```typescript
import { toPatches, applyPatches } from "./modules/fx-parse.ts";

// Render code
const rendered = renderView("views.myApp");

// Edit the code (in your editor)
const edited = rendered.replace("add", "sum");

// Parse changes back
const patches = toPatches(edited);
applyPatches(patches);

// Changes are now in the graph!
```

### 5. Persistence - SQLite

```typescript
import { FXDisk } from "./modules/fx-persistence-deno.ts";

// Save to .fxd file (SQLite)
const disk = new FXDisk("./my-project.fxd", true);
disk.save();
disk.close();

// Load later
const disk2 = new FXDisk("./my-project.fxd");
disk2.load();
// All nodes are restored!
```

### 6. Persistence - WAL (Faster!)

```typescript
import { FXDiskWAL } from "./modules/fx-persistence-wal.ts";

// Save to .fxwal file (3-10x faster)
const wal = new FXDiskWAL("./my-project.fxwal");
await wal.init();
await wal.save();
wal.close();

// Load later
const wal2 = new FXDiskWAL("./my-project.fxwal");
await wal2.init();
await wal2.load();
```

### 7. Signals - Reactive Streams

```typescript
import { getSignalStream, SignalKind } from "./modules/fx-signals.ts";

const stream = getSignalStream();

// Subscribe to all value changes
stream.subscribe(
  { kind: SignalKind.VALUE },
  (signal) => {
    console.log(`Node ${signal.sourceNodeId} changed!`);
  }
);

// Make changes - signals fire automatically
$$("data.value").val(42);
```

### 8. Atomics - Entangle Nodes

```typescript
import { loadAtomicsPlugin } from "./plugins/fx-atomics.ts";

const atomics = loadAtomicsPlugin();

// Create Celsius ↔ Fahrenheit sync
$$("temp.celsius").val(0);
$$("temp.fahrenheit").val(32);

const link = atomics.entangle(
  "temp.celsius",
  "temp.fahrenheit",
  {
    bidirectional: true,
    mapAToB: (c) => (c * 9/5) + 32,
    mapBToA: (f) => (f - 32) * 5/9
  }
);

// Change one, other updates automatically!
$$("temp.celsius").val(100);
console.log($$("temp.fahrenheit").val()); // 212
```

### 9. Reactive Snippets - Auto-Executing Functions

```typescript
import { createReactiveSnippet } from "./modules/fx-reactive-snippets.ts";

// Create input nodes
$$("inputs.width").val(10);
$$("inputs.height").val(20);

// Create reactive function
createReactiveSnippet(
  "calc.area",
  function calculateArea(width, height) {
    return width * height;
  },
  {
    id: "area-calc",
    params: {
      width: "inputs.width",
      height: "inputs.height"
    },
    output: "outputs.area",
    reactive: true
  }
);

// Output updates automatically when inputs change!
$$("inputs.width").val(15);
// outputs.area is now 300 (15 * 20)
```

## Run the Demo

See everything in action:

```bash
deno run -A examples/comprehensive-demo.ts
```

**Expected Output:**
```
═══════════════════════════════════════════════════
   FXD COMPREHENSIVE DEMO - ALL FEATURES
═══════════════════════════════════════════════════

1. Core FX - Creating nodes and watching changes
─────────────────────────────────────────────────

  ✓ Watcher fired: age changed from 28 to 29
  ✓ Created nested structure: demo.user.*
  ✓ Value: Alice, age 29
  ✓ Watchers fired: 1 time(s)

2. Snippets - Creating code snippets with metadata
─────────────────────────────────────────────────

  ✓ Created 2 code snippets
    - helpers-001 (7 lines)
    - main-entry-001 (10 lines)

... (and so on)
```

## Common Patterns

### Pattern: Code Generator

```typescript
// Store templates as snippets
createSnippet("templates.component", "...", { id: "tpl-1" });

// Generate code by combining
$$("views.generated").group([
  "templates.header",
  "templates.component",
  "templates.footer"
]);

const output = renderView("views.generated");
```

### Pattern: Live Preview

```typescript
// Watch a view and re-render on changes
$$("views.myView").watch(() => {
  const code = renderView("views.myView");
  // Update preview window
});
```

### Pattern: Multi-Format Export

```typescript
// Same data, different views
$$("views.js").group(snippets).select('.js');
$$("views.ts").group(snippets).select('.ts');

const jsCode = renderView("views.js");
const tsCode = renderView("views.ts");
```

## File Structure

```
fxd/
├── fxn.ts                     # Core FX system (primary)
├── modules/
│   ├── fx-snippets.ts         # Code snippet management
│   ├── fx-view.ts             # View rendering
│   ├── fx-parse.ts            # Round-trip parsing
│   ├── fx-persistence-deno.ts # SQLite persistence
│   ├── fx-persistence-wal.ts  # WAL persistence
│   ├── fx-signals.ts          # Reactive signals
│   ├── fx-reactive-snippets.ts# Reactive functions
│   └── fx-wal.ts              # WAL implementation
├── plugins/
│   └── fx-atomics.ts          # Node entanglement
└── examples/
    ├── comprehensive-demo.ts  # This demo!
    └── *.fxd, *.fxwal        # Persisted data
```

## Performance Tips

1. **Use WAL for speed**: 3-10x faster than SQLite
2. **Batch updates**: Signals are automatically debounced
3. **Dispose watchers**: Call `unwatch()` when done
4. **Use groups wisely**: Reactive groups auto-update

## Troubleshooting

### Snippet not found?
```typescript
import { findBySnippetId } from "./modules/fx-snippets.ts";

const result = findBySnippetId("my-id");
if (!result) {
  console.log("Snippet not indexed!");
}
```

### View not rendering?
```typescript
const group = $$("views.myView").group();
console.log(group.list()); // Check what's in the group
```

### WAL file corrupted?
```typescript
const wal = new WAL("./my.fxwal");
await wal.open();
const stats = await wal.stats();
console.log(stats); // Check record count
```

## Next Steps

- **Read the ARCHITECTURE.md** - Understand the core concepts
- **Explore examples/** - See real-world patterns
- **Check the tests/** - Learn from test cases
- **Build something!** - FXD is a toolkit, not a framework

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions, share ideas
- **Examples**: Check `examples/` for patterns

## Key Concepts

### Nodes
Everything is a node. Nodes have:
- `__id` - Unique identifier
- `__value` - The actual value
- `__nodes` - Child nodes
- `__type` - Type hint
- `__meta` - Metadata

### Proxies
FXD uses proxies for clean API:
```typescript
$$("path.to.node")    // Get/create node
  .val(123)           // Set value
  .val()              // Get value
  .watch(fn)          // Watch changes
  .node()             // Get raw node
```

### Groups
Groups are reactive collections:
```typescript
$$("myGroup")
  .group(["a", "b"])      // Manual membership
  .select('.snippet')     // CSS-style selector
  .where(p => p.val() > 5) // Filter function
  .list()                 // Get members
  .sum()                  // Aggregate
```

### Snippets
Snippets are code + metadata:
- Wrapped with `FX:BEGIN` / `FX:END` markers
- Round-trip through editing
- Rendered into views
- Persisted with graph

### Views
Views combine snippets:
- Reactive (auto-update)
- Ordered (by metadata)
- Transformed (hoist imports, etc.)

## Advanced Features

### Custom Signals
```typescript
const emitter = getSignalEmitter();

await emitter.emitCustom(
  nodeId,
  "my-event",
  { data: "payload" },
  baseVersion,
  newVersion
);
```

### Atomic Hooks
```typescript
atomics.entangle("a", "b", {
  hooksB: {
    beforeSet: ({ incoming, current }) => {
      if (incoming < 0) return { action: 'skip' };
      return { action: 'proceed', value: incoming };
    }
  }
});
```

### View Filters
```typescript
$$("filtered")
  .group()
  .select('.snippet')
  .where(p => p.get().includes("TODO"))
  .list();
```

## FAQ

**Q: When should I use SQLite vs WAL?**
A: Use WAL for frequent writes, SQLite for compatibility.

**Q: Can I mix both persistence formats?**
A: Yes! Load from .fxd, save to .fxwal, or vice versa.

**Q: How do I debug reactive behavior?**
A: Use signals to log all changes, or pause atomics with `link.pause()`.

**Q: Can snippets reference each other?**
A: Yes! Use views with `hoistImports: true` to combine them properly.

**Q: How do I handle large graphs?**
A: Use WAL for streaming, signals for selective updates, and groups with filters.

---

**You're ready to build with FXD!** 🚀

Start with the comprehensive demo, then explore the examples directory.

Happy coding!
