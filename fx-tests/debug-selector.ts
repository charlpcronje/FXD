#!/usr/bin/env -S deno run -A
// Debug CSS selector matching

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;

Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";

console.log("🔍 Testing CSS selector matching...\n");

// Create test snippets
createSnippet(
  "snippets.user.class",
  "export class User {}",
  { lang: "js", file: "src/User.js", id: "user-001" }
);

createSnippet(
  "snippets.user.imports",
  "import { hash } from 'bcrypt';",
  { lang: "js", file: "src/User.js", id: "user-002" }
);

// Check node properties
console.log("1. Node properties:");
const node1 = $$("snippets.user.class").node();
console.log("   Type:", node1.__type);
console.log("   Meta:", (node1 as any).__meta);
console.log("   Path: snippets.user.class");

// Try different selectors
console.log("\n2. Testing selectors:");

// Type selector
const g1 = $$("test.type").group([]).select("snippet");
console.log("   .select('snippet'):", g1.list().length);

// CSS class selector
const g2 = $$("test.class").group([]).include(".snippet");
console.log("   .include('.snippet'):", g2.list().length);

// Attribute selector
const g3 = $$("test.attr").group([]).include('[file="src/User.js"]');
console.log("   .include('[file=\"src/User.js\"]'):", g3.list().length);

// Combined selector
const g4 = $$("test.combined").group([]).include('.snippet[file="src/User.js"]');
console.log("   .include('.snippet[file=\"src/User.js\"]'):", g4.list().length);

// Manual paths
const g5 = $$("test.manual").group(["snippets.user.class", "snippets.user.imports"]);
console.log("   Manual paths:", g5.list().length);

// Debug the CSS selector parser
console.log("\n3. Debug CSS selector:");
const selector = '.snippet[file="src/User.js"]';
console.log("   Selector:", selector);

// Check if nodes match the type
console.log("\n4. Check all nodes with type 'snippet':");
const walk = (node: any, path: string = "") => {
  for (const key in node.__nodes) {
    const child = node.__nodes[key];
    const childPath = path ? `${path}.${key}` : key;
    if (child.__type === "snippet") {
      console.log(`   Found: ${childPath}`);
      console.log(`     Meta:`, (child as any).__meta);
    }
    walk(child, childPath);
  }
};
walk(fx.root);