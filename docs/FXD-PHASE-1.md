# FXD-PHASE-1.md

## 0) Vision

**FX Disk (FXD)** is a RAM-backed virtual filesystem whose “files” are **views over FX nodes**. Code/content lives as **snippets** (nodes with stable IDs). Files are **Groups** of snippets rendered with **language-agnostic markers** so they can be safely round-tripped by any editor.

**Phase-1 goals**

* No ASTs • Language-agnostic • Sync only
* Round-trip safe (file → snippets → file)
* Reactive (groups update, views re-render)
* Deterministic snippet IDs + index
* Ready to wire to a FUSE/Dokan plugin

---

## 1) Building Blocks

### 1.1 Snippets

* Node with `__type="snippet"` and options `{ id, lang, file, order, version }`.
* Created via `createSnippet(path, body, opts)`.
* Stable **id** is the primary identity (path can change).

### 1.2 Groups → Files/Views

* A **Group** of snippet nodes (manual + selector).
* Order: group order → `order` hint → array index.
* Render by concatenation with markers; parse by splitting markers.

### 1.3 Markers (strict)

```
FX:BEGIN id=<ID> [lang=<LANG>] [file=<FILE>] [checksum=<HEX>] [order=<INT>] [version=<INT>]
FX:END id=<ID>
```

Wrapped in appropriate comment style:

* JS/TS: `/* … */` or `// …`
* Py/Sh: `# …`
* INI: `; …`
* etc.

`checksum` (optional) detects divergence; `version` reserves format evolution.

---

## 2) Rendering

`renderView(viewPath, { lang='js', sep='\n\n', eol='lf', hoistImports=false })`

Steps:

1. Get group items (id/lang/file/order/body).
2. Sort; wrap each body with `wrapSnippet(id, body, lang, meta)`.
3. Join with `sep`.
4. Optional **JS/TS single-line import hoist** (guard-railed).
5. Apply EOL policy (lf/crlf).

---

## 3) Parsing

`toPatches(text)`:

* Stream by lines; only treat a line as metadata if it **starts** with a comment token and contains `FX:(BEGIN|END)`.
* Collect bodies between matching `BEGIN`/`END` (ids must match).
* Emit patches `{ id, value, checksum?, version? }`.

`applyPatches(patches, { onMissing='create', orphanRoot='snippets.orphans' })`:

* Find snippet by **id** via index; update `.val()`.
* If missing and allowed, **create** an orphan snippet with that id.

---

## 4) ID Index & Lifecycle

In-memory map `id → path`:

* Update on **create**, **options change** (id change), **path move**.
* Ensures refactors don’t break identity.

---

## 5) Filesystem Plugin (Phase-1 loop)

`fx-fs-fuse` (later today/next):

* `readFile(path)` → map to a **view node** → `renderView()`.
* `writeFile(path, text)` → `toPatches(text)` → `applyPatches()`.
* `readdir(path)` → list known views/dirs from FX graph.

---

## 6) Nice-to-have (optional in Phase-1)

* `order` hints in markers for in-file reordering.
* Import hoist for JS/TS (single-line only; markers untouched).
* `group.map`/`group.concatWithMarkers` sugar.

---

## 7) Out of Scope (Phase-1)

* AST transforms, symbol dedupe, conflict UI, multi-user sync, history.

---

## 8) Quickstart (end-to-end)

```ts
import { createSnippet } from "/modules/fx-snippets.ts";
import { renderView } from "/modules/fx-view.ts";
import { toPatches, applyPatches } from "/modules/fx-parse.ts";

// define snippets
createSnippet("snippets.repo.header", `import { db } from './db.js'`, { lang:"js", file:"src/repo.js" });
createSnippet("snippets.repo.find",   `export const findUser = id => db.users.find(id)`, { lang:"js", file:"src/repo.js" });

// define file as a group
$$("views.repoFile").group(["snippets.repo.header","snippets.repo.find"])
  .include(`.snippet[file="src/repo.js"][lang="js"]`)
  .options({ reactive:true, mode:"set" });

// render to text (for HTTP/FUSE read)
const text = renderView("views.repoFile", { lang:"js", hoistImports:true });

// parse on write (from editor)
const patches = toPatches(textFromEditor);
applyPatches(patches);
```

---

## 9) Roadmap (Phase-2+)

* Graph Viz (Pixi/Three), drag-reorder, live highlights
* Drivers for langs (optional analyzers/formatters)
* Snapshot/export, OverlayFS sandbox, record/replay
* Encrypted snippets, remote compilation, plugin marketplace

---

---

## 📁 Project Structure (Phase-1)

```
fx/
├─ fx.ts                      # FX core (your existing file)
├─ fx.config.json             # optional: plugin autoload config
├─ modules/
│  ├─ fx-snippets.ts          # IDs, fences, checksum, index + lifecycle hooks
│  ├─ fx-view.ts              # render with markers + EOL policy + import hoist
│  ├─ fx-parse.ts             # parser → patches, apply patches
│  ├─ fx-group-extras.ts      # (optional) group list/map polyfill
│  └─ drivers/
│     └─ js-esm.ts            # (phase-2) analyzer stub for imports (optional)
├─ plugins/
│  ├─ fx-fs-fuse.ts           # (phase-1 wire-up) FS bridge: read/write/readdir using modules/*
│  └─ fx-observatory.ts       # (phase-2) graph viz plugin (Pixi/Three)
├─ server/
│  ├─ http.ts                 # tiny HTTP/WS server: serve /fs/* + HMR (if you want browser preview)
│  └─ dev.ts                  # bootstrap: load fx.ts, register plugins, start services
├─ views/
│  └─ README.md               # doc: define how to declare view Group nodes
├─ snippets/
│  └─ README.md               # doc: snippet conventions & tagging
├─ specs/
│  ├─ FXD-PHASE-1.md          # ← this spec file
│  └─ ROADMAP.md              # (optional) phases 2-5 overview
└─ examples/
   └─ repo-js/
      ├─ seed.ts              # creates example snippets + view node
      └─ demo.ts              # renders, simulates write→parse→apply
```

### File purposes (quick notes)

* `fx.ts` — your core runtime; ensure it calls the **lifecycle hooks** from `fx-snippets.ts` when a snippet’s `options.id` changes or a snippet node moves.
* `modules/fx-snippets.ts` — snippet creation, marker emit helpers, checksum, **id index + hooks**.
* `modules/fx-view.ts` — `renderView` (wrap → concat → eol) + `hoistImportsOnce`.
* `modules/fx-parse.ts` — `toPatches` (strict marker parse) + `applyPatches`.
* `modules/fx-group-extras.ts` — small shims if your Group API doesn’t have `list`/`map`.
* `plugins/fx-fs-fuse.ts` — adapter that maps OS FS calls to `renderView`/`applyPatches`.
* `server/http.ts` — dev-server to serve `/fs/*` (optional, nice for browser HMR).
* `server/dev.ts` — starts FX, loads plugins, seeds examples.

---

## Minimal wiring (dev.ts)

```ts
// server/dev.ts
import "./../fx.ts";
import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";

// optional: tiny HTTP handler
import { createServer } from "node:http";

createServer(async (req, res) => {
  if (req.url?.startsWith("/fs/")) {
    // map url to a view node id, e.g., "/fs/src/repo.js" -> "views.repoFile"
    const viewId = mapPathToViewId(req.url);
    const text = renderView(viewId, { lang:"js", hoistImports:true });
    res.writeHead(200, { "content-type":"text/javascript; charset=utf-8" });
    res.end(text);
    return;
  }
  res.writeHead(404).end("not found");
}).listen(4400);
```

(Your FUSE/Dokan plugin will call the same `renderView`/`applyPatches` functions.)