#!/bin/bash
# FXD Agent Coordinator Setup (Linux/macOS)
# Sets up symlinks and directory structure

echo "===================================="
echo "FXD Agent Coordinator Setup"
echo "===================================="
echo ""

# Create directories
echo "Creating directories..."
mkdir -p ./contexts
mkdir -p ./backups
echo "  - contexts/"
echo "  - backups/"
echo ""

# Create symlink to Claude project contexts
echo "Creating symlink to Claude project contexts..."
CLAUDE_PROJECT="$HOME/.claude/projects/C--dev-fxd"

if [ -d "$CLAUDE_PROJECT" ]; then
    # Remove existing mem directory if it's not a symlink
    if [ -e "./mem" ]; then
        echo "  - Removing existing mem directory..."
        rm -rf ./mem
    fi

    # Create symlink
    ln -s "$CLAUDE_PROJECT" ./mem

    if [ $? -eq 0 ]; then
        echo "  - SUCCESS: Symlink created"
        echo "  - From: $(pwd)/mem"
        echo "  - To:   $CLAUDE_PROJECT"
    else
        echo "  - ERROR: Failed to create symlink"
        exit 1
    fi
else
    echo "  - WARNING: Claude project directory not found"
    echo "  - Expected: $CLAUDE_PROJECT"
    echo "  - The symlink will be created when the directory exists"
fi
echo ""

# Create empty annotations file
echo "Creating annotations.json..."
if [ ! -f "./annotations.json" ]; then
    echo "{}" > ./annotations.json
    echo "  - Created annotations.json"
else
    echo "  - annotations.json already exists"
fi
echo ""

# Test Python
echo "Checking Python installation..."
if command -v python3 &> /dev/null; then
    python3 --version
    echo "  - Python is installed"
else
    echo "  - WARNING: Python not found"
    echo "  - Install Python 3.7+ to run context manager"
fi
echo ""

# Create quick launch scripts
echo "Creating launch scripts..."

# Daemon launcher
cat > start-daemon.sh << 'EOF'
#!/bin/bash
echo "Starting FXD Context Manager Daemon..."
python3 agent-context-manager.py daemon
EOF
chmod +x start-daemon.sh
echo "  - Created start-daemon.sh"

# Status checker
cat > check-status.sh << 'EOF'
#!/bin/bash
python3 agent-context-manager.py status
EOF
chmod +x check-status.sh
echo "  - Created check-status.sh"

# Scanner
cat > scan-annotations.sh << 'EOF'
#!/bin/bash
python3 agent-context-manager.py scan
EOF
chmod +x scan-annotations.sh
echo "  - Created scan-annotations.sh"

echo ""
echo "===================================="
echo "Setup Complete!"
echo "===================================="
echo ""
echo "Directory Structure:"
echo "  $(pwd)/contexts/         - Agent contexts"
echo "  $(pwd)/backups/          - Context backups"
echo "  $(pwd)/mem/              - Symlink to Claude contexts"
echo "  $(pwd)/annotations.json  - Code annotations index"
echo ""
echo "Quick Launch:"
echo "  ./start-daemon.sh      - Start context manager"
echo "  ./check-status.sh      - Check agent status"
echo "  ./scan-annotations.sh  - Scan for annotations"
echo ""
echo "Next Steps:"
echo "  1. Review: launch-agents.md"
echo "  2. Start daemon: ./start-daemon.sh"
echo "  3. Launch agents in Claude Code"
echo ""
