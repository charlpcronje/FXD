# Agent 0 (CodeWeaver) - Context Management Guide

**Agent Name:** agent-critical-path (CodeWeaver)
**Your Mission:** Fix core exports and create import template

---

## 🤖 How the Python Context Manager Works

### What It Does

The `agent-context-manager.py` daemon:
1. **Backs up your conversation** every 5 minutes to `backups/`
2. **Scans all code** for agent annotations
3. **Tracks who wrote what** and when
4. **Loads context from other agents** when you reference their work

### How It Tracks Your Work

When you write code with annotations like this:

```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T14:30:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: Fixed core exports in fxn.ts

export { fx, $$, $_$$ };
```

The daemon:
- Scans this file
- Records: "agent-critical-path worked on this at 2025-10-02T14:30:00Z"
- Saves a link to your conversation context at that time
- Other agents can load YOUR context when they see this code

---

## ✍️ How to Annotate Your Code

### Required Format

**TypeScript/JavaScript:**
```typescript
/**
 * Last Modified: 2025-10-02T14:30:00Z
 * Agent: agent-critical-path
 * Task: CRITICAL-PATH.md#0.2
 * Changes: What you did and why
 */

// @agent: agent-critical-path
// @timestamp: 2025-10-02T14:30:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: Fixed exports, added missing type exports

import { $$, $_$$, fx } from './fxn.ts';
```

**Python:**
```python
# @agent: agent-critical-path
# @timestamp: 2025-10-02T14:30:00Z
# @task: CRITICAL-PATH.md#0.2
# @notes: Created context manager daemon

def backup_contexts():
    # Implementation...
```

**SQL:**
```sql
-- @agent: agent-critical-path
-- @timestamp: 2025-10-02T14:30:00Z
-- @task: CRITICAL-PATH.md#0.2

CREATE TABLE nodes (
    id TEXT PRIMARY KEY
);
```

**Markdown:**
```markdown
<!-- @agent: agent-critical-path -->
<!-- @timestamp: 2025-10-02T14:30:00Z -->
<!-- @task: CRITICAL-PATH.md#0.2 -->

# Documentation
```

### Annotation Fields

**Required:**
- `@agent:` Your agent name (agent-critical-path)
- `@timestamp:` When you wrote this (ISO 8601 format)
- `@task:` Which task from your task file

**Optional:**
- `@notes:` Brief explanation of what/why
- `@status:` complete, in_progress, blocked, etc.

---

## 🔍 How to Retrieve Another Agent's Context

### Scenario 1: You Find Code with Annotations

You open `modules/fx-persistence.ts` and see:

```typescript
// @agent: agent-modules-persist
// @timestamp: 2025-10-02T15:45:00Z
// @task: TRACK-B-MODULES.md#B2.1

export class SQLitePersistence {
    // What does this do? Why was it written this way?
}
```

### Step 1: Scan for Annotations

```bash
cd agent-coordinator
python agent-context-manager.py scan
```

This creates/updates `annotations.json` with all agent annotations.

### Step 2: Check Annotations Index

```bash
# View annotations for a specific file
python -c "
import json
with open('annotations.json') as f:
    data = json.load(f)
    for file_path, annotations in data.items():
        if 'fx-persistence.ts' in file_path:
            for ann in annotations:
                print(f'Agent: {ann[\"agent_name\"]}')
                print(f'Time: {ann[\"timestamp\"]}')
                print(f'Task: {ann[\"task_ref\"]}')
                print(f'Notes: {ann[\"notes\"]}')
                print()
"
```

### Step 3: Load That Agent's Context

The context files are stored in:
```
agent-coordinator/contexts/agent-modules-persist.json
```

**To read it:**

```python
import json
from datetime import datetime

# Load the agent's context
with open('contexts/agent-modules-persist.json', 'r') as f:
    context = json.load(f)

# Find messages around that timestamp
target_time = "2025-10-02T15:45:00Z"
target_date = target_time[:10]  # "2025-10-02"

print(f"Messages from {context['agent_name']} on {target_date}:")
print()

for msg in context['messages']:
    msg_time = msg.get('timestamp', '')
    if msg_time.startswith(target_date):
        print(f"[{msg_time}] {msg['role']}")
        print(msg['content'][:500])  # First 500 chars
        print()
```

### Step 4: Use the Information

You now know:
- **What** that agent was thinking
- **Why** they made that decision
- **What problems** they encountered
- **What** still needs work

---

## 📊 Quick Commands for CodeWeaver

### Check Status
```bash
python agent-context-manager.py status
```

Shows:
- Active agents
- Task progress
- Code annotations count

### Backup Contexts Now
```bash
python agent-context-manager.py backup
```

Saves all contexts to `backups/[timestamp]/`

### Scan for New Annotations
```bash
python agent-context-manager.py scan
```

Updates `annotations.json` with all code annotations

### Trim Your Context (if needed)
```bash
python agent-context-manager.py trim --agent agent-critical-path
```

If your context exceeds 200k tokens (though with 1M context you don't need this)

### Start the Daemon
```bash
# Run in background
python agent-context-manager.py daemon --interval 300
```

This runs continuously:
- Backs up every 5 minutes (300 seconds)
- Scans for annotations
- Monitors progress

---

## 🎯 Your Workflow as Agent 0

### Step 1: Annotate Your Work

Every time you modify a file:

```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: Added exports for $$, fx, $_$$

export { $$, $_$$, fx };
```

### Step 2: Update Task File

In `tasks/CRITICAL-PATH.md`:

```markdown
- [x] 0.1: Core file verified (15 min) - COMPLETE
- [x] 0.2: Exports fixed (30 min) - COMPLETE
- [ ] 0.3: Templates created (15 min) - IN PROGRESS
```

### Step 3: Run Scan

```bash
python agent-context-manager.py scan
```

Now other agents can find your work!

### Step 4: When Complete

Create the signal file:

```bash
touch tasks/.critical-path-complete
```

OR in Python:
```python
Path("tasks/.critical-path-complete").touch()
```

This unblocks all other agents.

---

## 🔗 Context Chain Example

### You (Agent 0) Write:

**File:** `fxn.ts`
```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: Fixed exports - all modules can now import $$

export { $$, $_$$, fx };
export type { FXNode, FXNodeProxy };
```

### Agent 2 Later Finds:

Opens `fxn.ts`, sees your annotation.

**Agent 2's thought process:**
1. "Who modified this? agent-critical-path"
2. "When? 2025-10-02T10:35:00Z"
3. "Let me check their context from that time"

**Agent 2 runs:**
```bash
python agent-context-manager.py scan
cat contexts/agent-critical-path.json | jq '.messages[] | select(.timestamp | startswith("2025-10-02T10"))'
```

**Agent 2 sees:**
- Your conversation about fixing exports
- The problems you encountered
- Why you made certain decisions
- What's left to do

**Agent 2 can now:**
- Continue your work correctly
- Avoid repeating your mistakes
- Build on your decisions

---

## 💾 Where Everything Is Stored

```
agent-coordinator/
├── contexts/                    # Active agent contexts
│   ├── agent-critical-path.json    # YOUR context
│   ├── agent-test-infra.json       # Agent 1's context
│   └── ...
│
├── backups/                     # Timestamped backups
│   ├── 20251002_103000/
│   │   ├── agent-critical-path.json
│   │   └── annotations.json
│   └── 20251002_103500/
│
├── annotations.json             # Index of all code annotations
│
└── mem/                         # Symlink to Claude contexts
    └── [your actual conversation files]
```

### Your Context File

**File:** `contexts/agent-critical-path.json`

**Contains:**
```json
{
  "agent_name": "agent-critical-path",
  "timestamp": "2025-10-02T10:30:00Z",
  "task_file": "CRITICAL-PATH.md",
  "current_tokens": 45000,
  "max_tokens": 200000,
  "messages": [
    {
      "role": "user",
      "content": "You are agent-critical-path...",
      "timestamp": "2025-10-02T10:30:00Z",
      "tokens": 150
    },
    {
      "role": "assistant",
      "content": "I'll start by fixing exports...",
      "timestamp": "2025-10-02T10:31:00Z",
      "tokens": 200
    }
  ]
}
```

---

## 🚨 Important Notes

### 1. Timestamp Format

**Always use ISO 8601:**
```
2025-10-02T10:35:00Z
```

**Not:**
- "Oct 2, 2025"
- "10/2/2025"
- "1728000000"

### 2. Agent Name

**Always use your official name:**
```
agent-critical-path
```

**Not:**
- "CodeWeaver"
- "Agent 0"
- "critical-path"

### 3. Annotation Placement

**Place annotations:**
- At the top of functions you modify
- At the top of files you create
- Above significant code blocks

**Don't annotate:**
- Every single line
- Code you didn't touch
- Generated code

### 4. Context Size

With 1M context window:
- You don't need to worry about trimming
- The daemon still backs up for safety
- Other agents with smaller contexts benefit from the system

---

## 🎯 Quick Reference Card

### Annotate Code
```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @task: CRITICAL-PATH.md#0.2
```

### Scan Annotations
```bash
python agent-context-manager.py scan
```

### Check Status
```bash
python agent-context-manager.py status
```

### View Another Agent's Work
```bash
cat contexts/agent-modules-core.json
```

### Create Signal (When Done)
```bash
touch tasks/.critical-path-complete
```

---

## ✅ Your Checklist

As Agent 0, you should:

- [ ] Annotate ALL code you write/modify
- [ ] Use correct timestamp format (ISO 8601)
- [ ] Update task file progress regularly
- [ ] Run scan after significant changes
- [ ] Create signal file when complete
- [ ] Document important decisions in @notes

---

**This ensures all 9 other agents can:**
- Know what you did
- Understand why
- Continue your work
- Avoid conflicts
- Build on your foundation

**Without this, they're flying blind!**
