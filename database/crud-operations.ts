/**
 * @file crud-operations.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description CRUD operations for FXD persistence layer
 * Provides comprehensive Create, Read, Update, Delete operations for nodes, snippets, and views
 */

import { SQLiteDatabase } from './db-connection.ts';

/**
 * Utility functions for data serialization
 */
export class DataUtils {
  static safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('[DataUtils] JSON stringify error:', error);
      return JSON.stringify({ error: 'serialization_failed' });
    }
  }

  static safeParse(json: string | null): any {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (error) {
      console.warn('[DataUtils] JSON parse error:', error);
      return null;
    }
  }

  static hash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  static generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  static checksumNode(data: any): string {
    return this.hash(this.safeStringify(data));
  }
}

/**
 * Node data structure
 */
export interface NodeRecord {
  id: string;
  parent_id: string | null;
  key_name: string | null;
  node_type: string;
  value_json: string | null;
  prototypes_json: string | null;
  meta_json: string | null;
  checksum: string | null;
  is_dirty: boolean;
  created_at?: string;
  modified_at?: string;
}

/**
 * Snippet data structure
 */
export interface SnippetRecord {
  id: string;
  node_id: string;
  snippet_id: string;
  body: string;
  lang: string;
  file_path: string | null;
  order_index: number;
  version: number;
  checksum: string | null;
  is_dirty: boolean;
  created_at?: string;
  modified_at?: string;
}

/**
 * View data structure
 */
export interface ViewRecord {
  id: string;
  name: string;
  anchor_node_id: string | null;
  selectors_json: string | null;
  render_options_json: string | null;
  is_dirty: boolean;
  created_at?: string;
  modified_at?: string;
}

/**
 * Node CRUD operations
 */
export class NodeCRUD {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new node
   */
  create(node: Omit<NodeRecord, 'created_at' | 'modified_at'>): NodeRecord {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (
        id, parent_id, key_name, node_type, value_json,
        prototypes_json, meta_json, checksum, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      node.id,
      node.parent_id,
      node.key_name,
      node.node_type || 'raw',
      node.value_json,
      node.prototypes_json,
      node.meta_json,
      node.checksum,
      node.is_dirty ? 1 : 0
    );

    if (result.changes === 0) {
      throw new Error(`Failed to create node: ${node.id}`);
    }

    return this.getById(node.id)!;
  }

  /**
   * Get node by ID
   */
  getById(id: string): NodeRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Get all children of a parent node
   */
  getChildren(parentId: string): NodeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE parent_id = ? ORDER BY key_name
    `);

    const rows = stmt.all(parentId);
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Get root nodes (nodes with no parent)
   */
  getRootNodes(): NodeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE parent_id IS NULL
    `);

    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Update node
   */
  update(id: string, updates: Partial<Omit<NodeRecord, 'id' | 'created_at' | 'modified_at'>>): NodeRecord {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'modified_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE nodes SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`Node not found: ${id}`);
    }

    return this.getById(id)!;
  }

  /**
   * Delete node and all its children (cascade)
   */
  delete(id: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM nodes WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * Mark node as dirty
   */
  markDirty(id: string): void {
    this.update(id, { is_dirty: true });
  }

  /**
   * Clear dirty flag
   */
  clearDirty(id: string): void {
    this.update(id, { is_dirty: false });
  }

  /**
   * Get all dirty nodes
   */
  getDirtyNodes(): NodeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE is_dirty = 1
    `);

    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Get nodes by type
   */
  getByType(nodeType: string): NodeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE node_type = ?
    `);

    const rows = stmt.all(nodeType);
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Search nodes by key name pattern
   */
  searchByKeyName(pattern: string): NodeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE key_name LIKE ?
    `);

    const rows = stmt.all(`%${pattern}%`);
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Count total nodes
   */
  count(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM nodes`);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get node tree (node with all descendants)
   */
  getTree(rootId: string): NodeRecord & { children: any[] } {
    const root = this.getById(rootId);
    if (!root) {
      throw new Error(`Node not found: ${rootId}`);
    }

    const buildTree = (node: NodeRecord): any => {
      const children = this.getChildren(node.id);
      return {
        ...node,
        children: children.map(child => buildTree(child))
      };
    };

    return buildTree(root);
  }

  private mapRow(row: any): NodeRecord {
    return {
      id: row.id,
      parent_id: row.parent_id,
      key_name: row.key_name,
      node_type: row.node_type,
      value_json: row.value_json,
      prototypes_json: row.prototypes_json,
      meta_json: row.meta_json,
      checksum: row.checksum,
      is_dirty: Boolean(row.is_dirty),
      created_at: row.created_at,
      modified_at: row.modified_at
    };
  }
}

/**
 * Snippet CRUD operations
 */
export class SnippetCRUD {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new snippet
   */
  create(snippet: Omit<SnippetRecord, 'created_at' | 'modified_at'>): SnippetRecord {
    const stmt = this.db.prepare(`
      INSERT INTO snippets (
        id, node_id, snippet_id, body, lang, file_path,
        order_index, version, checksum, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      snippet.id,
      snippet.node_id,
      snippet.snippet_id,
      snippet.body,
      snippet.lang || 'js',
      snippet.file_path,
      snippet.order_index || 0,
      snippet.version || 1,
      snippet.checksum,
      snippet.is_dirty ? 1 : 0
    );

    if (result.changes === 0) {
      throw new Error(`Failed to create snippet: ${snippet.id}`);
    }

    return this.getById(snippet.id)!;
  }

  /**
   * Get snippet by ID
   */
  getById(id: string): SnippetRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM snippets WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Get snippet by snippet_id
   */
  getBySnippetId(snippetId: string): SnippetRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM snippets WHERE snippet_id = ?
    `);

    const row = stmt.get(snippetId);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Get all snippets for a node
   */
  getByNodeId(nodeId: string): SnippetRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM snippets WHERE node_id = ? ORDER BY order_index
    `);

    const rows = stmt.all(nodeId);
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Update snippet
   */
  update(id: string, updates: Partial<Omit<SnippetRecord, 'id' | 'created_at' | 'modified_at'>>): SnippetRecord {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'modified_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE snippets SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`Snippet not found: ${id}`);
    }

    return this.getById(id)!;
  }

  /**
   * Delete snippet
   */
  delete(id: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM snippets WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * Get all snippets
   */
  getAll(): SnippetRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM snippets ORDER BY node_id, order_index
    `);

    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  /**
   * Search snippets by language
   */
  getByLanguage(lang: string): SnippetRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM snippets WHERE lang = ?
    `);

    const rows = stmt.all(lang);
    return rows.map(row => this.mapRow(row));
  }

  private mapRow(row: any): SnippetRecord {
    return {
      id: row.id,
      node_id: row.node_id,
      snippet_id: row.snippet_id,
      body: row.body,
      lang: row.lang,
      file_path: row.file_path,
      order_index: row.order_index,
      version: row.version,
      checksum: row.checksum,
      is_dirty: Boolean(row.is_dirty),
      created_at: row.created_at,
      modified_at: row.modified_at
    };
  }
}

/**
 * View CRUD operations
 */
export class ViewCRUD {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new view
   */
  create(view: Omit<ViewRecord, 'created_at' | 'modified_at'>): ViewRecord {
    const stmt = this.db.prepare(`
      INSERT INTO views (
        id, name, anchor_node_id, selectors_json,
        render_options_json, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      view.id,
      view.name,
      view.anchor_node_id,
      view.selectors_json,
      view.render_options_json,
      view.is_dirty ? 1 : 0
    );

    if (result.changes === 0) {
      throw new Error(`Failed to create view: ${view.id}`);
    }

    return this.getById(view.id)!;
  }

  /**
   * Get view by ID
   */
  getById(id: string): ViewRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM views WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Get view by name
   */
  getByName(name: string): ViewRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM views WHERE name = ?
    `);

    const row = stmt.get(name);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Update view
   */
  update(id: string, updates: Partial<Omit<ViewRecord, 'id' | 'created_at' | 'modified_at'>>): ViewRecord {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'modified_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE views SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`View not found: ${id}`);
    }

    return this.getById(id)!;
  }

  /**
   * Delete view
   */
  delete(id: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM views WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes;
  }

  /**
   * Get all views
   */
  getAll(): ViewRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM views ORDER BY name
    `);

    const rows = stmt.all();
    return rows.map(row => this.mapRow(row));
  }

  private mapRow(row: any): ViewRecord {
    return {
      id: row.id,
      name: row.name,
      anchor_node_id: row.anchor_node_id,
      selectors_json: row.selectors_json,
      render_options_json: row.render_options_json,
      is_dirty: Boolean(row.is_dirty),
      created_at: row.created_at,
      modified_at: row.modified_at
    };
  }
}

/**
 * Metadata CRUD operations
 */
export class MetadataCRUD {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Set metadata value
   */
  set(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_metadata (key, value)
      VALUES (?, ?)
    `);

    stmt.run(key, value);
  }

  /**
   * Get metadata value
   */
  get(key: string): string | null {
    const stmt = this.db.prepare(`
      SELECT value FROM project_metadata WHERE key = ?
    `);

    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  /**
   * Delete metadata key
   */
  delete(key: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM project_metadata WHERE key = ?
    `);

    const result = stmt.run(key);
    return result.changes;
  }

  /**
   * Get all metadata
   */
  getAll(): Record<string, string> {
    const stmt = this.db.prepare(`
      SELECT key, value FROM project_metadata
    `);

    const rows = stmt.all() as Array<{ key: string; value: string }>;
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }
}

/**
 * Factory to create all CRUD instances
 */
export function createCRUDOperations(db: SQLiteDatabase) {
  return {
    nodes: new NodeCRUD(db),
    snippets: new SnippetCRUD(db),
    views: new ViewCRUD(db),
    metadata: new MetadataCRUD(db)
  };
}
