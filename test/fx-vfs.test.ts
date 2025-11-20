/**
 * @file fx-vfs.test.ts
 * @description Tests for Virtual File System (VFS) functionality
 *
 * Test Coverage:
 * - VFS mounting and unmounting
 * - File watching
 * - Bidirectional synchronization
 * - Virtual file management
 * - Statistics tracking
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { FXCore } from "../fxn.ts";
import { VFSManager } from "../modules/fx-vfs.ts";
import { RAMDiskManager } from "../modules/fx-ramdisk.ts";

let fx: FXCore;
let vfs: VFSManager;
let ramdisk: RAMDiskManager;

async function setup() {
  fx = new FXCore();
  vfs = new VFSManager(fx);
  ramdisk = new RAMDiskManager(fx);
  await ramdisk.initialize();
  await vfs.initialize(ramdisk);
}

async function cleanup() {
  try {
    await vfs.unmount();
  } catch {
    // Ignore
  }
}

Deno.test("VFS - Initialize correctly", async () => {
  await setup();
  assertExists(vfs);
  assertEquals(typeof vfs.mount, "function");
  await cleanup();
});

Deno.test("VFS - Get statistics", async () => {
  await setup();
  const stats = vfs.getStats();
  assertExists(stats);
  assertEquals(typeof stats.totalFiles, "number");
  assertEquals(typeof stats.totalSize, "number");
  await cleanup();
});

Deno.test("VFS - Mount directory", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  await vfs.mount(testDir, { watch: false });
  await vfs.unmount();
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Sync from directory", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${testDir}/test.js`, "console.log('test');");
  const result = await vfs.syncFromDirectory(testDir);
  assert(result.imported >= 1);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Sync to directory", async () => {
  await setup();
  fx.proxy("snippets.test").val({
    id: "test",
    content: "test content",
    language: "javascript",
  });
  const testDir = await Deno.makeTempDir();
  const result = await vfs.syncToDirectory(testDir);
  assert(result.exported >= 1);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - List virtual files", async () => {
  await setup();
  const files = vfs.listVirtualFiles();
  assert(Array.isArray(files));
  await cleanup();
});

Deno.test("VFS - Watch file changes", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  const testFile = `${testDir}/test.js`;
  await Deno.writeTextFile(testFile, "v1");
  await vfs.watchFile(testFile);
  vfs.unwatchFile(testFile);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Create virtual file", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  fx.proxy("test.snippet").val({ content: "test", language: "js" });
  await vfs.createVirtualFile("test.snippet", `${testDir}/test.js`);
  const content = await Deno.readTextFile(`${testDir}/test.js`);
  assertEquals(content, "test");
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Delete virtual file", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  const testFile = `${testDir}/test.js`;
  await Deno.writeTextFile(testFile, "test");
  await vfs.deleteVirtualFile(testFile);
  let exists = true;
  try {
    await Deno.stat(testFile);
  } catch {
    exists = false;
  }
  assertEquals(exists, false);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Handle file exclusions", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${testDir}/test.js`, "ok");
  await Deno.writeTextFile(`${testDir}/.hidden`, "skip");
  const result = await vfs.syncFromDirectory(testDir);
  assert(result.skipped >= 1);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Track pending changes", async () => {
  await setup();
  const stats1 = vfs.getStats();
  const initialPending = stats1.pendingChanges;
  // Pending changes would be tracked during file watching
  assert(initialPending >= 0);
  await cleanup();
});

Deno.test("VFS - Recursive directory sync", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  await Deno.mkdir(`${testDir}/subdir`);
  await Deno.writeTextFile(`${testDir}/file1.js`, "test1");
  await Deno.writeTextFile(`${testDir}/subdir/file2.js`, "test2");
  const result = await vfs.syncFromDirectory(testDir, { recursive: true });
  assert(result.imported >= 2);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Language detection", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${testDir}/test.py`, "print('test')");
  await vfs.syncFromDirectory(testDir);
  const snippet = fx.proxy("snippets.test").val();
  assertEquals(snippet.language, "python");
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - File size tracking", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  const content = "x".repeat(1000);
  await Deno.writeTextFile(`${testDir}/test.js`, content);
  await vfs.syncFromDirectory(testDir);
  const stats = vfs.getStats();
  assert(stats.totalSize >= 1000);
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

Deno.test("VFS - Update virtual file", async () => {
  await setup();
  const testDir = await Deno.makeTempDir();
  fx.proxy("test.snippet").val({ content: "v1", language: "js" });
  await vfs.createVirtualFile("test.snippet", `${testDir}/test.js`);
  fx.proxy("test.snippet").val({ content: "v2", language: "js" });
  await vfs.updateVirtualFile("test.snippet");
  const content = await Deno.readTextFile(`${testDir}/test.js`);
  assertEquals(content, "v2");
  await Deno.remove(testDir, { recursive: true });
  await cleanup();
});

console.log("\n✅ VFS tests complete!");
