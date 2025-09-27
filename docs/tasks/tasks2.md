
## FXD Phase 2: "The Ecosystem" - Granular Task List

This is the complete plan. We will organize it into the same 12 sections, focusing on Persistence, History, Git Integration, and Collaboration.

### Section 13: Persistence Layer (SQLite)
*Goal: Make projects persistent by saving and loading the entire FX graph to a `.fxd` (SQLite) file.*

*   `13.1.` Create `modules/fx-persistence.ts` with `save` and `load` function signatures.
*   `13.2.` Add `better-sqlite3` as a Node.js dependency for the Electron Main process.
*   `13.3.` Define the `.fxd` database schema: `nodes` table, `values` table, `metadata` table.
*   `13.4.` Implement the `save(filePath)` function:
    *   `13.4.1.` Open/create the SQLite database file.
    *   `13.4.2.` Create the necessary tables if they don't exist.
    *   `13.4.3.` Implement a recursive traversal of the `$_$$` graph.
    *   `13.4.4.` For each node, `INSERT OR REPLACE` its core properties (`__id`, `__parent_id`, `__type`, `__proto`) into the `nodes` table.
    *   `13.4.5.` Serialize and `INSERT OR REPLACE` the `__value` and `__meta` into the `values` table, linked by `node_id`.
*   `13.5.` Implement the `load(filePath)` function:
    *   `13.5.1.` Open the SQLite database file.
    *   `13.5.2.` Clear the existing in-memory graph.
    *   `13.5.3.` `SELECT` all rows from the `nodes` and `values` tables.
    *   `13.5.4.` Reconstruct the entire `$_$$` graph in memory from the database records.
    *   `13.5.5.` Rebuild the `__parentMap` in `FXCore` after reconstruction.
*   `13.6.` Integrate with the Electron `main.ts` to add "File > Open/Save" menu items.
*   `13.7.` Implement file association for `.fxd` files to open with the FXD Environment.
*   `13.8.` Create unit tests for the save/load cycle, ensuring perfect data fidelity.
*   `13.9.` Document the `.fxd` file format and the persistence API.

### Section 14: Temporal History Layer (FX-Git)
*Goal: Create a powerful, Git-like version control system that operates on atomic nodes.*

*   `14.1.` Create `addons/fx-history.ts` that will be loaded as the `$history` global.
*   `14.2.` Add a `$history` tree to `$_$$` to store versioning data.
*   `14.3.` Update the persistence schema to include `commits`, `branches`, and `snapshots` tables.
*   `14.4.` Implement `$history.commit(message: string)`:
    *   `14.4.1.` Create a snapshot of the current `$_$$('code')` tree.
    *   `14.4.2.` Store this snapshot in the `snapshots` table.
    *   `14.4.3.` Create a new commit record in the `commits` table with a hash, message, timestamp, and a pointer to the snapshot.
*   `14.5.` Implement `$history.branch(branchName: string)` to create a new branch pointer.
*   `14.6.` Implement `$history.checkout(branchNameOrCommitHash: string)`:
    *   `14.6.1.` Load the target commit's snapshot from the database.
    *   `14.6.2.` Diff the live `$_$$('code')` graph with the snapshot.
    *   `14.6.3.` Apply only the necessary changes (creations, updates, deletions) to the live graph.
*   `14.7.` Implement `$history.log()` to retrieve the commit history for the current branch.
*   `14.8.` **UI:** Create a "History" panel in the FX Composer (Svelte component).
*   `14.9.` **UI:** The panel will use D3.js to visualize the commit log as an interactive graph.
*   `14.10.` **UI:** Allow users to click a commit to see a visual diff of the node changes.
*   `14.11.` Create unit tests for all `$history` operations.
*   `14.12.` Document the FX-Git workflow.

### Section 15: Git Bridge (Import/Export)
*Goal: Allow FXD to interoperate with standard, file-based Git repositories.*

*   `15.1.` Create `addons/fx-git-bridge.ts`.
*   `15.2.` Add a simple, lightweight Git client library (like `isomorphic-git`) as a dependency.
*   `15.3.` Implement `exportToGit(targetDirectory: string)`:
    *   `15.3.1.` Use the `$views` engine to render all defined file views.
    *   `15.3.2.` Write each rendered file to the correct path in the `targetDirectory`.
*   `15.4.` Implement `importFromGit(sourceDirectory: string)`:
    *   `15.4.1.` Use the `fx-scan` engine to process all files in the `sourceDirectory`.
    *   `15.4.2.` Create the corresponding snippet nodes in `$_$$('code')`.
    *   `15.4.3.` Automatically generate default file views in `$_$$('views')` that reconstruct the original files.
*   `15.5.` **UI:** Add "Import from Git Repo..." and "Export to Folder..." to the File menu.
*   `15.6.` **UI:** Create a "Git Sync" panel in the Composer.
*   `15.7.` **UI:** This panel will show a diff between the FXD project and a linked Git repo, allowing users to `pull` changes from the Git repo into FXD or `push` changes from FXD to the Git repo.
*   `15.8.` Create unit tests for the import/export cycle.
*   `15.9.` Document the interoperability workflow with standard Git.

### Section 16: Collaboration Foundation
*Goal: Prepare the architecture for real-time multi-user collaboration.*

*   `16.1.` Create a simple `addons/fx-auth.ts` to manage `$_$$('session.currentUser')`.
*   `16.2.` Add `__meta.owner` and `__meta.lastModifiedBy` to the `createSnippet` function.
*   `16.3.` Modify `FXCore.set` to automatically stamp these properties on node mutation, using the ID from the session user.
*   `16.4.` Update the persistence schema to store `owner` and `lastModifiedBy` in the `nodes` table.
*   `16.5.` Design the WebSocket protocol for real-time sync (`node-update`, `node-create`, `node-delete` messages).
*   `16.6.` Implement a basic WebSocket server in the Electron `main.ts` that broadcasts these change messages to all connected clients (full conflict resolution is Phase 3).
*   `16.7.` Implement a client-side bridge in the Renderer that listens to these WebSocket messages and applies the changes to the local FX graph.
*   `16.8.` Create unit tests to verify that a change made by "User A" is correctly stamped and broadcast, and that "User B" receives the update.
*   `16.9.` Document the basic collaboration model and the WebSocket protocol.