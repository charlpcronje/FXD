# FXD Persistence Layer

Complete SQLite-based persistence layer for FXD projects.

## 🎯 Overview

The FXD persistence layer provides robust, efficient database operations for storing and managing FX nodes, snippets, views, and metadata. Built on SQLite with WAL (Write-Ahead Logging) mode for optimal performance.

## 📦 Components

### Core Modules

1. **db-connection.ts** - Database connection manager
   - SQLite initialization and configuration
   - WAL mode for better concurrency
   - Statement caching for performance
   - Backup and restore capabilities

2. **crud-operations.ts** - CRUD operations
   - NodeCRUD - Full node lifecycle management
   - SnippetCRUD - Code snippet persistence
   - ViewCRUD - View and group storage
   - MetadataCRUD - Project metadata
   - DataUtils - Serialization and hashing

3. **transaction-manager.ts** - Transaction support
   - ACID-compliant transactions
   - Savepoint support for nested transactions
   - Automatic retry on deadlock
   - Batch operations
   - Atomic operations (CAS, increment, decrement)

4. **auto-save.ts** - Auto-save functionality
   - Configurable save intervals
   - Dirty item tracking
   - Multiple strategies (time/count/hybrid)
   - Save statistics and history
   - Force save capability

5. **schema.sql** - Database schema
   - Nodes, snippets, views, metadata tables
   - Transaction log for replay
   - Optimized indexes
   - Auto-update triggers

## 🚀 Quick Start

### Basic Usage

```typescript
import { createPersistenceSystem } from './database/index.ts';

// Create persistence system
const persistence = await createPersistenceSystem({
  filePath: './my-project.fxd',
  autoSave: {
    enabled: true,
    interval: 5000, // 5 seconds
    strategy: 'hybrid'
  }
});

// Use CRUD operations
const node = persistence.crud.nodes.create({
  id: 'node-1',
  parent_id: null,
  key_name: 'root',
  node_type: 'object',
  value_json: JSON.stringify({ hello: 'world' }),
  prototypes_json: null,
  meta_json: null,
  checksum: null,
  is_dirty: false
});

// Use transactions
await persistence.tm.execute(() => {
  persistence.crud.nodes.create({ ... });
  persistence.crud.snippets.create({ ... });
});

// Close when done
await persistence.close();
```

### Testing

```typescript
import { createTestPersistence } from './database/index.ts';

// Create in-memory database for testing
const persistence = await createTestPersistence({
  enabled: false // Disable auto-save for tests
});

// Run tests...

await persistence.close();
```

## 📊 Database Schema

### Tables

- **nodes** - FX node storage with hierarchy
- **edges** - Node relationships (parent-child)
- **snippets** - Code snippets linked to nodes
- **views** - View definitions and configurations
- **view_components** - Links between views and snippets
- **transaction_log** - Append-only mutation log for replay
- **project_metadata** - Project-level metadata
- **schema_version** - Schema version tracking

### Key Features

- Foreign key constraints for data integrity
- Cascading deletes for cleanup
- Automatic timestamp updates
- Transaction logging for replay
- Optimized indexes for performance

## 🔧 API Reference

### Database Connection

```typescript
const db = await createDBConnection({
  filePath: './project.fxd',
  readonly?: false,
  verbose?: false,
  timeout?: 5000,
  wal?: true
});

// Get statistics
const stats = db.getStats();

// Backup
await db.backup('./backup.fxd');

// Close
db.close();
```

### CRUD Operations

```typescript
const crud = createCRUDOperations(db);

// Nodes
const node = crud.nodes.create({ ... });
const node = crud.nodes.getById('id');
const children = crud.nodes.getChildren('parent-id');
const updated = crud.nodes.update('id', { ... });
const deleted = crud.nodes.delete('id');
const tree = crud.nodes.getTree('root-id');

// Snippets
const snippet = crud.snippets.create({ ... });
const snippets = crud.snippets.getByNodeId('node-id');
const jsSnippets = crud.snippets.getByLanguage('js');

// Views
const view = crud.views.create({ ... });
const view = crud.views.getByName('my-view');

// Metadata
crud.metadata.set('key', 'value');
const value = crud.metadata.get('key');
const all = crud.metadata.getAll();
```

### Transactions

```typescript
const tm = createTransactionManager(db);

// Execute transaction
await tm.execute(() => {
  crud.nodes.create({ ... });
  crud.snippets.create({ ... });
});

// Batch operations
await tm.batch([
  () => crud.nodes.create({ ... }),
  () => crud.nodes.create({ ... })
]);

// With retry on deadlock
await tm.withRetry(() => {
  crud.nodes.update('id', { ... });
});

// Get stats
const stats = tm.getStats();
```

### Auto-Save

```typescript
const autoSave = createAutoSaveManager(db, crud.nodes, crud.snippets, crud.views, tm, {
  enabled: true,
  interval: 5000,
  batchSize: 100,
  strategy: 'hybrid',
  countThreshold: 50,
  onSave: (stats) => console.log('Saved:', stats),
  onError: (error) => console.error('Error:', error)
});

// Start/stop
autoSave.start();
autoSave.stop();

// Mark dirty
autoSave.markDirty('node', 'node-id');

// Force save
const stats = await autoSave.forceSave();

// Get statistics
const stats = autoSave.getStats();
```

## 🧪 Testing

Run the test suite:

```bash
npm run test:sqlite
```

Or run manually:

```bash
node --test database/persistence.test.ts
```

## 🔒 Data Integrity

### ACID Compliance

- **Atomicity** - All operations in a transaction complete or none do
- **Consistency** - Database remains in valid state
- **Isolation** - Concurrent transactions don't interfere
- **Durability** - Committed changes persist

### Backup Strategy

```typescript
// Manual backup
await db.backup('./backup.fxd');

// Checkpoint WAL
db.checkpoint('full');

// Vacuum database
db.vacuum();
```

### Error Handling

```typescript
// Automatic retry on deadlock
await tm.withRetry(() => {
  // Your operation
}, 5, 50); // 5 retries, 50ms base delay

// Transaction with error handling
await tm.execute(() => {
  // Your operations
}, {
  retries: 3,
  retryDelay: 100,
  onError: (error) => console.error(error)
});
```

## 📈 Performance

### Optimizations

- WAL mode for better concurrency
- Statement caching
- Batch operations
- Prepared statements
- Optimized indexes
- 64MB cache size

### Statistics

```typescript
const stats = db.getStats();
// {
//   pageCount: 100,
//   pageSize: 4096,
//   freePages: 10,
//   cacheSize: 64000,
//   walMode: true,
//   inTransaction: false
// }
```

## 🔗 Integration

### With fx-persistence.ts

```typescript
import { createPersistenceSystem } from './database/index.ts';
import { FXCore } from '../fx.ts';

const fx = new FXCore();
const persistence = await createPersistenceSystem({
  filePath: './project.fxd'
});

// Integrate with FX
// ... serialization logic
```

### Transaction Log Replay

The transaction log allows replay of all mutations:

```typescript
const stmt = db.prepare(`
  SELECT * FROM transaction_log
  WHERE timestamp > ?
  ORDER BY timestamp ASC
`);

const transactions = stmt.all(lastCheckpoint);

// Replay transactions
for (const tx of transactions) {
  // Apply operation based on tx.operation
}
```

## 📝 License

Part of the FXD project. See main project license.

## 👥 Author

Built by agent-persistence for the FXD project.
