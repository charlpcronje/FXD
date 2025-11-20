/**
 * Minimal test to debug filesystem plugin
 */

import { $$, $_$$, fx } from "./fxn.ts";
import { loadFilesystemPlugin } from "./plugins/fx-filesystem.ts";

// Global setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

const TEST_DIR = Deno.build.os === 'windows' ? 'C:\\tmp\\fx-minimal-test' : '/tmp/fx-minimal-test';

// Clean up first
try {
  await Deno.remove(TEST_DIR, { recursive: true });
} catch {
  // Doesn't exist
}

console.log("Starting minimal filesystem test...");

// Load plugin
const plugin = await loadFilesystemPlugin({
  baseDir: TEST_DIR,
  syncInterval: 0,
  verbose: true
});

console.log("\nPlugin loaded. Creating test node...");

// Create a simple test node
$$("test.simple").val("hello world");

// Wait for sync
await new Promise(resolve => setTimeout(resolve, 1000));

console.log("\nChecking if files were created...");

// Check if directory exists
try {
  const stat = await Deno.stat(`${TEST_DIR}/test/simple`);
  console.log("✓ Directory exists:", `${TEST_DIR}/test/simple`);
  console.log("  Is directory:", stat.isDirectory);
} catch (e) {
  console.error("✗ Directory not found:", e);
}

// Check if value file exists
try {
  const content = await Deno.readTextFile(`${TEST_DIR}/test/simple/value.fxval`);
  console.log("✓ Value file exists with content:", content);
} catch (e) {
  console.error("✗ Value file not found:", e);
}

// Check if metadata file exists
try {
  const content = await Deno.readTextFile(`${TEST_DIR}/test/simple/.fxmeta`);
  console.log("✓ Metadata file exists");
} catch (e) {
  console.error("✗ Metadata file not found:", e);
}

// List all files in test directory
console.log("\nListing all files in", TEST_DIR);
try {
  for await (const entry of Deno.readDir(TEST_DIR)) {
    console.log("  -", entry.name, entry.isDirectory ? "(dir)" : "(file)");
  }
} catch (e) {
  console.error("Error listing directory:", e);
}

plugin.destroy();
console.log("\nTest complete!");
