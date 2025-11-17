# Agent Coordinator Setup Instructions

## 🎯 Goal
Set up the multi-agent coordination system with symlinks to Claude's project context storage.

---

## 📋 Prerequisites

1. **Administrator/Root Access** (for symlink creation)
2. **Python 3.7+** installed
3. **Claude Code** with project context at:
   - Windows: `C:\Users\[USERNAME]\.claude\projects\C--dev-fxd`
   - Linux/Mac: `~/.claude/projects/C--dev-fxd`

---

## 🚀 Windows Setup

### Step 1: Run Setup as Administrator

```batch
# Right-click Command Prompt -> "Run as Administrator"
cd C:\dev\fxd\agent-coordinator
setup.bat
```

### What It Does:
- Creates `contexts/` directory
- Creates `backups/` directory
- Creates symlink: `mem/` → `C:\Users\[USER]\.claude\projects\C--dev-fxd`
- Creates `annotations.json`
- Creates helper scripts:
  - `start-daemon.bat`
  - `check-status.bat`
  - `scan-annotations.bat`

### Step 2: Verify Setup

```batch
# Check symlink
dir mem

# Should show: <JUNCTION> or <SYMLINK>
# Pointing to: C:\Users\[USER]\.claude\projects\C--dev-fxd
```

### Step 3: Start Daemon

```batch
start-daemon.bat
```

---

## 🐧 Linux/macOS Setup

### Step 1: Run Setup Script

```bash
cd /c/dev/fxd/agent-coordinator  # Or wherever your project is
chmod +x setup.sh
./setup.sh
```

### What It Does:
- Creates `contexts/` directory
- Creates `backups/` directory
- Creates symlink: `mem/` → `~/.claude/projects/C--dev-fxd`
- Creates `annotations.json`
- Creates helper scripts:
  - `start-daemon.sh`
  - `check-status.sh`
  - `scan-annotations.sh`

### Step 2: Verify Setup

```bash
# Check symlink
ls -la mem

# Should show: mem -> /home/[USER]/.claude/projects/C--dev-fxd
```

### Step 3: Start Daemon

```bash
./start-daemon.sh
```

---

## 📁 Directory Structure After Setup

```
agent-coordinator/
├── mem/                          # → Symlink to Claude contexts
│   └── [Claude project files]    # Agent conversation histories
├── contexts/                      # Agent context JSONs
│   ├── agent-critical-path.json
│   ├── agent-test-infra.json
│   └── ... (created as agents work)
├── backups/                       # Timestamped backups
│   ├── 20251002_143000/
│   ├── 20251002_143500/
│   └── ... (every 5 minutes)
├── annotations.json               # Code annotation index
├── agent-context-manager.py       # Main daemon
├── setup.bat / setup.sh           # Setup scripts
├── start-daemon.bat / .sh         # Quick launchers
├── check-status.bat / .sh
├── scan-annotations.bat / .sh
├── launch-agents.md               # How to launch agents
└── README.md                      # Documentation
```

---

## 🔍 Verifying the Setup

### 1. Check Symlink

**Windows:**
```batch
dir mem
# Should show <SYMLINK> or <JUNCTION>
```

**Linux/Mac:**
```bash
ls -la mem
# Should show: mem -> ~/.claude/projects/C--dev-fxd
```

### 2. Check Claude Context Access

**Windows:**
```batch
dir mem
# Should list Claude's project context files
```

**Linux/Mac:**
```bash
ls mem/
# Should list Claude's project context files
```

### 3. Test Context Manager

```bash
python agent-context-manager.py status
# Should run without errors
```

---

## 🚨 Troubleshooting

### Symlink Creation Failed

**Windows:**
- Run Command Prompt as Administrator
- Developer Mode enabled: Settings → Update & Security → For developers → Developer Mode ON
- Use `mklink /D` for directory junction

**Linux/Mac:**
- Check permissions: `sudo ./setup.sh`
- Verify directory exists: `ls ~/.claude/projects/C--dev-fxd`

### Python Not Found

**Windows:**
```batch
# Install Python from python.org
# Or use Windows Store
python --version
```

**Linux/Mac:**
```bash
# Install via package manager
sudo apt install python3  # Ubuntu/Debian
brew install python3      # macOS

python3 --version
```

### Claude Context Directory Not Found

Claude might be storing contexts elsewhere. Check:

**Windows:**
```batch
dir /s /b C:\Users\%USERNAME%\.claude
dir /s /b C:\Users\%USERNAME%\AppData
```

**Linux/Mac:**
```bash
find ~ -name ".claude" -type d 2>/dev/null
find ~ -name "*claude*" -type d 2>/dev/null
```

### Symlink Points to Wrong Location

**Windows:**
```batch
# Remove old symlink
rmdir mem
# Create new one
mklink /D mem "C:\correct\path\to\claude\contexts"
```

**Linux/Mac:**
```bash
# Remove old symlink
rm mem
# Create new one
ln -s /correct/path/to/claude/contexts mem
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `contexts/` directory exists
- [ ] `backups/` directory exists
- [ ] `mem/` symlink exists
- [ ] `mem/` points to Claude project contexts
- [ ] Can access files in `mem/`
- [ ] `annotations.json` exists
- [ ] Python runs: `python agent-context-manager.py status`
- [ ] Helper scripts created (`.bat` or `.sh`)
- [ ] Can start daemon: `start-daemon.bat` or `./start-daemon.sh`

---

## 🎉 Next Steps

Once setup is complete:

1. **Start the daemon:**
   ```bash
   # Windows
   start-daemon.bat

   # Linux/Mac
   ./start-daemon.sh
   ```

2. **Read launch instructions:**
   ```bash
   # Open in editor
   code launch-agents.md
   ```

3. **Launch Agent 0 (Critical Path):**
   - Open Claude Code
   - Load task: `tasks/CRITICAL-PATH.md`
   - Start working

4. **Wait for Agent 0 to complete**

5. **Launch remaining 9 agents in parallel**

6. **Monitor progress:**
   ```bash
   # Windows
   check-status.bat

   # Linux/Mac
   ./check-status.sh
   ```

---

## 📝 Understanding the Symlink

### Why Symlink?

The symlink (`mem/`) allows the context manager to:
1. **Read** Claude's actual conversation contexts
2. **Track** what each agent discussed
3. **Load** relevant context when agents reference each other's work
4. **Backup** important conversation states
5. **Restore** if needed

### How It Works

```
agent-coordinator/mem/  →  C:\Users\[USER]\.claude\projects\C--dev-fxd\

When context manager reads:
  ./mem/conversations.json

It actually reads:
  C:\Users\[USER]\.claude\projects\C--dev-fxd\conversations.json

This happens transparently via the symlink.
```

### Safety

- **Original files** remain in Claude's directory
- **Symlink** is just a pointer, not a copy
- **Daemon** only reads (doesn't modify)
- **Backups** go to `backups/`, not `mem/`

---

## 🔧 Manual Setup (If Scripts Fail)

### Windows (Manual)

```batch
cd C:\dev\fxd\agent-coordinator

REM Create directories
mkdir contexts
mkdir backups

REM Create symlink (as Administrator)
mklink /D mem "C:\Users\%USERNAME%\.claude\projects\C--dev-fxd"

REM Create annotations file
echo {} > annotations.json

REM Test
python agent-context-manager.py status
```

### Linux/Mac (Manual)

```bash
cd /c/dev/fxd/agent-coordinator

# Create directories
mkdir -p contexts
mkdir -p backups

# Create symlink
ln -s ~/.claude/projects/C--dev-fxd mem

# Create annotations file
echo "{}" > annotations.json

# Test
python3 agent-context-manager.py status
```

---

## 💡 Tips

1. **Keep daemon running** - It backs up every 5 minutes
2. **Check status often** - Monitor agent progress
3. **Scan after changes** - Update annotation index
4. **Backup contexts** - They're in `backups/` if needed
5. **One daemon** - Don't run multiple instances

---

**Setup complete! Ready to launch agents. 🚀**
