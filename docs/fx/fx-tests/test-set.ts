#!/usr/bin/env -S deno run -A
// Test setting values

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

console.log("🔍 Testing value setting...\n");

// Method 1: Using val() as setter
console.log("1. Using val() as setter:");
$$("test.val").val("Value via val");
console.log("   Node __value:", $$("test.val").node().__value);
console.log("   fx.val():", fx.val($$("test.val").node()));

// Method 2: Using set()
console.log("\n2. Using set():");
$$("test.set").set("Value via set");
console.log("   Node __value:", $$("test.set").node().__value);
console.log("   fx.val():", fx.val($$("test.set").node()));

// Method 3: Direct node manipulation (what createSnippet should do)
console.log("\n3. Direct manipulation:");
const path = "test.direct";
const node = $$(path).node();
fx.set(node, "Value via fx.set");
console.log("   Node __value:", node.__value);
console.log("   fx.val():", fx.val(node));

// Now test createSnippet
console.log("\n4. Using createSnippet:");
import { createSnippet } from "./modules/fx-snippets.ts";
createSnippet("test.snippet", "Snippet body", { lang: "js", file: "test.js", id: "test-001" });
const snippetNode = $$("test.snippet").node();
console.log("   Node __value:", snippetNode.__value);
console.log("   fx.val():", fx.val(snippetNode));