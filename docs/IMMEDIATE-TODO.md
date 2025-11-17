# FXD Immediate TODO - Start Here
**Last Updated:** 2025-10-02
**Current Blocker:** Module imports
**Time to Fix:** 4-6 hours
**Then:** Everything will work

---

## 🔥 DO THIS FIRST - Module Import Fix

### Problem
Every module file has:
```
TS2304 [ERROR]: Cannot find name '$$'
```

### Root Cause
Modules trying to use `$$` but can't import it correctly from fx.ts/fxn.ts

### Solution (4-6 hours of work)

---

## ✅ Task 1: Pick Your Core File (5 minutes)

You have two nearly identical files:
- `fx.ts` (1,738 lines)
- `fxn.ts` (probably similar)

**Decision needed:** Which one is canonical?

```bash
# Check which is newer/better
ls -la fx.ts fxn.ts

# Pick one, rename the other
mv fx.ts fx-old.ts.backup  # If using fxn.ts
# OR
mv fxn.ts fxn-old.ts.backup  # If using fx.ts

# For this guide, I'll assume you're using fxn.ts
```

**👉 ACTION:** Decide on `fxn.ts` or `fx.ts` - stick with it

---

## ✅ Task 2: Verify Exports in Core File (30 minutes)

```bash
# Open fxn.ts (or fx.ts)
# Scroll to the end
# Check exports
```

**Current exports should include:**

```typescript
// Around line 1635 in fxn.ts
export { fx };
export const $_$$ = fx.createNodeProxy(fx.root);
fx.ensureSystemRoots();

export let $$: FXNodeProxy = $_$$("app");
export const $root = (p: string) => { $$ = $_$$(p); (globalThis as any).$$ = $$; };
export const $val = (path: string, value?: any, def?: any) => { /* ... */ };
export const $set = (path: string, value: any) => $$(path).set(value);
export const $get = (path: string) => $$(path).get();
export const $has = (path: string) => $$(path).val() !== undefined;

export const $app = $_$$('app');
export const $config = $_$$('config');
// etc...

export default fx;
```

**✅ Verify these are exported**
**✅ Add any missing exports**

Example of what to add if missing:

```typescript
// At end of fxn.ts, ensure these exist:
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

**👉 ACTION:** Update exports in fxn.ts

---

## ✅ Task 3: Fix Module Imports (2-3 hours)

### Pattern to Use

**Old/Broken:**
```typescript
// modules/fx-snippets.ts
// Missing import or wrong import
const node = $$(path).node();  // ERROR: $$ not defined
```

**New/Fixed:**
```typescript
// modules/fx-snippets.ts
import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy } from '../fxn.ts';

const node = $$(path).node();  // WORKS
```

### Files to Fix (in order)

```bash
# Fix these first (core modules):
modules/fx-snippets.ts
modules/fx-view.ts
modules/fx-parse.ts
modules/fx-group-extras.ts

# Then fix the rest:
modules/fx-*.ts  # All of them
```

### Checklist for Each File

For each `modules/fx-*.ts` file:

- [ ] Open file
- [ ] Check if it uses `$$`, `fx`, `$_$$`
- [ ] Add import at top:
  ```typescript
  import { $$, $_$$, fx } from '../fxn.ts';
  import type { FXNode, FXNodeProxy } from '../fxn.ts';
  ```
- [ ] Save file
- [ ] Run: `deno check modules/fx-[filename].ts`
- [ ] Fix any other errors
- [ ] Move to next file

**👉 ACTION:** Fix all module imports

---

## ✅ Task 4: Fix Test Imports (1 hour)

### Pattern for Tests

```typescript
// test/fx-snippets.test.ts (Example - already correct in your file)
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { $$, $_$$, fx } from "../fxn.ts";
import { createSnippet } from "../modules/fx-snippets.ts";

// Make available globally for tests
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

Deno.test("test name", () => {
  // test code
});
```

### Files to Fix

```bash
test/fx-markers.test.ts
test/fx-parse.test.ts
test/fx-snippets.test.ts
test/fx-view.test.ts
test/round-trip.test.ts
```

### Checklist for Each Test

- [ ] Open test file
- [ ] Add imports from fxn.ts:
  ```typescript
  import { $$, $_$$, fx } from "../fxn.ts";
  import type { FXNode } from "../fxn.ts";
  ```
- [ ] Add global assignments:
  ```typescript
  globalThis.$$ = $$;
  globalThis.$_$$ = $_$$;
  ```
- [ ] Save file
- [ ] Run: `deno test -A test/[filename].test.ts`
- [ ] Fix any errors
- [ ] Move to next file

**👉 ACTION:** Fix all test imports

---

## ✅ Task 5: Fix Example Imports (30 minutes)

### Pattern for Examples

```typescript
// examples/repo-js/demo.ts
import { $$, $_$$, fx } from "../../fxn.ts";
import { createSnippet } from "../../modules/fx-snippets.ts";

// Make available globally
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Now use it
const snippet = createSnippet("hello", "console.log('hi')");
```

### Files to Fix

```bash
examples/repo-js/demo.ts
examples/repo-js/seed.ts
# Any other example files
```

**👉 ACTION:** Fix example imports

---

## ✅ Task 6: Verify Everything Compiles (30 minutes)

```bash
# Run these commands and ensure ZERO errors:

# Core
deno check fxn.ts

# Modules (check a few key ones)
deno check modules/fx-snippets.ts
deno check modules/fx-view.ts
deno check modules/fx-parse.ts
deno check modules/fx-group-extras.ts

# All modules
for file in modules/fx-*.ts; do
  echo "Checking $file..."
  deno check "$file" || echo "FAILED: $file"
done

# Tests
deno check test/fx-snippets.test.ts
deno check test/fx-view.test.ts

# Examples
deno check examples/repo-js/demo.ts
```

**Goal:** All files compile with ZERO errors

**👉 ACTION:** Verify compilation

---

## ✅ Task 7: Run Tests (15 minutes)

```bash
# Try running tests
deno test -A test/

# If they fail, fix one at a time:
deno test -A test/fx-snippets.test.ts
# Fix errors, get it passing

deno test -A test/fx-view.test.ts
# Fix errors, get it passing

# Goal: Get at least 3-5 tests passing
```

**👉 ACTION:** Get tests running

---

## ✅ Task 8: Run Examples (15 minutes)

```bash
# With FX_SERVE=false to avoid port conflicts
FX_SERVE=false deno run -A examples/repo-js/demo.ts

# Should run without errors
# If it fails, fix the imports in the example
```

**👉 ACTION:** Get examples running

---

## 🎯 Definition of Done (Today)

After 4-6 hours of work, you should have:

- ✅ One canonical core file (fxn.ts or fx.ts) with proper exports
- ✅ All modules import correctly from core
- ✅ All tests import correctly from core
- ✅ All examples import correctly from core
- ✅ Everything compiles with zero TypeScript errors
- ✅ At least 3-5 tests passing
- ✅ At least 1 example running

**THAT'S IT. That's all you need to do TODAY.**

---

## 📋 Quick Checklist

Copy this and check off as you go:

```markdown
## Today's Progress (Date: ______)

### Core File
- [ ] Picked canonical file (fxn.ts or fx.ts)
- [ ] Verified all exports present
- [ ] File compiles with zero errors

### Modules Fixed
- [ ] fx-snippets.ts
- [ ] fx-view.ts
- [ ] fx-parse.ts
- [ ] fx-group-extras.ts
- [ ] (Add others as you go)

### Tests Fixed
- [ ] fx-snippets.test.ts
- [ ] fx-view.test.ts
- [ ] fx-parse.test.ts
- [ ] (Add others as you go)

### Examples Fixed
- [ ] repo-js/demo.ts
- [ ] repo-js/seed.ts

### Verification
- [ ] Core file compiles: `deno check fxn.ts`
- [ ] Modules compile: `deno check modules/fx-*.ts`
- [ ] Tests compile: `deno check test/*.ts`
- [ ] Examples compile: `deno check examples/**/*.ts`
- [ ] Tests run: `deno test -A test/`
- [ ] Example runs: `FX_SERVE=false deno run -A examples/repo-js/demo.ts`

### Results
- Compilation errors: _____ (goal: 0)
- Tests passing: _____ (goal: 3-5)
- Examples running: _____ (goal: 1+)
```

---

## 🚨 If You Get Stuck

### Common Issues

**1. "Cannot find module"**
- Check import path is correct: `../fxn.ts` from modules, `../../fxn.ts` from examples
- Make sure file exists at that path

**2. "Duplicate identifier"**
- Importing same thing twice
- Remove duplicate import

**3. "Type X is not assignable to type Y"**
- Import the TYPE: `import type { FXNode } from '../fxn.ts'`
- Not the value

**4. "Port already in use"**
- Run with `FX_SERVE=false` to disable server
- Or kill existing process

### Need Help?

1. Start with smallest fix first (one file)
2. Get that file working completely
3. Copy pattern to next file
4. Repeat

---

## 🎉 When You're Done

You'll have:
- Working imports ✅
- Compiling code ✅
- Passing tests ✅
- Running examples ✅

**Then you can move to Week 2 of the plan: Integration**

But first, fix the imports. Everything else depends on this.

---

## 🔄 Summary

1. **Pick core file** (fxn.ts or fx.ts)
2. **Fix exports** in that file
3. **Fix imports** in all modules
4. **Fix imports** in all tests
5. **Fix imports** in all examples
6. **Verify** everything compiles
7. **Run** tests and examples

**Time:** 4-6 hours
**Result:** Everything works

**START NOW. Fix the imports. Then move to integration.**
