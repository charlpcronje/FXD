# Snippet Management Example

**Location:** `examples/snippet-management/`
**Difficulty:** Intermediate
**Time:** 15 minutes

## Overview

This example demonstrates FXD's snippet management system. Snippets are reusable pieces of code with metadata like language, file location, and version information. They're perfect for:
- Code generation workflows
- Template management
- Multi-file editing
- Code reuse libraries

## What You'll Learn

1. **Creating Snippets**: Using `createSnippet()` to make trackable code fragments
2. **Snippet Metadata**: Setting language, file, order, and version
3. **Wrapping**: Adding FX:BEGIN/END markers for file embedding
4. **Finding Snippets**: ID-based lookup with `findBySnippetId()`
5. **Type Checking**: Using `isSnippet()` to verify snippet nodes
6. **Checksums**: Content integrity checking with `simpleHash()`

## Running the Example

```bash
deno run -A examples/snippet-management/demo.ts
```

## Expected Output

You'll see:
- Snippet creation with metadata
- Wrapped snippets with FX markers
- ID-based snippet lookups
- Type checking demonstrations
- Checksum calculations
- Multi-language support (JS and Python)

## Key Concepts

### Creating Snippets

```typescript
import { createSnippet } from "../../modules/fx-snippets.ts";

createSnippet(
    "snippets.users.findUser",
    `export async function findUser(id) {
      return db.users.find(u => u.id === id);
    }`,
    {
        lang: "js",
        file: "src/users.js",
        order: 1,
        version: 1
    }
);
```

### Snippet Metadata

Each snippet has:
- **lang**: Programming language (js, ts, py, etc.)
- **file**: Target file path
- **order**: Ordering for multi-snippet files
- **id**: Unique identifier (defaults to path)
- **version**: Version number for change tracking
- **checksum**: Auto-calculated content hash

### Wrapping with Markers

```typescript
import { wrapSnippet } from "../../modules/fx-snippets.ts";

const wrapped = wrapSnippet("my-func", code, "js", {
    file: "utils.js",
    order: 0
});
// Produces:
// /* FX:BEGIN id=my-func lang=js file=utils.js checksum=abc123 order=0 version=1 */
// [your code here]
// /* FX:END id=my-func */
```

### Finding Snippets

```typescript
import { findBySnippetId } from "../../modules/fx-snippets.ts";

const result = findBySnippetId("snippets.users.findUser");
if (result) {
    console.log(result.path);  // "snippets.users.findUser"
    const snippet = $$(result.path);
}
```

### Multi-Language Support

Snippets adapt comment styles to the language:
- **JavaScript/TypeScript**: `/* */` block comments
- **Python/Shell**: `#` line comments
- **HTML/XML**: `<!-- -->` comments
- **PHP/Go/C++**: `/* */` block comments

## Use Cases

### Code Generation
Create templates and generate files with proper markers:
```typescript
const template = createSnippet("templates.api.get", apiCode, {
    lang: "ts",
    file: "api/users.ts"
});
```

### Multi-File Editing
Group related snippets by file and order:
```typescript
createSnippet("file.header", imports, { order: 0 });
createSnippet("file.types", types, { order: 1 });
createSnippet("file.impl", impl, { order: 2 });
```

### Version Tracking
Use checksums to detect changes:
```typescript
const hash = simpleHash(code);
if (storedHash !== hash) {
    console.log("Snippet has changed!");
}
```

## Next Steps

After mastering snippet-management, try:
- **selector-demo**: Query snippets using CSS selectors
- **reactive-groups**: Create reactive collections of snippets
- **import-export-workflow**: Import/export entire snippet libraries

## Files

- `demo.ts` - The runnable example
- `README.md` - This documentation

## Related Modules

- `modules/fx-snippets.ts` - Core snippet functionality
- `modules/fx-view.ts` - Rendering snippets into files
- `modules/fx-parse.ts` - Parsing changes back into snippets
