#!/usr/bin/env -S deno run --allow-all
/**
 * Simple FXD Demo - Shows FX Core in Action
 */

import { $, $$ } from "./fx.ts";

console.log("🚀 Simple FXD Demo\n");

// Create some nodes
console.log("Creating nodes...");
$$("app.users.john").val({ name: "John", age: 30 });
$$("app.users.jane").val({ name: "Jane", age: 25 });
$$("app.config.port").val(3000);
$$("app.config.host").val("localhost");

// Read values back
console.log("\n📖 Reading values:");
console.log("John:", $$("app.users.john").val());
console.log("Jane:", $$("app.users.jane").val());
console.log("Port:", $$("app.config.port").val());
console.log("Host:", $$("app.config.host").val());

// Use selectors
console.log("\n🔍 Using CSS-like selectors:");
const users = $$.select("app.users > *");
console.log(`Found ${users.length} users:`, users.map(n => n.val()));

// Create a prototype
console.log("\n🎭 Creating prototypes:");
const greetProto = {
  greet() {
    return `Hello, I'm ${this.name}!`;
  }
};

$$("app.users.john").proto(greetProto);
console.log("John says:", $$("app.users.john").greet());

// Show node tree
console.log("\n🌳 Node Tree:");
function showTree(path: string, indent = "") {
  const node = $$(path);
  const val = node.val();

  console.log(`${indent}${path.split('.').pop()}: ${typeof val === 'object' ? '{...}' : val}`);

  const children = $$.select(`${path} > *`);
  children.forEach(child => {
    const childPath = child.node?.__path || path;
    showTree(childPath, indent + "  ");
  });
}

showTree("app");

console.log("\n✅ Demo Complete!\n");
console.log("💡 Next Steps:");
console.log("  1. Start visualizer: FX_SERVE=true deno run --allow-all fx.ts");
console.log("  2. Open: http://localhost:4444\n");
