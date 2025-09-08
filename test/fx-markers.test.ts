import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { beforeEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { 
    wrapSnippet,
    makeBegin,
    makeEnd,
    escapeMarkerValue,
    unescapeMarkerValue,
    COMMENT
} from "../modules/fx-snippets.ts";

describe("fx-markers", () => {
    describe("marker formatting", () => {
        it("should format markers consistently across languages", () => {
            const languages = ["js", "ts", "py", "sh", "html", "xml", "php", "go"];
            const id = "test-snippet";
            const body = "test code";
            
            languages.forEach(lang => {
                const wrapped = wrapSnippet(id, body, lang);
                
                // Should contain BEGIN and END markers
                assertEquals(wrapped.includes("FX:BEGIN"), true, `Missing BEGIN for ${lang}`);
                assertEquals(wrapped.includes("FX:END"), true, `Missing END for ${lang}`);
                assertEquals(wrapped.includes(id), true, `Missing ID for ${lang}`);
                assertEquals(wrapped.includes(body), true, `Missing body for ${lang}`);
            });
        });

        it("should preserve body content exactly", () => {
            const bodies = [
                "const x = 1;",
                "  indented code",
                "multi\nline\ncode",
                "code with /* comments */",
                "code with // comments",
                "code with 'quotes' and \"double quotes\"",
                "code with special chars: @#$%^&*()"
            ];
            
            bodies.forEach(body => {
                const wrapped = wrapSnippet("id", body, "js");
                assertEquals(wrapped.includes(body), true);
            });
        });

        it("should handle empty bodies", () => {
            const wrapped = wrapSnippet("empty", "", "js");
            assertEquals(wrapped.includes("FX:BEGIN"), true);
            assertEquals(wrapped.includes("FX:END"), true);
        });
    });

    describe("comment style selection", () => {
        it("should use block comments for C-style languages", () => {
            const wrapped = wrapSnippet("id", "code", "js");
            assertEquals(wrapped.startsWith("/*"), true);
            assertEquals(wrapped.includes("*/\ncode\n/*"), true);
            assertEquals(wrapped.endsWith("*/"), true);
        });

        it("should use line comments for shell languages", () => {
            const wrapped = wrapSnippet("id", "code", "sh");
            assertEquals(wrapped.startsWith("#"), true);
            const lines = wrapped.split("\n");
            assertEquals(lines[0].startsWith("#"), true);
            assertEquals(lines[lines.length - 1].startsWith("#"), true);
        });

        it("should use HTML comments for markup languages", () => {
            const wrapped = wrapSnippet("id", "code", "html");
            assertEquals(wrapped.startsWith("<!--"), true);
            assertEquals(wrapped.includes("-->\ncode\n<!--"), true);
            assertEquals(wrapped.endsWith("-->"), true);
        });

        it("should fall back to JS style for unknown languages", () => {
            const wrapped = wrapSnippet("id", "code", "unknown");
            assertEquals(wrapped.startsWith("/*"), true);
        });
    });

    describe("marker attributes", () => {
        it("should include all provided attributes", () => {
            const marker = makeBegin({
                id: "full-test",
                lang: "js",
                file: "test.js",
                checksum: "abc123",
                order: 5,
                version: 2
            });
            
            assertEquals(marker.includes("id=full-test"), true);
            assertEquals(marker.includes("lang=js"), true);
            assertEquals(marker.includes("file=test.js"), true);
            assertEquals(marker.includes("checksum=abc123"), true);
            assertEquals(marker.includes("order=5"), true);
            assertEquals(marker.includes("version=2"), true);
        });

        it("should handle optional attributes", () => {
            const marker = makeBegin({ id: "minimal" });
            assertEquals(marker.includes("id=minimal"), true);
            assertEquals(marker.includes("version=1"), true); // default version
            
            // Optional attrs should not appear
            assertEquals(marker.includes("lang="), false);
            assertEquals(marker.includes("file="), false);
            assertEquals(marker.includes("order="), false);
        });

        it("should preserve attribute order", () => {
            const marker = makeBegin({
                id: "ordered",
                lang: "js",
                file: "test.js",
                checksum: "hash",
                order: 1,
                version: 2
            });
            
            const idIndex = marker.indexOf("id=");
            const langIndex = marker.indexOf("lang=");
            const fileIndex = marker.indexOf("file=");
            const checksumIndex = marker.indexOf("checksum=");
            const orderIndex = marker.indexOf("order=");
            const versionIndex = marker.indexOf("version=");
            
            assertEquals(idIndex < langIndex, true);
            assertEquals(langIndex < fileIndex, true);
            assertEquals(fileIndex < checksumIndex, true);
            assertEquals(checksumIndex < orderIndex, true);
            assertEquals(orderIndex < versionIndex, true);
        });
    });

    describe("special character handling", () => {
        it("should escape spaces in IDs", () => {
            const marker = makeBegin({ id: "my snippet id" });
            assertEquals(marker.includes("id=my_snippet_id"), true);
        });

        it("should escape paths with spaces", () => {
            const marker = makeBegin({ 
                id: "test",
                file: "my folder/my file.js" 
            });
            assertEquals(marker.includes("file=my_folder/my_file.js"), true);
        });

        it("should escape equals signs", () => {
            const escaped = escapeMarkerValue("key=value");
            assertEquals(escaped, "key\\=value");
            assertEquals(unescapeMarkerValue(escaped), "key=value");
        });

        it("should escape quotes", () => {
            const escaped = escapeMarkerValue('say "hello"');
            assertEquals(escaped, 'say_\\"hello\\"');
            assertEquals(unescapeMarkerValue(escaped), 'say "hello"');
        });

        it("should escape backslashes", () => {
            const escaped = escapeMarkerValue("path\\to\\file");
            assertEquals(escaped, "path\\\\to\\\\file");
            assertEquals(unescapeMarkerValue(escaped), "path\\to\\file");
        });

        it("should handle complex escaping", () => {
            const complex = 'path\\to\\my file="config.json"';
            const escaped = escapeMarkerValue(complex);
            const unescaped = unescapeMarkerValue(escaped);
            assertEquals(unescaped, complex);
        });
    });

    describe("END marker", () => {
        it("should only include ID", () => {
            const marker = makeEnd({ id: "test-id" });
            assertEquals(marker, "FX:END id=test-id");
        });

        it("should escape ID properly", () => {
            const marker = makeEnd({ id: "my test id" });
            assertEquals(marker, "FX:END id=my_test_id");
        });
    });

    describe("marker extraction regex compatibility", () => {
        it("should create parseable BEGIN markers", () => {
            const marker = makeBegin({ 
                id: "regex-test",
                lang: "js",
                checksum: "abc123"
            });
            
            const regex = /^FX:BEGIN\s+(.+)$/;
            const match = marker.match(regex);
            assertExists(match);
            assertEquals(match[1].includes("id=regex-test"), true);
        });

        it("should create parseable END markers", () => {
            const marker = makeEnd({ id: "regex-test" });
            
            const regex = /^FX:END\s+id=([^\s]+)\s*$/;
            const match = marker.match(regex);
            assertExists(match);
            assertEquals(match[1], "regex-test");
        });
    });

    describe("version handling", () => {
        it("should default to version 1", () => {
            const marker = makeBegin({ id: "test" });
            assertEquals(marker.includes("version=1"), true);
        });

        it("should use specified version", () => {
            const marker = makeBegin({ id: "test", version: 3 });
            assertEquals(marker.includes("version=3"), true);
        });

        it("should include version in wrapSnippet", () => {
            const wrapped = wrapSnippet("id", "code", "js", { version: 2 });
            assertEquals(wrapped.includes("version=2"), true);
        });
    });

    describe("checksum integration", () => {
        it("should generate consistent checksums", () => {
            const body = "test content";
            const wrapped1 = wrapSnippet("id1", body, "js");
            const wrapped2 = wrapSnippet("id2", body, "js");
            
            // Extract checksums
            const checksum1 = wrapped1.match(/checksum=([^\s]+)/)?.[1];
            const checksum2 = wrapped2.match(/checksum=([^\s]+)/)?.[1];
            
            assertExists(checksum1);
            assertExists(checksum2);
            assertEquals(checksum1, checksum2);
        });

        it("should use provided checksum over generated", () => {
            const wrapped = wrapSnippet("id", "code", "js", { 
                checksum: "custom-hash" 
            });
            assertEquals(wrapped.includes("checksum=custom-hash"), true);
        });
    });

    describe("multi-line content", () => {
        it("should preserve line breaks in body", () => {
            const body = "line1\nline2\nline3";
            const wrapped = wrapSnippet("id", body, "js");
            assertEquals(wrapped.includes(body), true);
        });

        it("should handle CRLF line endings", () => {
            const body = "line1\r\nline2\r\nline3";
            const wrapped = wrapSnippet("id", body, "js");
            // Body should be preserved as-is
            assertEquals(wrapped.includes(body), true);
        });
    });
});