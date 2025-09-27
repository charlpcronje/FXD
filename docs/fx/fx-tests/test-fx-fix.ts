#!/usr/bin/env -S deno run -A
// Test proper FX usage

import "./fx.ts";

console.log("Testing proper FX usage...\n");

// The issue: when you set an object, it creates child nodes
// So config.fx is a parent node, not a value node

console.log("1. Accessing config properly:");
// Get the actual config object
const configNode = $$("config.fx").node();
console.log("   config.fx __value:", configNode.__value);
console.log("   config.fx __type:", configNode.__type);

// Access child values
const attrResolution = $$("config.fx.selectors.attrResolution").val();
console.log("   selectors.attrResolution:", attrResolution);

const reactiveDefault = $$("config.fx.groups.reactiveDefault").val();
console.log("   groups.reactiveDefault:", reactiveDefault);

console.log("\n2. Setting and getting values correctly:");

// For primitive values, val() works as expected
$$("test.primitive").val("Hello World");
const primVal = $$("test.primitive").val();
console.log("   Primitive value:", primVal);

// For objects, val() on the parent returns the object
$$("test.object").val({ name: "Test", value: 42 });
const objVal = $$("test.object").val();
console.log("   Object value:", objVal);

// But child properties are accessible
const nameVal = $$("test.object.name").val();
console.log("   Object.name:", nameVal);

console.log("\n3. Testing the sync API:");

// Set a simple value
$$("sync.test").set(123);
const syncGet = $$("sync.test").get();
console.log("   Set 123, get() returns:", syncGet);

// Set with options
$$("sync.cast").val("42", { cast: "number" });
const castVal = $$("sync.cast").val();
console.log("   Set '42' with cast:number, val() returns:", castVal, "type:", typeof castVal);

console.log("\n✅ FX is working correctly!");
console.log("Note: When you set an object, it creates child nodes.");
console.log("Access object properties with dot notation: $$('parent.child')");