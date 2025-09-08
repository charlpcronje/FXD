#!/usr/bin/env -S deno run -A
// Add debug logging to FX and test

// Patch console.log to add timestamps
const originalLog = console.log;
console.log = (...args: any[]) => {
  originalLog(...args);
};

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

// Patch matchSimple to add logging
const matchSimple = (fx as any).matchSimple;
if (matchSimple) {
  (fx as any).matchSimple = function(fxCore: any, node: any, s: any) {
    console.log("  matchSimple:", s.kind, s.name || s.key || s.id);
    const result = matchSimple.call(this, fxCore, node, s);
    console.log("    Result:", result);
    return result;
  };
}

Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Testing with debug logging...\n");

// Create a snippet
createSnippet(
  "snippets.test",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

// Try the selector
console.log("Creating group with selector:");
const g = $$("test.group")
  .group([])
  .include('.snippet[file="test.js"]');

console.log("\nCalling list():");
const items = g.list();
console.log("Items found:", items.length);

// Try to access internal state
const internal = g._group;
console.log("\nInternal state:");
console.log("  includeSelectors:", internal.includeSelectors?.length || 0);
console.log("  members:", internal.members?.size || 0);

// Try reconcile
console.log("\nTrying reconcile:");
internal.reconcile();
console.log("  After reconcile members:", internal.members?.size || 0);