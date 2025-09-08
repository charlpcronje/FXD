# Filesystem Bridge API

## Overview

The Filesystem Bridge provides a virtual filesystem layer that maps file paths to views, enabling transparent file operations with FXD.

## Core Functions

### `fxFsFuse()`

Creates a new filesystem bridge instance.

```typescript
function fxFsFuse(opts?: {
  root?: string;
  encoding?: string;
}): FxFsBridge
```

#### Example
```typescript
import fxFsFuse from "./plugins/fx-fs-fuse.ts";

const bridge = fxFsFuse({
  root: "./virtual",
  encoding: "utf-8"
});
```

## Bridge Operations

### `register()`

Maps a file path to a view.

```typescript
interface Registration {
  filePath: string;      // Virtual file path
  viewId: string;        // FX view path
  lang?: string;         // Language hint
  hoistImports?: boolean;// Process imports
  eol?: "lf" | "crlf";  // Line endings
}

bridge.register(registration: Registration): void
```

#### Example
```typescript
bridge.register({
  filePath: "src/models/User.js",
  viewId: "views.UserModel",
  lang: "js",
  hoistImports: true
});
```

### `readFile()`

Reads a virtual file by rendering its associated view.

```typescript
bridge.readFile(filePath: string): string
```

#### Example
```typescript
const content = bridge.readFile("src/models/User.js");
console.log(content); // Rendered view with markers
```

### `writeFile()`

Writes to a virtual file, parsing changes back to snippets.

```typescript
bridge.writeFile(filePath: string, content: string): void
```

#### Example
```typescript
const edited = `
/* FX:BEGIN id=user-001 ... */
class User {
  // Modified content
}
/* FX:END id=user-001 */
`;

bridge.writeFile("src/models/User.js", edited);
// Changes flow back to snippets
```

### `readdir()`

Lists files in a virtual directory.

```typescript
bridge.readdir(dirPath?: string): string[]
```

#### Example
```typescript
const files = bridge.readdir("src/models");
// ["User.js", "Post.js", "Comment.js"]
```

### `exists()`

Checks if a virtual file exists.

```typescript
bridge.exists(filePath: string): boolean
```

#### Example
```typescript
if (bridge.exists("src/models/User.js")) {
  const content = bridge.readFile("src/models/User.js");
}
```

## Registration Management

### Multiple Registrations

```typescript
// Register multiple files at once
const files = [
  { filePath: "src/User.js", viewId: "views.User" },
  { filePath: "src/Post.js", viewId: "views.Post" },
  { filePath: "src/Comment.js", viewId: "views.Comment" }
];

files.forEach(reg => bridge.register(reg));
```

### Dynamic Registration

```typescript
// Register files based on views
function autoRegister(pattern: string) {
  const views = $$("views").nodes();
  
  Object.entries(views).forEach(([name, proxy]) => {
    const meta = proxy.node().__meta;
    if (meta?.autoFile) {
      bridge.register({
        filePath: meta.autoFile,
        viewId: `views.${name}`,
        lang: meta.lang
      });
    }
  });
}
```

### Unregister

```typescript
// Remove a registration
bridge.unregister("src/old-file.js");
```

## Virtual Directory Structure

### Directory Hierarchy

```typescript
// Virtual filesystem structure
bridge.register({ filePath: "src/models/User.js", viewId: "views.models.User" });
bridge.register({ filePath: "src/models/Post.js", viewId: "views.models.Post" });
bridge.register({ filePath: "src/api/users.js", viewId: "views.api.users" });
bridge.register({ filePath: "tests/user.test.js", viewId: "views.tests.user" });

// Results in:
// /
// ├── src/
// │   ├── models/
// │   │   ├── User.js
// │   │   └── Post.js
// │   └── api/
// │       └── users.js
// └── tests/
//     └── user.test.js
```

### Directory Operations

```typescript
// List root
bridge.readdir("/");     // ["src", "tests"]

// List subdirectory
bridge.readdir("src");    // ["models", "api"]
bridge.readdir("src/models"); // ["User.js", "Post.js"]
```

## Round-Trip Processing

### Write Operation Flow

```typescript
// 1. User edits file
const edited = bridge.readFile("file.js").replace("old", "new");

// 2. Write triggers parsing
bridge.writeFile("file.js", edited);

// Internal flow:
// a. Parse content for FX markers
// b. Extract patches from changes
// c. Apply patches to source snippets
// d. Update snippet checksums
```

### Patch Generation

```typescript
import { toPatches } from "./modules/fx-parse.ts";

// Generate patches from edited content
const original = bridge.readFile("file.js");
const edited = "...modified content...";
const patches = toPatches(edited, original);

// Patches contain:
// - Snippet ID
// - New content
// - Checksum validation
```

### Patch Application

```typescript
import { applyPatches } from "./modules/fx-parse.ts";

// Apply patches to snippets
applyPatches(patches);

// Each patch:
// 1. Finds snippet by ID
// 2. Validates checksum
// 3. Updates content
// 4. Recalculates checksum
```

## File Watching

### Watch for Changes

```typescript
bridge.watch("src/models/User.js", (event, filePath) => {
  console.log(`File ${filePath} changed: ${event}`);
  
  if (event === 'change') {
    // Re-render or notify
    const newContent = bridge.readFile(filePath);
    broadcast(newContent);
  }
});
```

### Watch Patterns

```typescript
// Watch all JavaScript files
bridge.watchPattern("**/*.js", (event, filePath) => {
  console.log(`JS file changed: ${filePath}`);
});
```

## Integration Examples

### Express Integration

```typescript
import express from 'express';
const app = express();

// Serve virtual files
app.get('/files/*', (req, res) => {
  const filePath = req.params[0];
  
  if (bridge.exists(filePath)) {
    const content = bridge.readFile(filePath);
    res.type('text/plain').send(content);
  } else {
    res.status(404).send('File not found');
  }
});

// Update virtual files
app.put('/files/*', express.text(), (req, res) => {
  const filePath = req.params[0];
  bridge.writeFile(filePath, req.body);
  res.send('OK');
});
```

### File System Proxy

```typescript
// Make virtual files appear as real files
import { createProxy } from 'fs-proxy';

const proxy = createProxy({
  readFile: (path) => bridge.readFile(path),
  writeFile: (path, content) => bridge.writeFile(path, content),
  readdir: (path) => bridge.readdir(path),
  exists: (path) => bridge.exists(path)
});

// Use with any tool expecting real files
someLibrary.processFile(proxy.path("src/User.js"));
```

## Advanced Features

### Custom Renderers

```typescript
// Register with custom renderer
bridge.register({
  filePath: "docs/api.md",
  viewId: "views.api",
  renderer: (view) => {
    // Custom markdown generation
    const items = view.list();
    return items.map(item => {
      const meta = item.node().__meta;
      return `## ${meta.name}\n\n${item.val()}\n`;
    }).join('\n');
  }
});
```

### Transform Pipeline

```typescript
// Add transforms to file operations
bridge.addTransform({
  read: (content, filePath) => {
    // Transform on read
    if (filePath.endsWith('.min.js')) {
      return minify(content);
    }
    return content;
  },
  write: (content, filePath) => {
    // Transform on write
    if (filePath.endsWith('.ts')) {
      return prettier(content);
    }
    return content;
  }
});
```

### Virtual File Metadata

```typescript
// Store metadata with registrations
bridge.register({
  filePath: "src/User.js",
  viewId: "views.User",
  metadata: {
    mimeType: "application/javascript",
    encoding: "utf-8",
    created: new Date(),
    author: "system",
    permissions: "rw-r--r--"
  }
});

// Access metadata
const meta = bridge.getMetadata("src/User.js");
```

## Performance Optimization

### Caching

```typescript
// Enable caching
const bridge = fxFsFuse({
  cache: true,
  cacheTimeout: 5000 // 5 seconds
});

// Manual cache control
bridge.clearCache("src/User.js");
bridge.clearAllCache();
```

### Lazy Loading

```typescript
// Only render when accessed
bridge.register({
  filePath: "large-file.js",
  viewId: "views.large",
  lazy: true // Don't pre-render
});
```

## Error Handling

### Registration Errors

```typescript
try {
  bridge.register({
    filePath: "invalid/path",
    viewId: "non.existent.view"
  });
} catch (error) {
  console.error("Registration failed:", error);
}
```

### Read/Write Errors

```typescript
// Safe read
function safeRead(filePath: string): string | null {
  try {
    return bridge.readFile(filePath);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return null;
  }
}

// Safe write
function safeWrite(filePath: string, content: string): boolean {
  try {
    bridge.writeFile(filePath, content);
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
    return false;
  }
}
```

## See Also

- [Views API](api-views.md) - Creating views for files
- [Parsing API](api-parsing.md) - Round-trip parsing
- [Round-Trip Guide](guide-roundtrip.md) - Editing workflow
- [Demo Application](demo.md) - Complete example