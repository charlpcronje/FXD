# Agent Task Specifications for FXD Cleanup

## Task 1: Delete Temporary Files
**Agent:** Cleanup-Delete
**Time:** 2-3 minutes
**Risk:** LOW (no dependencies)

**Instructions:**
Delete the following 36 files (all are temporary/generated):

```bash
# Temp test files (6)
test-cli-quick.ts
test-filesystem-plugin.ts
test-reactive-snippets.ts
test-atomics-basic.ts
test-atomics-debug.ts
main_test.ts

# Generated artifacts (4)
fx.js
test.fxd
test-cli.fxd
test-persist-debug.fxd

# Generated example outputs (3)
examples/demo-project.fxd
examples/code-project.fxd
examples/full-project.fxd

# Redundant docs (10)
DONE.md
SYSTEM-READY.md
fxd_2025-10-02_05-56-54.md
fxd_2025-10-02_13-12-43.md
fxd_2025-10-09_00-53-13.md
combined_output.md
docs/combined_output.md
LAUNCH-AGENTS-NOW.md
TELL-CODEWEAVER.md
TOKEN-EXPIRY-ACTION-PLAN.md

# Debug files in docs (11)
docs/fx/fx-tests/debug-addpath.ts
docs/fx/fx-tests/debug-css-match.ts
docs/fx/fx-tests/debug-fx-tree.ts
docs/fx/fx-tests/debug-groups.ts
docs/fx/fx-tests/debug-match-logging.ts
docs/fx/fx-tests/debug-node-creation.ts
docs/fx/fx-tests/debug-node-value.ts
docs/fx/fx-tests/debug-selector-parse.ts
docs/fx/fx-tests/debug-selector.ts
docs/fx/fx-tests/debug-set-val.ts
docs/fx/fx-tests/debug-val-args.ts

# Temp files (2)
fix-group-storage.ts
take-screenshot.ts
```

**Success Criteria:**
- All 36 files deleted
- No errors
- Report list of deleted files

---

## Task 2: Archive Historical Files
**Agent:** Cleanup-Archive
**Time:** 5-7 minutes
**Risk:** LOW (moving, not deleting)

**Instructions:**

Step 1: Create archive structure
```bash
mkdir -p docs/archive/sessions
mkdir -p docs/archive/phases
mkdir -p docs/archive/planning
mkdir -p docs/archive/milestones
mkdir -p docs/vision
mkdir -p archive/old-demos
mkdir -p archive/unused-modules
mkdir -p archive/stub-plugins
mkdir -p archive/deprecated
```

Step 2: Move session reports (7 files)
```bash
mv SESSION-RESULTS.md docs/archive/sessions/
mv SESSION-SUMMARY.md docs/archive/sessions/
mv TEST-PROGRESS.md docs/archive/sessions/
mv FINAL-MEGA-STATUS.md docs/archive/milestones/
mv FINAL-STATUS-VERIFIED.md docs/archive/milestones/
mv PRODUCTION-READY-REPORT.md docs/archive/milestones/
mv TOTAL-COMPLETION-SUMMARY.md docs/archive/milestones/
```

Step 3: Move phase docs (7 files)
```bash
mv COMPLETION-REPORT.md docs/archive/phases/
mv PHASE-1-COMPLETE.md docs/archive/phases/
mv PHASE-2-PERSISTENCE-COMPLETE.md docs/archive/phases/
mv B3-COMPLETION-REPORT.md docs/archive/phases/
mv docs/phases/FXD-PHASE-1.md docs/archive/phases/
mv docs/phases/FXD-PHASE-2.md docs/archive/phases/
mv docs/phases/FXD-PHASE-2.0-IMMEDIATE.md docs/archive/phases/
mv docs/phases/FXD-COMPLETE.md docs/archive/phases/
```

Step 4: Move planning docs (6 files)
```bash
mv START-HERE.md docs/archive/planning/
mv TASKS.md docs/archive/planning/
mv docs/IMMEDIATE-TODO.md docs/archive/planning/
mv docs/PARALLEL-TASKS.md docs/archive/planning/
mv docs/REALISTIC-COMPLETION-PLAN.md docs/archive/planning/
mv docs/PRODUCTION-ROADMAP.md docs/archive/planning/
```

Step 5: Move vision docs (4 files)
```bash
mv ATOMICS-INTEGRATION-VISION.md docs/vision/
mv REACTIVE-SNIPPETS-VISION.md docs/vision/
mv FXOS-INTEGRATION-VISION.md docs/vision/
mv THE-BIG-PICTURE.md docs/vision/
```

Step 6: Move old demos (7 files)
```bash
mv demo-fxd.ts archive/old-demos/
mv simple-demo.ts archive/old-demos/
mv quick-demo.ts archive/old-demos/
mv demo-complete.ts archive/old-demos/
mv run-demo.ts archive/old-demos/
mv demo-import-export.ts archive/old-demos/
mv examples/import-export-example.ts archive/old-demos/
```

Step 7: Move stub modules (list top 20, there are 48+ total - do all)
```bash
mv modules/fx-scan.ts archive/unused-modules/
mv modules/fx-ramdisk.ts archive/unused-modules/
mv modules/fx-collaboration.ts archive/unused-modules/
# ... (continue with all stubs from CLEANUP-PLAN.md)
```

**Success Criteria:**
- Archive structure created
- All historical files moved
- Report files moved count
- No broken links in moved files

---

## Task 3: Create .gitignore
**Agent:** Cleanup-Gitignore
**Time:** 1 minute
**Risk:** ZERO

**Instructions:**

Create/update `.gitignore` with:
```
# Generated files
*.fxd
!docs/**/*.fxd
examples/**/*.fxd
examples/**/output/
test-*.fxd
fx.js

# Temp test files
test-debug-*.ts
test-*.ts

# Node modules
node_modules/
.deno/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Test results
test-results/
*.log

# Temp
*.tmp
*.temp
```

**Success Criteria:**
- .gitignore created/updated
- Prevents generated files in git

---

## Task 4: Update Documentation
**Agent:** Cleanup-Docs
**Time:** 3-5 minutes
**Risk:** LOW

**Instructions:**

1. Update README.md:
   - Change all "148 tests" → "165 tests"
   - Update example list (remove archived demos)
   - Add link to docs/archive/ for historical records

2. Create CHANGELOG.md:
   - Extract from completion reports
   - Format as standard changelog

3. Create CONTRIBUTING.md:
   - Extract contribution section from README
   - Add development setup
   - Add testing instructions

4. Update docs/INDEX.md:
   - Add archive section
   - Update all links
   - Add vision docs section

**Success Criteria:**
- 4 docs created/updated
- All links work
- No references to deleted files

---

## Verification Task Spec

**Agent:** Cleanup-Verifier
**Time:** 3-5 minutes

**Instructions:**

After cleanup agents finish, verify:

1. **Test all 165 steps still pass:**
   ```bash
   deno run -A test/run-all-tests.ts
   ```
   Expected: 6/6 files passing, 165/165 steps

2. **Test all examples still work:**
   ```bash
   deno run -A examples/persistence-demo.ts
   deno run -A examples/repo-js/demo.ts
   # etc.
   ```

3. **Check archive structure:**
   - All archived files present?
   - Archive READMEs created?
   - No broken references?

4. **Verify deletions:**
   - Temp files gone?
   - No accidental deletions?
   - .gitignore working?

**Report:**
- ✅ Tests passing (Y/N)
- ✅ Examples working (Y/N)
- ✅ Archive organized (Y/N)
- ✅ No broken links (Y/N)
- ⚠️ Any issues found

If all ✅, cleanup is SUCCESSFUL!

---

**Total Time: ~15 minutes of agent work**
**Total Tokens: ~50K (vs 200K+ if I did it myself)**
**Benefit: My context stays clean for building features!**
