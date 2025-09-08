#!/usr/bin/env -S deno run -A
// server/fxd-demo-simple.ts
// FXD Phase 1 Demo - Simplified for Deno
// Run: deno run -A server/fxd-demo-simple.ts

// Import FX without Worker initialization
const fxModule = await import("../fx.ts");
const { fx, $_$$, $$ } = fxModule;

// Expose globals
Object.assign(globalThis, { fx, $_$$, $$ });

import { createSnippet, indexSnippet } from "../modules/fx-snippets.ts";
import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";
import fxFsFuse from "../plugins/fx-fs-fuse.ts";

console.log("🚀 Starting FXD Phase 1 Demo (Simplified)...\n");

// ============================================
// 1. Create Demo Snippets
// ============================================
console.log("📝 Creating demo snippets...");

// User model snippets
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
  
  async setPassword(password) {
    this.passwordHash = await hash(password, 10);
  }
  
  toJSON() {
    const { passwordHash, ...user } = this;
    return user;
  }
}`,
  { lang: "js", file: "src/User.js", order: 1, id: "user-class-001" }
);

// Repository snippets
createSnippet(
  "snippets.repo.imports",
  `import { User } from './User.js';`,
  { lang: "js", file: "src/UserRepo.js", order: 0, id: "repo-imports-001" }
);

createSnippet(
  "snippets.repo.functions",
  `const users = [];

export async function findUserById(id) {
  return users.find(u => u.id === id);
}

export async function createUser(name, email) {
  const user = new User(name, email);
  users.push(user);
  return user;
}

export async function getAllUsers() {
  return users;
}`,
  { lang: "js", file: "src/UserRepo.js", order: 1, id: "repo-functions-001" }
);

console.log("  ✓ Created 4 snippets\n");

// ============================================
// 2. Create Views
// ============================================
console.log("📁 Creating file views...");

// User.js view
$$("views.User")
  .group([])
  .include('.snippet[file="src/User.js"]')
  .reactive(true);

// UserRepo.js view  
$$("views.UserRepo")
  .group([])
  .include('.snippet[file="src/UserRepo.js"]')
  .reactive(true);

// Combined view
$$("views.AllCode")
  .group([
    "snippets.user.imports",
    "snippets.user.class",
    "snippets.repo.imports",
    "snippets.repo.functions"
  ])
  .reactive(true);

console.log("  ✓ Created 3 views\n");

// ============================================
// 3. Setup Filesystem Bridge
// ============================================
console.log("🌉 Setting up filesystem bridge...");

const fsBridge = fxFsFuse();

fsBridge.register({
  filePath: "src/User.js",
  viewId: "views.User",
  lang: "js",
  hoistImports: true
});

fsBridge.register({
  filePath: "src/UserRepo.js",
  viewId: "views.UserRepo",
  lang: "js",
  hoistImports: true
});

fsBridge.register({
  filePath: "all.js",
  viewId: "views.AllCode",
  lang: "js",
  hoistImports: true
});

console.log("  ✓ Registered 3 file mappings\n");

// ============================================
// 4. Test Round-Trip
// ============================================
console.log("🔄 Testing round-trip functionality...\n");

// Step 1: Render
console.log("  1. Rendering src/User.js:");
const originalRender = fsBridge.readFile("src/User.js");
console.log("     Lines:", originalRender.split('\n').length);
console.log("     Size:", originalRender.length, "bytes");

// Show first few lines
const preview = originalRender.split('\n').slice(0, 5).join('\n');
console.log("     Preview:\n" + preview.split('\n').map(l => '       ' + l).join('\n'));

// Step 2: Simulate edit
console.log("\n  2. Simulating edit (adding 'updatedAt' field)...");
const edited = originalRender.replace(
  "this.createdAt = new Date();",
  "this.createdAt = new Date();\n    this.updatedAt = null;"
);

// Step 3: Write back
console.log("\n  3. Writing edited content back...");
fsBridge.writeFile("src/User.js", edited);

// Step 4: Verify
console.log("\n  4. Verifying changes persisted:");
const newRender = fsBridge.readFile("src/User.js");
const hasChange = newRender.includes("this.updatedAt = null");
console.log("     " + (hasChange ? "✓" : "✗") + " Change detected:", hasChange);

// ============================================
// 5. Start HTTP Server
// ============================================
console.log("\n🌐 Starting HTTP server on port 4400...\n");

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const server = serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;
  
  // CORS headers
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  
  // Handle /fs/* endpoints
  if (url.pathname.startsWith("/fs/")) {
    const path = url.pathname.slice(4); // Remove /fs/
    
    // List directory
    if (path.startsWith("ls/") || path === "ls") {
      const dir = path.slice(3).replace(/^\//, "");
      try {
        const entries = fsBridge.readdir(dir);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ dir, entries }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { 
          status: 404, 
          headers 
        });
      }
    }
    
    // GET file
    if (method === "GET") {
      try {
        const content = fsBridge.readFile(path);
        headers.set("Content-Type", "text/plain; charset=utf-8");
        return new Response(content, { headers });
      } catch (e) {
        return new Response(`File not found: ${path}`, { 
          status: 404, 
          headers 
        });
      }
    }
    
    // PUT file
    if (method === "PUT") {
      try {
        const body = await req.text();
        fsBridge.writeFile(path, body);
        return new Response("OK", { headers });
      } catch (e) {
        return new Response(String(e), { 
          status: 400, 
          headers 
        });
      }
    }
  }
  
  // Root endpoint
  if (url.pathname === "/") {
    headers.set("Content-Type", "text/html");
    return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>FXD Phase 1 Demo</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
    code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>🚀 FXD Phase 1 Demo</h1>
  
  <h2>Available Files</h2>
  <div class="endpoint">
    <a href="/fs/src/User.js">/fs/src/User.js</a> - User model
  </div>
  <div class="endpoint">
    <a href="/fs/src/UserRepo.js">/fs/src/UserRepo.js</a> - User repository
  </div>
  <div class="endpoint">
    <a href="/fs/all.js">/fs/all.js</a> - Combined view
  </div>
  <div class="endpoint">
    <a href="/fs/ls/">/fs/ls/</a> - List all files
  </div>
  
  <h2>Test with curl</h2>
  <pre>
# Get a file
curl http://localhost:4400/fs/src/User.js

# Edit a file
curl -X PUT http://localhost:4400/fs/src/User.js \\
  -H "Content-Type: text/plain" \\
  --data-binary @edited.js

# List files
curl http://localhost:4400/fs/ls/src
  </pre>
  
  <h2>Round-Trip Test</h2>
  <p>The User model has been modified to include an 'updatedAt' field during initialization.</p>
  <p>Try fetching <code>/fs/src/User.js</code> to see the change!</p>
</body>
</html>
    `, { headers });
  }
  
  return new Response("Not Found", { status: 404, headers });
}, { port: 4400 });

console.log("✨ FXD Demo Server Ready!\n");
console.log("📍 Open in browser: http://localhost:4400");
console.log("\n🎯 Try these commands:");
console.log("   curl http://localhost:4400/fs/src/User.js");
console.log("   curl http://localhost:4400/fs/ls/");
console.log("\nPress Ctrl+C to stop\n");