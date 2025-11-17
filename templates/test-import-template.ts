// ═══════════════════════════════════════════════════════════════
// @agent: CodeWeaver
// @timestamp: 2025-10-02T06:45:00Z
// @task: CRITICAL-PATH.md#0.3
// @status: complete
// @notes: Standard import template for all FXD test files
//         Includes test framework setup and global configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Standard FXD Test Import Template
 *
 * USE THIS PATTERN FOR ALL TEST FILES
 *
 * Instructions:
 * 1. Copy this template to your test file
 * 2. Adjust import paths based on your file location
 * 3. Import the modules you're testing
 * 4. Add your test cases below
 * 5. Run tests: deno test [your-file].test.ts
 */

// ═══════════════════════════════════════════════════════════════
// Test Framework Imports
// ═══════════════════════════════════════════════════════════════

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
  assertRejects,
  assert
} from "https://deno.land/std/assert/mod.ts";

// ═══════════════════════════════════════════════════════════════
// FX Core Imports (adjust path as needed)
// ═══════════════════════════════════════════════════════════════

import {
  $$,
  $_$$,
  fx,
  $val,
  $set,
  $get
} from "../fxn.ts";  // ← Adjust: test/*.ts uses ../fxn.ts

import type {
  FXNode,
  FXNodeProxy
} from "../fxn.ts";

// ═══════════════════════════════════════════════════════════════
// Module Imports (what you're testing)
// ═══════════════════════════════════════════════════════════════

// Example - uncomment and adjust:
// import { createSnippet } from "../modules/fx-snippets.ts";
// import { renderView } from "../modules/fx-view.ts";
// import type { Snippet } from "../modules/fx-types.ts";

// ═══════════════════════════════════════════════════════════════
// Global Setup (REQUIRED for tests to access FX APIs)
// ═══════════════════════════════════════════════════════════════

// Make FX APIs available globally for tests
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;

// ═══════════════════════════════════════════════════════════════
// Test Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Reset FX state between tests to avoid interference
 */
function resetFX() {
  // Clear all nodes (if needed)
  // This depends on your FX implementation
}

/**
 * Create a temporary test node
 */
function createTestNode(path: string, value?: any): FXNodeProxy {
  const node = $$(path);
  if (value !== undefined) {
    node.val(value);
  }
  return node;
}

// ═══════════════════════════════════════════════════════════════
// Agent Annotation (REQUIRED)
// ═══════════════════════════════════════════════════════════════

// @agent: [YOUR-AGENT-NAME]
// @timestamp: [CURRENT-ISO-TIMESTAMP]
// @task: [TASK-FILE]#[TASK-NUMBER]
// @status: [in_progress|complete]
// @notes: [What you're testing and why]

// ═══════════════════════════════════════════════════════════════
// Test Cases
// ═══════════════════════════════════════════════════════════════

/**
 * Example test showing basic setup
 */
Deno.test("example test - FX node creation", () => {
  // Create a test node
  const node = createTestNode("test.example", { value: 42 });

  // Assert it exists
  assertExists(node);

  // Assert value is correct
  assertEquals(node.val(), { value: 42 });
});

/**
 * Example test with setup and teardown
 */
Deno.test("example test - with cleanup", () => {
  // Setup
  const testPath = "test.cleanup";
  $$(testPath).val({ data: "test" });

  // Test
  assertEquals($$(testPath).val().data, "test");

  // Cleanup (if needed)
  // resetFX();
});

/**
 * Example async test
 */
Deno.test("example async test", async () => {
  // Async operations
  const result = await Promise.resolve(42);
  assertEquals(result, 42);
});

/**
 * Example test expecting errors
 */
Deno.test("example error test", () => {
  assertThrows(
    () => {
      // Code that should throw
      throw new Error("Expected error");
    },
    Error,
    "Expected error"
  );
});

// ═══════════════════════════════════════════════════════════════
// Test Organization Tips
// ═══════════════════════════════════════════════════════════════

/**
 * Group related tests:
 *
 * Deno.test("module-name: specific feature", () => { ... });
 * Deno.test("module-name: another feature", () => { ... });
 *
 * Use descriptive names:
 * - Good: "fx-snippets: createSnippet() generates unique IDs"
 * - Bad:  "test 1"
 *
 * Test edge cases:
 * - Empty inputs
 * - Null/undefined
 * - Large datasets
 * - Circular references
 *
 * Clean up after tests:
 * - Reset state if tests interfere with each other
 * - Use unique test paths: `test.${Date.now()}.mytest`
 */
