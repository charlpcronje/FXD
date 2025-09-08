#!/usr/bin/env -S deno run -A
// Debug script to test Group functionality

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";

console.log("🔍 Testing Group functionality...\n");

// Create test snippets
createSnippet(
  "test.snippet1",
  "console.log('Hello');",
  { lang: "js", file: "test.js", order: 0, id: "test-001" }
);

createSnippet(
  "test.snippet2",
  "console.log('World');",
  { lang: "js", file: "test.js", order: 1, id: "test-002" }
);

// Check if snippets were created
console.log("1. Checking snippet nodes:");
const node1 = $$("test.snippet1").node();
const node2 = $$("test.snippet2").node();
console.log("   test.snippet1 type:", (node1 as any).__type);
console.log("   test.snippet1 meta:", (node1 as any).__meta);
console.log("   test.snippet1 value:", $$("test.snippet1").val());
console.log("   test.snippet2 type:", (node2 as any).__type);
console.log("   test.snippet2 value:", $$("test.snippet2").val());

// Create a group and check include
console.log("\n2. Testing Group include:");
const group = $$("test.view").group([]);
console.log("   Initial group items:", group.list().length);

// Try different selectors
console.log("\n3. Testing selectors:");

// Direct path include
group.include("test.snippet1");
console.log("   After include('test.snippet1'):", group.list().length);

// Type selector
$$("test.view2").group([]).include(".snippet");
const g2 = $$("test.view2").group();
console.log("   .snippet selector items:", g2.list().length);

// Attribute selector for file
$$("test.view3").group([]).include('.snippet[file="test.js"]');
const g3 = $$("test.view3").group();
console.log("   .snippet[file=\"test.js\"] items:", g3.list().length);

// Manual group with paths
$$("test.view4").group(["test.snippet1", "test.snippet2"]);
const g4 = $$("test.view4").group();
console.log("   Manual group items:", g4.list().length);

// Test rendering
console.log("\n4. Testing renderView:");
try {
  const rendered = renderView("test.view4");
  console.log("   Rendered length:", rendered.length);
  console.log("   Rendered preview:");
  console.log(rendered.split('\n').slice(0, 5).map(l => '     ' + l).join('\n'));
} catch (e) {
  console.log("   Error:", e);
}

// Debug the actual FX tree structure
console.log("\n5. Debugging FX tree:");
console.log("   Root keys:", Object.keys(fx.root));
console.log("   Has 'test' branch:", 'test' in fx.root);
if ('test' in fx.root) {
  console.log("   test branch keys:", Object.keys((fx.root as any).test));
}

// Check snippet index
console.log("\n6. Checking snippet index:");
import { findBySnippetId } from "./modules/fx-snippets.ts";
console.log("   test-001:", findBySnippetId("test-001"));
console.log("   test-002:", findBySnippetId("test-002"));