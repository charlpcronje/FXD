// ═══════════════════════════════════════════════════════════════
// @agent: agent-test-infra
// @timestamp: 2025-10-02T07:36:00Z
// @task: TRACK-A-TESTS.md#A.3
// @status: complete
// @notes: Created integration test framework
// ═══════════════════════════════════════════════════════════════

/**
 * Integration Test Framework
 * Tests end-to-end workflows across multiple modules
 */

import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";
import { $$, $_$$, fx } from "../../fxn.ts";
import { createSnippet } from "../../modules/fx-snippets.ts";

// Setup globals
(globalThis as any).$$ = $$;
(globalThis as any).$_$$ = $_$$;
(globalThis as any).fx = fx;

Deno.test("Integration: Create snippet basic workflow", { sanitizeResources: false, sanitizeOps: false }, () => {
  // Create snippet
  const snippet = createSnippet("test.snippet", "console.log('hello');");
  assertEquals(snippet.val(), "console.log('hello');");

  // Verify it has correct type
  assertEquals(snippet.type(), "snippet");

  // Verify metadata exists
  const meta = snippet.node().__meta;
  assertExists(meta);
});

Deno.test("Integration: Multiple snippets workflow", { sanitizeResources: false, sanitizeOps: false }, () => {
  // Clear any existing test nodes first
  const testRoot = $$("test").node();
  if (testRoot.__nodes) {
    for (const key in testRoot.__nodes) {
      delete testRoot.__nodes[key];
    }
  }

  // Create multiple snippets
  createSnippet("test.s1", "code1", { id: "s1" });
  createSnippet("test.s2", "code2", { id: "s2" });
  createSnippet("test.s3", "code3", { id: "s3" });

  // Verify all exist
  assertEquals($$("test.s1").val(), "code1");
  assertEquals($$("test.s2").val(), "code2");
  assertEquals($$("test.s3").val(), "code3");

  // Cleanup
  for (const key in testRoot.__nodes) {
    delete testRoot.__nodes[key];
  }
});

// Note: More integration tests will be enabled as modules are completed
// by other agents (agent-modules-core, agent-modules-views, etc.)

Deno.test.ignore("Integration: Create snippet and render view - waiting for module", () => {
  // @agent: agent-test-infra
  // @note: Depends on renderView from agent-modules-views
  // Will enable when fx-view.ts module is ready

  // const snippet = createSnippet("test.snippet", "console.log('hello');");
  // const view = renderView("test.view");
  // assertExists(view);
});

Deno.test.ignore("Integration: End-to-end workflow - waiting for modules", () => {
  // @agent: agent-test-infra
  // @note: Depends on modules from agent-modules-*
  // Test complete workflow:
  // 1. Create snippets
  // 2. Organize in groups
  // 3. Create view
  // 4. Render view
  // This validates all modules work together
});
