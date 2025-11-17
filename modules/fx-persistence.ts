/**
 * @file fx-persistence.ts
 * @description SQLite-based persistence layer for FXD projects
 * Implements comprehensive .fxd file format with nodes, snippets, views, and metadata
 */

// @agent: agent-modules-persist
// @timestamp: 2025-10-02T07:00:00Z
// @task: TRACK-B-MODULES.md#B2.1
// @status: in_progress

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode } from '../fxn.ts';
import { indexSnippet } from './fx-snippets.ts';

// SQLite database schema version - increment when schema changes
export const SCHEMA_VERSION = 1;

// SQL schema definitions for .fxd database format
export const SCHEMA_SQL = {
  // Project metadata table
  project_metadata: `
    CREATE TABLE IF NOT EXISTS project_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // Schema version tracking for migrations
  schema_version: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // FX nodes table - stores the complete node hierarchy
  nodes: `
    CREATE TABLE IF NOT EXISTS nodes (
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
    )
  `,

  // Snippets table - specialized storage for code snippets
  snippets: `
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      snippet_id TEXT NOT NULL,
      body TEXT NOT NULL,
      lang TEXT DEFAULT 'js',
      file_path TEXT,
      order_index INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      checksum TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_dirty BOOLEAN DEFAULT 0,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE(snippet_id)
    )
  `,

  // Views table - stores view definitions and group configurations
  views: `
    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      anchor_node_id TEXT,
      selectors_json TEXT,
      render_options_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_dirty BOOLEAN DEFAULT 0,
      FOREIGN KEY (anchor_node_id) REFERENCES nodes(id) ON DELETE SET NULL
    )
  `,

  // View components - links between views and their component snippets
  view_components: `
    CREATE TABLE IF NOT EXISTS view_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      view_id TEXT NOT NULL,
      snippet_id TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE,
      FOREIGN KEY (snippet_id) REFERENCES snippets(snippet_id) ON DELETE CASCADE
    )
  `,

  // Indexes for performance
  indexes: `
    CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_checksum ON nodes(checksum);
    CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
    CREATE INDEX IF NOT EXISTS idx_nodes_dirty ON nodes(is_dirty);

    CREATE INDEX IF NOT EXISTS idx_snippets_node_id ON snippets(node_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_checksum ON snippets(checksum);
    CREATE INDEX IF NOT EXISTS idx_snippets_modified ON snippets(modified_at);
    CREATE INDEX IF NOT EXISTS idx_snippets_dirty ON snippets(is_dirty);

    CREATE INDEX IF NOT EXISTS idx_views_anchor ON views(anchor_node_id);
    CREATE INDEX IF NOT EXISTS idx_views_modified ON views(modified_at);
    CREATE INDEX IF NOT EXISTS idx_views_dirty ON views(is_dirty);

    CREATE INDEX IF NOT EXISTS idx_view_components_view ON view_components(view_id);
    CREATE INDEX IF NOT EXISTS idx_view_components_snippet ON view_components(snippet_id);
  `
};

// Triggers for automatic timestamp updates
export const TRIGGERS_SQL = `
  CREATE TRIGGER IF NOT EXISTS update_nodes_modified_at
    AFTER UPDATE ON nodes
    BEGIN
      UPDATE nodes SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

  CREATE TRIGGER IF NOT EXISTS update_snippets_modified_at
    AFTER UPDATE ON snippets
    BEGIN
      UPDATE snippets SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

  CREATE TRIGGER IF NOT EXISTS update_views_modified_at
    AFTER UPDATE ON views
    BEGIN
      UPDATE views SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
`;

/**
 * Database interface abstraction to support different SQLite implementations
 */
export interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
  readonly inTransaction: boolean;
  transaction<T>(fn: () => T): T;
}

export interface SQLiteStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
  finalize(): void;
}

/**
 * Node serialization data structure
 */
export interface SerializedNode {
  id: string;
  parent_id: string | null;
  key_name: string | null;
  node_type: string;
  value: any;
  prototypes: string[];
  meta: Record<string, any> | null;
  children?: Record<string, SerializedNode>;
}

/**
 * Snippet data structure for persistence
 */
export interface SerializedSnippet {
  id: string;
  node_id: string;
  snippet_id: string;
  body: string;
  lang: string;
  file_path?: string;
  order_index: number;
  version: number;
  checksum: string;
}

/**
 * View data structure for persistence
 */
export interface SerializedView {
  id: string;
  name: string;
  anchor_node_id?: string;
  selectors: any[];
  render_options: Record<string, any>;
  components: Array<{
    snippet_id: string;
    order_index: number;
  }>;
}

/**
 * Project metadata structure
 */
export interface ProjectMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  created_at: string;
  modified_at: string;
  fx_version: string;
  default_language: string;
  marker_preferences: Record<string, any>;
  import_export_settings: Record<string, any>;
}

/**
 * Utility functions for data serialization/checksums
 */
export class PersistenceUtils {
  /**
   * Generate a simple hash for checksum validation
   */
  static hash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Safely serialize object to JSON string
   */
  static safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('[FX-Persistence] JSON stringify error:', error);
      return JSON.stringify({ error: 'serialization_failed', type: typeof obj });
    }
  }

  /**
   * Safely parse JSON string to object
   */
  static safeParse(json: string): any {
    try {
      return JSON.parse(json);
    } catch (error) {
      console.warn('[FX-Persistence] JSON parse error:', error);
      return null;
    }
  }

  /**
   * Generate a unique ID for database records
   */
  static generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /**
   * Check if node has been modified since last save
   */
  static isNodeDirty(node: FXNode, lastChecksum?: string): boolean {
    if (!lastChecksum) return true;

    const currentData = {
      value: node.__value,
      type: node.__type,
      proto: node.__proto,
      meta: (node as any).__meta
    };

    const currentChecksum = this.hash(this.safeStringify(currentData));
    return currentChecksum !== lastChecksum;
  }

  /**
   * Create checksum for a node's current state
   */
  static checksumNode(node: FXNode): string {
    const data = {
      value: node.__value,
      type: node.__type,
      proto: node.__proto,
      meta: (node as any).__meta
    };
    return this.hash(this.safeStringify(data));
  }

  /**
   * Create checksum for snippet content
   */
  static checksumSnippet(body: string, meta: any = {}): string {
    return this.hash(body + this.safeStringify(meta));
  }
}

/**
 * Database schema initialization and migration manager
 */
export class SchemaManager {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Initialize database schema if not exists
   */
  initializeSchema(): void {
    // Create all tables
    Object.values(SCHEMA_SQL).forEach(sql => {
      this.db.exec(sql);
    });

    // Create triggers
    this.db.exec(TRIGGERS_SQL);

    // Record schema version
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO schema_version (version) VALUES (?)
    `);
    stmt.run(SCHEMA_VERSION);
    stmt.finalize();

    console.log(`[FX-Persistence] Schema initialized at version ${SCHEMA_VERSION}`);
  }

  /**
   * Get current schema version from database
   */
  getCurrentVersion(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
      `);
      const result = stmt.get();
      stmt.finalize();
      return result?.version || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Perform database migration if needed
   */
  migrate(): void {
    const currentVersion = this.getCurrentVersion();

    if (currentVersion < SCHEMA_VERSION) {
      console.log(`[FX-Persistence] Migrating from version ${currentVersion} to ${SCHEMA_VERSION}`);

      // Add migration logic here when schema changes
      // For now, we'll just update the version
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO schema_version (version) VALUES (?)
      `);
      stmt.run(SCHEMA_VERSION);
      stmt.finalize();

      console.log(`[FX-Persistence] Migration completed`);
    }
  }

  /**
   * Validate database integrity
   */
  validateIntegrity(): boolean {
    try {
      // Check if all required tables exist
      const tables = ['project_metadata', 'nodes', 'snippets', 'views', 'view_components'];
      const stmt = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name = ?
      `);

      for (const table of tables) {
        const result = stmt.get(table);
        if (!result) {
          console.error(`[FX-Persistence] Missing table: ${table}`);
          stmt.finalize();
          return false;
        }
      }

      stmt.finalize();
      return true;
    } catch (error) {
      console.error('[FX-Persistence] Integrity check failed:', error);
      return false;
    }
  }
}

/**
 * Main FXD Persistence class - handles save/load of FX graphs to .fxd files
 */
export class FXPersistence {
  private db: SQLiteDatabase;
  private schema: SchemaManager;

  constructor(db: SQLiteDatabase) {
    this.db = db;
    this.schema = new SchemaManager(db);
  }

  /**
   * Initialize a new .fxd database file
   */
  initialize(): void {
    this.schema.initializeSchema();
  }

  /**
   * Save the entire FX graph to the database
   */
  save(): void {
    console.log('[FX-Persistence] Starting save...');

    this.db.transaction(() => {
      // Clear existing data (fresh save each time)
      this.db.exec('DELETE FROM view_components');
      this.db.exec('DELETE FROM views');
      this.db.exec('DELETE FROM snippets');
      this.db.exec('DELETE FROM nodes');

      // Traverse and save all nodes
      const nodeCount = this.saveNode($_$$.node(), null, null);

      console.log(`[FX-Persistence] Saved ${nodeCount} nodes`);
    });
  }

  /**
   * Recursively save a node and its children
   */
  private saveNode(node: FXNode, parentId: string | null, keyName: string | null): number {
    let count = 0;

    // Save this node
    const nodeId = node.__id;
    const nodeType = node.__type || 'raw';

    // Serialize value - extract .raw if it's an FX value object
    let valueToSave = node.__value;
    if (valueToSave && typeof valueToSave === 'object' && 'raw' in valueToSave) {
      valueToSave = valueToSave.raw; // Extract the actual value
    }
    const valueJson = valueToSave !== undefined
      ? PersistenceUtils.safeStringify(valueToSave)
      : null;

    // Serialize metadata
    const metaJson = (node as any).__meta
      ? PersistenceUtils.safeStringify((node as any).__meta)
      : null;

    // Serialize prototypes (stored as array of strings)
    const prototypesJson = node.__proto
      ? PersistenceUtils.safeStringify([node.__proto])
      : null;

    // Calculate checksum
    const checksum = PersistenceUtils.checksumNode(node);

    // Insert node
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO nodes (
        id, parent_id, key_name, node_type, value_json,
        prototypes_json, meta_json, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(nodeId, parentId, keyName, nodeType, valueJson, prototypesJson, metaJson, checksum);
    stmt.finalize();
    count++;

    // If this is a snippet, save to snippets table
    if (nodeType === 'snippet' && (node as any).__meta?.id) {
      this.saveSnippet(node, nodeId);
    }

    // Recursively save children
    if (node.__nodes) {
      for (const key in node.__nodes) {
        const child = node.__nodes[key];
        count += this.saveNode(child, nodeId, key);
      }
    }

    return count;
  }

  /**
   * Save snippet-specific data
   */
  private saveSnippet(node: FXNode, nodeId: string): void {
    const meta = (node as any).__meta || {};
    const body = String(node.__value || '');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO snippets (
        id, node_id, snippet_id, body, lang, file_path,
        order_index, version, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const snippetDbId = PersistenceUtils.generateId();
    const checksum = PersistenceUtils.checksumSnippet(body, meta);

    stmt.run(
      snippetDbId,
      nodeId,
      meta.id || nodeId,
      body,
      meta.lang || 'js',
      meta.file || null,
      meta.order || 0,
      meta.version || 1,
      checksum
    );
    stmt.finalize();
  }

  /**
   * Load entire FX graph from database
   */
  load(): void {
    console.log('[FX-Persistence] Starting load...');

    // Clear current graph (except system roots)
    this.clearGraph();

    // Load all nodes
    const stmt = this.db.prepare(`
      SELECT * FROM nodes ORDER BY parent_id NULLS FIRST
    `);

    const rows = stmt.all();
    stmt.finalize();

    console.log(`[FX-Persistence] Loading ${rows.length} nodes...`);

    // Build a map of nodes by ID for parent lookup
    const nodeMap = new Map<string, any>();
    const pathMap = new Map<string, string>(); // Track paths by node ID

    // First pass: create all nodes
    for (const row of rows) {
      nodeMap.set(row.id, row);
    }

    // Second pass: reconstruct hierarchy starting from roots (parent_id is null)
    for (const row of rows) {
      if (row.parent_id === null) {
        this.loadNode(row, null, null, nodeMap, pathMap);
      }
    }

    // Load snippets and update metadata using the pathMap
    this.loadSnippets(pathMap);

    console.log('[FX-Persistence] Load complete');
  }

  /**
   * Recursively load a node and its children
   */
  private loadNode(
    row: any,
    parentNode: FXNode | null,
    keyName: string | null,
    nodeMap: Map<string, any>,
    pathMap: Map<string, string>
  ): void {
    // Determine the path by building from parent path + key_name
    let path: string;

    if (row.parent_id === null) {
      // Root node of the entire tree
      path = row.id;
    } else {
      // Has a parent
      const parentPath = pathMap.get(row.parent_id);

      if (!parentPath) {
        // Parent not loaded yet, shouldn't happen with ORDER BY
        console.warn(`[FX-Persistence] Parent ${row.parent_id} not found for ${row.key_name}`);
        path = row.key_name || row.id;
      } else if (parentPath === $_$$.node().__id) {
        // Parent is the system root, use just key_name
        path = row.key_name || row.id;
      } else {
        // Normal nested node
        path = `${parentPath}.${row.key_name || row.id}`;
      }
    }

    // Track this node's path
    pathMap.set(row.id, path);

    // Get or create the node
    const node = $$(path).node();

    // Restore type
    if (row.node_type && row.node_type !== 'raw') {
      node.__type = row.node_type;
    }

    // Restore value
    if (row.value_json) {
      const value = PersistenceUtils.safeParse(row.value_json);
      // Use .set() for objects/arrays, .val() for primitives
      if (value !== null && typeof value === 'object') {
        $$(path).set(value);
      } else {
        $$(path).val(value);
      }
    }

    // Restore metadata
    if (row.meta_json) {
      const meta = PersistenceUtils.safeParse(row.meta_json);
      (node as any).__meta = meta;
    }

    // Restore prototypes
    if (row.prototypes_json) {
      const protos = PersistenceUtils.safeParse(row.prototypes_json);
      if (Array.isArray(protos) && protos[0]) {
        node.__proto = protos[0];
      }
    }

    // Find and load children
    for (const childRow of nodeMap.values()) {
      if (childRow.parent_id === row.id) {
        this.loadNode(childRow, node, childRow.key_name, nodeMap, pathMap);
      }
    }
  }

  /**
   * Load all snippets and rebuild the snippet index
   */
  private loadSnippets(pathMap: Map<string, string>): void {
    const stmt = this.db.prepare('SELECT * FROM snippets');
    const snippets = stmt.all();
    stmt.finalize();

    for (const snippet of snippets) {
      // Get the path from our pathMap using the node_id
      const path = pathMap.get(snippet.node_id);

      if (path) {
        // Index the snippet with its proper path
        indexSnippet(path, snippet.snippet_id);
      } else {
        console.warn(`[FX-Persistence] Could not find path for snippet ${snippet.snippet_id}`);
      }
    }

    console.log(`[FX-Persistence] Indexed ${snippets.length} snippets`);
  }

  /**
   * Clear the FX graph (except system roots like __fx)
   */
  private clearGraph(): void {
    const root = $_$$.node();
    if (root.__nodes) {
      const keysToDelete = Object.keys(root.__nodes).filter(k => !k.startsWith('__'));
      for (const key of keysToDelete) {
        delete root.__nodes[key];
      }
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics
   */
  getStats(): { nodes: number; snippets: number; views: number } {
    const nodesStmt = this.db.prepare('SELECT COUNT(*) as count FROM nodes');
    const nodes = nodesStmt.get();
    nodesStmt.finalize();

    const snippetsStmt = this.db.prepare('SELECT COUNT(*) as count FROM snippets');
    const snippets = snippetsStmt.get();
    snippetsStmt.finalize();

    const viewsStmt = this.db.prepare('SELECT COUNT(*) as count FROM views');
    const views = viewsStmt.get();
    viewsStmt.finalize();

    return {
      nodes: nodes?.count || 0,
      snippets: snippets?.count || 0,
      views: views?.count || 0
    };
  }
}

// Export the schema for external use
export { SCHEMA_SQL as FXD_SCHEMA };