# FXD Multi-Agent Launch Instructions

## 🚀 Quick Start

### Step 1: Start Context Manager Daemon

```bash
cd c:/dev/fxd/agent-coordinator
python agent-context-manager.py daemon --interval 300
```

This will:
- Backup all contexts every 5 minutes
- Scan for code annotations
- Monitor agent progress
- Keep running in background

### Step 2: Launch Agents in Claude Code

Open **10 Claude Code instances** (or tabs/windows):

#### Agent 0: Critical Path (MUST complete first)
```
Task File: tasks/CRITICAL-PATH.md
Agent Name: agent-critical-path
Priority: BLOCKING

Instructions:
- Read tasks/CRITICAL-PATH.md
- Complete all tasks in order
- Create .critical-path-complete signal when done
- DO NOT proceed to other work
```

Wait for Agent 0 to complete before launching others.

#### Once Agent 0 Signals Complete:

Launch all remaining agents **simultaneously**:

#### Agent 1: Test Infrastructure
```
Task File: tasks/TRACK-A-TESTS.md
Agent Name: agent-test-infra
Priority: P0
```

#### Agent 2: Core Modules
```
Task File: tasks/TRACK-B-MODULES.md (Section B1)
Agent Name: agent-modules-core
Priority: P0
```

#### Agent 3: Persistence Modules
```
Task File: tasks/TRACK-B-MODULES.md (Section B2)
Agent Name: agent-modules-persist
Priority: P0
```

#### Agent 4: IO Modules
```
Task File: tasks/TRACK-B-MODULES.md (Section B3)
Agent Name: agent-modules-io
Priority: P0
```

#### Agent 5: CLI Implementation
```
Task File: tasks/TRACK-C-CLI.md
Agent Name: agent-cli
Priority: P1
```

#### Agent 6: Examples
```
Task File: tasks/TRACK-D-EXAMPLES.md
Agent Name: agent-examples
Priority: P1
```

#### Agent 7: Documentation
```
Task File: tasks/TRACK-E-DOCS.md
Agent Name: agent-docs
Priority: P2
```

#### Agent 8: Persistence Layer
```
Task File: tasks/TRACK-F-PERSISTENCE.md
Agent Name: agent-persistence
Priority: P1
```

#### Agent 9: Build & Distribution
```
Task File: tasks/TRACK-G-BUILD.md
Agent Name: agent-build
Priority: P2
```

---

## 📋 Agent Instructions Template

For each agent, send this initial prompt:

```
You are [AGENT-NAME] working on the FXD project.

YOUR TASK FILE: tasks/[TASK-FILE].md

CRITICAL INSTRUCTIONS:
1. Read your task file completely
2. Annotate ALL code you write with:
   // @agent: [your-agent-name]
   // @timestamp: [current-timestamp]
   // @task: [task-file]#[task-number]

3. Update your progress in your task file
4. Mark tasks as complete: - [x]
5. Only work on files assigned to you
6. Check annotations before modifying shared files

COORDINATION:
- Context manager is running (backing up every 5 min)
- Other agents are working in parallel
- Check tasks/.critical-path-complete exists before starting
- Read IMPORT-FIX-INSTRUCTIONS.md for import pattern

START BY:
1. Reading your task file: tasks/[TASK-FILE].md
2. Understanding your file ownership
3. Beginning with Task 1

GO!
```

---

## 📊 Monitoring Progress

### Check Overall Status
```bash
cd c:/dev/fxd/agent-coordinator
python agent-context-manager.py status
```

### Check Individual Task
```bash
# Open the task file and check progress
code tasks/TRACK-A-TESTS.md

# Look for:
- [x] Completed tasks
- [ ] Pending tasks
**Status:** marker
```

### View Code Annotations
```bash
python agent-context-manager.py scan
cat contexts/annotations.json
```

---

## 🔄 Agent Workflow

Each agent should:

### 1. Read Task File
- Understand mission
- Review file ownership
- Note dependencies

### 2. Check Dependencies
```bash
# Wait for critical path
ls tasks/.critical-path-complete

# If doesn't exist, wait
# If exists, proceed
```

### 3. Work on Tasks
- Complete tasks in order
- Annotate all code
- Update progress
- Test as you go

### 4. Annotate Code
```typescript
// @agent: agent-test-infra
// @timestamp: 2025-10-02T14:30:00Z
// @task: TRACK-A-TESTS.md#A.1
// @status: complete

import { $$, $_$$, fx } from '../fxn.ts';
```

### 5. Update Progress
```markdown
### Task Progress
- [x] A.1: Fix test imports (2 hours) - COMPLETE
- [ ] A.2: Create helpers (1 hour) - IN PROGRESS
```

### 6. Signal Completion
When all tasks done:
```markdown
**Status:** ✅ Complete
**Completed:** 2025-10-02T16:45:00Z
```

---

## ⚠️ Conflict Resolution

### If Two Agents Need Same File

**Check annotations first:**
```bash
# Scan for existing work
python agent-context-manager.py scan

# Check who owns file
grep "@agent:" modules/fx-snippets.ts
```

**Coordination:**
- Agent who owns file (per task file) has priority
- If conflict, check task file ownership section
- If still unclear, newer timestamp waits

### Shared Files

**fxn.ts (core):**
- Agent 0 only modifies
- All others READ ONLY

**modules/fx-core.ts:**
- Created by agent-modules-integration (B4)
- After other module agents complete
- Coordinate via task status

---

## 🎯 Success Metrics

### Phase 1 Complete (Agent 0)
```bash
ls tasks/.critical-path-complete  # Must exist
```

### Phase 2 Complete (Agents 1-9)
Check each task file has:
```markdown
**Status:** ✅ Complete
```

### All Complete
When all agents done:
1. Run full test suite
2. Verify examples work
3. Test CLI end-to-end
4. Build distribution
5. Ship v0.1

---

## 🚨 Emergency Procedures

### Agent Stuck
1. Check task file for blockers
2. Check dependencies complete
3. Check file ownership conflicts
4. Document blocker in tasks/BLOCKERS.md

### Context Overflow
```bash
python agent-context-manager.py trim --agent [agent-name]
```

### Lost Work
```bash
# Restore from backup
cd agent-coordinator/backups
ls -lt  # Find latest backup
# Copy context file back
```

---

## 📝 Tips for Success

1. **Start with Agent 0** - Everything depends on it
2. **Read task files fully** - Understand before starting
3. **Annotate everything** - Other agents need to know
4. **Update progress often** - Keep task files current
5. **Test as you go** - Don't wait till the end
6. **Coordinate on shared files** - Check annotations
7. **Signal clearly** - Update status when done

---

## ✅ Launch Checklist

- [ ] Context manager daemon running
- [ ] Agent 0 (critical-path) started
- [ ] Agent 0 completed (signal file exists)
- [ ] Agents 1-9 launched simultaneously
- [ ] All agents have task files
- [ ] All agents understand annotations
- [ ] Monitoring in place

**Once all complete:**
- [ ] Integration testing
- [ ] Final validation
- [ ] Build distribution
- [ ] Ship v0.1

---

**Time Estimate:** 24-30 hours real time (with 10 parallel agents)
**vs Sequential:** 60-80 hours
**Speedup:** ~2.5-3x faster

**LET'S GO! 🚀**
