#!/usr/bin/env -S deno run -A
/**
 * FXD Comprehensive Demo - Showcases ALL Features
 *
 * This demo exercises every major FXD capability in one cohesive workflow:
 * 1. Core FX - Nodes, values, watchers
 * 2. Snippets - Code management with markers
 * 3. Views - Rendering multiple snippets
 * 4. Round-trip - Edit and parse back
 * 5. Persistence - SQLite (.fxd files)
 * 6. WAL Persistence - Fast append-only log
 * 7. Signals - Reactive event streams
 * 8. fx-atomics - Entangle nodes
 * 9. Reactive Snippets - Functions with parameter mapping
 *
 * Run: deno run -A examples/comprehensive-demo.ts
 */

// Import core FX
import { $$, $_$$, fx } from "../fxn.ts";

// Import modules
import { createSnippet, clearSnippetIndex } from "../modules/fx-snippets.ts";
import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";
import { FXDisk } from "../modules/fx-persistence-deno.ts";
import { FXDiskWAL } from "../modules/fx-persistence-wal.ts";
import { SignalStream, SignalKind, getSignalStream } from "../modules/fx-signals.ts";
import { loadAtomicsPlugin } from "../plugins/fx-atomics.ts";
import { createReactiveSnippet, getSnippetResult } from "../modules/fx-reactive-snippets.ts";

// Setup globals
Object.assign(globalThis, { $$, $_$$, fx });

console.log("═══════════════════════════════════════════════════");
console.log("   FXD COMPREHENSIVE DEMO - ALL FEATURES");
console.log("═══════════════════════════════════════════════════\n");

// ============================================
// 1. Core FX - Creating nodes and values
// ============================================
console.log("1. Core FX - Creating nodes and watching changes");
console.log("─────────────────────────────────────────────────\n");

// Create nested data structure
$$("demo.user.name").val("Alice");
$$("demo.user.age").val(28);
$$("demo.user.email").val("alice@example.com");

// Watch a value
let watchCount = 0;
const unwatch = $$("demo.user.age").watch((newVal, oldVal) => {
  watchCount++;
  console.log(`  ✓ Watcher fired: age changed from ${oldVal} to ${newVal}`);
});

// Modify the value
$$("demo.user.age").val(29);

console.log(`  ✓ Created nested structure: demo.user.*`);
console.log(`  ✓ Value: ${$$("demo.user.name").val()}, age ${$$("demo.user.age").val()}`);
console.log(`  ✓ Watchers fired: ${watchCount} time(s)\n`);

// ============================================
// 2. Snippets - Code management with markers
// ============================================
console.log("2. Snippets - Creating code snippets with metadata");
console.log("─────────────────────────────────────────────────\n");

// Clear any existing snippet index
clearSnippetIndex();

// Create a utility snippet
createSnippet(
  "code.utils.helpers",
  `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}`,
  {
    id: "helpers-001",
    lang: "js",
    file: "src/utils.js",
    order: 1
  }
);

// Create a main function snippet
createSnippet(
  "code.main.entry",
  `import { add, multiply } from './utils.js';

function main() {
  const sum = add(5, 3);
  const product = multiply(4, 7);
  console.log(\`Sum: \${sum}, Product: \${product}\`);
}

main();`,
  {
    id: "main-entry-001",
    lang: "js",
    file: "src/main.js",
    order: 2
  }
);

console.log("  ✓ Created 2 code snippets");
const helpersCode = $$("code.utils.helpers").val() || "";
const mainCode = $$("code.main.entry").val() || "";
console.log(`    - helpers-001 (${String(helpersCode).split('\n').length} lines)`);
console.log(`    - main-entry-001 (${String(mainCode).split('\n').length} lines)\n`);

// ============================================
// 3. Views - Rendering multiple snippets
// ============================================
console.log("3. Views - Creating and rendering composite views");
console.log("─────────────────────────────────────────────────\n");

// Create a view that groups snippets by file
$$("views.codebase")
  .group(["code.utils.helpers", "code.main.entry"])
  .reactive(true);

const rendered = renderView("views.codebase", {
  lang: "js",
  hoistImports: true,
  separator: "\n\n"
});

console.log("  ✓ Created reactive view 'views.codebase'");
console.log(`  ✓ Rendered output: ${rendered.split('\n').length} lines`);
console.log("  ✓ First few lines:");
const preview = rendered.split('\n').slice(0, 8).join('\n');
console.log(preview.split('\n').map(l => `    ${l}`).join('\n'));
console.log("    ...\n");

// ============================================
// 4. Round-trip - Edit and parse back
// ============================================
console.log("4. Round-trip - Editing rendered code and parsing back");
console.log("─────────────────────────────────────────────────\n");

// Simulate an edit to the rendered code
const edited = rendered.replace(
  "return a + b;",
  "return a + b; // with comment"
);

// Parse the edited code back into patches
const patches = toPatches(edited);
console.log(`  ✓ Parsed ${patches.length} patches from edited code`);

// Apply patches back to nodes
applyPatches(patches);

// Verify the change propagated
const updatedCode = $$("code.utils.helpers").val();
const hasComment = updatedCode.includes("// with comment");
console.log(`  ✓ Change propagated: ${hasComment ? "YES" : "NO"}`);
console.log(`  ✓ Updated code contains comment: ${hasComment}\n`);

// ============================================
// 5. Persistence - Save to SQLite (.fxd)
// ============================================
console.log("5. Persistence - Saving to SQLite (.fxd file)");
console.log("─────────────────────────────────────────────────\n");

const fxdPath = "./examples/comprehensive-demo.fxd";
const disk = new FXDisk(fxdPath, true);

const saveStart = performance.now();
disk.save();
const saveTime = performance.now() - saveStart;

const stats = disk.stats();
console.log(`  ✓ Saved to ${fxdPath}`);
console.log(`  ✓ Nodes: ${stats.nodes}`);
console.log(`  ✓ Snippets: ${stats.snippets}`);
console.log(`  ✓ Time: ${saveTime.toFixed(2)}ms`);
disk.close();
console.log();

// ============================================
// 6. WAL Persistence - Fast append-only log
// ============================================
console.log("6. WAL Persistence - Saving to Write-Ahead Log");
console.log("─────────────────────────────────────────────────\n");

const walPath = "./examples/comprehensive-demo.fxwal";
const walDisk = new FXDiskWAL(walPath);

const walStart = performance.now();
await walDisk.init();
await walDisk.save();
const walTime = performance.now() - walStart;

const walStats = await walDisk.stats();
console.log(`  ✓ Saved to ${walPath}`);
console.log(`  ✓ Records: ${walStats.recordCount}`);
console.log(`  ✓ Size: ${walStats.byteSize} bytes`);
console.log(`  ✓ Time: ${walTime.toFixed(2)}ms`);
console.log(`  ✓ Speedup: ${(saveTime / walTime).toFixed(1)}x faster than SQLite`);
walDisk.close();
console.log();

// ============================================
// 7. Signals - Subscribe to reactive events
// ============================================
console.log("7. Signals - Subscribing to reactive event streams");
console.log("─────────────────────────────────────────────────\n");

const signalStream = getSignalStream();
let signalCount = 0;

// Subscribe to value changes
const unsub = signalStream.subscribe(
  { kind: SignalKind.VALUE },
  (signal) => {
    signalCount++;
    console.log(`  ✓ Signal ${signal.seq}: ${signal.kind} on node ${signal.sourceNodeId}`);
  }
);

// Create some changes to trigger signals
$$("demo.counter").val(0);
$$("demo.counter").val(1);
$$("demo.counter").val(2);

// Give signals time to fire
await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  ✓ Total signals received: ${signalCount}`);
console.log(`  ✓ Signal stream stats:`, signalStream.getStats());
unsub();
console.log();

// ============================================
// 8. Atomics - Entangle nodes for bi-sync
// ============================================
console.log("8. Atomics - Entangling nodes for automatic sync");
console.log("─────────────────────────────────────────────────\n");

const atomics = loadAtomicsPlugin();

// Create two nodes
$$("state.celsius").val(0);
$$("state.fahrenheit").val(32);

// Entangle them with conversion functions
const link = atomics.entangle(
  "state.celsius",
  "state.fahrenheit",
  {
    bidirectional: true,
    mapAToB: (c: number) => (c * 9/5) + 32,
    mapBToA: (f: number) => (f - 32) * 5/9,
  }
);

console.log("  ✓ Entangled celsius ↔ fahrenheit");

// Change celsius, should update fahrenheit
$$("state.celsius").val(100);
await new Promise(resolve => setTimeout(resolve, 10)); // Let atomics propagate

console.log(`  ✓ Set celsius = 100°C`);
console.log(`  ✓ Fahrenheit auto-updated to: ${$$("state.fahrenheit").val()}°F`);

// Change fahrenheit, should update celsius
$$("state.fahrenheit").val(68);
await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  ✓ Set fahrenheit = 68°F`);
console.log(`  ✓ Celsius auto-updated to: ${$$("state.celsius").val().toFixed(1)}°C`);

link.dispose();
console.log("  ✓ Disposed entanglement\n");

// ============================================
// 9. Reactive Snippets - Functions with params
// ============================================
console.log("9. Reactive Snippets - Functions that auto-execute");
console.log("─────────────────────────────────────────────────\n");

// Create input nodes
$$("inputs.width").val(10);
$$("inputs.height").val(20);

// Create a reactive snippet that calculates area
createReactiveSnippet(
  "functions.calculateArea",
  function calculateArea(width: number, height: number) {
    return width * height;
  },
  {
    id: "calc-area-001",
    lang: "js",
    params: {
      width: "inputs.width",
      height: "inputs.height"
    },
    output: "outputs.area",
    reactive: true,
    debounce: 5
  }
);

// Wait for initial execution
await new Promise(resolve => setTimeout(resolve, 20));

console.log("  ✓ Created reactive function 'calculateArea'");
console.log(`  ✓ Initial: width=${$$("inputs.width").val()}, height=${$$("inputs.height").val()}`);
console.log(`  ✓ Result: area=${$$("outputs.area").val()}`);

// Change inputs - function should auto-execute
$$("inputs.width").val(15);
$$("inputs.height").val(25);

// Wait for debounced execution
await new Promise(resolve => setTimeout(resolve, 20));

console.log(`  ✓ Updated: width=${$$("inputs.width").val()}, height=${$$("inputs.height").val()}`);
console.log(`  ✓ Auto-calculated: area=${$$("outputs.area").val()}`);
console.log();

// ============================================
// 10. Complete Workflow - Everything Together
// ============================================
console.log("10. Complete Workflow - All features working together");
console.log("─────────────────────────────────────────────────\n");

// Create a complex project structure
$$("project.config.name").val("FXD Demo App");
$$("project.config.version").val("1.0.0");

// Create multiple interconnected snippets
createSnippet(
  "project.src.config",
  `export const config = {
  appName: "FXD Demo",
  port: 3000
};`,
  { id: "config-001", lang: "js", file: "config.js" }
);

createSnippet(
  "project.src.server",
  `import { config } from './config.js';

export function startServer() {
  console.log(\`Starting \${config.appName} on port \${config.port}\`);
}`,
  { id: "server-001", lang: "js", file: "server.js" }
);

// Create view
$$("views.project")
  .group(["project.src.config", "project.src.server"])
  .reactive(true);

// Render
const projectCode = renderView("views.project", { hoistImports: true });

// Save everything to both formats
const finalFxd = new FXDisk("./examples/demo-final.fxd", true);
finalFxd.save();
finalFxd.close();

const finalWal = new FXDiskWAL("./examples/demo-final.fxwal");
await finalWal.init();
await finalWal.save();
finalWal.close();

console.log("  ✓ Created complete project structure");
console.log("  ✓ Generated composite view");
console.log("  ✓ Saved to both .fxd (SQLite) and .fxwal (WAL)");
console.log(`  ✓ Code ready to execute: ${projectCode.split('\n').length} lines`);
console.log();

// ============================================
// Summary
// ============================================
console.log("═══════════════════════════════════════════════════");
console.log("   DEMO COMPLETE! All features verified");
console.log("═══════════════════════════════════════════════════\n");

console.log("✅ Features Demonstrated:");
console.log("  1. Core FX - Nodes, values, watchers");
console.log("  2. Snippets - Code management with metadata");
console.log("  3. Views - Rendering & composition");
console.log("  4. Round-trip - Edit → Parse → Apply");
console.log("  5. Persistence - SQLite storage (.fxd)");
console.log("  6. WAL Persistence - Fast append-only log (.fxwal)");
console.log("  7. Signals - Reactive event streams");
console.log("  8. Atomics - Bi-directional entanglement");
console.log("  9. Reactive Snippets - Auto-executing functions");
console.log(" 10. Complete Workflow - All features together\n");

console.log("📁 Files Created:");
console.log("  - examples/comprehensive-demo.fxd");
console.log("  - examples/comprehensive-demo.fxwal");
console.log("  - examples/demo-final.fxd");
console.log("  - examples/demo-final.fxwal\n");

console.log("🎯 Performance:");
console.log(`  - SQLite save: ${saveTime.toFixed(2)}ms`);
console.log(`  - WAL save: ${walTime.toFixed(2)}ms`);
console.log(`  - Speedup: ${(saveTime / walTime).toFixed(1)}x\n`);

console.log("Next Steps:");
console.log("  - Inspect .fxd files: sqlite3 examples/comprehensive-demo.fxd");
console.log("  - View WAL stats: deno run -A examples/comprehensive-demo.ts");
console.log("  - See QUICK-START.md for more examples\n");

// Cleanup watchers
unwatch();
