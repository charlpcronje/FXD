#!/usr/bin/env -S deno run -A
// Test createSnippet

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Testing createSnippet...\n");

// First check the node before createSnippet
console.log("1. Before createSnippet:");
$$("snippets.test").val("Initial value");
const nodeBefore = $$("snippets.test").node();
console.log("   Type:", nodeBefore.__type);
console.log("   Value:", $$("snippets.test").val());

// Now create snippet
console.log("\n2. Creating snippet:");
createSnippet(
  "snippets.test",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

// Check after
const nodeAfter = $$("snippets.test").node();
console.log("   Type:", nodeAfter.__type);
console.log("   Meta:", (nodeAfter as any).__meta);
console.log("   Value via val():", $$("snippets.test").val());
console.log("   Raw __value:", nodeAfter.__value);

// The issue might be in how groups are matching
// Let's check if nodes at the path have the right type
console.log("\n3. Walking tree to find snippets:");
const walk = (node: any, path = "") => {
  for (const key in node.__nodes) {
    const child = node.__nodes[key];
    const childPath = path ? `${path}.${key}` : key;
    if (childPath.startsWith("snippets")) {
      console.log(`   ${childPath}: type=${child.__type || "none"}`);
      if (child.__type) {
        console.log(`     Meta:`, (child as any).__meta);
      }
    }
    if (key === "snippets" || (path === "snippets" && key === "test")) {
      walk(child, childPath);
    }
  }
};
walk(fx.root);