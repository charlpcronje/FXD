# Agent: critical-path
**Priority:** P0 - BLOCKING ALL OTHER WORK
**Estimated Time:** 4-6 hours
**Dependencies:** None
**Blocks:** All other agents

---

## 🎯 Mission

Fix core exports and create import template. This MUST be completed before any other agent can start work.

---

## 📋 Tasks

### Task 0.1: Verify Core File
**Time:** 15 minutes
**Status:** ⬜ Not Started

```bash
# Determine which file is canonical
cd c:/dev/fxd
ls -la fx.ts fxn.ts

# Check which one is being used
grep -r "from.*fx.ts" test/ examples/ modules/ | wc -l
grep -r "from.*fxn.ts" test/ examples/ modules/ | wc -l

# Decision: Pick the one more commonly imported
# For this task, we'll assume fxn.ts
```

**Deliverable:** Canonical file identified

---

### Task 0.2: Fix Core Exports
**Time:** 30 minutes
**Status:** ⬜ Not Started

**File:** `fxn.ts` (or `fx.ts`)

**Action:** Add/verify these exports at the end of the file:

```typescript
// @agent: agent-critical-path
// @timestamp: [FILL IN]
// @task: CRITICAL-PATH.md#0.2
// @status: [FILL IN]

// Ensure all exports are present
export {
  fx,
  FXCore,
  $$,
  $_$$,
  $app,
  $config,
  $plugins,
  $modules,
  $atomics,
  $dom,
  $session,
  $system,
  $cache,
  $root,
  $val,
  $set,
  $get,
  $has
};

export type {
  FXNode,
  FXNodeProxy,
  FXOpts,
  FXBuiltInViews,
  FXMutableValue
};

export default fx;
```

**Verification:**
```bash
deno check fxn.ts
# Should compile with zero errors
```

**Deliverable:** Core file exports verified and working

---

### Task 0.3: Create Import Template
**Time:** 15 minutes
**Status:** ⬜ Not Started

**Create:** `templates/module-import-template.ts`

```typescript
/**
 * Standard FXD Module Import Template
 *
 * @agent: agent-critical-path
 * @timestamp: [FILL IN]
 * @task: CRITICAL-PATH.md#0.3
 *
 * USE THIS PATTERN FOR ALL MODULE FILES
 */

// ===========================================
// Core FX Imports (from fxn.ts or fx.ts)
// ===========================================

import { $$, $_$$, fx } from '../fxn.ts';  // Adjust path as needed
import type { FXNode, FXNodeProxy, FXOpts } from '../fxn.ts';

// ===========================================
// Other Module Imports (if needed)
// ===========================================

// import { someFunction } from './fx-other-module.ts';

// ===========================================
// Module Code
// ===========================================

export function yourFunction() {
  // Now $$ is available
  const node = $$("path").node();
  // ...
}
```

**Also Create:** `templates/test-import-template.ts`

```typescript
/**
 * Standard FXD Test Import Template
 *
 * @agent: agent-critical-path
 * @timestamp: [FILL IN]
 * @task: CRITICAL-PATH.md#0.3
 */

// ===========================================
// Test Framework Imports
// ===========================================

import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";

// ===========================================
// FX Core Imports
// ===========================================

import { $$, $_$$, fx } from "../fxn.ts";  // Adjust path
import type { FXNode, FXNodeProxy } from "../fxn.ts";

// ===========================================
// Module Imports (what you're testing)
// ===========================================

import { yourFunction } from "../modules/fx-your-module.ts";

// ===========================================
// Global Setup (for tests)
// ===========================================

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// ===========================================
// Tests
// ===========================================

Deno.test("your test", () => {
  // Test code
});
```

**Deliverable:** Import templates created

---

### Task 0.4: Test Import Pattern
**Time:** 30 minutes
**Status:** ⬜ Not Started

**Action:** Fix ONE module file as proof of concept

**File:** `modules/fx-snippets.ts`

1. Open file
2. Find all uses of `$$`, `fx`, `$_$$`
3. Add import at top using template
4. Save file
5. Test compilation

```bash
# Test the fix
deno check modules/fx-snippets.ts

# Should now compile successfully
```

**If successful:** Pattern is validated ✅
**If errors:** Debug and fix template, then retry

**Deliverable:** One module successfully importing and compiling

---

### Task 0.5: Document Import Fix Instructions
**Time:** 30 minutes
**Status:** ⬜ Not Started

**Create:** `tasks/IMPORT-FIX-INSTRUCTIONS.md`

```markdown
# Import Fix Instructions for All Agents

## Pattern Validated ✅

The import pattern has been tested and works.

## For Module Files (modules/fx-*.ts)

1. Add this at the top:
   \`\`\`typescript
   import { $$, $_$$, fx } from '../fxn.ts';
   import type { FXNode, FXNodeProxy } from '../fxn.ts';
   \`\`\`

2. Add agent annotation:
   \`\`\`typescript
   // @agent: [your-agent-name]
   // @timestamp: [current-timestamp]
   // @task: [your-task-file]#[task-number]
   \`\`\`

3. Compile to verify:
   \`\`\`bash
   deno check modules/fx-[yourfile].ts
   \`\`\`

## For Test Files (test/*.test.ts)

1. Add imports:
   \`\`\`typescript
   import { assertEquals } from "https://deno.land/std/assert/mod.ts";
   import { $$, $_$$, fx } from "../fxn.ts";
   import type { FXNode } from "../fxn.ts";
   \`\`\`

2. Add globals:
   \`\`\`typescript
   globalThis.$$ = $$;
   globalThis.$_$$ = $_$$;
   \`\`\`

## For Examples (examples/**/*.ts)

1. Add imports (adjust path depth):
   \`\`\`typescript
   import { $$, $_$$, fx } from "../../fxn.ts";
   \`\`\`

2. Add globals:
   \`\`\`typescript
   globalThis.$$ = $$;
   globalThis.$_$$ = $_$$;
   \`\`\`

## Verification Checklist

- [ ] File compiles: \`deno check [file]\`
- [ ] No TypeScript errors
- [ ] Agent annotation added
- [ ] Status updated in task file

## Example Success

See: modules/fx-snippets.ts (first file fixed)
```

**Deliverable:** Clear instructions for other agents

---

### Task 0.6: Signal Completion
**Time:** 15 minutes
**Status:** ⬜ Not Started

**Action:** Update status and signal other agents

1. Update this file's status section
2. Create signal file: `tasks/.critical-path-complete`
3. Update `tasks/STATUS.md` with completion

**Create:** `tasks/.critical-path-complete`

```json
{
  "status": "complete",
  "timestamp": "[FILL IN]",
  "agent": "agent-critical-path",
  "deliverables": {
    "core_exports": "✅ Complete",
    "import_template": "✅ Complete",
    "test_fix": "✅ Complete",
    "instructions": "✅ Complete"
  },
  "message": "All agents are unblocked. Parallel work can begin.",
  "next_step": "Launch all parallel agents"
}
```

**Deliverable:** All agents signaled to start

---

## 🎯 Success Criteria

- [ ] Core file (fxn.ts or fx.ts) exports verified
- [ ] Zero compilation errors in core file
- [ ] Import templates created and documented
- [ ] One module (fx-snippets.ts) successfully fixed as proof
- [ ] That module compiles without errors
- [ ] Instructions documented for other agents
- [ ] Signal file created
- [ ] All other agents notified to begin

---

## 📊 Progress Tracking

### Started
**Time:** _____________
**Agent:** agent-critical-path

### Task Progress
- [ ] 0.1: Core file verified (15 min)
- [ ] 0.2: Exports fixed (30 min)
- [ ] 0.3: Templates created (15 min)
- [ ] 0.4: Pattern tested (30 min)
- [ ] 0.5: Instructions documented (30 min)
- [ ] 0.6: Signal sent (15 min)

### Completed
**Time:** _____________
**Total Duration:** _____________
**Status:** ⬜ Not Started | 🚧 In Progress | ✅ Complete

---

## 🚨 Blockers

If you encounter issues:

1. **Compilation errors in core:**
   - Check syntax
   - Verify all exports exist
   - Check for circular dependencies

2. **Template doesn't work:**
   - Verify import path is correct
   - Check if file is in different location
   - Adjust relative paths

3. **Module still has errors after import:**
   - Check if module uses other undefined globals
   - May need additional imports
   - Document edge cases

**Report blockers in:** `tasks/BLOCKERS.md`

---

## 📝 Notes

- This is THE critical path - everything depends on this
- Take time to get it right
- Verify thoroughly before signaling completion
- Document any edge cases discovered

---

## ✅ Final Checklist

Before marking complete:

- [ ] Core file compiles
- [ ] Templates created
- [ ] Pattern validated on one module
- [ ] Instructions clear and documented
- [ ] Signal file created
- [ ] No outstanding errors
- [ ] Ready for parallel work to begin

**Once complete, ALL other agents can start work simultaneously.**
