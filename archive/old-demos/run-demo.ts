#!/usr/bin/env -S deno run --allow-all
/**
 * FXD Complete Demo - Create nodes and start visualization server
 */

import { $, $$ } from "./fx.ts";
import { $val, $set, $get } from "./fx.ts";

console.log("🚀 FXD Complete Demo\n");

// Create a demo project structure
console.log("📦 Creating demo project...\n");

// 1. Project metadata
$set("project.name", "FXD Demo App");
$set("project.version", "1.0.0");
$set("project.description", "A demo FXD application");

// 2. Create some users
$set("data.users.0", { id: 1, name: "Alice", role: "admin" });
$set("data.users.1", { id: 2, name: "Bob", role: "developer" });
$set("data.users.2", { id: 3, name: "Charlie", role: "designer" });

// 3. Configuration
$set("config.database.host", "localhost");
$set("config.database.port", 5432);
$set("config.database.name", "fxd_demo");
$set("config.server.port", 3000);
$set("config.server.host", "0.0.0.0");

// 4. Code snippets (simulating FXD snippets)
$set("snippets.greeting", {
  id: "snip-001",
  lang: "typescript",
  code: "export function greet(name: string) { return `Hello, ${name}!`; }"
});

$set("snippets.userModel", {
  id: "snip-002",
  lang: "typescript",
  code: "export class User { constructor(public name: string, public email: string) {} }"
});

// Display what we created
console.log("✅ Created project structure:\n");
console.log("Project:", $get("project"));
console.log("\nUsers:", $get("data.users"));
console.log("\nConfig:", $get("config"));
console.log("\nSnippets:", $get("snippets"));

console.log("\n" + "=".repeat(60));
console.log("🌐 Starting FXD Visualization Server...");
console.log("=".repeat(60) + "\n");

// Start a simple HTTP server to visualize the FX tree
const port = 4500;

console.log(`🚀 Server starting on http://localhost:${port}`);
console.log(`\n📊 View the FX node tree at: http://localhost:${port}\n`);

Deno.serve({ port }, (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/tree") {
    // Return the FX tree as JSON
    return new Response(JSON.stringify({
      project: $get("project"),
      data: $get("data"),
      config: $get("config"),
      snippets: $get("snippets")
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Serve a simple HTML visualizer
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>FXD Visualizer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .content { padding: 30px; }
    .section {
      margin-bottom: 30px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .section-header {
      background: #f5f5f5;
      padding: 15px 20px;
      border-bottom: 1px solid #e0e0e0;
      font-weight: 600;
      font-size: 18px;
      color: #333;
    }
    .section-body {
      padding: 20px;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      line-height: 1.6;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .refresh-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      margin: 20px 0;
    }
    .refresh-btn:hover {
      background: #5568d3;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 FXD Node Tree Visualizer</h1>
      <p>Real-time FX node structure visualization</p>
    </div>
    <div class="content">
      <button class="refresh-btn" onclick="loadData()">🔄 Refresh Data</button>

      <div class="section">
        <div class="section-header">📦 Project Metadata</div>
        <div class="section-body">
          <pre id="project">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">👥 Data (Users)</div>
        <div class="section-body">
          <pre id="data">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">⚙️ Configuration</div>
        <div class="section-body">
          <pre id="config">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">📝 Code Snippets</div>
        <div class="section-body">
          <pre id="snippets">Loading...</pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        const res = await fetch('/api/tree');
        const data = await res.json();

        document.getElementById('project').textContent = JSON.stringify(data.project, null, 2);
        document.getElementById('data').textContent = JSON.stringify(data.data, null, 2);
        document.getElementById('config').textContent = JSON.stringify(data.config, null, 2);
        document.getElementById('snippets').textContent = JSON.stringify(data.snippets, null, 2);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();
    setInterval(loadData, 5000); // Auto-refresh every 5 seconds
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
});
