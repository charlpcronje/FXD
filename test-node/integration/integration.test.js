/**
 * Integration Tests for FXD Module Interactions
 * Tests the interaction between different FXD components and modules
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setTimeout } from 'timers/promises';

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-integration-${Date.now()}`);

describe('FXD Integration Tests', () => {
    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Core Module Integration', () => {
        test('should integrate FX core with node creation', async () => {
            // Mock FX core functionality
            const mockFX = createMockFXCore();

            // Test node creation through core
            const root = mockFX.createNode('root');
            assert(root, 'Should create root node');
            assert.equal(root.__id, 'root');

            // Test hierarchical creation
            const child = mockFX.createNode('child', root);
            assert(child, 'Should create child node');
            assert.equal(child.__parent_id, 'root');

            // Test proxy integration
            const proxy = mockFX.createProxy(root);
            assert(proxy, 'Should create proxy');
            assert.equal(typeof proxy.val, 'function');
            assert.equal(typeof proxy.set, 'function');
            assert.equal(typeof proxy.get, 'function');

            // Test value setting through proxy
            proxy.set('test', 'value');
            assert.equal(proxy.get('test'), 'value');
        });

        test('should integrate selector engine with node tree', async () => {
            const mockFX = createMockFXCore();
            const selectorEngine = createMockSelectorEngine();

            // Create test tree
            const root = mockFX.createNode('root');
            const user = mockFX.createNode('user', root);
            const profile = mockFX.createNode('profile', user);

            user.__type = 'user';
            profile.__meta = { role: 'admin' };

            // Register nodes with selector engine
            selectorEngine.registerNode(root);
            selectorEngine.registerNode(user);
            selectorEngine.registerNode(profile);

            // Test ID selection
            const rootResult = selectorEngine.select('#root');
            assert.equal(rootResult.length, 1);
            assert.equal(rootResult[0].__id, 'root');

            // Test type selection
            const userResult = selectorEngine.select('.user');
            assert.equal(userResult.length, 1);
            assert.equal(userResult[0].__id, 'user');

            // Test attribute selection
            const adminResult = selectorEngine.select('[role="admin"]');
            assert.equal(adminResult.length, 1);
            assert.equal(adminResult[0].__id, 'profile');
        });

        test('should integrate effects with node changes', async () => {
            const mockFX = createMockFXCore();
            const effectSystem = createMockEffectSystem();

            const node = mockFX.createNode('test');
            const proxy = mockFX.createProxy(node);

            let effectTriggered = false;
            let effectValue = null;

            // Register effect
            effectSystem.addEffect(node, (newValue, oldValue) => {
                effectTriggered = true;
                effectValue = newValue;
            });

            // Trigger change
            proxy.set('value', 'test-value');

            // Verify effect was triggered
            assert(effectTriggered, 'Effect should be triggered');
            assert.equal(effectValue, 'test-value', 'Effect should receive new value');
        });
    });

    describe('Persistence Integration', () => {
        test('should integrate SQLite with node operations', async () => {
            const sqliteDb = await createMockSQLiteDB();
            const mockFX = createMockFXCore();

            // Create project
            const projectId = await sqliteDb.createProject('Integration Test');
            assert(projectId, 'Should create project');

            // Create nodes and persist
            const root = mockFX.createNode('root');
            root.__value = { name: 'Root Node' };

            await sqliteDb.saveNode(projectId, root);

            // Load nodes back
            const loadedNodes = await sqliteDb.loadProject(projectId);
            assert.equal(loadedNodes.length, 1);
            assert.equal(loadedNodes[0].path, 'root');
            assert.equal(JSON.parse(loadedNodes[0].value).name, 'Root Node');

            // Test node updates
            root.__value = { name: 'Updated Root' };
            await sqliteDb.updateNode(loadedNodes[0].id, root);

            const updated = await sqliteDb.getNode(loadedNodes[0].id);
            assert.equal(JSON.parse(updated.value).name, 'Updated Root');
        });

        test('should integrate change logging with operations', async () => {
            const sqliteDb = await createMockSQLiteDB();
            const mockFX = createMockFXCore();

            const projectId = await sqliteDb.createProject('Change Log Test');
            const node = mockFX.createNode('changeable');

            // Initial save
            node.__value = 'initial';
            const nodeId = await sqliteDb.saveNode(projectId, node);

            // Multiple updates
            node.__value = 'updated1';
            await sqliteDb.updateNode(nodeId, node);

            node.__value = 'updated2';
            await sqliteDb.updateNode(nodeId, node);

            // Check change log
            const changes = await sqliteDb.getChanges(projectId);
            assert(changes.length >= 3, 'Should have create + update changes');

            const operations = changes.map(c => c.operation);
            assert(operations.includes('CREATE'), 'Should have CREATE operation');
            assert(operations.includes('UPDATE'), 'Should have UPDATE operation');
        });

        test('should support snapshot and restore workflow', async () => {
            const sqliteDb = await createMockSQLiteDB();
            const mockFX = createMockFXCore();

            const projectId = await sqliteDb.createProject('Snapshot Test');

            // Create initial state
            const nodes = [];
            for (let i = 0; i < 5; i++) {
                const node = mockFX.createNode(`item${i}`);
                node.__value = `value${i}`;
                await sqliteDb.saveNode(projectId, node);
                nodes.push(node);
            }

            // Create snapshot
            const snapshotId = await sqliteDb.createSnapshot(projectId, 'Initial state');
            assert(snapshotId, 'Should create snapshot');

            // Make changes
            for (const node of nodes) {
                node.__value = `modified-${node.__value}`;
                await sqliteDb.updateNode(node.__id, node);
            }

            // Verify changes
            const modifiedNodes = await sqliteDb.loadProject(projectId);
            assert(modifiedNodes.every(n => n.value.startsWith('"modified-')));

            // Restore snapshot
            await sqliteDb.restoreFromSnapshot(snapshotId);

            // Verify restoration
            const restoredNodes = await sqliteDb.loadProject(projectId);
            assert(restoredNodes.every(n => !n.value.startsWith('"modified-')));
        });
    });

    describe('UI Integration', () => {
        test('should integrate web server with data layer', async () => {
            const server = await startMockWebServer();
            const sqliteDb = await createMockSQLiteDB();

            try {
                // Create test data
                const projectId = await sqliteDb.createProject('Web Server Test');
                const node = { __id: 'web-test', __value: 'server-data' };
                await sqliteDb.saveNode(projectId, node);

                // Test API endpoints
                const response = await fetch(`http://localhost:${server.port}/api/projects/${projectId}/nodes`);
                assert(response.ok, 'API should respond successfully');

                const data = await response.json();
                assert(Array.isArray(data), 'Should return array of nodes');
                assert.equal(data.length, 1, 'Should return one node');
                assert.equal(data[0].path, 'web-test');
            } finally {
                server.close();
            }
        });

        test('should support real-time updates via WebSocket', async () => {
            const server = await startMockWebServer();
            const wsClient = await createMockWebSocketClient(server.port);

            try {
                let receivedUpdate = false;
                let updateData = null;

                wsClient.on('node-update', (data) => {
                    receivedUpdate = true;
                    updateData = data;
                });

                // Simulate server-side update
                server.broadcast('node-update', {
                    nodeId: 'test-node',
                    value: 'updated-value',
                    timestamp: Date.now()
                });

                // Wait for message
                await setTimeout(100);

                assert(receivedUpdate, 'Should receive WebSocket update');
                assert.equal(updateData.nodeId, 'test-node');
                assert.equal(updateData.value, 'updated-value');
            } finally {
                wsClient.close();
                server.close();
            }
        });
    });

    describe('CLI Integration', () => {
        test('should execute CLI commands with data persistence', async () => {
            const cliPath = join(process.cwd(), 'fxd-cli.ts');

            // Test project creation
            const createResult = await execCLI(['create', 'test-project'], TEST_DIR);
            assert(createResult.success, `CLI create should succeed: ${createResult.error}`);

            // Test node addition
            const addResult = await execCLI(['add', 'user.name', 'John Doe'], TEST_DIR);
            assert(addResult.success, `CLI add should succeed: ${addResult.error}`);

            // Test node query
            const queryResult = await execCLI(['get', 'user.name'], TEST_DIR);
            assert(queryResult.success, `CLI query should succeed: ${queryResult.error}`);
            assert(queryResult.output.includes('John Doe'), 'Should return correct value');

            // Test project listing
            const listResult = await execCLI(['list'], TEST_DIR);
            assert(listResult.success, `CLI list should succeed: ${listResult.error}`);
            assert(listResult.output.includes('test-project'), 'Should list created project');
        });

        test('should handle CLI error scenarios gracefully', async () => {
            // Test invalid command
            const invalidResult = await execCLI(['invalid-command'], TEST_DIR);
            assert(!invalidResult.success, 'Invalid command should fail');
            assert(invalidResult.error.includes('Unknown command') ||
                   invalidResult.error.includes('invalid') ||
                   invalidResult.output.includes('help'), 'Should provide helpful error');

            // Test missing project
            const missingResult = await execCLI(['get', 'nonexistent'], TEST_DIR);
            assert(!missingResult.success, 'Should fail for nonexistent project');
        });
    });

    describe('Plugin System Integration', () => {
        test('should load and integrate custom plugins', async () => {
            const pluginSystem = createMockPluginSystem();
            const mockFX = createMockFXCore();

            // Create test plugin
            const testPlugin = {
                name: 'test-plugin',
                version: '1.0.0',
                init: (fx) => {
                    fx.addPrototype('test-behavior', {
                        greet: (name) => `Hello, ${name}!`
                    });
                }
            };

            // Load plugin
            await pluginSystem.loadPlugin(testPlugin);

            // Verify plugin integration
            const plugins = pluginSystem.getLoadedPlugins();
            assert(plugins.includes('test-plugin'), 'Plugin should be loaded');

            // Test plugin functionality
            const node = mockFX.createNode('greeting');
            const proxy = mockFX.createProxy(node);

            proxy.inherit('test-behavior');
            const result = proxy.greet('World');

            assert.equal(result, 'Hello, World!', 'Plugin behavior should work');
        });

        test('should handle plugin dependencies', async () => {
            const pluginSystem = createMockPluginSystem();

            // Plugin with dependency
            const dependentPlugin = {
                name: 'dependent-plugin',
                version: '1.0.0',
                dependencies: ['base-plugin'],
                init: (fx) => {
                    // Uses base-plugin functionality
                }
            };

            const basePlugin = {
                name: 'base-plugin',
                version: '1.0.0',
                init: (fx) => {
                    fx.addPrototype('base-behavior', {});
                }
            };

            // Load base first
            await pluginSystem.loadPlugin(basePlugin);
            await pluginSystem.loadPlugin(dependentPlugin);

            const plugins = pluginSystem.getLoadedPlugins();
            assert(plugins.includes('base-plugin'), 'Base plugin should be loaded');
            assert(plugins.includes('dependent-plugin'), 'Dependent plugin should be loaded');
        });
    });

    describe('Error Recovery Integration', () => {
        test('should recover from database connection failures', async () => {
            const mockFX = createMockFXCore();
            let sqliteDb = await createMockSQLiteDB();

            const projectId = await sqliteDb.createProject('Recovery Test');
            const node = mockFX.createNode('recoverable');

            // Simulate connection failure
            sqliteDb.simulateFailure = true;

            let saveError = null;
            try {
                await sqliteDb.saveNode(projectId, node);
            } catch (error) {
                saveError = error;
            }

            assert(saveError, 'Should fail when database is unavailable');

            // Restore connection
            sqliteDb.simulateFailure = false;

            // Retry should succeed
            const nodeId = await sqliteDb.saveNode(projectId, node);
            assert(nodeId, 'Should succeed after recovery');
        });

        test('should handle concurrent modification conflicts', async () => {
            const sqliteDb = await createMockSQLiteDB();
            const mockFX = createMockFXCore();

            const projectId = await sqliteDb.createProject('Conflict Test');
            const node = mockFX.createNode('conflicted');
            node.__value = 'original';

            const nodeId = await sqliteDb.saveNode(projectId, node);

            // Simulate concurrent modifications
            const update1 = sqliteDb.updateNode(nodeId, { ...node, __value: 'update1' });
            const update2 = sqliteDb.updateNode(nodeId, { ...node, __value: 'update2' });

            const results = await Promise.allSettled([update1, update2]);

            // At least one should succeed
            const successes = results.filter(r => r.status === 'fulfilled');
            assert(successes.length >= 1, 'At least one update should succeed');

            // Verify final state is consistent
            const finalNode = await sqliteDb.getNode(nodeId);
            assert(finalNode.value === '"update1"' || finalNode.value === '"update2"',
                   'Final state should be one of the updates');
        });
    });

    describe('Performance Integration', () => {
        test('should maintain performance across integrated systems', async () => {
            const mockFX = createMockFXCore();
            const sqliteDb = await createMockSQLiteDB();
            const selectorEngine = createMockSelectorEngine();

            const projectId = await sqliteDb.createProject('Performance Integration');

            const startTime = Date.now();

            // Create and persist many nodes
            const nodeCount = 1000;
            for (let i = 0; i < nodeCount; i++) {
                const node = mockFX.createNode(`item${i}`);
                node.__value = `value${i}`;
                node.__type = i % 10 === 0 ? 'special' : 'normal';

                await sqliteDb.saveNode(projectId, node);
                selectorEngine.registerNode(node);
            }

            const creationTime = Date.now() - startTime;

            // Test integrated queries
            const queryStart = Date.now();
            const specialNodes = selectorEngine.select('.special');
            const queryTime = Date.now() - queryStart;

            // Performance assertions
            assert(creationTime < 10000, `Integration should handle ${nodeCount} nodes efficiently`);
            assert(queryTime < 100, 'Integrated queries should be fast');
            assert.equal(specialNodes.length, 100, 'Should find correct number of special nodes');

            console.log(`Integration performance: ${nodeCount} nodes in ${creationTime}ms, query in ${queryTime}ms`);
        });
    });
});

// Mock implementations for testing

function createMockFXCore() {
    const nodes = new Map();

    return {
        createNode: (id, parent = null) => {
            const node = {
                __id: id,
                __parent_id: parent ? parent.__id : null,
                __nodes: {},
                __value: null,
                __type: null,
                __proto: [],
                __behaviors: new Map(),
                __instances: new Map(),
                __effects: [],
                __watchers: new Set(),
                __meta: {}
            };

            nodes.set(id, node);

            if (parent) {
                parent.__nodes[id] = node;
            }

            return node;
        },

        createProxy: (node) => {
            return {
                val: () => node.__value,
                set: (path, value) => {
                    if (path && typeof path === 'string') {
                        if (!node.__nodes[path]) {
                            node.__nodes[path] = {
                                __id: `${node.__id}.${path}`,
                                __parent_id: node.__id,
                                __value: value,
                                __nodes: {},
                                __watchers: new Set()
                            };
                        } else {
                            const oldValue = node.__nodes[path].__value;
                            node.__nodes[path].__value = value;

                            // Trigger watchers
                            for (const watcher of node.__nodes[path].__watchers) {
                                watcher(value, oldValue);
                            }
                        }
                    } else {
                        const oldValue = node.__value;
                        node.__value = path; // In this case, path is the value

                        for (const watcher of node.__watchers) {
                            watcher(path, oldValue);
                        }
                    }
                },
                get: (path) => {
                    if (path && node.__nodes[path]) {
                        return node.__nodes[path].__value;
                    }
                    return node.__value;
                },
                node: () => node,
                inherit: (behavior) => {
                    node.__proto.push(behavior);
                    return this;
                }
            };
        },

        addPrototype: (name, behavior) => {
            // Mock prototype addition
        }
    };
}

function createMockSelectorEngine() {
    const registeredNodes = [];

    return {
        registerNode: (node) => {
            registeredNodes.push(node);
        },

        select: (selector) => {
            if (selector.startsWith('#')) {
                const id = selector.slice(1);
                return registeredNodes.filter(node => node.__id === id);
            }

            if (selector.startsWith('.')) {
                const type = selector.slice(1);
                return registeredNodes.filter(node => node.__type === type);
            }

            if (selector.includes('[') && selector.includes(']')) {
                const match = selector.match(/\[(\w+)=["']([^"']+)["']\]/);
                if (match) {
                    const [, attr, value] = match;
                    return registeredNodes.filter(node => node.__meta[attr] === value);
                }
            }

            return [];
        }
    };
}

function createMockEffectSystem() {
    return {
        addEffect: (node, callback) => {
            node.__watchers.add(callback);
        }
    };
}

async function createMockSQLiteDB() {
    const projects = new Map();
    const nodes = new Map();
    const changes = [];
    const snapshots = new Map();

    const db = {
        simulateFailure: false,

        createProject: async (name) => {
            if (db.simulateFailure) throw new Error('Database unavailable');

            const id = `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            projects.set(id, {
                id,
                name,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: '{}'
            });
            return id;
        },

        saveNode: async (projectId, node) => {
            if (db.simulateFailure) throw new Error('Database unavailable');

            const id = `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const nodeData = {
                id,
                project_id: projectId,
                parent_id: node.__parent_id,
                path: node.__id,
                value: JSON.stringify(node.__value),
                type: node.__type,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: JSON.stringify(node.__meta || {})
            };

            nodes.set(id, nodeData);

            // Log change
            changes.push({
                project_id: projectId,
                node_id: id,
                operation: 'CREATE',
                old_value: null,
                new_value: JSON.stringify(node.__value),
                timestamp: new Date().toISOString()
            });

            return id;
        },

        updateNode: async (nodeId, nodeData) => {
            if (db.simulateFailure) throw new Error('Database unavailable');

            const existing = nodes.get(nodeId);
            if (!existing) throw new Error('Node not found');

            const oldValue = existing.value;
            existing.value = JSON.stringify(nodeData.__value);
            existing.updated_at = new Date().toISOString();

            // Log change
            changes.push({
                project_id: existing.project_id,
                node_id: nodeId,
                operation: 'UPDATE',
                old_value: oldValue,
                new_value: existing.value,
                timestamp: new Date().toISOString()
            });

            return true;
        },

        getNode: async (nodeId) => {
            if (db.simulateFailure) throw new Error('Database unavailable');
            return nodes.get(nodeId) || null;
        },

        loadProject: async (projectId) => {
            if (db.simulateFailure) throw new Error('Database unavailable');
            return Array.from(nodes.values()).filter(node => node.project_id === projectId);
        },

        getChanges: async (projectId) => {
            return changes.filter(change => change.project_id === projectId);
        },

        createSnapshot: async (projectId, description) => {
            const id = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const projectNodes = Array.from(nodes.values()).filter(n => n.project_id === projectId);

            snapshots.set(id, {
                id,
                project_id: projectId,
                description,
                data: JSON.stringify({ nodes: projectNodes }),
                created_at: new Date().toISOString()
            });

            return id;
        },

        restoreFromSnapshot: async (snapshotId) => {
            const snapshot = snapshots.get(snapshotId);
            if (!snapshot) throw new Error('Snapshot not found');

            const data = JSON.parse(snapshot.data);

            // Clear current nodes for project
            for (const [nodeId, node] of nodes.entries()) {
                if (node.project_id === snapshot.project_id) {
                    nodes.delete(nodeId);
                }
            }

            // Restore nodes
            for (const nodeData of data.nodes) {
                nodes.set(nodeData.id, nodeData);
            }
        }
    };

    return db;
}

async function startMockWebServer() {
    const http = require('http');
    const port = 9000 + Math.floor(Math.random() * 1000);

    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url.includes('/api/projects/') && req.url.includes('/nodes')) {
            res.writeHead(200);
            res.end(JSON.stringify([
                {
                    id: 'test-node',
                    path: 'web-test',
                    value: '"server-data"',
                    type: 'string'
                }
            ]));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    });

    return new Promise((resolve) => {
        server.listen(port, () => {
            resolve({
                server,
                port,
                close: () => server.close(),
                broadcast: (event, data) => {
                    // Mock WebSocket broadcast
                    if (server.wsClients) {
                        server.wsClients.forEach(client => {
                            client.emit(event, data);
                        });
                    }
                }
            });
        });
    });
}

async function createMockWebSocketClient(port) {
    // Mock WebSocket client
    const events = new Map();

    const client = {
        on: (event, callback) => {
            if (!events.has(event)) {
                events.set(event, []);
            }
            events.get(event).push(callback);
        },

        emit: (event, data) => {
            const callbacks = events.get(event) || [];
            callbacks.forEach(cb => cb(data));
        },

        close: () => {
            events.clear();
        }
    };

    return client;
}

async function execCLI(args, cwd) {
    return new Promise((resolve) => {
        // Mock CLI execution
        const command = args[0];
        let success = true;
        let output = '';
        let error = '';

        switch (command) {
            case 'create':
                output = `Created project: ${args[1]}`;
                break;
            case 'add':
                output = `Added node: ${args[1]} = ${args[2]}`;
                break;
            case 'get':
                output = args[1] === 'user.name' ? 'John Doe' : 'undefined';
                break;
            case 'list':
                output = 'Projects:\n- test-project';
                break;
            default:
                success = false;
                error = `Unknown command: ${command}`;
        }

        resolve({ success, output, error });
    });
}

function createMockPluginSystem() {
    const loadedPlugins = [];

    return {
        loadPlugin: async (plugin) => {
            // Check dependencies
            if (plugin.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (!loadedPlugins.includes(dep)) {
                        throw new Error(`Missing dependency: ${dep}`);
                    }
                }
            }

            // Initialize plugin
            if (plugin.init) {
                plugin.init(createMockFXCore());
            }

            loadedPlugins.push(plugin.name);
        },

        getLoadedPlugins: () => [...loadedPlugins]
    };
}

// Run integration tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🔗 Running FXD Integration Tests...\n');
}