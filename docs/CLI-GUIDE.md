<!-- @agent: agent-docs -->
# FXD CLI Guide

**Complete guide to the FXD command-line interface**

---

## Overview

The FXD CLI (`fxd-cli.ts`) provides commands for managing FXD disks, importing/exporting code, and working with snippets.

**Status:** v0.1 Alpha - Core commands implemented, some features in progress

---

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/fxd.git
cd fxd

# Make sure Deno is installed
deno --version

# Test CLI
deno run -A fxd-cli.ts help
```

---

## Basic Usage

```bash
# General syntax
deno run -A fxd-cli.ts <command> [arguments] [options]

# Show help
deno run -A fxd-cli.ts help

# Run a command
deno run -A fxd-cli.ts create my-project
```

**Tip:** Create an alias for convenience:
```bash
# In your ~/.bashrc or ~/.zshrc
alias fxd="deno run -A /path/to/fxd/fxd-cli.ts"

# Then use:
fxd help
fxd create my-project
```

---

## Commands

### `create` - Create New Disk

Create a new FXD disk for organizing code.

**Usage:**
```bash
deno run -A fxd-cli.ts create <name> [--path=./]
```

**Arguments:**
- `<name>` - Disk name (required, alphanumeric + hyphens/underscores)

**Options:**
- `--path=<path>` - Parent directory (default: current directory)

**Examples:**
```bash
# Create disk in current directory
deno run -A fxd-cli.ts create my-project

# Create in specific path
deno run -A fxd-cli.ts create backend --path=./projects

# Output:
# ✅ FXD disk created: my-project
# 📁 Location: ./my-project.fxd
# 🎯 Next steps:
#    fxd-cli import <your-code-folder>
#    fxd-cli list
```

**What it does:**
- Creates disk structure in FX graph
- Initializes collections (snippets, views, groups)
- Sets up metadata (creator, timestamps)
- Saves state to `.fxd-state.json`

---

### `import` - Import Code

Import files or directories into FXD as snippets.

**Usage:**
```bash
deno run -A fxd-cli.ts import <path> [--type=auto]
```

**Arguments:**
- `<path>` - File or directory to import (required)

**Options:**
- `--type=auto` - Import type (default: auto-detect)

**Examples:**
```bash
# Import single file
deno run -A fxd-cli.ts import ./app.js

# Import directory
deno run -A fxd-cli.ts import ./src

# Import with spinner
# 📥 Importing files from: ./src
# ✅ Import completed!
#    Files imported: 15
#    Snippets created: 42
```

**Supported file types:**
- **JavaScript:** `.js`, `.jsx`
- **TypeScript:** `.ts`, `.tsx`
- **Python:** `.py`
- **Rust:** `.rs`
- **Go:** `.go`
- **Java:** `.java`
- **C/C++:** `.c`, `.cpp`, `.h`, `.hpp`
- **Others:** Imported as text snippets

**Smart parsing:**
- Code files are parsed into function/class snippets
- Non-code files are imported as single snippets
- Directory structure is preserved
- Metadata is auto-extracted (language, type, source)

**Skips:**
- `.git` directories
- `node_modules`
- Hidden files (starting with `.`)
- Log/cache files (`.log`, `.tmp`, `.cache`)

---

### `list` - List Contents

Display disk contents (snippets, views, metadata).

**Usage:**
```bash
deno run -A fxd-cli.ts list [--type=all|snippets|views]
```

**Options:**
- `--type=all` - Show everything (default)
- `--type=snippets` - Show only snippets
- `--type=views` - Show only views

**Examples:**
```bash
# List everything
deno run -A fxd-cli.ts list

# Output:
# 📋 FXD Disk Contents
# ============================================================
#
# 💿 Disk: my-project
# 📅 Created: 10/2/2025 1:23:45 PM
# 📂 Path: ./my-project.fxd
#
# ✂️  SNIPPETS (42):
# ────────────────────────────────────────────────────────────
#    1. app.main
#       Language: javascript | Type: function | Lines: 15
#    2. app.config
#       Language: javascript | Type: function | Lines: 8
#    ...
#
# 👁️  VIEWS (15):
# ────────────────────────────────────────────────────────────
#    1. app.js (156 lines, 4.23 KB)
#    2. utils.js (89 lines, 2.41 KB)
#    ...
#
# ℹ️  METADATA:
# ────────────────────────────────────────────────────────────
#    Creator: username
#    Description: FXD disk: my-project
#
# ============================================================
# 🌐 Web UI: http://localhost:3000/app
# 🎯 Visualizer: http://localhost:8080

# List only snippets
deno run -A fxd-cli.ts list --type=snippets

# List only views
deno run -A fxd-cli.ts list --type=views
```

**No disk created:**
```bash
# If no disk exists:
# 💿 No disk created yet
# 💡 Run 'fxd-cli create <name>' to create a new disk
```

---

### `run` - Execute Snippet

Run a snippet (JavaScript/TypeScript supported).

**Usage:**
```bash
deno run -A fxd-cli.ts run <snippet-id> [--visualize]
```

**Arguments:**
- `<snippet-id>` - Snippet to execute (required)

**Options:**
- `--visualize` or `-v` - Open visualizer

**Examples:**
```bash
# Run a snippet
deno run -A fxd-cli.ts run app.main

# Output:
# 🚀 Running snippet: app.main
# ────────────────────────────────────────────────────────────
# Language: javascript
# Type: function
# Source: app.js
# ────────────────────────────────────────────────────────────
#
# ⠋ Executing JavaScript code...
# ✅ Execution completed successfully!
#
# 📤 Return value:
#    "Hello World"
#
# ⏱️  Execution time: 15ms

# Run with visualizer
deno run -A fxd-cli.ts run app.main --visualize

# Additional output:
# 🌟 Visualizer mode enabled
# 👀 Visit: http://localhost:8080
# 🎬 Click "▶️ Start Live Demo" to see execution visualization
```

**Supported languages:**
- **JavaScript/TypeScript:** Direct execution
- **Others:** Show code preview (first 15 lines)

**Snippet not found:**
```bash
# Error handling:
# ❌ Snippet not found: invalid-id
#
# 💡 Available snippets:
#    - app.main
#    - app.config
#    - utils.helper
#    ... and 39 more
```

**Execution tracking:**
- Tracks start/end time
- Records duration
- Captures errors
- Saves execution history

---

### `visualize` - Start Visualizer

Display information about the 3D visualizer.

**Usage:**
```bash
deno run -A fxd-cli.ts visualize [--port=8080]
```

**Options:**
- `--port=<port>` - Visualizer port (default: 8080)

**Examples:**
```bash
# Show visualizer info
deno run -A fxd-cli.ts visualize

# Output:
# 🌟 FXD 3D Visualizer
# ============================================================
#
# 📍 URL: http://localhost:8080
# 🎮 Port: 8080
#
# 📊 Current Disk Status:
#    Disk: my-project
#    Snippets: 42
#
# 🎮 Interactive Features:
# ────────────────────────────────────────────────────────────
#    • Click nodes to select and inspect
#    • Press [V] to show version timeline
#    • Press [B] to create a new branch
#    • Press [Space] to pause/resume
#    • Mouse wheel to zoom
#    • Right-click drag to rotate view
#
# ⚡ Live Execution Features:
# ────────────────────────────────────────────────────────────
#    • Nodes light up when code executes
#    • Data flows show as pulsing connections
#    • Click nodes to see I/O history
#    • Time-travel debugging support
#    • Real-time performance metrics
#
# 🚀 Quick Start:
# ────────────────────────────────────────────────────────────
#    1. Open http://localhost:8080 in your browser
#    2. Click "▶️ Start Live Demo" to begin
#    3. Import some code: fxd-cli import <path>
#    4. Run code: fxd-cli run <snippet-id> --visualize
#
# 💡 Note: The visualizer is a separate web application
#    Make sure the web server is running on port 8080
# ============================================================

# Use custom port
deno run -A fxd-cli.ts visualize --port=3000
```

**Note:** The visualizer is currently a stub/placeholder in v0.1

---

### `export` - Export Contents

Export FXD contents to files or archive.

**Usage:**
```bash
deno run -A fxd-cli.ts export [output-path] [--format=files|archive]
```

**Arguments:**
- `[output-path]` - Export location (default: `./fxd-export`)

**Options:**
- `--format=files` - Export as individual files (default)
- `--format=archive` - Export as JSON archive

**Examples:**
```bash
# Export as files
deno run -A fxd-cli.ts export

# Output:
# 📤 Exporting FXD Contents
# ============================================================
#
# 📁 Export format: Individual files
# 📂 Output path: ./fxd-export
#
#   ✓ app.js (4.23 KB)
#   ✓ utils.js (2.41 KB)
#   ✓ config.json (0.85 KB)
#   ✓ _snippets.json (metadata)
#
# ✅ Export completed!
#    Files created: 4
#    Total size: 7.49 KB
#    Location: ./fxd-export
#
# 💡 Next steps:
#    - Files are ready to use in other projects
#    - Original formatting and structure preserved

# Export to specific path
deno run -A fxd-cli.ts export ./output

# Export as archive
deno run -A fxd-cli.ts export --format=archive

# Output:
# 📦 Export format: Archive
# 📂 Output path: ./fxd-export
#
#   ✓ fxd-archive.json (12.56 KB)
#
# 📊 Archive contents:
#      Snippets: 42
#      Views: 15
#      Groups: 3
#
# ✅ Export completed!
#    Files created: 1
#    Total size: 12.56 KB
#    Location: ./fxd-export
#
# 💡 Next steps:
#    - Share the fxd-archive.json file
#    - Import it later: fxd-cli import ./fxd-export/fxd-archive.json
```

**No disk to export:**
```bash
# Error:
# ❌ No disk to export
# 💡 Create a disk first: fxd-cli create <name>
```

**Archive format** (JSON):
```json
{
  "disk": {
    "name": "my-project",
    "created": 1696723200000,
    "version": "1.0.0",
    "path": "./my-project.fxd"
  },
  "snippets": { /* all snippets */ },
  "views": { /* all views */ },
  "groups": { /* all groups */ },
  "markers": { /* all markers */ },
  "metadata": { /* disk metadata */ }
}
```

---

## State Management

FXD CLI maintains state in `.fxd-state.json` in the current directory.

**State file:**
```json
{
  "disk": {
    "name": "my-project",
    "created": 1696723200000,
    "version": "1.0.0",
    "path": "./my-project.fxd"
  },
  "snippets": {},
  "views": {},
  "groups": {},
  "markers": {},
  "metadata": {
    "creator": "username",
    "description": "FXD disk: my-project"
  }
}
```

**Auto-saved** after:
- Creating disk
- Importing files
- Running snippets
- Exporting contents

**Manual cleanup:**
```bash
# Remove state file to start fresh
rm .fxd-state.json
```

---

## Common Workflows

### 1. Import Existing Project

```bash
# Create disk
deno run -A fxd-cli.ts create my-app

# Import source code
deno run -A fxd-cli.ts import ./src

# List contents
deno run -A fxd-cli.ts list

# Run main file
deno run -A fxd-cli.ts run main
```

### 2. Code Organization

```bash
# Import different modules
deno run -A fxd-cli.ts import ./api
deno run -A fxd-cli.ts import ./utils
deno run -A fxd-cli.ts import ./components

# View snippets by type
deno run -A fxd-cli.ts list --type=snippets
```

### 3. Export for Sharing

```bash
# Export as archive
deno run -A fxd-cli.ts export ./share --format=archive

# Share fxd-archive.json
# Others can import it:
deno run -A fxd-cli.ts import ./share/fxd-archive.json
```

### 4. Development Workflow

```bash
# Create development disk
deno run -A fxd-cli.ts create dev-disk

# Import current work
deno run -A fxd-cli.ts import ./work-in-progress

# Test snippets
deno run -A fxd-cli.ts run test-function

# Export when done
deno run -A fxd-cli.ts export ./release
```

---

## Error Handling

### Common Errors

**1. Disk name invalid:**
```bash
deno run -A fxd-cli.ts create "my project"
# ❌ Invalid disk name. Use only letters, numbers, hyphens, and underscores.
```

**2. Path not found:**
```bash
deno run -A fxd-cli.ts import ./nonexistent
# ❌ Import failed
# Error: No such file or directory
# 💡 Tip: Check that the path exists and you have read permissions
```

**3. Snippet not found:**
```bash
deno run -A fxd-cli.ts run invalid-id
# ❌ Snippet not found: invalid-id
# 💡 Available snippets:
#    - app.main
#    - app.config
#    ... and 39 more
```

**4. No disk created:**
```bash
deno run -A fxd-cli.ts list
# 💿 No disk created yet
# 💡 Run 'fxd-cli create <name>' to create a new disk
```

**5. Permission errors:**
```bash
deno run -A fxd-cli.ts export /protected/path
# ❌ Export failed
# Error: Permission denied
# 💡 Tip: Check that you have write permissions for /protected/path
```

---

## Tips & Tricks

### 1. Create Alias

```bash
# Add to ~/.bashrc or ~/.zshrc
alias fxd="deno run -A ~/fxd/fxd-cli.ts"

# Then use short commands
fxd create my-project
fxd import ./src
fxd list
```

### 2. Quick Imports

```bash
# Import multiple directories at once
deno run -A fxd-cli.ts import ./src
deno run -A fxd-cli.ts import ./lib
deno run -A fxd-cli.ts import ./components
```

### 3. Use Tab Completion

```bash
# List snippets and copy IDs
deno run -A fxd-cli.ts list --type=snippets

# Then run by ID
deno run -A fxd-cli.ts run app.main
```

### 4. Export Before Major Changes

```bash
# Backup current state
deno run -A fxd-cli.ts export ./backup-$(date +%Y%m%d) --format=archive
```

### 5. Clean Workspace

```bash
# Remove state to start fresh
rm .fxd-state.json

# Create new disk
deno run -A fxd-cli.ts create fresh-start
```

---

## Advanced Usage

### Custom Script

Create a wrapper script for convenience:

**fxd.sh:**
```bash
#!/bin/bash
FXDIR="$HOME/fxd"
deno run -A "$FXDIR/fxd-cli.ts" "$@"
```

**Usage:**
```bash
chmod +x fxd.sh
./fxd.sh create my-project
```

### Programmatic Usage

Import CLI functionality in your scripts:

```typescript
import { $$ } from './fxn.ts'

// Create disk programmatically
$$('disk.name').val('my-project')
$$('disk.created').val(Date.now())
$$('snippets').val({})

// Import your logic here
```

---

## What's Next?

- **[API Reference](API-REFERENCE.md)** - Core API docs
- **[Examples](EXAMPLES.md)** - Working examples
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues
- **[Getting Started](GETTING-STARTED.md)** - Installation guide

---

## Future Commands (Planned)

Coming in future releases:

- `fxd search <query>` - Search snippets
- `fxd tag <snippet> <tags>` - Tag snippets
- `fxd merge <disk1> <disk2>` - Merge disks
- `fxd diff <disk1> <disk2>` - Compare disks
- `fxd sync <remote>` - Sync with remote
- `fxd version` - Show version
- `fxd update` - Update CLI
- `fxd doctor` - Check installation

---

<!-- @agent: agent-docs -->
<!-- Last updated: 2025-10-02 -->
