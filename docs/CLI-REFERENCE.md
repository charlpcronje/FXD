# FXD CLI Reference - Complete Command Documentation

**Version:** 2.0.0
**Updated:** 2025-11-20
**Agent:** Agent 3 - CLI Excellence & System Integration

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Global Options](#global-options)
- [Commands](#commands)
  - [help](#help)
  - [version](#version)
  - [health](#health)
  - [create](#create)
  - [save](#save)
  - [load](#load)
  - [import](#import)
  - [export](#export)
  - [stats](#stats)
  - [list](#list)
  - [mount](#mount)
  - [unmount](#unmount)
- [Shell Completions](#shell-completions)
- [File Associations](#file-associations)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Quick Install (Recommended)

```bash
# Run the installer
deno run -A scripts/install.ts

# Or build and install manually
deno run -A scripts/build-cli.ts
deno run -A scripts/install.ts
```

### Manual Installation

```bash
# Build binaries for all platforms
deno run -A scripts/build-cli.ts

# Install to system
deno run -A scripts/install.ts
```

### Verify Installation

```bash
fxd version
fxd health
```

---

## Quick Start

```bash
# Create a new FXD project
fxd create my-project

# Import code into the project
fxd import ./src --save my-project.fxd

# View statistics
fxd stats my-project.fxd

# List all FXD files
fxd list

# Export to files
fxd export ./output --format files
```

---

## Global Options

These options can be used with any command:

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help information |
| `--verbose`, `-v` | Enable verbose output |
| `--quiet`, `-q` | Suppress non-error output |
| `--version` | Show version information |

### Examples

```bash
fxd save --verbose my-project.fxd
fxd import ./src --quiet
fxd --help
```

---

## Commands

### `help`

Show help information for all commands or a specific command.

**Syntax:**
```bash
fxd help [command]
```

**Examples:**
```bash
fxd help                # Show all commands
fxd help save           # Show help for save command
fxd help import         # Show help for import command
```

**Output:**
- List of all available commands
- Brief description of each command
- Usage examples

---

### `version`

Display FXD CLI version and component information.

**Syntax:**
```bash
fxd version
```

**Examples:**
```bash
fxd version
```

**Output:**
```
FXD CLI v2.0.0 (Enhanced Edition)
  • FX Framework: v1.0.0
  • Persistence: SQLite-based
  • Node Support: Yes
  • Deno Support: Yes
```

---

### `health`

Check FXD system health and dependencies.

**Syntax:**
```bash
fxd health
```

**Examples:**
```bash
fxd health
```

**Output:**
```
🏥 FXD System Health Check

   ✅ FX Framework        Working
   ✅ Persistence         SQLite working
   ✅ File System         Read/Write OK

✅ All systems operational
```

**Exit Codes:**
- `0` - All systems operational
- `1` - Some systems have issues

---

### `create`

Create a new FXD project file.

**Syntax:**
```bash
fxd create <project-name> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--template <type>` | Project template (empty, basic, full) | `basic` |

**Examples:**
```bash
fxd create my-project                    # Create with default template
fxd create my-project --template empty   # Create empty project
fxd create my-project --template full    # Create full featured project
```

**Output:**
- Creates `<project-name>.fxd` file
- Initializes project structure
- Shows creation confirmation

---

### `save`

Save current FX state to a .fxd file.

**Syntax:**
```bash
fxd save <filename>
```

**Arguments:**
- `filename` - Name of the .fxd file to create (extension optional)

**Examples:**
```bash
fxd save project                # Creates project.fxd
fxd save my-work.fxd           # Creates my-work.fxd
fxd save backup/project        # Creates backup/project.fxd
```

**Output:**
```
💾 Saving to project.fxd...
✅ Saved successfully!
   📊 Statistics:
      • Nodes: 150
      • Snippets: 25
      • Views: 5
```

**Notes:**
- Overwrites existing files
- Creates parent directories if needed
- Saves all current state (nodes, snippets, views)

---

### `load`

Load FX state from a .fxd file.

**Syntax:**
```bash
fxd load <filename>
```

**Arguments:**
- `filename` - Name of the .fxd file to load

**Examples:**
```bash
fxd load project.fxd           # Load project.fxd
fxd load backup/old-work       # Load from subdirectory
```

**Output:**
```
📂 Loading from project.fxd...
✅ Loaded successfully!
   📊 Statistics:
      • Nodes: 150
      • Snippets: 25
      • Views: 5
```

**Error Cases:**
- File not found
- Invalid .fxd file format
- Corrupted database

---

### `import`

Import files or directories into FX state.

**Syntax:**
```bash
fxd import <path> [options]
```

**Arguments:**
- `path` - File or directory to import

**Options:**
| Option | Description |
|--------|-------------|
| `--save <filename>` | Save imported data to .fxd file |
| `--format <type>` | Import format (auto, json, yaml) |
| `--recursive`, `-r` | Import directories recursively |

**Examples:**
```bash
# Import single file
fxd import ./src/main.ts

# Import directory
fxd import ./src

# Import and save
fxd import ./src --save project.fxd

# Import with specific format
fxd import data.json --format json
```

**Output:**
```
📥 Importing from ./src...
   ✓ Imported: ./src/main.ts as snippet 'main'
   ✓ Imported: ./src/utils.ts as snippet 'utils'
✅ Import completed!
```

**Supported File Types:**
- JavaScript (.js)
- TypeScript (.ts)
- Python (.py)
- Rust (.rs)
- Go (.go)
- HTML (.html)
- CSS (.css)
- JSON (.json)
- YAML (.yaml, .yml)
- Text (.txt)

**Notes:**
- Automatically detects language from extension
- Skips hidden files (starting with .)
- Skips node_modules directories

---

### `export`

Export FX state to files or other formats.

**Syntax:**
```bash
fxd export <output-dir> [options]
```

**Arguments:**
- `output-dir` - Directory for exported files

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--format <type>` | Export format (files, json, html) | `files` |
| `--compress` | Compress output as .zip | `false` |

**Examples:**
```bash
# Export as individual files
fxd export ./output

# Export as JSON
fxd export ./output --format json

# Export as HTML documentation
fxd export ./docs --format html

# Export and compress
fxd export ./backup --format files --compress
```

**Output Formats:**

#### Files Format
```
output/
  ├── snippets/
  │   ├── main.ts
  │   ├── utils.ts
  │   └── config.json
  └── metadata.json
```

#### JSON Format
```json
{
  "snippets": { ... },
  "views": { ... },
  "groups": { ... },
  "metadata": {
    "exported": "2025-11-20T12:00:00Z",
    "version": "2.0.0"
  }
}
```

#### HTML Format
- Complete HTML documentation
- Syntax-highlighted code blocks
- Table of contents
- Searchable

---

### `stats`

Show statistics about FXD files or current state.

**Syntax:**
```bash
fxd stats [filename]
```

**Arguments:**
- `filename` - (Optional) .fxd file to analyze

**Examples:**
```bash
fxd stats                  # Show current state statistics
fxd stats project.fxd      # Show file statistics
```

**Output:**
```
📊 Statistics for project.fxd:
   • Nodes: 150
   • Snippets: 25
   • Views: 5
   • Groups: 3
   • Size: 2.5 MB
   • Created: 2025-11-15
   • Modified: 2025-11-20
```

---

### `list`

List all .fxd files in the current directory.

**Syntax:**
```bash
fxd list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--recursive`, `-r` | Search subdirectories |
| `--sort <field>` | Sort by name, size, or date |

**Examples:**
```bash
fxd list                   # List files in current directory
fxd list --recursive       # Include subdirectories
fxd list --sort size       # Sort by file size
```

**Output:**
```
📂 FXD Files in current directory:

   💾 project.fxd         2.5 MB     11/20/2025
   💾 backup.fxd          1.8 MB     11/15/2025
   💾 test.fxd            0.5 MB     11/10/2025
```

---

### `mount`

Mount an FXD file as a virtual drive.

**Syntax:**
```bash
fxd mount <filename> [options]
```

**Arguments:**
- `filename` - .fxd file to mount

**Options:**
| Option | Description |
|--------|-------------|
| `--drive <letter>` | Drive letter (Windows: R:, S:, etc.) |
| `--readonly`, `-r` | Mount read-only |
| `--mountpoint <path>` | Mount point (Linux/macOS) |

**Examples:**
```bash
# Windows
fxd mount project.fxd --drive R:

# Linux/macOS
fxd mount project.fxd --mountpoint /mnt/fxd

# Read-only mount
fxd mount project.fxd --readonly
```

**Output:**
```
🗻 Mounting project.fxd...
✅ Mounted successfully!
   Drive: R:\
   Mode: Read-Write
   Snippets available as files
```

**Notes:**
- Requires WinFSP (Windows) or FUSE (Linux/macOS)
- Files appear as real filesystem files
- Edits sync automatically to .fxd file

---

### `unmount`

Unmount a virtual drive.

**Syntax:**
```bash
fxd unmount <drive-or-path>
```

**Arguments:**
- `drive-or-path` - Drive letter or mount point

**Examples:**
```bash
# Windows
fxd unmount R:

# Linux/macOS
fxd unmount /mnt/fxd
```

**Output:**
```
🔻 Unmounting R:\...
✅ Unmounted successfully!
   Changes saved to project.fxd
```

---

## Shell Completions

FXD provides shell completions for better command-line experience.

### Bash

```bash
# Install
sudo cp cli/completions/fxd.bash /etc/bash_completion.d/fxd
source ~/.bashrc

# Usage
fxd <TAB>           # Show all commands
fxd save <TAB>      # Complete .fxd files
```

### Zsh

```bash
# Install
mkdir -p ~/.zsh/completions
cp cli/completions/fxd.zsh ~/.zsh/completions/_fxd
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
source ~/.zshrc

# Usage
fxd <TAB>           # Show all commands with descriptions
```

### Fish

```bash
# Install
cp cli/completions/fxd.fish ~/.config/fish/completions/

# Usage
fxd <TAB>           # Auto-complete commands and files
```

### PowerShell

```powershell
# Install (add to profile)
notepad $PROFILE
# Add: . path\to\cli\completions\fxd.ps1

# Usage
fxd <TAB>           # Cycle through completions
```

---

## File Associations

Enable double-click to open .fxd files.

### Windows

```powershell
# Run as Administrator
deno run -A scripts/file-associations/windows-registry.ts
```

**Features:**
- Double-click .fxd files to open
- Right-click context menu: "Open with FXD", "Show Statistics", "Export"
- Custom icon for .fxd files
- "New" menu: Create new .fxd file

### Linux

```bash
deno run -A scripts/file-associations/linux-desktop.ts
```

**Features:**
- Desktop file integration
- MIME type registration
- File manager integration
- Custom icon

### macOS

```bash
deno run -A scripts/file-associations/macos-plist.ts
```

**Features:**
- Application bundle (FXD.app)
- UTI (Uniform Type Identifier) registration
- Finder integration
- Quick Look support (planned)

---

## Examples

### Complete Workflow

```bash
# 1. Create project
fxd create my-app

# 2. Import code
fxd import ./src --save my-app.fxd

# 3. View stats
fxd stats my-app.fxd

# 4. Mount for editing
fxd mount my-app.fxd --drive R:

# 5. (Edit files in R:\ drive)

# 6. Unmount and save
fxd unmount R:

# 7. Export for backup
fxd export ./backup --format json
```

### Backup and Restore

```bash
# Backup
fxd save backup-$(date +%Y%m%d).fxd

# Restore
fxd load backup-20251120.fxd

# Export archive
fxd export ./archive --format files --compress
```

### Import Multiple Sources

```bash
# Import from multiple directories
fxd import ./frontend
fxd import ./backend
fxd import ./shared

# Save combined state
fxd save fullstack.fxd
```

### Batch Operations

```bash
# List all .fxd files
for file in *.fxd; do
  echo "Stats for $file:"
  fxd stats "$file"
done

# Export all
for file in *.fxd; do
  fxd export "export-${file%.fxd}" --format html
done
```

---

## Troubleshooting

### Command Not Found

```bash
# Check if fxd is in PATH
which fxd

# If not, run installer again
deno run -A scripts/install.ts

# Or add to PATH manually
export PATH="$PATH:/usr/local/bin"
```

### Permission Denied

```bash
# Make binary executable (Linux/macOS)
chmod +x /usr/local/bin/fxd

# Run with sudo if needed
sudo deno run -A scripts/install.ts
```

### File Not Found Error

```bash
# Check current directory
pwd
ls *.fxd

# Use absolute path
fxd load /full/path/to/project.fxd
```

### Import Fails

```bash
# Check file exists
ls ./src

# Try with verbose
fxd import ./src --verbose

# Check file permissions
ls -l ./src
```

### Health Check Fails

```bash
# Run health check
fxd health

# Check Deno version
deno --version

# Reinstall if needed
deno run -A scripts/install.ts
```

### Completions Don't Work

```bash
# Reload shell configuration
source ~/.bashrc    # Bash
source ~/.zshrc     # Zsh

# Check completion file exists
ls -l /etc/bash_completion.d/fxd

# Reinstall completions
sudo cp cli/completions/fxd.bash /etc/bash_completion.d/fxd
```

---

## Advanced Usage

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FXD_DATA_DIR` | Data directory | `~/.fxd` |
| `FXD_CONFIG` | Config file path | `~/.fxd/config.json` |
| `FXD_VERBOSE` | Enable verbose output | `false` |

**Example:**
```bash
export FXD_DATA_DIR=/custom/path
fxd save project.fxd
```

### Custom Configuration

Create `~/.fxd/config.json`:
```json
{
  "defaultFormat": "json",
  "autoSave": true,
  "compression": true,
  "theme": "dark"
}
```

### Scripting

```bash
#!/bin/bash
# Automated FXD workflow

# Create project
fxd create daily-backup

# Import current work
fxd import . --save daily-backup.fxd

# Show stats
fxd stats daily-backup.fxd

# Upload to server (example)
scp daily-backup.fxd user@server:/backups/
```

---

## Getting Help

- **Documentation:** `docs/`
- **Examples:** `examples/`
- **Issues:** https://github.com/fxd/fxd/issues
- **Discussions:** https://github.com/fxd/fxd/discussions

---

## See Also

- [Installation Guide](INSTALLATION-GUIDE.md)
- [Getting Started](GETTING-STARTED-COMPLETE.md)
- [API Reference](API-REFERENCE.md)
- [User Guide](USER-GUIDE.md)

---

**Last Updated:** 2025-11-20
**Version:** 2.0.0
**Maintained by:** Agent 3 - CLI Excellence & System Integration
