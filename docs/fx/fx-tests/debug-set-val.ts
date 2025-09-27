#!/usr/bin/env -S deno run -A
// Debug set/val issue

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Debugging set/val...\n");

// Method 1: Using set
console.log("1. Using set():");
$$("test1").set("Via set");
const node1 = $$("test1").node();
console.log("   Node __value:", node1.__value);
console.log("   fx.val(node):", fx.val(node1));

// Method 2: Using val as setter
console.log("\n2. Using val() as setter:");
$$("test2").val("Via val");
const node2 = $$("test2").node();
console.log("   Node __value:", node2.__value);
console.log("   fx.val(node):", fx.val(node2));

// What does val() getter return after setting?
console.log("\n3. After setting with val():");
$$("test3").val("Test value");
const valFn = $$("test3").val;
console.log("   val function:", valFn);
console.log("   Calling val():", valFn());
console.log("   fx.val:", fx.val($$("test3").node()));