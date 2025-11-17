d# FXD Documentation Index

**Quick navigation to all documentation.**

---

## 🚀 Start Here

1. **[START-HERE.md](../START-HERE.md)** ⭐⭐⭐
   - **Read this first**
   - 5-minute summary
   - Immediate actions
   - Essential only

---

## 📊 Status & Planning

### Current Reality
- **[ACTUAL-STATUS.md](ACTUAL-STATUS.md)** ⭐⭐
  - Honest assessment
  - What actually works
  - What's broken
  - Path forward

### Roadmaps
- **[REALISTIC-COMPLETION-PLAN.md](REALISTIC-COMPLETION-PLAN.md)** ⭐⭐
  - 2-3 week sprint plan
  - Week-by-week breakdown
  - Realistic timeline

- **[IMMEDIATE-TODO.md](IMMEDIATE-TODO.md)** ⭐
  - What to do today
  - Import fix instructions
  - 4-6 hours of work

- **[PRODUCTION-ROADMAP.md](PRODUCTION-ROADMAP.md)**
  - Detailed 6-month plan (overly cautious)
  - Reference only

---

## 🔄 Parallel Development

### Multi-Agent Strategy
- **[PARALLEL-TASKS.md](PARALLEL-TASKS.md)** ⭐
  - Task dependency analysis
  - 10 parallelizable tracks
  - Agent coordination

### Task Files (in `../tasks/`)
- **[CRITICAL-PATH.md](../tasks/CRITICAL-PATH.md)** 🔥
  - Agent 0: MUST DO FIRST
  - Fix core exports
  - Blocks everything

- **[TRACK-A-TESTS.md](../tasks/TRACK-A-TESTS.md)**
  - Agent 1: Test infrastructure
  - 15-20 tests passing

- **[TRACK-B-MODULES.md](../tasks/TRACK-B-MODULES.md)**
  - Agents 2-4: Module integration
  - Core, persistence, IO

- **[TRACK-C-CLI.md](../tasks/TRACK-C-CLI.md)**
  - Agent 5: CLI implementation
  - 6 commands functional

- **[TRACK-D-EXAMPLES.md](../tasks/TRACK-D-EXAMPLES.md)**
  - Agent 6: Examples
  - 6 working demos

- **[TRACK-E-DOCS.md](../tasks/TRACK-E-DOCS.md)**
  - Agent 7: Documentation
  - Cleanup and accuracy

- **[TRACK-F-PERSISTENCE.md](../tasks/TRACK-F-PERSISTENCE.md)**
  - Agent 8: Database
  - SQLite implementation

- **[TRACK-G-BUILD.md](../tasks/TRACK-G-BUILD.md)**
  - Agent 9: Distribution
  - Executables and packages

---

## 🤖 Agent Coordination

### Setup & Management
- **[agent-coordinator/SETUP-INSTRUCTIONS.md](../agent-coordinator/SETUP-INSTRUCTIONS.md)**
  - Detailed setup guide
  - Windows & Linux/Mac
  - Troubleshooting

- **[agent-coordinator/launch-agents.md](../agent-coordinator/launch-agents.md)**
  - How to launch agents
  - Agent instructions
  - Monitoring

- **[agent-coordinator/README.md](../agent-coordinator/README.md)**
  - System overview
  - How it works
  - Commands

### Tools
- **agent-context-manager.py**
  - Context backup daemon
  - Annotation scanner
  - Status reporter

---

## 📖 Original Documentation

### Official Docs (Phase 1)
Located in `docs/official/phase_1/`:

- **installation.md** - Setup instructions
- **quickstart.md** - Getting started
- **concepts.md** - Core concepts
- **api-*.md** - API references
- **guide-*.md** - Usage guides
- **examples-*.md** - Example walkthroughs
- **architecture.md** - System architecture

### Design Docs
- **design.md** - Original design document
- **diffs.md** - Change tracking

### Phase Planning
- **phases/FXD-PHASE-1.md** - Phase 1 spec
- **phases/FXD-PHASE-2.md** - Phase 2 spec
- **phases/FXD-COMPLETE.md** - Complete vision

### Workflows
- **fx/BANK-STATEMENT-WORKFLOW.md** - Example workflow
- **fx/onboarding.md** - Getting started
- **fx/cheatsheet.md** - Quick reference

---

## 🧪 Testing

- **[TESTING.md](../TESTING.md)** - Test documentation
- **[QA-FRAMEWORK-README.md](../QA-FRAMEWORK-README.md)** - QA framework

---

## 🎨 UI & Features

- **[UI-GUIDE.md](../UI-GUIDE.md)** - UI documentation
- **fx/web-workers.md** - Web worker usage
- **fx/atomics.md** - Atomic operations
- **fx/MCP-FXD-INTEGRATION.md** - MCP integration

---

## 📦 Archive (Aspirational)

These were moved to `archive/` - they describe future goals, not current reality:

- **PRODUCTION-READINESS-CERTIFICATION.md** - Fake QA report
- **PRODUCTION-STABILITY-SUMMARY.md** - Aspirational features
- **comprehensive-qa-report.md** - Test results that don't exist

**Don't read these** - they're misleading.

---

## 🎯 Reading Order

### If You're Just Starting:
1. [START-HERE.md](../START-HERE.md)
2. [ACTUAL-STATUS.md](ACTUAL-STATUS.md)
3. [IMMEDIATE-TODO.md](IMMEDIATE-TODO.md)
4. Setup and launch agents

### If You're Setting Up Multi-Agent:
1. [PARALLEL-TASKS.md](PARALLEL-TASKS.md)
2. [agent-coordinator/SETUP-INSTRUCTIONS.md](../agent-coordinator/SETUP-INSTRUCTIONS.md)
3. [agent-coordinator/launch-agents.md](../agent-coordinator/launch-agents.md)
4. Individual task files in `../tasks/`

### If You're Planning:
1. [REALISTIC-COMPLETION-PLAN.md](REALISTIC-COMPLETION-PLAN.md)
2. [PARALLEL-TASKS.md](PARALLEL-TASKS.md)
3. [PRODUCTION-ROADMAP.md](PRODUCTION-ROADMAP.md) (if you want the detailed version)

### If You're Working on Specific Area:
- Tests → [TRACK-A-TESTS.md](../tasks/TRACK-A-TESTS.md)
- Modules → [TRACK-B-MODULES.md](../tasks/TRACK-B-MODULES.md)
- CLI → [TRACK-C-CLI.md](../tasks/TRACK-C-CLI.md)
- Examples → [TRACK-D-EXAMPLES.md](../tasks/TRACK-D-EXAMPLES.md)
- Docs → [TRACK-E-DOCS.md](../tasks/TRACK-E-DOCS.md)
- Database → [TRACK-F-PERSISTENCE.md](../tasks/TRACK-F-PERSISTENCE.md)
- Build → [TRACK-G-BUILD.md](../tasks/TRACK-G-BUILD.md)

---

## 📝 Doc Stats

- **Essential docs:** 10 files
- **Task files:** 8 files
- **Reference docs:** 50+ files
- **Archive:** 3 misleading files
- **Total:** 800+ markdown files

**Most are reference. Start with the 10 essential.**

---

## ✅ TL;DR

1. Read [START-HERE.md](../START-HERE.md)
2. Run `agent-coordinator/setup.bat`
3. Launch agents from task files
4. Ship v0.1 in 2-3 weeks

**That's it. Everything else is optional reference material.**
