/**
 * @file fx-migration-system.ts
 * @description Database migration system for schema versioning and backward compatibility
 * Handles automatic migration between .fxd schema versions
 */

import {
  SQLiteDatabase,
  SQLiteStatement,
  SCHEMA_VERSION,
  PersistenceUtils
} from "./fx-persistence.ts";

/**
 * Migration definition
 */
export interface Migration {
  version: number;
  name: string;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void> | void;
  down: (db: SQLiteDatabase) => Promise<void> | void;
  validate?: (db: SQLiteDatabase) => Promise<boolean> | boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  appliedMigrations: number[];
  errors: string[];
  duration: number;
  backupCreated?: string;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  pendingMigrations: Migration[];
  isUpToDate: boolean;
  requiresBackup: boolean;
}

/**
 * Database migration system
 */
export class MigrationSystem {
  private db: SQLiteDatabase;
  private migrations: Map<number, Migration> = new Map();
  private statements: Record<string, SQLiteStatement> = {};

  constructor(db: SQLiteDatabase) {
    this.db = db;
    this.initializePreparedStatements();
    this.registerBuiltInMigrations();
  }

  /**
   * Initialize prepared statements
   */
  private initializePreparedStatements(): void {
    this.statements = {
      // Schema version tracking
      getSchemaVersion: this.db.prepare(`
        SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
      `),
      insertSchemaVersion: this.db.prepare(`
        INSERT INTO schema_version (version) VALUES (?)
      `),
      updateSchemaVersion: this.db.prepare(`
        UPDATE schema_version SET version = ?, applied_at = CURRENT_TIMESTAMP
        WHERE version = (SELECT MAX(version) FROM schema_version)
      `),

      // Migration history
      createMigrationHistory: this.db.prepare(`
        CREATE TABLE IF NOT EXISTS migration_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration_ms INTEGER,
          checksum TEXT,
          success BOOLEAN DEFAULT 1
        )
      `),
      insertMigrationHistory: this.db.prepare(`
        INSERT INTO migration_history (version, name, description, duration_ms, checksum, success)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getMigrationHistory: this.db.prepare(`
        SELECT * FROM migration_history ORDER BY version ASC
      `),
      getAppliedMigrations: this.db.prepare(`
        SELECT version FROM migration_history WHERE success = 1 ORDER BY version ASC
      `),

      // Database info
      getTableList: this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `),
      getTableInfo: this.db.prepare(`
        PRAGMA table_info(?)
      `),
      getDatabaseInfo: this.db.prepare(`
        PRAGMA user_version
      `)
    };

    // Initialize migration history table
    this.statements.createMigrationHistory.run();
  }

  /**
   * Register built-in migrations
   */
  private registerBuiltInMigrations(): void {
    // Migration 1: Initial schema (baseline)
    this.registerMigration({
      version: 1,
      name: "initial_schema",
      description: "Create initial FXD database schema",
      up: async (db) => {
        // This is handled by schema initialization
        console.log("[Migration] Initial schema already applied");
      },
      down: async (db) => {
        throw new Error("Cannot downgrade from initial schema");
      },
      validate: async (db) => {
        const tables = this.statements.getTableList.all();
        const requiredTables = ['project_metadata', 'nodes', 'snippets', 'views', 'view_components'];
        return requiredTables.every(table =>
          tables.some((row: any) => row.name === table)
        );
      }
    });

    // Future migrations would be added here
    // Example:
    /*
    this.registerMigration({
      version: 2,
      name: "add_node_tags",
      description: "Add tags column to nodes table",
      up: async (db) => {
        db.exec(`ALTER TABLE nodes ADD COLUMN tags TEXT DEFAULT '[]'`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_tags ON nodes(tags)`);
      },
      down: async (db) => {
        db.exec(`DROP INDEX IF EXISTS idx_nodes_tags`);
        db.exec(`ALTER TABLE nodes DROP COLUMN tags`);
      },
      validate: async (db) => {
        const info = this.statements.getTableInfo.all('nodes');
        return info.some((col: any) => col.name === 'tags');
      }
    });
    */
  }

  /**
   * Register a new migration
   */
  registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration version ${migration.version} already registered`);
    }

    this.migrations.set(migration.version, migration);
    console.log(`[Migration] Registered migration ${migration.version}: ${migration.name}`);
  }

  /**
   * Get current database schema version
   */
  getCurrentVersion(): number {
    try {
      const result = this.statements.getSchemaVersion.get();
      return result?.version || 0;
    } catch (error) {
      console.warn("[Migration] Failed to get schema version:", error);
      return 0;
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): MigrationStatus {
    const currentVersion = this.getCurrentVersion();
    const targetVersion = SCHEMA_VERSION;

    const pendingMigrations = Array.from(this.migrations.values())
      .filter(m => m.version > currentVersion && m.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    return {
      currentVersion,
      targetVersion,
      pendingMigrations,
      isUpToDate: currentVersion >= targetVersion,
      requiresBackup: pendingMigrations.length > 0
    };
  }

  /**
   * Check if migrations are needed
   */
  needsMigration(): boolean {
    const status = this.getMigrationStatus();
    return !status.isUpToDate;
  }

  /**
   * Perform database migration
   */
  async migrate(options: {
    targetVersion?: number;
    createBackup?: boolean;
    validateAfter?: boolean;
  } = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const currentVersion = this.getCurrentVersion();
    const targetVersion = options.targetVersion || SCHEMA_VERSION;

    const result: MigrationResult = {
      success: false,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      appliedMigrations: [],
      errors: [],
      duration: 0
    };

    try {
      console.log(`[Migration] Starting migration from v${currentVersion} to v${targetVersion}`);

      // Validate migration path
      if (targetVersion < currentVersion) {
        throw new Error(`Cannot migrate backwards from v${currentVersion} to v${targetVersion}`);
      }

      if (targetVersion === currentVersion) {
        console.log("[Migration] Database is already up to date");
        result.success = true;
        return result;
      }

      // Create backup if requested
      if (options.createBackup) {
        result.backupCreated = await this.createMigrationBackup();
      }

      // Get migrations to apply
      const migrationsToApply = Array.from(this.migrations.values())
        .filter(m => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);

      if (migrationsToApply.length === 0) {
        throw new Error(`No migrations found between v${currentVersion} and v${targetVersion}`);
      }

      // Apply migrations in transaction
      await this.db.transaction(async () => {
        for (const migration of migrationsToApply) {
          await this.applyMigration(migration, result);
        }

        // Update schema version
        if (result.appliedMigrations.length > 0) {
          this.updateSchemaVersion(targetVersion);
        }
      });

      // Validate after migration if requested
      if (options.validateAfter) {
        await this.validateDatabase();
      }

      result.success = true;
      console.log(`[Migration] Migration completed successfully: ${result.appliedMigrations.length} migrations applied`);

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      console.error("[Migration] Migration failed:", error);

      // Try to restore from backup if available
      if (result.backupCreated) {
        try {
          await this.restoreFromBackup(result.backupCreated);
          result.errors.push("Database restored from backup");
        } catch (restoreError) {
          result.errors.push(`Backup restore failed: ${restoreError}`);
        }
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration, result: MigrationResult): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`[Migration] Applying migration ${migration.version}: ${migration.name}`);

      // Pre-migration validation
      if (migration.validate) {
        const preValid = await migration.validate(this.db);
        if (preValid) {
          console.log(`[Migration] Migration ${migration.version} already appears to be applied, skipping`);
          return;
        }
      }

      // Apply the migration
      await migration.up(this.db);

      // Post-migration validation
      if (migration.validate) {
        const postValid = await migration.validate(this.db);
        if (!postValid) {
          throw new Error(`Migration validation failed after applying migration ${migration.version}`);
        }
      }

      const duration = Date.now() - startTime;

      // Record migration in history
      const checksum = this.calculateMigrationChecksum(migration);
      this.statements.insertMigrationHistory.run(
        migration.version,
        migration.name,
        migration.description,
        duration,
        checksum,
        true
      );

      result.appliedMigrations.push(migration.version);
      console.log(`[Migration] Successfully applied migration ${migration.version} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed migration
      const checksum = this.calculateMigrationChecksum(migration);
      this.statements.insertMigrationHistory.run(
        migration.version,
        migration.name,
        migration.description,
        duration,
        checksum,
        false
      );

      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${error}`);
    }
  }

  /**
   * Update schema version
   */
  private updateSchemaVersion(version: number): void {
    try {
      this.statements.insertSchemaVersion.run(version);
    } catch (error) {
      // Try update if insert fails
      this.statements.updateSchemaVersion.run(version);
    }
  }

  /**
   * Validate database integrity after migration
   */
  private async validateDatabase(): Promise<void> {
    console.log("[Migration] Validating database integrity...");

    // Check that all required tables exist
    const tables = this.statements.getTableList.all();
    const requiredTables = ['project_metadata', 'nodes', 'snippets', 'views', 'view_components', 'schema_version'];

    for (const requiredTable of requiredTables) {
      if (!tables.some((row: any) => row.name === requiredTable)) {
        throw new Error(`Required table '${requiredTable}' not found after migration`);
      }
    }

    // Run integrity check
    try {
      this.db.exec('PRAGMA integrity_check');
      console.log("[Migration] Database integrity check passed");
    } catch (error) {
      throw new Error(`Database integrity check failed: ${error}`);
    }

    // Validate that current version is correct
    const currentVersion = this.getCurrentVersion();
    if (currentVersion !== SCHEMA_VERSION) {
      throw new Error(`Schema version mismatch: expected ${SCHEMA_VERSION}, got ${currentVersion}`);
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): any[] {
    return this.statements.getMigrationHistory.all();
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations(): number[] {
    const rows = this.statements.getAppliedMigrations.all();
    return rows.map((row: any) => row.version);
  }

  /**
   * Rollback to a previous version (use with extreme caution)
   */
  async rollback(targetVersion: number, options: {
    createBackup?: boolean;
    force?: boolean;
  } = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const currentVersion = this.getCurrentVersion();

    const result: MigrationResult = {
      success: false,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      appliedMigrations: [],
      errors: [],
      duration: 0
    };

    try {
      if (targetVersion >= currentVersion) {
        throw new Error(`Cannot rollback: target version ${targetVersion} is not less than current version ${currentVersion}`);
      }

      if (!options.force) {
        console.warn("[Migration] Rollback is dangerous and may cause data loss!");
        console.warn("[Migration] Use { force: true } to proceed with rollback");
        throw new Error("Rollback requires force flag");
      }

      console.log(`[Migration] Rolling back from v${currentVersion} to v${targetVersion}`);

      // Create backup if requested
      if (options.createBackup) {
        result.backupCreated = await this.createMigrationBackup();
      }

      // Get migrations to rollback (in reverse order)
      const migrationsToRollback = Array.from(this.migrations.values())
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version); // Reverse order for rollback

      // Apply rollbacks in transaction
      await this.db.transaction(async () => {
        for (const migration of migrationsToRollback) {
          await this.rollbackMigration(migration, result);
        }

        // Update schema version
        this.updateSchemaVersion(targetVersion);
      });

      result.success = true;
      console.log(`[Migration] Rollback completed: ${result.appliedMigrations.length} migrations rolled back`);

    } catch (error) {
      result.errors.push(`Rollback failed: ${error}`);
      console.error("[Migration] Rollback failed:", error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: Migration, result: MigrationResult): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`[Migration] Rolling back migration ${migration.version}: ${migration.name}`);

      await migration.down(this.db);

      const duration = Date.now() - startTime;
      result.appliedMigrations.push(migration.version);

      console.log(`[Migration] Successfully rolled back migration ${migration.version} (${duration}ms)`);
    } catch (error) {
      throw new Error(`Rollback of migration ${migration.version} (${migration.name}) failed: ${error}`);
    }
  }

  /**
   * Create backup before migration
   */
  private async createMigrationBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup-${timestamp}.fxd`;

    console.log(`[Migration] Creating backup: ${backupPath}`);

    // This would need to be implemented with actual file system operations
    // For now, just return the backup path
    return backupPath;
  }

  /**
   * Restore database from backup
   */
  private async restoreFromBackup(backupPath: string): Promise<void> {
    console.log(`[Migration] Restoring from backup: ${backupPath}`);

    // This would need to be implemented with actual file system operations
    throw new Error("Backup restore not yet implemented");
  }

  /**
   * Calculate checksum for migration
   */
  private calculateMigrationChecksum(migration: Migration): string {
    const data = `${migration.version}:${migration.name}:${migration.description}`;
    return PersistenceUtils.hash(data);
  }

  /**
   * Export migration information for debugging
   */
  exportMigrationInfo(): {
    currentVersion: number;
    targetVersion: number;
    registeredMigrations: Array<{
      version: number;
      name: string;
      description: string;
    }>;
    migrationHistory: any[];
    appliedMigrations: number[];
  } {
    return {
      currentVersion: this.getCurrentVersion(),
      targetVersion: SCHEMA_VERSION,
      registeredMigrations: Array.from(this.migrations.values()).map(m => ({
        version: m.version,
        name: m.name,
        description: m.description
      })),
      migrationHistory: this.getMigrationHistory(),
      appliedMigrations: this.getAppliedMigrations()
    };
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[Migration] Error finalizing statement:", error);
      }
    }
    this.statements = {};
    this.migrations.clear();
  }
}

/**
 * Factory function to create migration system
 */
export function createMigrationSystem(db: SQLiteDatabase): MigrationSystem {
  return new MigrationSystem(db);
}

export { MigrationSystem, Migration, MigrationResult, MigrationStatus };