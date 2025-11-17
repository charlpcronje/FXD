# Message for CodeWeaver (Agent 0)

Hi CodeWeaver! You're Agent 0 (agent-critical-path). Here's what you need to know:

---

## 📝 Add These Comments to Your Code

**Every time you modify a file, add this:**

```typescript
// @agent: agent-critical-path
// @timestamp: 2025-10-02T10:35:00Z
// @task: CRITICAL-PATH.md#0.2
// @notes: What you did

// Your code here...
```

**Replace:**
- Timestamp with current time (format: `2025-10-02T10:35:00Z`)
- Task number with what you're working on (#0.1, #0.2, etc.)
- Notes with brief explanation

---

## 🔍 How to See Another Agent's Context

If you find code with an annotation like:

```typescript
// @agent: agent-modules-persist
// @timestamp: 2025-10-02T15:45:00Z
```

**To see what they were thinking:**

```bash
# 1. Scan for annotations
cd agent-coordinator
python agent-context-manager.py scan

# 2. Read their context file
cat contexts/agent-modules-persist.json

# 3. Look for messages around that timestamp
# Their conversation is in the "messages" array
```

**Or use Python:**

```python
import json

# Load their context
with open('contexts/agent-modules-persist.json') as f:
    context = json.load(f)

# Find messages from that day
target_date = "2025-10-02"
for msg in context['messages']:
    if msg['timestamp'].startswith(target_date):
        print(f"{msg['role']}: {msg['content'][:200]}...")
```

---

## ✅ Quick Commands

```bash
# Check status
python agent-context-manager.py status

# Scan your code
python agent-context-manager.py scan

# When you're done
touch tasks/.critical-path-complete
```

---

## 🎯 That's It!

1. **Annotate code** you write
2. **Update task file** as you go
3. **Create signal** when done

Other agents can then see what you did and why!

---

**Full details:** `agent-coordinator/AGENT-0-GUIDE.md`
**Quick ref:** `agent-coordinator/FOR-CODEWEAVER.md`
