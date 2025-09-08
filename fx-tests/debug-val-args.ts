#!/usr/bin/env -S deno run -A
// Debug val arguments issue

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Debugging val arguments...\n");

// Set a value
$$("test").set("Hello World");

// Get the val function
const proxy = $$("test");
const valFn = proxy.val;

console.log("1. Val function:");
console.log("   Type:", typeof valFn);
console.log("   Length:", valFn.length);

// Call with different arguments
console.log("\n2. Calling with no args:");
const result1 = valFn();
console.log("   Result:", result1);

console.log("\n3. Calling with undefined:");
const result2 = valFn(undefined);
console.log("   Result:", result2);

console.log("\n4. Calling with null:");
const result3 = valFn(null);
console.log("   Result:", result3);

console.log("\n5. Getting value from node directly:");
const node = proxy.node();
console.log("   fx.val(node):", fx.val(node));