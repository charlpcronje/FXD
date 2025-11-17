/**
 * Example: Import/Export Workflow
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.6
 *
 * This example demonstrates importing and exporting FXD content:
 * - Creating structured content in FXD
 * - Building views from snippets
 * - Exporting to files
 * - Serializing and deserializing graphs
 */

import { $$, $_$$, fx } from "../../fxn.ts";
import { createSnippet, wrapSnippet } from "../../modules/fx-snippets.ts";
import { renderView } from "../../modules/fx-view.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== Import/Export Workflow Demo ===\n");

// Step 1: Create a structured project in FXD
console.log("Step 1: Creating a structured project");

// Create package.json content
createSnippet(
    "project.package.json",
    JSON.stringify({
        name: "my-app",
        version: "1.0.0",
        type: "module",
        scripts: {
            start: "node index.js",
            test: "node test.js"
        }
    }, null, 2),
    { lang: "json", file: "package.json", order: 0 }
);

// Create main module
createSnippet(
    "project.src.index.header",
    `import { greet } from './greet.js';`,
    { lang: "js", file: "src/index.js", order: 0 }
);

createSnippet(
    "project.src.index.main",
    `const name = process.argv[2] || 'World';
console.log(greet(name));`,
    { lang: "js", file: "src/index.js", order: 1 }
);

// Create greet module
createSnippet(
    "project.src.greet.function",
    `export function greet(name) {
  return \`Hello, \${name}!\`;
}`,
    { lang: "js", file: "src/greet.js", order: 0 }
);

console.log("  Created 4 code snippets for a sample project");

// Step 2: Build views from snippets
console.log("\nStep 2: Building views from snippets");

// Create view for index.js
$$("views.indexFile")
    .group()
    .add($$("project.src.index.header"))
    .add($$("project.src.index.main"));

// Create view for greet.js
$$("views.greetFile")
    .group()
    .add($$("project.src.greet.function"));

console.log("  Created 2 views: indexFile, greetFile");

// Step 3: Render views to strings
console.log("\nStep 3: Rendering views to code");

const indexContent = renderView("views.indexFile", {
    lang: "js",
    hoistImports: true
});

const greetContent = renderView("views.greetFile", {
    lang: "js",
    hoistImports: false
});

console.log("  Index.js content:");
console.log("  " + indexContent.split("\n").slice(0, 5).join("\n  ") + "\n  ...");

console.log("\n  Greet.js content:");
console.log("  " + greetContent.split("\n").slice(0, 5).join("\n  ") + "\n  ...");

// Step 4: Export individual files
console.log("\nStep 4: Exporting files");

// Store rendered content in views
$$("views.indexFile.content").val(indexContent);
$$("views.greetFile.content").val(greetContent);

try {
    // Ensure output directory exists
    await Deno.mkdir("examples/import-export-workflow/output", { recursive: true });

    // Write files
    await Deno.writeTextFile(
        "examples/import-export-workflow/output/index.js",
        indexContent
    );
    await Deno.writeTextFile(
        "examples/import-export-workflow/output/greet.js",
        greetContent
    );

    console.log("  ✅ Exported to:");
    console.log("     - output/index.js");
    console.log("     - output/greet.js");
} catch (error) {
    console.log(`  ⚠️  Could not write files: ${error}`);
}

// Step 5: Serialize graph state
console.log("\nStep 5: Serializing FXD graph state");

function serializeNode(node: any, path: string): any {
    const serialized: any = {
        path,
        value: node.__value,
        type: node.__type,
        meta: (node as any).__meta,
        children: {}
    };

    for (const key in node.__nodes) {
        serialized.children[key] = serializeNode(
            node.__nodes[key],
            path ? `${path}.${key}` : key
        );
    }

    return serialized;
}

// Serialize just the project node
const projectState = serializeNode($$("project").node(), "project");
const stateJson = JSON.stringify(projectState, null, 2);

console.log("  Serialized graph size:", stateJson.length, "bytes");
console.log("  Sample of serialized state:");
console.log("  " + stateJson.split("\n").slice(0, 10).join("\n  ") + "\n  ...");

// Step 6: Save state to file
console.log("\nStep 6: Saving state to JSON");

try {
    await Deno.writeTextFile(
        "examples/import-export-workflow/output/project-state.json",
        stateJson
    );
    console.log("  ✅ Saved project state to output/project-state.json");
} catch (error) {
    console.log(`  ⚠️  Could not save state: ${error}`);
}

// Step 7: Demonstrate re-importing (would normally be from file)
console.log("\nStep 7: Demonstrating state restoration");

function deserializeNode(data: any, parent: any = null): any {
    const node = fx.createNode(parent?.__id || null);

    if (data.value !== undefined) {
        node.__value = data.value;
    }
    if (data.type) {
        node.__type = data.type;
    }
    if (data.meta) {
        (node as any).__meta = data.meta;
    }

    for (const key in data.children) {
        node.__nodes[key] = deserializeNode(data.children[key], node);
    }

    return node;
}

// Create a restored copy
const restoredNode = deserializeNode(projectState);
console.log(`  Restored node with ${Object.keys(restoredNode.__nodes).length} top-level children`);

// Step 8: Export manifest
console.log("\nStep 8: Creating export manifest");

const manifest = {
    name: "my-app",
    version: "1.0.0",
    exported: new Date().toISOString(),
    files: [
        { path: "index.js", snippets: ["project.src.index.header", "project.src.index.main"] },
        { path: "greet.js", snippets: ["project.src.greet.function"] }
    ],
    totalSnippets: 4,
    totalViews: 2
};

try {
    await Deno.writeTextFile(
        "examples/import-export-workflow/output/manifest.json",
        JSON.stringify(manifest, null, 2)
    );
    console.log("  ✅ Created manifest.json");
    console.log("  Manifest:", JSON.stringify(manifest, null, 2).split("\n").slice(0, 8).join("\n  "));
} catch (error) {
    console.log(`  ⚠️  Could not create manifest: ${error}`);
}

// Step 9: Summary statistics
console.log("\nStep 9: Export summary");

const stats = {
    snippetsCreated: 4,
    viewsCreated: 2,
    filesExported: 3,
    totalSize: indexContent.length + greetContent.length + stateJson.length,
    manifestSize: JSON.stringify(manifest).length
};

console.log("  Statistics:");
console.log(`    Snippets: ${stats.snippetsCreated}`);
console.log(`    Views: ${stats.viewsCreated}`);
console.log(`    Files exported: ${stats.filesExported}`);
console.log(`    Total size: ${stats.totalSize} bytes`);

console.log("\n=== Demo Complete! ===");
console.log("\nKey takeaways:");
console.log("• Create structured content with snippets");
console.log("• Build views from snippet collections");
console.log("• Render views to code with renderView()");
console.log("• Export to real files with Deno.writeTextFile()");
console.log("• Serialize/deserialize FXD graph state");
console.log("• Create manifests for tracking exports");
console.log("\nCheck the output/ directory for exported files!");
