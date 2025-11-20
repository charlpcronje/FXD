/**
 * @file fx-metadata-persistence.ts
 * @description Project metadata storage for names, versions, dates, and configuration
 * Handles project-level settings and configuration persistence
 */

// @agent: agent-modules-persist
// @timestamp: 2025-10-02T07:00:00Z
// @task: TRACK-B-MODULES.md#B2.4
// @status: in_progress

import { $$, $_$$, fx } from '../fxn.ts';
import {
  SQLiteDatabase,
  SQLiteStatement,
  ProjectMetadata,
  PersistenceUtils
} from "./fx-persistence.ts";

/**
 * Extended project configuration
 */
export interface ProjectConfiguration {
  // Basic project info
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;

  // Timestamps
  created_at: string;
  modified_at: string;
  last_opened_at?: string;
  last_saved_at?: string;

  // FX system info
  fx_version: string;
  schema_version: number;

  // Language and format preferences
  default_language: string;
  supported_languages: string[];
  file_extensions: Record<string, string>;

  // Marker and snippet preferences
  marker_preferences: {
    comment_style: 'block' | 'line' | 'auto';
    include_metadata: boolean;
    include_checksums: boolean;
    include_version_info: boolean;
    custom_marker_format?: string;
  };

  // Import/Export settings
  import_export_settings: {
    auto_detect_language: boolean;
    preserve_file_structure: boolean;
    include_hidden_files: boolean;
    exclude_patterns: string[];
    include_patterns: string[];
    git_integration: boolean;
    backup_on_import: boolean;
  };

  // View and rendering preferences
  view_preferences: {
    default_separator: string;
    default_eol: 'lf' | 'crlf';
    auto_hoist_imports: boolean;
    include_source_maps: boolean;
    minify_output: boolean;
  };

  // Performance and caching
  performance_settings: {
    enable_caching: boolean;
    cache_max_size: number;
    auto_save_interval: number;
    backup_retention_days: number;
    max_undo_history: number;
  };

  // Security and permissions
  security_settings: {
    allow_external_modules: boolean;
    sandbox_mode: boolean;
    trusted_sources: string[];
    max_file_size: number;
  };

  // UI and editor preferences
  ui_preferences: {
    theme: 'light' | 'dark' | 'auto';
    font_family: string;
    font_size: number;
    line_numbers: boolean;
    word_wrap: boolean;
    tab_size: number;
    use_spaces: boolean;
  };

  // Custom user settings
  custom_settings: Record<string, any>;
}

/**
 * Metadata search and filter options
 */
export interface MetadataSearchOptions {
  keys?: string[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  type?: 'string' | 'number' | 'boolean' | 'object';
  modifiedAfter?: Date;
}

/**
 * Project metadata persistence manager
 */
export class MetadataPersistence {
  private db: SQLiteDatabase;
  private statements: Record<string, SQLiteStatement> = {};
  private cachedMetadata: Map<string, any> = new Map();
  private isDirty = false;

  constructor(db: SQLiteDatabase) {
    this.db = db;
    this.initializePreparedStatements();
  }

  /**
   * Initialize prepared statements for optimal performance
   */
  private initializePreparedStatements(): void {
    this.statements = {
      // Basic CRUD operations
      insertMetadata: this.db.prepare(`
        INSERT OR REPLACE INTO project_metadata (key, value, created_at, modified_at)
        VALUES (?, ?, COALESCE((SELECT created_at FROM project_metadata WHERE key = ?), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
      `),
      selectMetadata: this.db.prepare(`
        SELECT key, value, created_at, modified_at FROM project_metadata WHERE key = ?
      `),
      selectAllMetadata: this.db.prepare(`
        SELECT key, value, created_at, modified_at FROM project_metadata ORDER BY key ASC
      `),
      updateMetadata: this.db.prepare(`
        UPDATE project_metadata SET value = ?, modified_at = CURRENT_TIMESTAMP WHERE key = ?
      `),
      deleteMetadata: this.db.prepare(`
        DELETE FROM project_metadata WHERE key = ?
      `),

      // Search operations
      searchMetadataKeys: this.db.prepare(`
        SELECT key, value, created_at, modified_at FROM project_metadata
        WHERE key LIKE ? ORDER BY key ASC
      `),
      searchMetadataValues: this.db.prepare(`
        SELECT key, value, created_at, modified_at FROM project_metadata
        WHERE value LIKE ? ORDER BY key ASC
      `),
      selectMetadataByKeys: this.db.prepare(`
        SELECT key, value, created_at, modified_at FROM project_metadata
        WHERE key IN (${Array(50).fill('?').join(',')}) ORDER BY key ASC
      `),

      // Statistics and info
      countMetadata: this.db.prepare(`
        SELECT COUNT(*) as count FROM project_metadata
      `),
      metadataSize: this.db.prepare(`
        SELECT SUM(LENGTH(key) + LENGTH(value)) as total_size FROM project_metadata
      `),
      lastModified: this.db.prepare(`
        SELECT MAX(modified_at) as last_modified FROM project_metadata
      `),

      // Bulk operations
      deleteAllMetadata: this.db.prepare(`
        DELETE FROM project_metadata
      `),

      // Configuration queries
      selectConfigurationKeys: this.db.prepare(`
        SELECT key, value FROM project_metadata
        WHERE key LIKE 'config.%' OR key LIKE '%.settings' OR key LIKE '%.preferences'
        ORDER BY key ASC
      `)
    };
  }

  /**
   * Set project metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const serializedValue = PersistenceUtils.safeStringify(value);
    this.statements.insertMetadata.run(key, serializedValue, key);
    this.cachedMetadata.set(key, value);
    this.isDirty = true;
  }

  /**
   * Get project metadata value
   */
  async getMetadata<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Check cache first
    if (this.cachedMetadata.has(key)) {
      return this.cachedMetadata.get(key) as T;
    }

    const row = this.statements.selectMetadata.get(key);
    if (!row) {
      return defaultValue;
    }

    const value = PersistenceUtils.safeParse(row.value);
    this.cachedMetadata.set(key, value);
    return value as T;
  }

  /**
   * Get all project metadata
   */
  async getAllMetadata(): Promise<Record<string, any>> {
    const rows = this.statements.selectAllMetadata.all();
    const metadata: Record<string, any> = {};

    for (const row of rows) {
      const value = PersistenceUtils.safeParse(row.value);
      metadata[row.key] = value;
      this.cachedMetadata.set(row.key, value);
    }

    return metadata;
  }

  /**
   * Update project metadata value
   */
  async updateMetadata(key: string, value: any): Promise<boolean> {
    const serializedValue = PersistenceUtils.safeStringify(value);
    const result = this.statements.updateMetadata.run(serializedValue, key);

    if (result.changes > 0) {
      this.cachedMetadata.set(key, value);
      this.isDirty = true;
      return true;
    }

    return false;
  }

  /**
   * Delete project metadata
   */
  async deleteMetadata(key: string): Promise<boolean> {
    const result = this.statements.deleteMetadata.run(key);

    if (result.changes > 0) {
      this.cachedMetadata.delete(key);
      this.isDirty = true;
      return true;
    }

    return false;
  }

  /**
   * Search metadata by key pattern
   */
  async searchMetadataByKey(pattern: string): Promise<Record<string, any>> {
    const searchPattern = `%${pattern}%`;
    const rows = this.statements.searchMetadataKeys.all(searchPattern);
    const results: Record<string, any> = {};

    for (const row of rows) {
      results[row.key] = PersistenceUtils.safeParse(row.value);
    }

    return results;
  }

  /**
   * Search metadata by value content
   */
  async searchMetadataByValue(pattern: string): Promise<Record<string, any>> {
    const searchPattern = `%${pattern}%`;
    const rows = this.statements.searchMetadataValues.all(searchPattern);
    const results: Record<string, any> = {};

    for (const row of rows) {
      results[row.key] = PersistenceUtils.safeParse(row.value);
    }

    return results;
  }

  /**
   * Get multiple metadata values by keys
   */
  async getMetadataByKeys(keys: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    // Check cache first
    const uncachedKeys: string[] = [];
    for (const key of keys) {
      if (this.cachedMetadata.has(key)) {
        results[key] = this.cachedMetadata.get(key);
      } else {
        uncachedKeys.push(key);
      }
    }

    // Query database for uncached keys
    if (uncachedKeys.length > 0) {
      // For large key sets, use individual queries
      for (const key of uncachedKeys) {
        const row = this.statements.selectMetadata.get(key);
        if (row) {
          const value = PersistenceUtils.safeParse(row.value);
          results[key] = value;
          this.cachedMetadata.set(key, value);
        }
      }
    }

    return results;
  }

  /**
   * Set multiple metadata values atomically
   */
  async setMetadataBatch(metadata: Record<string, any>): Promise<void> {
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(metadata)) {
        const serializedValue = PersistenceUtils.safeStringify(value);
        this.statements.insertMetadata.run(key, serializedValue, key);
        this.cachedMetadata.set(key, value);
      }
    });

    this.isDirty = true;
  }

  /**
   * Initialize project with default configuration
   */
  async initializeProject(config: Partial<ProjectConfiguration>): Promise<void> {
    const defaultConfig: ProjectConfiguration = {
      name: config.name || 'Untitled Project',
      version: config.version || '1.0.0',
      description: config.description || '',
      author: config.author || '',
      license: config.license || 'MIT',
      homepage: config.homepage || '',
      repository: config.repository || '',

      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString(),

      fx_version: '1.0.0', // TODO: Get from FX version
      schema_version: 1,

      default_language: config.default_language || 'js',
      supported_languages: config.supported_languages || ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'cxx'],
      file_extensions: config.file_extensions || {
        js: 'javascript',
        ts: 'typescript',
        jsx: 'javascript',
        tsx: 'typescript',
        py: 'python',
        go: 'go',
        cpp: 'cpp',
        cxx: 'cpp'
      },

      marker_preferences: {
        comment_style: 'auto',
        include_metadata: true,
        include_checksums: true,
        include_version_info: false,
        ...config.marker_preferences
      },

      import_export_settings: {
        auto_detect_language: true,
        preserve_file_structure: true,
        include_hidden_files: false,
        exclude_patterns: ['node_modules', '.git', '*.log', '*.tmp'],
        include_patterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
        git_integration: true,
        backup_on_import: true,
        ...config.import_export_settings
      },

      view_preferences: {
        default_separator: '\n\n',
        default_eol: 'lf',
        auto_hoist_imports: false,
        include_source_maps: false,
        minify_output: false,
        ...config.view_preferences
      },

      performance_settings: {
        enable_caching: true,
        cache_max_size: 100 * 1024 * 1024, // 100MB
        auto_save_interval: 30000, // 30 seconds
        backup_retention_days: 30,
        max_undo_history: 100,
        ...config.performance_settings
      },

      security_settings: {
        allow_external_modules: false,
        sandbox_mode: true,
        trusted_sources: [],
        max_file_size: 10 * 1024 * 1024, // 10MB
        ...config.security_settings
      },

      ui_preferences: {
        theme: 'auto',
        font_family: 'Monaco, Consolas, monospace',
        font_size: 14,
        line_numbers: true,
        word_wrap: false,
        tab_size: 2,
        use_spaces: true,
        ...config.ui_preferences
      },

      custom_settings: config.custom_settings || {}
    };

    // Store configuration as flattened key-value pairs
    const flattened = this.flattenConfiguration(defaultConfig);
    await this.setMetadataBatch(flattened);
  }

  /**
   * Get complete project configuration
   */
  async getProjectConfiguration(): Promise<ProjectConfiguration> {
    const metadata = await this.getAllMetadata();
    return this.unflattenConfiguration(metadata);
  }

  /**
   * Update project configuration
   */
  async updateProjectConfiguration(updates: Partial<ProjectConfiguration>): Promise<void> {
    const current = await this.getProjectConfiguration();
    const updated = { ...current, ...updates, modified_at: new Date().toISOString() };
    const flattened = this.flattenConfiguration(updated);
    await this.setMetadataBatch(flattened);
  }

  /**
   * Get project statistics
   */
  async getMetadataStatistics(): Promise<{
    totalEntries: number;
    totalSize: number;
    lastModified: Date | null;
  }> {
    const count = this.statements.countMetadata.get()?.count || 0;
    const size = this.statements.metadataSize.get()?.total_size || 0;
    const lastMod = this.statements.lastModified.get()?.last_modified;

    return {
      totalEntries: count,
      totalSize: size,
      lastModified: lastMod ? new Date(lastMod) : null
    };
  }

  /**
   * Update last opened timestamp
   */
  async updateLastOpened(): Promise<void> {
    await this.setMetadata('last_opened_at', new Date().toISOString());
  }

  /**
   * Update last saved timestamp
   */
  async updateLastSaved(): Promise<void> {
    await this.setMetadata('last_saved_at', new Date().toISOString());
  }

  /**
   * Export project metadata
   */
  async exportMetadata(): Promise<Record<string, any>> {
    return await this.getAllMetadata();
  }

  /**
   * Import project metadata
   */
  async importMetadata(metadata: Record<string, any>, overwrite = false): Promise<void> {
    if (overwrite) {
      this.statements.deleteAllMetadata.run();
      this.cachedMetadata.clear();
    }

    await this.setMetadataBatch(metadata);
  }

  /**
   * Clear cache and mark as clean
   */
  clearCache(): void {
    this.cachedMetadata.clear();
    this.isDirty = false;
  }

  /**
   * Check if metadata has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[MetadataPersistence] Error finalizing statement:", error);
      }
    }
    this.statements = {};
    this.cachedMetadata.clear();
  }

  // Private helper methods

  private flattenConfiguration(config: ProjectConfiguration): Record<string, any> {
    const flattened: Record<string, any> = {};

    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value, fullKey);
        } else {
          flattened[fullKey] = value;
        }
      }
    };

    flatten(config);
    return flattened;
  }

  private unflattenConfiguration(flattened: Record<string, any>): ProjectConfiguration {
    const config: any = {};

    for (const [key, value] of Object.entries(flattened)) {
      const parts = key.split('.');
      let current = config;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }

      current[parts[parts.length - 1]] = value;
    }

    return config as ProjectConfiguration;
  }
}

/**
 * Factory function to create metadata persistence instance
 */
export function createMetadataPersistence(db: SQLiteDatabase): MetadataPersistence {
  return new MetadataPersistence(db);
}