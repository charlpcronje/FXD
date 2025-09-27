#!/usr/bin/env -S deno run -A
// Debug FX tree structure

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing FX tree structure...\n");

// Create a simple value
console.log("1. Creating simple value:");
$$("test.simple").val("Hello World");
console.log("   Value set");

// Check how it's stored
console.log("\n2. Checking storage:");
const node = $$("test.simple").node();
console.log("   Node:", node);
console.log("   Node __value:", (node as any).__value);
console.log("   Node __type:", (node as any).__type);

// Check if test branch exists now
console.log("\n3. Checking tree structure:");
console.log("   Root keys:", Object.keys(fx.root));
console.log("   Has 'test' branch:", 'test' in fx.root);

// Try getting value back
console.log("\n4. Getting value:");
const val = $$("test.simple").val();
console.log("   Value type:", typeof val);
console.log("   Value:", val);

// If val is a function, try calling it
if (typeof val === "function") {
  console.log("   Calling value():", val());
}

// Check proxy behavior
console.log("\n5. Checking proxy:");
const proxy = $$("test.simple");
console.log("   Proxy type:", typeof proxy);
console.log("   Proxy.val type:", typeof proxy.val);
console.log("   Proxy.val():", proxy.val());

// Try group directly
console.log("\n6. Testing group:");
$$("test.group").group(["test.simple"]);
const g = $$("test.group").group();
console.log("   Group:", g);
console.log("   Group.list:", g.list);
console.log("   Group.list():", g.list());

// Check what list returns
const items = g.list();
console.log("   Items length:", items.length);
if (items.length > 0) {
  console.log("   First item:", items[0]);
  console.log("   First item type:", typeof items[0]);
}