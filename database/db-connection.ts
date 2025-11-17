/**
 * @file db-connection.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description Database connection manager for SQLite persistence layer
 * Provides connection pooling, transaction management, and prepared statement caching
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * SQLite Statement interface for type safety
 */
export interface SQLiteStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
  finalize(): void;
}

/**
 * SQLite Database interface abstraction
 */
export interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
  readonly inTransaction: boolean;
  transaction<T>(fn: () => T): () => T;
}

/**
 * Database connection options
 */
export interface DBConnectionOptions {
  filePath: string;
  readonly?: boolean;
  memory?: boolean;
  verbose?: boolean;
  timeout?: number;
  wal?: boolean; // Write-Ahead Logging mode
}

/**
 * Database connection manager
 * Handles SQLite database connections with proper initialization and cleanup
 */
export class DBConnection implements SQLiteDatabase {
  private db: Database.Database | null = null;
  private options: DBConnectionOptions;
  private statementCache: Map<string, SQLiteStatement> = new Map();
  private isOpen = false;

  constructor(options: DBConnectionOptions) {
    this.options = {
      timeout: 5000,
      wal: true,
      ...options
    };
  }

  /**
   * Open database connection and initialize schema
   */
  async open(): Promise<void> {
    if (this.isOpen) {
      console.warn('[DBConnection] Database already open');
      return;
    }

    try {
      console.log(`[DBConnection] Opening database: ${this.options.filePath}`);

      // Create database connection
      this.db = new Database(this.options.filePath, {
        readonly: this.options.readonly,
        fileMustExist: false,
        timeout: this.options.timeout,
        verbose: this.options.verbose ? console.log : undefined
      });

      // Configure database
      this.configure();

      // Initialize schema
      await this.initializeSchema();

      this.isOpen = true;
      console.log('[DBConnection] Database opened successfully');
    } catch (error) {
      console.error('[DBConnection] Failed to open database:', error);
      throw error;
    }
  }

  /**
   * Configure database settings for optimal performance
   */
  private configure(): void {
    if (!this.db) return;

    // Enable Write-Ahead Logging for better concurrency
    if (this.options.wal && !this.options.readonly) {
      this.db.pragma('journal_mode = WAL');
    }

    // Set synchronous mode for durability vs performance balance
    this.db.pragma('synchronous = NORMAL');

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Set cache size (negative value = KB, positive = pages)
    this.db.pragma('cache_size = -64000'); // 64MB cache

    // Set temp store to memory for better performance
    this.db.pragma('temp_store = MEMORY');

    console.log('[DBConnection] Database configured');
  }

  /**
   * Initialize database schema from schema.sql file
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Check if schema already exists
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'
      `).get();

      if (tables) {
        console.log('[DBConnection] Schema already exists');
        return;
      }

      // Read schema file
      const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

      if (!existsSync(schemaPath)) {
        console.warn('[DBConnection] schema.sql not found, creating basic schema');
        this.createBasicSchema();
        return;
      }

      const schemaSQL = readFileSync(schemaPath, 'utf-8');

      // Execute schema in a transaction
      const initTransaction = this.db.transaction(() => {
        this.db!.exec(schemaSQL);
      });

      initTransaction();

      console.log('[DBConnection] Schema initialized from schema.sql');
    } catch (error) {
      console.error('[DBConnection] Schema initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create basic schema if schema.sql is not available
   */
  private createBasicSchema(): void {
    if (!this.db) return;

    const basicSchema = `
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
        is_dirty BOOLEAN DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
    `;

    this.db.exec(basicSchema);
    console.log('[DBConnection] Basic schema created');
  }

  /**
   * Prepare a SQL statement with caching
   */
  prepare(sql: string): SQLiteStatement {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Check cache first
    if (this.statementCache.has(sql)) {
      return this.statementCache.get(sql)!;
    }

    // Prepare new statement
    const stmt = this.db.prepare(sql);
    this.statementCache.set(sql, stmt as SQLiteStatement);

    return stmt as SQLiteStatement;
  }

  /**
   * Execute SQL directly
   */
  exec(sql: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.exec(sql);
  }

  /**
   * Create a transaction function
   */
  transaction<T>(fn: () => T): () => T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.transaction(fn);
  }

  /**
   * Check if currently in a transaction
   */
  get inTransaction(): boolean {
    return this.db?.inTransaction ?? false;
  }

  /**
   * Vacuum database to reclaim space and optimize
   */
  vacuum(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.log('[DBConnection] Running VACUUM...');
    this.db.exec('VACUUM');
    console.log('[DBConnection] VACUUM completed');
  }

  /**
   * Run checkpoint on WAL file
   */
  checkpoint(mode: 'passive' | 'full' | 'restart' | 'truncate' = 'passive'): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const modeMap = {
      passive: 0,
      full: 1,
      restart: 2,
      truncate: 3
    };

    this.db.pragma(`wal_checkpoint(${modeMap[mode]})`);
    console.log(`[DBConnection] WAL checkpoint (${mode}) completed`);
  }

  /**
   * Get database statistics
   */
  getStats(): {
    pageCount: number;
    pageSize: number;
    freePages: number;
    cacheSize: number;
    walMode: boolean;
    inTransaction: boolean;
  } {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const pageCount = this.db.pragma('page_count', { simple: true }) as number;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;
    const freePages = this.db.pragma('freelist_count', { simple: true }) as number;
    const cacheSize = Math.abs(this.db.pragma('cache_size', { simple: true }) as number);
    const journalMode = this.db.pragma('journal_mode', { simple: true }) as string;

    return {
      pageCount,
      pageSize,
      freePages,
      cacheSize,
      walMode: journalMode === 'wal',
      inTransaction: this.inTransaction
    };
  }

  /**
   * Backup database to a file
   */
  async backup(destPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        this.db!.backup(destPath)
          .then(() => {
            console.log(`[DBConnection] Backup completed: ${destPath}`);
            resolve();
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Close database connection and cleanup
   */
  close(): void {
    if (!this.isOpen) {
      console.warn('[DBConnection] Database already closed');
      return;
    }

    try {
      // Finalize all cached statements
      for (const stmt of this.statementCache.values()) {
        try {
          stmt.finalize();
        } catch (error) {
          console.warn('[DBConnection] Error finalizing statement:', error);
        }
      }
      this.statementCache.clear();

      // Close database
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.isOpen = false;
      console.log('[DBConnection] Database closed');
    } catch (error) {
      console.error('[DBConnection] Error closing database:', error);
      throw error;
    }
  }

  /**
   * Check if database is open
   */
  isOpened(): boolean {
    return this.isOpen && this.db !== null;
  }

  /**
   * Get raw database instance (use with caution)
   */
  getRawDB(): Database.Database | null {
    return this.db;
  }
}

/**
 * Factory function to create and open a database connection
 */
export async function createDBConnection(options: DBConnectionOptions): Promise<DBConnection> {
  const connection = new DBConnection(options);
  await connection.open();
  return connection;
}

/**
 * Create an in-memory database for testing
 */
export async function createInMemoryDB(): Promise<DBConnection> {
  return createDBConnection({
    filePath: ':memory:',
    memory: true,
    wal: false
  });
}
