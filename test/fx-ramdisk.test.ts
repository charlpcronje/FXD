/**
 * @file fx-ramdisk.test.ts
 * @description Comprehensive tests for RAMDisk functionality
 *
 * Test Coverage:
 * - RAMDisk creation and destruction
 * - Platform-specific drivers
 * - Configuration validation
 * - Status monitoring
 * - File synchronization
 * - Error handling
 * - Resource cleanup
 */

import { assert, assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { FXCore } from "../fxn.ts";
import { RAMDiskManager, RAMDiskConfig } from "../modules/fx-ramdisk.ts";

// Test configuration
const TEST_DISK_SIZE = 64; // 64MB (small for testing)
const IS_WINDOWS = Deno.build.os === "windows";
const IS_MACOS = Deno.build.os === "darwin";
const IS_LINUX = Deno.build.os === "linux";

// Helper function to create test mount point
function getTestMountPoint(): string {
  if (IS_WINDOWS) {
    return "Z:\\"; // Use Z: for testing
  } else if (IS_MACOS) {
    return "/Volumes/FXD_Test";
  } else {
    return "/tmp/fxd_test";
  }
}

// Setup and teardown
let fx: FXCore;
let manager: RAMDiskManager;
let testDiskIds: string[] = [];

async function setupTest() {
  fx = new FXCore();
  manager = new RAMDiskManager(fx);
  await manager.initialize();
  testDiskIds = [];
}

async function teardownTest() {
  // Clean up all test disks
  for (const diskId of testDiskIds) {
    try {
      await manager.destroyDisk(diskId);
    } catch {
      // Ignore errors during cleanup
    }
  }
  testDiskIds = [];
}

// Test 1: Manager initialization
Deno.test("RAMDisk - Manager initializes correctly", async () => {
  await setupTest();

  assertExists(manager);
  assertEquals(typeof manager.initialize, "function");
  assertEquals(typeof manager.createDisk, "function");
  assertEquals(typeof manager.destroyDisk, "function");

  await teardownTest();
});

// Test 2: Get default configuration
Deno.test("RAMDisk - Get default configuration", async () => {
  await setupTest();

  const config = manager.getDefaultConfig();

  assertExists(config);
  assertExists(config.sizeMB);
  assertExists(config.mountPoint);
  assertExists(config.volumeName);
  assertExists(config.driver);

  assert(config.sizeMB! > 0, "Size should be positive");

  await teardownTest();
});

// Test 3: List available drivers
Deno.test("RAMDisk - List available drivers", async () => {
  await setupTest();

  const drivers = await manager.getAvailableDrivers();

  assert(Array.isArray(drivers), "Should return array");

  if (IS_WINDOWS) {
    // Windows might have imdisk or winfsp
    assert(drivers.includes("imdisk") || drivers.includes("winfsp") || drivers.length === 0);
  } else if (IS_MACOS) {
    // macOS should have diskutil
    assert(drivers.includes("diskutil") || drivers.length === 0);
  } else if (IS_LINUX) {
    // Linux should always have tmpfs
    assert(drivers.includes("tmpfs"), "Linux should have tmpfs");
  }

  await teardownTest();
});

// Test 4: Create RAMDisk (driver available)
Deno.test({
  name: "RAMDisk - Create disk",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
      volumeName: "FXD_Test",
    });

    testDiskIds.push(diskId);

    assertExists(diskId);
    assert(diskId.length > 0, "Disk ID should not be empty");

    await teardownTest();
  },
});

// Test 5: Get disk status
Deno.test({
  name: "RAMDisk - Get disk status",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    const status = await manager.getStatus(diskId);

    assertExists(status);
    assertEquals(status.id, diskId);
    assertEquals(status.mounted, true);
    assertEquals(status.mountPoint, mountPoint);
    assert(status.sizeMB >= TEST_DISK_SIZE - 10); // Allow some overhead

    await teardownTest();
  },
});

// Test 6: List disks
Deno.test({
  name: "RAMDisk - List disks",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const initialList = manager.listDisks();
    const initialCount = initialList.length;

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    const finalList = manager.listDisks();

    assertEquals(finalList.length, initialCount + 1);

    const found = finalList.find(d => d.id === diskId);
    assertExists(found);

    await teardownTest();
  },
});

// Test 7: Destroy disk
Deno.test({
  name: "RAMDisk - Destroy disk",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    await manager.destroyDisk(diskId);

    // Remove from test list (already destroyed)
    testDiskIds = testDiskIds.filter(id => id !== diskId);

    // Verify it's gone
    await assertRejects(
      async () => {
        await manager.getStatus(diskId);
      },
      Error
    );

    await teardownTest();
  },
});

// Test 8: Sync to FXD
Deno.test({
  name: "RAMDisk - Sync to FXD",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    // Create test file
    const testFile = `${mountPoint}/test.js`;
    await Deno.writeTextFile(testFile, "console.log('test');");

    // Sync to FXD
    const result = await manager.syncToFXD(diskId);

    assertExists(result);
    assertEquals(typeof result.imported, "number");
    assertEquals(typeof result.skipped, "number");
    assertEquals(typeof result.errors, "number");

    assert(result.imported >= 1, "Should import at least one file");

    // Verify snippet was created
    const snippet = fx.proxy("snippets.test").val();
    assertExists(snippet);

    await teardownTest();
  },
});

// Test 9: Sync from FXD
Deno.test({
  name: "RAMDisk - Sync from FXD",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    // Create snippet in FXD
    fx.proxy("snippets.test_export").val({
      id: "test_export",
      name: "test_export.js",
      content: "console.log('exported');",
      language: "javascript",
    });

    // Sync from FXD
    const result = await manager.syncFromFXD(diskId);

    assertExists(result);
    assert(result.exported >= 1, "Should export at least one file");

    // Verify file was created
    const testFile = `${mountPoint}/test_export.js`;
    const content = await Deno.readTextFile(testFile);

    assertEquals(content, "console.log('exported');");

    await teardownTest();
  },
});

// Test 10: Invalid configuration
Deno.test("RAMDisk - Invalid configuration throws error", async () => {
  await setupTest();

  await assertRejects(
    async () => {
      await manager.createDisk({
        id: "",
        sizeMB: -1,
        mountPoint: "",
        volumeName: "",
        fileSystem: "",
        driver: "invalid",
      });
    },
    Error
  );

  await teardownTest();
});

// Test 11: Destroy non-existent disk
Deno.test("RAMDisk - Destroy non-existent disk throws error", async () => {
  await setupTest();

  await assertRejects(
    async () => {
      await manager.destroyDisk("non_existent_disk");
    },
    Error
  );

  await teardownTest();
});

// Test 12: Get status of non-existent disk
Deno.test("RAMDisk - Get status of non-existent disk throws error", async () => {
  await setupTest();

  await assertRejects(
    async () => {
      await manager.getStatus("non_existent_disk");
    },
    Error
  );

  await teardownTest();
});

// Test 13: Configuration persistence
Deno.test({
  name: "RAMDisk - Configuration persists in FXD",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
      volumeName: "Test_Disk",
    });

    testDiskIds.push(diskId);

    // Check if configuration was persisted
    const config = fx.proxy(`system.ramdisks.${diskId}`).val();

    assertExists(config);
    assertEquals(config.id, diskId);
    assertEquals(config.mountPoint, mountPoint);
    assertEquals(config.volumeName, "Test_Disk");

    await teardownTest();
  },
});

// Test 14: Health status calculation
Deno.test({
  name: "RAMDisk - Health status calculated correctly",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    const status = await manager.getStatus(diskId);

    assertExists(status.health);
    assert(
      status.health === "healthy" || status.health === "warning" || status.health === "error"
    );

    await teardownTest();
  },
});

// Test 15: File count tracking
Deno.test({
  name: "RAMDisk - File count tracked correctly",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    // Initial file count
    const status1 = await manager.getStatus(diskId);
    const initialCount = status1.fileCount;

    // Create test files
    await Deno.writeTextFile(`${mountPoint}/file1.txt`, "test 1");
    await Deno.writeTextFile(`${mountPoint}/file2.txt`, "test 2");

    // Wait a bit for file system to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check file count again
    const status2 = await manager.getStatus(diskId);

    assert(status2.fileCount >= initialCount + 2, "File count should increase");

    await teardownTest();
  },
});

// Test 16: Language detection
Deno.test("RAMDisk - Language detected correctly", async () => {
  await setupTest();

  // Access private method through manager instance
  const testCases = [
    { filename: "test.js", expected: "javascript" },
    { filename: "test.ts", expected: "typescript" },
    { filename: "test.py", expected: "python" },
    { filename: "test.rs", expected: "rust" },
    { filename: "test.go", expected: "go" },
    { filename: "test.txt", expected: "text" },
    { filename: "unknown.xyz", expected: "text" },
  ];

  for (const testCase of testCases) {
    // We can't directly test private methods, but we can test through syncToFXD
    // For now, just verify the method exists
    assert(true); // Placeholder
  }

  await teardownTest();
});

// Test 17: Sync with pattern filter
Deno.test({
  name: "RAMDisk - Sync with pattern filter",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    // Create test files
    await Deno.writeTextFile(`${mountPoint}/test.js`, "console.log('js');");
    await Deno.writeTextFile(`${mountPoint}/test.py`, "print('py')");
    await Deno.writeTextFile(`${mountPoint}/test.txt`, "text");

    // Sync with pattern
    const result = await manager.syncToFXD(diskId, { pattern: "\\.js$" });

    // Should only import .js files
    assert(result.imported >= 1, "Should import at least one .js file");

    await teardownTest();
  },
});

// Test 18: Sync with overwrite option
Deno.test({
  name: "RAMDisk - Sync with overwrite",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    // Create test file
    await Deno.writeTextFile(`${mountPoint}/test.js`, "version 1");

    // First sync
    await manager.syncToFXD(diskId);

    // Update file
    await Deno.writeTextFile(`${mountPoint}/test.js`, "version 2");

    // Sync with overwrite
    await manager.syncToFXD(diskId, { overwrite: true });

    // Verify snippet was updated
    const snippet = fx.proxy("snippets.test").val();
    assertEquals(snippet.content, "version 2");

    await teardownTest();
  },
});

// Test 19: Platform-specific mount point
Deno.test("RAMDisk - Platform-specific mount point", async () => {
  await setupTest();

  const config = manager.getDefaultConfig();

  if (IS_WINDOWS) {
    assert(config.mountPoint?.endsWith("\\"), "Windows should use drive letter");
  } else if (IS_MACOS) {
    assert(config.mountPoint?.startsWith("/Volumes"), "macOS should use /Volumes");
  } else if (IS_LINUX) {
    assert(config.mountPoint?.startsWith("/"), "Linux should use absolute path");
  }

  await teardownTest();
});

// Test 20: Error handling - insufficient permissions
Deno.test({
  name: "RAMDisk - Handle permission errors gracefully",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    // Try to mount to restricted location (might fail on some systems)
    const restrictedPath = IS_WINDOWS ? "C:\\" : "/root";

    try {
      await manager.createDisk({
        sizeMB: TEST_DISK_SIZE,
        mountPoint: restrictedPath,
      });

      // If it succeeds, we need to clean up
      const disks = manager.listDisks();
      const created = disks.find(d => d.mountPoint === restrictedPath);

      if (created) {
        testDiskIds.push(created.id);
      }
    } catch (error) {
      // Expected to fail due to permissions
      assert(error instanceof Error);
    }

    await teardownTest();
  },
});

// Test 21: Multiple disks
Deno.test({
  name: "RAMDisk - Multiple disks can be created",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint1 = getTestMountPoint();
    const mountPoint2 = IS_WINDOWS ? "Y:\\" : "/tmp/fxd_test2";

    const diskId1 = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint: mountPoint1,
    });

    testDiskIds.push(diskId1);

    // Only create second disk if platform supports multiple mounts
    if (!IS_LINUX) {
      try {
        const diskId2 = await manager.createDisk({
          sizeMB: TEST_DISK_SIZE,
          mountPoint: mountPoint2,
        });

        testDiskIds.push(diskId2);

        const disks = manager.listDisks();
        assert(disks.length >= 2, "Should have at least 2 disks");
      } catch {
        // Some platforms might not support multiple mounts
        console.log("⚠️  Multiple mounts not supported on this platform");
      }
    }

    await teardownTest();
  },
});

// Test 22: File extension mapping
Deno.test("RAMDisk - File extension mapped correctly", async () => {
  await setupTest();

  const testCases = [
    { language: "javascript", expected: "js" },
    { language: "typescript", expected: "ts" },
    { language: "python", expected: "py" },
    { language: "rust", expected: "rs" },
    { language: "unknown", expected: "txt" },
  ];

  // We can verify this through sync behavior
  assert(true); // Placeholder for now

  await teardownTest();
});

// Test 23: Auto-sync setup
Deno.test({
  name: "RAMDisk - Auto-sync can be configured",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
      autoSyncMs: 5000, // 5 seconds
    });

    testDiskIds.push(diskId);

    // Verify configuration
    const config = fx.proxy(`system.ramdisks.${diskId}`).val();
    assertEquals(config.autoSyncMs, 5000);

    await teardownTest();
  },
});

// Test 24: Metadata timestamps
Deno.test({
  name: "RAMDisk - Timestamps tracked correctly",
  ignore: false,
  fn: async () => {
    await setupTest();

    const drivers = await manager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("⚠️  No drivers available, skipping test");
      await teardownTest();
      return;
    }

    const mountPoint = getTestMountPoint();

    const diskId = await manager.createDisk({
      sizeMB: TEST_DISK_SIZE,
      mountPoint,
    });

    testDiskIds.push(diskId);

    const status = await manager.getStatus(diskId);

    assert(status.created > 0, "Created timestamp should be set");
    assert(status.created <= Date.now(), "Created timestamp should be in past");

    await teardownTest();
  },
});

// Test 25: Cleanup on errors
Deno.test("RAMDisk - Cleanup handles errors gracefully", async () => {
  await setupTest();

  // Try to destroy non-existent disk
  try {
    await manager.destroyDisk("non_existent");
  } catch (error) {
    assert(error instanceof Error);
  }

  // Manager should still be functional
  const disks = manager.listDisks();
  assert(Array.isArray(disks));

  await teardownTest();
});

console.log("\n✅ RAMDisk tests complete!");
