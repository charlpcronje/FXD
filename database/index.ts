/**
 * @file index.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description Main entry point for FXD persistence layer
 * Exports all persistence components and provides a unified API
 */

// Core connection and schema
export {
  DBConnection,
  SQLiteDatabase,
  SQLiteStatement,
  DBConnectionOptions,
  createDBConnection,
  createInMemoryDB
} from './db-connection.ts';

// CRUD operations
export {
  NodeRecord,
  SnippetRecord,
  ViewRecord,
  NodeCRUD,
  SnippetCRUD,
  ViewCRUD,
  MetadataCRUD,
  DataUtils,
  createCRUDOperations
} from './crud-operations.ts';

// Transaction management
export {
  TransactionManager,
  IsolationLevel,
  TransactionOptions,
  Savepoint,
  AtomicOperations,
  createTransactionManager,
  createAtomicOperations
} from './transaction-manager.ts';

// Auto-save functionality
export {
  AutoSaveManager,
  AutoSaveConfig,
  SaveStats,
  DirtyItem,
  createAutoSaveManager
} from './auto-save.ts';

/**
 * Complete persistence system factory
 * Creates all components needed for FXD persistence
 */
export async function createPersistenceSystem(options: {
  filePath: string;
  readonly?: boolean;
  autoSave?: Partial<import('./auto-save.ts').AutoSaveConfig>;
}) {
  // Create database connection
  const db = await createDBConnection({
    filePath: options.filePath,
    readonly: options.readonly
  });

  // Create CRUD operations
  const crud = await import('./crud-operations.ts').then(m => m.createCRUDOperations(db));

  // Create transaction manager
  const tm = await import('./transaction-manager.ts').then(m => m.createTransactionManager(db));

  // Create auto-save manager
  const autoSave = await import('./auto-save.ts').then(m =>
    m.createAutoSaveManager(
      db,
      crud.nodes,
      crud.snippets,
      crud.views,
      tm,
      options.autoSave
    )
  );

  return {
    db,
    crud,
    tm,
    autoSave,

    /**
     * Cleanup and close all components
     */
    async close() {
      autoSave.cleanup();
      db.close();
    },

    /**
     * Get system statistics
     */
    getStats() {
      return {
        database: db.getStats(),
        transaction: tm.getStats(),
        autoSave: autoSave.getStats(),
        nodes: {
          total: crud.nodes.count(),
          dirty: crud.nodes.getDirtyNodes().length
        }
      };
    }
  };
}

/**
 * Quick start helper - creates an in-memory persistence system for testing
 */
export async function createTestPersistence(autoSaveConfig?: Partial<import('./auto-save.ts').AutoSaveConfig>) {
  const db = await createInMemoryDB();
  const { createCRUDOperations } = await import('./crud-operations.ts');
  const { createTransactionManager } = await import('./transaction-manager.ts');
  const { createAutoSaveManager } = await import('./auto-save.ts');

  const crud = createCRUDOperations(db);
  const tm = createTransactionManager(db);
  const autoSave = createAutoSaveManager(
    db,
    crud.nodes,
    crud.snippets,
    crud.views,
    tm,
    { enabled: false, ...autoSaveConfig }
  );

  return {
    db,
    crud,
    tm,
    autoSave,
    async close() {
      autoSave.cleanup();
      db.close();
    }
  };
}
