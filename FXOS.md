So came up with a cool Idea for an OS:
What do you think about this:
# Cup Holder — a Reactive Node Operating System

*Views, not files. Nodes, not types. Reactivity that survives RAM, disk, and the network.*

---

## 0) One-page abstract

Cup Holder collapses every OS concept—processes, files, devices, sockets, config, even users—into a single primitive: the **Node**. Nodes form trees. A program is the **root node** of its tree; memory is child nodes; IPC is sharing a subtree; permissions are capability pointers to branches. **Views** are addressable nodes that *render other nodes* through **Lenses** (bi-directional transforms). **Signals** are durable changefeeds per node; reactivity persists on disk and across the network because changes are logged, versioned, and replayable.

There is no serialization/deserialization tax. Nodes are stored and transmitted in a single, typed, immutable format (**UArr**) with copy-on-write (COW) versioning and a log-structured store (**WAL**). RAM is a cache; disk is the truth; the network is just log shipping. Compatibility is provided by **Views** that present byte-streams (POSIX), WASI, and (optionally) a sidecar Linux microVM—all backed by the same node fabric.

Cup Holder is simple because it chooses **one abstraction everywhere** and makes it **fast, reactive, and durable**. Also: it’s better than ice cream.

---

## 1) Core primitives

### 1.1 Node (the only thing)

A Node is an addressable object with stable identity and versioned content.

```
struct NodeID { u128 id; }           // globally unique, unforgeable
struct VerID  { u128 id; }           // monotonic within a node

struct NodeHeader {
    NodeID   id;                     // stable object identity
    VerID    cur_ver;                // current published version
    u64      flags;                  // bits: materialized, crdt, temporal, ...
    Ptr      value_ptr;              // -> UArr or Blob (immutable, COW)
    Ptr      children_ptr;           // -> ChildIndex (map nameHash->NodeID)
    Ptr      caps_ptr;               // -> CapSet (capability graph)
    Ptr      meta_ptr;               // -> Meta (owner, timestamps, tags)
    Ptr      signals_ptr;            // -> SignalStream heads (append-only)
}
```

**Children** are not bytes; they’re named edges to other nodes.
**Value** is not a raw struct; it’s a **UArr** (Universal Array) blob.

### 1.2 UArr (Universal Array — the wire/storage format)

Immutable, self-describing, endian-stable, zero-copy typed arrays + nested composites.

```
struct UArrHeader {
    u32  magic;          // 'UARR'
    u16  version;        // schema version
    u16  flags;          // SoA/AoS, compressed, encrypted, crdt, ...
    u32  field_count;    // number of fields in the schema
    u32  schema_off;     // -> FieldDesc[field_count]
    u32  data_off;       // -> data region (vectors, scalars, maps)
    u64  total_bytes;    // for integrity checking
}

// FieldDesc: nameHash, typeTag, offset or table index
struct FieldDesc { u64 nameHash; u32 typeTag; u32 off_or_idx; }

// Type tags (examples)
enum Type {
  I8,I16,I32,I64,U8,U16,U32,U64,F32,F64,BOOL,
  BYTES, STRING_UTF8,
  ARR_T, MAP_KV,                     // nested tables; K in {U64, STRING}
  NODEREF,                           // 128-bit NodeID
  TSTAMP, UUID,                      // common atoms
  // ... extensible
}
```

**Rules**

* UArrs are **immutable** once published → readers can hold pointers without locks.
* Writes produce a **new UArr** and atomically swap `value_ptr` (COW).
* Cross-language bindings only need to parse `UArrHeader` + `FieldDesc`.

### 1.3 FatPtr (capability pointer)

A pointer you can hand around; survives reboot/migration; embeds capabilities.

```
struct CapMask { u8 read:1, write:1, exec:1, grant:1, admin:1, _r:3; }

struct FatPtr {
  NodeID  id;            // stable object reference
  u64     offset;        // logical offset within value/view (optional)
  VerID   min_ver;       // minimum acceptable version (optional pin)
  CapMask caps;          // rights required when dereferencing
  u64     flags;         // snapshot/live, cow, temporal, ...
}
```

**Swizzle table** (per process): `NodeID → *mapped base address*` to turn FatPtr into a CPU pointer at runtime (fast path).

### 1.4 View + Lens (how “files” become projections)

* **View** is a Node that renders other nodes.
* **Lens** is the bidirectional transform: `get` (read as view), `put` (write back), `validate` (schema/constraints).

```
struct Lens {
  // Each is a PFN graph (deterministic flow), see §4
  NodeID get_graph;          // renders underlying nodes into a UArr value
  NodeID put_graph;          // maps view patches back to sources
  NodeID validate_graph;     // ensures schema + constraints
}

struct ViewSpec {
  NodeID root;               // subtree to render
  NodeID selector;           // node query (FX selectors)
  Lens   lens;               // how to see/edit
  u64    flags;              // materialize, cache, temporal
}
```

### 1.5 Signals (reactivity that survives disk)

Each node has append-only logs for semantic events:

```
enum SignalKind { VALUE, CHILDREN, CAPS, META, CUSTOM }

struct SignalRecord {
    TSTAMP  ts;
    SignalKind kind;
    VerID   base_ver;     // prior version
    VerID   new_ver;      // new published version
    NodeID  source;       // node that changed
    UArr    delta;        // typed change payload (field diffs, names, etc.)
}

// The stream lives in the WAL; subscribers tail cursors.
```

Subscribers can resume from any cursor or from a `VerID` (crash-proof, networkable).

---

## 2) Storage engine (RAM, disk, USB, snapshots)

### 2.1 On-disk layout (same for SSD/HDD/USB)

```
[ Superblock ][ FreeList ][ Slab Arena ][ Extent Arena ][ Index ][ WAL ][ Checkpoints ]
```

* **Superblock**: magic, feature flags, sizes, root NodeID(s).
* **Slab Arena**: fixed-size slots for NodeHeaders, small UArrs, indexes.
* **Extent Arena**: variable-size blocks for large UArr/Blobs; COW friendly.
* **Index**: robin-hood hash table: NodeID → NodeHeaderPtr.
* **WAL** (write-ahead log): append-only records for all mutations & signals.
* **Checkpoints**: periodic materialized snapshots (consistent points).

**Atomicity**: All writes are COW → publish by a single pointer flip + WAL record. Readers use RCU: always consistent.

### 2.2 WAL records (selected)

```
REC_NODE_CREATE   { NodeID, ParentID?, NameHash?, InitHeader }
REC_NODE_PATCH    { NodeID, BaseVer, NewVer, NewValuePtr, Deltas }
REC_LINK_ADD      { ParentID, NameHash, ChildID }
REC_LINK_DEL      { ParentID, NameHash, ChildID }
REC_CAP_GRANT     { NodeID, Subject, CapMask, TTL? }
REC_CAP_REVOKE    { NodeID, Subject, CapMask }
REC_SIGNAL        { SignalRecord }
REC_CHECKPOINT    { RootIDs[], IndexHash, JournalSeq }
```

### 2.3 RAM (shared, fast, safe)

* **Shared region**: `memfd_create` (Linux) / `CreateFileMapping` (Windows), mapped read-only for readers; writers COW into free extents and `CAS` flip.
* **Swizzle cache**: per-process robin-hood hash `NodeID → *mapped base*` for FatPtr deref.
* **Epoch GC**: reclaim old versions after all subscribers advance past their epochs.

### 2.4 USB / memory sticks

* A snapshot is just a **checkpoint file**: `[Superblock][Index][Objects][Mini-WAL]`.
* Plug into any machine, `ros mount cupholder.chk → n://import/<RootID>`.
* **Integrity**: per-object Blake3; snapshot manifest signed with Ed25519.

### 2.5 Hibernation vs “always-reactive”

* System hibernation dumps RAM wholesale.
* Cup Holder never needs app-level serialization: every object is already **disk-native** (UArr + WAL). A reboot simply replays to last `REC_CHECKPOINT`. Reactivity continues because **Signals are logs**, not callbacks.

---

## 3) Process, memory, permissions — all as trees

### 3.1 Process = root node

```
n://proc/<pid>/
  code/         (executable nodes or PFNs)
  mem/
    heap/       (allocations as nodes, e.g., slabs/chunks)
    stack/<tid> (per-thread stacks)
    mmaps/      (mapped nodes; flags: ro/rw/cow)
  io/
    inbox/      (Signal inbox; envelope ring UArr)
    outbox/
  views/        (registered views/lenses)
  caps/         (capabilities held by this process)
  meta/         (pid, name, owner, budgets)
```

**Allocator** = create child nodes under `mem/heap/` (COW friendly).
**Threads** = child nodes under `mem/stack` + scheduler entries as nodes.

### 3.2 Security via capability pointers

* A process’s “world” is the set of roots it holds FatPtrs to.
* No upward traversal: you cannot reach parents without a cap.
* Sharing = give another process a FatPtr (new root, or a branch).
* Revocation = delete cap edge; future derefs fail (live subscribers are signaled).

---

## 4) PFNs (Primitive Functions) & Flow engine

### 4.1 PFN (node-native ops)

PFN is a Node with a signature and an implementation (WASM/native/DSL):

```
struct PFNSignature {
  string name;         // e.g., "os.bytes.concat"
  Type[] in_types;     // POD + NodeRef
  Type[] out_types;
  bool deterministic;  // enables caching
  bool reentrant;
  string version;      // "1.2.0"
}

struct PFNImpl {
  enum { NATIVE, WASM, DSL } kind;
  BlobRef code;        // symbol/wasm module/DSL AST
  string entry;        // symbol/export
  Sandbox sandbox;     // memory/net/fs caps
  QoS cost_hint;       // cpu_ns, mem_bytes, io
}
```

**Call ABI:**

```
Result pfn_call(NodeID pfn, Arg[] args, CallOpts opts) -> { ok, outs[], err?, metrics }
```

* **Pure** PFNs are memoized by `(pfnID, args_hash)`.
* Big inputs/outputs pass as NodeRefs to avoid copies.

### 4.2 Flow graphs (composing PFNs)

A Flow is a Node containing a dataflow graph. Execution is incremental & reactive.

```
struct Flow {
  NodeID[] op_nodes;     // PFNs
  Edge[]   edges;        // from op.out[i] -> op.in[j]
  Params   params;
  Mode     mode;         // pull/push/batch
  QoS      qos;          // budgets, priority
}
```

On upstream node change, only invalidated ops re-run.

---

## 5) Views and Lenses — replacing files

### 5.1 Canonical view kinds

* **ProjectionView**: select/reshape parts of a subtree.
* **ComputedView**: derived values via PFN graph (deterministic).
* **AggregationView**: group/index/sort over many nodes.
* **TemporalView**: “as of version/time,” history, diffs.
* **MaterializedView**: caches output as nodes; invalidated by signals.
* **SecurityView**: masks/redacts; enforcement as a lens.
* **CompatibilityView**: exposes byte-streams / POSIX/NT for legacy.

### 5.2 Byte-stream lens (compat)

```
lens_bytes.get:
  // Concatenate chunk nodes, or linearize UArr as bytes
  return CONCAT( for chunk in node.children["chunks/*"] -> chunk.value )

lens_bytes.put(patch):
  // Byte-range patch -> chunk splits + COW chunks
  for each (offset,len,data) in patch:
     split affected chunks; write new chunks; update children index atomically
```

---

## 6) OS API (syscalls) — minimal and orthogonal

```
handle node_open(NodeID|NURL, CapMask caps);

Mapped node_map(handle h, VerSpec ver, MapMode mode);
// returns { void* base, size_t len, VerID ver }

VerID node_patch(handle h, Patch p);         // COW + WAL + Signal(VALUE)
int   link_add(handle parent, NameHash, NodeID child);  // Signal(CHILDREN)
int   link_del(handle parent, NameHash);

stream signal_sub(NodeID id, SignalKind kind, Cursor from);

int   cap_grant(NodeID id, Subject s, CapMask caps, TTL);
int   cap_revoke(NodeID id, Subject s, CapMask caps);

Result pfn_call(NodeID pfn, Arg[] args, CallOpts opts);
RunID  flow_run(NodeID flow, Inputs[], Outputs[], RunOpts);

time  ros_time();
u64   ros_rand();
Budgets ros_qos();
```

Everything else is library sugar over these (POSIX views, WASI, etc.).

---

## 7) Compatibility & interop

### 7.1 POSIX/NT façade (as views)

Mount a **/compat** tree:

```
/compat/
  /posix/....  -> CompatibilityView over nodes (byte-stream lens)
/compat/posix/home/charl/file.txt  == ViewSpec(n://docs/abc, lens_bytes)
```

Legacy apps read/write “files”; the lens maps to node patches under the hood.

### 7.2 WASI lane

* Ship a first-class WASM/WASI runtime.
* Provide WASI hostcalls that bind to `/compat/posix` → your views.
* Compile modern tools with `clang --target=wasm32-wasi` and run today.

### 7.3 Sidecar Linux microVM (escape hatch)

* Boot a tiny Linux in a microVM.
* Share folders via node gateways (9p/FUSE-like) backed by views.
* Route sockets via PFNs.
* Lets you run complex legacy stacks while native ecosystem grows.

---

## 8) Networking & distributed Cup Holder

* **Global NodeIDs** (GUIDs).
* **Deltas** (WAL records) ship over QUIC between peers/clusters.
* **Conflict handling**:

  * Non-CRDT nodes: last-writer-wins within a policy or reject without put-lens.
  * CRDT nodes (text lines, doc layers): merge by op-based CRDT; each operation is a WAL delta with a lamport clock / vector clock.

**Mount remote**: `ros mount n://peerA/docs -> n://local/peers/A/docs`
Identical semantics whether local or remote.

---

## 9) Drivers & hardware (AI-assist optional, safety mandatory)

### 9.1 Device profile (DIL)

```
DeviceProfile {
  bus:  PCIe|USB|I2C|MMIO,
  ids:  { vendor, device, class },
  regs: [ { name:"RxDoorbell", addr:0x40, type:U32, mask:0xffff } ... ],
  queues: [ {name:"rx", depth:1024, desc_layout:UArrSchema} ... ],
  irqs: [ {name:"rx_irq", line:5} ],
  dma: { iova_bits: 48, align: 64 },
  state_machine: ... // DSL
}
```

### 9.2 Driver DSL

Declarative, capability-scoped, time-bounded; compiled to WASM/native with static checks.

```
driver nicX : DeviceProfile(pci-8086:1234) {
  map regs @mmio(0xD0000000..0xD000FFFF)
  queue rx(depth=1024, desc=RxDesc) irq rx_irq
  on init { regs.Ctrl = ENABLE; rx.start(); }
  on rx_irq { while rx.has_pkt() { emit packet(node_from(rx.pop())); } }
}
```

* Runs **out of kernel** by default with explicit caps: MMIO ranges, IRQs, DMA buffers.
* Promotion to kernel fast-path after soak tests & verifier proof.
* AI pipeline: synthesize DIL + DSL from datasheets, simulate in QEMU device model, then load.

---

## 10) Persistence, snapshots, export to “real files”

### 10.1 Snapshots & restore

```
ros snapshot n://root -> /mnt/usb/cupholder-2025-09-02.chk
ros restore /mnt/usb/cupholder-2025-09-02.chk -> n://
```

Consistent via `REC_CHECKPOINT`; WAL replay from checkpoint seq.

### 10.2 Exporting views as files

Any view can be **materialized** to a normal file for other OSes:

```
ros render n://docs/hero -> ./hero.psd      // Byte-stream lens (Photoshop)
ros render n://table/sales -> ./sales.csv   // CSV lens
ros render n://img/hero -> ./hero.png       // PNG lens (PFN pipeline)
```

Reverse works too:

```
ros import ./data.csv -> n://datasets/sales  // CSV lens put-graph
```

**On other OSes** (Linux/Windows/macOS), Cup Holder runs as a **userland daemon** with **FUSE/WinFSP** mounting `/compat` and `n://…` namespaces. You still get reactivity: the daemon tails the WAL & emits file change events.

---

## 11) Performance model

* **Reads**: lock-free, zero-copy mapping → tens of ns to deref a cached FatPtr (one swizzle lookup).
* **Writes**: COW UArr build (µs-ms), single CAS publish, WAL append (batched), signal fan-out (debounced).
* **Views**: dependency graph; incremental recompute; memoization for deterministic PFNs.
* **Hot data** stays memory-mapped; cold versions live only on SSD until paged in.

---

## 12) Failure domains, upgrades, portability

* **Crash safety**: WAL + RCU ensures readers never see torn state; replay to last checkpoint.
* **Schema evolution**: UArr fields are **append-only**; lenses handle structural changes via get/put graphs. Version pinning via `FatPtr.min_ver`.
* **Portability**: UArr is endian-stable; only alignment constraints; content is self-describing. Snapshots portable across machines/arches.

---

## 13) Tooling (so you actually enjoy using it)

* **ros shell**: list, query, patch nodes; subscribe live; diff versions.
* **ros graph**: render view dependency graph (which nodes recompute when X changes).
* **ros tail**: follow Signals with filters; persist cursors.
* **ros bench**: microbench deref/map/patch.
* **ros verify**: lens/pfn determinism & schema validation.
* **ros trace**: per-PFN cpu\_ns/mem/io budgets & flamegraphs.

---

## 14) Pseudocode — key operations

### 14.1 Node mapping (fast path)

```pseudocode
function node_map(h, ver_spec, mode):
  hdr = swizzle_lookup(h.id)
  if hdr is null:
     hdr = load_header_from_index(h.id)
     base = map_value_region(hdr.value_ptr)  // RO map
     swizzle_put(h.id, base, hdr)
  if ver_spec == LATEST:
     return { base: swizzle[h.id].base, len: size_of(hdr.value_ptr), ver: hdr.cur_ver }
  else:
     vptr = lookup_version_ptr(h.id, ver_spec)
     base = map_value_region(vptr)
     return { base, len: size_of(vptr), ver: ver_spec }
```

### 14.2 Patch (COW + WAL + Signal)

```pseudocode
function node_patch(h, patch):
  assert has_cap(h.proc, h.id, WRITE)
  old_hdr = load_header(h.id)
  new_value = apply_patch(old_hdr.value_ptr, patch)     // builds new UArr
  new_vptr  = allocate_extent(len(new_value))
  memcpy(new_vptr, new_value)

  new_ver = gen_ver()
  // atomic publish
  CAS(&old_hdr.value_ptr, old_hdr.value_ptr, new_vptr)
  old_hdr.cur_ver = new_ver
  write_wal(REC_NODE_PATCH{h.id, old_hdr.cur_ver, new_ver, new_vptr, patch.delta})
  write_wal(REC_SIGNAL{ ts:now, kind:VALUE, base_ver:old_hdr.cur_ver, new_ver, source:h.id, delta:patch.delta })
  return new_ver
```

### 14.3 Subscribe (resume anywhere)

```pseudocode
function signal_sub(node_id, kind, cursor):
  while true:
    rec = wal_read_from(cursor)
    if rec is REC_SIGNAL and rec.source == node_id and rec.kind == kind:
       yield rec
    cursor = rec.next
```

### 14.4 View read/write (lens.get / lens.put)

```pseudocode
function view_read(vh, cursor?):
  inputs = resolve_selector(vh.spec.root, vh.spec.selector)
  data   = eval_graph(vh.spec.lens.get_graph, inputs)
  if vh.materialized:
      store_materialized(vh.id, data)
  return data

function view_write(vh, view_patch):
  inputs = resolve_selector(vh.spec.root, vh.spec.selector)
  put_ops = eval_graph(vh.spec.lens.put_graph, { inputs, view_patch })
  for op in put_ops:
     node_patch(op.target, op.patch)
```

### 14.5 PFN call & flow (deterministic cache)

```pseudocode
function pfn_call(pfn_id, args, opts):
  sig = load_pfn_sig(pfn_id)
  assert typecheck(args, sig.in_types)
  if sig.deterministic:
    key = hash(pfn_id, args)
    if cache.contains(key): return cache.get(key)
  out = run_impl(sig.impl, args, opts)
  if sig.deterministic: cache.put(key, out)
  return out
```

---

## 15) Worked examples

### 15.1 Reactive text (two editors, no plugins)

```
n://docs/a
  lines/ (CRDT list; each line is a node; order is op-based CRDT)
```

* Editor A patches `lines/42` → new UArr, COW publish, `Signal(VALUE)`.
* Editor B subscribed to `n://docs/a/lines/*` → receives the delta; its view updates.
* `ros render n://docs/a -> ./a.txt` materializes a normal file for export.

### 15.2 “Photoshop without exports”

```
n://img/hero/
  layers/<i>/tiles/*      (tile nodes)
  layers/<i>/mask         (bitmap)
  layers/<i>/blend        (mode, opacity)
  render/                 (MaterializedView -> GPU target)
```

* A filter app writes new tiles; `render/` invalidates and recomputes touched tiles only.
* Another system (Linux/macOS) mounts `/compat` and sees a byte-stream PSD via a lens.

### 15.3 System config → live driver

```
n://sys/net/routes  (table view over route nodes)

$ ros patch n://sys/net/routes +{dst:"10.0.0.0/24", gw:"10.0.0.1", dev:"nic0"}

→ Driver (subscribed to SecurityView of routes) receives Signal(CHILDREN)
→ Reprograms NIC via driver DSL; publishes Signal(CUSTOM: route_applied)
```

---

## 16) MVP roadmap (realistic, iterative)

**Phase A (userland, 2–4 weeks)**

* Node store (WAL + COW) in a shared memory segment + file-backed persistence.
* UArr encoder/decoder + fuzzing.
* Signals + cursors + `ros tail`.
* FUSE/WinFSP mount for `/compat` (byte-stream lens).
* Two demo apps: `npaint` (tiles) + `nview` (live preview).

**Phase B**

* View engine (Projection + Computed + Materialized) + dependency graph.
* PFN runner (WASM + small native set) with memoization.
* POSIX personality (minimal libc mapping read/write → view lens).
* WASI runtime bridged to `/compat`.

**Phase C**

* CRDT objects (lines/lists).
* Snapshot/restore tools; USB checkpoint format.
* Distributed log shipping; remote mount.

**Phase D**

* Driver DSL + verifier + QEMU harness.
* First user-mode driver (USB HID or NVMe read-only).
* SecurityViews with redaction; policy audit.

---

## 17) Trade-offs & guardrails

* **Simplicity vs performance**: one abstraction everywhere; optimize under the hood with swizzle caches, COW tuning, memoization.
* **Determinism**: PFNs must declare pure/impure; caching only for pure.
* **Schema evolution**: UArr fields append-only; lenses handle shape change; test with migration suites.
* **Security**: all access goes through FatPtrs; caps are visible, auditable nodes; default-deny.
* **Backpressure**: signals are coalesced; per-actor budgets; materialization quotas.

---

## 18) Why it’s awesome (and yes, better than ice cream)

* **One brain model**: you learn “node + view + lens + signal” and it applies to *everything*.
* **Zero serialization**: mount, patch, and go.
* **Instant collaboration**: share a FatPtr, not a file format.
* **Time travel**: versions are first-class; diff anything.
* **Portable reality**: same structure in RAM, on disk, on USB, or over the network.
* **AI-native**: models, prompts, and results are nodes; compute is PFN flows; drivers can be synthesized and verified.
* **Dev joy**: reactive by default; observable by default; composable by default.
* **Inevitable**: this is what “everything is a file” wanted to be when it grew up.

Ice cream melts. Nodes persist. 🍦➡️🧊

---

## 19) Appendix — binary struct sketches (C/Rust-ish pseudocode)

```c
// Superblock
struct Superblock {
  u32 magic;            // 'CHOS'
  u16 ver_major, ver_minor;
  u64 flags;            // features
  u64 slab_off, slab_len;
  u64 ext_off,  ext_len;
  u64 idx_off,  idx_len;
  u64 wal_off,  wal_len;
  NodeID root_ids[16];  // well-known roots: sys, proc, net, gpu, docs, ...
  u64   checksum;
}

// Child index entry
struct ChildEnt { u64 nameHash; NodeID id; }
struct ChildIndex { u32 count; ChildEnt ents[count]; }

// Capabilities
struct CapEdge { Subject s; CapMask caps; TSTAMP expiry; }

// WAL record header
struct WalRecHdr { u32 kind; u32 len; u64 seq; u64 crc; }

// Mapped return
struct Mapped { void* base; size_t len; VerID ver; }
```

---

## 20) Appendix — example lenses

**CSV lens**

```pseudocode
lens_csv.get(nodes: rows[]) -> UArr(bytes)
  buf = ""
  for r in rows:
     buf += JOIN_WITH_COMMAS( for c in r.cells -> ESCAPE(c) ) + "\n"
  return UArr{BYTES: buf}

lens_csv.put(patch: BYTES):
  rows2 = PARSE_CSV(patch.data)
  txn = []
  for (i,row) in rows2:
     txn += PATCH( target=rows[i], fields=row )
  return txn
```

**PNG render lens (PFN chain)**

```pseudocode
png.get(img_root):
  tiles  = SELECT(img_root, "layers/*/tiles/*")
  merged = PFN("img.merge_tiles", tiles)
  png    = PFN("img.png_encode", merged)
  return png
```

---

## 21) Appendix — CLI feel

```
$ ros ls n://docs/hero/layers
0 1 2 3

$ ros tail n://docs/hero SIGNAL=VALUE
[12:01:03] layers/2/tiles/45 -> ver=ab12 delta: {rect: [256,512,128,128]}

$ ros patch n://sys/net/routes +'{dst:"10.0.0.0/24",gw:"10.0.0.1",dev:"nic0"}'
ok ver=beef42

$ ros render n://docs/hero -> ./hero.psd
wrote 128.3MB in 420ms
```

---