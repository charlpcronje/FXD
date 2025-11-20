# VFS Architecture

Technical architecture guide for FXD's Virtual Filesystem implementation.

## Overview

The VFS (Virtual File System) layer provides bidirectional synchronization between the operating system's file system and FXD's internal node graph, enabling seamless integration with external editors and tools.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    User Space                           │
│  (VS Code, Vim, External Tools)                         │
└──────────────────────┬──────────────────────────────────┘
                       │ File I/O
┌──────────────────────▼──────────────────────────────────┐
│              Operating System FS                        │
│  Windows NTFS / macOS HFS+ / Linux ext4/tmpfs          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  RAMDisk Layer                          │
│  - Memory allocation                                    │
│  - Platform-specific mounting (ImDisk/diskutil/tmpfs)  │
│  - Volume management                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   VFS Manager                           │
│  - File watching (Deno.watchFs)                        │
│  - Change detection                                     │
│  - Sync orchestration                                   │
│  - Virtual file cache                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│               Auto-Import Manager                       │
│  - Language detection                                   │
│  - Symbol extraction                                    │
│  - Metadata extraction                                  │
│  - Git integration                                      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   FXD Core                              │
│  - Node graph (fxn.ts)                                 │
│  - Snippets storage                                     │
│  - Reactive system                                      │
│  - Persistence                                          │
└─────────────────────────────────────────────────────────┘
```

## Component Details

### RAMDisk Manager (`fx-ramdisk.ts`)

**Responsibilities:**
- Platform detection
- Driver selection and initialization
- RAMDisk creation/destruction
- Status monitoring
- Synchronization coordination

**Key Classes:**
- `RAMDiskManager`: Main coordinator
- `ImDiskDriver`: Windows driver
- `DiskUtilDriver`: macOS driver
- `TmpfsDriver`: Linux driver

### VFS Manager (`fx-vfs.ts`)

**Responsibilities:**
- File system monitoring
- Change event processing
- Virtual file representation
- Sync orchestration
- Cache management

**Key Features:**
- Real-time file watching via `Deno.watchFs`
- Debounced change handling (500ms default)
- Bidirectional sync
- Exclusion patterns
- Language detection

### Auto-Import Manager (`fx-auto-import.ts`)

**Responsibilities:**
- Directory scanning
- File parsing
- Symbol extraction
- Metadata collection
- Git integration

**Key Features:**
- Recursive scanning
- Function/class extraction
- Comment extraction
- Language-specific parsing
- Git status tracking

## Data Flow

### File → FXD (Import)

```
1. User edits file.js in editor
2. OS writes changes to RAMDisk
3. Deno.watchFs detects change
4. VFS debounces and queues change
5. Auto-Import extracts metadata
6. FXD node updated via fx.proxy()
7. Snippet stored in node graph
```

### FXD → File (Export)

```
1. User updates snippet via FXD API
2. VFS detects node change (via watcher)
3. VFS generates file content
4. File written to RAMDisk
5. OS propagates to actual drive
6. External editor detects change
```

## Synchronization

### Sync Strategies

**1. Real-Time (Watching)**
- Enabled by default
- Uses OS file watchers
- 500ms debounce
- Immediate propagation

**2. Manual Sync**
- User-triggered via CLI
- Useful for batch operations
- No debouncing

**3. Auto-Sync**
- Periodic sync (configurable interval)
- Safety net for watch failures
- Recommended: 60-300 seconds

### Conflict Resolution

**Strategy:** Last Write Wins (LWW)

When both file and node change:
1. Compare timestamps
2. Newer change wins
3. Log conflict in metadata
4. Optional: Create backup of old version

## Performance

### Optimizations

**1. Virtual File Cache**
- In-memory representation of files
- Reduces disk I/O
- O(1) lookup by path

**2. Debouncing**
- Batch rapid changes
- Reduce sync overhead
- Configurable interval

**3. Incremental Sync**
- Only sync changed files
- Track last sync timestamp
- Skip unchanged content

**4. Symbol Extraction Cache**
- Parse files once
- Reuse extracted symbols
- Invalidate on change

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| File watch event | <1ms | OS notification |
| Debounce wait | 500ms | Configurable |
| Import single file | 5-10ms | With parsing |
| Export single file | 2-5ms | Write only |
| Full directory sync | 100ms | 50 files |
| Symbol extraction | 10-50ms | Depends on file size |

## Platform-Specific Implementation

### Windows (ImDisk)

```typescript
// Create RAMDisk
imdisk -a -s 512M -m R: -p "/fs:ntfs /q /y"

// Features:
// - NTFS support
// - Drive letter assignment
// - Fast creation (<1s)
// - Reliable unmount
```

### macOS (diskutil)

```typescript
// Create RAMDisk
hdiutil attach -nomount ram://1048576  // Create
diskutil eraseDisk JHFS+ FXD_Disk /dev/diskX  // Format
diskutil mount -mountPoint /Volumes/FXD /dev/diskX  // Mount

// Features:
// - HFS+/APFS support
// - Custom mount points
// - System integration
```

### Linux (tmpfs)

```typescript
// Create RAMDisk
mount -t tmpfs -o size=512M tmpfs /mnt/fxd

// Features:
// - Always available
// - No dependencies
// - Excellent performance
// - Native Linux support
```

## Error Handling

### Graceful Degradation

**1. Driver Unavailable**
- Detect available drivers
- Fall back to directory mounting
- Warn user if no drivers found

**2. Permission Denied**
- Catch permission errors
- Suggest fixes (sudo, fuse group)
- Provide alternative mount points

**3. Out of Memory**
- Monitor disk usage
- Warn at 90% capacity
- Reject writes at 95%
- Suggest resize options

**4. Watch Failures**
- Detect watch errors
- Fall back to polling
- Log degraded mode
- Notify user

## Extension Points

### Custom Drivers

Implement `RAMDiskDriver` interface:

```typescript
interface RAMDiskDriver {
  name: string;
  platform: string;
  isAvailable(): Promise<boolean>;
  create(config: RAMDiskConfig): Promise<void>;
  destroy(config: RAMDiskConfig): Promise<void>;
  getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>>;
  refresh(config: RAMDiskConfig): Promise<void>;
}
```

### Custom Importers

Extend `AutoImportManager` for language-specific parsing.

### Custom Sync Strategies

Override sync methods in `VFSManager`.

## Security

### Threat Model

**Threats:**
1. Unauthorized access to RAMDisk
2. Data loss on crash
3. Sensitive data exposure
4. Malicious file injection

**Mitigations:**
1. OS-level permissions
2. Auto-sync to persistent storage
3. Encryption at rest (FXD level)
4. File validation on import

### Best Practices

1. **Use OS permissions:** Restrict RAMDisk access
2. **Enable auto-sync:** Prevent data loss
3. **Validate imports:** Check file types/sizes
4. **Exclude sensitive files:** Use .gitignore patterns
5. **Audit logs:** Track all operations

## Testing

### Test Coverage

**Unit Tests:**
- RAMDisk creation/destruction
- VFS file operations
- Auto-import parsing
- Sync logic

**Integration Tests:**
- Full mount/unmount cycle
- File watching
- Bidirectional sync
- Error handling

**Platform Tests:**
- Windows driver tests
- macOS driver tests
- Linux driver tests

### Running Tests

```bash
# All tests
deno test -A test/fx-ramdisk.test.ts
deno test -A test/fx-vfs.test.ts
deno test -A test/fx-mount-unmount.test.ts

# With coverage
deno test -A --coverage=coverage test/
```

## Future Enhancements

### Planned Features

1. **FUSE Integration:** Custom FUSE driver for Linux
2. **Network Mounts:** SMB/NFS support
3. **Compression:** On-the-fly compression
4. **Encryption:** Transparent encryption
5. **Snapshots:** Point-in-time snapshots
6. **Versioning:** Track file versions
7. **Conflict UI:** Visual conflict resolution
8. **Live Collaboration:** Multi-user editing

### Research Areas

1. **CRDT Integration:** Conflict-free sync
2. **Event Sourcing:** Full history replay
3. **Delta Sync:** Partial file sync
4. **Smart Caching:** ML-based prefetching

## References

- [Deno File System API](https://deno.land/api@latest?s=Deno.watchFs)
- [ImDisk Toolkit](https://sourceforge.net/projects/imdisk-toolkit/)
- [WinFsp Documentation](https://winfsp.dev/doc/)
- [macFUSE](https://osxfuse.github.io/)
- [FUSE](https://github.com/libfuse/libfuse)
- [tmpfs](https://www.kernel.org/doc/Documentation/filesystems/tmpfs.txt)

---

*For user-facing documentation, see [RAMDISK-MOUNTING.md](./RAMDISK-MOUNTING.md)*
