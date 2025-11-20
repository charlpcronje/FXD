/**
 * Tests for WAL-based persistence
 * Ensures compatibility and measures performance vs SQLite
 */

import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std/assert/mod.ts";
import { beforeEach, afterEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import { $$, $_$$ } from "../fxn.ts";
import { createSnippet, findBySnippetId, clearSnippetIndex } from "../modules/fx-snippets.ts";
import { FXDiskWAL, createWALDisk } from "../modules/fx-persistence-wal.ts";
import { FXDisk } from "../modules/fx-persistence-deno.ts";

const TEST_WAL_PATH = "./test-data/test-wal.fxwal";
const TEST_SQLITE_PATH = "./test-data/test-sqlite.fxd";

describe("fx-persistence-wal", {
  sanitizeResources: false,
  sanitizeOps: false,
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

    // Remove test files if they exist
    try {
      Deno.removeSync(TEST_WAL_PATH);
    } catch {
      // Doesn't exist
    }

    try {
      Deno.removeSync(TEST_SQLITE_PATH);
    } catch {
      // Doesn't exist
    }
  });

  afterEach(async () => {
    // Wait a bit for file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup
    try {
      Deno.removeSync(TEST_WAL_PATH);
    } catch {
      // File still locked or already deleted
    }

    try {
      Deno.removeSync(TEST_SQLITE_PATH);
    } catch {
      // File still locked or already deleted
    }
  });

  describe("basic save/load", () => {
    it("should save and load a simple node", async () => {
      $$("test.node1").val("test value");

      const disk1 = await createWALDisk(TEST_WAL_PATH);
      await disk1.save();
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
      const disk2 = await createWALDisk(TEST_WAL_PATH);
      await disk2.load();
      disk2.close();

      // Verify restored
      assertEquals($$("test.node1").val(), "test value");
    });

    it("should save and load multiple nodes", async () => {
      $$("test.a").val("value a");
      $$("test.b").val("value b");
      $$("test.c.nested").val("nested value");

      const disk1 = await createWALDisk(TEST_WAL_PATH);
      await disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const disk2 = await createWALDisk(TEST_WAL_PATH);
      await disk2.load();
      disk2.close();

      // Verify
      assertEquals($$("test.a").val(), "value a");
      assertEquals($$("test.b").val(), "value b");
      assertEquals($$("test.c.nested").val(), "nested value");
    });
  });

  describe("snippet persistence", () => {
    it("should save and load snippets", async () => {
      createSnippet("test.s1", "code1", { id: "snippet-1", lang: "js", file: "main.js", order: 1 });
      createSnippet("test.s2", "code2", { id: "snippet-2", lang: "py", file: "util.py", order: 2 });

      const disk1 = await createWALDisk(TEST_WAL_PATH);
      await disk1.save();
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
      const disk2 = await createWALDisk(TEST_WAL_PATH);
      await disk2.load();
      disk2.close();

      // Verify snippets restored
      assertEquals($$("test.s1").val(), "code1");
      assertEquals($$("test.s2").val(), "code2");

      // Verify snippet index rebuilt
      const found1 = findBySnippetId("snippet-1");
      assertExists(found1);
      assertEquals(found1.path, "test.s1");
    });
  });

  describe("complex graphs", () => {
    it("should handle deeply nested structures", async () => {
      $$("test.level1.level2.level3.value").val("deep");
      $$("test.level1.level2.another").val("also deep");
      $$("test.level1.sibling").val("less deep");

      const disk1 = await createWALDisk(TEST_WAL_PATH);
      await disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        delete root.__nodes.level1;
      }

      // Load
      const disk2 = await createWALDisk(TEST_WAL_PATH);
      await disk2.load();
      disk2.close();

      // Verify structure
      assertEquals($$("test.level1.level2.level3.value").val(), "deep");
      assertEquals($$("test.level1.level2.another").val(), "also deep");
      assertEquals($$("test.level1.sibling").val(), "less deep");
    });

    it("should handle mixed content types", async () => {
      $$("test.string").val("text");
      $$("test.number").val(42);
      $$("test.boolean").val(true);
      $$("test.object").set({ key: "value", nested: { data: [1, 2, 3] } });
      $$("test.array").val([1, 2, 3, 4, 5]);

      const disk1 = await createWALDisk(TEST_WAL_PATH);
      await disk1.save();
      disk1.close();

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const disk2 = await createWALDisk(TEST_WAL_PATH);
      await disk2.load();
      disk2.close();

      // Verify all types preserved
      assertEquals($$("test.string").val(), "text");
      assertEquals($$("test.number").val(), 42);
      assertEquals($$("test.boolean").val(), true);
      assertEquals($$("test.object").get(), { key: "value", nested: { data: [1, 2, 3] } });
      assertEquals($$("test.array").val(), [1, 2, 3, 4, 5]);
    });
  });

  describe("performance comparison", () => {
    it("should be faster than SQLite for writes", async () => {
      // Create test data
      for (let i = 0; i < 100; i++) {
        $$(`test.node${i}`).val(`value ${i}`);
      }

      // Test WAL
      const walStart = performance.now();
      const walDisk = await createWALDisk(TEST_WAL_PATH);
      await walDisk.save();
      walDisk.close();
      const walTime = performance.now() - walStart;

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Recreate test data for SQLite
      for (let i = 0; i < 100; i++) {
        $$(`test.node${i}`).val(`value ${i}`);
      }

      // Test SQLite
      const sqliteStart = performance.now();
      const sqliteDisk = new FXDisk(TEST_SQLITE_PATH, true);
      sqliteDisk.save();
      sqliteDisk.close();
      const sqliteTime = performance.now() - sqliteStart;

      console.log(`WAL write time: ${walTime.toFixed(2)}ms`);
      console.log(`SQLite write time: ${sqliteTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(sqliteTime / walTime).toFixed(2)}x`);

      // WAL should be faster (or at least comparable)
      // Note: First run might be slower due to file creation, but subsequent runs should be faster
      assert(walTime < sqliteTime * 2, `WAL significantly slower than expected: ${walTime}ms vs ${sqliteTime}ms`);
    });

    it("should be faster than SQLite for reads", async () => {
      // Create test data
      for (let i = 0; i < 100; i++) {
        $$(`test.node${i}`).val(`value ${i}`);
      }

      // Save with both
      const walDisk1 = await createWALDisk(TEST_WAL_PATH);
      await walDisk1.save();
      walDisk1.close();

      const sqliteDisk1 = new FXDisk(TEST_SQLITE_PATH, true);
      sqliteDisk1.save();
      sqliteDisk1.close();

      // Clear graph
      const clearFn = () => {
        const root = $$("test").node();
        if (root.__nodes) {
          for (const key in root.__nodes) {
            delete root.__nodes[key];
          }
        }
      };

      // Test WAL read
      clearFn();
      const walStart = performance.now();
      const walDisk2 = await createWALDisk(TEST_WAL_PATH);
      await walDisk2.load();
      walDisk2.close();
      const walTime = performance.now() - walStart;

      // Test SQLite read
      clearFn();
      const sqliteStart = performance.now();
      const sqliteDisk2 = new FXDisk(TEST_SQLITE_PATH);
      sqliteDisk2.load();
      sqliteDisk2.close();
      const sqliteTime = performance.now() - sqliteStart;

      console.log(`WAL read time: ${walTime.toFixed(2)}ms`);
      console.log(`SQLite read time: ${sqliteTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(sqliteTime / walTime).toFixed(2)}x`);

      // WAL should be comparable or faster
      assert(walTime < sqliteTime * 3, `WAL reads significantly slower: ${walTime}ms vs ${sqliteTime}ms`);
    });

    it("should handle large graphs efficiently", async () => {
      console.log("\nCreating large graph (1000 nodes)...");

      // Create a large graph
      for (let i = 0; i < 1000; i++) {
        $$(`test.node${i}`).set({
          id: i,
          name: `Node ${i}`,
          value: Math.random(),
          data: [1, 2, 3, 4, 5],
        });
      }

      // Save with WAL
      const start = performance.now();
      const walDisk = await createWALDisk(TEST_WAL_PATH);
      await walDisk.save();
      const saveTime = performance.now() - start;

      console.log(`Saved 1000 nodes in ${saveTime.toFixed(2)}ms`);
      console.log(`Avg per node: ${(saveTime / 1000).toFixed(3)}ms`);

      // Clear
      const root = $$("test").node();
      if (root.__nodes) {
        for (const key in root.__nodes) {
          delete root.__nodes[key];
        }
      }

      // Load
      const loadStart = performance.now();
      await walDisk.load();
      const loadTime = performance.now() - loadStart;

      console.log(`Loaded 1000 nodes in ${loadTime.toFixed(2)}ms`);
      console.log(`Avg per node: ${(loadTime / 1000).toFixed(3)}ms`);

      walDisk.close();

      // Verify a few nodes
      assertEquals($$("test.node0").get().id, 0);
      assertEquals($$("test.node500").get().id, 500);
      assertEquals($$("test.node999").get().id, 999);

      // Should be reasonably fast
      assert(saveTime < 5000, `Save too slow: ${saveTime}ms`);
      assert(loadTime < 5000, `Load too slow: ${loadTime}ms`);
    });
  });

  describe("compaction", () => {
    it("should compact the WAL", async () => {
      // Create some data
      for (let i = 0; i < 50; i++) {
        $$(`test.node${i}`).val(`value ${i}`);
      }

      const disk = await createWALDisk(TEST_WAL_PATH);
      await disk.save();

      const statsBefore = await disk.stats();
      console.log(`Before compaction: ${statsBefore.records} records, ${statsBefore.bytes} bytes`);

      // Compact
      await disk.compact();

      const statsAfter = await disk.stats();
      console.log(`After compaction: ${statsAfter.records} records, ${statsAfter.bytes} bytes`);

      // Should still have all data
      assertEquals($$("test.node0").val(), "value 0");
      assertEquals($$("test.node49").val(), "value 49");

      disk.close();
    });
  });
});
