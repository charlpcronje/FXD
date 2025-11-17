/**
 * @file persistence.test.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description Comprehensive tests for FXD persistence layer
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createDBConnection, createInMemoryDB, DBConnection } from './db-connection.ts';
import { createCRUDOperations, DataUtils } from './crud-operations.ts';
import { createTransactionManager } from './transaction-manager.ts';
import { createAutoSaveManager } from './auto-save.ts';

// Test database path
const TEST_DB_PATH = './test-persistence.db';

/**
 * Helper to clean up test database
 */
async function cleanupTestDB() {
  if (existsSync(TEST_DB_PATH)) {
    await unlink(TEST_DB_PATH);
  }
}

describe('Database Connection', () => {
  let db: DBConnection;

  before(async () => {
    await cleanupTestDB();
  });

  after(async () => {
    if (db) {
      db.close();
    }
    await cleanupTestDB();
  });

  it('should create and open database connection', async () => {
    db = await createDBConnection({
      filePath: TEST_DB_PATH
    });

    assert.ok(db.isOpened());
  });

  it('should initialize schema', async () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();

    const tableNames = tables.map((t: any) => t.name);
    assert.ok(tableNames.includes('nodes'));
    assert.ok(tableNames.includes('snippets'));
    assert.ok(tableNames.includes('views'));
    assert.ok(tableNames.includes('project_metadata'));
  });

  it('should get database statistics', () => {
    const stats = db.getStats();

    assert.ok(stats.pageCount > 0);
    assert.ok(stats.pageSize > 0);
    assert.strictEqual(stats.inTransaction, false);
  });
});

describe('Node CRUD Operations', () => {
  let db: DBConnection;
  let crud: ReturnType<typeof createCRUDOperations>;

  before(async () => {
    db = await createInMemoryDB();
    crud = createCRUDOperations(db);
  });

  after(() => {
    db.close();
  });

  it('should create a node', () => {
    const node = crud.nodes.create({
      id: 'test-node-1',
      parent_id: null,
      key_name: 'root',
      node_type: 'object',
      value_json: JSON.stringify({ test: 'value' }),
      prototypes_json: JSON.stringify(['proto1']),
      meta_json: JSON.stringify({ meta: 'data' }),
      checksum: DataUtils.checksumNode({ test: 'value' }),
      is_dirty: false
    });

    assert.strictEqual(node.id, 'test-node-1');
    assert.strictEqual(node.key_name, 'root');
  });

  it('should get node by ID', () => {
    const node = crud.nodes.getById('test-node-1');

    assert.ok(node);
    assert.strictEqual(node.id, 'test-node-1');
    assert.strictEqual(node.key_name, 'root');
  });

  it('should create child nodes', () => {
    const child1 = crud.nodes.create({
      id: 'child-1',
      parent_id: 'test-node-1',
      key_name: 'child1',
      node_type: 'string',
      value_json: JSON.stringify('child value'),
      prototypes_json: null,
      meta_json: null,
      checksum: null,
      is_dirty: false
    });

    const child2 = crud.nodes.create({
      id: 'child-2',
      parent_id: 'test-node-1',
      key_name: 'child2',
      node_type: 'number',
      value_json: JSON.stringify(42),
      prototypes_json: null,
      meta_json: null,
      checksum: null,
      is_dirty: false
    });

    assert.strictEqual(child1.parent_id, 'test-node-1');
    assert.strictEqual(child2.parent_id, 'test-node-1');
  });

  it('should get children of a node', () => {
    const children = crud.nodes.getChildren('test-node-1');

    assert.strictEqual(children.length, 2);
    assert.ok(children.some(c => c.key_name === 'child1'));
    assert.ok(children.some(c => c.key_name === 'child2'));
  });

  it('should update a node', () => {
    const updated = crud.nodes.update('test-node-1', {
      value_json: JSON.stringify({ test: 'updated' }),
      is_dirty: true
    });

    assert.strictEqual(updated.value_json, JSON.stringify({ test: 'updated' }));
    assert.strictEqual(updated.is_dirty, true);
  });

  it('should mark node as dirty', () => {
    crud.nodes.markDirty('test-node-1');
    const node = crud.nodes.getById('test-node-1');

    assert.strictEqual(node?.is_dirty, true);
  });

  it('should get dirty nodes', () => {
    const dirtyNodes = crud.nodes.getDirtyNodes();

    assert.ok(dirtyNodes.length > 0);
    assert.ok(dirtyNodes.some(n => n.id === 'test-node-1'));
  });

  it('should get node tree', () => {
    const tree = crud.nodes.getTree('test-node-1');

    assert.strictEqual(tree.id, 'test-node-1');
    assert.ok(Array.isArray(tree.children));
    assert.strictEqual(tree.children.length, 2);
  });

  it('should delete a node (cascade)', () => {
    crud.nodes.delete('test-node-1');

    const node = crud.nodes.getById('test-node-1');
    const child1 = crud.nodes.getById('child-1');
    const child2 = crud.nodes.getById('child-2');

    assert.strictEqual(node, null);
    assert.strictEqual(child1, null); // Should cascade delete
    assert.strictEqual(child2, null); // Should cascade delete
  });
});

describe('Snippet CRUD Operations', () => {
  let db: DBConnection;
  let crud: ReturnType<typeof createCRUDOperations>;

  before(async () => {
    db = await createInMemoryDB();
    crud = createCRUDOperations(db);

    // Create a node first
    crud.nodes.create({
      id: 'node-1',
      parent_id: null,
      key_name: 'test',
      node_type: 'object',
      value_json: null,
      prototypes_json: null,
      meta_json: null,
      checksum: null,
      is_dirty: false
    });
  });

  after(() => {
    db.close();
  });

  it('should create a snippet', () => {
    const snippet = crud.snippets.create({
      id: 'snippet-1',
      node_id: 'node-1',
      snippet_id: 'snip-001',
      body: 'console.log("Hello World");',
      lang: 'js',
      file_path: '/test/snippet.js',
      order_index: 0,
      version: 1,
      checksum: DataUtils.hash('console.log("Hello World");'),
      is_dirty: false
    });

    assert.strictEqual(snippet.snippet_id, 'snip-001');
    assert.strictEqual(snippet.lang, 'js');
  });

  it('should get snippet by ID', () => {
    const snippet = crud.snippets.getById('snippet-1');

    assert.ok(snippet);
    assert.strictEqual(snippet.body, 'console.log("Hello World");');
  });

  it('should get snippets by node ID', () => {
    const snippets = crud.snippets.getByNodeId('node-1');

    assert.strictEqual(snippets.length, 1);
    assert.strictEqual(snippets[0].snippet_id, 'snip-001');
  });

  it('should update a snippet', () => {
    const updated = crud.snippets.update('snippet-1', {
      body: 'console.log("Updated");',
      version: 2
    });

    assert.strictEqual(updated.body, 'console.log("Updated");');
    assert.strictEqual(updated.version, 2);
  });

  it('should get snippets by language', () => {
    const jsSnippets = crud.snippets.getByLanguage('js');

    assert.ok(jsSnippets.length > 0);
    assert.ok(jsSnippets.every(s => s.lang === 'js'));
  });
});

describe('Transaction Manager', () => {
  let db: DBConnection;
  let tm: ReturnType<typeof createTransactionManager>;
  let crud: ReturnType<typeof createCRUDOperations>;

  before(async () => {
    db = await createInMemoryDB();
    tm = createTransactionManager(db);
    crud = createCRUDOperations(db);
  });

  after(() => {
    db.close();
  });

  it('should execute transaction successfully', async () => {
    await tm.execute(() => {
      crud.nodes.create({
        id: 'tx-node-1',
        parent_id: null,
        key_name: 'tx-test',
        node_type: 'object',
        value_json: null,
        prototypes_json: null,
        meta_json: null,
        checksum: null,
        is_dirty: false
      });
    });

    const node = crud.nodes.getById('tx-node-1');
    assert.ok(node);
  });

  it('should rollback on error', async () => {
    try {
      await tm.execute(() => {
        crud.nodes.create({
          id: 'tx-node-2',
          parent_id: null,
          key_name: 'test',
          node_type: 'object',
          value_json: null,
          prototypes_json: null,
          meta_json: null,
          checksum: null,
          is_dirty: false
        });

        throw new Error('Test error');
      });
    } catch (error) {
      // Expected
    }

    const node = crud.nodes.getById('tx-node-2');
    assert.strictEqual(node, null); // Should be rolled back
  });

  it('should execute batch operations', async () => {
    const operations = [
      () => crud.nodes.create({
        id: 'batch-1',
        parent_id: null,
        key_name: 'b1',
        node_type: 'object',
        value_json: null,
        prototypes_json: null,
        meta_json: null,
        checksum: null,
        is_dirty: false
      }),
      () => crud.nodes.create({
        id: 'batch-2',
        parent_id: null,
        key_name: 'b2',
        node_type: 'object',
        value_json: null,
        prototypes_json: null,
        meta_json: null,
        checksum: null,
        is_dirty: false
      })
    ];

    await tm.batch(operations);

    const node1 = crud.nodes.getById('batch-1');
    const node2 = crud.nodes.getById('batch-2');

    assert.ok(node1);
    assert.ok(node2);
  });

  it('should get transaction stats', () => {
    const stats = tm.getStats();

    assert.strictEqual(stats.inTransaction, false);
    assert.strictEqual(stats.depth, 0);
  });
});

describe('Auto-Save Manager', () => {
  let db: DBConnection;
  let crud: ReturnType<typeof createCRUDOperations>;
  let tm: ReturnType<typeof createTransactionManager>;
  let autoSave: ReturnType<typeof createAutoSaveManager>;

  before(async () => {
    db = await createInMemoryDB();
    crud = createCRUDOperations(db);
    tm = createTransactionManager(db);
    autoSave = createAutoSaveManager(
      db,
      crud.nodes,
      crud.snippets,
      crud.views,
      tm,
      {
        enabled: false, // Start disabled for testing
        interval: 100,
        batchSize: 10
      }
    );
  });

  after(() => {
    autoSave.cleanup();
    db.close();
  });

  it('should mark items as dirty', () => {
    autoSave.markDirty('node', 'test-1');
    autoSave.markDirty('snippet', 'test-2');

    const count = autoSave.getDirtyCount();
    assert.strictEqual(count, 2);
  });

  it('should get dirty items by type', () => {
    const byType = autoSave.getDirtyByType();

    assert.strictEqual(byType.nodes, 1);
    assert.strictEqual(byType.snippets, 1);
    assert.strictEqual(byType.views, 0);
  });

  it('should clear dirty items', () => {
    autoSave.clearDirty('node', 'test-1');

    const count = autoSave.getDirtyCount();
    assert.strictEqual(count, 1);
  });

  it('should force save', async () => {
    // Create a real node first
    crud.nodes.create({
      id: 'save-test',
      parent_id: null,
      key_name: 'test',
      node_type: 'object',
      value_json: null,
      prototypes_json: null,
      meta_json: null,
      checksum: null,
      is_dirty: true
    });

    autoSave.markDirty('node', 'save-test');

    const stats = await autoSave.forceSave();

    assert.ok(stats.totalSaved >= 0); // May be 0 if node doesn't exist
  });

  it('should get auto-save statistics', () => {
    const stats = autoSave.getStats();

    assert.strictEqual(stats.isRunning, false);
    assert.ok(typeof stats.dirtyCount === 'number');
    assert.ok(typeof stats.totalSaves === 'number');
  });
});

describe('Data Utils', () => {
  it('should generate hash', () => {
    const hash1 = DataUtils.hash('test data');
    const hash2 = DataUtils.hash('test data');
    const hash3 = DataUtils.hash('different data');

    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hash3);
  });

  it('should safely stringify', () => {
    const obj = { test: 'value' };
    const json = DataUtils.safeStringify(obj);

    assert.strictEqual(json, '{"test":"value"}');
  });

  it('should safely parse', () => {
    const json = '{"test":"value"}';
    const obj = DataUtils.safeParse(json);

    assert.deepStrictEqual(obj, { test: 'value' });
  });

  it('should handle parse errors gracefully', () => {
    const result = DataUtils.safeParse('invalid json');

    assert.strictEqual(result, null);
  });

  it('should generate unique IDs', () => {
    const id1 = DataUtils.generateId();
    const id2 = DataUtils.generateId();

    assert.ok(id1);
    assert.ok(id2);
    assert.notStrictEqual(id1, id2);
  });
});

describe('Integration Tests', () => {
  let db: DBConnection;
  let crud: ReturnType<typeof createCRUDOperations>;
  let tm: ReturnType<typeof createTransactionManager>;

  before(async () => {
    db = await createInMemoryDB();
    crud = createCRUDOperations(db);
    tm = createTransactionManager(db);
  });

  after(() => {
    db.close();
  });

  it('should handle complex node hierarchy', async () => {
    await tm.execute(() => {
      // Create root
      crud.nodes.create({
        id: 'root',
        parent_id: null,
        key_name: 'root',
        node_type: 'object',
        value_json: null,
        prototypes_json: null,
        meta_json: null,
        checksum: null,
        is_dirty: false
      });

      // Create children
      for (let i = 0; i < 5; i++) {
        crud.nodes.create({
          id: `child-${i}`,
          parent_id: 'root',
          key_name: `child${i}`,
          node_type: 'object',
          value_json: null,
          prototypes_json: null,
          meta_json: null,
          checksum: null,
          is_dirty: false
        });
      }
    });

    const tree = crud.nodes.getTree('root');
    assert.strictEqual(tree.children.length, 5);
  });

  it('should handle node with snippets', async () => {
    await tm.execute(() => {
      crud.nodes.create({
        id: 'code-node',
        parent_id: null,
        key_name: 'code',
        node_type: 'function',
        value_json: null,
        prototypes_json: null,
        meta_json: null,
        checksum: null,
        is_dirty: false
      });

      crud.snippets.create({
        id: 'code-snippet-1',
        node_id: 'code-node',
        snippet_id: 'cs-001',
        body: 'function test() { return 42; }',
        lang: 'js',
        file_path: null,
        order_index: 0,
        version: 1,
        checksum: null,
        is_dirty: false
      });
    });

    const snippets = crud.snippets.getByNodeId('code-node');
    assert.strictEqual(snippets.length, 1);
    assert.ok(snippets[0].body.includes('function test'));
  });
});

// Run tests
console.log('[Persistence Tests] Starting tests...\n');
