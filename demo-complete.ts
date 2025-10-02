#!/usr/bin/env -S deno run --allow-all
/**
 * Complete FXD Demo using fxn.ts
 * Shows the full power of FX with nodes, groups, selectors, and visualization
 */

import { $$, fx } from "./fxn.ts";

console.log("🚀 FXD Complete Demo with fxn.ts\n");

// 1. Create a project structure
console.log("1️⃣  Creating FXD Project Structure...\n");

// Project metadata
$$("project").val({
  name: "FXD Demo Application",
  version: "1.0.0",
  author: "FXD Framework"
});

// Create users with different roles
$$("users.alice").val({ id: 1, name: "Alice", role: "admin", active: true });
$$("users.bob").val({ id: 2, name: "Bob", role: "developer", active: true });
$$("users.charlie").val({ id: 3, name: "Charlie", role: "designer", active: false });
$$("users.david").val({ id: 4, name: "David", role: "developer", active: true });

// Configuration
$$("config.database").val({ host: "localhost", port: 5432, name: "fxd_demo" });
$$("config.server").val({ port: 3000, host: "0.0.0.0", debug: true });

// 2. Use CSS-like selectors
console.log("2️⃣  Using CSS Selectors:\n");

// Select all active users
const activeUsers = $$("users").select('[active=true]');
console.log("Active users:", activeUsers.list().map(u => u.val()));

// Select developers
const developers = $$("users").select('[role=developer]');
console.log("\nDevelopers:", developers.list().map(u => u.val()));

// 3. Groups and Reactive Updates
console.log("\n3️⃣  Creating Reactive Groups:\n");

const team = $$("").group()
  .select('[role=developer]')
  .reactive(true);

console.log("Development team members:", team.list().map(u => u.val()));

// Add a change listener
team.on('change', () => {
  console.log("📢 Team changed! New members:", team.list().map(u => u.val().name));
});

// 4. Node Tree Structure
console.log("\n4️⃣  FX Node Tree:\n");

function showTree(path: string, indent = "") {
  const node = $$(path).node();
  const val = $$(path).val();
  const name = path.split('.').pop() || 'root';

  console.log(`${indent}📦 ${name}`);

  if (val && typeof val === 'object' && !Array.isArray(val)) {
    Object.entries(val).forEach(([key, value]) => {
      if (typeof value !== 'object') {
        console.log(`${indent}  └─ ${key}: ${value}`);
      }
    });
  }

  if (node.__nodes) {
    Object.keys(node.__nodes).forEach(key => {
      showTree(`${path ? path + '.' : ''}${key}`, indent + "  ");
    });
  }
}

showTree("project");
showTree("users");
showTree("config");

// 5. Advanced Features
console.log("\n5️⃣  Advanced Group Operations:\n");

// Get aggregate data
console.log("Total active users:", activeUsers.list().length);
console.log("Developer names:", developers.list().map(u => u.val().name).join(", "));

// Check if all have same type
console.log("All users same type?", activeUsers.same('type'));

// 6. Watchers
console.log("\n6️⃣  Setting up Watchers:\n");

const aliceNode = $$("users.alice");
const unwatchAlice = aliceNode.watch((newVal, oldVal) => {
  console.log("👁️  Alice changed:", { old: oldVal, new: newVal });
});

// Trigger a change
console.log("Updating Alice's role...");
$$("users.alice.role").val("superadmin");

// 7. Start Visualizer Server
console.log("\n7️⃣  Starting Visualization Server...\n");

const port = 4500;
console.log(`🌐 Server starting on http://localhost:${port}`);
console.log(`📊 View the FX node tree at: http://localhost:${port}\n`);

Deno.serve({ port }, (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/tree") {
    // Return the complete FX tree
    return new Response(JSON.stringify({
      project: $$("project").val(),
      users: $$("users").val(),
      config: $$("config").val(),
      activeUsers: activeUsers.list().map(u => u.val()),
      developers: developers.list().map(u => u.val())
    }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Serve HTML visualizer
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>FXD Visualizer - Complete Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
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
    .header h1 { font-size: 36px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 18px; }
    .content {
      padding: 30px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
    }
    .section {
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
    .section-body { padding: 20px; }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
    }
    .refresh-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .refresh-btn:hover { background: #5568d3; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 FXD Complete Demo Visualizer</h1>
      <p>Real-time FX node structure with CSS selectors and reactive groups</p>
    </div>
    <div class="content">
      <div style="grid-column: 1 / -1;">
        <button class="refresh-btn" onclick="loadData()">🔄 Refresh Data</button>
        <div class="stats" id="stats"></div>
      </div>

      <div class="section">
        <div class="section-header">📦 Project Info</div>
        <div class="section-body">
          <pre id="project">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">👥 All Users</div>
        <div class="section-body">
          <pre id="users">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">✅ Active Users (CSS Selector)</div>
        <div class="section-body">
          <pre id="activeUsers">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">👨‍💻 Developers (CSS Selector)</div>
        <div class="section-body">
          <pre id="developers">Loading...</pre>
        </div>
      </div>

      <div class="section">
        <div class="section-header">⚙️ Configuration</div>
        <div class="section-body">
          <pre id="config">Loading...</pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        const res = await fetch('/api/tree');
        const data = await res.json();

        // Update stats
        const stats = document.getElementById('stats');
        stats.innerHTML = \`
          <div class="stat-card">
            <div class="stat-value">\${Object.keys(data.users || {}).length}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${data.activeUsers?.length || 0}</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${data.developers?.length || 0}</div>
            <div class="stat-label">Developers</div>
          </div>
        \`;

        // Update sections
        document.getElementById('project').textContent = JSON.stringify(data.project, null, 2);
        document.getElementById('users').textContent = JSON.stringify(data.users, null, 2);
        document.getElementById('activeUsers').textContent = JSON.stringify(data.activeUsers, null, 2);
        document.getElementById('developers').textContent = JSON.stringify(data.developers, null, 2);
        document.getElementById('config').textContent = JSON.stringify(data.config, null, 2);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();
    setInterval(loadData, 3000); // Auto-refresh every 3 seconds
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*"
    }
  });
});
