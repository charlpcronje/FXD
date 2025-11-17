// ═══════════════════════════════════════════════════════════════
// @agent: CodeWeaver
// @timestamp: 2025-10-02T06:45:00Z
// @task: CRITICAL-PATH.md#0.3
// @status: complete
// @notes: Standard import template for all FXD modules
//         Use this pattern for consistent imports across the codebase
// ═══════════════════════════════════════════════════════════════

/**
 * Standard FXD Module Import Template
 *
 * USE THIS PATTERN FOR ALL MODULE FILES
 *
 * Instructions:
 * 1. Copy this template to your module file
 * 2. Adjust the import path based on your file location
 * 3. Import only what you need from the lists below
 * 4. Add your agent annotation header
 * 5. Test compilation: deno check [your-file].ts
 */

// ═══════════════════════════════════════════════════════════════
// Core FX Imports (adjust path as needed)
// ═══════════════════════════════════════════════════════════════

// Runtime values - use these to interact with FX nodes
import {
  $$,           // Main node proxy - most common
  $_$$,         // Root node proxy
  fx,           // FX core instance
  $app,         // App root shortcut
  $config,      // Config root shortcut
  $val,         // Value helper
  $set,         // Set helper
  $get,         // Get helper
  $has          // Has helper
} from '../fxn.ts';  // ← Adjust path: ../fxn.ts or ../../fxn.ts etc.

// TypeScript types - use these for type annotations
import type {
  FXNode,           // Base node interface
  FXNodeProxy,      // Proxy type
  FXOpts,           // Node options
  FXBuiltInViews,   // Built-in view methods
  FXMutableValue    // Value type
} from '../fxn.ts';  // ← Same path as above

// ═══════════════════════════════════════════════════════════════
// Other Module Imports (if your module depends on others)
// ═══════════════════════════════════════════════════════════════

// Example - uncomment and adjust as needed:
// import { createSnippet } from './fx-snippets.ts';
// import { renderView } from './fx-view.ts';
// import type { Snippet, View } from './fx-types.ts';

// ═══════════════════════════════════════════════════════════════
// Agent Annotation (REQUIRED for all code you write)
// ═══════════════════════════════════════════════════════════════

// @agent: [YOUR-AGENT-NAME]
// @timestamp: [CURRENT-ISO-TIMESTAMP]
// @task: [TASK-FILE]#[TASK-NUMBER]
// @status: [in_progress|complete]
// @notes: [Brief description of what this module does]

// ═══════════════════════════════════════════════════════════════
// Module Code
// ═══════════════════════════════════════════════════════════════

/**
 * Example function showing how to use imported FX APIs
 */
export function exampleFunction(path: string, value: any): FXNode {
  // Now $$ is available and typed correctly
  const node = $$(path).node();

  // Set value using the proxy
  $$(path).val(value);

  // Access FX core instance
  const rootNode = fx.root;

  // Return the node
  return node;
}

/**
 * Example with type annotations
 */
export function exampleWithTypes(path: string): FXNodeProxy {
  // Return type is properly typed
  return $$(path);
}

// ═══════════════════════════════════════════════════════════════
// Path Reference Guide
// ═══════════════════════════════════════════════════════════════

/**
 * Adjust import path based on your file location:
 *
 * modules/fx-yourmodule.ts        → '../fxn.ts'
 * modules/subdir/fx-yourmodule.ts → '../../fxn.ts'
 * plugins/fx-yourplugin.ts        → '../fxn.ts'
 * test/yourtest.test.ts           → '../fxn.ts'
 * examples/yourexample.ts         → '../fxn.ts'
 * examples/subdir/yourexample.ts  → '../../fxn.ts'
 */
