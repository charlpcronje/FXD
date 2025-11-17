# FXD Agent Coordination System

This directory contains the multi-agent coordination infrastructure for parallel FXD development.

## 📁 Directory Structure

```
agent-coordinator/
├── agent-context-manager.py   # Context management daemon
├── contexts/                   # Active agent contexts (backed up)
│   ├── agent-critical-path.json
│   ├── agent-test-infra.json
│   └── ... (one per agent)
├── backups/                    # Context backups (every 5 min)
│   ├── 20251002_143000/
│   ├── 20251002_143500/
│   └── ...
├── annotations.json            # Code annotation index
├── launch-agents.md            # How to launch agents
└── README.md                   # This file
```

## 🎯 Purpose

Enable 10 agents to work in parallel without conflicts by:
1. Tracking who wrote what code (annotations)
2. Managing agent memory (trim to 200k tokens)
3. Backing up contexts every 5 minutes
4. Loading relevant context from other agents
5. Coordinating task progress

## 🚀 Quick Start

### 1. Start Context Manager
```bash
python agent-context-manager.py daemon
```

### 2. Launch Agents
See `launch-agents.md` for detailed instructions

### 3. Monitor Progress
```bash
python agent-context-manager.py status
```

## 🔧 Commands

### Backup Contexts
```bash
python agent-context-manager.py backup
```

### Scan Code Annotations
```bash
python agent-context-manager.py scan
```

### View Status
```bash
python agent-context-manager.py status
```

### Trim Agent Context
```bash
python agent-context-manager.py trim --agent agent-name
```

### Run Daemon
```bash
python agent-context-manager.py daemon --interval 300
```

## 📝 Code Annotation Format

All agents must annotate their code:

```typescript
// @agent: agent-name
// @timestamp: 2025-10-02T14:30:00Z
// @task: TRACK-A-TESTS.md#A.1
// @status: complete
// @notes: Fixed imports, tested compilation

import { $$, $_$$, fx } from '../fxn.ts';

export function myFunction() {
  // Implementation...
}
```

## 🔄 How It Works

### Context Management
1. Each agent's conversation stored in `contexts/[agent-name].json`
2. Every 5 minutes, all contexts backed up
3. If context exceeds 200k tokens, trim oldest messages
4. Keep trimming until back to 180k tokens

### Annotation Tracking
1. Daemon scans all .ts files for `@agent:` annotations
2. Builds index of who wrote what
3. When agent opens file with annotations, can load that agent's context
4. Provides context about what was done and why

### Inter-Agent Communication
1. Agents communicate via task file updates
2. Mark tasks complete: `- [x]`
3. Update status: `**Status:** ✅ Complete`
4. Other agents monitor task files for dependencies

## 📊 Context Structure

```json
{
  "agent_name": "agent-test-infra",
  "timestamp": "2025-10-02T14:30:00Z",
  "task_file": "TRACK-A-TESTS.md",
  "current_tokens": 45000,
  "max_tokens": 200000,
  "messages": [
    {
      "role": "user",
      "content": "Your task is...",
      "timestamp": "2025-10-02T14:30:00Z",
      "tokens": 150
    },
    {
      "role": "assistant",
      "content": "I'll start by...",
      "timestamp": "2025-10-02T14:31:00Z",
      "tokens": 200
    }
  ]
}
```

## 🎯 Agent Coordination Rules

1. **File Ownership:** Each agent has exclusive files (see task files)
2. **Shared Files:** Check annotations before modifying
3. **Dependencies:** Wait for blocking tasks (signal files)
4. **Progress:** Update task file after each task
5. **Annotations:** Always annotate new/modified code
6. **Context:** Let daemon manage memory trimming

## 📈 Benefits

1. **Parallel Work:** 10 agents work simultaneously
2. **No Conflicts:** Clear file ownership
3. **Context Preserved:** Backups every 5 minutes
4. **Memory Managed:** Auto-trim to stay under limits
5. **Coordination:** Track progress via task files
6. **Knowledge Sharing:** Load context from other agents

## ⚠️ Important Notes

- **Start daemon first** before launching agents
- **Wait for critical path** (Agent 0) before parallel work
- **Check annotations** before modifying files
- **Update progress** in task files frequently
- **Back up contexts** are in `backups/` (safe to restore)

## 🚨 Troubleshooting

### Daemon not running
```bash
ps aux | grep agent-context-manager
# If not found:
python agent-context-manager.py daemon &
```

### Agent context too large
```bash
python agent-context-manager.py trim --agent agent-name
```

### Lost context
```bash
cd backups
ls -lt  # Find latest
cp [latest]/agent-name.json ../contexts/
```

### Annotation scan missing files
```bash
python agent-context-manager.py scan
# Check annotations.json
```

## 🎉 Success Indicators

- [ ] Daemon running continuously
- [ ] 10 agents active in contexts/
- [ ] Backups accumulating in backups/
- [ ] annotations.json growing
- [ ] Task files showing progress
- [ ] No merge conflicts
- [ ] All agents completing work

---

**This system enables 10x parallel development while maintaining coordination and context.**
