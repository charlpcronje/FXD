#!/usr/bin/env -S deno run -A
// Debug script to understand FX node creation

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing node creation paths...\n");

// Method 1: Direct value set
console.log("1. Direct value set with $$:");
$$("test.direct").val("Hello");
const directNode = $$("test.direct").node();
console.log("   Node created:", !!directNode);
console.log("   Node ID:", directNode.__id);
console.log("   Node parent:", directNode.__parent_id);
console.log("   Value:", $$("test.direct").val());

// Check if it's in the tree
console.log("\n2. Check if in tree:");
const resolved = fx.resolvePath("test.direct", fx.root);
console.log("   Resolved from root:", !!resolved);
console.log("   Same node:", resolved === directNode);

// Check tree structure
console.log("\n3. Tree structure:");
console.log("   Root has 'test':", "test" in fx.root.__nodes);
if (fx.root.__nodes.test) {
  console.log("   test has 'direct':", "direct" in fx.root.__nodes.test.__nodes);
}

// Try manual Group with direct path
console.log("\n4. Manual group with path:");
$$("views.test").group(["test.direct"]);
const group = $$("views.test").group();
console.log("   Group list length:", group.list().length);

// Try creating snippet the same way
console.log("\n5. Create snippet:");
import { createSnippet } from "./modules/fx-snippets.ts";

createSnippet(
  "snippets.test1",
  "console.log('snippet');",
  { lang: "js", file: "test.js", id: "test-001" }
);

const snippetNode = $$("snippets.test1").node();
console.log("   Snippet node created:", !!snippetNode);
console.log("   Snippet node type:", snippetNode.__type);
console.log("   Snippet in tree:", !!fx.resolvePath("snippets.test1", fx.root));

// Try group with snippet
$$("views.snippets").group(["snippets.test1"]);
const snippetGroup = $$("views.snippets").group();
console.log("   Snippet group list:", snippetGroup.list().length);

// Debug the actual group implementation
console.log("\n6. Debug group internals:");
const g = $$("views.debug").group(["test.direct", "snippets.test1"]);
console.log("   Group returned:", !!g);
console.log("   Group has list method:", typeof g.list === "function");
const items = g.list();
console.log("   Items returned:", items);
console.log("   Items length:", items.length);

// Let's trace the actual addPath flow
console.log("\n7. Trace addPath:");
const testGroup = new (fx as any).constructor.prototype.constructor.Group(fx, fx.root);
console.log("   Created raw Group:", !!testGroup);