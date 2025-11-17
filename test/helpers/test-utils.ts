// ═══════════════════════════════════════════════════════════════
// @agent: agent-test-infra
// @timestamp: 2025-10-02T07:35:00Z
// @task: TRACK-A-TESTS.md#A.2
// @status: complete
// @notes: Created test helper utilities for test infrastructure
// ═══════════════════════════════════════════════════════════════

/**
 * Test Utilities
 * Provides helper functions for FXD test suite
 */

import { $$, $_$$, fx } from "../../fxn.ts";
import type { FXNode } from "../../fxn.ts";

/**
 * Clear test data between tests
 * Removes all child nodes from a given path
 */
export function cleanupTestNodes(path: string = "test") {
  const node = $$(path).node();
  if (node.__nodes) {
    for (const key in node.__nodes) {
      delete node.__nodes[key];
    }
  }
}

/**
 * Create temporary test node
 * Creates a node at the given path with optional value
 */
export function createTestNode(path: string, value?: any) {
  $$(path).val(value);
  return $$(path);
}

/**
 * Wait for async operations in tests
 * Simple delay helper for testing async behavior
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert node exists and has value
 * Throws error if node value doesn't match expected
 */
export function assertNodeValue(path: string, expectedValue: any) {
  const actual = $$(path).val();
  if (actual !== expectedValue) {
    throw new Error(`Expected ${path} to be ${expectedValue}, got ${actual}`);
  }
}

/**
 * Get all child node keys from a path
 * Returns array of child node names
 */
export function getChildNodes(path: string): string[] {
  const node = $$(path).node();
  return node.__nodes ? Object.keys(node.__nodes) : [];
}

/**
 * Deep clone a node structure
 * Creates a copy of node data (not proxies)
 */
export function cloneNode(node: FXNode): any {
  return {
    __value: node.__value,
    __type: node.__type,
    __meta: node.__meta ? { ...node.__meta } : undefined,
    __nodes: node.__nodes ? Object.keys(node.__nodes).reduce((acc, key) => {
      acc[key] = cloneNode(node.__nodes[key]);
      return acc;
    }, {} as Record<string, any>) : {}
  };
}

/**
 * Setup test environment
 * Call this in test setup to ensure globals are configured
 */
export function setupTestEnvironment() {
  (globalThis as any).$$ = $$;
  (globalThis as any).$_$$ = $_$$;
  (globalThis as any).fx = fx;
}

/**
 * Teardown test environment
 * Clean up test data after tests
 */
export function teardownTestEnvironment(rootPath: string = "test") {
  cleanupTestNodes(rootPath);
}
