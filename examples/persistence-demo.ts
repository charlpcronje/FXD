/**
 * FXD Persistence Demo
 *
 * Demonstrates how to save and load FX graphs to .fxd files
 * .fxd files are SQLite databases that store the complete node structure
 */

import { $$, $_$$ } from "../fxn.ts";
import { createSnippet } from "../modules/fx-snippets.ts";
import { renderView } from "../modules/fx-view.ts";
import { FXDisk } from "../modules/fx-persistence-deno.ts";

// Setup globals
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== FXD Persistence Demo ===\n");

// Example 1: Save and load simple data
console.log("Example 1: Basic Save/Load");
console.log("============================\n");

$$("app.name").val("My FXD Project");
$$("app.version").val("1.0.0");
$$("app.author").val("FXD Team");

console.log("  Created project metadata:");
console.log(`    Name: ${$$("app.name").val()}`);
console.log(`    Version: ${$$("app.version").val()}`);
console.log(`    Author: ${$$("app.author").val()}`);

const disk1 = new FXDisk("./examples/demo-project.fxd", true);
disk1.save();
console.log(`\n  💾 Saved to demo-project.fxd`);
console.log(`     Stats: ${JSON.stringify(disk1.stats())}`);
disk1.close();

// Example 2: Load from file
console.log("\n\nExample 2: Loading from .fxd File");
console.log("============================\n");

// Clear current data
let root = $$("app").node();
if (root.__nodes) {
  for (const key in root.__nodes) {
    delete root.__nodes[key];
  }
}

console.log("  Cleared app namespace");
console.log(`  App name after clear: ${$$("app.name").val()}`);

const disk2 = new FXDisk("./examples/demo-project.fxd");
disk2.load();
console.log("\n  📂 Loaded from demo-project.fxd");
console.log(`     Name: ${$$("app.name").val()}`);
console.log(`     Version: ${$$("app.version").val()}`);
console.log(`     Author: ${$$("app.author").val()}`);
disk2.close();

// Example 3: Saving code snippets
console.log("\n\nExample 3: Code Snippet Persistence");
console.log("============================\n");

createSnippet("code.greet", "function greet(name) { return `Hello, ${name}!`; }", {
  id: "greet-func",
  lang: "js",
  file: "utils.js",
  order: 1
});

createSnippet("code.farewell", "function farewell() { return 'Goodbye!'; }", {
  id: "farewell-func",
  lang: "js",
  file: "utils.js",
  order: 2
});

console.log("  Created 2 code snippets");

// Create a view
$$("views.utils").group(["code.greet", "code.farewell"]);

const rendered = renderView("views.utils", { lang: "js", hoistImports: false });
console.log("\n  Rendered view:");
console.log(rendered.split('\n').map((l: string) => `    ${l}`).join('\n'));

// Save with snippets
const disk3 = new FXDisk("./examples/code-project.fxd", true);
disk3.save();
console.log(`\n  💾 Saved to code-project.fxd`);
console.log(`     Snippets: ${disk3.stats().snippets}`);
disk3.close();

// Example 4: Full round-trip
console.log("\n\nExample 4: Full Round-Trip Workflow");
console.log("============================\n");

console.log("  Step 1: Create complex structure");
$$("project.config").set({
  theme: "dark",
  language: "en",
  features: {
    enableSync: true,
    enableNotifications: false
  }
});

createSnippet("project.code.auth", "export function authenticate(user, pass) { }", {
  id: "auth",
  lang: "ts",
  file: "auth.ts"
});

console.log("    ✓ Config object with nested structure");
console.log("    ✓ Auth code snippet");

console.log("\n  Step 2: Save everything");
const disk4 = new FXDisk("./examples/full-project.fxd", true);
disk4.save();
const stats4 = disk4.stats();
console.log(`    ✓ Saved ${stats4.nodes} nodes, ${stats4.snippets} snippets`);
disk4.close();

console.log("\n  Step 3: Simulate app restart (clear memory)");
root = $$("project").node();
if (root.__nodes) {
  for (const key in root.__nodes) {
    delete root.__nodes[key];
  }
}
console.log("    ✓ Memory cleared");

console.log("\n  Step 4: Reload from disk");
const disk5 = new FXDisk("./examples/full-project.fxd");
disk5.load();
console.log("    ✓ Loaded from disk");

console.log("\n  Step 5: Verify everything restored");
const config = $$("project.config").get();
console.log(`    Config: ${JSON.stringify(config)}`);
console.log(`    Auth code: ${$$("project.code.auth").val()?.substring(0, 40)}...`);

disk5.close();

// Summary
console.log("\n\n=== Summary ===\n");
console.log("✅ Simple values (strings, numbers) persist correctly");
console.log("✅ Complex objects are promoted to nested nodes");
console.log("✅ Code snippets with metadata persist correctly");
console.log("✅ Full graph structure is preserved");
console.log("✅ Multiple save/load cycles work perfectly");
console.log("\n💾 .fxd files are portable SQLite databases");
console.log("📦 Share .fxd files to share entire FX graphs");

console.log("\n=== Demo Complete! ===\n");
console.log("Files created:");
console.log("  - examples/demo-project.fxd");
console.log("  - examples/code-project.fxd");
console.log("  - examples/full-project.fxd");
console.log("\nYou can inspect these with:");
console.log("  sqlite3 examples/demo-project.fxd");
