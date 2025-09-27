#!/usr/bin/env -S deno run -A
// Debug FX issues

import "./fx.ts";

console.log("Testing FX initialization...\n");

// Check if config exists
console.log("1. Checking config node:");
const configNode = $$("config").node();
console.log("   config node exists:", configNode ? "yes" : "no");

const configFxNode = $$("config.fx").node();
console.log("   config.fx node exists:", configFxNode ? "yes" : "no");

const configVal = $$("config.fx").val();
console.log("   config.fx value:", configVal);
console.log("   config.fx type:", typeof configVal);

// Test simple value setting
console.log("\n2. Testing value setting:");
$$("test.simple").val("Hello");
const getVal1 = $$("test.simple").val();
const getVal2 = $$("test.simple").get();
console.log("   Set 'Hello', val() returns:", getVal1);
console.log("   Set 'Hello', get() returns:", getVal2);

// Check the node internals
const testNode = $$("test.simple").node();
console.log("   Node __value:", testNode.__value);
console.log("   Node __type:", testNode.__type);

// Test with number
console.log("\n3. Testing with number:");
$$("test.number").set(42);
const numVal = $$("test.number").val();
const numGet = $$("test.number").get();
console.log("   Set 42, val() returns:", numVal);
console.log("   Set 42, get() returns:", numGet);

// Check config defaults
console.log("\n4. Config defaults check:");
const selectors = $$("config.fx.selectors").val();
console.log("   config.fx.selectors:", selectors);

const groups = $$("config.fx.groups").val();
console.log("   config.fx.groups:", groups);

// Direct access to root
console.log("\n5. Root structure:");
const root = $_$$("").node();
console.log("   Root children:", Object.keys(root.__nodes));