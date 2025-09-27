/**
 * @file fx-project.ts
 * @description FXDProject class - main project container with SQLite persistence
 * Manages project lifecycle, database connections, and high-level operations
 */

import { FXCore, FXNode } from "../fx.ts";
import {
  SQLiteDatabase,
  SQLiteStatement,
  SchemaManager,
  ProjectMetadata,
  SerializedNode,
  SerializedSnippet,
  SerializedView,
  PersistenceUtils,
  SCHEMA_VERSION
} from "./fx-persistence.ts";

/**
 * Project creation options
 */
export interface ProjectCreateOptions {
  name: string;
  description?: string;
  author?: string;
  defaultLanguage?: string;
  markerPreferences?: Record<string, any>;
  importExportSettings?: Record<string, any>;
}

/**
 * Project open options
 */
export interface ProjectOpenOptions {
  readonly?: boolean;
  backupOnOpen?: boolean;
  validateIntegrity?: boolean;
}

/**
 * Save operation options
 */
export interface SaveOptions {
  incremental?: boolean;
  createBackup?: boolean;
  validateAfterSave?: boolean;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  nodeCount: number;
  snippetCount: number;
  viewCount: number;
  totalSize: number;
  lastSaved: Date | null;
  isDirty: boolean;
  version: string;
}

/**
 * Main FXD Project class
 * Manages SQLite database connection and project operations
 */
export class FXDProject {
  private db: SQLiteDatabase | null = null;
  private schemaManager: SchemaManager | null = null;
  private fx: FXCore;
  private projectPath: string | null = null;
  private metadata: ProjectMetadata | null = null;
  private isOpen = false;
  private readonly = false;
  private dirtyNodes = new Set<string>();
  private dirtySnippets = new Set<string>();
  private dirtyViews = new Set<string>();

  // Prepared statements for performance
  private statements: Record<string, SQLiteStatement> = {};

  constructor(fx: FXCore) {
    this.fx = fx;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for automatic dirty tracking
   */
  private setupEventListeners(): void {
    // Listen to FX structure changes to mark dirty
    this.fx.onStructure((event) => {
      if (!this.isOpen || this.readonly) return;

      switch (event.kind) {
        case "create":
        case "mutate":
        case "remove":
          this.markNodeDirty(event.node.__id);
          break;
        case "move":
          if (event.parent) this.markNodeDirty(event.parent.__id);
          this.markNodeDirty(event.node.__id);
          break;
      }
    });
  }

  /**
   * Create a new FXD project
   */
  async create(filePath: string, options: ProjectCreateOptions): Promise<void> {
    if (this.isOpen) {
      throw new Error("Cannot create project: another project is already open");
    }

    try {
      // Initialize SQLite database
      this.db = await this.createDatabase(filePath);
      this.schemaManager = new SchemaManager(this.db);
      this.schemaManager.initializeSchema();

      // Create project metadata
      this.metadata = {
        name: options.name,
        version: "1.0.0",
        description: options.description || "",
        author: options.author || "",
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        fx_version: "1.0.0", // TODO: Get from FX version
        default_language: options.defaultLanguage || "js",
        marker_preferences: options.markerPreferences || {},
        import_export_settings: options.importExportSettings || {}
      };

      // Save metadata to database
      await this.saveMetadata();

      // Initialize prepared statements
      this.initializePreparedStatements();

      this.projectPath = filePath;
      this.isOpen = true;
      this.readonly = false;

      console.log(`[FXDProject] Created new project: ${filePath}`);
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Open an existing FXD project
   */
  async open(filePath: string, options: ProjectOpenOptions = {}): Promise<void> {
    if (this.isOpen) {
      throw new Error("Cannot open project: another project is already open");
    }

    try {
      // Create backup if requested
      if (options.backupOnOpen) {
        await this.createBackupFile(filePath, `${filePath}.backup.${Date.now()}.fxd`);
      }

      // Open SQLite database
      this.db = await this.openDatabase(filePath);
      this.schemaManager = new SchemaManager(this.db);

      // Validate and migrate schema if needed
      if (options.validateIntegrity && !this.schemaManager.validateIntegrity()) {
        throw new Error("Database integrity check failed");
      }

      this.schemaManager.migrate();

      // Load project metadata
      await this.loadMetadata();

      // Initialize prepared statements
      this.initializePreparedStatements();

      // Load project data into FX
      await this.loadProjectData();

      this.projectPath = filePath;
      this.isOpen = true;
      this.readonly = options.readonly || false;

      console.log(`[FXDProject] Opened project: ${filePath}`);
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to open project: ${error}`);
    }
  }

  /**
   * Save the project to disk
   */
  async save(options: SaveOptions = {}): Promise<void> {
    if (!this.isOpen || !this.db) {
      throw new Error("No project is open");
    }

    if (this.readonly) {
      throw new Error("Cannot save: project is open in read-only mode");
    }

    try {
      // Create backup if requested
      if (options.createBackup && this.projectPath) {
        const backupPath = `${this.projectPath}.backup.${Date.now()}.fxd`;
        await this.createBackupFile(this.projectPath, backupPath);
      }

      if (options.incremental) {
        await this.saveIncremental();
      } else {
        await this.saveComplete();
      }

      // Update metadata
      if (this.metadata) {
        this.metadata.modified_at = new Date().toISOString();
        await this.saveMetadata();
      }

      // Validate after save if requested
      if (options.validateAfterSave) {
        const isValid = this.schemaManager?.validateIntegrity();
        if (!isValid) {
          throw new Error("Post-save validation failed");
        }
      }

      // Clear dirty flags
      this.clearDirtyFlags();

      console.log(`[FXDProject] Project saved successfully`);
    } catch (error) {
      throw new Error(`Failed to save project: ${error}`);
    }
  }

  /**
   * Close the project
   */
  async close(): Promise<void> {
    if (!this.isOpen) return;

    try {
      // Check for unsaved changes
      if (this.isDirty()) {
        console.warn("[FXDProject] Closing project with unsaved changes");
      }

      await this.cleanup();
      console.log("[FXDProject] Project closed successfully");
    } catch (error) {
      console.error("[FXDProject] Error closing project:", error);
    }
  }

  /**
   * Get project statistics
   */
  async getStats(): Promise<ProjectStats> {
    if (!this.isOpen || !this.db) {
      throw new Error("No project is open");
    }

    const nodeCount = this.statements.countNodes?.get()?.count || 0;
    const snippetCount = this.statements.countSnippets?.get()?.count || 0;
    const viewCount = this.statements.countViews?.get()?.count || 0;

    return {
      nodeCount,
      snippetCount,
      viewCount,
      totalSize: await this.calculateProjectSize(),
      lastSaved: this.metadata ? new Date(this.metadata.modified_at) : null,
      isDirty: this.isDirty(),
      version: this.metadata?.version || "unknown"
    };
  }

  /**
   * Check if project has unsaved changes
   */
  isDirty(): boolean {
    return this.dirtyNodes.size > 0 ||
           this.dirtySnippets.size > 0 ||
           this.dirtyViews.size > 0;
  }

  /**
   * Get project metadata
   */
  getMetadata(): ProjectMetadata | null {
    return this.metadata ? { ...this.metadata } : null;
  }

  /**
   * Update project metadata
   */
  async updateMetadata(updates: Partial<ProjectMetadata>): Promise<void> {
    if (!this.metadata) {
      throw new Error("No project metadata available");
    }

    this.metadata = {
      ...this.metadata,
      ...updates,
      modified_at: new Date().toISOString()
    };

    await this.saveMetadata();
  }

  /**
   * Mark a node as dirty for incremental save
   */
  markNodeDirty(nodeId: string): void {
    this.dirtyNodes.add(nodeId);
  }

  /**
   * Mark a snippet as dirty for incremental save
   */
  markSnippetDirty(snippetId: string): void {
    this.dirtySnippets.add(snippetId);
  }

  /**
   * Mark a view as dirty for incremental save
   */
  markViewDirty(viewId: string): void {
    this.dirtyViews.add(viewId);
  }

  // Private implementation methods

  private async createDatabase(filePath: string): Promise<SQLiteDatabase> {
    // This would be implemented with actual SQLite driver
    // For now, returning a mock interface
    throw new Error("SQLite database creation not implemented - requires SQLite driver");
  }

  private async openDatabase(filePath: string): Promise<SQLiteDatabase> {
    // This would be implemented with actual SQLite driver
    throw new Error("SQLite database opening not implemented - requires SQLite driver");
  }

  private initializePreparedStatements(): void {
    if (!this.db) return;

    // Performance-critical prepared statements
    this.statements = {
      // Node operations
      insertNode: this.db.prepare(`
        INSERT OR REPLACE INTO nodes
        (id, parent_id, key_name, node_type, value_json, prototypes_json, meta_json, checksum, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      selectNode: this.db.prepare(`
        SELECT * FROM nodes WHERE id = ?
      `),
      selectNodeChildren: this.db.prepare(`
        SELECT * FROM nodes WHERE parent_id = ? ORDER BY key_name
      `),

      // Snippet operations
      insertSnippet: this.db.prepare(`
        INSERT OR REPLACE INTO snippets
        (id, node_id, snippet_id, body, lang, file_path, order_index, version, checksum, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      selectSnippet: this.db.prepare(`
        SELECT * FROM snippets WHERE snippet_id = ?
      `),

      // View operations
      insertView: this.db.prepare(`
        INSERT OR REPLACE INTO views
        (id, name, anchor_node_id, selectors_json, render_options_json, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      selectView: this.db.prepare(`
        SELECT * FROM views WHERE id = ?
      `),

      // Statistics
      countNodes: this.db.prepare(`SELECT COUNT(*) as count FROM nodes`),
      countSnippets: this.db.prepare(`SELECT COUNT(*) as count FROM snippets`),
      countViews: this.db.prepare(`SELECT COUNT(*) as count FROM views`)
    };
  }

  private async saveMetadata(): Promise<void> {
    if (!this.db || !this.metadata) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_metadata (key, value) VALUES (?, ?)
    `);

    for (const [key, value] of Object.entries(this.metadata)) {
      stmt.run(key, PersistenceUtils.safeStringify(value));
    }

    stmt.finalize();
  }

  private async loadMetadata(): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      SELECT key, value FROM project_metadata
    `);

    const rows = stmt.all();
    stmt.finalize();

    this.metadata = {} as ProjectMetadata;
    for (const row of rows) {
      (this.metadata as any)[row.key] = PersistenceUtils.safeParse(row.value);
    }
  }

  private async loadProjectData(): Promise<void> {
    // This would load nodes, snippets, and views from database
    // and reconstruct the FX node tree
    console.log("[FXDProject] Loading project data - implementation pending");
  }

  private async saveIncremental(): Promise<void> {
    if (!this.db) return;

    this.db.transaction(() => {
      // Save only dirty nodes, snippets, and views
      for (const nodeId of this.dirtyNodes) {
        this.saveNodeToDb(nodeId);
      }

      for (const snippetId of this.dirtySnippets) {
        this.saveSnippetToDb(snippetId);
      }

      for (const viewId of this.dirtyViews) {
        this.saveViewToDb(viewId);
      }
    });
  }

  private async saveComplete(): Promise<void> {
    if (!this.db) return;

    this.db.transaction(() => {
      // Save all project data
      this.saveAllNodesToDb();
      this.saveAllSnippetsToDb();
      this.saveAllViewsToDb();
    });
  }

  private saveNodeToDb(nodeId: string): void {
    // Implementation pending - requires FX node traversal
  }

  private saveSnippetToDb(snippetId: string): void {
    // Implementation pending - requires snippet data access
  }

  private saveViewToDb(viewId: string): void {
    // Implementation pending - requires view data access
  }

  private saveAllNodesToDb(): void {
    // Implementation pending
  }

  private saveAllSnippetsToDb(): void {
    // Implementation pending
  }

  private saveAllViewsToDb(): void {
    // Implementation pending
  }

  private clearDirtyFlags(): void {
    this.dirtyNodes.clear();
    this.dirtySnippets.clear();
    this.dirtyViews.clear();
  }

  private async calculateProjectSize(): Promise<number> {
    // Calculate total size of project data
    return 0; // Implementation pending
  }

  private async createBackupFile(sourcePath: string, backupPath: string): Promise<void> {
    // Create backup copy of project file
    console.log(`[FXDProject] Creating backup: ${backupPath}`);
    // Implementation pending - requires file system operations
  }

  private async cleanup(): Promise<void> {
    // Finalize prepared statements
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[FXDProject] Error finalizing statement:", error);
      }
    }
    this.statements = {};

    // Close database connection
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        console.warn("[FXDProject] Error closing database:", error);
      }
      this.db = null;
    }

    // Reset state
    this.schemaManager = null;
    this.projectPath = null;
    this.metadata = null;
    this.isOpen = false;
    this.readonly = false;
    this.clearDirtyFlags();
  }
}

/**
 * Factory function to create FXDProject instances
 */
export function createFXDProject(fx: FXCore): FXDProject {
  return new FXDProject(fx);
}

export { FXDProject };