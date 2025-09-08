# Snippets API

## Overview

The Snippets API provides functions for creating, managing, and indexing code snippets - the fundamental building blocks of FXD.

## Core Functions

### `createSnippet()`

Creates a new snippet with metadata and indexes it for retrieval.

```typescript
function createSnippet(
  path: string,
  body: string,
  opts?: {
    lang?: string;
    file?: string;
    id?: string;
    order?: number;
    version?: number;
  }
): FXNodeProxy
```

#### Parameters
- `path`: Location in FX tree (e.g., "snippets.user.model")
- `body`: The actual code content
- `opts`: Optional metadata
  - `lang`: Language identifier ("js", "ts", "py", etc.)
  - `file`: Associated file path for grouping
  - `id`: Unique identifier (defaults to path)
  - `order`: Sort order when rendering (default: undefined)
  - `version`: Version number (default: 1)

#### Example
```typescript
const snippet = createSnippet(
  "snippets.auth.validate",
  `function validateUser(user) {
    return user.email && user.password;
  }`,
  {
    lang: "js",
    file: "auth/validation.js",
    id: "auth-validate-001",
    order: 1
  }
);
```

### `indexSnippet()`

Manually indexes a snippet for ID-based lookup.

```typescript
function indexSnippet(path: string, id?: string): void
```

#### Parameters
- `path`: FX path to the snippet
- `id`: Optional ID (uses snippet's metadata if not provided)

#### Example
```typescript
// Re-index after manual changes
indexSnippet("snippets.user.model", "user-model-001");
```

### `removeSnippetIndex()`

Removes a snippet from the index.

```typescript
function removeSnippetIndex(path: string): void
```

#### Example
```typescript
removeSnippetIndex("snippets.deprecated.oldCode");
```

### `findBySnippetId()`

Locates a snippet by its ID.

```typescript
function findBySnippetId(id: string): { id: string; path: string } | null
```

#### Example
```typescript
const location = findBySnippetId("user-model-001");
if (location) {
  console.log(`Found at: ${location.path}`);
  const snippet = $$(location.path).val();
}
```

## Snippet Metadata

### Standard Metadata Fields

```typescript
interface SnippetMetadata {
  id: string;        // Unique identifier
  lang: string;      // Language for syntax highlighting
  file?: string;     // Associated file path
  order?: number;    // Rendering order
  version?: number;  // Version tracking
  checksum?: string; // Content hash (auto-generated)
  
  // Custom fields
  [key: string]: any;
}
```

### Custom Metadata

Add any custom fields for your use case:

```typescript
createSnippet("snippets.api.endpoint", code, {
  id: "api-users-get",
  file: "api/users.js",
  method: "GET",           // Custom
  route: "/api/users",     // Custom
  auth: true,             // Custom
  deprecated: false       // Custom
});
```

## Snippet Wrapping

### `wrapSnippet()`

Wraps snippet content with FX markers for round-trip editing.

```typescript
function wrapSnippet(
  id: string,
  body: string,
  lang?: string,
  meta?: Partial<Marker>
): string
```

#### Example
```typescript
const wrapped = wrapSnippet(
  "user-001",
  "class User {}",
  "js",
  { file: "User.js", order: 0 }
);
// Output:
// /* FX:BEGIN id=user-001 lang=js file=User.js checksum=... order=0 version=1 */
// class User {}
// /* FX:END id=user-001 */
```

### Comment Styles

Different languages use different comment styles:

```typescript
const COMMENT = {
  js:   { open: "/*", close: "*/", line: "//" },
  py:   { line: "#" },
  sh:   { line: "#" },
  html: { open: "<!--", close: "-->" },
  css:  { open: "/*", close: "*/" }
};
```

## Snippet Lifecycle

### Creation Flow
```typescript
// 1. Create snippet
const snippet = createSnippet(path, body, opts);

// 2. Snippet is automatically:
//    - Stored in FX tree
//    - Indexed by ID
//    - Tagged with type="snippet"
//    - Given metadata

// 3. Available for:
//    - Selection in views
//    - Rendering with markers
//    - Round-trip editing
```

### Update Flow
```typescript
// 1. Get snippet
const path = findBySnippetId("user-001").path;

// 2. Update content
$$(path).val("new content");

// 3. Update metadata
const node = $$(path).node();
node.__meta.version = 2;
node.__meta.updatedAt = new Date();
```

### Deletion Flow
```typescript
// 1. Remove from index
removeSnippetIndex("snippets.old.code");

// 2. Remove from tree (optional)
$$("snippets.old").set(undefined);
```

## Snippet Selection

Snippets can be selected using CSS-like selectors:

### By Type
```typescript
// All snippets
$$("views.all").group([]).include(".snippet");
```

### By File
```typescript
// Snippets for specific file
$$("views.userFile")
  .group([])
  .include('.snippet[file="src/User.js"]');
```

### By Custom Attributes
```typescript
// Deprecated snippets
$$("views.deprecated")
  .group([])
  .include('.snippet[deprecated=true]');

// API endpoints
$$("views.apiEndpoints")
  .group([])
  .include('.snippet[method="GET"]');
```

### By ID Pattern
```typescript
// Snippets with ID prefix
$$("views.userSnippets")
  .group([])
  .include('.snippet[id^="user-"]');
```

## Best Practices

### 1. Consistent IDs
Use a naming convention:
```typescript
// Format: domain-feature-number
"auth-login-001"
"user-model-001"
"api-users-get-001"
```

### 2. Meaningful Metadata
```typescript
createSnippet(path, body, {
  id: "descriptive-id",
  file: "clear/path.js",
  order: 10,  // Leave gaps for insertions
  author: "developer",
  created: new Date(),
  tags: ["auth", "validation"]
});
```

### 3. Version Management
```typescript
// Track versions explicitly
const version = node.__meta.version || 1;
node.__meta.version = version + 1;
node.__meta.previousVersion = version;
```

### 4. Snippet Validation
```typescript
function validateSnippet(path: string): boolean {
  const node = $$(path).node();
  return !!(
    node.__type === "snippet" &&
    node.__meta?.id &&
    node.__meta?.lang &&
    fx.val(node)
  );
}
```

## Advanced Usage

### Snippet Templates
```typescript
function createFromTemplate(template: string, vars: Record<string, string>) {
  let body = template;
  for (const [key, value] of Object.entries(vars)) {
    body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return body;
}

const template = `
export class {{name}} {
  constructor() {
    this.type = "{{type}}";
  }
}`;

createSnippet("snippets.generated", 
  createFromTemplate(template, { name: "User", type: "model" }),
  { id: "generated-001" }
);
```

### Snippet Relationships
```typescript
// Link related snippets
createSnippet("snippets.component", body, {
  id: "component-001",
  requires: ["import-001", "style-001"],
  requiredBy: ["app-001"]
});
```

### Bulk Operations
```typescript
// Create multiple snippets
const snippets = [
  { path: "s1", body: "code1", opts: {...} },
  { path: "s2", body: "code2", opts: {...} }
];

for (const { path, body, opts } of snippets) {
  createSnippet(path, body, opts);
}
```

## See Also

- [Views API](api-views.md) - Composing snippets into files
- [Parsing API](api-parsing.md) - Round-trip editing
- [CSS Selectors Guide](guide-selectors.md) - Advanced selection