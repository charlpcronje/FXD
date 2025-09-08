#!/usr/bin/env -S deno run -A
// Test val() behavior

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing val() behavior...\n");

// Set a value
console.log("1. Setting value:");
$$("test.path").val("Hello World");

// Get it back
console.log("\n2. Getting value:");
const val1 = $$("test.path").val();
console.log("   Type:", typeof val1);
console.log("   Value:", val1);

// If it's a function, try calling it
if (typeof val1 === "function") {
  console.log("   Calling it:", val1());
}

// Try using fx.val directly
console.log("\n3. Using fx.val:");
const node = $$("test.path").node();
const val2 = fx.val(node);
console.log("   Type:", typeof val2);
console.log("   Value:", val2);

// Check the raw __value
console.log("\n4. Raw __value:");
console.log("   __value:", node.__value);

// Try getting the raw value
if (node.__value && typeof node.__value === "object") {
  console.log("   raw:", node.__value.raw);
  console.log("   parsed:", node.__value.parsed);
  console.log("   stringified:", node.__value.stringified);
}