/**
 * Enhanced FX Persistence with Group and View support
 * Extends the base persistence to handle all FXD data types
 */

import { FXPersistence, SQLiteDatabase } from "./fx-persistence.ts";
import { $$ } from "../fx.ts";

/**
 * Enhanced persistence class with full feature support
 */
export class FXPersistenceEnhanced extends FXPersistence {
  constructor(db: SQLiteDatabase) {
    super(db);
  }

  /**
   * Save groups to database
   */
  saveGroups(): void {
    const groups = $$("groups").val() || {};

    for (const [groupId, groupData] of Object.entries(groups)) {
      const group = groupData as any;

      // Save group metadata
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO groups (id, selector, created, version)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        groupId,
        group.selector || null,
        group.created || Date.now(),
        group.version || 1
      );
      stmt.finalize();

      // Save group items (manual selections)
      if (group.items && Array.isArray(group.items)) {
        const itemStmt = this.db.prepare(`
          INSERT OR REPLACE INTO group_items (group_id, item_path, item_order)
          VALUES (?, ?, ?)
        `);

        group.items.forEach((item: string, index: number) => {
          itemStmt.run(groupId, item, index);
        });
        itemStmt.finalize();
      }
    }
  }

  /**
   * Load groups from database
   */
  loadGroups(): void {
    // Load group metadata
    const groupStmt = this.db.prepare(`
      SELECT id, selector, created, version
      FROM groups
    `);

    const groups = groupStmt.all();
    groupStmt.finalize();

    for (const group of groups) {
      // Load group items
      const itemStmt = this.db.prepare(`
        SELECT item_path, item_order
        FROM group_items
        WHERE group_id = ?
        ORDER BY item_order
      `);

      const items = itemStmt.all(group.id);
      itemStmt.finalize();

      // Reconstruct the group
      const groupData: any = {
        selector: group.selector,
        created: group.created,
        version: group.version
      };

      if (items.length > 0) {
        groupData.items = items.map((item: any) => item.item_path);
      }

      // Set in FX
      $$(`groups.${group.id}`).val(groupData);
    }
  }

  /**
   * Save views to database
   */
  saveViews(): void {
    const views = $$("views").val() || {};

    for (const [viewId, viewData] of Object.entries(views)) {
      const view = viewData as any;

      // Handle different view data structures
      let content = "";
      let viewType = "text";
      let renderOptions = null;

      if (typeof viewData === "string") {
        content = viewData;
      } else if (view.content) {
        content = view.content;
        viewType = view.type || "text";
        renderOptions = view.renderOptions ? JSON.stringify(view.renderOptions) : null;
      } else if (view.group) {
        // View based on a group
        content = "";
        viewType = "group";
        renderOptions = JSON.stringify({
          group: view.group,
          options: view.options || {}
        });
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO views (id, content, type, created, version, render_options)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        viewId,
        content,
        viewType,
        view.created || Date.now(),
        view.version || 1,
        renderOptions
      );
      stmt.finalize();
    }
  }

  /**
   * Load views from database
   */
  loadViews(): void {
    const stmt = this.db.prepare(`
      SELECT id, content, type, created, version, render_options
      FROM views
    `);

    const views = stmt.all();
    stmt.finalize();

    for (const view of views) {
      let viewData: any;

      if (view.type === "text" && !view.render_options) {
        // Simple text view
        viewData = view.content;
      } else if (view.type === "group" && view.render_options) {
        // Group-based view
        const options = JSON.parse(view.render_options);
        viewData = {
          group: options.group,
          options: options.options || {},
          type: view.type,
          created: view.created,
          version: view.version
        };
      } else {
        // Complex view
        viewData = {
          content: view.content,
          type: view.type,
          created: view.created,
          version: view.version
        };

        if (view.render_options) {
          viewData.renderOptions = JSON.parse(view.render_options);
        }
      }

      // Set in FX
      $$(`views.${view.id}`).val(viewData);
    }
  }

  /**
   * Save markers to database
   */
  saveMarkers(): void {
    const markers = $$("markers").val() || {};

    for (const [markerId, markerData] of Object.entries(markers)) {
      const marker = markerData as any;

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO snippets (
          id, content, language, file, start_line, end_line,
          snippet_order, version, checksum, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        markerId,
        marker.content || "",
        marker.language || "text",
        marker.file || null,
        marker.startLine || null,
        marker.endLine || null,
        marker.order || 0,
        marker.version || 1,
        marker.checksum || null,
        JSON.stringify({
          type: "marker",
          pattern: marker.pattern,
          flags: marker.flags
        })
      );
      stmt.finalize();
    }
  }

  /**
   * Enhanced save method that includes all data types
   */
  save(): void {
    this.db.transaction(() => {
      // Save all data types
      this.saveNodes();
      this.saveSnippets();
      this.saveGroups();
      this.saveViews();
      this.saveMarkers();

      // Update metadata
      const metadataStmt = this.db.prepare(`
        INSERT OR REPLACE INTO metadata (key, value)
        VALUES (?, ?)
      `);

      metadataStmt.run("last_saved", Date.now());
      metadataStmt.run("save_count", this.getSaveCount() + 1);
      metadataStmt.run("version", "2.0.0");
      metadataStmt.finalize();
    });
  }

  /**
   * Enhanced load method that includes all data types
   */
  load(): void {
    // Load all data types
    this.loadNodes();
    this.loadSnippets();
    this.loadGroups();
    this.loadViews();

    // Load metadata
    const metadataStmt = this.db.prepare(`
      SELECT key, value FROM metadata
    `);

    const metadata = metadataStmt.all();
    metadataStmt.finalize();

    for (const row of metadata) {
      $$(`metadata.${row.key}`).val(row.value);
    }
  }

  /**
   * Get save count from metadata
   */
  private getSaveCount(): number {
    const stmt = this.db.prepare(`
      SELECT value FROM metadata WHERE key = 'save_count'
    `);
    const row = stmt.get();
    stmt.finalize();
    return row ? parseInt(row.value) : 0;
  }

  /**
   * Get enhanced statistics
   */
  getStats(): {
    nodes: number;
    snippets: number;
    views: number;
    groups: number;
    markers: number;
    saveCount: number;
    lastSaved: number | null;
  } {
    const baseStats = super.getStats();

    // Count groups
    const groupStmt = this.db.prepare(`SELECT COUNT(*) as count FROM groups`);
    const groupCount = groupStmt.get();
    groupStmt.finalize();

    // Count markers (stored as special snippets)
    const markerStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM snippets
      WHERE metadata LIKE '%"type":"marker"%'
    `);
    const markerCount = markerStmt.get();
    markerStmt.finalize();

    // Get metadata
    const saveCount = this.getSaveCount();
    const lastSavedStmt = this.db.prepare(`
      SELECT value FROM metadata WHERE key = 'last_saved'
    `);
    const lastSavedRow = lastSavedStmt.get();
    lastSavedStmt.finalize();

    return {
      ...baseStats,
      groups: groupCount?.count || 0,
      markers: markerCount?.count || 0,
      saveCount: saveCount,
      lastSaved: lastSavedRow ? parseInt(lastSavedRow.value) : null
    };
  }

  /**
   * Validate database integrity
   */
  validateIntegrity(): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check table existence
      const tables = ['nodes', 'snippets', 'groups', 'group_items', 'views', 'metadata'];
      for (const table of tables) {
        const stmt = this.db.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name=?
        `);
        const result = stmt.get(table);
        stmt.finalize();

        if (!result) {
          issues.push(`Missing table: ${table}`);
          recommendations.push(`Run initialize() to create missing tables`);
        }
      }

      // Check for orphaned group items
      const orphanStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM group_items
        WHERE group_id NOT IN (SELECT id FROM groups)
      `);
      const orphans = orphanStmt.get();
      orphanStmt.finalize();

      if (orphans && orphans.count > 0) {
        issues.push(`Found ${orphans.count} orphaned group items`);
        recommendations.push(`Clean up orphaned group items`);
      }

      // Check for data consistency
      const stats = this.getStats();
      if (stats.lastSaved && Date.now() - stats.lastSaved > 86400000) {
        recommendations.push(`Data is over 24 hours old, consider backing up`);
      }

    } catch (error) {
      issues.push(`Database error: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Clean up orphaned data
   */
  cleanupOrphans(): { removed: number; tables: string[] } {
    let removed = 0;
    const tables: string[] = [];

    this.db.transaction(() => {
      // Remove orphaned group items
      const stmt = this.db.prepare(`
        DELETE FROM group_items
        WHERE group_id NOT IN (SELECT id FROM groups)
      `);
      const result = stmt.run();
      stmt.finalize();

      if (result.changes > 0) {
        removed += result.changes;
        tables.push('group_items');
      }
    });

    return { removed, tables };
  }
}