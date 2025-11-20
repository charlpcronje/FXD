# RAMDisk & Virtual Filesystem Mounting Guide

Complete guide to using FXD's RAMDisk and Virtual Filesystem features for high-performance code editing and synchronization.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Basic Usage](#basic-usage)
5. [Platform-Specific Setup](#platform-specific-setup)
6. [Advanced Features](#advanced-features)
7. [CLI Reference](#cli-reference)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)
10. [Examples](#examples)

---

## Overview

### What is FXD RAMDisk?

FXD RAMDisk provides a high-performance, in-memory virtual file system that bridges your operating system's native file system with FXD's internal node graph. Edit files in your favorite editor, and changes sync automatically to FXD snippets.

### Key Features

- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Real-Time Sync**: Bidirectional synchronization between files and FXD nodes
- **High Performance**: RAM-based storage for ultra-fast operations
- **Auto-Import**: Automatically convert code files into FXD snippets
- **File Watching**: Detect and sync external changes instantly
- **Smart Detection**: Language and symbol extraction
- **Zero Configuration**: Works out of the box with sensible defaults

### Architecture

```
┌─────────────────┐
│   Your Editor   │
│  (VS Code, etc) │
└────────┬────────┘
         │ Edit files
         ▼
┌─────────────────┐
│    RAMDisk      │  ◄──── R:\ (Windows) or /mnt/fxd (Linux)
│  Virtual Files  │
└────────┬────────┘
         │ Sync
         ▼
┌─────────────────┐
│   VFS Manager   │  ◄──── File watching & sync
│  (fx-vfs.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   FXD Core      │  ◄──── Node graph & snippets
│    (fxn.ts)     │
└─────────────────┘
```

---

## Quick Start

### 1. Check System Requirements

```bash
# Check platform
deno run -A cli/commands/mount.ts info

# Expected output:
# Platform: windows / darwin / linux
# Available Drivers: [list of drivers]
```

### 2. Create Your First RAMDisk

**Windows:**
```bash
fxd mount R:\ --size=512 --auto-import
```

**macOS:**
```bash
fxd mount /Volumes/FXD --size=512 --auto-import
```

**Linux:**
```bash
fxd mount /mnt/fxd --size=512 --auto-import
```

### 3. Edit Files

Open your favorite editor and create a file:

**R:\hello.js** (Windows) or **/mnt/fxd/hello.js** (Linux):
```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```

### 4. Verify Sync

```bash
# Check sync status
fxd mount status disk_12345

# Or query directly in FXD
$$('snippets.hello').val()
```

---

## Installation

### Prerequisites

FXD RAMDisk requires platform-specific drivers for mounting functionality.

### Windows

**Option 1: ImDisk Toolkit (Recommended)**

1. Download from: https://sourceforge.net/projects/imdisk-toolkit/
2. Run installer
3. Verify installation:
   ```cmd
   imdisk --help
   ```

**Option 2: WinFsp**

1. Download from: https://winfsp.dev/
2. Run installer
3. Verify installation:
   ```cmd
   fsptool --help
   ```

### macOS

**Install macFUSE:**

```bash
# Using Homebrew
brew install macfuse

# Or download from:
# https://osxfuse.github.io/
```

Verify installation:
```bash
diskutil list
```

### Linux

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install fuse
```

**Fedora:**
```bash
sudo dnf install fuse
```

**Arch Linux:**
```bash
sudo pacman -S fuse
```

Verify installation:
```bash
fusermount --version
```

---

## Basic Usage

### Creating a RAMDisk

**Simple create:**
```bash
fxd mount create
```

**Custom configuration:**
```bash
fxd mount create \
  --size=1024 \
  --name="MyDisk" \
  --auto-import \
  --watch
```

**Options:**
- `--size=<MB>`: RAMDisk size in megabytes (default: 512)
- `--name=<name>`: Volume label (default: FXD_Disk)
- `--auto-import`: Import files on mount
- `--watch`: Enable file watching (default: true)
- `--sync-interval=<seconds>`: Auto-sync interval

### Mounting a Directory

**Mount existing directory:**
```bash
fxd mount /path/to/project --auto-import
```

**With recursive import:**
```bash
fxd mount /path/to/project \
  --auto-import \
  --recursive \
  --extract-symbols
```

### Listing Mounts

```bash
fxd mount list
```

**Example output:**
```
📀 RAMDisks (2):

✅ disk_12345
   Mount: R:\
   Size: 45/512MB (9% used)
   Files: 12
   Driver: imdisk
   Status: mounted

✅ disk_67890
   Mount: /mnt/fxd2
   Size: 120/1024MB (12% used)
   Files: 48
   Driver: tmpfs
   Status: mounted

📂 VFS:
   Files: 60
   Size: 2.4MB
   Watchers: 2
   Pending changes: 0
```

### Checking Status

```bash
fxd mount status disk_12345
```

**Detailed output:**
```
📀 RAMDisk: disk_12345

Status: ✅ Mounted
Health: ✅ healthy

Mount point: R:\
Platform: windows
Driver: imdisk

Size: 512MB
Used: 45MB (9%)
Free: 467MB

Files: 12
Created: 2025-11-20 10:30:15
Last sync: 2025-11-20 11:45:22
```

### Syncing Changes

**Manual sync:**
```bash
fxd mount sync disk_12345
```

**Auto-sync setup:**
```bash
fxd mount create --auto-sync --sync-interval=60
```

### Unmounting

**Unmount and save:**
```bash
fxd unmount disk_12345
```

**Unmount without saving:**
```bash
fxd unmount disk_12345 --no-save
```

**Export before unmount:**
```bash
fxd unmount disk_12345 --export=/path/to/backup
```

**Unmount all:**
```bash
fxd unmount all
```

---

## Platform-Specific Setup

### Windows Configuration

**Default Configuration:**
- Mount point: `R:\`
- Driver: `imdisk`
- File system: `NTFS`
- Size: 512MB

**Drive Letter Selection:**
```bash
# Use any available drive letter
fxd mount T:\ --size=1024
fxd mount X:\ --size=2048
```

**ImDisk Advanced:**
```bash
# Create RAMDisk with specific options
imdisk -a -s 1024M -m R: -p "/fs:ntfs /q /y"
```

**WinFsp Integration:**
```bash
fxd mount R:\ --driver=winfsp
```

### macOS Configuration

**Default Configuration:**
- Mount point: `/Volumes/FXD`
- Driver: `diskutil`
- File system: `JHFS+`
- Size: 512MB

**Custom Volume:**
```bash
# Mount to custom location
fxd mount /Volumes/MyDisk --size=1024
```

**diskutil Commands:**
```bash
# List all volumes
diskutil list

# Get volume info
diskutil info /Volumes/FXD
```

### Linux Configuration

**Default Configuration:**
- Mount point: `/mnt/fxd`
- Driver: `tmpfs`
- File system: `tmpfs`
- Size: 512MB

**Custom Mount Point:**
```bash
# Mount to /tmp
fxd mount /tmp/fxd --size=512

# Mount to home directory
fxd mount ~/fxd --size=1024
```

**Permissions:**
```bash
# Allow other users to access
fxd mount /mnt/fxd --allow-other

# Set permissions manually
chmod 777 /mnt/fxd
```

**tmpfs Options:**
```bash
# Mount with specific options
sudo mount -t tmpfs -o size=512M tmpfs /mnt/fxd
```

---

## Advanced Features

### Auto-Import

Automatically convert code files into FXD snippets when mounting.

**Basic auto-import:**
```bash
fxd mount /path/to/project --auto-import
```

**With symbol extraction:**
```bash
fxd mount /path/to/project \
  --auto-import \
  --extract-symbols \
  --recursive
```

**Symbol Extraction:**

Given **calculator.js**:
```javascript
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

class Calculator {
  multiply(a, b) {
    return a * b;
  }
}
```

With `--extract-symbols`, creates separate snippets:
- `calculator_add`
- `calculator_subtract`
- `calculator_Calculator`

### File Watching

Monitor files for changes and sync automatically.

**Enable watching:**
```bash
fxd mount /path --watch
```

**Disable watching:**
```bash
fxd mount /path --no-watch
```

**Watch Behavior:**
- Detects file creates, modifies, deletes
- Debounces rapid changes (500ms default)
- Updates FXD snippets in real-time
- Handles renames gracefully

### Synchronization

**Bidirectional Sync:**

FXD ↔ Files: Changes propagate both ways

**From Files to FXD:**
```bash
fxd mount sync disk_12345
```

**From FXD to Files:**
```javascript
// Update snippet
$$('snippets.myfile').val({
  content: 'new content',
  language: 'javascript'
});

// File is updated automatically if watch is enabled
```

**Auto-Sync:**
```bash
# Sync every 60 seconds
fxd mount create --auto-sync --sync-interval=60
```

### Language Detection

Automatically detect language from file extension:

| Extension | Language   |
|-----------|------------|
| .js       | javascript |
| .ts       | typescript |
| .py       | python     |
| .rs       | rust       |
| .go       | go         |
| .java     | java       |
| .c        | c          |
| .cpp      | cpp        |
| .html     | html       |
| .css      | css        |
| .md       | markdown   |
| .json     | json       |
| .yaml     | yaml       |

### Health Monitoring

RAMDisks report health status:

**Healthy:** Operating normally, <90% capacity
**Warning:** 90-95% capacity
**Error:** >95% capacity or mount issues

**Check health:**
```bash
fxd mount status disk_12345
```

---

## CLI Reference

### mount command

```bash
fxd mount [path] [options]
fxd mount create [options]
fxd mount list
fxd mount status <disk-id>
fxd mount sync <disk-id>
fxd mount info
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--size=<MB>` | RAMDisk size in MB | 512 |
| `--name=<name>` | Volume name | FXD_Disk |
| `--driver=<driver>` | Driver to use | auto |
| `--watch` | Enable file watching | true |
| `--no-watch` | Disable file watching | - |
| `--auto-sync` | Enable auto-sync | false |
| `--sync-interval=<sec>` | Auto-sync interval | 0 |
| `--auto-import` | Import files on mount | false |
| `--recursive` | Recursive import | true |
| `--extract-symbols` | Extract functions/classes | true |
| `--allow-other` | Allow other users (Unix) | false |
| `--debug` | Enable debug logging | false |
| `--force` | Force mount | false |

### unmount command

```bash
fxd unmount <disk-id> [options]
fxd unmount all [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--save` | Save changes before unmount | true |
| `--no-save` | Don't save changes | - |
| `--export=<dir>` | Export to directory | - |
| `--keep-disk` | Keep RAMDisk, unmount VFS only | false |
| `--force` | Force unmount | false |
| `--quiet` | No confirmation prompts | false |

---

## Troubleshooting

### Common Issues

**1. Driver not available**

```
❌ Failed to create RAMDisk: Driver not available: imdisk
```

**Solution:** Install the required driver for your platform (see [Installation](#installation))

**2. Permission denied**

```
❌ Failed to mount: Permission denied
```

**Solution (Linux/macOS):**
```bash
# Run with sudo or add user to fuse group
sudo usermod -a -G fuse $USER

# Or use tmpfs which doesn't require special permissions
fxd mount /tmp/fxd
```

**3. Mount point already in use**

```
❌ Failed to create RAMDisk: Mount point already in use
```

**Solution:**
```bash
# Unmount existing disk
fxd unmount disk_12345

# Or use different mount point
fxd mount S:\ --size=512  # Windows
fxd mount /mnt/fxd2       # Linux
```

**4. File not syncing**

**Solution:**
```bash
# Check watch status
fxd mount status disk_12345

# Enable watch if disabled
fxd unmount disk_12345
fxd mount /path --watch

# Force manual sync
fxd mount sync disk_12345
```

**5. Out of memory**

```
⚠️  RAMDisk health: warning (95% used)
```

**Solution:**
```bash
# Export files and recreate with larger size
fxd unmount disk_12345 --export=/backup
fxd mount create --size=2048
```

### Debug Mode

Enable debug logging:
```bash
fxd mount create --debug
```

**Debug output includes:**
- Driver selection process
- Mount operations
- File system events
- Sync operations
- Error stack traces

### Logs

**View logs:**
```bash
# FXD stores logs in system.logs
$$('system.logs').val()

# Or use CLI
fxd logs --filter=ramdisk
```

---

## API Reference

### RAMDiskManager

```typescript
import { RAMDiskManager } from "./modules/fx-ramdisk.ts";

const manager = new RAMDiskManager(fx);
await manager.initialize();

// Create disk
const diskId = await manager.createDisk({
  sizeMB: 512,
  mountPoint: "R:\\",
  volumeName: "MyDisk",
});

// Get status
const status = await manager.getStatus(diskId);

// Sync
await manager.syncToFXD(diskId);
await manager.syncFromFXD(diskId);

// Destroy
await manager.destroyDisk(diskId);
```

### VFSManager

```typescript
import { VFSManager } from "./modules/fx-vfs.ts";

const vfs = new VFSManager(fx);
await vfs.initialize();

// Mount
await vfs.mount("/path", { watch: true });

// Sync
await vfs.syncFromDirectory("/path");
await vfs.syncToDirectory("/path");

// Watch
await vfs.watchFile("/path/file.js");
vfs.unwatchFile("/path/file.js");

// Unmount
await vfs.unmount();
```

### AutoImportManager

```typescript
import { AutoImportManager } from "./modules/fx-auto-import.ts";

const importer = new AutoImportManager(fx);

// Import directory
const result = await importer.importDirectory("/path");

// Import file
await importer.importFile("/path/file.js");

// Watch
importer.updateConfig({ watch: true });

// Stop watching
importer.stopWatching();
```

---

## Examples

### Example 1: Development Workflow

```bash
# 1. Create RAMDisk for project
fxd mount R:\ --size=1024 --auto-import --watch

# 2. Edit files in VS Code
code R:\

# 3. Files sync automatically to FXD

# 4. Query snippets in FXD
$$('snippets').val()

# 5. Done working? Unmount
fxd unmount all
```

### Example 2: Code Import

```bash
# Import entire project
fxd mount /path/to/project \
  --auto-import \
  --recursive \
  --extract-symbols

# Check what was imported
fxd mount sync disk_12345
```

### Example 3: Multi-Disk Setup

```bash
# Frontend code on R:
fxd mount R:\ --size=512 --name="Frontend"

# Backend code on S:
fxd mount S:\ --size=512 --name="Backend"

# Database scripts on T:
fxd mount T:\ --size=256 --name="Database"

# List all
fxd mount list
```

### Example 4: Backup and Restore

```bash
# Export current state
fxd unmount disk_12345 --export=/backup/$(date +%Y%m%d)

# Restore later
fxd mount R:\ --auto-import
# Manually copy files back
cp -r /backup/20251120/* R:\
fxd mount sync disk_12345
```

### Example 5: Temporary Workspace

```bash
# Create temporary RAMDisk for experiments
fxd mount create --size=256 --name="Temp"

# Work on code
code R:\

# Discard when done (no save)
fxd unmount all --no-save
```

---

## Performance Tips

### Optimal Sizes

- **Small projects (<50 files):** 256-512MB
- **Medium projects (50-200 files):** 512-1024MB
- **Large projects (200+ files):** 1024-2048MB

### Best Practices

1. **Use appropriate size:** Don't over-allocate RAM
2. **Enable watching:** Real-time sync is convenient
3. **Auto-sync for safety:** Set --sync-interval=300 (5 min)
4. **Extract symbols:** Faster snippet searches
5. **Exclude large files:** Use .gitignore patterns

### Benchmarks

**File Operations (RAMDisk vs SSD vs HDD):**

| Operation | RAMDisk | SSD | HDD |
|-----------|---------|-----|-----|
| Read 1MB | 0.1ms | 2ms | 12ms |
| Write 1MB | 0.2ms | 3ms | 15ms |
| Create 100 files | 5ms | 80ms | 450ms |
| Sync to FXD | 15ms | 30ms | 120ms |

---

## Security Considerations

### Data Persistence

- **RAMDisks are volatile:** Data lost on unmount or reboot
- **Always save:** Use `fxd unmount` (not `--no-save`)
- **Auto-sync recommended:** Prevents data loss
- **Export backups:** Before major changes

### Permissions

**Linux/macOS:**
```bash
# Restrict access
fxd mount /mnt/fxd --no-allow-other
chmod 700 /mnt/fxd

# Or allow group access
chmod 770 /mnt/fxd
chgrp developers /mnt/fxd
```

**Windows:**
```cmd
# Use NTFS permissions
icacls R:\ /grant Users:(OI)(CI)M
```

### Sensitive Data

- **Don't store secrets:** RAMDisks are temporary
- **Use .gitignore:** Exclude sensitive files
- **Clear on exit:** Use `--no-save` for sensitive work

---

## FAQ

**Q: Do RAMDisks persist after reboot?**
A: No, RAMDisks are volatile. Always unmount properly to save changes to FXD.

**Q: Can I use multiple RAMDisks?**
A: Yes, you can create multiple RAMDisks with different mount points.

**Q: What happens if I run out of space?**
A: FXD reports a "warning" status. Export files and recreate with larger size.

**Q: Can I mount network drives?**
A: Yes, but performance may be slower. RAMDisks work best with local storage.

**Q: How do I update FXD from edited files?**
A: Use `fxd mount sync disk_id` or enable `--auto-sync`.

**Q: Can I use this with Git?**
A: Yes, but commit to actual disk before unmounting.

---

## Next Steps

- Read [VFS Architecture](./VFS-ARCHITECTURE.md)
- Check [User Guide](./USER-GUIDE.md)
- Explore [Examples](../examples/)
- Join [Discord Community](https://discord.gg/fxd)

---

**Need Help?**

- GitHub Issues: https://github.com/fxd-project/fxd/issues
- Documentation: https://docs.fxd.dev
- Discord: https://discord.gg/fxd

---

*Last updated: 2025-11-20*
