#!/usr/bin/env -S deno run -A
// server/fxd-demo.ts
// Complete FXD Phase 1 Demo Server
// Run: deno run -A server/fxd-demo.ts

import "../fx.ts"; // Initialize FX core and globals
import { createSnippet, indexSnippet, onSnippetOptionsChanged, onSnippetMoved } from "../modules/fx-snippets.ts";
import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";
import fxFsFuse from "../plugins/fx-fs-fuse.ts";
import { startHttpServer } from "./http.ts";

console.log("🚀 Starting FXD Phase 1 Demo Server...\n");

// ============================================
// 1. Wire Lifecycle Hooks to FXCore
// ============================================
console.log("📎 Wiring lifecycle hooks to FXCore...");

// Hook into FX structure events for snippet tracking
$_$$.node().__fx = $_$$.node().__fx || {};
const originalOnStructure = $_$$.node().__fx.onStructure;
$_$$.node().__fx.onStructure = function(callback: any) {
  // Wrap callback to intercept snippet events
  const wrapped = (event: any) => {
    if (event.node && event.node.__type === "snippet") {
      const path = event.key ? `${event.parent?.__id}.${event.key}` : event.node.__id;
      
      if (event.kind === "create") {
        const opts = $$(path).options?.() || {};
        if (opts.id) indexSnippet(path, opts.id);
      }
      
      if (event.kind === "mutate") {
        const opts = $$(path).options?.() || {};
        const oldOpts = event.node.__oldOptions;
        if (oldOpts?.id !== opts.id) {
          onSnippetOptionsChanged(path, oldOpts?.id, opts.id);
        }
      }
      
      if (event.kind === "move") {
        const oldPath = event.oldPath;
        const newPath = event.key ? `${event.parent?.__id}.${event.key}` : event.node.__id;
        onSnippetMoved(oldPath, newPath);
      }
    }
    
    // Call original callback
    if (callback) callback(event);
  };
  
  // Call original if it exists
  if (originalOnStructure) {
    return originalOnStructure.call(this, wrapped);
  }
};

// ============================================
// 2. Create Demo Snippets and Views
// ============================================
console.log("📝 Creating demo snippets and views...");

// Create a User model
createSnippet(
  "snippets.models.user.imports",
  `import { hash, verify } from 'bcrypt';
import { uuid } from 'uuid';`,
  { lang: "js", file: "src/models/User.js", order: 0, id: "user-imports" }
);

createSnippet(
  "snippets.models.user.class",
  `export class User {
  constructor(name, email) {
    this.id = uuid();
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }
  
  async setPassword(password) {
    this.passwordHash = await hash(password, 10);
  }
  
  async verifyPassword(password) {
    return await verify(password, this.passwordHash);
  }
  
  toJSON() {
    const { passwordHash, ...user } = this;
    return user;
  }
}`,
  { lang: "js", file: "src/models/User.js", order: 1, id: "user-class" }
);

// Create a Repository
createSnippet(
  "snippets.repo.imports",
  `import { User } from './models/User.js';
import { db } from './db.js';`,
  { lang: "js", file: "src/repositories/UserRepo.js", order: 0, id: "repo-imports" }
);

createSnippet(
  "snippets.repo.class",
  `export class UserRepository {
  async findById(id) {
    return db.users.find(u => u.id === id);
  }
  
  async findByEmail(email) {
    return db.users.find(u => u.email === email);
  }
  
  async create(userData) {
    const user = new User(userData.name, userData.email);
    if (userData.password) {
      await user.setPassword(userData.password);
    }
    db.users.push(user);
    return user;
  }
  
  async update(id, updates) {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    Object.assign(user, updates);
    return user;
  }
  
  async delete(id) {
    const index = db.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    return db.users.splice(index, 1)[0];
  }
}`,
  { lang: "js", file: "src/repositories/UserRepo.js", order: 1, id: "repo-class" }
);

// Create a Service layer
createSnippet(
  "snippets.service.imports",
  `import { UserRepository } from '../repositories/UserRepo.js';`,
  { lang: "js", file: "src/services/UserService.js", order: 0, id: "service-imports" }
);

createSnippet(
  "snippets.service.class",
  `export class UserService {
  constructor() {
    this.repo = new UserRepository();
  }
  
  async registerUser(name, email, password) {
    // Check if user already exists
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new Error('User with this email already exists');
    }
    
    // Create new user
    const user = await this.repo.create({ name, email, password });
    
    // Send welcome email (stub)
    console.log(\`Welcome email sent to \${email}\`);
    
    return user.toJSON();
  }
  
  async authenticateUser(email, password) {
    const user = await this.repo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const valid = await user.verifyPassword(password);
    if (!valid) {
      throw new Error('Invalid credentials');
    }
    
    return user.toJSON();
  }
}`,
  { lang: "js", file: "src/services/UserService.js", order: 1, id: "service-class" }
);

// ============================================
// 3. Create Views (File Representations)
// ============================================
console.log("📁 Creating views for each file...");

// User model view
$$("views.models.User")
  .group([])
  .include('.snippet[file="src/models/User.js"]')
  .options({ reactive: true, mode: "list", ext: ".js", lang: "js", hoistImports: true });

// Repository view  
$$("views.repositories.UserRepo")
  .group([])
  .include('.snippet[file="src/repositories/UserRepo.js"]')
  .options({ reactive: true, mode: "list", ext: ".js", lang: "js", hoistImports: true });

// Service view
$$("views.services.UserService")
  .group([])
  .include('.snippet[file="src/services/UserService.js"]')
  .options({ reactive: true, mode: "list", ext: ".js", lang: "js", hoistImports: true });

// Combined view (all user-related code)
$$("views.combined.UserModule")
  .group([
    "snippets.models.user.imports",
    "snippets.models.user.class",
    "snippets.repo.imports",
    "snippets.repo.class",
    "snippets.service.imports",
    "snippets.service.class"
  ])
  .options({ reactive: true, mode: "list", ext: ".js", lang: "js", hoistImports: true });

// ============================================
// 4. Register Views with FS Bridge
// ============================================
console.log("🌉 Registering views with filesystem bridge...");

const fsBridge = fxFsFuse();

// Register individual file views
fsBridge.register({
  filePath: "src/models/User.js",
  viewId: "views.models.User",
  lang: "js",
  hoistImports: true
});

fsBridge.register({
  filePath: "src/repositories/UserRepo.js",
  viewId: "views.repositories.UserRepo",
  lang: "js",
  hoistImports: true
});

fsBridge.register({
  filePath: "src/services/UserService.js",
  viewId: "views.services.UserService",
  lang: "js",
  hoistImports: true
});

// Register combined view
fsBridge.register({
  filePath: "combined/UserModule.js",
  viewId: "views.combined.UserModule",
  lang: "js",
  hoistImports: true
});

// ============================================
// 5. Auto-Discovery for views.* namespace
// ============================================
console.log("🔍 Setting up auto-discovery for views...");

function autoDiscoverViews() {
  const viewsNode = $$("views").node();
  const discovered: string[] = [];
  
  function traverse(node: any, path: string) {
    for (const key in node.__nodes) {
      const child = node.__nodes[key];
      const childPath = path ? `${path}.${key}` : key;
      
      // Check if this is a view (has group functionality)
      try {
        const proxy = $$(`views.${childPath}`);
        if (proxy.group && typeof proxy.group === 'function') {
          // Auto-register if not already registered
          const fsPath = childPath.replace(/\./g, '/') + '.js';
          if (!fsBridge.resolve(fsPath)) {
            fsBridge.register({
              filePath: fsPath,
              viewId: `views.${childPath}`,
              lang: proxy.options?.()?.lang || "js",
              hoistImports: proxy.options?.()?.hoistImports || false
            });
            discovered.push(fsPath);
          }
        }
      } catch {}
      
      // Recurse
      traverse(child, childPath);
    }
  }
  
  traverse(viewsNode, "");
  
  if (discovered.length > 0) {
    console.log(`  Auto-discovered ${discovered.length} views:`, discovered);
  }
}

// Run auto-discovery
autoDiscoverViews();

// Re-run on structure changes
$$("views").watch(() => {
  setTimeout(autoDiscoverViews, 100);
});

// ============================================
// 6. Demo Round-Trip Functionality
// ============================================
console.log("\n🔄 Testing round-trip functionality...");

// Test 1: Render a view
console.log("  1. Rendering User model...");
const userModelText = renderView("views.models.User");
console.log(`     ✓ Rendered ${userModelText.split('\n').length} lines`);

// Test 2: Simulate an edit
console.log("  2. Simulating edit to User model...");
const editedText = userModelText.replace(
  "this.createdAt = new Date();",
  "this.createdAt = new Date();\n    this.updatedAt = null;"
);

// Test 3: Parse the edited text
console.log("  3. Parsing edited text...");
const patches = toPatches(editedText);
console.log(`     ✓ Generated ${patches.length} patches`);

// Test 4: Apply patches
console.log("  4. Applying patches...");
applyPatches(patches);
console.log("     ✓ Patches applied successfully");

// Test 5: Re-render to verify changes
console.log("  5. Re-rendering to verify changes...");
const updatedText = renderView("views.models.User");
const hasUpdate = updatedText.includes("this.updatedAt = null;");
console.log(`     ${hasUpdate ? '✓' : '✗'} Changes persisted: ${hasUpdate}`);

// ============================================
// 7. Start HTTP Server
// ============================================
console.log("\n🌐 Starting HTTP server...");

const httpServer = startHttpServer({
  port: 4400,
  autoResolver: (filePath: string) => {
    // Try to auto-resolve unregistered paths
    const viewId = `views.${filePath.replace(/\//g, '.').replace(/\.(js|ts|jsx|tsx|py|css|html)$/, '')}`;
    
    // Check if this view exists
    try {
      const node = $$(viewId).node();
      if (node) {
        return {
          viewId,
          lang: filePath.endsWith('.py') ? 'py' :
                filePath.endsWith('.css') ? 'css' :
                filePath.endsWith('.html') ? 'html' : 'js'
        };
      }
    } catch {}
    
    return null;
  }
});

// ============================================
// 8. Display Available Endpoints
// ============================================
console.log("\n✨ FXD Phase 1 Demo Server Ready!\n");
console.log("📍 Available endpoints:");
console.log("   http://localhost:4400/fs/src/models/User.js");
console.log("   http://localhost:4400/fs/src/repositories/UserRepo.js");
console.log("   http://localhost:4400/fs/src/services/UserService.js");
console.log("   http://localhost:4400/fs/combined/UserModule.js");
console.log("   http://localhost:4400/fs/ls/");
console.log("   http://localhost:4400/events (SSE stream)");

console.log("\n📝 Try these commands:");
console.log("   # Read a file:");
console.log("   curl http://localhost:4400/fs/src/models/User.js");
console.log("");
console.log("   # Edit a file:");
console.log("   curl -X PUT http://localhost:4400/fs/src/models/User.js -d '@edited.js'");
console.log("");
console.log("   # List files:");
console.log("   curl http://localhost:4400/fs/ls/src");
console.log("");
console.log("   # Watch for changes (SSE):");
console.log("   curl http://localhost:4400/events");

console.log("\n🎯 Interactive Demo:");
console.log("   1. The User model has been modified to include 'updatedAt'");
console.log("   2. Try fetching the file to see the change");
console.log("   3. Edit any file and PUT it back to test round-trip");
console.log("\nPress Ctrl+C to stop the server");

// Keep the process alive
await new Promise(() => {});