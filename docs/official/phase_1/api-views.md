# Views API

## Overview

The Views API enables dynamic composition of snippets into files using powerful selection and rendering capabilities.

## Core Functions

### `renderView()`

Renders a view into a complete file with FX markers.

```typescript
function renderView(
  viewPath: string,
  opts?: {
    lang?: string;
    sep?: string;
    eol?: "lf" | "crlf";
    hoistImports?: boolean;
  }
): string
```

#### Parameters
- `viewPath`: FX path to the view
- `opts`: Rendering options
  - `lang`: Default language for snippets
  - `sep`: Separator between snippets (default: "\n\n")
  - `eol`: Line ending style (default: "lf")
  - `hoistImports`: Move imports to top (default: false)

#### Example
```typescript
const content = renderView("views.UserModel", {
  lang: "js",
  sep: "\n\n",
  hoistImports: true
});
```

## Creating Views

### Basic View Creation

```typescript
// Create empty view
$$("views.myFile").group([]);

// Add snippets by path
$$("views.myFile").group([
  "snippets.header",
  "snippets.main",
  "snippets.footer"
]);
```

### Dynamic Selection

```typescript
// Select snippets using CSS-like selectors
$$("views.userFile")
  .group([])
  .include('.snippet[file="User.js"]')
  .reactive(true);
```

## View Operations

### `group()`

Creates or retrieves a group of snippets.

```typescript
// Create new group with paths
const group = $$("view").group(["path1", "path2"]);

// Retrieve existing group
const existing = $$("view").group();
```

### `include()`

Adds snippets matching a selector.

```typescript
$$("view")
  .group([])
  .include('.snippet')                    // All snippets
  .include('.snippet[lang="js"]')        // JavaScript snippets
  .include('.snippet[order>=0]');        // Ordered snippets
```

### `exclude()`

Removes snippets matching a selector.

```typescript
$$("view")
  .group([])
  .include('.snippet[file="app.js"]')
  .exclude('.snippet[deprecated=true]'); // Exclude deprecated
```

### `reactive()`

Makes the view automatically update when snippets change.

```typescript
$$("view")
  .group([])
  .include('.snippet')
  .reactive(true)  // Enable reactive updates
  .on('change', () => console.log('View updated!'));
```

## View Composition Patterns

### File-Based Views

Group all snippets for a specific file:

```typescript
$$("views.UserModel")
  .group([])
  .include('.snippet[file="models/User.js"]');
```

### Feature-Based Views

Group snippets by feature:

```typescript
$$("views.authentication")
  .group([])
  .include('.snippet[feature="auth"]')
  .include('.snippet[id^="auth-"]');
```

### Layer-Based Views

Separate by architectural layer:

```typescript
// Controllers
$$("views.controllers")
  .group([])
  .include('.snippet[layer="controller"]');

// Models
$$("views.models")
  .group([])
  .include('.snippet[layer="model"]');
```

### Composite Views

Combine multiple criteria:

```typescript
$$("views.apiEndpoints")
  .group([])
  .include('.snippet[type="endpoint"]')
  .include('.snippet[method="GET"]')
  .exclude('.snippet[internal=true]');
```

## Rendering Options

### Import Hoisting

Automatically move imports to the top:

```typescript
// Before hoisting
const content = `
function helper() {}
import { util } from './util';
class MyClass {}
import React from 'react';
`;

// After hoisting
const hoisted = hoistImportsOnce(content);
// Result:
// import { util } from './util';
// import React from 'react';
//
// function helper() {}
// class MyClass {}
```

### Line Endings

Control line ending style:

```typescript
renderView("view", {
  eol: "crlf"  // Windows-style
});

renderView("view", {
  eol: "lf"    // Unix-style (default)
});
```

### Custom Separators

Control spacing between snippets:

```typescript
renderView("view", {
  sep: "\n"      // Single line
});

renderView("view", {
  sep: "\n\n\n"  // Triple spacing
});
```

## View Management

### Listing View Contents

```typescript
const group = $$("views.myFile").group();
const items = group.list();

items.forEach(proxy => {
  const node = proxy.node();
  const meta = node.__meta;
  const value = proxy.val();
  
  console.log(`Snippet: ${meta.id}`);
  console.log(`Order: ${meta.order}`);
  console.log(`Content: ${value}`);
});
```

### Sorting Snippets

Snippets are automatically sorted by order:

```typescript
// Snippets render in order
createSnippet("s1", "third", { order: 30 });
createSnippet("s2", "first", { order: 10 });
createSnippet("s3", "second", { order: 20 });

// Rendered order: first, second, third
```

### View Statistics

```typescript
function getViewStats(viewPath: string) {
  const group = $$(viewPath).group();
  const items = group.list();
  
  return {
    count: items.length,
    totalSize: items.reduce((sum, item) => {
      return sum + (item.val()?.length || 0);
    }, 0),
    languages: [...new Set(items.map(i => 
      i.node().__meta?.lang
    ))],
    files: [...new Set(items.map(i => 
      i.node().__meta?.file
    ))]
  };
}
```

## Advanced Rendering

### Custom Wrapper Function

```typescript
function renderWithCustomWrapper(viewPath: string) {
  const group = $$(viewPath).group();
  const items = group.list();
  
  return items.map(proxy => {
    const meta = proxy.node().__meta;
    const body = proxy.val();
    
    // Custom wrapper format
    return `
// ===== ${meta.id} =====
// File: ${meta.file}
// Version: ${meta.version}
${body}
// ===== END ${meta.id} =====
    `.trim();
  }).join("\n\n");
}
```

### Conditional Rendering

```typescript
function renderConditional(viewPath: string, condition: (meta: any) => boolean) {
  const group = $$(viewPath).group();
  const items = group.list();
  
  const filtered = items.filter(proxy => {
    const meta = proxy.node().__meta;
    return condition(meta);
  });
  
  // Render only matching snippets
  return filtered.map(proxy => {
    const meta = proxy.node().__meta;
    const body = proxy.val();
    return wrapSnippet(meta.id, body, meta.lang, meta);
  }).join("\n\n");
}

// Usage: Only render non-deprecated snippets
const content = renderConditional("views.all", 
  meta => !meta.deprecated
);
```

### Multi-File Rendering

```typescript
function renderMultipleFiles(views: Record<string, string>) {
  const results: Record<string, string> = {};
  
  for (const [file, viewPath] of Object.entries(views)) {
    results[file] = renderView(viewPath, {
      lang: file.endsWith('.ts') ? 'ts' : 'js',
      hoistImports: true
    });
  }
  
  return results;
}

// Render multiple files at once
const files = renderMultipleFiles({
  "src/User.js": "views.UserModel",
  "src/Auth.js": "views.AuthModule",
  "src/API.js": "views.APIEndpoints"
});
```

## View Events

### Change Detection

```typescript
$$("views.reactive")
  .group([])
  .include('.snippet')
  .reactive(true)
  .on('change', (group, event) => {
    console.log('View changed!');
    
    // Re-render on change
    const content = renderView("views.reactive");
    fs.writeFileSync("output.js", content);
  });
```

### View Lifecycle

```typescript
// Before render
$$("views.myFile").on('beforeRender', () => {
  console.log('About to render...');
});

// After render
$$("views.myFile").on('afterRender', (content) => {
  console.log(`Rendered ${content.length} bytes`);
});
```

## Best Practices

### 1. Semantic View Names

```typescript
// Good: Clear purpose
$$("views.UserModelFile")
$$("views.AuthenticationModule")
$$("views.APIEndpointsCollection")

// Bad: Vague names
$$("views.stuff")
$$("views.temp")
$$("views.v1")
```

### 2. Consistent Selectors

```typescript
// Use consistent attribute names
createSnippet(path, body, {
  component: "Button",    // Consistent naming
  layer: "ui",           // Clear categories  
  module: "shared"       // Logical grouping
});

// Easy to select
$$("views.buttons")
  .group([])
  .include('.snippet[component="Button"]');
```

### 3. View Documentation

```typescript
// Document view purpose
$$("views.PublicAPI")
  .group([])
  .include('.snippet[public=true]')
  .include('.snippet[api=true]');

// Store view metadata
$$("views.PublicAPI.meta").val({
  description: "All public API endpoints",
  created: new Date(),
  author: "team"
});
```

## Performance Considerations

### Lazy Rendering

```typescript
// Only render when needed
let cached: string | null = null;
let cacheTime = 0;

function getCachedRender(viewPath: string) {
  const now = Date.now();
  if (!cached || now - cacheTime > 5000) {
    cached = renderView(viewPath);
    cacheTime = now;
  }
  return cached;
}
```

### Incremental Updates

```typescript
// Track what changed
const previousItems = new Set();

$$("view").on('change', (group) => {
  const currentItems = new Set(group.list().map(i => i.node().__id));
  
  const added = [...currentItems].filter(x => !previousItems.has(x));
  const removed = [...previousItems].filter(x => !currentItems.has(x));
  
  console.log(`Added: ${added.length}, Removed: ${removed.length}`);
  previousItems.clear();
  currentItems.forEach(x => previousItems.add(x));
});
```

## See Also

- [Snippets API](api-snippets.md) - Creating snippets
- [Filesystem Bridge API](api-bridge.md) - File operations
- [CSS Selectors Guide](guide-selectors.md) - Advanced selection
- [Round-Trip Guide](guide-roundtrip.md) - Editing rendered files