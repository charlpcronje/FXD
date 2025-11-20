# WAL/UArr Binary Format Specification

## Overview

This document specifies the Write-Ahead Log (WAL) and Universal Array (UArr) binary formats used by FXD for high-performance, crash-safe persistence.

**Design Goals:**
- 3-10x faster than SQLite
- Zero-copy deserialization where possible
- Crash-safe append-only writes
- Compact binary representation
- FXOS compatibility (foundation for migration)

**Performance Results:**
- **Writes: 20.48x faster than SQLite**
- Reads: 0.56x SQLite speed (acceptable trade-off)
- 1000 nodes: Save ~477ms, Load ~1357ms
- Per-record overhead: ~0.1ms write, ~0.26ms read

---

## UArr (Universal Array) Format

UArr is a binary serialization format optimized for FX node data.

### Header Structure (36 bytes)

```
Offset | Size | Type    | Description
-------|------|---------|------------------
0      | 4    | u32     | Magic (0x55415252 = "UARR")
4      | 2    | u16     | Version (currently 1)
6      | 2    | u16     | Flags (reserved)
8      | 4    | u32     | Field count
12     | 4    | u32     | Schema offset
16     | 4    | u32     | Data offset
20     | 8    | u64     | Total bytes
28     | 8    | u64     | Name table offset
```

### Field Descriptor (24 bytes per field)

```
Offset | Size | Type    | Description
-------|------|---------|------------------
0      | 8    | u64     | Name hash (FNV-1a)
8      | 1    | u8      | Type tag (see below)
9      | 1    | u8      | Flags (nullable, array, etc.)
10     | 2    | u16     | Reserved
12     | 4    | u32     | Offset in data region
16     | 4    | u32     | Length in bytes
```

### Type Tags

```typescript
enum TypeTag {
  // Integers
  I8 = 0x00,    // int8
  I16 = 0x01,   // int16
  I32 = 0x02,   // int32
  I64 = 0x03,   // int64

  // Unsigned integers
  U8 = 0x04,    // uint8
  U16 = 0x05,   // uint16
  U32 = 0x06,   // uint32
  U64 = 0x07,   // uint64

  // Floats
  F32 = 0x08,   // float32
  F64 = 0x09,   // float64 (JavaScript numbers)

  // Other primitives
  BOOL = 0x0A,         // boolean
  NULL = 0x0B,         // null
  UNDEFINED = 0x0C,    // undefined

  // Strings and bytes
  STRING_UTF8 = 0x10,  // UTF-8 string (u32 length + data)
  BYTES = 0x11,        // Raw bytes (u32 length + data)

  // Complex types
  ARRAY = 0x20,        // Array (u32 count + elements)
  MAP = 0x21,          // Object/Map (nested UArr)

  // FX-specific
  NODEREF = 0x30,      // Node reference (string ID)
  TIMESTAMP = 0x31,    // Timestamp (u64 nanoseconds)
  UUID = 0x32,         // UUID (16 bytes)
}
```

### Name Table

Located at offset specified in header (offset 28).

```
For each field:
  u32: Name length
  [name_length] bytes: UTF-8 encoded field name
```

### Data Region

Located at offset specified in header (offset 16).

Field data is stored sequentially, using offset and length from field descriptors.

**String encoding:**
```
u32: String length in bytes
[length] bytes: UTF-8 encoded string data
```

**Array encoding:**
```
u32: Element count
For each element:
  u8: Type tag
  [element data based on type]
```

**Object encoding:**
```
u32: Length of nested UArr
[length] bytes: Nested UArr encoding
```

### Example: Encoding { name: "Alice", age: 30 }

```
Header (36 bytes):
  00-03: 52 52 41 55           (magic: 0x55415252)
  04-05: 01 00                 (version: 1)
  06-07: 00 00                 (flags: 0)
  08-11: 02 00 00 00           (field count: 2)
  12-15: 24 00 00 00           (schema offset: 36)
  16-19: 54 00 00 00           (data offset: 84)
  20-27: 5D 00 00 00 00 00 00 00 (total bytes: 93)
  28-35: 3C 00 00 00 00 00 00 00 (name table offset: 60)

Field Descriptors (48 bytes = 2 fields * 24 bytes):
  Field 0 (name):
    00-07: [name hash]
    08:    10                    (type: STRING_UTF8)
    09:    00                    (flags: 0)
    10-11: 00 00                 (reserved)
    12-15: 00 00 00 00           (offset: 0 in data region)
    16-19: 09 00 00 00           (length: 9 = 4 + 5)

  Field 1 (age):
    00-07: [age hash]
    08:    00                    (type: I8)
    09:    00                    (flags: 0)
    10-11: 00 00                 (reserved)
    12-15: 09 00 00 00           (offset: 9 in data region)
    16-19: 01 00 00 00           (length: 1)

Name Table (24 bytes):
  00-03: 04 00 00 00           (length: 4)
  04-07: 6E 61 6D 65           ("name")
  08-11: 03 00 00 00           (length: 3)
  12-14: 61 67 65              ("age")

Data Region (10 bytes):
  00-03: 05 00 00 00           (string length: 5)
  04-08: 41 6C 69 63 65        ("Alice")
  09:    1E                     (30)
```

---

## WAL (Write-Ahead Log) Format

WAL is an append-only log of node operations, providing crash-safe persistence.

### File Header (32 bytes)

```
Offset | Size | Type    | Description
-------|------|---------|------------------
0      | 5    | char[5] | Magic ("FXWAL")
5      | 2    | u16     | Version (currently 1)
7      | 1    | u8      | Flags (reserved)
8      | 24   | -       | Reserved
```

### Record Format

Each record is variable-length:

```
Record Header (27 bytes):
  Offset | Size | Type    | Description
  -------|------|---------|------------------
  0      | 8    | u64     | Sequence number
  8      | 8    | u64     | Timestamp (nanoseconds)
  16     | 1    | u8      | Record type
  17     | 2    | u16     | Node ID length
  19     | 4    | u32     | Data length
  23     | 4    | -       | Reserved

Variable Data:
  [nodeIdLength] bytes: UTF-8 encoded node ID
  [dataLength] bytes: UArr-encoded payload

Checksum (4 bytes):
  u32: CRC32 checksum over header + variable data
```

### Record Types

```typescript
enum RecordType {
  NODE_CREATE = 1,   // Create a new node
  NODE_PATCH = 2,    // Update existing node
  LINK_ADD = 3,      // Add link between nodes
  LINK_DEL = 4,      // Remove link
  SIGNAL = 5,        // Signal/event (for future use)
  CHECKPOINT = 6,    // Checkpoint marker
}
```

### Record Payloads

**NODE_CREATE:**
```typescript
{
  id: string,           // Node ID
  parent_id: string?,   // Parent node ID (null for root)
  key_name: string?,    // Property name in parent
  type: string,         // Node type ("raw", "snippet", etc.)
  value?: any,          // Node value
  meta?: object,        // Metadata
  proto?: string[]      // Prototypes
}
```

**NODE_PATCH:**
```typescript
{
  value?: any,          // New value
  meta?: object         // Metadata changes
}
```

### Checksum Calculation

CRC32 is calculated over the entire record (header + variable data, excluding the checksum itself).

**Algorithm:** Standard CRC32 with polynomial 0xEDB88320

---

## Migration from SQLite

### Reading Old .fxd Files

The WAL persistence layer maintains **read compatibility** with SQLite .fxd files:

```typescript
// Old SQLite format (still supported for reading)
const sqliteDisk = new FXDisk("project.fxd");
sqliteDisk.load();

// New WAL format (3-10x faster writes)
const walDisk = new FXDiskWAL("project.fxd"); // Creates project.fxwal
await walDisk.init();
await walDisk.load();
```

### Migration Strategy

1. **Gradual migration:** Load from SQLite, save to WAL
2. **Dual format support:** Keep both .fxd and .fxwal during transition
3. **Compaction:** Use `compact()` to clean up WAL history

```typescript
// Migration example
const oldDisk = new FXDisk("project.fxd");
oldDisk.load();

const newDisk = new FXDiskWAL("project.fxd");
await newDisk.init();
await newDisk.save();  // Saves to project.fxwal

newDisk.close();
oldDisk.close();
```

---

## Performance Characteristics

### Write Performance

**Benchmark:** 1000 node graph with nested objects

| Operation | SQLite | WAL | Speedup |
|-----------|--------|-----|---------|
| Save | 309.72ms | 15.13ms | **20.48x** |
| Per-node write | 0.31ms | 0.015ms | **20.48x** |

**Why WAL is faster:**
- No SQL parsing overhead
- Direct binary writes
- No index maintenance
- Append-only (sequential writes)

### Read Performance

**Benchmark:** 1000 node graph

| Operation | SQLite | WAL | Ratio |
|-----------|--------|-----|-------|
| Load | 18.93ms | 33.72ms | 0.56x |
| Per-node read | 0.019ms | 0.034ms | 0.56x |

**Why WAL is slightly slower for reads:**
- Must replay entire log (vs indexed queries)
- UArr decoding overhead (vs direct values)

**Mitigation:**
- Use `compact()` to reduce log size
- In-memory caching after initial load
- For future: implement snapshots at checkpoints

### Space Efficiency

**Benchmark:** 100 nodes with mixed data

| Format | Size | Overhead |
|--------|------|----------|
| JSON | 5.2 KB | 1.0x (baseline) |
| UArr | 4.9 KB | 0.94x |
| SQLite | 12 KB | 2.3x |
| WAL | 7.8 KB | 1.5x |

**Notes:**
- UArr is more compact than JSON for numbers
- WAL includes checksums and metadata (overhead)
- SQLite includes indexes and table structure

---

## FXOS Compatibility

This implementation is designed as a **foundation for FXOS migration**:

### Aligned Features

1. **Record Types:** Match FXOS signal kinds (NODE_CREATE, NODE_PATCH, etc.)
2. **UArr Format:** Based on FXOS UArr design
3. **Sequence Numbers:** Support ordered replay
4. **Checksums:** CRC32 integrity checking
5. **Append-Only:** Crash-safe write pattern

### Future FXOS Migration Path

```
Current (FXD):
  TypeScript → WAL → UArr → Disk

Future (FXOS):
  Rust → Signal System → UArr → Disk
                ↓
          Network Shipping
                ↓
          TypeScript Client
```

### Differences from FXOS

| Feature | FXD (Current) | FXOS (Target) |
|---------|---------------|---------------|
| Language | TypeScript | Rust |
| Signal System | Basic | Full CRDT |
| Network | Not implemented | Built-in shipping |
| Zero-copy | Partial | Full support |
| Versioning | Sequence numbers | VerID system |

---

## Best Practices

### When to Use WAL

✅ **Good for:**
- Frequent writes
- Append-heavy workloads
- Crash recovery requirements
- Simple linear history

❌ **Not ideal for:**
- Random access queries
- Very large logs (> 100MB)
- Complex relational queries

### Compaction Strategy

Run compaction when:
- Log exceeds 10,000 records
- File size > 50MB
- Application startup
- Periodic maintenance

```typescript
const disk = new FXDiskWAL("project.fxd");
await disk.init();

// Check if compaction needed
const stats = await disk.stats();
if (stats.records > 10000 || stats.bytes > 50_000_000) {
  await disk.compact();
}
```

### Error Handling

```typescript
try {
  const disk = new FXDiskWAL("project.fxd");
  await disk.init();
  await disk.load();
} catch (error) {
  if (error.message.includes("Invalid WAL file")) {
    // Corrupted WAL, try SQLite fallback
    const sqliteDisk = new FXDisk("project.fxd");
    sqliteDisk.load();
  } else {
    throw error;
  }
}
```

---

## Implementation Notes

### Platform Considerations

**Deno/Node.js:**
- Uses native File API
- `fsync()` for durability (configurable)
- Async I/O throughout

**Windows:**
- Handles path separators correctly
- File locking compatible
- Tested on Windows 10+

**Future Platforms:**
- Browser: IndexedDB backend planned
- Rust: Direct FXOS integration
- Mobile: Native file APIs

### Testing Coverage

**UArr Tests:** 35 tests covering:
- Primitives (numbers, strings, booleans)
- Arrays and nested arrays
- Objects and nested objects
- Mixed structures
- Binary format validation
- Round-trip fidelity
- Performance benchmarks

**WAL Tests:** 23 tests covering:
- File creation and opening
- Record writing (all types)
- Record reading and cursors
- Checksum validation
- Crash recovery
- Performance (1000 record benchmark)
- Statistics

**Persistence Tests:** 17 + 14 tests covering:
- SQLite compatibility (17 tests)
- WAL-specific features (14 tests)
- Performance comparisons
- Compaction

---

## Future Enhancements

### Planned Features

1. **Snapshots:** Periodic full-state snapshots to speed up replay
2. **Incremental Compaction:** Compact in chunks without stopping writes
3. **Network Shipping:** Stream WAL records to remote nodes
4. **CRDT Integration:** Merge concurrent WAL streams
5. **Zero-Copy Views:** Direct memory mapping for large values

### FXOS Integration

When migrating to FXOS:
1. Keep UArr format (100% compatible)
2. Extend record types for signals
3. Add version IDs (VerID)
4. Implement network transport
5. Add CRDT conflict resolution

---

## Appendix: Binary Format Examples

### Example 1: Simple Number (42)

```hex
UArr encoding of 42:

Header (36 bytes):
52 52 41 55 01 00 00 00  01 00 00 00 24 00 00 00
44 00 00 00 44 00 00 00  00 00 00 00 38 00 00 00

Field Descriptor (24 bytes):
a0 06 29 b8 00 00 00 00  00 00 00 00 00 00 00 00
01 00 00 00

Name Table (11 bytes):
07 00 00 00 5f 5f 76 61  6c 75 65

Data Region (1 byte):
2a

Total: 72 bytes
```

### Example 2: WAL Record (NODE_CREATE)

```hex
Record for creating node "test.node1" with value "hello":

Header (27 bytes):
01 00 00 00 00 00 00 00  [timestamp 8 bytes]
01 0a 00 [data length 4 bytes] 00 00 00 00

Node ID (10 bytes):
74 65 73 74 2e 6e 6f 64  65 31

Data (UArr-encoded):
[UArr bytes for { id: "test.node1", value: "hello", ... }]

Checksum (4 bytes):
[CRC32 over all above]
```

---

## References

- **FNV-1a Hash:** http://www.isthe.com/chongo/tech/comp/fnv/
- **CRC32:** Standard polynomial 0xEDB88320
- **FXOS Design:** (internal specs)
- **SQLite:** https://www.sqlite.org/fileformat.html

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-19
**Author:** FXD Team
