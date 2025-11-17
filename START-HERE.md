# FXD Multi-Agent Development - START HERE

**Read this first. Everything else is reference.**

---

## ⚡ The 5-Minute Summary

### What You Have
- Working reactive framework core (90% done)
- 58 modules with code (broken imports)
- Tests written (broken imports)
- Extensive docs

### The Problem
- Import errors block everything
- Modules can't find `$$` from core

### The Solution
- Fix imports (4-6 hours)
- Wire modules together (8-12 hours)
- Ship v0.1 (2-3 weeks total)

### The Strategy
- **1 agent** fixes core exports (blocks everything)
- **9 agents** work in parallel on different files (no conflicts)
- **Python daemon** manages contexts and coordination

---

## 🚀 Quick Start (3 Steps)

### Step 1: Setup (5 minutes)

```bash
# Windows (as Administrator)
cd C:\dev\fxd\agent-coordinator
setup.bat

# Linux/Mac
cd /c/dev/fxd/agent-coordinator
chmod +x setup.sh
./setup.sh
```

**This creates:**
- Symlink to Claude contexts
- Directory structure
- Helper scripts

### Step 2: Start Daemon (1 minute)

```bash
# Windows
start-daemon.bat

# Linux/Mac
./start-daemon.sh
```

**Daemon will:**
- Backup contexts every 5 min
- Scan code annotations
- Monitor progress

### Step 3: Launch Agents

**First - Agent 0 (MUST complete first):**
- Open Claude Code
- Read: `tasks/CRITICAL-PATH.md`
- Fix core exports (4-6 hours)
- Create signal when done

**Then - Launch 9 agents in parallel:**
- Agent 1: `tasks/TRACK-A-TESTS.md`
- Agent 2-4: `tasks/TRACK-B-MODULES.md`
- Agent 5: `tasks/TRACK-C-CLI.md`
- Agent 6: `tasks/TRACK-D-EXAMPLES.md`
- Agent 7: `tasks/TRACK-E-DOCS.md`
- Agent 8: `tasks/TRACK-F-PERSISTENCE.md`
- Agent 9: `tasks/TRACK-G-BUILD.md`

---

## 📋 File Map (What Goes Where)

```
docs/
├── ACTUAL-STATUS.md              ⭐ READ: Honest assessment
├── REALISTIC-COMPLETION-PLAN.md  ⭐ READ: 2-3 week plan
├── IMMEDIATE-TODO.md             ⭐ READ: What to do first
└── PARALLEL-TASKS.md             Reference: Task breakdown

tasks/
├── CRITICAL-PATH.md              🔥 Agent 0: MUST DO FIRST
├── TRACK-A-TESTS.md              Agent 1: Tests
├── TRACK-B-MODULES.md            Agents 2-4: Modules
├── TRACK-C-CLI.md                Agent 5: CLI
├── TRACK-D-EXAMPLES.md           Agent 6: Examples
├── TRACK-E-DOCS.md               Agent 7: Docs
├── TRACK-F-PERSISTENCE.md        Agent 8: Database
└── TRACK-G-BUILD.md              Agent 9: Build

agent-coordinator/
├── setup.bat / setup.sh          🚀 RUN THIS FIRST
├── start-daemon.bat / .sh        Start context manager
├── agent-context-manager.py      The daemon
├── launch-agents.md              How to launch agents
└── SETUP-INSTRUCTIONS.md         Detailed setup help
```

---

## ✅ The Critical Path (Do This First)

### Agent 0: Fix Core Exports

**Time:** 4-6 hours
**Blocks:** Everything else

**Tasks:**
1. Pick canonical file (`fxn.ts` or `fx.ts`)
2. Add/verify exports
3. Create import template
4. Fix ONE module as proof
5. Test it compiles
6. Document pattern
7. Create signal file

**When done:** All other agents can start

---

## 🎯 Parallel Work (After Agent 0)

| Agent | Track | Files | Time | Output |
|-------|-------|-------|------|--------|
| 1 | Tests | `test/*.ts` | 6-8h | 15+ tests passing |
| 2 | Core Modules | `modules/fx-{snippets,view,parse,group}.ts` | 3-4h | Modules working |
| 3 | Persist Modules | `modules/fx-*-persistence.ts` | 2-3h | Imports fixed |
| 4 | IO Modules | `modules/fx-{import,export}.ts` | 3-4h | Import/export working |
| 5 | CLI | `fxd-cli.ts` | 6-8h | All commands work |
| 6 | Examples | `examples/**/*.ts` | 4-6h | 6 examples working |
| 7 | Docs | `docs/**/*.md`, `README.md` | 6-8h | Docs accurate |
| 8 | Database | `database/`, `fx-persistence.ts` | 8-12h | SQLite working |
| 9 | Build | `scripts/`, `dist/` | 4-6h | Executables built |

**All work in parallel = ~12 hours real time (not 50+ sequential)**

---

## 🔄 Agent Workflow

### Each Agent Should:

1. **Wait for Agent 0**
   - Check for `tasks/.critical-path-complete`
   - If not there, wait

2. **Read Task File**
   - Understand mission
   - Note file ownership
   - Review dependencies

3. **Work on Tasks**
   - Follow import template
   - Annotate all code:
     ```typescript
     // @agent: agent-name
     // @timestamp: 2025-10-02T14:30:00Z
     // @task: TRACK-X.md#1.1
     ```

4. **Update Progress**
   - Mark tasks: `- [x]` when done
   - Update status in task file

5. **Test Work**
   - Compile: `deno check [file]`
   - Run tests as appropriate

6. **Signal Complete**
   - Update: `**Status:** ✅ Complete`

---

## 📊 Monitoring

### Check Status
```bash
# Windows
check-status.bat

# Linux/Mac
./check-status.sh
```

### View Progress
```bash
# Open task files
code tasks/TRACK-A-TESTS.md

# Look for:
- [x] Completed tasks
**Status:** marker
```

### Scan Annotations
```bash
# Windows
scan-annotations.bat

# Linux/Mac
./scan-annotations.sh
```

---

## 🎯 Success = v0.1 Release

### Definition of Done

- [ ] All core modules compile
- [ ] 15-20 tests passing
- [ ] 6 examples working
- [ ] CLI functional (6 commands)
- [ ] Docs accurate
- [ ] Executables built

### Then Ship

```bash
git tag v0.1.0-alpha
git push origin v0.1.0-alpha
```

---

## 💡 Key Insights

1. **You're 90% done** - Just need integration
2. **Main blocker is imports** - 4-6 hours to fix
3. **Not 6 months** - 2-3 weeks realistic
4. **Parallel work = 2.5x faster** - 10 agents vs 1
5. **No conflicts** - Clear file ownership

---

## 🚨 If Stuck

### Agent 0 Stuck?
- Read `tasks/CRITICAL-PATH.md` fully
- Follow template exactly
- Test each step

### Other Agent Stuck?
- Check if Agent 0 complete
- Verify file ownership
- Check dependencies in task file

### Context Too Large?
```bash
python agent-context-manager.py trim --agent [name]
```

### Lost Work?
```bash
cd agent-coordinator/backups
ls -lt  # Find latest
```

---

## 📚 Reference Docs (Read If Needed)

- **Honest Status:** `docs/ACTUAL-STATUS.md`
- **Full Plan:** `docs/REALISTIC-COMPLETION-PLAN.md`
- **Task Details:** `docs/PARALLEL-TASKS.md`
- **Setup Help:** `agent-coordinator/SETUP-INSTRUCTIONS.md`

---

## ✅ Your Immediate Actions

### Right Now:

1. **Run setup:**
   ```bash
   cd agent-coordinator
   setup.bat  # or ./setup.sh
   ```

2. **Start daemon:**
   ```bash
   start-daemon.bat  # or ./start-daemon.sh
   ```

3. **Launch Agent 0:**
   - Open Claude Code
   - Load: `tasks/CRITICAL-PATH.md`
   - Start working

4. **Wait for Agent 0 to signal complete**

5. **Launch remaining 9 agents in parallel**

6. **Monitor with `check-status`**

7. **Ship v0.1 in 2-3 weeks**

---

## 🎉 Bottom Line

You have a **working core** and **90% of the code**.

You need **4-6 hours** to fix imports, then **2-3 weeks** to integrate and polish.

With **10 parallel agents**, you cut development time by **2.5x**.

**Stop reading. Start setup. Launch agents. Ship v0.1.**

---

**Time spent on docs: Too much**
**Time needed to ship: 2-3 weeks**

**GO! 🚀**
