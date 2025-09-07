# 📄 FX Disk – Phase-1 Design Document

## 0) Vision

FX Disk (**FXD**) is a **RAM-backed virtual filesystem** that maps directly onto FX Nodes. Every snippet of code or data lives in the FX graph. Files and folders in the FS are not stored on disk but are *views* over groups of nodes.

**Core properties:**

* **Language agnostic** (snippets are just strings, wrapped with markers).
* **Reactive** (groups update, views re-render).
* **Round-trip safe** (file → snippets → file with byte preservation).
* **Deterministic IDs** (every snippet stable across moves).
* **FUSE/Dokan ready** (OS can mount FXD as a “real” disk).

---

## 1) Building Blocks

### 1.1 Snippets

* Unit of code/data.
* Stored as FX nodes with:

  * `__type = "snippet"`
  * Options: `{ id, lang, file, order, version }`
* Created with `createSnippet(path, body, opts)`.

### 1.2 Groups

* Ordered, reactive collections of snippets.
* Represent files or higher-level “views”.
* Control membership via `.include()`, `.exclude()`, `.group([...])`.

### 1.3 Views

* A group *plus* a renderer.
* Render = join snippets with **markers** delimiting them.
* Parse = split file back into snippets and patch the graph.

---

## 2) Markers

**Strict grammar (always one line each):**

```
FX:BEGIN id=<ID> [lang=<LANG>] [file=<FILE>] [checksum=<HEX>] [order=<INT>] [version=<INT>]
FX:END id=<ID>
```

* Wrapped in comment style for each language:

  * JS/TS: `/* FX:BEGIN … */`
  * Py/Sh: `# FX:BEGIN …`
  * etc.
* Guarantees round-trip across any editor.
* `checksum` optional: detect divergence.
* `order` optional: sort control in file.
* `version`: reserved, default = 1.

---

## 3) Index & Lifecycle

* `id → path` mapping kept in memory.
* Updated on snippet create, options change, or path move.
* Ensures stable identity even if paths change.

---

## 4) Rendering

* `renderView(viewPath, opts)`:

  * Look up group items.
  * Sort by group order → `order` → index.
  * Wrap each snippet body with markers.
  * Join with separator (`\n\n` default).
  * Normalize EOL (`lf` or `crlf`).
  * Optionally hoist imports (JS/TS only, single-line safe).

---

## 5) Parsing

* `toPatches(text)`:

  * Stream by line.
  * Detect `BEGIN/END` markers (strip fences only when line starts with comment + has `FX:`).
  * Collect body faithfully.
  * Emit patches `{ id, value, checksum, version }`.

* `applyPatches(patches, opts)`:

  * Find snippet by ID via index.
  * Update node value.
  * If missing, create orphan snippet under `snippets.orphans.*`.

---

## 6) Filesystem Integration (MVP)

**Plugin `fx-fs-fuse`:**

* `readFile(path)` → map FS path to view → `renderView()`.
* `writeFile(path, text)` → `toPatches(text)` → `applyPatches()`.
* `readdir(path)` → list groups/files defined in FX.

---

## 7) Phase-1 Scope

* ✅ Snippets w/ IDs, fences, checksums.
* ✅ Groups/views.
* ✅ Render + parse.
* ✅ Apply patches w/ orphan handling.
* ✅ Import hoist (JS/TS).
* ✅ Index lifecycle hooks.

**Out of scope for Phase-1:**

* AST parsing.
* Merge conflict UI.
* Version history.
* Multi-user sync.

---

# 📄 FX Disk – Roadmap (Phase-2+)

## Phase-2: Developer Quality of Life

* **Graph visualizer** (D3/Three.js/pixi.js plugin).
* **File diffing**: highlight checksum divergence.
* **Order control in UI**: drag snippets in graph to reorder.
* **Multi-lang drivers**: attach parsers for Python, Go, etc.
* **Inline view editors**: edit snippet directly in graph view.

## Phase-3: Collaboration & Sandboxing

* **Snapshots/checkpoints**: export/import FX graphs.
* **OverlayFS integration**: mount full dev env on FXD, rollback at will.
* **Sandbox playback**: run code against recorded I/O (APIs, DB).
* **Shared baselines**: give juniors “recorded” runtime without prod access.

## Phase-4: Open Dev Ecosystem

* **Encrypted snippets**: compiler can read, human cannot.
* **Remote compilation**: code compiled off-site, only bytecode/tokens returned.
* **Plugin marketplace**: drivers, parsers, viz add-ons.

## Phase-5: Vision

FX Disk becomes the **default dev environment layer**:

* Filesystems are views over live graphs.
* Every snippet is reactive + inspectable.
* Debugging is sandboxed + replayable.
* Open source projects can be extended without leaking protected source.

---

# 🌟 Vision Statement

FX Disk is not just a dev tool—it’s a **new substrate for programming**:

* **Files become views, not the source of truth.**
* **Code is live and reactive.**
* **Development is sandboxed by default.**
* **Collaboration is safe—even with closed source.**
* **Graphs replace folders as the way to *see* your code.**

Phase-1 gets you there with a minimal, working core: snippets, groups, views, render/parse. Everything else builds on this bedrock.
