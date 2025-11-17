/**
 * Example: Repo JS Demo
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.1
 *
 * Demonstrates: render -> parse -> applyPatches -> render again.
 */

import { $$, $_$$, fx } from "../../fxn.ts";
import { renderView } from "../../modules/fx-view.ts";
import { toPatches, applyPatches } from "../../modules/fx-parse.ts";
import { seedRepoSnippets } from "./seed.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// 1) Seed some snippets + view
seedRepoSnippets();

// 2) Render the view as a file
const text1 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- Initial Render ---\n");
console.log(text1);

// 3) Simulate editor change
const textEdited = text1.replace("findUser", "findUserById");

// 4) Parse edits into patches
const patches = toPatches(textEdited);
console.log("\n--- Patches ---\n");
console.log(JSON.stringify(patches, null, 2));

// 5) Apply patches back into FX graph
applyPatches(patches);

// 6) Render again → should reflect the change
const text2 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- After Apply ---\n");
console.log(text2);
