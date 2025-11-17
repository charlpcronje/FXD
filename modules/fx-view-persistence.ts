/**
 * @file fx-view-persistence.ts
 * @description View persistence for group selectors and render options
 * Handles storage and reconstruction of FX views/groups in SQLite
 */

// @agent: agent-modules-persist
// @timestamp: 2025-10-02T07:00:00Z
// @task: TRACK-B-MODULES.md#B2.3
// @status: in_progress

import { $$, $_$$, fx, FXCore } from '../fxn.ts';
import type { FXNode } from '../fxn.ts';
import {
  SQLiteDatabase,
  SQLiteStatement,
  SerializedView,
  PersistenceUtils
} from "./fx-persistence.ts";

/**
 * View configuration for persistence
 */
export interface ViewConfig {
  name: string;
  anchorNodeId?: string;
  selectors: ViewSelector[];
  renderOptions: ViewRenderOptions;
  components?: ViewComponent[];
}

/**
 * View selector definition
 */
export interface ViewSelector {
  type: 'css' | 'type' | 'manual';
  value: string;
  include: boolean; // true for include, false for exclude
}

/**
 * View render options
 */
export interface ViewRenderOptions {
  lang?: string;
  separator?: string;
  eol?: 'lf' | 'crlf';
  hoistImports?: boolean;
  sortMode?: 'order' | 'name' | 'modified' | 'manual';
  includeMarkers?: boolean;
  customTemplate?: string;
}

/**
 * View component linking snippets
 */
export interface ViewComponent {
  snippetId: string;
  orderIndex: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

/**
 * View search criteria
 */
export interface ViewSearchCriteria {
  name?: string;
  anchorNodeId?: string;
  hasSelector?: string;
  isDirty?: boolean;
  createdAfter?: Date;
  modifiedAfter?: Date;
}

/**
 * View statistics
 */
export interface ViewStats {
  totalCount: number;
  byAnchorNode: Record<string, number>;
  byRenderLang: Record<string, number>;
  averageComponentCount: number;
  totalComponents: number;
  lastModified: Date | null;
}

/**
 * View persistence manager
 * Provides CRUD operations for views in SQLite database
 */
export class ViewPersistence {
  private db: SQLiteDatabase;
  private fx: FXCore;
  private statements: Record<string, SQLiteStatement> = {};

  constructor(db: SQLiteDatabase, fx: FXCore) {
    this.db = db;
    this.fx = fx;
    this.initializePreparedStatements();
  }

  /**
   * Initialize prepared statements for optimal performance
   */
  private initializePreparedStatements(): void {
    this.statements = {
      // View operations
      insertView: this.db.prepare(`
        INSERT OR REPLACE INTO views
        (id, name, anchor_node_id, selectors_json, render_options_json, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      selectView: this.db.prepare(`
        SELECT * FROM views WHERE id = ?
      `),
      selectViewByName: this.db.prepare(`
        SELECT * FROM views WHERE name = ?
      `),
      selectViewsByAnchor: this.db.prepare(`
        SELECT * FROM views WHERE anchor_node_id = ? ORDER BY name ASC
      `),
      selectAllViews: this.db.prepare(`
        SELECT * FROM views ORDER BY created_at DESC
      `),
      selectDirtyViews: this.db.prepare(`
        SELECT * FROM views WHERE is_dirty = 1 ORDER BY modified_at ASC
      `),
      updateView: this.db.prepare(`
        UPDATE views SET
          name = ?, anchor_node_id = ?, selectors_json = ?, render_options_json = ?,
          is_dirty = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateViewName: this.db.prepare(`
        UPDATE views SET name = ?, is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateViewSelectors: this.db.prepare(`
        UPDATE views SET
          selectors_json = ?, is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateViewRenderOptions: this.db.prepare(`
        UPDATE views SET
          render_options_json = ?, is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      markViewClean: this.db.prepare(`
        UPDATE views SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      markViewDirty: this.db.prepare(`
        UPDATE views SET is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      deleteView: this.db.prepare(`
        DELETE FROM views WHERE id = ?
      `),

      // View component operations
      insertViewComponent: this.db.prepare(`
        INSERT OR REPLACE INTO view_components
        (view_id, snippet_id, order_index)
        VALUES (?, ?, ?)
      `),
      selectViewComponents: this.db.prepare(`
        SELECT * FROM view_components WHERE view_id = ? ORDER BY order_index ASC
      `),
      deleteViewComponents: this.db.prepare(`
        DELETE FROM view_components WHERE view_id = ?
      `),
      deleteViewComponent: this.db.prepare(`
        DELETE FROM view_components WHERE view_id = ? AND snippet_id = ?
      `),

      // Search operations
      searchViewsByName: this.db.prepare(`
        SELECT * FROM views WHERE name LIKE ? ORDER BY name ASC
      `),
      searchViewsBySelector: this.db.prepare(`
        SELECT * FROM views WHERE selectors_json LIKE ? ORDER BY name ASC
      `),

      // Statistics
      countViews: this.db.prepare(`
        SELECT COUNT(*) as count FROM views
      `),
      countViewsByAnchor: this.db.prepare(`
        SELECT anchor_node_id, COUNT(*) as count FROM views
        GROUP BY anchor_node_id
      `),
      countViewsByLang: this.db.prepare(`
        SELECT
          JSON_EXTRACT(render_options_json, '$.lang') as lang,
          COUNT(*) as count
        FROM views
        GROUP BY JSON_EXTRACT(render_options_json, '$.lang')
      `),
      avgComponentCount: this.db.prepare(`
        SELECT AVG(component_count) as avg_count FROM (
          SELECT view_id, COUNT(*) as component_count
          FROM view_components
          GROUP BY view_id
        )
      `),
      totalComponents: this.db.prepare(`
        SELECT COUNT(*) as count FROM view_components
      `),
      lastModifiedView: this.db.prepare(`
        SELECT MAX(modified_at) as last_modified FROM views
      `)
    };
  }

  /**
   * Create a new view
   */
  async createView(viewConfig: ViewConfig): Promise<string> {
    const viewId = PersistenceUtils.generateId();

    this.db.transaction(() => {
      // Insert view record
      this.statements.insertView.run(
        viewId,
        viewConfig.name,
        viewConfig.anchorNodeId || null,
        PersistenceUtils.safeStringify(viewConfig.selectors),
        PersistenceUtils.safeStringify(viewConfig.renderOptions),
        1 // newly created views are dirty
      );

      // Insert view components if provided
      if (viewConfig.components) {
        for (const component of viewConfig.components) {
          this.statements.insertViewComponent.run(
            viewId,
            component.snippetId,
            component.orderIndex
          );
        }
      }
    });

    return viewId;
  }

  /**
   * Get view by ID
   */
  async getView(viewId: string): Promise<SerializedView | null> {
    const viewRow = this.statements.selectView.get(viewId);
    if (!viewRow) return null;

    const componentRows = this.statements.selectViewComponents.all(viewId);
    const components = componentRows.map(row => ({
      snippet_id: row.snippet_id,
      order_index: row.order_index
    }));

    return this.rowToView(viewRow, components);
  }

  /**
   * Get view by name
   */
  async getViewByName(name: string): Promise<SerializedView | null> {
    const viewRow = this.statements.selectViewByName.get(name);
    if (!viewRow) return null;

    const componentRows = this.statements.selectViewComponents.all(viewRow.id);
    const components = componentRows.map(row => ({
      snippet_id: row.snippet_id,
      order_index: row.order_index
    }));

    return this.rowToView(viewRow, components);
  }

  /**
   * Get all views for an anchor node
   */
  async getViewsByAnchor(anchorNodeId: string): Promise<SerializedView[]> {
    const viewRows = this.statements.selectViewsByAnchor.all(anchorNodeId);

    const views: SerializedView[] = [];
    for (const viewRow of viewRows) {
      const componentRows = this.statements.selectViewComponents.all(viewRow.id);
      const components = componentRows.map(row => ({
        snippet_id: row.snippet_id,
        order_index: row.order_index
      }));
      views.push(this.rowToView(viewRow, components));
    }

    return views;
  }

  /**
   * Get all views
   */
  async getAllViews(): Promise<SerializedView[]> {
    const viewRows = this.statements.selectAllViews.all();

    const views: SerializedView[] = [];
    for (const viewRow of viewRows) {
      const componentRows = this.statements.selectViewComponents.all(viewRow.id);
      const components = componentRows.map(row => ({
        snippet_id: row.snippet_id,
        order_index: row.order_index
      }));
      views.push(this.rowToView(viewRow, components));
    }

    return views;
  }

  /**
   * Get dirty (modified) views
   */
  async getDirtyViews(): Promise<SerializedView[]> {
    const viewRows = this.statements.selectDirtyViews.all();

    const views: SerializedView[] = [];
    for (const viewRow of viewRows) {
      const componentRows = this.statements.selectViewComponents.all(viewRow.id);
      const components = componentRows.map(row => ({
        snippet_id: row.snippet_id,
        order_index: row.order_index
      }));
      views.push(this.rowToView(viewRow, components));
    }

    return views;
  }

  /**
   * Update entire view
   */
  async updateView(viewId: string, viewConfig: Partial<ViewConfig>): Promise<boolean> {
    const existingView = await this.getView(viewId);
    if (!existingView) return false;

    const updated = this.db.transaction(() => {
      // Update view record
      const result = this.statements.updateView.run(
        viewConfig.name ?? existingView.name,
        viewConfig.anchorNodeId ?? existingView.anchor_node_id,
        PersistenceUtils.safeStringify(viewConfig.selectors ?? existingView.selectors),
        PersistenceUtils.safeStringify(viewConfig.renderOptions ?? existingView.render_options),
        1, // mark dirty
        viewId
      );

      // Update components if provided
      if (viewConfig.components) {
        // Delete existing components
        this.statements.deleteViewComponents.run(viewId);

        // Insert new components
        for (const component of viewConfig.components) {
          this.statements.insertViewComponent.run(
            viewId,
            component.snippetId,
            component.orderIndex
          );
        }
      }

      return result.changes > 0;
    });

    return updated;
  }

  /**
   * Update view name
   */
  async updateViewName(viewId: string, name: string): Promise<boolean> {
    const result = this.statements.updateViewName.run(name, viewId);
    return result.changes > 0;
  }

  /**
   * Update view selectors
   */
  async updateViewSelectors(viewId: string, selectors: ViewSelector[]): Promise<boolean> {
    const result = this.statements.updateViewSelectors.run(
      PersistenceUtils.safeStringify(selectors),
      viewId
    );
    return result.changes > 0;
  }

  /**
   * Update view render options
   */
  async updateViewRenderOptions(viewId: string, renderOptions: ViewRenderOptions): Promise<boolean> {
    const result = this.statements.updateViewRenderOptions.run(
      PersistenceUtils.safeStringify(renderOptions),
      viewId
    );
    return result.changes > 0;
  }

  /**
   * Add component to view
   */
  async addViewComponent(viewId: string, component: ViewComponent): Promise<boolean> {
    try {
      this.statements.insertViewComponent.run(
        viewId,
        component.snippetId,
        component.orderIndex
      );
      this.statements.markViewDirty.run(viewId);
      return true;
    } catch (error) {
      console.warn(`[ViewPersistence] Failed to add component:`, error);
      return false;
    }
  }

  /**
   * Remove component from view
   */
  async removeViewComponent(viewId: string, snippetId: string): Promise<boolean> {
    const result = this.statements.deleteViewComponent.run(viewId, snippetId);
    if (result.changes > 0) {
      this.statements.markViewDirty.run(viewId);
      return true;
    }
    return false;
  }

  /**
   * Delete view
   */
  async deleteView(viewId: string): Promise<boolean> {
    const deleted = this.db.transaction(() => {
      // Delete components first (foreign key constraint)
      this.statements.deleteViewComponents.run(viewId);

      // Delete view
      const result = this.statements.deleteView.run(viewId);
      return result.changes > 0;
    });

    return deleted;
  }

  /**
   * Search views by name pattern
   */
  async searchViewsByName(namePattern: string): Promise<SerializedView[]> {
    const pattern = `%${namePattern}%`;
    const viewRows = this.statements.searchViewsByName.all(pattern);

    const views: SerializedView[] = [];
    for (const viewRow of viewRows) {
      const componentRows = this.statements.selectViewComponents.all(viewRow.id);
      const components = componentRows.map(row => ({
        snippet_id: row.snippet_id,
        order_index: row.order_index
      }));
      views.push(this.rowToView(viewRow, components));
    }

    return views;
  }

  /**
   * Search views by selector content
   */
  async searchViewsBySelector(selectorPattern: string): Promise<SerializedView[]> {
    const pattern = `%${selectorPattern}%`;
    const viewRows = this.statements.searchViewsBySelector.all(pattern);

    const views: SerializedView[] = [];
    for (const viewRow of viewRows) {
      const componentRows = this.statements.selectViewComponents.all(viewRow.id);
      const components = componentRows.map(row => ({
        snippet_id: row.snippet_id,
        order_index: row.order_index
      }));
      views.push(this.rowToView(viewRow, components));
    }

    return views;
  }

  /**
   * Mark view as clean (saved)
   */
  async markViewClean(viewId: string): Promise<boolean> {
    const result = this.statements.markViewClean.run(viewId);
    return result.changes > 0;
  }

  /**
   * Mark view as dirty (modified)
   */
  async markViewDirty(viewId: string): Promise<boolean> {
    const result = this.statements.markViewDirty.run(viewId);
    return result.changes > 0;
  }

  /**
   * Get view statistics
   */
  async getStatistics(): Promise<ViewStats> {
    const totalCount = this.statements.countViews.get()?.count || 0;
    const totalComponents = this.statements.totalComponents.get()?.count || 0;
    const avgComponentCount = this.statements.avgComponentCount.get()?.avg_count || 0;
    const lastModifiedRow = this.statements.lastModifiedView.get();

    // Get counts by anchor node
    const anchorRows = this.statements.countViewsByAnchor.all();
    const byAnchorNode: Record<string, number> = {};
    for (const row of anchorRows) {
      if (row.anchor_node_id) {
        byAnchorNode[row.anchor_node_id] = row.count;
      }
    }

    // Get counts by render language
    const langRows = this.statements.countViewsByLang.all();
    const byRenderLang: Record<string, number> = {};
    for (const row of langRows) {
      if (row.lang) {
        byRenderLang[row.lang] = row.count;
      }
    }

    return {
      totalCount,
      byAnchorNode,
      byRenderLang,
      averageComponentCount: Math.round(avgComponentCount),
      totalComponents,
      lastModified: lastModifiedRow?.last_modified ? new Date(lastModifiedRow.last_modified) : null
    };
  }

  /**
   * Synchronize views from FX groups to database
   */
  async syncFromFXGroups(): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    // This would analyze FX groups and sync them to database
    // Implementation would depend on how groups are represented in FX
    console.log("[ViewPersistence] Sync from FX groups - implementation pending");
    return { created: 0, updated: 0, deleted: 0 };
  }

  /**
   * Synchronize views from database to FX groups
   */
  async syncToFXGroups(): Promise<number> {
    const views = await this.getAllViews();
    let synchronized = 0;

    for (const view of views) {
      try {
        // Reconstruct FX group from view definition
        await this.reconstructFXGroup(view);
        synchronized++;
      } catch (error) {
        console.warn(`[ViewPersistence] Failed to sync view ${view.name}:`, error);
      }
    }

    return synchronized;
  }

  /**
   * Mark all dirty views as clean
   */
  async markAllClean(): Promise<number> {
    const cleanStmt = this.db.prepare(`
      UPDATE views SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
      WHERE is_dirty = 1
    `);

    const result = cleanStmt.run();
    cleanStmt.finalize();
    return result.changes;
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[ViewPersistence] Error finalizing statement:", error);
      }
    }
    this.statements = {};
  }

  // Private helper methods

  private rowToView(viewRow: any, components: Array<{snippet_id: string, order_index: number}>): SerializedView {
    return {
      id: viewRow.id,
      name: viewRow.name,
      anchor_node_id: viewRow.anchor_node_id,
      selectors: PersistenceUtils.safeParse(viewRow.selectors_json) || [],
      render_options: PersistenceUtils.safeParse(viewRow.render_options_json) || {},
      components: components
    };
  }

  private async reconstructFXGroup(view: SerializedView): Promise<void> {
    // Find anchor node
    let anchorNode = this.fx.root;
    if (view.anchor_node_id) {
      const found = this.findNodeById(view.anchor_node_id);
      if (found) anchorNode = found;
    }

    // Create group proxy
    const groupProxy = this.fx.createNodeProxy(anchorNode).group();

    // Apply selectors
    for (const selector of view.selectors) {
      if (selector.type === 'css') {
        if (selector.include) {
          groupProxy.include(selector.value);
        } else {
          groupProxy.exclude(selector.value);
        }
      } else if (selector.type === 'type') {
        groupProxy.select(selector.value);
      }
    }

    // Add manual components
    for (const component of view.components) {
      // Find snippet node by ID and add to group
      const snippetNode = this.findSnippetNodeBySnippetId(component.snippet_id);
      if (snippetNode) {
        groupProxy.add(snippetNode);
      }
    }

    // Store view name for reference
    (groupProxy as any)._viewName = view.name;
  }

  private findNodeById(nodeId: string): FXNode | null {
    const visited = new Set<string>();

    const traverse = (node: FXNode): FXNode | null => {
      if (visited.has(node.__id)) return null;
      visited.add(node.__id);

      if (node.__id === nodeId) return node;

      for (const childNode of Object.values(node.__nodes)) {
        const found = traverse(childNode);
        if (found) return found;
      }

      return null;
    };

    return traverse(this.fx.root);
  }

  private findSnippetNodeBySnippetId(snippetId: string): FXNode | null {
    const visited = new Set<string>();

    const traverse = (node: FXNode): FXNode | null => {
      if (visited.has(node.__id)) return null;
      visited.add(node.__id);

      const meta = (node as any).__meta;
      if (meta?.id === snippetId) return node;

      for (const childNode of Object.values(node.__nodes)) {
        const found = traverse(childNode);
        if (found) return found;
      }

      return null;
    };

    return traverse(this.fx.root);
  }
}

/**
 * Factory function to create view persistence instance
 */
export function createViewPersistence(db: SQLiteDatabase, fx: FXCore): ViewPersistence {
  return new ViewPersistence(db, fx);
}