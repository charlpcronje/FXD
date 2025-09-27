#!/usr/bin/env -S deno run -A
// Debug addPath in Group

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Testing Group addPath...\n");

// Create a snippet
createSnippet(
  "test.snippet",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

// Verify node exists
console.log("1. Node verification:");
const node = $$("test.snippet").node();
console.log("   Node exists:", !!node);
console.log("   Node ID:", node.__id);

// Try to resolve path
console.log("\n2. Path resolution:");
const resolved = fx.resolvePath("test.snippet", fx.root);
console.log("   Resolved:", !!resolved);
console.log("   Same node:", resolved === node);

// Create group and manually call addPath
console.log("\n3. Group addPath:");
const g = $$("test.group").group([]);
console.log("   Initial members:", g.list().length);

// Access internal Group
const internalGroup = g._group;
console.log("   Has internal group:", !!internalGroup);

// Try to add path directly
internalGroup.addPath("test.snippet");
console.log("   After addPath:", g.list().length);

// Check members directly
console.log("   Internal members size:", internalGroup.members?.size || "no members");

// Let's trace through the addPath implementation
console.log("\n4. Manual add:");
const n = fx.resolvePath("test.snippet", fx.root);
if (n) {
  console.log("   Found node to add");
  internalGroup.add(n);
  console.log("   After manual add:", g.list().length);
}

// Try reconcile
console.log("\n5. Reconcile:");
internalGroup.reconcile();
console.log("   After reconcile:", g.list().length);

// Check if initSelection helps
console.log("\n6. Init selection:");
internalGroup.initSelection();
console.log("   After initSelection:", g.list().length);