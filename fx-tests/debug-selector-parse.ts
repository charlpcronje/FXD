#!/usr/bin/env -S deno run -A
// Debug selector parsing

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Debugging selector parsing...\n");

// Create snippet
createSnippet(
  "snippets.test",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

// Create a group and examine its internal state
const g = $$("test.group").group([]);
const internal = g._group;

console.log("1. Before include:");
console.log("   includeSelectors:", internal.includeSelectors);

// Add selector
g.include('.snippet[file="test.js"]');

console.log("\n2. After include:");
console.log("   includeSelectors length:", internal.includeSelectors?.length || 0);
console.log("   includeSelectors:", JSON.stringify(internal.includeSelectors, null, 2));

// Check if collectBySelectors is working
console.log("\n3. Testing collectBySelectors:");
const collected = internal.collectBySelectors(internal.includeSelectors);
console.log("   Collected nodes:", collected.length);

// Check materialize
console.log("\n4. Testing materialize:");
const materialized = internal.materialize();
console.log("   Materialized nodes:", materialized.length);

// Let's manually walk the tree and count snippets
console.log("\n5. Manual tree walk:");
let count = 0;
const walk = (node: any) => {
  if (node.__type === "snippet") {
    count++;
    console.log(`   Found snippet: ${node.__id}`);
    console.log(`     Meta:`, (node as any).__meta);
  }
  for (const key in node.__nodes) {
    walk(node.__nodes[key]);
  }
};
walk(fx.root);
console.log("   Total snippets found:", count);