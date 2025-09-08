#!/usr/bin/env -S deno run -A
// Debug CSS selector matching

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Debugging CSS selector matching...\n");

// Create a snippet
createSnippet(
  "snippets.test",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

const node = $$("snippets.test").node();
console.log("1. Node properties:");
console.log("   Type:", node.__type);
console.log("   Meta:", (node as any).__meta);

// Parse the selector
console.log("\n2. Parse selector:");
const selector = '.snippet[file="test.js"]';
console.log("   Selector:", selector);

// Import the CSS selector parser
const parseSelector = (fx as any).parseSelector || ((s: string) => {
  console.log("   parseSelector not exposed, using mock");
  return [];
});

const parsed = parseSelector(selector);
console.log("   Parsed:", JSON.stringify(parsed, null, 2));

// Check if the node would match
console.log("\n3. Manual matching test:");

// Check type match
const hasType = node.__type === "snippet";
console.log("   Has type 'snippet':", hasType);

// Check attribute match
const meta = (node as any).__meta || {};
const hasFile = meta.file === "test.js";
console.log("   Has file='test.js':", hasFile);

// Both should be true for match
console.log("   Should match:", hasType && hasFile);

// Try a simpler selector
console.log("\n4. Try simpler selectors:");

// Just type selector
const g1 = $$("test.bytype").group([]).select("snippet");
console.log("   select('snippet'):", g1.list().length);

// Let's manually check what's in the tree
console.log("\n5. Tree structure:");
const printTree = (n: any, indent = "") => {
  for (const key in n.__nodes) {
    const child = n.__nodes[key];
    console.log(`${indent}${key}: type=${child.__type || "none"}`);
    if (key === "snippets" || key === "test") {
      printTree(child, indent + "  ");
    }
  }
};
printTree(fx.root);