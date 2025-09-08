#!/usr/bin/env -S deno run -A
// Test proxy val behavior

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing proxy val...\n");

// Set a value
$$("test").val("Hello");

// Get the proxy
const proxy = $$("test");
console.log("1. Proxy:");
console.log("   Type:", typeof proxy);
console.log("   proxy.val type:", typeof proxy.val);

// What does val return?
const valResult = proxy.val();
console.log("\n2. Calling proxy.val():");
console.log("   Result type:", typeof valResult);
console.log("   Result:", valResult);

// The issue is val() returns baseFn when it shouldn't
// Let's check if it's the same baseFn
console.log("\n3. Is it baseFn?");
console.log("   proxy === valResult:", proxy === valResult);
console.log("   proxy.toString():", proxy.toString());
console.log("   valResult.toString():", valResult.toString());

// Try calling val as a property getter
console.log("\n4. Accessing val property:");
const valProp = proxy["val"];
console.log("   Type:", typeof valProp);
const called = valProp.call(proxy);
console.log("   Called result:", called);