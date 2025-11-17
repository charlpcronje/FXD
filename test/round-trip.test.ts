// ═══════════════════════════════════════════════════════════════
// @agent: agent-test-infra
// @timestamp: 2025-10-02T07:30:00Z
// @task: TRACK-A-TESTS.md#A.1
// @status: in_progress
// @notes: Fixed imports to use fxn.ts, added proper annotations
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Test Framework Imports
// ═══════════════════════════════════════════════════════════════

import {
  assertEquals,
  assertExists,
  assert
} from "https://deno.land/std/assert/mod.ts";
import { beforeEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// ═══════════════════════════════════════════════════════════════
// FX Core Imports
// ═══════════════════════════════════════════════════════════════

import { $$, $_$$, fx } from "../fxn.ts";
import type { FXNode, FXNodeProxy } from "../fxn.ts";

// ═══════════════════════════════════════════════════════════════
// Module Under Test
// ═══════════════════════════════════════════════════════════════

import { createSnippet, wrapSnippet, simpleHash, normalizeEol, clearSnippetIndex } from "../modules/fx-snippets.ts";
import { toPatches, applyPatches, detectConflicts } from "../modules/fx-parse.ts";
import { renderView } from "../modules/fx-view.ts";
import { extendGroups } from "../modules/fx-group-extras.ts";

// ═══════════════════════════════════════════════════════════════
// Global Setup (REQUIRED for tests)
// ═══════════════════════════════════════════════════════════════

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

describe("round-trip editing", () => {
    beforeEach(() => {
        // Clear test namespace
        const root = $$("test").node();
        if (root.__nodes) {
            for (const key in root.__nodes) {
                delete root.__nodes[key];
            }
        }

        // Clear snippet index to prevent test pollution
        clearSnippetIndex();

        // Ensure extensions are loaded
        extendGroups();
    });

    describe("full cycle: create -> render -> edit -> parse -> apply", () => {
        it("should complete a basic round-trip", () => {
            // Step 1: Create snippets
            createSnippet("test.s1", "console.log('original1');", { 
                id: "snippet1", 
                lang: "js" 
            });
            createSnippet("test.s2", "console.log('original2');", { 
                id: "snippet2", 
                lang: "js" 
            });
            
            // Step 2: Create view and render
            const view = $$("test.view").group(["test.s1", "test.s2"]);
            const rendered = renderView("test.view");
            
            // Verify render includes markers
            assertEquals(rendered.includes("FX:BEGIN"), true);
            assertEquals(rendered.includes("FX:END"), true);
            assertEquals(rendered.includes("console.log('original1');"), true);
            assertEquals(rendered.includes("console.log('original2');"), true);
            
            // Step 3: Simulate editing the rendered file
            const edited = rendered
                .replace("console.log('original1');", "console.log('edited1');")
                .replace("console.log('original2');", "console.log('edited2');");
            
            // Step 4: Parse edited content
            const patches = toPatches(edited);
            assertEquals(patches.length, 2);
            assertEquals(patches[0].value, "console.log('edited1');");
            assertEquals(patches[1].value, "console.log('edited2');");
            
            // Step 5: Apply patches back
            applyPatches(patches);
            
            // Step 6: Verify changes persisted
            assertEquals($$("test.s1").val(), "console.log('edited1');");
            assertEquals($$("test.s2").val(), "console.log('edited2');");
        });

        it("should handle multi-language round-trip", () => {
            // Create mixed language snippets
            createSnippet("test.js", "const x = 1;", { id: "js-code", lang: "js" });
            createSnippet("test.py", "x = 1", { id: "py-code", lang: "py" });
            createSnippet("test.html", "<div>test</div>", { id: "html-code", lang: "html" });
            
            // Render view
            const view = $$("test.mixed").group(["test.js", "test.py", "test.html"]);
            const rendered = renderView("test.mixed");
            
            // Check different comment styles
            assertEquals(rendered.includes("/* FX:BEGIN"), true); // JS
            assertEquals(rendered.includes("# FX:BEGIN"), true); // Python
            assertEquals(rendered.includes("<!-- FX:BEGIN"), true); // HTML
            
            // Edit all snippets
            const edited = rendered
                .replace("const x = 1;", "const x = 2;")
                .replace("x = 1", "x = 2")
                .replace("<div>test</div>", "<div>updated</div>");
            
            // Parse and apply
            const patches = toPatches(edited);
            applyPatches(patches);
            
            // Verify all changes
            assertEquals($$("test.js").val(), "const x = 2;");
            assertEquals($$("test.py").val(), "x = 2");
            assertEquals($$("test.html").val(), "<div>updated</div>");
        });

        it("should preserve formatting and indentation", () => {
            const indentedCode = `    function test() {
        if (true) {
            return "nested";
        }
    }`;
            
            createSnippet("test.indent", indentedCode, { id: "indented" });
            
            const view = $$("test.view").group(["test.indent"]);
            const rendered = renderView("test.view");
            
            // Parse without modification
            const patches = toPatches(rendered);
            applyPatches(patches);
            
            // Should preserve exact formatting
            assertEquals($$("test.indent").val(), indentedCode);
        });

        it("should handle new snippet creation", () => {
            // Start with one snippet
            createSnippet("test.existing", "existing code", { id: "existing" });
            
            // Manually create a file with an additional snippet
            const newFile = `/* FX:BEGIN id=existing */
existing code
/* FX:END id=existing */

/* FX:BEGIN id=new-snippet lang=js */
new code
/* FX:END id=new-snippet */`;
            
            // Parse and apply
            const patches = toPatches(newFile);
            assertEquals(patches.length, 2);
            
            applyPatches(patches, { 
                onMissing: "create", 
                orphanRoot: "test.orphans" 
            });
            
            // Existing should be unchanged
            assertEquals($$("test.existing").val(), "existing code");
            
            // New snippet should be created as orphan
            const orphan = $$("test.orphans.new-snippet");
            assertEquals(orphan.val(), "new code");
            assertEquals(orphan.node().__meta?.id, "new-snippet");
        });

        it("should detect and handle conflicts", () => {
            const original = "original content";
            createSnippet("test.conflict", original, { id: "conflict-test" });
            
            // Get original checksum
            const originalChecksum = simpleHash(normalizeEol(original));
            
            // Simulate concurrent edit (someone else changed it)
            $$("test.conflict").val("concurrent edit");
            
            // Try to apply patch with old checksum
            const fileWithOldChecksum = `/* FX:BEGIN id=conflict-test checksum=${originalChecksum} */
my edit
/* FX:END id=conflict-test */`;
            
            const patches = toPatches(fileWithOldChecksum);
            const conflicts = detectConflicts(patches);
            
            assertEquals(conflicts.hasConflicts, true);
            assertEquals(conflicts.conflicts.length, 1);
            assertEquals(conflicts.conflicts[0].id, "conflict-test");
            
            // Apply anyway (Phase-1 behavior)
            applyPatches(patches);
            assertEquals($$("test.conflict").val(), "my edit");
        });

        it("should handle snippet deletion scenario", () => {
            // Create multiple snippets
            createSnippet("test.keep1", "keep this 1", { id: "keep1" });
            createSnippet("test.delete", "delete this", { id: "delete" });
            createSnippet("test.keep2", "keep this 2", { id: "keep2" });
            
            // Render view
            const view = $$("test.view").group(["test.keep1", "test.delete", "test.keep2"]);
            const rendered = renderView("test.view");
            
            // Remove middle snippet from rendered output
            const lines = rendered.split("\n");
            const deleteStart = lines.findIndex(l => l.includes("id=delete"));
            const deleteEnd = lines.findIndex((l, i) => i > deleteStart && l.includes("FX:END") && l.includes("delete"));
            const edited = [...lines.slice(0, deleteStart), ...lines.slice(deleteEnd + 1)].join("\n");
            
            // Parse edited (should only have 2 snippets)
            const patches = toPatches(edited);
            assertEquals(patches.length, 2);
            assertEquals(patches.find(p => p.id === "delete"), undefined);
            
            // Apply patches
            applyPatches(patches);
            
            // Deleted snippet still exists but wasn't updated
            assertEquals($$("test.delete").val(), "delete this");
            assertEquals($$("test.keep1").val(), "keep this 1");
            assertEquals($$("test.keep2").val(), "keep this 2");
        });

        it("should handle reordering", () => {
            createSnippet("test.a", "aaa", { id: "a", order: 1 });
            createSnippet("test.b", "bbb", { id: "b", order: 2 });
            createSnippet("test.c", "ccc", { id: "c", order: 3 });
            
            const view = $$("test.ordered").group(["test.a", "test.b", "test.c"]);
            view.sortByOrder();
            const rendered = renderView("test.ordered");
            
            // Verify initial order
            const aPos = rendered.indexOf("aaa");
            const bPos = rendered.indexOf("bbb");
            const cPos = rendered.indexOf("ccc");
            assertEquals(aPos < bPos, true);
            assertEquals(bPos < cPos, true);
            
            // Manually reorder in the "file"
            const reordered = `/* FX:BEGIN id=c */
ccc
/* FX:END id=c */

/* FX:BEGIN id=a */
aaa
/* FX:END id=a */

/* FX:BEGIN id=b */
bbb
/* FX:END id=b */`;
            
            // Parse reordered content
            const patches = toPatches(reordered);
            
            // Order in patches array reflects new order
            assertEquals(patches[0].id, "c");
            assertEquals(patches[1].id, "a");
            assertEquals(patches[2].id, "b");
            
            // Content is unchanged
            assertEquals(patches[0].value, "ccc");
            assertEquals(patches[1].value, "aaa");
            assertEquals(patches[2].value, "bbb");
        });
    });

    describe("error recovery", () => {
        it("should handle corrupted markers gracefully", () => {
            const corrupted = `/* FX:BEGIN id=test */
code
/* FX:END wrong format */

/* FX:BEGIN missing end
more code`;
            
            const patches = toPatches(corrupted);
            
            // Should extract nothing due to malformed markers
            assertEquals(patches.length, 0);
        });

        it("should preserve non-marked content", () => {
            const mixed = `// Regular code before markers
const x = 1;

/* FX:BEGIN id=marked */
marked code
/* FX:END id=marked */

// Regular code after markers
const y = 2;`;
            
            const patches = toPatches(mixed);
            
            // Should only extract marked snippet
            assertEquals(patches.length, 1);
            assertEquals(patches[0].id, "marked");
            assertEquals(patches[0].value, "marked code");
            
            // Non-marked content is ignored (not extracted)
        });

        it("should handle nested comment-like content", () => {
            const nested = `/* FX:BEGIN id=nested */
// This looks like a comment marker but it's not: FX:BEGIN
/* This also looks like FX:END but it's content */
const code = "/* FX:END */"; // Not a real end marker
/* FX:END id=nested */`;
            
            const patches = toPatches(nested);
            
            assertEquals(patches.length, 1);
            assertEquals(patches[0].value.includes("FX:BEGIN"), true);
            assertEquals(patches[0].value.includes("FX:END"), true);
        });
    });

    describe("checksum validation", () => {
        it("should generate correct checksums", () => {
            const content = "test content\nwith newlines";
            createSnippet("test.cs", content, { id: "checksum-test" });
            
            const wrapped = wrapSnippet("checksum-test", content, "js");
            const expectedChecksum = simpleHash(normalizeEol(content));
            
            assertEquals(wrapped.includes(`checksum=${expectedChecksum}`), true);
            
            // Parse and verify checksum is preserved
            const patches = toPatches(wrapped);
            assertEquals(patches[0].checksum, expectedChecksum);
        });

        it("should validate checksums on apply", () => {
            const original = "original";
            createSnippet("test.validate", original, { id: "validate" });
            
            // Change content directly
            $$("test.validate").val("changed");
            
            // Try to apply patch with old checksum
            const oldChecksum = simpleHash(normalizeEol(original));
            const patch = {
                id: "validate",
                value: "new value",
                checksum: oldChecksum
            };
            
            // Detect conflict
            const conflicts = detectConflicts([patch]);
            assertEquals(conflicts.hasConflicts, true);
            
            // Phase-1 still applies despite conflict
            applyPatches([patch]);
            assertEquals($$("test.validate").val(), "new value");
        });
    });

    describe("group extensions round-trip", () => {
        it("should work with fromText method", () => {
            // Create snippets
            createSnippet("test.s1", "code1", { id: "s1" });
            createSnippet("test.s2", "code2", { id: "s2" });
            
            // Create text with patches
            const text = `/* FX:BEGIN id=s1 */
modified1
/* FX:END id=s1 */

/* FX:BEGIN id=s2 */
modified2
/* FX:END id=s2 */`;
            
            // Use fromText to create group from patches
            const group = $$("test.fromtext").group().fromText(text);
            const items = group.list();
            
            assertEquals(items.length, 2);
            
            // Apply the patches from the text
            const patches = toPatches(text);
            applyPatches(patches);
            
            // Verify updates
            assertEquals($$("test.s1").val(), "modified1");
            assertEquals($$("test.s2").val(), "modified2");
        });

        it("should work with concatWithMarkers", async () => {
            createSnippet("test.s1", "original1", { id: "s1", lang: "js" });
            createSnippet("test.s2", "original2", { id: "s2", lang: "py" });
            
            const group = $$("test.group").group(["test.s1", "test.s2"]);
            const concatenated = await group.concatWithMarkers();
            
            // Parse the concatenated output
            const patches = toPatches(concatenated);
            
            assertEquals(patches.length, 2);
            assertEquals(patches[0].value, "original1");
            assertEquals(patches[1].value, "original2");
            
            // Modify and re-apply
            patches[0].value = "modified1";
            patches[1].value = "modified2";
            applyPatches(patches);
            
            assertEquals($$("test.s1").val(), "modified1");
            assertEquals($$("test.s2").val(), "modified2");
        });
    });

    describe("version tracking", () => {
        it("should preserve version through round-trip", () => {
            // Test version preservation for orphan creation
            // Use an ID that doesn't already exist
            const wrapped = wrapSnippet("orphan-with-version", "content", "js", { version: 3 });
            assertEquals(wrapped.includes("version=3"), true);

            const patches = toPatches(wrapped);
            assertEquals(patches[0].version, 3);

            // Apply to new location - should create orphan since ID doesn't exist
            applyPatches(patches, {
                onMissing: "create",
                orphanRoot: "test.versions"
            });

            const orphan = $$("test.versions.orphan-with-version");
            assertEquals(orphan.node().__meta?.version, 3);
        });

        it("should handle version updates", () => {
            createSnippet("test.update", "v1 content", { id: "update", version: 1 });
            
            // Simulate version bump in edited file
            const edited = `/* FX:BEGIN id=update version=2 */
v2 content
/* FX:END id=update */`;
            
            const patches = toPatches(edited);
            assertEquals(patches[0].version, 2);
            
            applyPatches(patches);
            
            assertEquals($$("test.update").val(), "v2 content");
            // Note: Current implementation doesn't update version on existing snippets
            // This would be a Phase-2 feature
        });
    });
});