# Quick Start Guide

Build your first FXD project in 5 minutes!

## Step 1: Create Your First Snippets

```typescript
import { createSnippet } from "./modules/fx-snippets.ts";

// Create a User class snippet
createSnippet(
  "snippets.user.class",
  `export class User {
  constructor(public name: string, public email: string) {
    this.id = Date.now().toString(36);
    this.createdAt = new Date();
  }
}`,
  { 
    lang: "ts", 
    file: "models/User.ts", 
    id: "user-class-001",
    order: 1
  }
);

// Create imports snippet
createSnippet(
  "snippets.user.imports",
  `import { BaseModel } from './BaseModel';
import { validate } from '../utils/validate';`,
  { 
    lang: "ts", 
    file: "models/User.ts", 
    id: "user-imports-001",
    order: 0  // Imports come first
  }
);

console.log("✅ Snippets created!");
```

## Step 2: Create a View

```typescript
import { $$ } from "./fx.ts";

// Create a view that collects all snippets for User.ts
$$("views.UserModel")
  .group([])
  .include('.snippet[file="models/User.ts"]')
  .reactive(true);  // Auto-update when snippets change

console.log("✅ View created!");
```

## Step 3: Render the File

```typescript
import { renderView } from "./modules/fx-view.ts";

// Render the view to a complete file
const fileContent = renderView("views.UserModel", {
  lang: "ts",
  hoistImports: true,  // Move all imports to the top
  sep: "\n\n"          // Separator between snippets
});

console.log("📄 Generated file:");
console.log(fileContent);
```

Output will be:
```typescript
import { BaseModel } from './BaseModel';
import { validate } from '../utils/validate';

/* FX:BEGIN id=user-imports-001 lang=ts file=models/User.ts checksum=a1b2c3d4 order=0 version=1 */
/* FX:END id=user-imports-001 */

/* FX:BEGIN id=user-class-001 lang=ts file=models/User.ts checksum=e5f6g7h8 order=1 version=1 */
export class User {
  constructor(public name: string, public email: string) {
    this.id = Date.now().toString(36);
    this.createdAt = new Date();
  }
}
/* FX:END id=user-class-001 */
```

## Step 4: Set Up Filesystem Bridge

```typescript
import fxFsFuse from "./plugins/fx-fs-fuse.ts";

// Create filesystem bridge
const fs = fxFsFuse();

// Register the view as a virtual file
fs.register({
  filePath: "models/User.ts",
  viewId: "views.UserModel",
  lang: "ts",
  hoistImports: true
});

// Now you can read/write the file
const content = fs.readFile("models/User.ts");
console.log("📖 Read from virtual filesystem:", content.length, "bytes");
```

## Step 5: Round-Trip Editing

```typescript
// User edits the file (preserving markers)
const editedContent = `
import { BaseModel } from './BaseModel';
import { validate } from '../utils/validate';
import { Logger } from '../utils/logger'; // NEW LINE ADDED

/* FX:BEGIN id=user-imports-001 lang=ts file=models/User.ts checksum=a1b2c3d4 order=0 version=1 */
/* FX:END id=user-imports-001 */

/* FX:BEGIN id=user-class-001 lang=ts file=models/User.ts checksum=e5f6g7h8 order=1 version=1 */
export class User {
  constructor(public name: string, public email: string) {
    this.id = Date.now().toString(36);
    this.createdAt = new Date();
    this.lastLogin = null; // NEW LINE ADDED
  }
}
/* FX:END id=user-class-001 */
`;

// Write back - changes flow to snippets!
fs.writeFile("models/User.ts", editedContent);

// Verify the snippet was updated
const updatedClass = $$("snippets.user.class").val();
console.log("✅ Snippet updated:", updatedClass.includes("lastLogin"));
```

## Complete Example

```typescript
// quickstart.ts
import { fx, $$, $_$$ } from "./fx.ts";
import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";
import fxFsFuse from "./plugins/fx-fs-fuse.ts";

// Make FX available globally
Object.assign(globalThis, { fx, $$, $_$$ });

async function quickstart() {
  console.log("🚀 FXD Quickstart Demo\n");

  // 1. Create snippets
  createSnippet("snippets.hello", "console.log('Hello');", {
    lang: "js", file: "app.js", id: "hello-001", order: 0
  });
  
  createSnippet("snippets.world", "console.log('World');", {
    lang: "js", file: "app.js", id: "world-001", order: 1
  });

  // 2. Create view
  $$("views.app")
    .group([])
    .include('.snippet[file="app.js"]');

  // 3. Setup filesystem
  const fs = fxFsFuse();
  fs.register({
    filePath: "app.js",
    viewId: "views.app",
    lang: "js"
  });

  // 4. Read the file
  const content = fs.readFile("app.js");
  console.log("Generated file:");
  console.log(content);
  
  // 5. Simulate editing
  const edited = content.replace("Hello", "Hi");
  fs.writeFile("app.js", edited);
  
  console.log("\n✅ Round-trip complete!");
  console.log("First snippet now says:", $$("snippets.hello").val());
}

// Run the demo
if (import.meta.main) {
  quickstart();
}
```

Run it:
```bash
deno run -A quickstart.ts
```

## What's Next?

You've just:
- ✅ Created reusable snippets
- ✅ Composed them into views
- ✅ Rendered files with markers
- ✅ Performed round-trip editing

### Learn More
- [Core Concepts](concepts.md) - Deep dive into how FXD works
- [Snippets API](api-snippets.md) - Advanced snippet features
- [CSS Selectors](guide-selectors.md) - Powerful selection patterns
- [Demo Application](demo.md) - Full working example

### Try These Challenges
1. Add a third snippet with helper functions
2. Create multiple views from the same snippets
3. Use attribute selectors to filter snippets
4. Build a view that combines snippets from different files