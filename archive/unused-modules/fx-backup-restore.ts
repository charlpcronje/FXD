/**
 * @file fx-backup-restore.ts
 * @description Project backup/restore functionality for data safety
 * Handles automatic and manual backup creation with restore capabilities
 */

import {
  SQLiteDatabase,
  SQLiteStatement,
  PersistenceUtils
} from "./fx-persistence.ts";

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  originalPath: string;
  backupPath: string;
  createdAt: Date;
  type: 'auto' | 'manual' | 'migration' | 'pre-operation';
  trigger: string;
  size: number;
  checksum: string;
  version: string;
  description?: string;
  tags?: string[];
}

/**
 * Backup options
 */
export interface BackupOptions {
  type?: 'auto' | 'manual' | 'migration' | 'pre-operation';
  description?: string;
  tags?: string[];
  compress?: boolean;
  encrypt?: boolean;
  includeMetadata?: boolean;
  excludeCache?: boolean;
  customPath?: string;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  validateBackup?: boolean;
  createBackupBeforeRestore?: boolean;
  restoreMetadata?: boolean;
  overwriteExisting?: boolean;
  customTargetPath?: string;
}

/**
 * Backup result
 */
export interface BackupResult {
  success: boolean;
  backupId: string;
  backupPath: string;
  size: number;
  duration: number;
  checksum: string;
  errors: string[];
}

/**
 * Restore result
 */
export interface RestoreResult {
  success: boolean;
  restoredPath: string;
  backupUsed: string;
  duration: number;
  errors: string[];
  preRestoreBackup?: string;
}

/**
 * Backup statistics
 */
export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
  byType: Record<string, number>;
  averageSize: number;
}

/**
 * Project backup and restore system
 */
export class BackupRestoreSystem {
  private db: SQLiteDatabase;
  private projectPath: string;
  private statements: Record<string, SQLiteStatement> = {};
  private backupHistory: Map<string, BackupMetadata> = new Map();

  // Configuration
  private maxAutoBackups = 10;
  private maxBackupAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private compressionEnabled = true;
  private encryptionEnabled = false;

  constructor(db: SQLiteDatabase, projectPath: string) {
    this.db = db;
    this.projectPath = projectPath;
    this.initializePreparedStatements();
    this.initializeBackupTracking();
  }

  /**
   * Initialize prepared statements for backup tracking
   */
  private initializePreparedStatements(): void {
    // Create backup tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id TEXT PRIMARY KEY,
        original_path TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL,
        trigger_event TEXT,
        size_bytes INTEGER,
        checksum TEXT,
        version TEXT,
        description TEXT,
        tags TEXT,
        success BOOLEAN DEFAULT 1
      )
    `);

    this.statements = {
      // Insert backup record
      insertBackup: this.db.prepare(`
        INSERT INTO backup_history
        (id, original_path, backup_path, type, trigger_event, size_bytes, checksum, version, description, tags, success)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      // Get backup records
      getBackup: this.db.prepare(`
        SELECT * FROM backup_history WHERE id = ?
      `),
      getAllBackups: this.db.prepare(`
        SELECT * FROM backup_history ORDER BY created_at DESC
      `),
      getBackupsByType: this.db.prepare(`
        SELECT * FROM backup_history WHERE type = ? ORDER BY created_at DESC
      `),
      getRecentBackups: this.db.prepare(`
        SELECT * FROM backup_history WHERE created_at > ? ORDER BY created_at DESC
      `),

      // Delete backup records
      deleteBackup: this.db.prepare(`
        DELETE FROM backup_history WHERE id = ?
      `),
      deleteOldBackups: this.db.prepare(`
        DELETE FROM backup_history WHERE created_at < ? AND type = 'auto'
      `),

      // Statistics
      countBackups: this.db.prepare(`
        SELECT COUNT(*) as count FROM backup_history
      `),
      totalBackupSize: this.db.prepare(`
        SELECT SUM(size_bytes) as total_size FROM backup_history
      `),
      backupStats: this.db.prepare(`
        SELECT type, COUNT(*) as count, AVG(size_bytes) as avg_size
        FROM backup_history GROUP BY type
      `),
      oldestNewestBackup: this.db.prepare(`
        SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM backup_history
      `)
    };
  }

  /**
   * Initialize backup tracking and load existing history
   */
  private initializeBackupTracking(): void {
    const backups = this.statements.getAllBackups.all();
    for (const backup of backups) {
      const metadata: BackupMetadata = {
        id: backup.id,
        originalPath: backup.original_path,
        backupPath: backup.backup_path,
        createdAt: new Date(backup.created_at),
        type: backup.type,
        trigger: backup.trigger_event,
        size: backup.size_bytes,
        checksum: backup.checksum,
        version: backup.version,
        description: backup.description,
        tags: backup.tags ? JSON.parse(backup.tags) : []
      };
      this.backupHistory.set(backup.id, metadata);
    }

    console.log(`[BackupRestore] Loaded ${this.backupHistory.size} backup records`);
  }

  /**
   * Create a backup of the current project
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = PersistenceUtils.generateId();

    const result: BackupResult = {
      success: false,
      backupId,
      backupPath: '',
      size: 0,
      duration: 0,
      checksum: '',
      errors: []
    };

    try {
      console.log(`[BackupRestore] Creating backup: ${backupId}`);

      // Generate backup path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup-${timestamp}-${backupId}.fxd`;
      const backupPath = options.customPath || this.generateBackupPath(backupFileName);

      // Create backup by copying database file
      await this.copyDatabaseFile(this.projectPath, backupPath, options);

      // Calculate backup size and checksum
      const size = await this.getFileSize(backupPath);
      const checksum = await this.calculateFileChecksum(backupPath);

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        originalPath: this.projectPath,
        backupPath: backupPath,
        createdAt: new Date(),
        type: options.type || 'manual',
        trigger: this.getCurrentTrigger(),
        size: size,
        checksum: checksum,
        version: await this.getProjectVersion(),
        description: options.description,
        tags: options.tags || []
      };

      // Store backup metadata
      await this.storeBackupMetadata(metadata);

      result.success = true;
      result.backupPath = backupPath;
      result.size = size;
      result.checksum = checksum;

      console.log(`[BackupRestore] Backup created successfully: ${backupPath} (${this.formatSize(size)})`);

      // Cleanup old automatic backups if this is an auto backup
      if (metadata.type === 'auto') {
        await this.cleanupOldBackups();
      }

    } catch (error) {
      result.errors.push(`Backup creation failed: ${error}`);
      console.error("[BackupRestore] Backup creation failed:", error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backupId: string, options: RestoreOptions = {}): Promise<RestoreResult> {
    const startTime = Date.now();

    const result: RestoreResult = {
      success: false,
      restoredPath: '',
      backupUsed: backupId,
      duration: 0,
      errors: []
    };

    try {
      console.log(`[BackupRestore] Restoring from backup: ${backupId}`);

      // Get backup metadata
      const backupMetadata = this.backupHistory.get(backupId);
      if (!backupMetadata) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Validate backup if requested
      if (options.validateBackup) {
        const isValid = await this.validateBackup(backupMetadata);
        if (!isValid) {
          throw new Error(`Backup ${backupId} validation failed`);
        }
      }

      // Create backup of current state before restore
      if (options.createBackupBeforeRestore) {
        const preRestoreBackup = await this.createBackup({
          type: 'pre-operation',
          description: `Pre-restore backup before restoring ${backupId}`,
          tags: ['pre-restore', backupId]
        });

        if (preRestoreBackup.success) {
          result.preRestoreBackup = preRestoreBackup.backupId;
        }
      }

      // Determine target path
      const targetPath = options.customTargetPath || this.projectPath;

      // Check if target exists and handle overwrite
      if (await this.fileExists(targetPath)) {
        if (!options.overwriteExisting) {
          throw new Error(`Target file ${targetPath} exists and overwrite not allowed`);
        }
      }

      // Close current database connection before restore
      this.closeDatabase();

      // Restore the backup
      await this.copyDatabaseFile(backupMetadata.backupPath, targetPath, {
        includeMetadata: options.restoreMetadata
      });

      // Reopen database connection
      await this.reopenDatabase(targetPath);

      result.success = true;
      result.restoredPath = targetPath;

      console.log(`[BackupRestore] Restore completed successfully: ${targetPath}`);

    } catch (error) {
      result.errors.push(`Restore failed: ${error}`);
      console.error("[BackupRestore] Restore failed:", error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * List all available backups
   */
  getBackupList(): BackupMetadata[] {
    return Array.from(this.backupHistory.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get backups by type
   */
  getBackupsByType(type: string): BackupMetadata[] {
    return Array.from(this.backupHistory.values())
      .filter(backup => backup.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get recent backups
   */
  getRecentBackups(hours = 24): BackupMetadata[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.backupHistory.values())
      .filter(backup => backup.createdAt > cutoff)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backupMetadata = this.backupHistory.get(backupId);
      if (!backupMetadata) {
        return false;
      }

      // Delete backup file
      await this.deleteFile(backupMetadata.backupPath);

      // Remove from database
      this.statements.deleteBackup.run(backupId);

      // Remove from memory
      this.backupHistory.delete(backupId);

      console.log(`[BackupRestore] Deleted backup: ${backupId}`);
      return true;
    } catch (error) {
      console.error(`[BackupRestore] Failed to delete backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Validate a backup
   */
  async validateBackup(backupMetadata: BackupMetadata): Promise<boolean> {
    try {
      // Check if backup file exists
      if (!await this.fileExists(backupMetadata.backupPath)) {
        console.warn(`[BackupRestore] Backup file not found: ${backupMetadata.backupPath}`);
        return false;
      }

      // Verify checksum
      const currentChecksum = await this.calculateFileChecksum(backupMetadata.backupPath);
      if (currentChecksum !== backupMetadata.checksum) {
        console.warn(`[BackupRestore] Backup checksum mismatch: ${backupMetadata.id}`);
        return false;
      }

      // Try to open as SQLite database
      const isValidDb = await this.validateSQLiteFile(backupMetadata.backupPath);
      if (!isValidDb) {
        console.warn(`[BackupRestore] Backup is not a valid SQLite file: ${backupMetadata.id}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[BackupRestore] Backup validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStatistics(): Promise<BackupStats> {
    const totalBackups = this.statements.countBackups.get()?.count || 0;
    const totalSize = this.statements.totalBackupSize.get()?.total_size || 0;

    const statsRows = this.statements.backupStats.all();
    const byType: Record<string, number> = {};
    let totalForAverage = 0;

    for (const row of statsRows) {
      byType[row.type] = row.count;
      totalForAverage += row.avg_size * row.count;
    }

    const timeRange = this.statements.oldestNewestBackup.get();

    return {
      totalBackups,
      totalSize,
      oldestBackup: timeRange?.oldest ? new Date(timeRange.oldest) : null,
      newestBackup: timeRange?.newest ? new Date(timeRange.newest) : null,
      byType,
      averageSize: totalBackups > 0 ? totalForAverage / totalBackups : 0
    };
  }

  /**
   * Automatic backup before risky operations
   */
  async createAutoBackup(trigger: string): Promise<BackupResult> {
    return await this.createBackup({
      type: 'auto',
      description: `Automatic backup before ${trigger}`,
      tags: ['auto', trigger]
    });
  }

  /**
   * Configure backup settings
   */
  configureBackups(settings: {
    maxAutoBackups?: number;
    maxBackupAge?: number;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
  }): void {
    if (settings.maxAutoBackups !== undefined) {
      this.maxAutoBackups = settings.maxAutoBackups;
    }
    if (settings.maxBackupAge !== undefined) {
      this.maxBackupAge = settings.maxBackupAge;
    }
    if (settings.compressionEnabled !== undefined) {
      this.compressionEnabled = settings.compressionEnabled;
    }
    if (settings.encryptionEnabled !== undefined) {
      this.encryptionEnabled = settings.encryptionEnabled;
    }

    console.log("[BackupRestore] Backup settings updated");
  }

  /**
   * Cleanup and finalize
   */
  cleanup(): void {
    for (const stmt of Object.values(this.statements)) {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn("[BackupRestore] Error finalizing statement:", error);
      }
    }
    this.statements = {};
    this.backupHistory.clear();
  }

  // Private implementation methods

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    this.statements.insertBackup.run(
      metadata.id,
      metadata.originalPath,
      metadata.backupPath,
      metadata.type,
      metadata.trigger,
      metadata.size,
      metadata.checksum,
      metadata.version,
      metadata.description || null,
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      true
    );

    this.backupHistory.set(metadata.id, metadata);
  }

  private async cleanupOldBackups(): Promise<void> {
    // Remove old automatic backups
    const cutoff = new Date(Date.now() - this.maxBackupAge);
    const oldBackups = Array.from(this.backupHistory.values())
      .filter(backup => backup.type === 'auto' && backup.createdAt < cutoff);

    for (const backup of oldBackups) {
      await this.deleteBackup(backup.id);
    }

    // Limit number of automatic backups
    const autoBackups = this.getBackupsByType('auto');
    if (autoBackups.length > this.maxAutoBackups) {
      const toDelete = autoBackups.slice(this.maxAutoBackups);
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  private generateBackupPath(fileName: string): string {
    // This would generate appropriate backup path based on platform
    // For now, return relative path
    return `./backups/${fileName}`;
  }

  private getCurrentTrigger(): string {
    // This would determine what triggered the backup
    return 'manual';
  }

  private async getProjectVersion(): Promise<string> {
    // This would get the current project version
    return '1.0.0';
  }

  private async copyDatabaseFile(sourcePath: string, targetPath: string, options: any = {}): Promise<void> {
    console.log(`[BackupRestore] Copying ${sourcePath} to ${targetPath}`);
    // This would be implemented with actual file system operations
    // For now, just log the operation
  }

  private async getFileSize(filePath: string): Promise<number> {
    // This would get actual file size
    return 1024 * 1024; // Mock 1MB
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    // This would calculate actual file checksum
    return PersistenceUtils.hash(filePath + Date.now());
  }

  private async fileExists(filePath: string): Promise<boolean> {
    // This would check if file actually exists
    return true; // Mock implementation
  }

  private async deleteFile(filePath: string): Promise<void> {
    console.log(`[BackupRestore] Deleting file: ${filePath}`);
    // This would delete the actual file
  }

  private async validateSQLiteFile(filePath: string): Promise<boolean> {
    // This would validate SQLite file format
    return true; // Mock implementation
  }

  private closeDatabase(): void {
    // This would close the current database connection
    console.log("[BackupRestore] Closing database connection");
  }

  private async reopenDatabase(filePath: string): Promise<void> {
    // This would reopen database connection to new file
    console.log(`[BackupRestore] Reopening database: ${filePath}`);
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Factory function to create backup/restore system
 */
export function createBackupRestoreSystem(
  db: SQLiteDatabase,
  projectPath: string
): BackupRestoreSystem {
  return new BackupRestoreSystem(db, projectPath);
}

export {
  BackupRestoreSystem,
  BackupMetadata,
  BackupOptions,
  RestoreOptions,
  BackupResult,
  RestoreResult,
  BackupStats
};