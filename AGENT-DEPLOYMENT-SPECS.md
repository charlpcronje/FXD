# 🎯 Agent Deployment Specifications - 3 Master Agents

**Each agent gets:** 1M context, 1 hour, full autonomy
**Each delivers:** Code + Tests + Docs + Reflection + Report
**Pattern:** Deep focus, comprehensive delivery, verified results

---

## 🔷 AGENT 1: RAMDisk & Virtual Filesystem

**Mission:** Build `fxd mount` that creates virtual drive with editable files

**Time:** 1 hour
**Context:** 1M tokens
**Model:** Sonnet (best for systems programming)

### Specification

Create complete RAMDisk mounting system:
- Cross-platform (Windows, Linux, macOS)
- VFS driver (WinFSP, FUSE, MacFUSE)
- Auto-import directory to snippets
- File edit → snippet sync
- Mount/unmount commands

**Deliverables (10 files minimum):**
1. modules/fx-ramdisk.ts
2. modules/fx-vfs.ts
3. modules/fx-auto-import.ts
4. cli/commands/mount.ts
5. cli/commands/unmount.ts
6. test/fx-ramdisk.test.ts (25+ tests)
7. test/fx-vfs.test.ts (15+ tests)
8. docs/RAMDISK-MOUNTING.md
9. docs/VFS-ARCHITECTURE.md
10. RAMDISK-REPORT.md (your summary)

**Success:** `fxd mount` creates R:\, files editable, `fxd unmount` saves

---

## 🔷 AGENT 2: Electron Desktop Application

**Mission:** Build beautiful desktop app managing FXD disks with 3D visualizer

**Time:** 1 hour
**Context:** 1M tokens
**Model:** Sonnet (best for full-stack)

### Specification

Create professional Electron app:
- Main process (window, tray, IPC)
- React UI (integrate MCP visualizer)
- Disk manager panel
- Node binder UI
- Stats and monitoring
- Modern design (Tailwind)

**Deliverables (15+ files):**
1. electron/main.ts
2. electron/renderer/src/App.tsx
3. electron/renderer/src/components/DiskList.tsx
4. electron/renderer/src/components/DiskCard.tsx
5. electron/renderer/src/components/MountedDisks.tsx
6. electron/renderer/src/components/QuickActions.tsx
7. electron/renderer/src/components/NodeGraph.tsx
8. electron/ipc-bridge.ts
9. electron/tray.ts
10. electron/menu.ts
11. electron/package.json
12. electron/test/*.test.ts (20+ tests)
13. electron/README.md
14. docs/ELECTRON-APP-GUIDE.md
15. ELECTRON-REPORT.md (your summary)

**Success:** App launches, loads .fxd, shows 3D graph, manages disks

---

## 🔷 AGENT 3: CLI Excellence & File Associations

**Mission:** Professional CLI + system integration

**Time:** 1 hour
**Context:** 1M tokens
**Model:** Sonnet (best for tooling)

### Specification

Polish CLI and setup file associations:
- Compile to binary
- Add to PATH
- Shell completions
- Beautiful output
- Double-click .fxd handling
- System integration

**Deliverables (12+ files):**
1. scripts/build-cli.ts
2. scripts/install.ts (cross-platform)
3. scripts/file-associations/windows-registry.ts
4. scripts/file-associations/linux-desktop.ts
5. scripts/file-associations/macos-plist.ts
6. cli/completions/fxd.bash
7. cli/completions/fxd.zsh
8. cli/completions/fxd.fish
9. cli/completions/fxd.ps1
10. test/fx-cli.test.ts (20+ tests)
11. docs/CLI-REFERENCE.md
12. CLI-REPORT.md (your summary)

**Success:** `fxd` works globally, completions work, .fxd double-click works

---

## 📝 REPORT TEMPLATE (All Agents Use This)

```markdown
# Agent X: [Feature Name] - Implementation Report

## Executive Summary
- Mission: [one sentence]
- Time: X minutes
- Tokens used: ~X
- Lines written: X
- Tests: X/Y passing
- Status: ✅ COMPLETE / 🚧 PARTIAL / ❌ BLOCKED

## Deliverables Completed

### Implementation Files
1. [file path] (X lines) - [purpose]
2. ...

### Test Files
1. [file path] (X tests, Y passing)
2. ...

### Documentation Files
1. [file path] (X lines) - [purpose]
2. ...

## Test Results
\`\`\`
Total tests: X
Passing: Y
Failing: Z
Coverage: W%
\`\`\`

(paste test output)

## Technical Implementation

### Architecture Decisions
[explain major decisions]

### Challenges Overcome
[problems you solved]

### Code Highlights
[interesting code sections]

## Reflection (Answer ALL questions from spec)

1. [Question 1]: [Your answer]
2. [Question 2]: [Your answer]
...

## Performance Metrics

[Any performance measurements]

## Known Issues

[Any limitations or bugs]

## Integration Points

[How your code integrates with existing FXD]

## Recommendations for Next Agent

[What the next agent should know]

## Verification Checklist

- [ ] All code compiles without errors
- [ ] All tests pass
- [ ] Documentation complete and accurate
- [ ] Reflection questions answered
- [ ] Code follows FXD patterns (uses fxn.ts, etc.)
- [ ] Examples work
- [ ] Ready for verification agent

## Files Created/Modified (Full List)

\`\`\`
C:\dev\fxd\[path] (created, X lines)
C:\dev\fxd\[path] (modified, +X/-Y lines)
...
\`\`\`

## Summary

[2-3 paragraph summary of what you achieved]

---

**Agent:** [Your name]
**Feature:** [Feature name]
**Status:** [COMPLETE/PARTIAL/BLOCKED]
**Handoff:** [READY/NOT READY]
