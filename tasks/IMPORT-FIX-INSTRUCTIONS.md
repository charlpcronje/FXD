# Import Fix Instructions for All Agents

**Pattern Validated:** ✅ **PROOF OF CONCEPT COMPLETE**
**Validated On:** `modules/fx-snippets.ts`
**Compilation Test:** ✅ PASSING
**Created By:** CodeWeaver (Agent 0)
**Date:** 2025-10-02T06:50:00Z

---

## ✅ Pattern Validated and Working

The import pattern has been tested on `modules/fx-snippets.ts` and **COMPILES SUCCESSFULLY**.

---

## 📋 For Module Files (`modules/fx-*.ts`)

### Step 1: Add Imports at Top of File

```typescript
// ═══════════════════════════════════════════════════════════════
// @agent: [YOUR-AGENT-NAME]
// @timestamp: [CURRENT-ISO-TIMESTAMP]
// @task: [YOUR-TASK-FILE]#[TASK-NUMBER]
// @status: [in_progress|complete]
// @notes: [What you fixed and why]
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Core FX Imports
// ═══════════════════════════════════════════════════════════════

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy } from '../fxn.ts';
```

### Step 2: Add Your Agent Annotation

**REQUIRED** - Add this header to every function or major code block you modify:

```typescript
// ═══════════════════════════════════════════════════════════════
// @agent: YourAgentName
// @timestamp: 2025-10-02T07:00:00Z
// @task: TRACK-X-MODULE.md#1.2
// @status: complete
// @notes: Brief description of what you did
// ═══════════════════════════════════════════════════════════════
```

### Step 3: Verify Compilation

```bash
deno check modules/fx-[yourfile].ts
```

**Expected output:**
```
Check file:///C:/dev/fxd/modules/fx-yourfile.ts
```

No errors = SUCCESS ✅

---

## 📋 For Test Files (`test/*.test.ts`)

### Step 1: Add Imports

```typescript
// ═══════════════════════════════════════════════════════════════
// Test Framework Imports
// ═══════════════════════════════════════════════════════════════

import {
  assertEquals,
  assertExists,
  assert
} from "https://deno.land/std/assert/mod.ts";

// ═══════════════════════════════════════════════════════════════
// FX Core Imports
// ═══════════════════════════════════════════════════════════════

import { $$, $_$$, fx } from "../fxn.ts";
import type { FXNode, FXNodeProxy } from "../fxn.ts";

// ═══════════════════════════════════════════════════════════════
// Module Under Test
// ═══════════════════════════════════════════════════════════════

import { createSnippet } from "../modules/fx-snippets.ts";
```

### Step 2: Add Global Setup

```typescript
// ═══════════════════════════════════════════════════════════════
// Global Setup (REQUIRED for tests)
// ═══════════════════════════════════════════════════════════════

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;
```

### Step 3: Write Tests

```typescript
Deno.test("module-name: test description", () => {
  // Your test code
  const result = createSnippet("test.snippet", "code");
  assertExists(result);
});
```

---

## 📋 For Examples (`examples/**/*.ts`)

### Step 1: Add Imports (Adjust Path Depth)

```typescript
// For examples/ root:
import { $$, $_$$, fx } from "../fxn.ts";

// For examples/subdir/:
import { $$, $_$$, fx } from "../../fxn.ts";
```

### Step 2: Add Globals (Optional but Recommended)

```typescript
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;
globalThis.fx = fx;
```

---

## 🎯 Path Reference Guide

Adjust import path based on your file location:

| File Location | Import Path |
|---------------|-------------|
| `modules/fx-yourmodule.ts` | `'../fxn.ts'` |
| `modules/subdir/fx-yourmodule.ts` | `'../../fxn.ts'` |
| `plugins/fx-yourplugin.ts` | `'../fxn.ts'` |
| `test/yourtest.test.ts` | `'../fxn.ts'` |
| `examples/yourexample.ts` | `'../fxn.ts'` |
| `examples/subdir/yourexample.ts` | `'../../fxn.ts'` |

---

## ✅ Verification Checklist

Before marking your task complete:

- [ ] Imports added at top of file
- [ ] Agent annotation header added
- [ ] File compiles: `deno check [file]`
- [ ] No TypeScript errors
- [ ] Status updated in your task file
- [ ] Timestamp is current ISO format

---

## 🎯 Proof of Concept

**Successfully Fixed:** `modules/fx-snippets.ts`

**Before:**
```typescript
// No imports - $$ was undefined
export function indexSnippet(path: string, id?: string) {
    const node = $$(path).node() as any;  // ERROR: $$ not found
```

**After:**
```typescript
import { $$, $_$$, fx } from '../fxn.ts';  // ← Added

export function indexSnippet(path: string, id?: string) {
    const node = $$(path).node() as any;  // ✅ WORKS
```

**Result:** ✅ Compiles successfully

---

## 📖 Templates Available

Use these as starting points:

- `templates/module-import-template.ts` - For modules
- `templates/test-import-template.ts` - For tests

---

## 🚨 Common Issues

### Issue: "Cannot find name '$$'"

**Solution:** Add import: `import { $$ } from '../fxn.ts';`

### Issue: "Relative import path ... not prefixed with..."

**Solution:** Ensure path starts with `../` or `../../`

### Issue: Circular dependency

**Solution:** Don't import from modules that import you. Restructure if needed.

### Issue: Type errors after import

**Solution:** Add type imports: `import type { FXNode } from '../fxn.ts';`

---

## 🎯 Next Steps for Other Agents

1. **Wait for signal file:** `tasks/.critical-path-complete`
2. **Read this file** to understand the pattern
3. **Apply to your assigned files** according to your track
4. **Test compilation** after each fix
5. **Update your task file** progress
6. **Annotate all your code** with agent headers

---

**Pattern validated by:** CodeWeaver (Agent 0)
**Ready for:** All parallel agents to begin work
**Status:** ✅ **CRITICAL PATH COMPLETE - ALL AGENTS UNBLOCKED**
