/**
 * @file auto-save.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description Auto-save functionality for FXD persistence layer
 * Provides automatic periodic saves, dirty tracking, and incremental persistence
 */

import { SQLiteDatabase } from './db-connection.ts';
import { NodeCRUD, SnippetCRUD, ViewCRUD } from './crud-operations.ts';
import { TransactionManager } from './transaction-manager.ts';

/**
 * Auto-save configuration
 */
export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // milliseconds
  batchSize: number; // max items to save per batch
  onSave?: (stats: SaveStats) => void;
  onError?: (error: Error) => void;
  strategy: 'time' | 'count' | 'hybrid';
  countThreshold?: number; // trigger save after N dirty items
}

/**
 * Save statistics
 */
export interface SaveStats {
  timestamp: Date;
  nodesSaved: number;
  snippetsSaved: number;
  viewsSaved: number;
  totalSaved: number;
  duration: number;
  errors: Error[];
}

/**
 * Dirty item tracker
 */
export interface DirtyItem {
  type: 'node' | 'snippet' | 'view';
  id: string;
  markedAt: Date;
  attempts: number;
}

/**
 * Auto-save manager
 */
export class AutoSaveManager {
  private config: AutoSaveConfig;
  private timer: NodeJS.Timeout | null = null;
  private dirtyItems: Map<string, DirtyItem> = new Map();
  private isRunning = false;
  private isSaving = false;
  private saveHistory: SaveStats[] = [];
  private maxHistorySize = 100;

  constructor(
    private db: SQLiteDatabase,
    private nodeCRUD: NodeCRUD,
    private snippetCRUD: SnippetCRUD,
    private viewCRUD: ViewCRUD,
    private transactionManager: TransactionManager,
    config: Partial<AutoSaveConfig> = {}
  ) {
    this.config = {
      enabled: true,
      interval: 5000, // 5 seconds default
      batchSize: 100,
      strategy: 'hybrid',
      countThreshold: 50,
      ...config
    };
  }

  /**
   * Start auto-save
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[AutoSave] Already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextSave();
    console.log(`[AutoSave] Started (interval: ${this.config.interval}ms, strategy: ${this.config.strategy})`);
  }

  /**
   * Stop auto-save
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[AutoSave] Not running');
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isRunning = false;
    console.log('[AutoSave] Stopped');
  }

  /**
   * Mark an item as dirty
   */
  markDirty(type: 'node' | 'snippet' | 'view', id: string): void {
    const key = `${type}:${id}`;

    if (this.dirtyItems.has(key)) {
      // Already marked, just update timestamp
      const item = this.dirtyItems.get(key)!;
      item.markedAt = new Date();
    } else {
      this.dirtyItems.set(key, {
        type,
        id,
        markedAt: new Date(),
        attempts: 0
      });
    }

    // Check if we should trigger immediate save based on strategy
    if (this.shouldTriggerImmediateSave()) {
      this.performSave().catch(error => {
        console.error('[AutoSave] Immediate save failed:', error);
        if (this.config.onError) {
          this.config.onError(error);
        }
      });
    }
  }

  /**
   * Clear dirty flag for an item
   */
  clearDirty(type: 'node' | 'snippet' | 'view', id: string): void {
    const key = `${type}:${id}`;
    this.dirtyItems.delete(key);
  }

  /**
   * Check if should trigger immediate save
   */
  private shouldTriggerImmediateSave(): boolean {
    if (!this.config.enabled || this.isSaving) {
      return false;
    }

    switch (this.config.strategy) {
      case 'count':
        return this.dirtyItems.size >= (this.config.countThreshold || 50);

      case 'hybrid':
        return this.dirtyItems.size >= (this.config.countThreshold || 50);

      case 'time':
      default:
        return false;
    }
  }

  /**
   * Schedule next save
   */
  private scheduleNextSave(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(() => {
      this.performSave()
        .catch(error => {
          console.error('[AutoSave] Save failed:', error);
          if (this.config.onError) {
            this.config.onError(error);
          }
        })
        .finally(() => {
          this.scheduleNextSave();
        });
    }, this.config.interval);
  }

  /**
   * Perform save operation
   */
  async performSave(): Promise<SaveStats> {
    if (this.isSaving) {
      console.log('[AutoSave] Save already in progress, skipping');
      return this.createEmptyStats();
    }

    if (this.dirtyItems.size === 0) {
      console.log('[AutoSave] No dirty items to save');
      return this.createEmptyStats();
    }

    this.isSaving = true;
    const startTime = Date.now();
    const stats: SaveStats = {
      timestamp: new Date(),
      nodesSaved: 0,
      snippetsSaved: 0,
      viewsSaved: 0,
      totalSaved: 0,
      duration: 0,
      errors: []
    };

    try {
      console.log(`[AutoSave] Saving ${this.dirtyItems.size} dirty items...`);

      // Get items to save (up to batch size)
      const itemsToSave = Array.from(this.dirtyItems.values()).slice(0, this.config.batchSize);

      // Group by type
      const nodeIds = itemsToSave.filter(item => item.type === 'node').map(item => item.id);
      const snippetIds = itemsToSave.filter(item => item.type === 'snippet').map(item => item.id);
      const viewIds = itemsToSave.filter(item => item.type === 'view').map(item => item.id);

      // Save in transaction
      await this.transactionManager.execute(async () => {
        // Save nodes
        for (const nodeId of nodeIds) {
          try {
            this.nodeCRUD.clearDirty(nodeId);
            this.clearDirty('node', nodeId);
            stats.nodesSaved++;
          } catch (error) {
            console.error(`[AutoSave] Failed to save node ${nodeId}:`, error);
            stats.errors.push(error as Error);
            this.incrementAttempts('node', nodeId);
          }
        }

        // Save snippets
        for (const snippetId of snippetIds) {
          try {
            const snippet = this.snippetCRUD.getById(snippetId);
            if (snippet) {
              this.snippetCRUD.update(snippetId, { is_dirty: false });
            }
            this.clearDirty('snippet', snippetId);
            stats.snippetsSaved++;
          } catch (error) {
            console.error(`[AutoSave] Failed to save snippet ${snippetId}:`, error);
            stats.errors.push(error as Error);
            this.incrementAttempts('snippet', snippetId);
          }
        }

        // Save views
        for (const viewId of viewIds) {
          try {
            const view = this.viewCRUD.getById(viewId);
            if (view) {
              this.viewCRUD.update(viewId, { is_dirty: false });
            }
            this.clearDirty('view', viewId);
            stats.viewsSaved++;
          } catch (error) {
            console.error(`[AutoSave] Failed to save view ${viewId}:`, error);
            stats.errors.push(error as Error);
            this.incrementAttempts('view', viewId);
          }
        }

        stats.totalSaved = stats.nodesSaved + stats.snippetsSaved + stats.viewsSaved;
      });

      stats.duration = Date.now() - startTime;

      // Store in history
      this.addToHistory(stats);

      // Callback
      if (this.config.onSave) {
        this.config.onSave(stats);
      }

      console.log(
        `[AutoSave] Saved ${stats.totalSaved} items in ${stats.duration}ms ` +
        `(nodes: ${stats.nodesSaved}, snippets: ${stats.snippetsSaved}, views: ${stats.viewsSaved})`
      );

      return stats;
    } catch (error) {
      console.error('[AutoSave] Save operation failed:', error);
      stats.errors.push(error as Error);
      stats.duration = Date.now() - startTime;
      return stats;
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Force immediate save
   */
  async forceSave(): Promise<SaveStats> {
    console.log('[AutoSave] Forcing immediate save...');
    return this.performSave();
  }

  /**
   * Increment save attempts for an item
   */
  private incrementAttempts(type: 'node' | 'snippet' | 'view', id: string): void {
    const key = `${type}:${id}`;
    const item = this.dirtyItems.get(key);

    if (item) {
      item.attempts++;

      // If too many attempts, remove from dirty list and log error
      if (item.attempts >= 5) {
        console.error(
          `[AutoSave] Item ${key} failed to save after ${item.attempts} attempts, removing from dirty list`
        );
        this.dirtyItems.delete(key);
      }
    }
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): SaveStats {
    return {
      timestamp: new Date(),
      nodesSaved: 0,
      snippetsSaved: 0,
      viewsSaved: 0,
      totalSaved: 0,
      duration: 0,
      errors: []
    };
  }

  /**
   * Add stats to history
   */
  private addToHistory(stats: SaveStats): void {
    this.saveHistory.push(stats);

    // Trim history if too large
    if (this.saveHistory.length > this.maxHistorySize) {
      this.saveHistory.shift();
    }
  }

  /**
   * Get dirty items count
   */
  getDirtyCount(): number {
    return this.dirtyItems.size;
  }

  /**
   * Get dirty items by type
   */
  getDirtyByType(): { nodes: number; snippets: number; views: number } {
    const items = Array.from(this.dirtyItems.values());
    return {
      nodes: items.filter(item => item.type === 'node').length,
      snippets: items.filter(item => item.type === 'snippet').length,
      views: items.filter(item => item.type === 'view').length
    };
  }

  /**
   * Get all dirty items
   */
  getDirtyItems(): DirtyItem[] {
    return Array.from(this.dirtyItems.values());
  }

  /**
   * Get save history
   */
  getHistory(limit?: number): SaveStats[] {
    const history = [...this.saveHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get statistics
   */
  getStats(): {
    isRunning: boolean;
    isSaving: boolean;
    dirtyCount: number;
    dirtyByType: { nodes: number; snippets: number; views: number };
    lastSave: SaveStats | null;
    averageSaveTime: number;
    totalSaves: number;
  } {
    const averageSaveTime =
      this.saveHistory.length > 0
        ? this.saveHistory.reduce((sum, stat) => sum + stat.duration, 0) / this.saveHistory.length
        : 0;

    return {
      isRunning: this.isRunning,
      isSaving: this.isSaving,
      dirtyCount: this.getDirtyCount(),
      dirtyByType: this.getDirtyByType(),
      lastSave: this.saveHistory.length > 0 ? this.saveHistory[this.saveHistory.length - 1] : null,
      averageSaveTime: Math.round(averageSaveTime),
      totalSaves: this.saveHistory.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoSaveConfig>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRunning && this.config.enabled) {
      this.start();
    }

    console.log('[AutoSave] Configuration updated:', this.config);
  }

  /**
   * Clear all dirty items (dangerous!)
   */
  clearAllDirty(): void {
    console.warn('[AutoSave] Clearing all dirty items');
    this.dirtyItems.clear();
  }

  /**
   * Cleanup and shutdown
   */
  cleanup(): void {
    console.log('[AutoSave] Cleaning up...');

    this.stop();
    this.dirtyItems.clear();
    this.saveHistory = [];

    console.log('[AutoSave] Cleanup completed');
  }
}

/**
 * Factory function to create auto-save manager
 */
export function createAutoSaveManager(
  db: SQLiteDatabase,
  nodeCRUD: NodeCRUD,
  snippetCRUD: SnippetCRUD,
  viewCRUD: ViewCRUD,
  transactionManager: TransactionManager,
  config?: Partial<AutoSaveConfig>
): AutoSaveManager {
  return new AutoSaveManager(db, nodeCRUD, snippetCRUD, viewCRUD, transactionManager, config);
}
