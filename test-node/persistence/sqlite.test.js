/**
 * SQLite Persistence Tests for FXD
 * Tests database operations, project save/load, and data integrity
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { Database } from 'sqlite3';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test database path
const TEST_DB_PATH = join(tmpdir(), `fxd-test-${Date.now()}.sqlite`);

describe('SQLite Persistence Layer', () => {
    let db;

    beforeEach(async () => {
        // Create fresh database for each test
        db = new Database(TEST_DB_PATH);
        await initializeSchema(db);
    });

    afterEach(async () => {
        // Clean up test database
        if (db) {
            await new Promise((resolve) => db.close(resolve));
        }
        try {
            await fs.unlink(TEST_DB_PATH);
        } catch (err) {
            // Ignore if file doesn't exist
        }
    });

    describe('Database Schema Operations', () => {
        test('should create required tables', async () => {
            const tables = await getTableNames(db);

            assert(tables.includes('projects'), 'projects table should exist');
            assert(tables.includes('nodes'), 'nodes table should exist');
            assert(tables.includes('node_relationships'), 'node_relationships table should exist');
            assert(tables.includes('snapshots'), 'snapshots table should exist');
            assert(tables.includes('changes_log'), 'changes_log table should exist');
        });

        test('should have correct table schemas', async () => {
            const projectsSchema = await getTableSchema(db, 'projects');
            const nodesSchema = await getTableSchema(db, 'nodes');

            // Verify projects table structure
            const projectColumns = projectsSchema.map(col => col.name);
            assert(projectColumns.includes('id'), 'projects should have id column');
            assert(projectColumns.includes('name'), 'projects should have name column');
            assert(projectColumns.includes('created_at'), 'projects should have created_at column');
            assert(projectColumns.includes('updated_at'), 'projects should have updated_at column');
            assert(projectColumns.includes('metadata'), 'projects should have metadata column');

            // Verify nodes table structure
            const nodeColumns = nodesSchema.map(col => col.name);
            assert(nodeColumns.includes('id'), 'nodes should have id column');
            assert(nodeColumns.includes('project_id'), 'nodes should have project_id column');
            assert(nodeColumns.includes('parent_id'), 'nodes should have parent_id column');
            assert(nodeColumns.includes('path'), 'nodes should have path column');
            assert(nodeColumns.includes('value'), 'nodes should have value column');
            assert(nodeColumns.includes('type'), 'nodes should have type column');
            assert(nodeColumns.includes('metadata'), 'nodes should have metadata column');
        });

        test('should enforce foreign key constraints', async () => {
            // Test that foreign key constraints are properly set up
            const foreignKeys = await getForeignKeys(db, 'nodes');
            assert(foreignKeys.length > 0, 'nodes table should have foreign key constraints');
        });
    });

    describe('Project Operations', () => {
        test('should create a new project', async () => {
            const projectData = {
                name: 'Test Project',
                metadata: { description: 'A test project' }
            };

            const projectId = await createProject(db, projectData);
            assert(typeof projectId === 'string', 'should return project ID');

            const project = await getProject(db, projectId);
            assert.equal(project.name, 'Test Project');
            assert.equal(JSON.parse(project.metadata).description, 'A test project');
        });

        test('should load existing project', async () => {
            const projectId = await createProject(db, { name: 'Load Test' });
            const project = await getProject(db, projectId);

            assert.equal(project.id, projectId);
            assert.equal(project.name, 'Load Test');
            assert(project.created_at);
            assert(project.updated_at);
        });

        test('should update project metadata', async () => {
            const projectId = await createProject(db, { name: 'Update Test' });

            await updateProject(db, projectId, {
                name: 'Updated Project',
                metadata: { version: '2.0' }
            });

            const project = await getProject(db, projectId);
            assert.equal(project.name, 'Updated Project');
            assert.equal(JSON.parse(project.metadata).version, '2.0');
        });

        test('should delete project and cascade', async () => {
            const projectId = await createProject(db, { name: 'Delete Test' });

            // Add some nodes to the project
            await createNode(db, {
                project_id: projectId,
                path: 'root',
                value: 'test value',
                type: 'string'
            });

            await deleteProject(db, projectId);

            const project = await getProject(db, projectId);
            assert.equal(project, null, 'project should be deleted');

            const nodes = await getProjectNodes(db, projectId);
            assert.equal(nodes.length, 0, 'project nodes should be deleted');
        });
    });

    describe('Node Operations', () => {
        let projectId;

        beforeEach(async () => {
            projectId = await createProject(db, { name: 'Node Test Project' });
        });

        test('should create and retrieve nodes', async () => {
            const nodeData = {
                project_id: projectId,
                path: 'user.profile.name',
                value: 'John Doe',
                type: 'string',
                metadata: { editable: true }
            };

            const nodeId = await createNode(db, nodeData);
            const node = await getNode(db, nodeId);

            assert.equal(node.path, 'user.profile.name');
            assert.equal(node.value, 'John Doe');
            assert.equal(node.type, 'string');
            assert.equal(JSON.parse(node.metadata).editable, true);
        });

        test('should handle hierarchical node relationships', async () => {
            const rootNode = await createNode(db, {
                project_id: projectId,
                path: 'root',
                value: null,
                type: 'object'
            });

            const childNode = await createNode(db, {
                project_id: projectId,
                parent_id: rootNode,
                path: 'root.child',
                value: 'child value',
                type: 'string'
            });

            const children = await getChildNodes(db, rootNode);
            assert.equal(children.length, 1);
            assert.equal(children[0].id, childNode);
        });

        test('should update node values', async () => {
            const nodeId = await createNode(db, {
                project_id: projectId,
                path: 'counter',
                value: '0',
                type: 'number'
            });

            await updateNode(db, nodeId, {
                value: '42',
                metadata: { lastUpdated: new Date().toISOString() }
            });

            const node = await getNode(db, nodeId);
            assert.equal(node.value, '42');
            assert(JSON.parse(node.metadata).lastUpdated);
        });

        test('should handle node deletion', async () => {
            const nodeId = await createNode(db, {
                project_id: projectId,
                path: 'temp',
                value: 'temporary',
                type: 'string'
            });

            await deleteNode(db, nodeId);

            const node = await getNode(db, nodeId);
            assert.equal(node, null, 'node should be deleted');
        });
    });

    describe('Change Logging', () => {
        let projectId;

        beforeEach(async () => {
            projectId = await createProject(db, { name: 'Change Log Test' });
        });

        test('should log node creation', async () => {
            const nodeId = await createNode(db, {
                project_id: projectId,
                path: 'logged.node',
                value: 'test',
                type: 'string'
            });

            const changes = await getChanges(db, projectId);
            assert(changes.length > 0, 'should have logged changes');

            const createChange = changes.find(c => c.operation === 'CREATE' && c.node_id === nodeId);
            assert(createChange, 'should have logged node creation');
        });

        test('should log node updates', async () => {
            const nodeId = await createNode(db, {
                project_id: projectId,
                path: 'update.test',
                value: 'original',
                type: 'string'
            });

            await updateNode(db, nodeId, { value: 'updated' });

            const changes = await getChanges(db, projectId);
            const updateChange = changes.find(c => c.operation === 'UPDATE' && c.node_id === nodeId);
            assert(updateChange, 'should have logged node update');
        });

        test('should support change replay', async () => {
            // Create initial state
            const nodeId = await createNode(db, {
                project_id: projectId,
                path: 'replay.test',
                value: '1',
                type: 'number'
            });

            // Make several updates
            await updateNode(db, nodeId, { value: '2' });
            await updateNode(db, nodeId, { value: '3' });
            await updateNode(db, nodeId, { value: '4' });

            // Get changes for replay
            const changes = await getChanges(db, projectId);
            const nodeChanges = changes.filter(c => c.node_id === nodeId);

            assert(nodeChanges.length >= 4, 'should have multiple changes logged');

            // Verify change order
            const sortedChanges = nodeChanges.sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            assert.equal(sortedChanges[0].operation, 'CREATE');
            assert(sortedChanges.slice(1).every(c => c.operation === 'UPDATE'));
        });
    });

    describe('Snapshot Management', () => {
        let projectId;

        beforeEach(async () => {
            projectId = await createProject(db, { name: 'Snapshot Test' });
        });

        test('should create project snapshots', async () => {
            // Create some nodes
            await createNode(db, {
                project_id: projectId,
                path: 'data.item1',
                value: 'value1',
                type: 'string'
            });

            await createNode(db, {
                project_id: projectId,
                path: 'data.item2',
                value: '42',
                type: 'number'
            });

            const snapshotId = await createSnapshot(db, projectId, 'Initial state');
            assert(typeof snapshotId === 'string', 'should return snapshot ID');

            const snapshot = await getSnapshot(db, snapshotId);
            assert.equal(snapshot.project_id, projectId);
            assert.equal(snapshot.description, 'Initial state');
            assert(snapshot.data, 'snapshot should contain data');
        });

        test('should restore from snapshots', async () => {
            // Create initial nodes
            const node1Id = await createNode(db, {
                project_id: projectId,
                path: 'restore.test1',
                value: 'original1',
                type: 'string'
            });

            const snapshotId = await createSnapshot(db, projectId, 'Before changes');

            // Make changes
            await updateNode(db, node1Id, { value: 'modified1' });
            await createNode(db, {
                project_id: projectId,
                path: 'restore.test2',
                value: 'new_node',
                type: 'string'
            });

            // Restore from snapshot
            await restoreFromSnapshot(db, snapshotId);

            // Verify restoration
            const node1 = await getNode(db, node1Id);
            assert.equal(node1.value, 'original1', 'should restore original value');

            const allNodes = await getProjectNodes(db, projectId);
            const test2Node = allNodes.find(n => n.path === 'restore.test2');
            assert.equal(test2Node, undefined, 'new node should be removed');
        });
    });

    describe('Performance and Stress Tests', () => {
        let projectId;

        beforeEach(async () => {
            projectId = await createProject(db, { name: 'Performance Test' });
        });

        test('should handle large numbers of nodes efficiently', async () => {
            const nodeCount = 1000;
            const startTime = Date.now();

            // Create many nodes in batch
            const nodes = [];
            for (let i = 0; i < nodeCount; i++) {
                nodes.push({
                    project_id: projectId,
                    path: `data.item${i}`,
                    value: `value${i}`,
                    type: 'string'
                });
            }

            await batchCreateNodes(db, nodes);
            const createTime = Date.now() - startTime;

            // Verify all nodes were created
            const allNodes = await getProjectNodes(db, projectId);
            assert.equal(allNodes.length, nodeCount, 'should create all nodes');

            // Test query performance
            const queryStart = Date.now();
            const queryResult = await queryNodes(db, projectId, 'data.item%');
            const queryTime = Date.now() - queryStart;

            assert.equal(queryResult.length, nodeCount, 'should find all nodes');

            console.log(`Performance metrics:
- Created ${nodeCount} nodes in ${createTime}ms
- Queried ${nodeCount} nodes in ${queryTime}ms`);

            // Performance assertions
            assert(createTime < 5000, 'should create 1000 nodes in under 5 seconds');
            assert(queryTime < 1000, 'should query 1000 nodes in under 1 second');
        });

        test('should handle concurrent operations', async () => {
            const operations = [];
            const operationCount = 50;

            // Create concurrent operations
            for (let i = 0; i < operationCount; i++) {
                operations.push(
                    createNode(db, {
                        project_id: projectId,
                        path: `concurrent.node${i}`,
                        value: `value${i}`,
                        type: 'string'
                    })
                );
            }

            // Execute all operations concurrently
            const results = await Promise.all(operations);
            assert.equal(results.length, operationCount, 'all operations should complete');

            // Verify all nodes were created
            const nodes = await getProjectNodes(db, projectId);
            assert.equal(nodes.length, operationCount, 'all nodes should be persisted');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle database corruption gracefully', async () => {
            // Simulate database issues
            const invalidDb = new Database(':memory:');

            try {
                await getProject(invalidDb, 'nonexistent');
                assert.fail('should throw error for invalid database');
            } catch (error) {
                assert(error.message.includes('no such table'), 'should provide meaningful error');
            }
        });

        test('should validate data integrity', async () => {
            const projectId = await createProject(db, { name: 'Integrity Test' });

            // Test invalid foreign key
            try {
                await createNode(db, {
                    project_id: 'invalid-project-id',
                    path: 'test',
                    value: 'test',
                    type: 'string'
                });
                assert.fail('should reject invalid project_id');
            } catch (error) {
                assert(error.message.includes('foreign key'), 'should enforce foreign key constraints');
            }
        });

        test('should handle transaction rollbacks', async () => {
            const projectId = await createProject(db, { name: 'Transaction Test' });

            try {
                await runTransaction(db, async (tx) => {
                    await createNodeTx(tx, {
                        project_id: projectId,
                        path: 'tx.test1',
                        value: 'value1',
                        type: 'string'
                    });

                    // Simulate error
                    throw new Error('Transaction should rollback');
                });

                assert.fail('transaction should have thrown error');
            } catch (error) {
                assert.equal(error.message, 'Transaction should rollback');

                // Verify rollback
                const nodes = await getProjectNodes(db, projectId);
                assert.equal(nodes.length, 0, 'transaction should have rolled back');
            }
        });
    });
});

// Helper functions for database operations

async function initializeSchema(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            // Projects table
            db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT DEFAULT '{}'
                )
            `);

            // Nodes table
            db.run(`
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    parent_id TEXT,
                    path TEXT NOT NULL,
                    value TEXT,
                    type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT DEFAULT '{}',
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
                )
            `);

            // Node relationships (for complex hierarchies)
            db.run(`
                CREATE TABLE IF NOT EXISTS node_relationships (
                    parent_id TEXT NOT NULL,
                    child_id TEXT NOT NULL,
                    relationship_type TEXT DEFAULT 'child',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (parent_id, child_id),
                    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE,
                    FOREIGN KEY (child_id) REFERENCES nodes(id) ON DELETE CASCADE
                )
            `);

            // Snapshots table
            db.run(`
                CREATE TABLE IF NOT EXISTS snapshots (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    description TEXT,
                    data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            `);

            // Changes log
            db.run(`
                CREATE TABLE IF NOT EXISTS changes_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    node_id TEXT,
                    operation TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT DEFAULT '{}',
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL
                )
            `);

            // Indexes for performance
            db.run('CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path)');
            db.run('CREATE INDEX IF NOT EXISTS idx_changes_project_id ON changes_log(project_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON changes_log(timestamp)');

            resolve();
        });
    });
}

function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createProject(db, data) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const metadata = JSON.stringify(data.metadata || {});

        db.run(
            'INSERT INTO projects (id, name, metadata) VALUES (?, ?, ?)',
            [id, data.name, metadata],
            function(err) {
                if (err) reject(err);
                else resolve(id);
            }
        );
    });
}

function getProject(db, id) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM projects WHERE id = ?',
            [id],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });
}

function updateProject(db, id, data) {
    return new Promise((resolve, reject) => {
        const updates = [];
        const values = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }

        if (data.metadata !== undefined) {
            updates.push('metadata = ?');
            values.push(JSON.stringify(data.metadata));
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        db.run(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function deleteProject(db, id) {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM projects WHERE id = ?',
            [id],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function createNode(db, data) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const metadata = JSON.stringify(data.metadata || {});

        db.run(
            'INSERT INTO nodes (id, project_id, parent_id, path, value, type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, data.project_id, data.parent_id || null, data.path, data.value, data.type, metadata],
            function(err) {
                if (err) reject(err);
                else {
                    // Log the change
                    logChange(db, data.project_id, id, 'CREATE', null, data.value);
                    resolve(id);
                }
            }
        );
    });
}

function getNode(db, id) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM nodes WHERE id = ?',
            [id],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });
}

function updateNode(db, id, data) {
    return new Promise((resolve, reject) => {
        // First get current value for logging
        db.get('SELECT value, project_id FROM nodes WHERE id = ?', [id], (err, currentNode) => {
            if (err) {
                reject(err);
                return;
            }

            const updates = [];
            const values = [];

            if (data.value !== undefined) {
                updates.push('value = ?');
                values.push(data.value);
            }

            if (data.metadata !== undefined) {
                updates.push('metadata = ?');
                values.push(JSON.stringify(data.metadata));
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            db.run(
                `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else {
                        // Log the change
                        if (data.value !== undefined && currentNode) {
                            logChange(db, currentNode.project_id, id, 'UPDATE', currentNode.value, data.value);
                        }
                        resolve(this.changes);
                    }
                }
            );
        });
    });
}

function deleteNode(db, id) {
    return new Promise((resolve, reject) => {
        // First get node info for logging
        db.get('SELECT project_id, value FROM nodes WHERE id = ?', [id], (err, node) => {
            if (err) {
                reject(err);
                return;
            }

            db.run(
                'DELETE FROM nodes WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else {
                        // Log the change
                        if (node) {
                            logChange(db, node.project_id, id, 'DELETE', node.value, null);
                        }
                        resolve(this.changes);
                    }
                }
            );
        });
    });
}

function getProjectNodes(db, projectId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM nodes WHERE project_id = ? ORDER BY path',
            [projectId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function getChildNodes(db, parentId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM nodes WHERE parent_id = ? ORDER BY path',
            [parentId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function logChange(db, projectId, nodeId, operation, oldValue, newValue) {
    db.run(
        'INSERT INTO changes_log (project_id, node_id, operation, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
        [projectId, nodeId, operation, oldValue, newValue],
        () => {} // Ignore errors for logging
    );
}

function getChanges(db, projectId, limit = 100) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM changes_log WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?',
            [projectId, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function createSnapshot(db, projectId, description) {
    return new Promise((resolve, reject) => {
        const id = generateId();

        // Get all project data
        db.all(
            'SELECT * FROM nodes WHERE project_id = ?',
            [projectId],
            (err, nodes) => {
                if (err) {
                    reject(err);
                    return;
                }

                const snapshotData = JSON.stringify({ nodes });

                db.run(
                    'INSERT INTO snapshots (id, project_id, description, data) VALUES (?, ?, ?, ?)',
                    [id, projectId, description, snapshotData],
                    function(err) {
                        if (err) reject(err);
                        else resolve(id);
                    }
                );
            }
        );
    });
}

function getSnapshot(db, id) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM snapshots WHERE id = ?',
            [id],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });
}

function restoreFromSnapshot(db, snapshotId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM snapshots WHERE id = ?',
            [snapshotId],
            (err, snapshot) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!snapshot) {
                    reject(new Error('Snapshot not found'));
                    return;
                }

                const data = JSON.parse(snapshot.data);

                // Start transaction for restoration
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    // Clear current nodes
                    db.run('DELETE FROM nodes WHERE project_id = ?', [snapshot.project_id]);

                    // Restore nodes
                    const stmt = db.prepare(`
                        INSERT INTO nodes (id, project_id, parent_id, path, value, type, created_at, updated_at, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    for (const node of data.nodes) {
                        stmt.run([
                            node.id, node.project_id, node.parent_id, node.path,
                            node.value, node.type, node.created_at, node.updated_at, node.metadata
                        ]);
                    }

                    stmt.finalize();

                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        );
    });
}

function batchCreateNodes(db, nodes) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const stmt = db.prepare(`
                INSERT INTO nodes (id, project_id, parent_id, path, value, type, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const node of nodes) {
                const id = generateId();
                const metadata = JSON.stringify(node.metadata || {});
                stmt.run([id, node.project_id, node.parent_id || null, node.path, node.value, node.type, metadata]);
            }

            stmt.finalize();

            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function queryNodes(db, projectId, pathPattern) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM nodes WHERE project_id = ? AND path LIKE ?',
            [projectId, pathPattern],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function getTableNames(db) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT name FROM sqlite_master WHERE type='table'",
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.name));
            }
        );
    });
}

function getTableSchema(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(
            `PRAGMA table_info(${tableName})`,
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function getForeignKeys(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(
            `PRAGMA foreign_key_list(${tableName})`,
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

function runTransaction(db, operations) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            try {
                operations(db).then(() => {
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }).catch((error) => {
                    db.run('ROLLBACK', () => {
                        reject(error);
                    });
                });
            } catch (error) {
                db.run('ROLLBACK', () => {
                    reject(error);
                });
            }
        });
    });
}

function createNodeTx(tx, data) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const metadata = JSON.stringify(data.metadata || {});

        tx.run(
            'INSERT INTO nodes (id, project_id, parent_id, path, value, type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, data.project_id, data.parent_id || null, data.path, data.value, data.type, metadata],
            function(err) {
                if (err) reject(err);
                else resolve(id);
            }
        );
    });
}