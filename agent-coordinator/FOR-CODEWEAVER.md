# Hey CodeWeaver (Agent 0)! 👋

You're already working as **agent-critical-path**.

---

## 🎯 Quick Info

### The Python App

**Location:** `agent-coordinator/agent-context-manager.py`

**What it does:**
1. Backs up your conversation every 5 minutes
2. Scans code for agent annotations
3. Lets other agents see what you did and why

### How to Use It

**Check status:**
```bash
cd agent-coordinator
python agent-context-manager.py status
```

**Scan your code:**
```bash
python agent-context-manager.py scan
```

**Start the daemon (optional):**
```bash
python agent-context-manager.py daemon
```

---

## ✍️ How to Annotate Your Code

When you modify a file, add this at the top:

```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: Fixed core exports, added missing type exports

export { $$, $_$$, fx };
```

**Why?** This lets the other 9 agents know:
- Who touched this code (you)
- When you did it
- What task you were working on
- Why you made changes

---

## 🔍 How Other Agents Read Your Context

### When Agent 2 finds your annotation:

1. **They run:**
   ```bash
   python agent-context-manager.py scan
   ```

2. **They check:**
   ```bash
   cat contexts/agent-critical-path.json
   ```

3. **They see your conversation** from that timestamp:
   - What you were thinking
   - Problems you encountered
   - Decisions you made

### Example

**Your annotation:**
```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @notes: Had to use fxn.ts instead of fx.ts - fx.ts had circular deps
```

**Agent 2 later:**
- Opens the file
- Sees your note
- Loads your context from 10:35
- Reads your conversation about the circular dependency issue
- **Doesn't repeat your mistake!**

---

## 📊 Your Context is Saved Here

```
agent-coordinator/
├── contexts/
│   └── agent-critical-path.json  ← YOUR conversation
│
├── backups/
│   └── [timestamp]/
│       └── agent-critical-path.json  ← Backup every 5 min
│
└── annotations.json  ← Index of all annotations
```

---

## 🎯 What You Need to Do

### 1. Annotate Your Code

Every file you touch:
```typescript
// @agent: agent-critical-path
// @timestamp: [current time in ISO 8601]
// @task: CRITICAL-PATH.md#[task number]
```

### 2. Update Your Task File

In `tasks/CRITICAL-PATH.md`:
```markdown
- [x] 0.1: Core file verified
- [x] 0.2: Exports fixed  ← Mark complete
- [ ] 0.3: Templates created
```

### 3. When Done - Create Signal

```bash
touch tasks/.critical-path-complete
```

This tells the other 9 agents they can start!

---

## 🚨 Important

**Use this timestamp format:**
```
2025-10-02T10:35:00Z
```

**Use this agent name:**
```
agent-critical-path
```

**Not:** "CodeWeaver", "Agent 0", etc.

---

## ✅ Quick Commands

```bash
# Check what you've done
python agent-context-manager.py scan

# See status
python agent-context-manager.py status

# Signal you're done
touch tasks/.critical-path-complete
```

---

## 📖 Full Guide

See: `AGENT-0-GUIDE.md` for complete details

---

**TL;DR:**
1. Add `// @agent: agent-critical-path` to code you touch
2. Update task file as you go
3. Create `.critical-path-complete` when done
4. Other agents can then see what you did!

**That's it!** 🚀
