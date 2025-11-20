/**
 * @file fx-snippet-persistence.ts
 * @description Snippet table and CRUD operations for SQLite persistence
 * Handles storage and retrieval of code snippets with metadata
 */

// @agent: agent-modules-persist
// @timestamp: 2025-10-02T07:00:00Z
// @task: TRACK-B-MODULES.md#B2.2
// @status: in_progress

import { $$, $_$$, fx, FXCore } from '../fxn.ts';
import type { FXNode } from '../fxn.ts';
import {
  SQLiteDatabase,
  SQLiteStatement,
  SerializedSnippet,
  PersistenceUtils
} from "./fx-persistence.ts";
import { isSnippet, Marker } from "./fx-snippets.ts";

/**
 * Snippet search criteria
 */
export interface SnippetSearchCriteria {
  snippetId?: string;
  nodeId?: string;
  lang?: string;
  filePath?: string;
  orderIndex?: number;
  isDirty?: boolean;
  createdAfter?: Date;
  modifiedAfter?: Date;
  contentContains?: string;
}

/**
 * Snippet update data
 */
export interface SnippetUpdateData {
  body?: string;
  lang?: string;
  filePath?: string;
  orderIndex?: number;
  version?: number;
}

/**
 * Snippet statistics
 */
export interface SnippetStats {
  totalCount: number;
  byLanguage: Record<string, number>;
  byNode: Record<string, number>;
  averageSize: number;
  totalSize: number;
  lastModified: Date | null;
}

/**
 * Snippet persistence manager
 * Provides CRUD operations for snippets in SQLite database
 */
export class SnippetPersistence {
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
      // Insert/Update operations
      insertSnippet: this.db.prepare(`
        INSERT OR REPLACE INTO snippets
        (id, node_id, snippet_id, body, lang, file_path, order_index, version, checksum, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      // Select operations
      selectBySnippetId: this.db.prepare(`
        SELECT * FROM snippets WHERE snippet_id = ?
      `),
      selectByNodeId: this.db.prepare(`
        SELECT * FROM snippets WHERE node_id = ? ORDER BY order_index ASC
      `),
      selectByLang: this.db.prepare(`
        SELECT * FROM snippets WHERE lang = ? ORDER BY created_at DESC
      `),
      selectAll: this.db.prepare(`
        SELECT * FROM snippets ORDER BY created_at DESC
      `),
      selectDirty: this.db.prepare(`
        SELECT * FROM snippets WHERE is_dirty = 1 ORDER BY modified_at ASC
      `),

      // Update operations
      updateSnippet: this.db.prepare(`
        UPDATE snippets SET
          body = ?, lang = ?, file_path = ?, order_index = ?, version = ?,
          checksum = ?, is_dirty = ?, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id = ?
      `),
      updateBody: this.db.prepare(`
        UPDATE snippets SET
          body = ?, checksum = ?, is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id = ?
      `),
      updateMetadata: this.db.prepare(`
        UPDATE snippets SET
          lang = ?, file_path = ?, order_index = ?, version = ?,
          is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id = ?
      `),
      markClean: this.db.prepare(`
        UPDATE snippets SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id = ?
      `),
      markDirty: this.db.prepare(`
        UPDATE snippets SET is_dirty = 1, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id = ?
      `),

      // Delete operations
      deleteBySnippetId: this.db.prepare(`
        DELETE FROM snippets WHERE snippet_id = ?
      `),
      deleteByNodeId: this.db.prepare(`
        DELETE FROM snippets WHERE node_id = ?
      `),

      // Search and statistics
      searchContent: this.db.prepare(`
        SELECT * FROM snippets WHERE body LIKE ? ORDER BY modified_at DESC
      `),
      countTotal: this.db.prepare(`
        SELECT COUNT(*) as count FROM snippets
      `),
      countByLang: this.db.prepare(`
        SELECT lang, COUNT(*) as count FROM snippets GROUP BY lang
      `),
      countByNode: this.db.prepare(`
        SELECT node_id, COUNT(*) as count FROM snippets GROUP BY node_id
      `),
      totalSize: this.db.prepare(`
        SELECT SUM(LENGTH(body)) as total_size FROM snippets
      `),
      averageSize: this.db.prepare(`
        SELECT AVG(LENGTH(body)) as avg_size FROM snippets
      `),
      lastModified: this.db.prepare(`
        SELECT MAX(modified_at) as last_modified FROM snippets
      `)
    };
  }

  /**
   * Create a new snippet in the database
   */
  async createSnippet(nodeId: string, snippetData: {
    snippetId: string;
    body: string;
    lang?: string;
    filePath?: string;
    orderIndex?: number;
    version?: number;
  }): Promise<void> {
    const id = PersistenceUtils.generateId();
    const checksum = PersistenceUtils.checksumSnippet(snippetData.body, {
      lang: snippetData.lang,
      filePath: snippetData.filePath
    });

    this.statements.insertSnippet.run(
      id,
      nodeId,
      snippetData.snippetId,
      snippetData.body,
      snippetData.lang || 'js',
      snippetData.filePath || null,
      snippetData.orderIndex || 0,
      snippetData.version || 1,
      checksum,
      1 // newly created snippets are dirty
    );
  }

  /**
   * Get snippet by snippet ID
   */
  async getSnippet(snippetId: string): Promise<SerializedSnippet | null> {
    const row = this.statements.selectBySnippetId.get(snippetId);
    return row ? this.rowToSnippet(row) : null;
  }

  /**
   * Get all snippets for a node
   */
  async getNodeSnippets(nodeId: string): Promise<SerializedSnippet[]> {
    const rows = this.statements.selectByNodeId.all(nodeId);
    return rows.map(row => this.rowToSnippet(row));
  }

  /**
   * Get snippets by language
   */
  async getSnippetsByLanguage(lang: string): Promise<SerializedSnippet[]> {
    const rows = this.statements.selectByLang.all(lang);
    return rows.map(row => this.rowToSnippet(row));
  }

  /**
   * Get all snippets
   */
  async getAllSnippets(): Promise<SerializedSnippet[]> {
    const rows = this.statements.selectAll.all();
    return rows.map(row => this.rowToSnippet(row));
  }

  /**
   * Get dirty (modified) snippets
   */
  async getDirtySnippets(): Promise<SerializedSnippet[]> {
    const rows = this.statements.selectDirty.all();
    return rows.map(row => this.rowToSnippet(row));
  }

  /**
   * Update snippet content
   */
  async updateSnippetBody(snippetId: string, body: string): Promise<boolean> {
    const checksum = PersistenceUtils.checksumSnippet(body);
    const result = this.statements.updateBody.run(body, checksum, snippetId);
    return result.changes > 0;
  }

  /**
   * Update snippet metadata
   */
  async updateSnippetMetadata(snippetId: string, metadata: {
    lang?: string;
    filePath?: string;
    orderIndex?: number;
    version?: number;
  }): Promise<boolean> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return false;

    const result = this.statements.updateMetadata.run(
      metadata.lang ?? snippet.lang,
      metadata.filePath ?? snippet.file_path,
      metadata.orderIndex ?? snippet.order_index,
      metadata.version ?? snippet.version,
      snippetId
    );

    return result.changes > 0;
  }

  /**
   * Update entire snippet
   */
  async updateSnippet(snippetId: string, updateData: SnippetUpdateData): Promise<boolean> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return false;

    const body = updateData.body ?? snippet.body;
    const checksum = PersistenceUtils.checksumSnippet(body, updateData);

    const result = this.statements.updateSnippet.run(
      body,
      updateData.lang ?? snippet.lang,
      updateData.filePath ?? snippet.file_path,
      updateData.orderIndex ?? snippet.order_index,
      updateData.version ?? snippet.version,
      checksum,
      1, // mark as dirty
      snippetId
    );

    return result.changes > 0;
  }

  /**
   * Delete snippet by ID
   */
  async deleteSnippet(snippetId: string): Promise<boolean> {
    const result = this.statements.deleteBySnippetId.run(snippetId);
    return result.changes > 0;
  }

  /**
   * Delete all snippets for a node
   */
  async deleteNodeSnippets(nodeId: string): Promise<number> {
    const result = this.statements.deleteByNodeId.run(nodeId);
    return result.changes;
  }

  /**
   * Search snippets by content
   */
  async searchSnippets(searchText: string): Promise<SerializedSnippet[]> {
    const pattern = `%${searchText}%`;
    const rows = this.statements.searchContent.all(pattern);
    return rows.map(row => this.rowToSnippet(row));
  }

  /**
   * Mark snippet as clean (saved)
   */
  async markSnippetClean(snippetId: string): Promise<boolean> {
    const result = this.statements.markClean.run(snippetId);
    return result.changes > 0;
  }

  /**
   * Mark snippet as dirty (modified)
   */
  async markSnippetDirty(snippetId: string): Promise<boolean> {
    const result = this.statements.markDirty.run(snippetId);
    return result.changes > 0;
  }

  /**
   * Get snippet statistics
   */
  async getStatistics(): Promise<SnippetStats> {
    const totalCount = this.statements.countTotal.get()?.count || 0;
    const totalSize = this.statements.totalSize.get()?.total_size || 0;
    const averageSize = this.statements.averageSize.get()?.avg_size || 0;
    const lastModifiedRow = this.statements.lastModified.get();

    // Get counts by language
    const langRows = this.statements.countByLang.all();
    const byLanguage: Record<string, number> = {};
    for (const row of langRows) {
      byLanguage[row.lang] = row.count;
    }

    // Get counts by node
    const nodeRows = this.statements.countByNode.all();
    const byNode: Record<string, number> = {};
    for (const row of nodeRows) {
      byNode[row.node_id] = row.count;
    }

    return {
      totalCount,
      byLanguage,
      byNode,
      averageSize: Math.round(averageSize),
      totalSize,
      lastModified: lastModifiedRow?.last_modified ? new Date(lastModifiedRow.last_modified) : null
    };
  }

  /**
   * Batch operations for performance
   */
  async batchCreateSnippets(snippets: Array<{
    nodeId: string;
    snippetData: {
      snippetId: string;
      body: string;
      lang?: string;
      filePath?: string;
      orderIndex?: number;
      version?: number;
    };
  }>): Promise<void> {
    this.db.transaction(() => {
      for (const { nodeId, snippetData } of snippets) {
        const id = PersistenceUtils.generateId();
        const checksum = PersistenceUtils.checksumSnippet(snippetData.body, {
          lang: snippetData.lang,
          filePath: snippetData.filePath
        });

        this.statements.insertSnippet.run(
          id,
          nodeId,
          snippetData.snippetId,
          snippetData.body,
          snippetData.lang || 'js',
          snippetData.filePath || null,
          snippetData.orderIndex || 0,
          snippetData.version || 1,
          checksum,
          1
        );
      }
    });
  }

  /**
   * Mark all dirty snippets as clean
   */
  async markAllClean(): Promise<number> {
    const cleanStmt = this.db.prepare(`
      UPDATE snippets SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
      WHERE is_dirty = 1
    `);

    const result = cleanStmt.run();
    cleanStmt.finalize();
    return result.changes;
  }

  /**
   * Synchronize snippets from FX nodes to database
   */
  async syncFromFXNodes(): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Get all snippet nodes from FX
    const snippetNodes = this.findAllSnippetNodes();

    // Get all snippets from database
    const dbSnippets = await this.getAllSnippets();
    const dbSnippetMap = new Map(dbSnippets.map(s => [s.snippet_id, s]));

    this.db.transaction(() => {
      // Process FX snippet nodes
      for (const node of snippetNodes) {
        const nodeProxy = this.fx.createNodeProxy(node);
        const meta: any = (node as any).__meta || {};
        const snippetId = meta.id;

        if (!snippetId) continue;

        const body: string = String(nodeProxy.val() || '');
        const existingSnippet = dbSnippetMap.get(snippetId);

        if (existingSnippet) {
          // Check if update needed
          const currentChecksum = PersistenceUtils.checksumSnippet(body, meta as any);
          if (currentChecksum !== existingSnippet.checksum) {
            this.statements.updateSnippet.run(
              body,
              meta.lang || existingSnippet.lang,
              meta.file || existingSnippet.file_path,
              meta.order || existingSnippet.order_index,
              meta.version || existingSnippet.version,
              currentChecksum,
              1, // mark dirty
              snippetId
            );
            updated++;
          }
          dbSnippetMap.delete(snippetId); // Remove from deletion candidates
        } else {
          // Create new snippet
          const id = PersistenceUtils.generateId();
          const checksum = PersistenceUtils.checksumSnippet(body, meta as any);

          this.statements.insertSnippet.run(
            id,
            node.__id,
            snippetId,
            body,
            meta.lang || 'js',
            meta.file || null,
            meta.order || 0,
            meta.version || 1,
            checksum,
            1
          );
          created++;
        }
      }

      // Delete snippets that no longer exist in FX
      for (const snippetId of dbSnippetMap.keys()) {
        this.statements.deleteBySnippetId.run(snippetId);
        deleted++;
      }
    });

    return { created, updated, deleted };
  }

  /**
   * Synchronize snippets from database to FX nodes
   */
  async syncToFXNodes(): Promise<number> {
    const snippets = await this.getAllSnippets();
    let synchronized = 0;

    for (const snippet of snippets) {
      try {
        // Find or create the node
        let node = this.findNodeById(snippet.node_id);
        if (!node) {
          // Create node if it doesn't exist
          node = this.fx.createNode(null);
          node.__id = snippet.node_id;
        }

        // Set snippet data
        const nodeProxy = this.fx.createNodeProxy(node);
        nodeProxy.val(snippet.body);

        // Set type and metadata
        node.__type = "snippet";
        (node as any).__meta = {
          id: snippet.snippet_id,
          lang: snippet.lang,
          file: snippet.file_path,
          order: snippet.order_index,
          version: snippet.version
        };

        synchronized++;
      } catch (error) {
        console.warn(`[SnippetPersistence] Failed to sync snippet ${snippet.snippet_id}:`, error);
      }
    }

    return synchronized;
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[SnippetPersistence] Error finalizing statement:", error);
      }
    }
    this.statements = {};
  }

  // Private helper methods

  private rowToSnippet(row: any): SerializedSnippet {
    return {
      id: row.id,
      node_id: row.node_id,
      snippet_id: row.snippet_id,
      body: row.body,
      lang: row.lang,
      file_path: row.file_path,
      order_index: row.order_index,
      version: row.version,
      checksum: row.checksum
    };
  }

  private findAllSnippetNodes(): FXNode[] {
    const snippetNodes: FXNode[] = [];
    const visited = new Set<string>();

    const traverse = (node: FXNode) => {
      if (visited.has(node.__id)) return;
      visited.add(node.__id);

      if (isSnippet(node)) {
        snippetNodes.push(node);
      }

      for (const childNode of Object.values(node.__nodes)) {
        traverse(childNode);
      }
    };

    traverse(this.fx.root);
    return snippetNodes;
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
}

/**
 * Factory function to create snippet persistence instance
 */
export function createSnippetPersistence(db: SQLiteDatabase, fx: FXCore): SnippetPersistence {
  return new SnippetPersistence(db, fx);
}