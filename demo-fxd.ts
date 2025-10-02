#!/usr/bin/env -S deno run --allow-all
/**
 * FXD Demo - Create and Visualize an FXD Project
 *
 * This demo shows:
 * 1. Creating a new FXD project
 * 2. Adding snippets with code
 * 3. Creating views from snippets
 * 4. Visualizing the node tree
 * 5. Starting the web server
 */

import { $, $$ } from "./fx.ts";

console.log("🚀 FXD Demo - Creating a new FXD project...\n");

// Step 1: Create a project structure
console.log("📁 Step 1: Creating project structure...");
$$("project").val({
  name: "demo-app",
  version: "1.0.0",
  description: "FXD Demo Application"
});

// Step 2: Create some code snippets
console.log("✨ Step 2: Creating code snippets...");

// Create a simple greeting function
$$("snippets.greeting").val({
  id: "snippet-001",
  lang: "javascript",
  file: "src/greeting.js",
  order: 1,
  body: `
function greet(name) {
  return \`Hello, \${name}! Welcome to FXD.\`;
}
`.trim()
});

// Create a user model
$$("snippets.userModel").val({
  id: "snippet-002",
  lang: "javascript",
  file: "src/models/user.js",
  order: 1,
  body: `
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  getDisplayName() {
    return this.name;
  }
}
`.trim()
});

// Create a main entry point
$$("snippets.main").val({
  id: "snippet-003",
  lang: "javascript",
  file: "src/main.js",
  order: 1,
  body: `
import { greet } from './greeting.js';
import { User } from './models/user.js';

const user = new User('FXD User', 'user@fxd.dev');
console.log(greet(user.getDisplayName()));
`.trim()
});

// Step 3: Create views (groups of snippets that render to files)
console.log("📄 Step 3: Creating views...");

$$("views.greetingFile").val({
  selector: "#snippet-001",
  outputPath: "src/greeting.js",
  format: "javascript"
});

$$("views.userModelFile").val({
  selector: "#snippet-002",
  outputPath: "src/models/user.js",
  format: "javascript"
});

$$("views.mainFile").val({
  selector: "#snippet-003",
  outputPath: "src/main.js",
  format: "javascript"
});

// Step 4: Display the FX node tree
console.log("\n🌳 Step 4: FX Node Tree Structure:\n");

function displayTree(node: any, indent = "") {
  const nodeName = node?.__path || "root";
  const nodeValue = node?.__value;

  console.log(`${indent}📦 ${nodeName}`);

  if (nodeValue && typeof nodeValue === "object" && !Array.isArray(nodeValue)) {
    Object.entries(nodeValue).forEach(([key, val]) => {
      if (key !== "__path" && key !== "__value" && key !== "__nodes") {
        if (typeof val === "object" && val !== null) {
          console.log(`${indent}  └─ ${key}: [object]`);
        } else {
          console.log(`${indent}  └─ ${key}: ${String(val).substring(0, 50)}${String(val).length > 50 ? '...' : ''}`);
        }
      }
    });
  }

  if (node?.__nodes) {
    Object.entries(node.__nodes).forEach(([key, childNode]) => {
      displayTree(childNode, indent + "  ");
    });
  }
}

displayTree($$("project").node);

// Step 5: Show snippet contents
console.log("\n📝 Step 5: Snippet Contents:\n");

const snippets = [
  { name: "greeting", path: "snippets.greeting" },
  { name: "userModel", path: "snippets.userModel" },
  { name: "main", path: "snippets.main" }
];

snippets.forEach(({ name, path }) => {
  const snippet = $$(path).val();
  console.log(`\n--- ${name} (${snippet.file}) ---`);
  console.log(snippet.body);
  console.log("---\n");
});

// Step 6: Show views
console.log("👁️  Step 6: View Mappings:\n");

const views = [
  { name: "greetingFile", path: "views.greetingFile" },
  { name: "userModelFile", path: "views.userModelFile" },
  { name: "mainFile", path: "views.mainFile" }
];

views.forEach(({ name, path }) => {
  const view = $$(path).val();
  console.log(`  ${name}: ${view.selector} → ${view.outputPath}`);
});

console.log("\n✅ FXD Demo Complete!");
console.log("\n💡 To start the visualizer server, run:");
console.log("   deno run --allow-all server/fxd-demo-simple.ts --port 4401\n");
console.log("   Then open: http://localhost:4401\n");
