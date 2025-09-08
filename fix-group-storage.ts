#!/usr/bin/env -S deno run -A
// Test if groups should be stored on nodes

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing group storage...\n");

// Create a group with items
console.log("1. Create group with items:");
const g1 = $$("views.test").group(["config.fx"]);
console.log("   Group created");
console.log("   Initial list:", g1.list().length);

// Try to get the "same" group
console.log("\n2. Try to get 'same' group:");
const g2 = $$("views.test").group();
console.log("   Got group");
console.log("   List length:", g2.list().length);
console.log("   Are they the same?:", g1 === g2);
console.log("   Internal group same?:", g1._group === g2._group);

// Check if group is stored on node
console.log("\n3. Check node storage:");
const node = $$("views.test").node();
console.log("   Node exists:", !!node);
console.log("   Node has __group:", "__group" in node);
console.log("   Node value:", node.__value);

// The issue is that group() always creates a new Group!
// Let's see if we can store it on the node
console.log("\n4. Manual storage test:");
const testGroup = $$("views.manual").group(["config.fx", "system.fx"]);
const manualNode = $$("views.manual").node();
(manualNode as any).__storedGroup = testGroup._group;
console.log("   Stored group on node");

// Now let's modify fx-view.ts to handle this properly
console.log("\n5. Current fx-view issue:");
console.log("   renderView expects .group() to return existing group");
console.log("   But .group() always creates new empty group");
console.log("   This is why list() returns empty array");