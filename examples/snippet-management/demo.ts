/**
 * Example: Snippet Management
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.3
 *
 * This example demonstrates the snippet management system:
 * - Creating code snippets with metadata
 * - Wrapping snippets with markers
 * - Finding snippets by ID
 * - Managing snippet versions and checksums
 */

import { $$, $_$$, fx } from "../../fxn.ts";
import {
    createSnippet,
    wrapSnippet,
    findBySnippetId,
    simpleHash,
    isSnippet
} from "../../modules/fx-snippets.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== Snippet Management Demo ===\n");

// Step 1: Create a simple JavaScript snippet
console.log("Step 1: Creating a JavaScript snippet");
const userFunc = createSnippet(
    "snippets.users.findUser",
    `export async function findUser(id) {\n  return db.users.find(u => u.id === id);\n}`,
    { lang: "js", file: "src/users.js", order: 1 }
);
console.log(`  Created snippet: snippets.users.findUser`);
console.log(`  Type: ${userFunc.node().__type}`);
console.log(`  Value: ${userFunc.val()}`);

// Step 2: Create multiple related snippets
console.log("\nStep 2: Creating multiple related snippets");
createSnippet(
    "snippets.users.header",
    `import { db } from './db.js';`,
    { lang: "js", file: "src/users.js", order: 0 }
);

createSnippet(
    "snippets.users.createUser",
    `export async function createUser(data) {\n  return db.users.create(data);\n}`,
    { lang: "js", file: "src/users.js", order: 2 }
);

createSnippet(
    "snippets.users.updateUser",
    `export async function updateUser(id, data) {\n  return db.users.update(id, data);\n}`,
    { lang: "js", file: "src/users.js", order: 3 }
);

console.log("  Created 3 more snippets:");
console.log("    - snippets.users.header (order: 0)");
console.log("    - snippets.users.createUser (order: 2)");
console.log("    - snippets.users.updateUser (order: 3)");

// Step 3: Wrap a snippet with markers for file embedding
console.log("\nStep 3: Wrapping snippet with FX markers");
const code = `function greet(name) {\n  return \`Hello, \${name}!\`;\n}`;
const wrapped = wrapSnippet("greet-func", code, "js", {
    file: "utils/greet.js",
    order: 0
});
console.log("  Wrapped output:");
console.log("  " + wrapped.split("\n").join("\n  "));

// Step 4: Find snippets by ID
console.log("\nStep 4: Finding snippets by ID");
const found = findBySnippetId("snippets.users.findUser");
if (found) {
    console.log(`  Found snippet with ID: ${found.id}`);
    console.log(`  Path: ${found.path}`);
    console.log(`  Value: ${$$(found.path).val()}`);
}

// Step 5: Check if a node is a snippet
console.log("\nStep 5: Type checking with isSnippet()");
const snippetNode = $$("snippets.users.header").node();
const regularNode = $$("some.regular.node").val("not a snippet").node();

console.log(`  isSnippet(snippetNode) => ${isSnippet(snippetNode)}`);
console.log(`  isSnippet(regularNode) => ${isSnippet(regularNode)}`);

// Step 6: Demonstrate checksum functionality
console.log("\nStep 6: Checksum calculation");
const snippet1 = "function test() { return 42; }";
const snippet2 = "function test() { return 43; }";
const hash1 = simpleHash(snippet1);
const hash2 = simpleHash(snippet2);

console.log(`  Hash of "${snippet1}"`);
console.log(`    => ${hash1}`);
console.log(`  Hash of "${snippet2}"`);
console.log(`    => ${hash2}`);
console.log(`  Hashes are different: ${hash1 !== hash2}`);

// Step 7: Create a Python snippet
console.log("\nStep 7: Creating a Python snippet");
createSnippet(
    "snippets.python.hello",
    `def hello(name):\n    return f"Hello, {name}!"`,
    { lang: "py", file: "utils/greet.py", order: 0 }
);

const pyWrapped = wrapSnippet(
    "snippets.python.hello",
    `def hello(name):\n    return f"Hello, {name}!"`,
    "py",
    { file: "utils/greet.py" }
);
console.log("  Python snippet with # comments:");
console.log("  " + pyWrapped.split("\n").join("\n  "));

// Step 8: List all snippets
console.log("\nStep 8: Listing all snippets in snippets.users");
const userSnippets = $$("snippets.users").nodes();
const snippetKeys = Object.keys(userSnippets);
console.log(`  Found ${snippetKeys.length} user snippets:`);
snippetKeys.forEach(key => {
    const node = userSnippets[key].node();
    const meta = (node as any).__meta;
    console.log(`    - ${key}: order=${meta?.order}, lang=${meta?.lang}`);
});

console.log("\n=== Demo Complete! ===");
console.log("\nKey takeaways:");
console.log("• Use createSnippet(path, body, opts) to create snippets");
console.log("• Snippets have metadata: lang, file, order, version");
console.log("• wrapSnippet() adds FX:BEGIN/END markers for embedding");
console.log("• findBySnippetId() enables fast ID-based lookups");
console.log("• isSnippet() checks if a node is a snippet");
console.log("• Checksums help detect changes in snippet content");
