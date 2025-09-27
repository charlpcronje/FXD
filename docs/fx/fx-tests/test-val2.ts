#!/usr/bin/env -S deno run -A
// Test val() behavior properly

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing val() properly...\n");

// Set a value
console.log("1. Setting value:");
const proxy = $$("test.path");
proxy.val("Hello World");

// Get it back - val is a property that returns a function
console.log("\n2. Getting value:");
const valFn = proxy.val;
console.log("   val property type:", typeof valFn);
const value = valFn();  // Call without arguments to get value
console.log("   Returned value type:", typeof value);
console.log("   Returned value:", value);

// Try with fx.val
console.log("\n3. Using fx.val on node:");
const node = proxy.node();
const directVal = fx.val(node);
console.log("   Direct value:", directVal);

// The issue is that proxy.val returns the baseFn!
// Let's check what happens when a group returns proxies
console.log("\n4. In a group:");
$$("test.g").group(["test.path"]);
const g = $$("test.g").group();
const items = g.list();
console.log("   Items:", items.length);
if (items.length > 0) {
  const item = items[0];
  console.log("   Item type:", typeof item);
  console.log("   Item.val type:", typeof item.val);
  const itemVal = item.val();
  console.log("   Item value:", itemVal);
}