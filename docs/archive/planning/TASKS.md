# FXD Completion Tasks - Detailed Specification

**Estimated Total Time: 2-3 hours** (based on previous context)
**Last Updated:** 2025-11-09

---

## Task 0: Test Infrastructure (PREREQUISITE)

### Pre-flight Check
- [ ] Verify `test/` directory exists
- [ ] Check for existing test runner in `test/run-all-tests.ts`
- [ ] Verify Deno test framework available

### What to Build
**File:** `test/run-all-tests.ts`

**Requirements:**
1. Auto-discover all `*.test.ts` files in `test/` directory
2. Dynamically import and run each test file
3. Capture results per file, per module, globally
4. Generate JSON report + console output
5. Exit with non-zero code if any tests fail

**Expected Output Structure:**
```typescript
interface TestReport {
  timestamp: string;
  totalFiles: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  files: FileReport[];
}

interface FileReport {
  file: string;
  module: string; // extracted from filename
  tests: number;
  passed: number;
  failed: number;
  errors: string[];
  duration: number;
}
```

### Success Criteria
- [ ] Run `deno test test/run-all-tests.ts` discovers all test files
- [ ] Console shows per-file results
- [ ] JSON report saved to `test-results.json`
- [ ] Exit code 0 if all pass, 1 if any fail

### Test for This Task
```bash
# Should discover and list all test files
deno run -A test/run-all-tests.ts --dry-run

# Should run all tests and generate report
deno test -A test/run-all-tests.ts
```

### Documentation
Update `docs/TESTING.md` with:
- How to run all tests
- How to run individual test files
- How to read test reports
- How to add new tests

---

## Task 1: Fix TypeScript Global Declarations

### Pre-flight Check
```bash
# Verify the error exists
deno test test/fx-snippets.test.ts
# Should show: TS7017: Element implicitly has an 'any' type
```

**Check these files:**
- `test/fx-snippets.test.ts` - Line with `globalThis.$$ = $$`
- `test/fx-view.test.ts` - Same pattern
- `test/fx-parse.test.ts` - Same pattern

### What to Fix
**File:** `types.d.ts` (create if doesn't exist)

```typescript
import type { FXNode } from "./fxn.ts";

declare global {
  var $$: (path: string) => FXNode;
  var $_$$: FXNode;
  var fx: {
    version: string;
    nodes: Map<string, FXNode>;
  };
}

export {};
```

**Update:** Each test file should have at top:
```typescript
/// <reference path="../types.d.ts" />
```

### Success Criteria
- [ ] No TypeScript errors in test files
- [ ] `deno check test/fx-snippets.test.ts` passes
- [ ] `deno check test/fx-view.test.ts` passes
- [ ] `deno check test/fx-parse.test.ts` passes

### Test
```bash
# Should complete without TS errors
deno check test/*.test.ts

# Each test file should run
deno test test/fx-snippets.test.ts
deno test test/fx-view.test.ts
deno test test/fx-parse.test.ts
```

### Documentation
Update `docs/GETTING-STARTED.md`:
- Section on TypeScript configuration
- Explain global type declarations

---

## Task 2: Standardize Core Import Path

### Pre-flight Check
```bash
# Find all files importing from fx.ts vs fxn.ts
grep -r "from './fx.ts'" .
grep -r "from '../fx.ts'" .
grep -r "from './fxn.ts'" .
```

**Expected findings:**
- `fxd-cli.ts` line 12: `import { $$, $_$$ } from './fx.ts'`
- Multiple module files: `import { $$ } from '../fxn.ts'`

**Verify which is canonical:**
- [ ] Check if `fxn.ts` exists and has FXNode class
- [ ] Check if `fx.ts` exists and what it exports
- [ ] Determine which is the "real" core

### What to Fix
**Decision:** Use `fxn.ts` as canonical (it has the full implementation)

**Files to update:**
1. `fxd-cli.ts` line 12: Change to `from './fxn.ts'`
2. Any other files importing from `fx.ts`

**Optional:** Create `fx.ts` as a re-export for compatibility:
```typescript
// fx.ts - Compatibility re-export
export * from './fxn.ts';
```

### Success Criteria
- [ ] All imports use `fxn.ts` OR use `fx.ts` which re-exports `fxn.ts`
- [ ] No duplicate code between `fx.ts` and `fxn.ts`
- [ ] `deno check fxd-cli.ts` passes
- [ ] All modules can resolve imports

### Test
```bash
# Should run without import errors
deno run -A fxd-cli.ts help

# Should import correctly
deno check fxd-cli.ts
deno check modules/fx-snippets.ts
deno check modules/fx-view.ts
```

### Documentation
Update `README.md`:
- Clarify that `fxn.ts` is the core
- Document import conventions

---

## Task 3: Run Snippet Tests and Fix Issues

### Pre-flight Check
```bash
# Verify test file exists
ls -la test/fx-snippets.test.ts

# Check what methods are tested
grep "describe\|it(" test/fx-snippets.test.ts
```

**Expected test coverage:**
- `createSnippet()` - Create snippet with options
- `wrapSnippet()` - Wrap with FX:BEGIN/END markers
- Snippet indexing - ID lookup
- Checksum generation
- Marker escaping

### What to Do
1. Run tests: `deno test test/fx-snippets.test.ts`
2. For each failure:
   - Read error message
   - Identify root cause
   - Fix in `modules/fx-snippets.ts` OR fix test expectations
   - Re-run test
3. Log all results

### Success Criteria
- [ ] All snippet tests pass (100% pass rate)
- [ ] Test output saved to `test-results/snippets.log`
- [ ] Any fixed bugs documented in commit message

### Test
```bash
# Run snippet tests with verbose output
deno test -A test/fx-snippets.test.ts 2>&1 | tee test-results/snippets.log

# Should show all green
# Pass rate: 100%
```

### Documentation
Update `docs/API-REFERENCE.md`:
- Document `createSnippet()` signature and behavior
- Document `wrapSnippet()` signature
- Show examples from passing tests

---

## Task 4: Run View Tests and Fix Issues

### Pre-flight Check
```bash
# Verify test file
ls -la test/fx-view.test.ts

# Check method coverage
grep "describe\|it(" test/fx-view.test.ts
```

**Expected coverage:**
- `renderView()` - Basic rendering
- Import hoisting - JS/TS only
- Order-based sorting
- EOL handling (LF/CRLF)
- Separator configuration

### What to Do
1. Run: `deno test test/fx-view.test.ts`
2. Fix failures in `modules/fx-view.ts`
3. Log results

### Success Criteria
- [ ] All view tests pass
- [ ] Results logged to `test-results/view.log`
- [ ] Fixes documented

### Test
```bash
deno test -A test/fx-view.test.ts 2>&1 | tee test-results/view.log
```

### Documentation
Update `docs/API-REFERENCE.md`:
- Document `renderView()` options
- Show rendering examples

---

## Task 5: Run Parse Tests and Fix Issues

### Pre-flight Check
```bash
ls -la test/fx-parse.test.ts
grep "describe\|it(" test/fx-parse.test.ts
```

**Expected coverage:**
- `toPatches()` - Parse FX:BEGIN/END markers
- `applyPatches()` - Update FX graph
- Checksum validation
- Orphan creation
- Transaction rollback

### What to Do
1. Run: `deno test test/fx-parse.test.ts`
2. Fix in `modules/fx-parse.ts`
3. Log results

### Success Criteria
- [ ] All parse tests pass
- [ ] Results in `test-results/parse.log`

### Test
```bash
deno test -A test/fx-parse.test.ts 2>&1 | tee test-results/parse.log
```

### Documentation
Update `docs/API-REFERENCE.md`:
- Document `toPatches()` and `applyPatches()`
- Show round-trip example

---

## Task 6: Run Round-trip Integration Test

### Pre-flight Check
```bash
ls -la test/round-trip.test.ts
grep "describe\|it(" test/round-trip.test.ts
```

**Expected coverage:**
- Create snippets → Render view → Edit text → Parse → Apply → Render again
- Verify byte-perfect round-trip

### What to Do
1. Run: `deno test test/round-trip.test.ts`
2. Fix any integration issues
3. Log results

### Success Criteria
- [ ] Round-trip test passes
- [ ] Results in `test-results/round-trip.log`
- [ ] Demonstrates end-to-end workflow

### Test
```bash
deno test -A test/round-trip.test.ts 2>&1 | tee test-results/round-trip.log
```

### Documentation
Update `docs/GETTING-STARTED.md`:
- Show complete round-trip workflow
- Include code from passing test

---

## Task 7: Implement SQLite Persistence

### Pre-flight Check
```bash
# Verify schema files exist
ls -la modules/fx-persistence.ts
ls -la modules/fx-metadata-persistence.ts
ls -la modules/fx-snippet-persistence.ts

# Check for existing classes/methods
grep "class.*Persistence" modules/fx-persistence.ts
grep "save\|load" modules/fx-persistence.ts
```

**Expected findings:**
- Schema defined (CREATE TABLE statements)
- Interface `FXPersistence` defined
- NO actual SQLite driver code

### What to Build
**File:** `modules/fx-persistence.ts`

**Add this implementation:**
```typescript
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

export class FXPersistence {
  private db: DB;

  constructor(filePath: string) {
    this.db = new DB(filePath);
    this.initSchema();
  }

  private initSchema() {
    // Execute CREATE TABLE statements from existing schema
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        node_type TEXT,
        value_json TEXT,
        checksum TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    // ... rest of schema
  }

  save(): void {
    // 1. Traverse $_$$ graph
    // 2. For each node, INSERT OR REPLACE into nodes table
    // 3. Serialize values to JSON
  }

  load(): void {
    // 1. SELECT * FROM nodes
    // 2. Reconstruct $_$$ graph
    // 3. Rebuild parentMap
  }

  close() {
    this.db.close();
  }
}
```

### Success Criteria
- [ ] `FXPersistence` class has `save()` and `load()` methods
- [ ] Can create `.fxd` file
- [ ] Can save graph to database
- [ ] Can load graph from database
- [ ] Round-trip preserves all data

### Test
**File:** `test/persistence.test.ts` (create new)

```typescript
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { FXPersistence } from "../modules/fx-persistence.ts";
import { $$, $_$$ } from "../fxn.ts";

Deno.test("persistence - save and load", () => {
  // Setup
  const testFile = "./test-data/test.fxd";
  const persistence = new FXPersistence(testFile);

  // Create test data
  $$("test.node1").val("value1");
  $$("test.node2").val("value2");

  // Save
  persistence.save();

  // Clear graph
  // ... clear $_$$

  // Load
  persistence.load();

  // Verify
  assertEquals($$("test.node1").val(), "value1");
  assertEquals($$("test.node2").val(), "value2");

  // Cleanup
  persistence.close();
  Deno.removeSync(testFile);
});
```

Run:
```bash
deno test -A test/persistence.test.ts 2>&1 | tee test-results/persistence.log
```

### Documentation
Update `docs/API-REFERENCE.md`:
- Document `FXPersistence` class
- Show save/load example
- Document `.fxd` file format

---

## Task 8: Test CLI Commands

### Pre-flight Check
```bash
# Verify CLI file
ls -la fxd-cli.ts

# Check implemented commands
grep "case \"" fxd-cli.ts
```

**Expected commands:**
- `create` - Create new FXD disk
- `import` - Import files
- `list` - List contents
- `run` - Execute snippet
- `export` - Export to files
- `visualize` - Open visualizer

### What to Do
For each command:
1. Run with test data
2. Verify expected outcome
3. Log results
4. Fix any issues

### Success Criteria
```bash
# Create should make .fxd file
deno run -A fxd-cli.ts create test-disk.fxd
ls test-disk.fxd # Should exist

# Import should add files
deno run -A fxd-cli.ts import test-disk.fxd examples/repo-js/
deno run -A fxd-cli.ts list test-disk.fxd # Should show files

# Export should write files
deno run -A fxd-cli.ts export test-disk.fxd ./test-export/
ls test-export/ # Should have files

# Run should execute
deno run -A fxd-cli.ts run test-disk.fxd snippets.repo.header
# Should output result
```

### Test
**File:** `test/cli.test.ts` (create new)

```typescript
Deno.test("CLI - create, import, export workflow", async () => {
  const diskPath = "./test-data/cli-test.fxd";

  // Create
  const create = await new Deno.Command("deno", {
    args: ["run", "-A", "fxd-cli.ts", "create", diskPath]
  }).output();
  assertEquals(create.code, 0);

  // Import
  const importCmd = await new Deno.Command("deno", {
    args: ["run", "-A", "fxd-cli.ts", "import", diskPath, "examples/"]
  }).output();
  assertEquals(importCmd.code, 0);

  // Export
  const exportCmd = await new Deno.Command("deno", {
    args: ["run", "-A", "fxd-cli.ts", "export", diskPath, "./test-export/"]
  }).output();
  assertEquals(exportCmd.code, 0);

  // Cleanup
  Deno.removeSync(diskPath);
  Deno.removeSync("./test-export/", { recursive: true });
});
```

Run:
```bash
deno test -A test/cli.test.ts 2>&1 | tee test-results/cli.log
```

### Documentation
Update `docs/CLI-GUIDE.md`:
- Document each command with examples
- Show expected output
- Document all flags/options

---

## Task 9: Verify Example Works

### Pre-flight Check
```bash
ls -la examples/repo-js/demo.ts
ls -la examples/repo-js/seed.ts
```

### What to Do
```bash
# Should run without errors
deno run -A examples/repo-js/demo.ts

# Should output:
# [seed] repo snippets created
# --- Initial Render ---
# (shows rendered code with markers)
# --- Patches ---
# (shows parsed patches)
# --- After Apply ---
# (shows re-rendered code with changes)
```

### Success Criteria
- [ ] Example runs without errors
- [ ] Output matches expected format
- [ ] Demonstrates complete workflow

### Test
Log output:
```bash
deno run -A examples/repo-js/demo.ts 2>&1 | tee test-results/demo-example.log
```

### Documentation
Update `docs/EXAMPLES.md`:
- Include demo.ts output
- Explain each step
- Link to source code

---

## Task 10: Create Global Test Report

### Pre-flight Check
All previous test logs should exist:
```bash
ls test-results/*.log
```

### What to Build
**File:** `test/report-generator.ts`

```typescript
// Read all *.log files from test-results/
// Parse test output
// Generate summary report
// Output JSON + HTML report

interface GlobalReport {
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  modules: ModuleReport[];
}

// Generate HTML with:
// - Color-coded pass/fail
// - Per-module breakdown
// - Failed test details
// - Timing information
```

### Success Criteria
```bash
deno run -A test/report-generator.ts

# Should create:
# - test-results/report.json
# - test-results/report.html
```

Open `report.html` in browser, should show:
- Green header if all pass, red if any fail
- Table of all modules
- Expandable failed test details

### Test
Visual verification of HTML report

### Documentation
Update `docs/TESTING.md`:
- How to generate report
- How to read report
- CI/CD integration instructions

---

## Summary

### Task Execution Order
1. ✅ Task 0: Test infrastructure (30 min)
2. ✅ Task 1: Fix TypeScript (10 min)
3. ✅ Task 2: Standardize imports (10 min)
4. ✅ Task 3-6: Run and fix all tests (30 min)
5. ✅ Task 7: Implement persistence (40 min)
6. ✅ Task 8: Test CLI (20 min)
7. ✅ Task 9: Verify examples (10 min)
8. ✅ Task 10: Generate reports (10 min)

**Total:** ~2.5 hours

### Success Criteria (Overall)
- [ ] All tests pass (100% pass rate)
- [ ] All test results logged
- [ ] HTML report generated
- [ ] All documentation updated
- [ ] Examples run successfully
- [ ] CLI commands work end-to-end

### Final Deliverables
1. `test-results/` directory with all logs
2. `test-results/report.html` showing green
3. Updated documentation in `docs/`
4. Working `.fxd` file creation and loading
5. Verified examples in `examples/`
