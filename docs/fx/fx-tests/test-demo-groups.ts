#!/usr/bin/env -S deno run -A
// Test how the demo creates groups

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Testing demo group creation...\n");

// Create snippets exactly like demo
createSnippet(
  "snippets.user.imports",
  `import { hash, verify } from 'bcrypt';`,
  { lang: "js", file: "src/User.js", order: 0, id: "user-imports-001" }
);

createSnippet(
  "snippets.user.class",
  `export class User {
  constructor(name, email) {
    this.id = Date.now().toString(36);
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }
}`,
  { lang: "js", file: "src/User.js", order: 1, id: "user-class-001" }
);

// Create view exactly like demo
console.log("1. Creating view like demo:");
$$("views.User")
  .group([])
  .include('.snippet[file="src/User.js"]')
  .reactive(true);

// Now try to get the group back
console.log("\n2. Getting group back:");
const g = $$("views.User").group();
console.log("   Group list length:", g.list().length);

// Check if group was stored
const node = $$("views.User").node();
console.log("   Node has __group:", !!(node as any).__group);

// If we have the stored group, check its state
if ((node as any).__group) {
  const stored = (node as any).__group;
  console.log("   Stored group members:", stored.members?.size || 0);
  console.log("   Stored group includeSelectors:", stored.includeSelectors?.length || 0);
}

// Try creating a new group with include
console.log("\n3. Fresh group with include:");
const fresh = $$("views.Fresh")
  .group([])
  .include('.snippet[file="src/User.js"]');
console.log("   Fresh group list:", fresh.list().length);

// Check the internal group
console.log("   Fresh internal members:", fresh._group.members?.size || 0);

// Try calling reconcile manually
console.log("\n4. Manual reconcile:");
fresh._group.reconcile();
console.log("   After reconcile:", fresh.list().length);

// Check what scanFallback returns
console.log("\n5. Check scanFallback:");
const testGroup = fresh._group;
const fallback = testGroup.scanFallback();
console.log("   scanFallback returns:", fallback.length, "nodes");

// Check what materialize returns
console.log("\n6. Check materialize:");
const materialized = testGroup.materialize();
console.log("   materialize returns:", materialized.length, "nodes");