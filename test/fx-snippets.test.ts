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
  assertStrictEquals,
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

import {
    createSnippet,
    indexSnippet,
    removeSnippetIndex,
    findBySnippetId,
    isSnippet,
    normalizeEol,
    chooseEol,
    simpleHash,
    escapeMarkerValue,
    unescapeMarkerValue,
    makeBegin,
    makeEnd,
    wrapSnippet,
    onSnippetOptionsChanged,
    onSnippetMoved,
    COMMENT
} from "../modules/fx-snippets.ts";

// ═══════════════════════════════════════════════════════════════
// Global Setup (REQUIRED for tests)
// ═══════════════════════════════════════════════════════════════

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

describe("fx-snippets", () => {
    beforeEach(() => {
        // Clear snippet index between tests
        const root = $$("test").node();
        if (root.__nodes) {
            for (const key in root.__nodes) {
                delete root.__nodes[key];
            }
        }
    });

    describe("createSnippet", () => {
        it("should create a snippet with default options", () => {
            const snippet = createSnippet("test.snippet1", "console.log('hello');");
            
            assertEquals(snippet.val(), "console.log('hello');");
            assertEquals(snippet.type(), "snippet");
            
            const meta = snippet.node().__meta;
            assertEquals(meta.id, "test.snippet1");
            assertEquals(meta.lang, "js");
            assertEquals(meta.version, 1);
        });

        it("should create a snippet with custom options", () => {
            const snippet = createSnippet("test.snippet2", "print('hello')", {
                lang: "py",
                file: "main.py",
                id: "custom-id",
                order: 5,
                version: 2
            });
            
            const meta = snippet.node().__meta;
            assertEquals(meta.id, "custom-id");
            assertEquals(meta.lang, "py");
            assertEquals(meta.file, "main.py");
            assertEquals(meta.order, 5);
            assertEquals(meta.version, 2);
        });

        it("should index the snippet automatically", () => {
            createSnippet("test.snippet3", "code", { id: "indexed-snippet" });
            const found = findBySnippetId("indexed-snippet");
            
            assertExists(found);
            assertEquals(found?.id, "indexed-snippet");
            assertEquals(found?.path, "test.snippet3");
        });
    });

    describe("snippet indexing", () => {
        it("should index and find snippets by ID", () => {
            createSnippet("test.s1", "code1", { id: "id1" });
            createSnippet("test.s2", "code2", { id: "id2" });
            
            assertEquals(findBySnippetId("id1")?.path, "test.s1");
            assertEquals(findBySnippetId("id2")?.path, "test.s2");
            assertEquals(findBySnippetId("nonexistent"), null);
        });

        it("should remove snippet from index", () => {
            createSnippet("test.removable", "code", { id: "remove-me" });
            assertExists(findBySnippetId("remove-me"));
            
            removeSnippetIndex("test.removable");
            assertEquals(findBySnippetId("remove-me"), null);
        });

        it("should handle ID changes", () => {
            createSnippet("test.changeable", "code", { id: "old-id" });
            
            onSnippetOptionsChanged("test.changeable", "old-id", "new-id");
            
            assertEquals(findBySnippetId("old-id"), null);
            assertEquals(findBySnippetId("new-id")?.path, "test.changeable");
        });

        it("should handle snippet moves", () => {
            createSnippet("test.old.path", "code", { id: "moving-snippet" });
            
            // Simulate move by creating at new path
            $$("test.new.path").val("code");
            $$("test.new.path").node().__meta = { id: "moving-snippet" };
            
            onSnippetMoved("test.old.path", "test.new.path");
            
            assertEquals(findBySnippetId("moving-snippet")?.path, "test.new.path");
        });
    });

    describe("isSnippet type guard", () => {
        it("should identify valid snippets", () => {
            const snippet = createSnippet("test.valid", "code");
            assertEquals(isSnippet(snippet.node()), true);
        });

        it("should reject non-snippets", () => {
            const regular = $$("test.regular").val("value");
            assertEquals(isSnippet(regular.node()), false);
            
            assertEquals(isSnippet(null), false);
            assertEquals(isSnippet(undefined), false);
            assertEquals(isSnippet({}), false);
            
            // Node with type but no meta
            const partial = $$("test.partial").val("value");
            partial.node().__type = "snippet";
            assertEquals(isSnippet(partial.node()), false);
        });
    });

    describe("text utilities", () => {
        it("should normalize EOL to LF", () => {
            assertEquals(normalizeEol("line1\r\nline2\r\n"), "line1\nline2\n");
            assertEquals(normalizeEol("line1\nline2\n"), "line1\nline2\n");
            assertEquals(normalizeEol("single"), "single");
        });

        it("should choose EOL style", () => {
            assertEquals(chooseEol("lf"), "\n");
            assertEquals(chooseEol("crlf"), "\r\n");
            assertEquals(chooseEol(), "\n"); // default
        });

        it("should generate consistent hashes", () => {
            const hash1 = simpleHash("test content");
            const hash2 = simpleHash("test content");
            const hash3 = simpleHash("different content");
            
            assertEquals(hash1, hash2);
            assertStrictEquals(typeof hash1, "string");
            assertStrictEquals(hash1 === hash3, false);
        });
    });

    describe("marker value escaping", () => {
        it("should escape special characters", () => {
            assertEquals(escapeMarkerValue("hello world"), "hello_world");
            assertEquals(escapeMarkerValue("path\\to\\file"), "path\\\\to\\\\file");
            assertEquals(escapeMarkerValue('name="value"'), 'name\\=\\"value\\"');
            assertEquals(escapeMarkerValue("key=value"), "key\\=value");
        });

        it("should unescape back to original", () => {
            const original = "hello world";
            const escaped = escapeMarkerValue(original);
            assertEquals(unescapeMarkerValue(escaped), original);
            
            const complex = 'path\\to\\file="my value"';
            assertEquals(unescapeMarkerValue(escapeMarkerValue(complex)), complex);
        });
    });

    describe("marker generation", () => {
        it("should create BEGIN markers", () => {
            const marker = makeBegin({ 
                id: "test-id", 
                lang: "js", 
                file: "test.js",
                checksum: "abc123",
                order: 1,
                version: 2
            });
            
            assertEquals(marker, "FX:BEGIN id=test-id lang=js file=test.js checksum=abc123 order=1 version=2");
        });

        it("should create END markers", () => {
            const marker = makeEnd({ id: "test-id" });
            assertEquals(marker, "FX:END id=test-id");
        });

        it("should handle spaces in IDs and filenames", () => {
            const begin = makeBegin({ id: "my snippet", file: "my file.js" });
            assertEquals(begin.includes("id=my_snippet"), true);
            assertEquals(begin.includes("file=my_file.js"), true);
        });
    });

    describe("wrapSnippet", () => {
        it("should wrap with block comments for JS", () => {
            const wrapped = wrapSnippet("test-id", "const x = 1;", "js");
            
            assertEquals(wrapped.includes("/* FX:BEGIN"), true);
            assertEquals(wrapped.includes("FX:END id=test-id */"), true);
            assertEquals(wrapped.includes("const x = 1;"), true);
        });

        it("should wrap with line comments for Python", () => {
            const wrapped = wrapSnippet("py-id", "print('hello')", "py");
            
            assertEquals(wrapped.includes("# FX:BEGIN"), true);
            assertEquals(wrapped.includes("# FX:END"), true);
            assertEquals(wrapped.includes("print('hello')"), true);
        });

        it("should use HTML comments for HTML/XML", () => {
            const wrapped = wrapSnippet("html-id", "<div>test</div>", "html");
            
            assertEquals(wrapped.includes("<!-- FX:BEGIN"), true);
            assertEquals(wrapped.includes("<!-- FX:END"), true);
            assertEquals(wrapped.includes("<div>test</div>"), true);
        });

        it("should include checksum", () => {
            const body = "test content";
            const wrapped = wrapSnippet("id", body, "js");
            const hash = simpleHash(normalizeEol(body));
            
            assertEquals(wrapped.includes(`checksum=${hash}`), true);
        });

        it("should use custom metadata", () => {
            const wrapped = wrapSnippet("id", "code", "js", {
                file: "custom.js",
                order: 5,
                version: 3
            });
            
            assertEquals(wrapped.includes("file=custom.js"), true);
            assertEquals(wrapped.includes("order=5"), true);
            assertEquals(wrapped.includes("version=3"), true);
        });
    });

    describe("COMMENT styles", () => {
        it("should have correct comment styles for all languages", () => {
            // Block comment languages
            ["js", "ts", "jsx", "tsx", "php", "go", "cxx"].forEach(lang => {
                assertEquals(COMMENT[lang].open, "/*");
                assertEquals(COMMENT[lang].close, "*/");
            });
            
            // Line comment only languages
            ["py", "sh"].forEach(lang => {
                assertEquals(COMMENT[lang].line, "#");
                assertEquals(COMMENT[lang].open, undefined);
            });
            
            assertEquals(COMMENT.ini.line, ";");
            
            // HTML/XML
            assertEquals(COMMENT.html.open, "<!--");
            assertEquals(COMMENT.html.close, "-->");
            assertEquals(COMMENT.xml.open, "<!--");
            assertEquals(COMMENT.xml.close, "-->");
        });
    });
});