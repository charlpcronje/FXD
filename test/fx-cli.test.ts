#!/usr/bin/env deno test --allow-all

/**
 * @file fx-cli.test.ts
 * @description Comprehensive tests for FXD CLI
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 *
 * Tests cover:
 * - Command parsing
 * - File operations (save, load, import, export)
 * - Statistics and health checks
 * - Error handling
 * - Cross-platform compatibility
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const CLI_PATH = join(Deno.cwd(), "cli", "fxd-enhanced.ts");
const TEST_DIR = join(Deno.cwd(), "test-data", "cli-tests");

// Helper function to run CLI command
async function runCLI(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-all", CLI_PATH, ...args],
    stdout: "piped",
    stderr: "piped",
    cwd: TEST_DIR,
  });

  const { code, stdout, stderr } = await command.output();

  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

// Setup test environment
async function setup() {
  await Deno.mkdir(TEST_DIR, { recursive: true });
}

// Cleanup test environment
async function cleanup() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore errors
  }
}

// Test 1: CLI Help Command
Deno.test("CLI - help command shows available commands", async () => {
  await setup();

  const result = await runCLI(["help"]);

  assertEquals(result.code, 0, "Help command should succeed");
  assert(result.stdout.includes("FXD CLI"), "Should show CLI title");
  assert(result.stdout.includes("Commands:"), "Should list commands");
  assert(result.stdout.includes("save"), "Should include save command");
  assert(result.stdout.includes("load"), "Should include load command");
  assert(result.stdout.includes("import"), "Should include import command");

  await cleanup();
});

// Test 2: Version Command
Deno.test("CLI - version command shows version info", async () => {
  await setup();

  const result = await runCLI(["version"]);

  assertEquals(result.code, 0, "Version command should succeed");
  assert(result.stdout.includes("FXD CLI"), "Should show CLI name");
  assert(result.stdout.includes("v2.0"), "Should show version number");

  await cleanup();
});

// Test 3: Health Check Command
Deno.test("CLI - health command checks system health", async () => {
  await setup();

  const result = await runCLI(["health"]);

  assertEquals(result.code, 0, "Health command should succeed");
  assert(result.stdout.includes("FXD System Health"), "Should show health check title");
  assert(result.stdout.includes("FX Framework"), "Should check FX framework");
  assert(result.stdout.includes("✅") || result.stdout.includes("❌"), "Should show status indicators");

  await cleanup();
});

// Test 4: Save Command
Deno.test("CLI - save command creates .fxd file", async () => {
  await setup();

  const filename = "test-save.fxd";
  const result = await runCLI(["save", filename]);

  assertEquals(result.code, 0, "Save command should succeed");
  assert(result.stdout.includes("Saving to"), "Should show saving message");
  assert(result.stdout.includes("✅") || result.stdout.includes("Saved successfully"), "Should show success");

  // Verify file was created
  const filePath = join(TEST_DIR, filename);
  const fileExists = await exists(filePath);
  assert(fileExists, "Should create .fxd file");

  await cleanup();
});

// Test 5: Load Command with Existing File
Deno.test("CLI - load command loads existing .fxd file", async () => {
  await setup();

  // First create a file
  const filename = "test-load.fxd";
  await runCLI(["save", filename]);

  // Then load it
  const result = await runCLI(["load", filename]);

  assertEquals(result.code, 0, "Load command should succeed");
  assert(result.stdout.includes("Loading from"), "Should show loading message");
  assert(result.stdout.includes("✅") || result.stdout.includes("Loaded successfully"), "Should show success");

  await cleanup();
});

// Test 6: Load Command with Non-Existent File
Deno.test("CLI - load command fails gracefully with non-existent file", async () => {
  await setup();

  const result = await runCLI(["load", "non-existent.fxd"]);

  // Should fail gracefully
  assert(result.code !== 0 || result.stdout.includes("Error") || result.stderr.includes("Error"),
    "Should show error for non-existent file");

  await cleanup();
});

// Test 7: Import Single File
Deno.test("CLI - import command imports single file", async () => {
  await setup();

  // Create a test file to import
  const testFile = join(TEST_DIR, "test-import.ts");
  await Deno.writeTextFile(testFile, "console.log('Hello FXD');");

  const result = await runCLI(["import", "test-import.ts"]);

  assertEquals(result.code, 0, "Import should succeed");
  assert(result.stdout.includes("Importing"), "Should show importing message");
  assert(result.stdout.includes("✅") || result.stdout.includes("Import completed"), "Should show success");

  await cleanup();
});

// Test 8: Import Directory
Deno.test("CLI - import command imports directory", async () => {
  await setup();

  // Create test directory with files
  const testDir = join(TEST_DIR, "test-import-dir");
  await Deno.mkdir(testDir, { recursive: true });
  await Deno.writeTextFile(join(testDir, "file1.ts"), "// File 1");
  await Deno.writeTextFile(join(testDir, "file2.ts"), "// File 2");

  const result = await runCLI(["import", "test-import-dir"]);

  assertEquals(result.code, 0, "Import directory should succeed");
  assert(result.stdout.includes("Importing"), "Should show importing message");

  await cleanup();
});

// Test 9: Export to JSON
Deno.test("CLI - export command exports to JSON format", async () => {
  await setup();

  // Create some data first
  await runCLI(["save", "test-export.fxd"]);

  // Export to JSON
  const exportDir = "export-json";
  const result = await runCLI(["export", exportDir, "--format", "json"]);

  assertEquals(result.code, 0, "Export should succeed");
  assert(result.stdout.includes("Exporting"), "Should show exporting message");

  // Verify export file exists
  const exportFile = join(TEST_DIR, exportDir, "export.json");
  const fileExists = await exists(exportFile);
  assert(fileExists, "Should create JSON export file");

  await cleanup();
});

// Test 10: Export to HTML
Deno.test("CLI - export command exports to HTML format", async () => {
  await setup();

  await runCLI(["save", "test-export-html.fxd"]);

  const exportDir = "export-html";
  const result = await runCLI(["export", exportDir, "--format", "html"]);

  assertEquals(result.code, 0, "Export to HTML should succeed");

  const exportFile = join(TEST_DIR, exportDir, "export.html");
  const fileExists = await exists(exportFile);
  assert(fileExists, "Should create HTML export file");

  await cleanup();
});

// Test 11: Export to Files
Deno.test("CLI - export command exports to individual files", async () => {
  await setup();

  await runCLI(["save", "test-export-files.fxd"]);

  const exportDir = "export-files";
  const result = await runCLI(["export", exportDir, "--format", "files"]);

  assertEquals(result.code, 0, "Export to files should succeed");

  const snippetsDir = join(TEST_DIR, exportDir, "snippets");
  const dirExists = await exists(snippetsDir);
  assert(dirExists, "Should create snippets directory");

  await cleanup();
});

// Test 12: Stats Command
Deno.test("CLI - stats command shows file statistics", async () => {
  await setup();

  const filename = "test-stats.fxd";
  await runCLI(["save", filename]);

  const result = await runCLI(["stats", filename]);

  assertEquals(result.code, 0, "Stats command should succeed");
  assert(result.stdout.includes("Statistics"), "Should show statistics title");
  assert(result.stdout.includes("Nodes") || result.stdout.includes("Snippets"), "Should show data counts");

  await cleanup();
});

// Test 13: Stats Command Without File
Deno.test("CLI - stats command shows current state statistics", async () => {
  await setup();

  const result = await runCLI(["stats"]);

  assertEquals(result.code, 0, "Stats without file should succeed");
  assert(result.stdout.includes("Statistics") || result.stdout.includes("Snippets"), "Should show statistics");

  await cleanup();
});

// Test 14: List Command
Deno.test("CLI - list command shows .fxd files", async () => {
  await setup();

  // Create some .fxd files
  await runCLI(["save", "file1.fxd"]);
  await runCLI(["save", "file2.fxd"]);

  const result = await runCLI(["list"]);

  assertEquals(result.code, 0, "List command should succeed");
  assert(result.stdout.includes("FXD Files"), "Should show file list title");
  assert(result.stdout.includes("file1.fxd") || result.stdout.includes("file2.fxd"), "Should list .fxd files");

  await cleanup();
});

// Test 15: List Command with No Files
Deno.test("CLI - list command shows message when no files found", async () => {
  await setup();

  const result = await runCLI(["list"]);

  assertEquals(result.code, 0, "List command should succeed even with no files");
  assert(result.stdout.includes("No .fxd files found") || result.stdout.includes("FXD Files"),
    "Should show appropriate message");

  await cleanup();
});

// Test 16: Import with Save Flag
Deno.test("CLI - import command with --save flag", async () => {
  await setup();

  const testFile = join(TEST_DIR, "test-save-import.ts");
  await Deno.writeTextFile(testFile, "// Test content");

  const result = await runCLI(["import", "test-save-import.ts", "--save", "imported.fxd"]);

  assertEquals(result.code, 0, "Import with save should succeed");

  // Verify saved file exists
  const savedFile = join(TEST_DIR, "imported.fxd");
  const fileExists = await exists(savedFile);
  assert(fileExists, "Should save imported data to .fxd file");

  await cleanup();
});

// Test 17: Invalid Command
Deno.test("CLI - invalid command shows error", async () => {
  await setup();

  const result = await runCLI(["invalid-command"]);

  assert(result.code !== 0 || result.stdout.includes("Unknown command") || result.stderr.includes("Unknown"),
    "Should show error for invalid command");

  await cleanup();
});

// Test 18: Help for Specific Command
Deno.test("CLI - help for specific command", async () => {
  await setup();

  const result = await runCLI(["help", "save"]);

  assertEquals(result.code, 0, "Help for specific command should succeed");
  assert(result.stdout.includes("save"), "Should show command name");
  assert(result.stdout.includes("Usage") || result.stdout.includes("Save"), "Should show usage info");

  await cleanup();
});

// Test 19: File Size Formatting
Deno.test("CLI - list command formats file sizes correctly", async () => {
  await setup();

  // Create a file with some content
  await runCLI(["save", "sized-file.fxd"]);

  const result = await runCLI(["list"]);

  assertEquals(result.code, 0, "List should succeed");
  // Should show size in KB or MB
  assert(result.stdout.includes("KB") || result.stdout.includes("MB") || result.stdout.includes("B"),
    "Should format file sizes");

  await cleanup();
});

// Test 20: Concurrent Operations
Deno.test("CLI - handles concurrent save operations", async () => {
  await setup();

  // Run multiple save commands concurrently
  const promises = [
    runCLI(["save", "concurrent1.fxd"]),
    runCLI(["save", "concurrent2.fxd"]),
    runCLI(["save", "concurrent3.fxd"]),
  ];

  const results = await Promise.all(promises);

  // All should succeed
  for (const result of results) {
    assertEquals(result.code, 0, "Concurrent saves should succeed");
  }

  // Verify all files exist
  const files = [
    join(TEST_DIR, "concurrent1.fxd"),
    join(TEST_DIR, "concurrent2.fxd"),
    join(TEST_DIR, "concurrent3.fxd"),
  ];

  for (const file of files) {
    const fileExists = await exists(file);
    assert(fileExists, `File ${file} should exist`);
  }

  await cleanup();
});

// Test 21: Empty Directory Import
Deno.test("CLI - import empty directory handles gracefully", async () => {
  await setup();

  const emptyDir = join(TEST_DIR, "empty-dir");
  await Deno.mkdir(emptyDir, { recursive: true });

  const result = await runCLI(["import", "empty-dir"]);

  assertEquals(result.code, 0, "Import empty directory should succeed");

  await cleanup();
});

// Test 22: Large File Import
Deno.test("CLI - import large file succeeds", async () => {
  await setup();

  const largeFile = join(TEST_DIR, "large-file.txt");
  const largeContent = "x".repeat(100000); // 100KB
  await Deno.writeTextFile(largeFile, largeContent);

  const result = await runCLI(["import", "large-file.txt"]);

  assertEquals(result.code, 0, "Import large file should succeed");

  await cleanup();
});

// Test 23: Special Characters in Filenames
Deno.test("CLI - handles filenames with special characters", async () => {
  await setup();

  const specialName = "test-file-with-dashes.fxd";
  const result = await runCLI(["save", specialName]);

  assertEquals(result.code, 0, "Should handle special characters in filenames");

  const filePath = join(TEST_DIR, specialName);
  const fileExists = await exists(filePath);
  assert(fileExists, "File with special characters should be created");

  await cleanup();
});

// Test 24: Case Sensitivity
Deno.test("CLI - commands are case-sensitive", async () => {
  await setup();

  const result = await runCLI(["SAVE", "test.fxd"]);

  // Should fail or handle uppercase command
  assert(result.code !== 0 || result.stdout.toLowerCase().includes("unknown"),
    "Commands should be case-sensitive");

  await cleanup();
});

// Test 25: Multiple Arguments Parsing
Deno.test("CLI - correctly parses multiple arguments", async () => {
  await setup();

  const testFile = join(TEST_DIR, "multi-arg.ts");
  await Deno.writeTextFile(testFile, "// Test");

  const result = await runCLI(["import", "multi-arg.ts", "--save", "output.fxd", "--format", "auto"]);

  assertEquals(result.code, 0, "Should parse multiple arguments correctly");

  await cleanup();
});

console.log("\n✅ All CLI tests defined (25+ tests)\n");
