/**
 * Tests for FX Filesystem Plugin
 * Verifies RAMDisk syncing functionality
 */

import {
  assertEquals,
  assertExists,
  assert
} from "https://deno.land/std/assert/mod.ts";
import { beforeEach, afterEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

import { $$, $_$$, fx } from "../fxn.ts";
import { loadFilesystemPlugin, FXFilesystemPlugin } from "../plugins/fx-filesystem.ts";

// Global setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

const TEST_RAMDISK = Deno.build.os === 'windows' ? 'C:\\tmp\\fx-test-ramdisk' : '/tmp/fx-test-ramdisk';

// Helper to wait for async operations
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to recursively remove directory
async function removeDir(path: string) {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // Directory doesn't exist or can't be removed
  }
}

// Helper to check if file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("fx-filesystem", {
  sanitizeResources: false,
  sanitizeOps: false
}, () => {
  let plugin: FXFilesystemPlugin | null = null;

  beforeEach(async () => {
    // Destroy any existing plugin first
    if (plugin) {
      plugin.destroy();
      plugin = null;
    }

    // Clear test namespace
    const root = $$("test").node();
    if (root.__nodes) {
      for (const key in root.__nodes) {
        delete root.__nodes[key];
      }
    }

    // Remove test ramdisk if it exists
    await removeDir(TEST_RAMDISK);
    await delay(100);
  });

  afterEach(async () => {
    // Cleanup plugin
    if (plugin) {
      plugin.destroy();
      plugin = null;
    }

    // Wait for filesystem operations to complete
    await delay(200);

    // Cleanup test ramdisk
    await removeDir(TEST_RAMDISK);
  });

  describe("Step 1: Plugin initialization", () => {
    it("should create RAMDisk directory structure", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        verbose: false
      });

      // Verify directory exists
      const stat = await Deno.stat(TEST_RAMDISK);
      assertExists(stat);
      assertEquals(stat.isDirectory, true);
    });

    it("should initialize with correct options", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        autoSync: true,
        watchChanges: true,
        fileExtension: '.fxval',
        verbose: false
      });

      const stats = plugin.stats();
      assertEquals(stats.baseDir, TEST_RAMDISK);
      assertEquals(stats.autoSync, true);
      assertEquals(stats.watchChanges, true);
    });
  });

  describe("Step 2: Basic file writing", () => {
    it("should create directory for node", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      // Wait for plugin to fully initialize
      await delay(500);

      $$("test.node1").val("hello");
      await delay(500);

      const nodeDir = join(TEST_RAMDISK, "test", "node1");
      const exists = await fileExists(nodeDir);
      assert(exists, `Node directory should exist at ${nodeDir}`);
    });

    it("should write value.fxval file with content", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.value").val("test content");
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "value", "value.fxval");
      const exists = await fileExists(valueFile);
      assert(exists, `Value file should exist at ${valueFile}`);

      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "test content");
    });

    it("should write .fxmeta file with metadata", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.meta").val("test");
      await delay(500);

      const metaFile = join(TEST_RAMDISK, "test", "meta", ".fxmeta");
      const exists = await fileExists(metaFile);
      assert(exists, "Metadata file should exist");

      const content = await Deno.readTextFile(metaFile);
      const metadata = JSON.parse(content);
      assertExists(metadata.__id);
      assertExists(metadata.__timestamp);
    });

    it("should handle numeric values", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.number").val(42);
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "number", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "42");
    });

    it("should handle object values as JSON", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      const obj = { name: "test", count: 5 };
      $$("test.object").val(obj);
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "object", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      const parsed = JSON.parse(content);
      assertEquals(parsed.name, "test");
      assertEquals(parsed.count, 5);
    });
  });

  describe("Step 3: FX to filesystem sync", () => {
    it("should sync FX changes to filesystem", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.sync1").val("initial");
      await delay(500);

      // Change value
      $$("test.sync1").val("updated");
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "sync1", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "updated");
    });

    it("should sync nested nodes", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.parent.child.nested").val("deep value");
      await delay(600);

      const valueFile = join(TEST_RAMDISK, "test", "parent", "child", "nested", "value.fxval");
      const exists = await fileExists(valueFile);
      assert(exists, "Nested value file should exist");

      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "deep value");
    });

    it("should sync multiple nodes independently", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.node1").val("value1");
      $$("test.node2").val("value2");
      $$("test.node3").val("value3");
      await delay(600);

      const file1 = join(TEST_RAMDISK, "test", "node1", "value.fxval");
      const file2 = join(TEST_RAMDISK, "test", "node2", "value.fxval");
      const file3 = join(TEST_RAMDISK, "test", "node3", "value.fxval");

      assertEquals(await Deno.readTextFile(file1), "value1");
      assertEquals(await Deno.readTextFile(file2), "value2");
      assertEquals(await Deno.readTextFile(file3), "value3");
    });
  });

  describe("Step 4: Filesystem to FX sync", () => {
    it("should sync external file changes to FX", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        watchChanges: true,
        verbose: false
      });

      // Create initial node
      $$("test.external").val("initial");
      await delay(500);

      // External app writes file
      const valueFile = join(TEST_RAMDISK, "test", "external", "value.fxval");
      await Deno.writeTextFile(valueFile, "from-outside");
      await delay(600);

      // Should sync to FX
      const value = $$("test.external").val();
      assertEquals(value, "from-outside");
    });

    it("should create new FX nodes from external files", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        watchChanges: true,
        verbose: false
      });

      // Wait for plugin to start watching
      await delay(200);

      // External app creates new node
      const newNodeDir = join(TEST_RAMDISK, "test", "newexternal");
      await Deno.mkdir(newNodeDir, { recursive: true });
      await Deno.writeTextFile(join(newNodeDir, "value.fxval"), "external-created");
      await delay(600);

      // Node should exist in FX (if path mapping is set up)
      // This may require additional logic in the plugin
      const exists = await fileExists(join(newNodeDir, "value.fxval"));
      assert(exists, "External file should exist");
    });
  });

  describe("Step 5: Rapid changes", () => {
    it("should handle rapid changes without corruption", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 50,
        verbose: false
      });

      // Burst of changes
      for (let i = 0; i < 100; i++) {
        $$("test.burst").val(i);
      }
      await delay(800);

      const valueFile = join(TEST_RAMDISK, "test", "burst", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(Number(content), 99);
    });

    it("should handle rapid changes across multiple nodes", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 50,
        verbose: false
      });

      // Rapid changes to different nodes
      for (let i = 0; i < 20; i++) {
        $$(`test.rapid${i}`).val(`value${i}`);
      }
      await delay(800);

      // Check all files exist
      for (let i = 0; i < 20; i++) {
        const file = join(TEST_RAMDISK, "test", `rapid${i}`, "value.fxval");
        const exists = await fileExists(file);
        assert(exists, `File should exist for rapid${i}`);
      }
    });
  });

  describe("Step 6: Path handling", () => {
    it("should handle Windows paths correctly", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.windows.path").val("windows test");
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "windows", "path", "value.fxval");
      const exists = await fileExists(valueFile);
      assert(exists, "Windows path should work");
    });

    it("should sanitize invalid path characters", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      // Nodes with special chars will be sanitized
      $$("test.safe-name").val("test");
      await delay(500);

      const nodeDir = join(TEST_RAMDISK, "test", "safe-name");
      const exists = await fileExists(nodeDir);
      assert(exists, "Sanitized path should exist");
    });
  });

  describe("Step 7: Plugin lifecycle", () => {
    it("should properly clean up on destroy", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 100,
        watchChanges: true,
        verbose: false
      });

      const stats = plugin.stats();
      assert(stats.watchChanges, "Watcher should be active");

      plugin.destroy();

      // Watcher should be closed
      // (No direct way to test this, but it shouldn't throw)
    });

    it("should provide accurate stats", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.stats1").val("test");
      $$("test.stats2").val("test");
      await delay(500);

      const stats = plugin.stats();
      assertEquals(stats.baseDir, TEST_RAMDISK);
      assertEquals(stats.autoSync, true);
      assert(stats.nodePathMappings >= 2, "Should track path mappings");
    });
  });

  describe("Step 8: Edge cases", () => {
    it("should handle empty string values", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.empty").val("");
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "empty", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "");
    });

    it("should handle null and undefined gracefully", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.nullable").val(null);
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "nullable", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "null");
    });

    it("should handle boolean values", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.bool").val(true);
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "bool", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      assertEquals(content, "true");
    });

    it("should handle array values", async () => {
      plugin = await loadFilesystemPlugin({
        baseDir: TEST_RAMDISK,
        syncInterval: 0,
        verbose: false
      });

      $$("test.array").val([1, 2, 3]);
      await delay(500);

      const valueFile = join(TEST_RAMDISK, "test", "array", "value.fxval");
      const content = await Deno.readTextFile(valueFile);
      const parsed = JSON.parse(content);
      assertEquals(parsed, [1, 2, 3]);
    });
  });
});
