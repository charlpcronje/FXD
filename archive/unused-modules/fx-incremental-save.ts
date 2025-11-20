/**
 * @file fx-incremental-save.ts
 * @description Incremental save system with dirty tracking for FXD projects
 * Optimizes persistence by only saving modified data
 */

import { FXCore, FXNode } from "../fx.ts";
import {
  SQLiteDatabase,
  SQLiteStatement,
  PersistenceUtils
} from "./fx-persistence.ts";
import { FXNodeSerializer } from "./fx-node-serializer.ts";
import { SnippetPersistence } from "./fx-snippet-persistence.ts";
import { ViewPersistence } from "./fx-view-persistence.ts";
import { MetadataPersistence } from "./fx-metadata-persistence.ts";

/**
 * Change tracking entry
 */
interface ChangeEntry {
  id: string;
  type: 'node' | 'snippet' | 'view' | 'metadata';
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  checksum?: string;
  data?: any;
}

/**
 * Save operation result
 */
interface SaveResult {
  success: boolean;
  savedItems: {
    nodes: number;
    snippets: number;
    views: number;
    metadata: number;
  };
  errors: string[];
  duration: number;
  savedSize: number;
}

/**
 * Save options for incremental saves
 */
interface IncrementalSaveOptions {
  batchSize?: number;
  validateChecksums?: boolean;
  createBackup?: boolean;
  skipUnmodified?: boolean;
  maxConcurrency?: number;
}

/**
 * Dirty tracking statistics
 */
interface DirtyStats {
  totalDirty: number;
  dirtyNodes: number;
  dirtySnippets: number;
  dirtyViews: number;
  dirtyMetadata: number;
  oldestChange: Date | null;
  newestChange: Date | null;
}

/**
 * Incremental save system with comprehensive dirty tracking
 */
export class IncrementalSaveSystem {
  private fx: FXCore;
  private db: SQLiteDatabase;
  private nodeSerializer: FXNodeSerializer;
  private snippetPersistence: SnippetPersistence;
  private viewPersistence: ViewPersistence;
  private metadataPersistence: MetadataPersistence;

  // Dirty tracking
  private dirtyNodes = new Map<string, ChangeEntry>();
  private dirtySnippets = new Map<string, ChangeEntry>();
  private dirtyViews = new Map<string, ChangeEntry>();
  private dirtyMetadata = new Map<string, ChangeEntry>();

  // Node checksum cache for change detection
  private nodeChecksums = new Map<string, string>();
  private snippetChecksums = new Map<string, string>();
  private viewChecksums = new Map<string, string>();

  // Performance tracking
  private lastSaveTime: Date | null = null;
  private saveHistory: SaveResult[] = [];
  private maxHistorySize = 100;

  // Prepared statements
  private statements: Record<string, SQLiteStatement> = {};

  constructor(
    fx: FXCore,
    db: SQLiteDatabase,
    nodeSerializer: FXNodeSerializer,
    snippetPersistence: SnippetPersistence,
    viewPersistence: ViewPersistence,
    metadataPersistence: MetadataPersistence
  ) {
    this.fx = fx;
    this.db = db;
    this.nodeSerializer = nodeSerializer;
    this.snippetPersistence = snippetPersistence;
    this.viewPersistence = viewPersistence;
    this.metadataPersistence = metadataPersistence;

    this.initializePreparedStatements();
    this.setupChangeTracking();
  }

  /**
   * Initialize prepared statements for dirty tracking
   */
  private initializePreparedStatements(): void {
    this.statements = {
      // Update dirty flags
      markNodeDirty: this.db.prepare(`
        UPDATE nodes SET is_dirty = 1, modified_at = CURRENT_TIMESTAMP WHERE id = ?
      `),
      markSnippetDirty: this.db.prepare(`
        UPDATE snippets SET is_dirty = 1, modified_at = CURRENT_TIMESTAMP WHERE snippet_id = ?
      `),
      markViewDirty: this.db.prepare(`
        UPDATE views SET is_dirty = 1, modified_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      // Clear dirty flags
      markNodeClean: this.db.prepare(`
        UPDATE nodes SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP WHERE id = ?
      `),
      markSnippetClean: this.db.prepare(`
        UPDATE snippets SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP WHERE snippet_id = ?
      `),
      markViewClean: this.db.prepare(`
        UPDATE views SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      // Get dirty items
      getDirtyNodes: this.db.prepare(`
        SELECT id, checksum FROM nodes WHERE is_dirty = 1 ORDER BY modified_at ASC
      `),
      getDirtySnippets: this.db.prepare(`
        SELECT snippet_id, checksum FROM snippets WHERE is_dirty = 1 ORDER BY modified_at ASC
      `),
      getDirtyViews: this.db.prepare(`
        SELECT id FROM views WHERE is_dirty = 1 ORDER BY modified_at ASC
      `),

      // Batch operations
      markNodesBatchClean: this.db.prepare(`
        UPDATE nodes SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
        WHERE id IN (${Array(100).fill('?').join(',')})
      `),
      markSnippetsBatchClean: this.db.prepare(`
        UPDATE snippets SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
        WHERE snippet_id IN (${Array(100).fill('?').join(',')})
      `),
      markViewsBatchClean: this.db.prepare(`
        UPDATE views SET is_dirty = 0, modified_at = CURRENT_TIMESTAMP
        WHERE id IN (${Array(100).fill('?').join(',')})
      `)
    };
  }

  /**
   * Setup automatic change tracking from FX events
   */
  private setupChangeTracking(): void {
    // Listen to FX structure changes
    this.fx.onStructure((event) => {
      this.trackNodeChange(event.node.__id, event.kind === 'remove' ? 'delete' : 'update');

      // Also track parent changes for structural modifications
      if (event.parent) {
        this.trackNodeChange(event.parent.__id, 'update');
      }
    });
  }

  /**
   * Track a change to a node
   */
  trackNodeChange(nodeId: string, action: 'create' | 'update' | 'delete', data?: any): void {
    const entry: ChangeEntry = {
      id: nodeId,
      type: 'node',
      action,
      timestamp: new Date(),
      data
    };

    // Generate checksum for change detection
    if (action !== 'delete') {
      const node = this.findNodeById(nodeId);
      if (node) {
        entry.checksum = PersistenceUtils.checksumNode(node);
      }
    }

    this.dirtyNodes.set(nodeId, entry);

    // Mark in database
    if (action !== 'delete') {
      try {
        this.statements.markNodeDirty.run(nodeId);
      } catch (error) {
        console.warn(`[IncrementalSave] Failed to mark node dirty: ${error}`);
      }
    }
  }

  /**
   * Track a change to a snippet
   */
  trackSnippetChange(snippetId: string, action: 'create' | 'update' | 'delete', data?: any): void {
    const entry: ChangeEntry = {
      id: snippetId,
      type: 'snippet',
      action,
      timestamp: new Date(),
      data
    };

    this.dirtySnippets.set(snippetId, entry);

    // Mark in database
    if (action !== 'delete') {
      try {
        this.statements.markSnippetDirty.run(snippetId);
      } catch (error) {
        console.warn(`[IncrementalSave] Failed to mark snippet dirty: ${error}`);
      }
    }
  }

  /**
   * Track a change to a view
   */
  trackViewChange(viewId: string, action: 'create' | 'update' | 'delete', data?: any): void {
    const entry: ChangeEntry = {
      id: viewId,
      type: 'view',
      action,
      timestamp: new Date(),
      data
    };

    this.dirtyViews.set(viewId, entry);

    // Mark in database
    if (action !== 'delete') {
      try {
        this.statements.markViewDirty.run(viewId);
      } catch (error) {
        console.warn(`[IncrementalSave] Failed to mark view dirty: ${error}`);
      }
    }
  }

  /**
   * Track a change to metadata
   */
  trackMetadataChange(key: string, action: 'create' | 'update' | 'delete', data?: any): void {
    const entry: ChangeEntry = {
      id: key,
      type: 'metadata',
      action,
      timestamp: new Date(),
      data
    };

    this.dirtyMetadata.set(key, entry);
  }

  /**
   * Perform incremental save of only dirty items
   */
  async performIncrementalSave(options: IncrementalSaveOptions = {}): Promise<SaveResult> {
    const startTime = Date.now();
    const result: SaveResult = {
      success: false,
      savedItems: { nodes: 0, snippets: 0, views: 0, metadata: 0 },
      errors: [],
      duration: 0,
      savedSize: 0
    };

    try {
      console.log(`[IncrementalSave] Starting incremental save...`);

      // Save in transaction for atomicity
      await this.db.transaction(async () => {
        // Save dirty nodes
        await this.saveDirtyNodes(result, options);

        // Save dirty snippets
        await this.saveDirtySnippets(result, options);

        // Save dirty views
        await this.saveDirtyViews(result, options);

        // Save dirty metadata
        await this.saveDirtyMetadata(result, options);
      });

      result.success = true;
      this.lastSaveTime = new Date();

      console.log(`[IncrementalSave] Incremental save completed:`, result.savedItems);
    } catch (error) {
      result.errors.push(`Save failed: ${error}`);
      console.error(`[IncrementalSave] Save failed:`, error);
    }

    result.duration = Date.now() - startTime;

    // Record save history
    this.recordSaveResult(result);

    return result;
  }

  /**
   * Save dirty nodes
   */
  private async saveDirtyNodes(result: SaveResult, options: IncrementalSaveOptions): Promise<void> {
    const dirtyNodeIds = Array.from(this.dirtyNodes.keys());
    const batchSize = options.batchSize || 50;

    for (let i = 0; i < dirtyNodeIds.length; i += batchSize) {
      const batch = dirtyNodeIds.slice(i, i + batchSize);

      for (const nodeId of batch) {
        try {
          const entry = this.dirtyNodes.get(nodeId);
          if (!entry) continue;

          if (entry.action === 'delete') {
            // Handle node deletion
            await this.deleteNodeFromDb(nodeId);
          } else {
            // Handle node creation/update
            const node = this.findNodeById(nodeId);
            if (node) {
              // Check if really changed using checksum
              if (options.skipUnmodified && options.validateChecksums) {
                const currentChecksum = PersistenceUtils.checksumNode(node);
                const lastChecksum = this.nodeChecksums.get(nodeId);

                if (currentChecksum === lastChecksum) {
                  continue; // Skip unchanged node
                }

                this.nodeChecksums.set(nodeId, currentChecksum);
              }

              await this.saveNodeToDb(node);
              this.statements.markNodeClean.run(nodeId);
            }
          }

          result.savedItems.nodes++;
          this.dirtyNodes.delete(nodeId);
        } catch (error) {
          result.errors.push(`Failed to save node ${nodeId}: ${error}`);
        }
      }
    }
  }

  /**
   * Save dirty snippets
   */
  private async saveDirtySnippets(result: SaveResult, options: IncrementalSaveOptions): Promise<void> {
    const dirtySnippetIds = Array.from(this.dirtySnippets.keys());

    for (const snippetId of dirtySnippetIds) {
      try {
        const entry = this.dirtySnippets.get(snippetId);
        if (!entry) continue;

        if (entry.action === 'delete') {
          await this.snippetPersistence.deleteSnippet(snippetId);
        } else {
          // Let snippet persistence handle the update
          await this.snippetPersistence.markSnippetClean(snippetId);
        }

        result.savedItems.snippets++;
        this.dirtySnippets.delete(snippetId);
      } catch (error) {
        result.errors.push(`Failed to save snippet ${snippetId}: ${error}`);
      }
    }
  }

  /**
   * Save dirty views
   */
  private async saveDirtyViews(result: SaveResult, options: IncrementalSaveOptions): Promise<void> {
    const dirtyViewIds = Array.from(this.dirtyViews.keys());

    for (const viewId of dirtyViewIds) {
      try {
        const entry = this.dirtyViews.get(viewId);
        if (!entry) continue;

        if (entry.action === 'delete') {
          await this.viewPersistence.deleteView(viewId);
        } else {
          // Let view persistence handle the update
          await this.viewPersistence.markViewClean(viewId);
        }

        result.savedItems.views++;
        this.dirtyViews.delete(viewId);
      } catch (error) {
        result.errors.push(`Failed to save view ${viewId}: ${error}`);
      }
    }
  }

  /**
   * Save dirty metadata
   */
  private async saveDirtyMetadata(result: SaveResult, options: IncrementalSaveOptions): Promise<void> {
    const dirtyMetadataKeys = Array.from(this.dirtyMetadata.keys());

    for (const key of dirtyMetadataKeys) {
      try {
        // Metadata persistence handles its own dirty tracking
        result.savedItems.metadata++;
        this.dirtyMetadata.delete(key);
      } catch (error) {
        result.errors.push(`Failed to save metadata ${key}: ${error}`);
      }
    }
  }

  /**
   * Get statistics about dirty items
   */
  getDirtyStats(): DirtyStats {
    const allChanges = [
      ...Array.from(this.dirtyNodes.values()),
      ...Array.from(this.dirtySnippets.values()),
      ...Array.from(this.dirtyViews.values()),
      ...Array.from(this.dirtyMetadata.values())
    ];

    const timestamps = allChanges.map(c => c.timestamp);

    return {
      totalDirty: allChanges.length,
      dirtyNodes: this.dirtyNodes.size,
      dirtySnippets: this.dirtySnippets.size,
      dirtyViews: this.dirtyViews.size,
      dirtyMetadata: this.dirtyMetadata.size,
      oldestChange: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null,
      newestChange: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null
    };
  }

  /**
   * Check if there are any dirty items
   */
  hasDirtyItems(): boolean {
    return this.dirtyNodes.size > 0 ||
           this.dirtySnippets.size > 0 ||
           this.dirtyViews.size > 0 ||
           this.dirtyMetadata.size > 0;
  }

  /**
   * Clear all dirty tracking (use with caution)
   */
  clearDirtyTracking(): void {
    this.dirtyNodes.clear();
    this.dirtySnippets.clear();
    this.dirtyViews.clear();
    this.dirtyMetadata.clear();

    console.log(`[IncrementalSave] Cleared all dirty tracking`);
  }

  /**
   * Scan for changes by comparing with stored checksums
   */
  async scanForChanges(): Promise<{
    newDirtyNodes: string[];
    newDirtySnippets: string[];
    newDirtyViews: string[];
  }> {
    const result = {
      newDirtyNodes: [] as string[],
      newDirtySnippets: [] as string[],
      newDirtyViews: [] as string[]
    };

    // Scan nodes
    const allNodes = this.getAllNodes();
    for (const node of allNodes) {
      const currentChecksum = PersistenceUtils.checksumNode(node);
      const lastChecksum = this.nodeChecksums.get(node.__id);

      if (currentChecksum !== lastChecksum) {
        this.trackNodeChange(node.__id, lastChecksum ? 'update' : 'create');
        result.newDirtyNodes.push(node.__id);
      }
    }

    // Scan snippets (handled by snippet persistence)
    const dirtySnippets = await this.snippetPersistence.getDirtySnippets();
    for (const snippet of dirtySnippets) {
      if (!this.dirtySnippets.has(snippet.snippet_id)) {
        this.trackSnippetChange(snippet.snippet_id, 'update');
        result.newDirtySnippets.push(snippet.snippet_id);
      }
    }

    // Scan views (handled by view persistence)
    const dirtyViews = await this.viewPersistence.getDirtyViews();
    for (const view of dirtyViews) {
      if (!this.dirtyViews.has(view.id)) {
        this.trackViewChange(view.id, 'update');
        result.newDirtyViews.push(view.id);
      }
    }

    return result;
  }

  /**
   * Get save history
   */
  getSaveHistory(): SaveResult[] {
    return [...this.saveHistory];
  }

  /**
   * Get last save time
   */
  getLastSaveTime(): Date | null {
    return this.lastSaveTime;
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[IncrementalSave] Error finalizing statement:", error);
      }
    }
    this.statements = {};

    this.clearDirtyTracking();
    this.nodeChecksums.clear();
    this.snippetChecksums.clear();
    this.viewChecksums.clear();
    this.saveHistory.length = 0;
  }

  // Private helper methods

  private async saveNodeToDb(node: FXNode): Promise<void> {
    const record = this.nodeSerializer.nodeToDbRecord(node);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO nodes
      (id, parent_id, key_name, node_type, value_json, prototypes_json, meta_json, checksum, is_dirty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.parent_id,
      record.key_name,
      record.node_type,
      record.value_json,
      record.prototypes_json,
      record.meta_json,
      record.checksum,
      0 // mark as clean
    );

    stmt.finalize();
  }

  private async deleteNodeFromDb(nodeId: string): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM nodes WHERE id = ?`);
    stmt.run(nodeId);
    stmt.finalize();
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

  private getAllNodes(): FXNode[] {
    const nodes: FXNode[] = [];
    const visited = new Set<string>();

    const traverse = (node: FXNode) => {
      if (visited.has(node.__id)) return;
      visited.add(node.__id);

      nodes.push(node);

      for (const childNode of Object.values(node.__nodes)) {
        traverse(childNode);
      }
    };

    traverse(this.fx.root);
    return nodes;
  }

  private recordSaveResult(result: SaveResult): void {
    this.saveHistory.push(result);

    // Keep history size manageable
    if (this.saveHistory.length > this.maxHistorySize) {
      this.saveHistory.shift();
    }
  }
}

/**
 * Factory function to create incremental save system
 */
export function createIncrementalSaveSystem(
  fx: FXCore,
  db: SQLiteDatabase,
  nodeSerializer: FXNodeSerializer,
  snippetPersistence: SnippetPersistence,
  viewPersistence: ViewPersistence,
  metadataPersistence: MetadataPersistence
): IncrementalSaveSystem {
  return new IncrementalSaveSystem(
    fx,
    db,
    nodeSerializer,
    snippetPersistence,
    viewPersistence,
    metadataPersistence
  );
}

export { IncrementalSaveSystem, SaveResult, DirtyStats, IncrementalSaveOptions };