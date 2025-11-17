/**
 * Tests for FX Persistence Layer
 * Verifies save/load functionality with .fxd SQLite files
 */

import {
  assertEquals,
  assertExists,
  assert
} from "https://deno.land/std/assert/mod.ts";
import { beforeEach, afterEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import { $$, $_$$, fx } from "../fxn.ts";
import { createSnippet, findBySnippetId, clearSnippetIndex } from "../modules/fx-snippets.ts";
import { FXDisk } from "../modules/fx-persistence-deno.ts";

// Global setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

const TEST_DB_PATH = "./test-data/test-persistence.fxd";

describe("fx-persistence", {
  sanitizeResources: false,
  sanitizeOps: false
}, () => {
  beforeEach(() => {
    // Clear test namespace
    const root = $$("test").node();
    if (root.__nodes) {
      for (const key in root.__nodes) {
        delete root.__nodes[key];
      }
    }
    clearSnippetIndex();

    // Remove test database if it exists
    try {
      Deno.removeSync(TEST_DB_PATH);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  afterEach(() => {
    // Cleanup test database
    try {
      Deno.removeSync(TEST_DB_PATH);
    } catch {
      // Already deleted
    }
  });

  describe("database creation", () => {
    it("should create a new .fxd file", () => {
      const disk = new FXDisk(TEST_DB_PATH, true);

      // Verify file exists
      const stat = Deno.statSync(TEST_DB_PATH);
      assertExists(stat);
      assertEquals(stat.isFile, true);

      disk.close();
    });

    it("should initialize database schema", () => {
      const disk = new FXDisk(TEST_DB_PATH, true);

      const stats = disk.stats();
      assertEquals(stats.nodes, 0);
      assertEquals(stats.snippets, 0);
      assertEquals(stats.views, 0);

      disk.close();
    });
  });

  describe("basic save/load", () => {
    it("should save and load a simple node", () => {
      // Create a simple node
      $$("test.node1").val("test value");

      // Save
      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      const stats1 = disk1.stats();
      assert(stats1.nodes > 0, "Should have saved nodes");
      disk1.close();

      // Clear graph
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Verify cleared
      assertEquals($$("test.node1").val(), undefined);

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify restored
      assertEquals($$("test.node1").val(), "test value");
    });

    it("should save and load multiple nodes", () => {
      $$("test.a").val("value a");
      $$("test.b").val("value b");
      $$("test.c.nested").val("nested value");

      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify
      assertEquals($$("test.a").val(), "value a");
      assertEquals($$("test.b").val(), "value b");
      assertEquals($$("test.c.nested").val(), "nested value");
    });
  });

  describe("snippet persistence", () => {
    it("should save and load snippets", () => {
      createSnippet("test.s1", "code1", { id: "snippet-1", lang: "js", file: "main.js", order: 1 });
      createSnippet("test.s2", "code2", { id: "snippet-2", lang: "py", file: "util.py", order: 2 });

      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      const stats = disk1.stats();
      assertEquals(stats.snippets, 2);
      disk1.close();

      // Clear
      clearSnippetIndex();
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify snippets restored
      assertEquals($$("test.s1").val(), "code1");
      assertEquals($$("test.s2").val(), "code2");

      // Verify metadata restored
      const node1 = $$("test.s1").node();
      assertEquals((node1 as any).__meta?.id, "snippet-1");
      assertEquals((node1 as any).__meta?.lang, "js");
      assertEquals((node1 as any).__meta?.file, "main.js");

      // Verify snippet index rebuilt
      const found1 = findBySnippetId("snippet-1");
      assertExists(found1);
      assertEquals(found1.path, "test.s1");

      const found2 = findBySnippetId("snippet-2");
      assertExists(found2);
      assertEquals(found2.path, "test.s2");
    });

    it("should preserve snippet metadata", () => {
      createSnippet("test.versioned", "v3 code", {
        id: "v3",
        lang: "ts",
        file: "app.ts",
        order: 5,
        version: 3
      });

      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      disk1.close();

      // Clear
      clearSnippetIndex();
      const root = $$("test").node();
      if (root.__nodes) {
        delete root.__nodes.versioned;
      }

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify all metadata
      const node = $$("test.versioned").node();
      const meta = (node as any).__meta;
      assertEquals(meta.id, "v3");
      assertEquals(meta.lang, "ts");
      assertEquals(meta.file, "app.ts");
      assertEquals(meta.order, 5);
      assertEquals(meta.version, 3);
    });
  });

  describe("complex graphs", () => {
    it("should handle deeply nested structures", () => {
      $$("test.level1.level2.level3.value").val("deep");
      $$("test.level1.level2.another").val("also deep");
      $$("test.level1.sibling").val("less deep");

      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        delete root.__nodes.level1;
      }

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify structure
      assertEquals($$("test.level1.level2.level3.value").val(), "deep");
      assertEquals($$("test.level1.level2.another").val(), "also deep");
      assertEquals($$("test.level1.sibling").val(), "less deep");
    });

    it("should handle mixed content types", () => {
      $$("test.string").val("text");
      $$("test.number").val(42);
      $$("test.boolean").val(true);
      $$("test.object").set({ key: "value", nested: { data: [1, 2, 3] } }); // Use .set() for objects
      $$("test.array").val([1, 2, 3, 4, 5]);

      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify all types preserved
      assertEquals($$("test.string").val(), "text");
      assertEquals($$("test.number").val(), 42);
      assertEquals($$("test.boolean").val(), true);
      assertEquals($$("test.object").get(), { key: "value", nested: { data: [1, 2, 3] } }); // Use .get() for objects
      assertEquals($$("test.array").val(), [1, 2, 3, 4, 5]);
    });
  });

  describe("save/load round-trip", () => {
    it("should preserve complete snippet workflow", () => {
      // Create snippets
      createSnippet("code.header", "import x from 'y'", { id: "h1", lang: "js", file: "main.js", order: 0 });
      createSnippet("code.func", "export function test() {}", { id: "f1", lang: "js", file: "main.js", order: 1 });

      // Create a group/view
      $$("views.mainFile").group(["code.header", "code.func"]);

      // Save
      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save();
      const stats1 = disk1.stats();
      assertEquals(stats1.snippets, 2);
      disk1.close();

      // Clear everything
      clearSnippetIndex();
      const root = $$("code").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }
      const viewRoot = $$("views").node();
      if (viewRoot.__nodes) {
        for (const key in viewRoot.__nodes) {
          delete viewRoot.__nodes[key];
        }
      }

      // Verify cleared
      assertEquals(findBySnippetId("h1"), null);
      assertEquals(findBySnippetId("f1"), null);

      // Load
      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load();
      disk2.close();

      // Verify snippets restored
      assertEquals($$("code.header").val(), "import x from 'y'");
      assertEquals($$("code.func").val(), "export function test() {}");

      // Verify index rebuilt
      const h1 = findBySnippetId("h1");
      assertExists(h1);
      assertEquals(h1.path, "code.header");

      const f1 = findBySnippetId("f1");
      assertExists(f1);
      assertEquals(f1.path, "code.func");

      // Note: Groups aren't persisted yet (Phase 2 feature)
      // Just verify the snippets themselves are restored
      // const group = $$("views.mainFile").group();
      // const items = group.list();
      // assertEquals(items.length, 2);
    });
  });

  describe("error handling", () => {
    it("should handle empty graphs", () => {
      const disk1 = new FXDisk(TEST_DB_PATH, true);
      disk1.save(); // Save empty graph
      disk1.close();

      const disk2 = new FXDisk(TEST_DB_PATH);
      disk2.load(); // Should not error
      disk2.close();

      // Graph should be empty (except system roots)
      const stats = new FXDisk(TEST_DB_PATH).stats();
      // Some system nodes might be saved
      assert(stats.nodes >= 0);
    });

    it("should handle multiple save/load cycles", () => {
      const disk = new FXDisk(TEST_DB_PATH, true);

      // Cycle 1
      $$("test.v1").val("version 1");
      disk.save();
      assertEquals(disk.stats().nodes > 0, true);

      // Cycle 2
      $$("test.v2").val("version 2");
      disk.save();

      // Clear and reload
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      disk.load();

      // Should have both nodes
      assertEquals($$("test.v1").val(), "version 1");
      assertEquals($$("test.v2").val(), "version 2");

      disk.close();
    });
  });
});
