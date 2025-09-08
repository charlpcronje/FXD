# 📖 **What is FXDisk?**

FXDisk is a **virtual file system and development platform** built on top of the FX core.
It lets you store, version, and compose **code snippets** in memory, then expose them as if they were normal files on disk.

Think of it as a **RAM-based file system for code**, where every file is really a *view* that’s assembled from smaller *snippets*.
Snippets are reactive: if you edit one, all views that use it are instantly updated.

---

# ⚙️ **How FXDisk Works**

### 1. **Snippets**

* Smallest building block in FXDisk.
* Each snippet has:

  * **ID** (stable, versioned)
  * **Body** (the actual code/text)
  * **Options** (`lang`, `file`, `version`, `order`, etc.)
* Snippets are versioned independently — two developers can edit different snippets in the same “file” without conflicts.

---

### 2. **Views**

* A **view is a virtual file**: just an ordered group of snippets.

* Views define:

  * Which snippets are included
  * Their order
  * Output type (e.g., `.js`, `.html`, `.pdf`)

* When opened in an editor, a view looks and behaves like a normal file.

* **Reactive:** changing a snippet updates all views that include it.

---

### 3. **Groups**

* A group is a **collection of snippets or nodes** that can be managed together.
* Groups can be manual (you pick snippets) or selector-based (e.g., all `.snippet[lang=js]`).
* Groups support operations like:

  * `.concat()` → join snippets into one file string
  * `.sum()`, `.average()` (for data)
  * `.on("change")` → react to updates

Groups are how we define reusable file templates, snippet libraries, etc.

---

### 4. **FXDisk Virtual Mount**

* FXDisk runs as a **virtual disk**, mounted via FUSE/Dokan.
* From the OS perspective:

  * Views look like files.
  * Groups and snippets are hidden metadata.
* You can open `project-x.fxd`, double-click `src/repo.js`, and your editor sees a normal file — but it’s actually being served live from snippets in memory.

---

### 5. **Persistence & Portability**

* The whole FXDisk lives in memory (very fast).
* Every change is **synced to persistent storage** — even if the laptop crashes, edits are safe.
* An FXDisk can be zipped into a single `.fxd` archive:

  * Portable
  * Self-contained (all snippets, views, groups, and dependencies included)
  * Can be mounted on another machine instantly.

---

### 6. **Visualizer**

* The Visualizer is the **UI layer** for humans.
* Shows snippets as blocks with metadata (language, lines of code, version).
* Views are shown as flows of blocks (drag-and-drop to rearrange).
* Provides stats:

  * Total lines
  * Primary language
  * File extension
* Supports drag-and-drop snippet composition to build new views.
* Eventually will support AI assistance (suggesting snippets based on proven patterns).

---

# 💡 **Why FXDisk Matters**

* **Reactive editing:** Change one snippet, every file updates.
* **Versioned granularity:** No more merge hell on giant files — conflicts happen at snippet level.
* **Knowledge graph of code:** AI can build systems out of *proven snippets* instead of hallucinating.
* **Self-contained execution:** Mount an FXDisk → everything runs in memory → dependencies already resolved.
* **Speed:** Reading, compiling, or generating (like PDFs) is much faster because everything is already in memory.

---

# 🎨 **What Designers Need to Build in Figma**

Here are the **screens** the FXDisk UI needs:

1. **Dashboard / Explorer**

   * Sidebar: Home, Snippets, Views, Groups, Settings.
   * Main: Grid/list of views (each panel shows file name, lines, main language).
   * Footer: disk info (`mounted: fxd001 | mode: RW`).

2. **Snippets Manager**

   * Table layout: columns = ID, Name, Lines, Type, Version.
   * Right-click menu: Edit, Create New Version, Duplicate Unique, Delete.

3. **Snippet Editor**

   * Code editor (monospace dark theme).
   * Header: snippet ID + version.
   * Footer: stats (lines, language, file association).

4. **Visualizer (View Builder)**

   * Canvas layout with draggable snippet blocks.
   * Left: snippet palette.
   * Right: canvas with connected blocks.
   * Bottom: stats (total lines, languages, extension).

5. **Compile/Output Screen**

   * Progress bar.
   * Output info (lang, lines, snippets, file type).
   * Status footer: *“All compiles in memory, synced on success”*.

6. **FXDisk File Integration**

   * Mock Windows Explorer screen showing `.fxd` file icons.
   * Context menu: Mount, Open with Visualizer, Export.
   * Preview panel: metadata summary (snippets, views, language breakdown).
