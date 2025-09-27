#!/usr/bin/env -S deno run -A
// Debug what's in node value

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Debugging node value structure...\n");

// Create a snippet
createSnippet(
  "test.snippet",
  "console.log('test');",
  { lang: "js", file: "test.js", id: "test-001" }
);

const node = $$("test.snippet").node();
console.log("1. Node structure:");
console.log("   __type:", node.__type);
console.log("   __meta:", (node as any).__meta);
console.log("   __value:", node.__value);

// Get the raw value
const rawBag = fx.val(node);
console.log("\n2. Raw value (fx.val):");
console.log("   Type:", typeof rawBag);
console.log("   Value:", rawBag);

// Check if it has the file property
if (rawBag && typeof rawBag === "object") {
  console.log("   Has 'file' property:", "file" in rawBag);
  console.log("   Properties:", Object.keys(rawBag));
}

// What about type surface?
const typeName = node.__type;
const typeSurface = (rawBag && typeName && typeof rawBag === "object") ? (rawBag as any)[typeName] : undefined;
console.log("\n3. Type surface:");
console.log("   Type name:", typeName);
console.log("   Type surface:", typeSurface);

// Check child nodes
console.log("\n4. Child nodes:");
console.log("   Has 'file' child:", "file" in node.__nodes);
console.log("   Children:", Object.keys(node.__nodes));