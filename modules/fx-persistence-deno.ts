/**
 * Deno SQLite adapter for FX Persistence
 * Wraps Deno's SQLite library to match our interface
 */

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import type { SQLiteDatabase, SQLiteStatement } from "./fx-persistence.ts";
import { FXPersistence, SchemaManager } from "./fx-persistence.ts";

/**
 * Adapter for Deno SQLite Statement
 */
class DenoSQLiteStatement implements SQLiteStatement {
  constructor(private stmt: any, private db: DB) {}

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    this.stmt.execute(params);
    return {
      changes: this.db.changes,
      lastInsertRowid: this.db.lastInsertRowId
    };
  }

  get(...params: any[]): any {
    const result = this.stmt.oneEntry(params);
    return result || undefined;
  }

  all(...params: any[]): any[] {
    return this.stmt.allEntries(params);
  }

  finalize(): void {
    this.stmt.finalize();
  }
}

/**
 * Adapter for Deno SQLite Database
 */
class DenoSQLiteDatabase implements SQLiteDatabase {
  private _inTransaction = false;

  constructor(private db: DB) {}

  prepare(sql: string): SQLiteStatement {
    const stmt = this.db.prepareQuery(sql);
    return new DenoSQLiteStatement(stmt, this.db);
  }

  exec(sql: string): void {
    this.db.execute(sql);
  }

  close(): void {
    this.db.close();
  }

  get inTransaction(): boolean {
    return this._inTransaction;
  }

  transaction<T>(fn: () => T): T {
    this._inTransaction = true;
    try {
      this.db.execute('BEGIN TRANSACTION');
      const result = fn();
      this.db.execute('COMMIT');
      return result;
    } catch (error) {
      this.db.execute('ROLLBACK');
      throw error;
    } finally {
      this._inTransaction = false;
    }
  }
}

/**
 * Create and open a .fxd file for persistence
 */
export function openFXD(filePath: string): FXPersistence {
  const db = new DB(filePath);
  const adapter = new DenoSQLiteDatabase(db);
  const persistence = new FXPersistence(adapter);

  // Initialize schema if new file
  persistence.initialize();

  return persistence;
}

/**
 * Create a new .fxd file
 */
export function createFXD(filePath: string): FXPersistence {
  // Delete if exists
  try {
    Deno.removeSync(filePath);
  } catch {
    // File doesn't exist, that's fine
  }

  return openFXD(filePath);
}

/**
 * Simple API for common operations
 */
export class FXDisk {
  private persistence: FXPersistence;

  constructor(filePath: string, create = false) {
    this.persistence = create ? createFXD(filePath) : openFXD(filePath);
  }

  /**
   * Save current FX graph to disk
   */
  save(): void {
    this.persistence.save();
  }

  /**
   * Load FX graph from disk
   */
  load(): void {
    this.persistence.load();
  }

  /**
   * Get statistics about the database
   */
  stats(): { nodes: number; snippets: number; views: number } {
    return this.persistence.getStats();
  }

  /**
   * Close the database
   */
  close(): void {
    this.persistence.close();
  }
}

// Convenience export
export { FXPersistence };
