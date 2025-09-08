# Basic Examples

## Getting Started Examples

### Example 1: Creating Your First Snippet

```typescript
import { createSnippet } from "./modules/fx-snippets.ts";

// Create a simple function snippet
createSnippet(
  "snippets.utils.formatDate",
  `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}`,
  {
    id: "util-format-date-001",
    lang: "ts",
    file: "utils/date.ts",
    order: 10,
    author: "demo",
    created: new Date().toISOString()
  }
);

// Verify snippet was created
const snippet = $$("snippets.utils.formatDate");
console.log(snippet.val()); // Outputs the function code
console.log(snippet.node().__meta); // Outputs metadata
```

### Example 2: Creating Multiple Related Snippets

```typescript
// Create a set of related snippets for a User module
const userSnippets = [
  {
    path: "snippets.models.user.interface",
    content: `export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}`,
    meta: { id: "user-interface-001", order: 0 }
  },
  {
    path: "snippets.models.user.class",
    content: `export class UserModel implements User {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public createdAt: Date = new Date()
  ) {}
  
  validate(): boolean {
    return this.email.includes('@');
  }
}`,
    meta: { id: "user-class-001", order: 1 }
  },
  {
    path: "snippets.models.user.factory",
    content: `export function createUser(
  name: string,
  email: string
): UserModel {
  const id = crypto.randomUUID();
  return new UserModel(id, name, email);
}`,
    meta: { id: "user-factory-001", order: 2 }
  }
];

// Create all snippets
userSnippets.forEach(({ path, content, meta }) => {
  createSnippet(path, content, {
    ...meta,
    lang: "ts",
    file: "models/User.ts",
    domain: "users",
    feature: "user-management"
  });
});
```

## View Composition Examples

### Example 3: Creating a Simple View

```typescript
import { renderView } from "./modules/fx-view.ts";

// Create a view that combines User model snippets
$$("views.UserModel")
  .group([])
  .include('.snippet[file="models/User.ts"]')
  .reactive(true);

// Render the view
const content = renderView("views.UserModel", {
  lang: "ts",
  hoistImports: true
});

console.log(content);
// Output will be all User.ts snippets combined with markers
```

### Example 4: Dynamic View with Selectors

```typescript
// Create a view of all TypeScript interfaces
$$("views.AllInterfaces")
  .group([])
  .include('.snippet[id$="-interface-001"]')
  .reactive(true);

// Create a view of production-ready code
$$("views.ProductionCode")
  .group([])
  .include('.snippet')
  .exclude('.snippet[status="draft"]')
  .exclude('.snippet[deprecated=true]')
  .exclude('.snippet[experimental=true]');

// Create a view with complex selection
$$("views.AuthenticationModule")
  .group([])
  .include('.snippet[domain="auth"]')
  .include('.snippet[feature="authentication"]')
  .where(snippet => {
    const meta = snippet.node().__meta;
    return meta.reviewed === true && meta.version >= 2;
  });
```

## Round-Trip Editing Examples

### Example 5: Basic Round-Trip Edit

```typescript
import { toPatches, applyPatches } from "./modules/fx-parsing.ts";
import { renderView } from "./modules/fx-view.ts";

// Step 1: Create original snippet
createSnippet("snippets.example", 
  "function hello() { return 'Hello'; }",
  { id: "example-001", lang: "js" }
);

// Step 2: Render with markers
const original = renderView("views.example", { lang: "js" });
console.log("Original:", original);
// /* FX:BEGIN id=example-001 lang=js checksum=abc123 version=1 */
// function hello() { return 'Hello'; }
// /* FX:END id=example-001 */

// Step 3: Simulate user edit
const edited = original.replace("'Hello'", "'Hello World'");

// Step 4: Parse and apply changes
const patches = toPatches(edited, original);
applyPatches(patches);

// Step 5: Verify changes applied
const updated = $$("snippets.example").val();
console.log("Updated:", updated);
// function hello() { return 'Hello World'; }
```

### Example 6: Multi-Snippet Round-Trip

```typescript
// Create multiple snippets
createSnippet("snippets.api.getUser", `
router.get('/user/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  res.json(user);
});
`, { id: "api-get-user", lang: "js", file: "api/users.js", order: 0 });

createSnippet("snippets.api.createUser", `
router.post('/user', async (req, res) => {
  const user = await db.users.create(req.body);
  res.status(201).json(user);
});
`, { id: "api-create-user", lang: "js", file: "api/users.js", order: 1 });

// Create view and render
$$("views.UserAPI")
  .group([])
  .include('.snippet[file="api/users.js"]');

const original = renderView("views.UserAPI", { lang: "js" });

// Simulate edits to both endpoints
const edited = original
  .replace("'/user/:id'", "'/api/users/:id'")  // Update route
  .replace("'/user'", "'/api/users'")           // Update route
  .replace("res.json(user)", "res.json({ data: user })");  // Wrap response

// Apply all changes
const patches = toPatches(edited, original);
applyPatches(patches);

// Verify both snippets updated
console.log($$("snippets.api.getUser").val());
console.log($$("snippets.api.createUser").val());
```

## Filesystem Bridge Examples

### Example 7: Basic File Operations

```typescript
import { bridge } from "./modules/fx-bridge.ts";

// Map a view to a file
bridge.mapViewToFile("views.UserModel", "dist/models/User.ts");

// Read the rendered file
const content = bridge.readFile("dist/models/User.ts");
console.log("File content:", content);

// Write changes back (triggers round-trip)
const modified = content.replace("interface User", "interface IUser");
bridge.writeFile("dist/models/User.ts", modified);

// List mapped files
const files = bridge.listFiles();
console.log("Mapped files:", files);
// ["dist/models/User.ts"]
```

### Example 8: Directory Structure

```typescript
// Set up a complete project structure
const projectStructure = {
  "src/models/User.ts": "views.models.User",
  "src/models/Product.ts": "views.models.Product",
  "src/api/users.ts": "views.api.users",
  "src/api/products.ts": "views.api.products",
  "src/utils/index.ts": "views.utils.all",
  "src/index.ts": "views.main"
};

// Map all files
Object.entries(projectStructure).forEach(([file, view]) => {
  bridge.mapViewToFile(view, file);
});

// Get directory structure
const tree = bridge.getDirectoryTree("src");
console.log(JSON.stringify(tree, null, 2));
/* Output:
{
  "src": {
    "models": {
      "User.ts": { size: 637, modified: "..." },
      "Product.ts": { size: 524, modified: "..." }
    },
    "api": {
      "users.ts": { size: 1248, modified: "..." },
      "products.ts": { size: 987, modified: "..." }
    },
    "utils": {
      "index.ts": { size: 256, modified: "..." }
    },
    "index.ts": { size: 148, modified: "..." }
  }
}
*/
```

## Working with Metadata

### Example 9: Metadata Queries

```typescript
// Create snippets with rich metadata
createSnippet("snippets.feature.login", "// login code", {
  id: "feature-login-001",
  feature: "authentication",
  status: "stable",
  author: "team",
  tags: ["auth", "security", "production"],
  dependencies: ["bcrypt", "jwt"],
  performance: "optimized",
  tested: true
});

// Query by metadata
$$("views.SecurityFeatures")
  .group([])
  .include('.snippet[tags*="security"]')
  .include('.snippet[feature="authentication"]');

$$("views.Optimized")
  .group([])
  .include('.snippet[performance="optimized"]')
  .where(s => s.node().__meta.tested === true);

// Find all snippets by author
$$("views.TeamCode")
  .group([])
  .include('.snippet[author="team"]');
```

### Example 10: Version Management

```typescript
// Track snippet versions
function updateSnippet(path: string, newContent: string) {
  const node = $$(path).node();
  const oldMeta = node.__meta;
  
  // Update content
  $$(path).val(newContent);
  
  // Update metadata
  node.__meta = {
    ...oldMeta,
    version: (oldMeta.version || 1) + 1,
    previousVersion: oldMeta.version,
    modified: new Date().toISOString(),
    changeLog: [
      ...(oldMeta.changeLog || []),
      {
        version: oldMeta.version + 1,
        date: new Date().toISOString(),
        changes: "Updated content"
      }
    ]
  };
}

// Get version history
function getVersionHistory(snippetId: string) {
  const location = findBySnippetId(snippetId);
  if (!location) return null;
  
  const meta = $$(location.path).node().__meta;
  return meta.changeLog || [];
}
```

## Reactive Updates

### Example 11: Watch for Changes

```typescript
// Watch individual snippet
$$("snippets.config").watch((newVal, oldVal) => {
  console.log("Config changed from:", oldVal, "to:", newVal);
  
  // Trigger dependent updates
  updateDependentViews("config");
});

// Watch entire view
const view = $$("views.Dashboard").group([]);
view.on('change', (items) => {
  console.log(`Dashboard view changed, now has ${items.length} snippets`);
  
  // Re-render dashboard
  const content = renderView("views.Dashboard");
  bridge.writeFile("dist/dashboard.js", content);
});

// Reactive snippet inclusion
$$("snippets.newFeature").watch((val) => {
  if (val && val.includes("export")) {
    // Automatically add to exports view
    $$("views.exports")
      .group([])
      .include(`#${$$("snippets.newFeature").node().__id}`);
  }
});
```

### Example 12: Batch Operations

```typescript
// Batch update multiple snippets
function batchUpdate(updates: Array<{path: string, content: string}>) {
  const results = [];
  
  // Use FX batch for efficiency
  updates.forEach(({ path, content }) => {
    try {
      $$(path).val(content);
      results.push({ path, success: true });
    } catch (error) {
      results.push({ path, success: false, error: error.message });
    }
  });
  
  // Trigger single view update
  $$("views.all").group([]).refresh();
  
  return results;
}

// Example usage
batchUpdate([
  { path: "snippets.a", content: "// updated A" },
  { path: "snippets.b", content: "// updated B" },
  { path: "snippets.c", content: "// updated C" }
]);
```

## Integration Examples

### Example 13: Express Server Integration

```typescript
import express from 'express';
import { bridge } from './modules/fx-bridge.ts';

const app = express();

// Serve virtual files
app.get('/files/*', (req, res) => {
  const path = req.params[0];
  
  try {
    const content = bridge.readFile(path);
    const ext = path.split('.').pop();
    
    res.type(ext || 'text');
    res.send(content);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

// Update virtual files
app.put('/files/*', express.text(), (req, res) => {
  const path = req.params[0];
  
  try {
    bridge.writeFile(path, req.body);
    res.send('File updated');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// List directory
app.get('/api/ls/*', (req, res) => {
  const path = req.params[0] || '/';
  const tree = bridge.getDirectoryTree(path);
  res.json(tree);
});
```

### Example 14: CLI Tool Integration

```typescript
// Simple CLI for FXD operations
const command = Deno.args[0];
const args = Deno.args.slice(1);

switch (command) {
  case 'create-snippet':
    const [path, file] = args;
    const content = await Deno.readTextFile(file);
    createSnippet(path, content, {
      id: `cli-${Date.now()}`,
      source: file
    });
    console.log(`Created snippet at ${path}`);
    break;
    
  case 'render-view':
    const [viewPath, outFile] = args;
    const rendered = renderView(viewPath);
    await Deno.writeTextFile(outFile, rendered);
    console.log(`Rendered ${viewPath} to ${outFile}`);
    break;
    
  case 'round-trip':
    const [inFile, originalView] = args;
    const edited = await Deno.readTextFile(inFile);
    const original = renderView(originalView);
    const patches = toPatches(edited, original);
    applyPatches(patches);
    console.log(`Applied ${patches.length} patches`);
    break;
}
```

## Next Steps

These examples demonstrate the basic functionality of FXD Phase 1. For more advanced examples, see:

- [Advanced Examples](examples-advanced.md) - Complex scenarios and patterns
- [Demo Application](demo.md) - Complete working application
- [API Reference](api-snippets.md) - Full API documentation
- [Guides](guide-snippets.md) - In-depth guides