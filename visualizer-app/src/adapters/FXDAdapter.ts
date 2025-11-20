/**
 * FXD Adapter - Connects FXD data sources to the visualizer
 * Reads from .fxd (SQLite) and .fxwal files
 * Provides real-time updates via FX Signals
 */

import type { VisualizerNode, VisualizerConnection, FXNode, NodeType, NodeState, DataType, LayerType } from '../types';
import * as THREE from 'three';

// SQLite interfaces for browser-based SQLite
export interface SQLiteDatabase {
  exec(sql: string): any[];
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

export interface SQLiteStatement {
  get(...params: any[]): any;
  all(...params: any[]): any[];
  run(...params: any[]): void;
  finalize(): void;
}

// FXD file metadata
export interface FXDFileInfo {
  path: string;
  name: string;
  size: number;
  nodeCount: number;
  lastModified: Date;
  isSynced: boolean;
}

// Configuration options for the adapter
export interface FXDAdapterConfig {
  autoSync?: boolean;
  syncInterval?: number;
  maxNodes?: number;
  enableWAL?: boolean;
}

// Type detection helpers
function detectDataType(value: any): DataType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'function') return 'function';
  if (Array.isArray(value)) return 'array';
  return 'object';
}

function detectNodeType(node: FXNode): NodeType {
  // Check metadata for hints
  if (node.__meta?.nodeType) {
    return node.__meta.nodeType as NodeType;
  }

  // Check prototypes
  if (node.__proto?.includes('component')) return 'component';
  if (node.__proto?.includes('effect')) return 'effect';
  if (node.__proto?.includes('computed')) return 'computed';
  if (node.__proto?.includes('async')) return 'async';
  if (node.__proto?.includes('worker')) return 'worker';
  if (node.__proto?.includes('http')) return 'http';
  if (node.__proto?.includes('websocket')) return 'websocket';
  if (node.__proto?.includes('wasm')) return 'wasm';
  if (node.__proto?.includes('event')) return 'event';

  return 'data';
}

function detectNodeState(node: FXNode): NodeState {
  if (node.__meta?.state) {
    return node.__meta.state as NodeState;
  }

  if (node.__meta?.error) return 'error';
  if (node.__watchers && node.__watchers.size > 0) return 'active';
  if (node.__effects && node.__effects.length > 0) return 'active';

  return 'idle';
}

function detectLayer(node: FXNode): LayerType {
  // Check for layer hints in metadata
  if (node.__meta?.layer) {
    return node.__meta.layer as LayerType;
  }

  // Infer from node type or prototypes
  if (node.__proto?.includes('dom') || node.__proto?.includes('ui')) return 'dom';
  if (node.__proto?.includes('component')) return 'component';
  if (node.__proto?.includes('worker')) return 'worker';
  if (node.__proto?.includes('http') || node.__proto?.includes('websocket')) return 'network';
  if (node.__proto?.includes('server')) return 'server';
  if (node.__proto?.includes('wasm')) return 'wasm';
  if (node.__proto?.includes('timetravel')) return 'timetravel';

  return 'core';
}

/**
 * Main FXD Adapter Class
 */
export class FXDAdapter {
  private db: SQLiteDatabase | null = null;
  private config: FXDAdapterConfig;
  private nodeCache: Map<string, VisualizerNode> = new Map();
  private connectionCache: Map<string, VisualizerConnection> = new Map();
  private changeListeners: Set<(type: 'node' | 'connection', data: any) => void> = new Set();
  private syncTimer: number | null = null;
  private walData: any[] = [];

  constructor(config: FXDAdapterConfig = {}) {
    this.config = {
      autoSync: config.autoSync ?? true,
      syncInterval: config.syncInterval ?? 100,
      maxNodes: config.maxNodes ?? 10000,
      enableWAL: config.enableWAL ?? true,
    };
  }

  /**
   * Load a .fxd file (SQLite database)
   */
  async loadFXDFile(filePath: string, dbInstance?: SQLiteDatabase): Promise<void> {
    if (dbInstance) {
      this.db = dbInstance;
    } else {
      throw new Error('Database instance required. Please provide a SQLite database instance.');
    }

    // Load all nodes from the database
    await this.loadNodesFromDB();

    // Load WAL if enabled
    if (this.config.enableWAL) {
      await this.loadWALFile(filePath.replace('.fxd', '.fxwal'));
    }

    // Start auto-sync if enabled
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Load nodes from SQLite database
   */
  private async loadNodesFromDB(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not loaded');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY id');
      const rows = stmt.all();
      stmt.finalize();

      // Clear caches
      this.nodeCache.clear();
      this.connectionCache.clear();

      // Process each node
      for (const row of rows) {
        const fxNode: FXNode = {
          __id: row.id,
          __parent_id: row.parent_id,
          __type: row.node_type,
          __proto: row.prototypes_json ? JSON.parse(row.prototypes_json) : [],
          __value: row.value_json ? JSON.parse(row.value_json) : null,
          __nodes: {},
          __effects: [],
          __watchers: new Set(),
          __behaviors: new Map(),
          __instances: new Map(),
          __meta: row.meta_json ? JSON.parse(row.meta_json) : {},
          __version: 0,
        };

        const visualizerNode = this.convertToVisualizerNode(fxNode);
        this.nodeCache.set(visualizerNode.id, visualizerNode);

        // Create connection to parent
        if (row.parent_id) {
          this.createConnection(row.parent_id, row.id, 'dependency');
        }
      }

      // Notify listeners
      this.notifyChange('node', Array.from(this.nodeCache.values()));
    } catch (error) {
      console.error('Error loading nodes from database:', error);
      throw error;
    }
  }

  /**
   * Load WAL (Write-Ahead Log) file for real-time changes
   */
  private async loadWALFile(walPath: string): Promise<void> {
    try {
      // WAL files are typically read via FileReader in browser
      // This is a placeholder for the actual implementation
      console.log('WAL loading not yet implemented for:', walPath);
    } catch (error) {
      console.warn('Could not load WAL file:', error);
    }
  }

  /**
   * Convert FXNode to VisualizerNode
   */
  private convertToVisualizerNode(fxNode: FXNode): VisualizerNode {
    const nodeType = detectNodeType(fxNode);
    const dataType = detectDataType(fxNode.__value);
    const layer = detectLayer(fxNode);
    const state = detectNodeState(fxNode);

    // Calculate position based on layer and parent
    const layerZ = this.getLayerZ(layer);
    const position = new THREE.Vector3(
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,
      layerZ
    );

    return {
      id: fxNode.__id,
      fxNode,
      type: nodeType,
      state,
      dataType,
      layer,
      position,
      velocity: new THREE.Vector3(0, 0, 0),
      value: fxNode.__value,
      updateCount: 0,
      updateFrequency: 0,
      lastUpdate: Date.now(),
      errors: [],
      isWatched: (fxNode.__watchers?.size || 0) > 0,
      isFrozen: false,
      metadata: fxNode.__meta || {},
    };
  }

  /**
   * Get Z coordinate for layer
   */
  private getLayerZ(layer: LayerType): number {
    const layerMap: Record<LayerType, number> = {
      core: 0,
      dom: 50,
      component: 100,
      worker: 150,
      network: 200,
      server: 250,
      wasm: 300,
      timetravel: 350,
    };
    return layerMap[layer] || 0;
  }

  /**
   * Create a connection between nodes
   */
  private createConnection(
    sourceId: string,
    targetId: string,
    type: VisualizerConnection['type']
  ): void {
    const id = `${sourceId}->${targetId}`;

    if (this.connectionCache.has(id)) {
      return;
    }

    const connection: VisualizerConnection = {
      id,
      source: sourceId,
      target: targetId,
      type,
      strength: 1.0,
      dataFlow: [],
      lastTransfer: Date.now(),
      color: this.getConnectionColor(type),
    };

    this.connectionCache.set(id, connection);
  }

  /**
   * Get connection color based on type
   */
  private getConnectionColor(type: VisualizerConnection['type']): string {
    const colorMap = {
      dependency: '#d4af37',
      data: '#3498db',
      event: '#e74c3c',
      http: '#9b59b6',
      websocket: '#1abc9c',
    };
    return colorMap[type] || '#95a5a6';
  }

  /**
   * Get all nodes for visualizer
   */
  async getNodes(): Promise<VisualizerNode[]> {
    return Array.from(this.nodeCache.values());
  }

  /**
   * Get all connections for visualizer
   */
  async getConnections(): Promise<VisualizerConnection[]> {
    return Array.from(this.connectionCache.values());
  }

  /**
   * Get disk statistics
   */
  async getDiskStats(): Promise<{
    totalNodes: number;
    totalSize: number;
    isSynced: boolean;
    lastSync: Date;
  }> {
    return {
      totalNodes: this.nodeCache.size,
      totalSize: 0, // Would need to calculate from DB
      isSynced: true,
      lastSync: new Date(),
    };
  }

  /**
   * Subscribe to changes (FX Signals integration)
   */
  subscribeToChanges(callback: (type: 'node' | 'connection', data: any) => void): () => void {
    this.changeListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Notify all change listeners
   */
  private notifyChange(type: 'node' | 'connection', data: any): void {
    for (const listener of this.changeListeners) {
      try {
        listener(type, data);
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    }
  }

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    if (this.syncTimer !== null) {
      return;
    }

    this.syncTimer = window.setInterval(() => {
      this.sync();
    }, this.config.syncInterval);
  }

  /**
   * Stop auto-sync timer
   */
  private stopAutoSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Sync changes from database
   */
  private async sync(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // Check for dirty nodes (modified since last sync)
      const stmt = this.db.prepare('SELECT * FROM nodes WHERE is_dirty = 1');
      const dirtyRows = stmt.all();
      stmt.finalize();

      if (dirtyRows.length > 0) {
        // Update cache with dirty nodes
        for (const row of dirtyRows) {
          const fxNode: FXNode = {
            __id: row.id,
            __parent_id: row.parent_id,
            __type: row.node_type,
            __proto: row.prototypes_json ? JSON.parse(row.prototypes_json) : [],
            __value: row.value_json ? JSON.parse(row.value_json) : null,
            __nodes: {},
            __effects: [],
            __watchers: new Set(),
            __behaviors: new Map(),
            __instances: new Map(),
            __meta: row.meta_json ? JSON.parse(row.meta_json) : {},
            __version: 0,
          };

          const visualizerNode = this.convertToVisualizerNode(fxNode);
          this.nodeCache.set(visualizerNode.id, visualizerNode);
        }

        // Notify listeners
        this.notifyChange('node', dirtyRows.map(row => this.nodeCache.get(row.id)));

        // Clear dirty flags
        this.db.prepare('UPDATE nodes SET is_dirty = 0 WHERE is_dirty = 1').run();
      }
    } catch (error) {
      console.error('Error syncing changes:', error);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAutoSync();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.nodeCache.clear();
    this.connectionCache.clear();
    this.changeListeners.clear();
  }

  /**
   * List available .fxd files (requires file system access)
   */
  static async listFXDFiles(directory?: string): Promise<FXDFileInfo[]> {
    // This would need to be implemented with File System Access API in browser
    // or with Node.js fs module in Electron/Node environment
    console.warn('listFXDFiles not yet implemented');
    return [];
  }

  /**
   * Create a new .fxd file
   */
  static async createFXDFile(path: string, db: SQLiteDatabase): Promise<void> {
    // Initialize database schema
    const schemas = [
      `CREATE TABLE IF NOT EXISTS project_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        key_name TEXT,
        node_type TEXT NOT NULL DEFAULT 'raw',
        value_json TEXT,
        prototypes_json TEXT,
        meta_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        is_dirty BOOLEAN DEFAULT 0,
        FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
      )`,
    ];

    for (const sql of schemas) {
      db.exec(sql);
    }

    // Insert schema version
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);

    // Insert project metadata
    const stmt = db.prepare('INSERT INTO project_metadata (key, value) VALUES (?, ?)');
    stmt.run('name', path);
    stmt.run('created_at', new Date().toISOString());
    stmt.finalize();
  }
}
