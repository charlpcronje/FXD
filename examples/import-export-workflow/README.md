# Import/Export Workflow Example

**Location:** `examples/import-export-workflow/`
**Difficulty:** Advanced
**Time:** 20-30 minutes

## Overview

This example demonstrates the complete import/export workflow in FXD. It shows how to:
- Create structured projects in FXD
- Build views from snippet collections
- Render views to code
- Export to real files
- Serialize/deserialize graph state
- Create export manifests

This is the foundation for using FXD as a code generation and project management system.

## What You'll Learn

1. **Structured Projects**: Organizing code snippets into logical structures
2. **View Building**: Creating file representations from snippets
3. **Rendering**: Converting FXD views to actual code
4. **File Export**: Writing rendered content to the filesystem
5. **Serialization**: Saving and restoring FXD graph state
6. **Manifests**: Tracking exports with metadata

## Running the Example

```bash
deno run -A examples/import-export-workflow/demo.ts
```

This will:
- Create snippets and views in memory
- Export files to `output/` directory
- Generate a manifest and state snapshot

## Expected Output

You'll see:
- Snippet and view creation
- View rendering demonstrations
- File export confirmations
- Graph serialization
- Manifest generation
- Export statistics

The `output/` directory will contain:
- `index.js` - Rendered main file
- `greet.js` - Rendered module file
- `project-state.json` - Serialized graph state
- `manifest.json` - Export metadata

## Key Concepts

### Creating Structured Content

```typescript
import { createSnippet } from "../../modules/fx-snippets.ts";

// Create snippets for different parts of a file
createSnippet(
    "project.src.index.header",
    `import { greet } from './greet.js';`,
    { lang: "js", file: "src/index.js", order: 0 }
);

createSnippet(
    "project.src.index.main",
    `console.log(greet('World'));`,
    { lang: "js", file: "src/index.js", order: 1 }
);
```

### Building Views

```typescript
// Create a view that groups snippets
$$("views.indexFile")
    .group()
    .add($$("project.src.index.header"))
    .add($$("project.src.index.main"));
```

### Rendering to Code

```typescript
import { renderView } from "../../modules/fx-view.ts";

const code = renderView("views.indexFile", {
    lang: "js",
    hoistImports: true  // Move imports to top
});
```

### Exporting Files

```typescript
// Ensure directory exists
await Deno.mkdir("output", { recursive: true });

// Write rendered content
await Deno.writeTextFile("output/index.js", code);
```

### Serializing Graph State

```typescript
function serializeNode(node: any, path: string): any {
    return {
        path,
        value: node.__value,
        type: node.__type,
        meta: node.__meta,
        children: Object.fromEntries(
            Object.entries(node.__nodes).map(([key, child]) =>
                [key, serializeNode(child, `${path}.${key}`)]
            )
        )
    };
}

const state = serializeNode($$("project").node(), "project");
const json = JSON.stringify(state, null, 2);
```

### Deserializing State

```typescript
function deserializeNode(data: any, parent: any = null): any {
    const node = fx.createNode(parent?.__id || null);

    if (data.value) node.__value = data.value;
    if (data.type) node.__type = data.type;
    if (data.meta) (node as any).__meta = data.meta;

    for (const [key, childData] of Object.entries(data.children)) {
        node.__nodes[key] = deserializeNode(childData, node);
    }

    return node;
}

const restored = deserializeNode(JSON.parse(json));
```

### Creating Manifests

```typescript
const manifest = {
    name: "my-app",
    version: "1.0.0",
    exported: new Date().toISOString(),
    files: [
        {
            path: "index.js",
            snippets: ["project.src.index.header", "project.src.index.main"]
        }
    ],
    totalSnippets: 2,
    totalViews: 1
};

await Deno.writeTextFile(
    "manifest.json",
    JSON.stringify(manifest, null, 2)
);
```

## Workflow Patterns

### Code Generation Pipeline

```typescript
// 1. Create snippets from templates
createSnippet("api.route", generateRoute(config), opts);
createSnippet("api.handler", generateHandler(config), opts);

// 2. Build view
$$("views.apiFile").group()
    .add($$("api.route"))
    .add($$("api.handler"));

// 3. Render
const code = renderView("views.apiFile", { lang: "ts" });

// 4. Export
await Deno.writeTextFile("dist/api.ts", code);
```

### Project Snapshot

```typescript
// Save complete project state
const snapshot = {
    timestamp: Date.now(),
    version: "1.0.0",
    graph: serializeNode(fx.root, ""),
    metadata: { /* ... */ }
};

await Deno.writeTextFile(
    "snapshots/project-v1.json",
    JSON.stringify(snapshot)
);
```

### Incremental Export

```typescript
// Track what's changed
const changes = detectChanges(lastExport, currentState);

// Export only modified files
for (const viewId of changes.modifiedViews) {
    const code = renderView(viewId);
    const filePath = getFilePath(viewId);
    await Deno.writeTextFile(filePath, code);
}
```

## Use Cases

### Static Site Generation
```typescript
// Create pages from snippets
createSnippet("pages.home.html", homeTemplate, { lang: "html" });
createSnippet("pages.home.css", homeStyles, { lang: "css" });

// Build and export
const html = renderView("views.homePage");
await Deno.writeTextFile("dist/index.html", html);
```

### API Scaffolding
```typescript
// Generate CRUD endpoints
for (const model of models) {
    createSnippet(`api.${model}.routes`, generateRoutes(model));
    createSnippet(`api.${model}.controller`, generateController(model));
}

// Export to files
await exportViews("views.api", "src/api");
```

### Documentation Generation
```typescript
// Extract snippets as examples
const examples = $$("snippets").select('.snippet[type=example]');

// Generate docs
const docs = examples.list().map(s => generateDoc(s));
await Deno.writeTextFile("docs/examples.md", docs.join("\n\n"));
```

### Migration Tools
```typescript
// Import existing codebase
await importDirectory("./legacy-code", "legacy");

// Transform to new structure
transform($$("legacy"), $$("migrated"));

// Export new version
await exportProject("migrated", "./new-code");
```

## Advanced Features

### Custom Renderers

Implement custom rendering logic:

```typescript
function customRender(viewId: string) {
    const snippets = $$(`views.${viewId}`).group().list();
    return snippets
        .map(s => processSnippet(s.val()))
        .join("\n\n");
}
```

### Export Hooks

Run code before/after export:

```typescript
const result = await exportWithHooks("views.app", "dist", {
    beforeExport: (view) => {
        console.log("Validating...");
        validate(view);
    },
    afterExport: (files) => {
        console.log("Bundling...");
        bundle(files);
    }
});
```

### Versioned Exports

Track exports over time:

```typescript
const version = new Date().toISOString();
const exportPath = `exports/${version}`;

await exportProject("project", exportPath);
await saveManifest(exportPath, {
    version,
    hash: computeHash(exportPath),
    previous: lastVersion
});
```

## Next Steps

After mastering import-export-workflow:
- Combine with all previous examples for a complete workflow
- Build custom import/export pipelines
- Create project templates and generators
- Integrate with build systems (webpack, vite, etc.)

## Files

- `demo.ts` - The runnable example
- `README.md` - This documentation
- `output/` - Generated files (created on run)

## Related Modules

- `modules/fx-snippets.ts` - Snippet management
- `modules/fx-view.ts` - View rendering
- `modules/fx-import.ts` - Import engine
- `modules/fx-export.ts` - Export engine
