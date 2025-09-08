import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { beforeEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { 
    toPatches, 
    applyPatches,
    applyPatchesBatch,
    detectConflicts,
    type Patch
} from "../modules/fx-parse.ts";
import { createSnippet, normalizeEol, simpleHash } from "../modules/fx-snippets.ts";

// Import and initialize FX
import { $$, $_$$ } from "../fx.ts";

// Make FX available globally
globalThis.$$ = $$;
globalThis.$ = $_$$;

describe("fx-parse", () => {
    beforeEach(() => {
        // Clear test namespace
        const root = $$("test").node();
        if (root.__nodes) {
            for (const key in root.__nodes) {
                delete root.__nodes[key];
            }
        }
    });

    describe("toPatches", () => {
        it("should parse basic wrapped snippet", () => {
            const text = `/* FX:BEGIN id=test-id lang=js checksum=abc123 version=1 */
const x = 1;
/* FX:END id=test-id */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches.length, 1);
            assertEquals(patches[0].id, "test-id");
            assertEquals(patches[0].value, "const x = 1;");
            assertEquals(patches[0].checksum, "abc123");
            assertEquals(patches[0].version, 1);
        });

        it("should parse multiple snippets", () => {
            const text = `/* FX:BEGIN id=s1 */
code1
/* FX:END id=s1 */

/* FX:BEGIN id=s2 */
code2
/* FX:END id=s2 */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches.length, 2);
            assertEquals(patches[0].id, "s1");
            assertEquals(patches[0].value, "code1");
            assertEquals(patches[1].id, "s2");
            assertEquals(patches[1].value, "code2");
        });

        it("should handle different comment styles", () => {
            const text = `# FX:BEGIN id=py-snippet
print("hello")
# FX:END id=py-snippet

// FX:BEGIN id=js-snippet
console.log("hello");
// FX:END id=js-snippet

<!-- FX:BEGIN id=html-snippet -->
<div>hello</div>
<!-- FX:END id=html-snippet -->`;
            
            const patches = toPatches(text);
            
            assertEquals(patches.length, 3);
            assertEquals(patches[0].id, "py-snippet");
            assertEquals(patches[1].id, "js-snippet");
            assertEquals(patches[2].id, "html-snippet");
        });

        it("should preserve indentation in body", () => {
            const text = `/* FX:BEGIN id=indented */
    function test() {
        return true;
    }
/* FX:END id=indented */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches[0].value, "    function test() {\n        return true;\n    }");
        });

        it("should handle empty snippets", () => {
            const text = `/* FX:BEGIN id=empty */
/* FX:END id=empty */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches.length, 1);
            assertEquals(patches[0].id, "empty");
            assertEquals(patches[0].value, "");
        });

        it("should parse attributes correctly", () => {
            const text = `/* FX:BEGIN id=full lang=js file=test.js checksum=hash order=5 version=2 */
code
/* FX:END id=full */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches[0].id, "full");
            assertEquals(patches[0].checksum, "hash");
            assertEquals(patches[0].version, 2);
        });

        it("should handle malformed markers gracefully", () => {
            const text = `/* FX:BEGIN id=test */
code
/* Wrong END marker */
more code`;
            
            const patches = toPatches(text);
            
            // Should not extract incomplete snippet
            assertEquals(patches.length, 0);
        });

        it("should only treat lines with FX markers as metadata", () => {
            const text = `/* FX:BEGIN id=test */
// This is a regular comment, not a marker
/* This is also a regular comment */
const code = 1;
/* FX:END id=test */`;
            
            const patches = toPatches(text);
            
            assertEquals(patches[0].value.includes("// This is a regular comment"), true);
            assertEquals(patches[0].value.includes("/* This is also a regular comment */"), true);
        });
    });

    describe("applyPatches", () => {
        it("should apply patches to existing snippets", () => {
            createSnippet("test.s1", "old content", { id: "s1" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new content" }
            ];
            
            applyPatches(patches);
            
            assertEquals($$("test.s1").val(), "new content");
        });

        it("should create orphan snippets for missing IDs", () => {
            const patches: Patch[] = [
                { id: "orphan-id", value: "orphan content", version: 2 }
            ];
            
            applyPatches(patches, { orphanRoot: "test.orphans" });
            
            const orphan = $$("test.orphans.orphan-id");
            assertEquals(orphan.val(), "orphan content");
            assertEquals(orphan.node().__meta?.version, 2);
        });

        it("should skip missing snippets when configured", () => {
            const patches: Patch[] = [
                { id: "missing", value: "content" }
            ];
            
            applyPatches(patches, { onMissing: "skip" });
            
            // Should not create orphan
            assertEquals($$("snippets.orphans.missing").val(), undefined);
        });

        it("should detect checksum mismatches", () => {
            createSnippet("test.s1", "original", { id: "s1" });
            
            const wrongChecksum = "wronghash";
            const patches: Patch[] = [
                { id: "s1", value: "modified", checksum: wrongChecksum }
            ];
            
            // Should still apply despite mismatch in Phase-1
            applyPatches(patches);
            assertEquals($$("test.s1").val(), "modified");
        });

        it("should sanitize IDs for orphan paths", () => {
            const patches: Patch[] = [
                { id: "id/with/slashes", value: "content" }
            ];
            
            applyPatches(patches, { orphanRoot: "test.safe" });
            
            const orphan = $$("test.safe.id_with_slashes");
            assertEquals(orphan.val(), "content");
        });
    });

    describe("applyPatchesBatch", () => {
        it("should apply multiple patches successfully", () => {
            createSnippet("test.s1", "old1", { id: "s1" });
            createSnippet("test.s2", "old2", { id: "s2" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new1" },
                { id: "s2", value: "new2" }
            ];
            
            const result = applyPatchesBatch(patches);
            
            assertEquals(result.succeeded.length, 2);
            assertEquals(result.failed.length, 0);
            assertEquals($$("test.s1").val(), "new1");
            assertEquals($$("test.s2").val(), "new2");
        });

        it("should validate before applying when configured", () => {
            // Don't create s2
            createSnippet("test.s1", "old1", { id: "s1" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new1" },
                { id: "s2", value: "new2" }
            ];
            
            const result = applyPatchesBatch(patches, { 
                onMissing: "skip",
                validateFirst: true 
            });
            
            assertEquals(result.succeeded.length, 1);
            assertEquals(result.failed.length, 1);
            assertEquals(result.failed[0].patch.id, "s2");
        });

        it("should rollback all changes in transaction mode", () => {
            createSnippet("test.s1", "original1", { id: "s1" });
            createSnippet("test.s2", "original2", { id: "s2" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new1" },
                { id: "s2", value: "new2" },
                { id: "missing", value: "fail" } // This will fail
            ];
            
            const result = applyPatchesBatch(patches, { 
                transaction: true,
                onMissing: "skip" 
            });
            
            assertEquals(result.succeeded.length, 0);
            assertEquals(result.failed.length, 3); // All marked as failed
            assertEquals(result.rollbackAvailable, true);
            
            // Values should be unchanged
            assertEquals($$("test.s1").val(), "original1");
            assertEquals($$("test.s2").val(), "original2");
        });

        it("should continue on error in non-transaction mode", () => {
            createSnippet("test.s1", "old1", { id: "s1" });
            createSnippet("test.s3", "old3", { id: "s3" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new1" },
                { id: "missing", value: "fail" },
                { id: "s3", value: "new3" }
            ];
            
            const result = applyPatchesBatch(patches, { 
                transaction: false,
                onMissing: "skip" 
            });
            
            assertEquals(result.succeeded.length, 2);
            assertEquals(result.failed.length, 1);
            assertEquals($$("test.s1").val(), "new1");
            assertEquals($$("test.s3").val(), "new3");
        });

        it("should handle checksum validation", () => {
            const content = "original";
            createSnippet("test.s1", content, { id: "s1" });
            
            const correctHash = simpleHash(normalizeEol(content));
            const wrongHash = "wronghash";
            
            const patches: Patch[] = [
                { id: "s1", value: "new", checksum: wrongHash }
            ];
            
            // Non-transaction mode: applies despite mismatch
            const result1 = applyPatchesBatch(patches, { transaction: false });
            assertEquals(result1.succeeded.length, 1);
            assertEquals($$("test.s1").val(), "new");
            
            // Reset
            $$("test.s1").val(content);
            
            // Transaction mode: fails on mismatch
            const result2 = applyPatchesBatch(patches, { transaction: true });
            assertEquals(result2.succeeded.length, 0);
            assertEquals(result2.failed.length, 1);
            assertEquals($$("test.s1").val(), content); // Unchanged
        });

        it("should create orphans when configured", () => {
            const patches: Patch[] = [
                { id: "new1", value: "content1", version: 2 },
                { id: "new2", value: "content2", version: 3 }
            ];
            
            const result = applyPatchesBatch(patches, {
                onMissing: "create",
                orphanRoot: "test.batch.orphans"
            });
            
            assertEquals(result.succeeded.length, 2);
            assertEquals($$("test.batch.orphans.new1").val(), "content1");
            assertEquals($$("test.batch.orphans.new2").val(), "content2");
            assertEquals($$("test.batch.orphans.new1").node().__meta?.version, 2);
            assertEquals($$("test.batch.orphans.new2").node().__meta?.version, 3);
        });
    });

    describe("detectConflicts", () => {
        it("should detect no conflicts when checksums match", () => {
            const content = "unchanged";
            createSnippet("test.s1", content, { id: "s1" });
            
            const checksum = simpleHash(normalizeEol(content));
            const patches: Patch[] = [
                { id: "s1", value: "new", checksum }
            ];
            
            const result = detectConflicts(patches);
            
            assertEquals(result.hasConflicts, false);
            assertEquals(result.conflicts.length, 0);
        });

        it("should detect conflicts when checksums don't match", () => {
            createSnippet("test.s1", "current", { id: "s1" });
            
            const patches: Patch[] = [
                { id: "s1", value: "incoming", checksum: "oldhash" }
            ];
            
            const result = detectConflicts(patches);
            
            assertEquals(result.hasConflicts, true);
            assertEquals(result.conflicts.length, 1);
            assertEquals(result.conflicts[0].id, "s1");
            assertEquals(result.conflicts[0].remoteChecksum, "oldhash");
        });

        it("should ignore patches without checksums", () => {
            createSnippet("test.s1", "content", { id: "s1" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new" } // No checksum
            ];
            
            const result = detectConflicts(patches);
            
            assertEquals(result.hasConflicts, false);
            assertEquals(result.conflicts.length, 0);
        });

        it("should handle multiple conflicts", () => {
            createSnippet("test.s1", "current1", { id: "s1" });
            createSnippet("test.s2", "current2", { id: "s2" });
            createSnippet("test.s3", "current3", { id: "s3" });
            
            const patches: Patch[] = [
                { id: "s1", value: "new1", checksum: "wrong1" },
                { id: "s2", value: "new2", checksum: simpleHash("current2") }, // Correct
                { id: "s3", value: "new3", checksum: "wrong3" }
            ];
            
            const result = detectConflicts(patches);
            
            assertEquals(result.hasConflicts, true);
            assertEquals(result.conflicts.length, 2);
            assertEquals(result.conflicts.map(c => c.id).sort(), ["s1", "s3"]);
        });

        it("should skip missing snippets", () => {
            const patches: Patch[] = [
                { id: "nonexistent", value: "new", checksum: "hash" }
            ];
            
            const result = detectConflicts(patches);
            
            assertEquals(result.hasConflicts, false);
            assertEquals(result.conflicts.length, 0);
        });
    });

    describe("round-trip parsing", () => {
        it("should preserve content through parse and apply", () => {
            // Create original snippet
            const originalContent = `function test() {
    return "hello";
}`;
            createSnippet("test.rt", originalContent, { id: "roundtrip" });
            
            // Wrap it with markers
            const wrapped = `/* FX:BEGIN id=roundtrip */
${originalContent}
/* FX:END id=roundtrip */`;
            
            // Parse wrapped content
            const patches = toPatches(wrapped);
            
            // Apply back
            applyPatches(patches);
            
            // Should have same content
            assertEquals($$("test.rt").val(), originalContent);
        });

        it("should handle modified content", () => {
            createSnippet("test.mod", "original", { id: "modify" });
            
            const modified = `/* FX:BEGIN id=modify checksum=newhash */
modified content
/* FX:END id=modify */`;
            
            const patches = toPatches(modified);
            applyPatches(patches);
            
            assertEquals($$("test.mod").val(), "modified content");
        });

        it("should preserve multi-line content exactly", () => {
            const multiline = `line 1
    indented line 2
        more indented line 3
line 4`;
            
            createSnippet("test.multi", "old", { id: "multi" });
            
            const wrapped = `// FX:BEGIN id=multi
${multiline}
// FX:END id=multi`;
            
            const patches = toPatches(wrapped);
            applyPatches(patches);
            
            assertEquals($$("test.multi").val(), multiline);
        });
    });
});