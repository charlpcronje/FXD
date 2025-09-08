#!/usr/bin/env -S deno run -A
// Test rendering

const fxModule = await import("./fx.ts");
const { fx, $_$$, $$ } = fxModule;
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";

console.log("🔍 Testing rendering...\n");

// Create snippets
createSnippet(
  "snippets.user.imports",
  `import { hash, verify } from 'bcrypt';`,
  { lang: "js", file: "src/User.js", order: 0, id: "user-imports-001" }
);

createSnippet(
  "snippets.user.class",
  `export class User {
  constructor(name, email) {
    this.id = Date.now().toString(36);
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }
}`,
  { lang: "js", file: "src/User.js", order: 1, id: "user-class-001" }
);

// Create view
$$("views.User")
  .group([])
  .include('.snippet[file="src/User.js"]')
  .reactive(true);

// Test rendering
console.log("1. Testing renderView:");
const rendered = renderView("views.User");
console.log("   Length:", rendered.length);
console.log("   Lines:", rendered.split('\n').length);
console.log("\n2. Full output:");
console.log(rendered);

// Check group contents
console.log("\n3. Group contents:");
const g = $$("views.User").group();
const items = g.list();
console.log("   Items in group:", items.length);
items.forEach((item, i) => {
  const node = item.node();
  console.log(`   Item ${i}:`);
  console.log(`     ID: ${node.__id}`);
  console.log(`     Type: ${node.__type}`);
  console.log(`     Meta:`, (node as any).__meta);
  console.log(`     Value:`, item.val());
});