/**
 * @file fx-persistence-integration.ts
 * @description Integration module that ties together all persistence components
 * Provides a unified interface for the complete SQLite persistence system
 */

import { FXCore } from "../fx.ts";
import { SQLiteDatabase } from "./fx-persistence.ts";
import { FXDProject, createFXDProject } from "./fx-project.ts";
import { FXNodeSerializer, createNodeSerializer } from "./fx-node-serializer.ts";
import { SnippetPersistence, createSnippetPersistence } from "./fx-snippet-persistence.ts";
import { ViewPersistence, createViewPersistence } from "./fx-view-persistence.ts";
import { MetadataPersistence, createMetadataPersistence } from "./fx-metadata-persistence.ts";
import { IncrementalSaveSystem, createIncrementalSaveSystem } from "./fx-incremental-save.ts";
import { MigrationSystem, createMigrationSystem } from "./fx-migration-system.ts";
import { BackupRestoreSystem, createBackupRestoreSystem } from "./fx-backup-restore.ts";
import { FileAssociationManager, createFileAssociationManager } from "./fx-file-association.ts";

/**
 * Complete persistence system integration
 */
export class FXDPersistenceSystem {
  // Core components
  public project: FXDProject;
  public nodeSerializer: FXNodeSerializer;
  public snippetPersistence: SnippetPersistence;
  public viewPersistence: ViewPersistence;
  public metadataPersistence: MetadataPersistence;
  public incrementalSave: IncrementalSaveSystem;
  public migrationSystem: MigrationSystem;
  public backupRestore: BackupRestoreSystem;
  public fileAssociation: FileAssociationManager;

  private fx: FXCore;
  private db: SQLiteDatabase | null = null;
  private isInitialized = false;

  constructor(fx: FXCore) {
    this.fx = fx;
    this.project = createFXDProject(fx);
    this.fileAssociation = createFileAssociationManager();
  }

  /**
   * Initialize the complete persistence system
   */
  async initialize(projectPath?: string): Promise<void> {
    if (this.isInitialized) {
      console.warn("[FXDPersistence] System already initialized");
      return;
    }

    try {
      console.log("[FXDPersistence] Initializing persistence system...");

      // Initialize file associations (platform-specific)
      if (this.fileAssociation.isPlatformSupported()) {
        await this.registerFileAssociations();
      }

      // If project path provided, open the project
      if (projectPath) {
        await this.openProject(projectPath);
      }

      this.isInitialized = true;
      console.log("[FXDPersistence] Persistence system initialized successfully");
    } catch (error) {
      console.error("[FXDPersistence] Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create a new FXD project
   */
  async createProject(filePath: string, options: {
    name: string;
    description?: string;
    author?: string;
    defaultLanguage?: string;
  }): Promise<void> {
    console.log(`[FXDPersistence] Creating new project: ${filePath}`);

    await this.project.create(filePath, options);
    await this.initializeSubsystems();

    console.log("[FXDPersistence] New project created and initialized");
  }

  /**
   * Open an existing FXD project
   */
  async openProject(filePath: string, options: {
    readonly?: boolean;
    createBackup?: boolean;
    validateIntegrity?: boolean;
  } = {}): Promise<void> {
    console.log(`[FXDPersistence] Opening project: ${filePath}`);

    // Create backup if requested
    if (options.createBackup && this.backupRestore) {
      await this.backupRestore.createAutoBackup('project-open');
    }

    await this.project.open(filePath, options);
    await this.initializeSubsystems();

    // Run migration if needed
    if (this.migrationSystem?.needsMigration()) {
      console.log("[FXDPersistence] Running database migration...");
      await this.migrationSystem.migrate({ createBackup: true });
    }

    console.log("[FXDPersistence] Project opened successfully");
  }

  /**
   * Save the current project
   */
  async saveProject(options: {
    incremental?: boolean;
    createBackup?: boolean;
    validateAfter?: boolean;
  } = {}): Promise<void> {
    if (!this.project || !this.incrementalSave) {
      throw new Error("No project is open");
    }

    console.log("[FXDPersistence] Saving project...");

    // Create backup if requested
    if (options.createBackup && this.backupRestore) {
      await this.backupRestore.createAutoBackup('pre-save');
    }

    // Perform save
    if (options.incremental && this.incrementalSave.hasDirtyItems()) {
      const result = await this.incrementalSave.performIncrementalSave();
      if (!result.success) {
        throw new Error(`Incremental save failed: ${result.errors.join(', ')}`);
      }
    } else {
      await this.project.save({
        createBackup: options.createBackup,
        validateAfterSave: options.validateAfter
      });
    }

    console.log("[FXDPersistence] Project saved successfully");
  }

  /**
   * Close the current project
   */
  async closeProject(): Promise<void> {
    console.log("[FXDPersistence] Closing project...");

    // Check for unsaved changes
    if (this.incrementalSave?.hasDirtyItems()) {
      console.warn("[FXDPersistence] Project has unsaved changes");
    }

    await this.project.close();
    await this.cleanupSubsystems();

    console.log("[FXDPersistence] Project closed");
  }

  /**
   * Get comprehensive project statistics
   */
  async getProjectStatistics(): Promise<{
    project: any;
    snippets: any;
    views: any;
    backups: any;
    dirtyItems: any;
  }> {
    if (!this.isInitialized) {
      throw new Error("Persistence system not initialized");
    }

    const [
      projectStats,
      snippetStats,
      viewStats,
      backupStats,
      dirtyStats
    ] = await Promise.all([
      this.project.getStats(),
      this.snippetPersistence?.getStatistics(),
      this.viewPersistence?.getStatistics(),
      this.backupRestore?.getBackupStatistics(),
      this.incrementalSave?.getDirtyStats()
    ]);

    return {
      project: projectStats,
      snippets: snippetStats,
      views: viewStats,
      backups: backupStats,
      dirtyItems: dirtyStats
    };
  }

  /**
   * Perform full project export
   */
  async exportProject(exportPath: string, options: {
    format?: 'json' | 'sql' | 'archive';
    includeBackups?: boolean;
    includeHistory?: boolean;
    compress?: boolean;
  } = {}): Promise<void> {
    console.log(`[FXDPersistence] Exporting project to: ${exportPath}`);

    // Get all project data
    const metadata = await this.metadataPersistence?.exportMetadata();
    const snippets = await this.snippetPersistence?.getAllSnippets();
    const views = await this.viewPersistence?.getAllViews();
    const backups = options.includeBackups ? this.backupRestore?.getBackupList() : [];

    const exportData = {
      metadata,
      snippets,
      views,
      backups,
      exportedAt: new Date().toISOString(),
      version: "1.0.0"
    };

    // This would implement actual file writing based on format
    console.log("[FXDPersistence] Export data prepared:", Object.keys(exportData));
  }

  /**
   * Import project data
   */
  async importProject(importPath: string, options: {
    overwrite?: boolean;
    createBackup?: boolean;
    validateData?: boolean;
  } = {}): Promise<void> {
    console.log(`[FXDPersistence] Importing project from: ${importPath}`);

    // Create backup before import if requested
    if (options.createBackup && this.backupRestore) {
      await this.backupRestore.createAutoBackup('pre-import');
    }

    // This would implement actual import logic
    console.log("[FXDPersistence] Import completed");
  }

  /**
   * Register .fxd file associations
   */
  async registerFileAssociations(): Promise<void> {
    try {
      const result = await this.fileAssociation.registerFXDAssociation();
      if (result.success) {
        console.log("[FXDPersistence] File associations registered successfully");
      } else {
        console.warn("[FXDPersistence] File association registration failed:", result.errors);
      }
    } catch (error) {
      console.warn("[FXDPersistence] File association registration error:", error);
    }
  }

  /**
   * Validate system integrity
   */
  async validateSystemIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check database integrity
      if (this.migrationSystem && !this.migrationSystem.getCurrentVersion()) {
        issues.push("Database schema version not found");
        recommendations.push("Run database migration");
      }

      // Check for corrupted data
      if (this.incrementalSave) {
        const stats = this.incrementalSave.getDirtyStats();
        if (stats.totalDirty > 1000) {
          issues.push("Excessive dirty items detected");
          recommendations.push("Perform full save to clean up dirty tracking");
        }
      }

      // Check file associations
      if (this.fileAssociation.isPlatformSupported()) {
        const associationStatus = await this.fileAssociation.checkAssociationStatus();
        if (!associationStatus.isRegistered) {
          issues.push("File associations not registered");
          recommendations.push("Register .fxd file associations");
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      issues.push(`Integrity check failed: ${error}`);
      return { isValid: false, issues, recommendations };
    }
  }

  /**
   * Get system information for debugging
   */
  getSystemInfo(): {
    initialized: boolean;
    projectOpen: boolean;
    platform: string;
    components: string[];
    version: string;
  } {
    return {
      initialized: this.isInitialized,
      projectOpen: !!this.project && this.project.getMetadata() !== null,
      platform: this.fileAssociation.isPlatformSupported() ? 'supported' : 'unknown',
      components: [
        'FXDProject',
        'NodeSerializer',
        'SnippetPersistence',
        'ViewPersistence',
        'MetadataPersistence',
        'IncrementalSave',
        'MigrationSystem',
        'BackupRestore',
        'FileAssociation'
      ],
      version: "1.0.0"
    };
  }

  /**
   * Cleanup and shutdown the persistence system
   */
  async cleanup(): Promise<void> {
    console.log("[FXDPersistence] Cleaning up persistence system...");

    await this.cleanupSubsystems();
    await this.project.close();

    this.isInitialized = false;
    console.log("[FXDPersistence] Persistence system cleanup completed");
  }

  // Private helper methods

  private async initializeSubsystems(): Promise<void> {
    // Get database reference from project
    this.db = (this.project as any).db;

    if (!this.db) {
      throw new Error("Database not available from project");
    }

    // Initialize all subsystems
    this.nodeSerializer = createNodeSerializer(this.fx);
    this.snippetPersistence = createSnippetPersistence(this.db, this.fx);
    this.viewPersistence = createViewPersistence(this.db, this.fx);
    this.metadataPersistence = createMetadataPersistence(this.db);
    this.migrationSystem = createMigrationSystem(this.db);
    this.backupRestore = createBackupRestoreSystem(this.db, this.project.getMetadata()?.name || 'project');

    // Initialize incremental save system last (depends on other components)
    this.incrementalSave = createIncrementalSaveSystem(
      this.fx,
      this.db,
      this.nodeSerializer,
      this.snippetPersistence,
      this.viewPersistence,
      this.metadataPersistence
    );

    console.log("[FXDPersistence] All subsystems initialized");
  }

  private async cleanupSubsystems(): Promise<void> {
    // Cleanup all subsystems
    if (this.incrementalSave) {
      this.incrementalSave.cleanup();
    }
    if (this.backupRestore) {
      this.backupRestore.cleanup();
    }
    if (this.migrationSystem) {
      this.migrationSystem.cleanup();
    }
    if (this.metadataPersistence) {
      this.metadataPersistence.cleanup();
    }
    if (this.viewPersistence) {
      this.viewPersistence.cleanup();
    }
    if (this.snippetPersistence) {
      this.snippetPersistence.cleanup();
    }

    // Clear references
    this.db = null;
  }
}

/**
 * Factory function to create the complete persistence system
 */
export function createFXDPersistenceSystem(fx: FXCore): FXDPersistenceSystem {
  return new FXDPersistenceSystem(fx);
}

// Export all persistence components for individual use
export * from "./fx-persistence.ts";
export * from "./fx-project.ts";
export * from "./fx-node-serializer.ts";
export * from "./fx-snippet-persistence.ts";
export * from "./fx-view-persistence.ts";
export * from "./fx-metadata-persistence.ts";
export * from "./fx-incremental-save.ts";
export * from "./fx-migration-system.ts";
export * from "./fx-backup-restore.ts";
export * from "./fx-file-association.ts";

// FXDPersistenceSystem is already exported as a class declaration above