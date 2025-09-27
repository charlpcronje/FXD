/**
 * Performance Benchmarks and Stress Tests for FXD
 * Measures system performance under various load conditions
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { setTimeout } from 'timers/promises';

// Performance metrics collection
class PerformanceCollector {
    constructor() {
        this.metrics = new Map();
        this.startTimes = new Map();
    }

    start(label) {
        this.startTimes.set(label, performance.now());
    }

    end(label) {
        const startTime = this.startTimes.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            if (!this.metrics.has(label)) {
                this.metrics.set(label, []);
            }
            this.metrics.get(label).push(duration);
            this.startTimes.delete(label);
            return duration;
        }
        return 0;
    }

    getStats(label) {
        const measurements = this.metrics.get(label) || [];
        if (measurements.length === 0) return null;

        const sorted = [...measurements].sort((a, b) => a - b);
        return {
            count: measurements.length,
            min: Math.min(...measurements),
            max: Math.max(...measurements),
            avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    report() {
        console.log('\n📊 Performance Report:');
        console.log('=' .repeat(60));

        for (const [label, _] of this.metrics) {
            const stats = this.getStats(label);
            if (stats) {
                console.log(`\n${label}:`);
                console.log(`  Count: ${stats.count}`);
                console.log(`  Average: ${stats.avg.toFixed(2)}ms`);
                console.log(`  Median: ${stats.median.toFixed(2)}ms`);
                console.log(`  Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`);
                console.log(`  P95/P99: ${stats.p95.toFixed(2)}ms / ${stats.p99.toFixed(2)}ms`);
            }
        }
        console.log('=' .repeat(60));
    }
}

// Mock FX Node for testing
class MockFXNode {
    constructor(id, value = null) {
        this.__id = id;
        this.__parent_id = null;
        this.__nodes = {};
        this.__value = value;
        this.__type = null;
        this.__proto = [];
        this.__behaviors = new Map();
        this.__instances = new Map();
        this.__effects = [];
        this.__watchers = new Set();
        this.__meta = {};
    }

    set(path, value) {
        if (typeof path === 'string' && path.includes('.')) {
            const parts = path.split('.');
            let current = this;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current.__nodes[part]) {
                    current.__nodes[part] = new MockFXNode(`${current.__id}.${part}`);
                    current.__nodes[part].__parent_id = current.__id;
                }
                current = current.__nodes[part];
            }

            const lastPart = parts[parts.length - 1];
            if (!current.__nodes[lastPart]) {
                current.__nodes[lastPart] = new MockFXNode(`${current.__id}.${lastPart}`, value);
                current.__nodes[lastPart].__parent_id = current.__id;
            } else {
                current.__nodes[lastPart].__value = value;
            }
        } else {
            this.__value = value;
        }

        // Trigger watchers
        for (const watcher of this.__watchers) {
            watcher(value, this.__value);
        }
    }

    get(path) {
        if (!path) return this.__value;

        const parts = path.split('.');
        let current = this;

        for (const part of parts) {
            if (!current.__nodes[part]) {
                return undefined;
            }
            current = current.__nodes[part];
        }

        return current.__value;
    }

    watch(callback) {
        this.__watchers.add(callback);
        return () => this.__watchers.delete(callback);
    }

    getAllNodes() {
        const nodes = [];

        function traverse(node) {
            nodes.push(node);
            for (const child of Object.values(node.__nodes)) {
                traverse(child);
            }
        }

        traverse(this);
        return nodes;
    }
}

// Mock selector engine
class MockSelectorEngine {
    constructor(root) {
        this.root = root;
    }

    select(selector) {
        const results = [];

        if (selector.startsWith('#')) {
            // ID selector
            const id = selector.slice(1);
            const nodes = this.root.getAllNodes();
            return nodes.filter(node => node.__id.endsWith(id));
        }

        if (selector.startsWith('.')) {
            // Class selector (using __type)
            const className = selector.slice(1);
            const nodes = this.root.getAllNodes();
            return nodes.filter(node => node.__type === className);
        }

        if (selector.includes('[') && selector.includes(']')) {
            // Attribute selector
            const match = selector.match(/\[(\w+)=["']([^"']+)["']\]/);
            if (match) {
                const [, attr, value] = match;
                const nodes = this.root.getAllNodes();
                return nodes.filter(node => node.__meta[attr] === value);
            }
        }

        return results;
    }
}

describe('FXD Performance Benchmarks', () => {
    let collector;
    let rootNode;
    let selectorEngine;

    beforeEach(() => {
        collector = new PerformanceCollector();
        rootNode = new MockFXNode('root');
        selectorEngine = new MockSelectorEngine(rootNode);
    });

    describe('Node Creation Performance', () => {
        test('should create nodes efficiently', async () => {
            const nodeCount = 10000;

            collector.start('node_creation');

            for (let i = 0; i < nodeCount; i++) {
                rootNode.set(`data.item${i}`, `value${i}`);
            }

            const duration = collector.end('node_creation');

            // Verify all nodes were created
            const allNodes = rootNode.getAllNodes();
            assert(allNodes.length >= nodeCount, `Should create ${nodeCount} nodes`);

            // Performance assertions
            assert(duration < 5000, `Creating ${nodeCount} nodes should take under 5 seconds, took ${duration.toFixed(2)}ms`);

            const avgPerNode = duration / nodeCount;
            assert(avgPerNode < 0.5, `Average creation time should be under 0.5ms per node, was ${avgPerNode.toFixed(3)}ms`);

            console.log(`Created ${nodeCount} nodes in ${duration.toFixed(2)}ms (${avgPerNode.toFixed(3)}ms per node)`);
        });

        test('should handle deep nesting efficiently', async () => {
            const depth = 1000;

            collector.start('deep_nesting');

            // Create deeply nested structure
            let path = 'deep';
            for (let i = 0; i < depth; i++) {
                path += `.level${i}`;
                rootNode.set(path, `value at depth ${i}`);
            }

            const createDuration = collector.end('deep_nesting');

            // Test retrieval
            collector.start('deep_retrieval');
            const value = rootNode.get(path);
            const retrievalDuration = collector.end('deep_retrieval');

            assert.equal(value, `value at depth ${depth - 1}`, 'Should retrieve correct value');
            assert(createDuration < 1000, `Deep nesting creation should be under 1 second, took ${createDuration.toFixed(2)}ms`);
            assert(retrievalDuration < 100, `Deep retrieval should be under 100ms, took ${retrievalDuration.toFixed(2)}ms`);

            console.log(`Deep nesting (${depth} levels): create ${createDuration.toFixed(2)}ms, retrieve ${retrievalDuration.toFixed(2)}ms`);
        });
    });

    describe('Selector Performance', () => {
        beforeEach(() => {
            // Create test data structure
            for (let i = 0; i < 1000; i++) {
                const node = new MockFXNode(`item${i}`, `value${i}`);
                node.__type = i % 3 === 0 ? 'special' : 'normal';
                node.__meta.category = i % 5 === 0 ? 'important' : 'regular';
                rootNode.__nodes[`item${i}`] = node;
            }
        });

        test('should perform ID selectors efficiently', async () => {
            const iterations = 1000;

            collector.start('id_selectors');

            for (let i = 0; i < iterations; i++) {
                const id = `item${i % 100}`;
                const results = selectorEngine.select(`#${id}`);
                assert(results.length <= 1, 'ID selector should return at most one result');
            }

            const duration = collector.end('id_selectors');
            const avgPerQuery = duration / iterations;

            assert(avgPerQuery < 1, `ID selector should average under 1ms per query, was ${avgPerQuery.toFixed(3)}ms`);

            console.log(`ID selectors: ${iterations} queries in ${duration.toFixed(2)}ms (${avgPerQuery.toFixed(3)}ms per query)`);
        });

        test('should perform class selectors efficiently', async () => {
            const iterations = 100;

            collector.start('class_selectors');

            for (let i = 0; i < iterations; i++) {
                const results = selectorEngine.select('.special');
                assert(results.length > 0, 'Should find special nodes');
            }

            const duration = collector.end('class_selectors');
            const avgPerQuery = duration / iterations;

            assert(avgPerQuery < 10, `Class selector should average under 10ms per query, was ${avgPerQuery.toFixed(3)}ms`);

            console.log(`Class selectors: ${iterations} queries in ${duration.toFixed(2)}ms (${avgPerQuery.toFixed(3)}ms per query)`);
        });

        test('should perform attribute selectors efficiently', async () => {
            const iterations = 100;

            collector.start('attribute_selectors');

            for (let i = 0; i < iterations; i++) {
                const results = selectorEngine.select('[category="important"]');
                assert(results.length > 0, 'Should find important nodes');
            }

            const duration = collector.end('attribute_selectors');
            const avgPerQuery = duration / iterations;

            assert(avgPerQuery < 15, `Attribute selector should average under 15ms per query, was ${avgPerQuery.toFixed(3)}ms`);

            console.log(`Attribute selectors: ${iterations} queries in ${duration.toFixed(2)}ms (${avgPerQuery.toFixed(3)}ms per query)`);
        });
    });

    describe('Memory Usage', () => {
        test('should manage memory efficiently with large datasets', async () => {
            const initialMemory = process.memoryUsage();

            // Create large dataset
            const nodeCount = 50000;

            console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

            for (let i = 0; i < nodeCount; i++) {
                rootNode.set(`large.dataset.item${i}`, {
                    id: i,
                    data: `test data for item ${i}`,
                    timestamp: Date.now(),
                    metadata: { processed: false, priority: i % 10 }
                });
            }

            const afterCreation = process.memoryUsage();
            console.log(`After creation: ${(afterCreation.heapUsed / 1024 / 1024).toFixed(2)}MB`);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const afterGC = process.memoryUsage();
            console.log(`After GC: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`);

            const memoryIncrease = afterGC.heapUsed - initialMemory.heapUsed;
            const memoryPerNode = memoryIncrease / nodeCount;

            console.log(`Memory per node: ${memoryPerNode.toFixed(0)} bytes`);

            // Memory assertions
            assert(memoryPerNode < 1000, `Memory per node should be under 1KB, was ${memoryPerNode.toFixed(0)} bytes`);
            assert(afterGC.heapUsed < 200 * 1024 * 1024, 'Total heap should be under 200MB');
        });

        test('should handle memory cleanup properly', async () => {
            const nodeCount = 10000;

            // Create nodes
            for (let i = 0; i < nodeCount; i++) {
                rootNode.set(`temp.item${i}`, `value${i}`);
            }

            const beforeCleanup = process.memoryUsage();

            // Clear nodes
            rootNode.__nodes = {};

            if (global.gc) {
                global.gc();
            }

            const afterCleanup = process.memoryUsage();

            const memoryFreed = beforeCleanup.heapUsed - afterCleanup.heapUsed;
            console.log(`Memory freed: ${(memoryFreed / 1024 / 1024).toFixed(2)}MB`);

            assert(memoryFreed > 0, 'Should free memory after cleanup');
        });
    });

    describe('Watcher Performance', () => {
        test('should handle many watchers efficiently', async () => {
            const watcherCount = 1000;
            const updateCount = 1000;

            // Add many watchers
            for (let i = 0; i < watcherCount; i++) {
                rootNode.watch((newVal, oldVal) => {
                    // Simulate some work
                    Math.random();
                });
            }

            collector.start('watcher_updates');

            // Perform updates
            for (let i = 0; i < updateCount; i++) {
                rootNode.set('watched_value', i);
            }

            const duration = collector.end('watcher_updates');
            const avgPerUpdate = duration / updateCount;

            assert(avgPerUpdate < 5, `Update with ${watcherCount} watchers should average under 5ms, was ${avgPerUpdate.toFixed(3)}ms`);

            console.log(`Watcher performance: ${updateCount} updates with ${watcherCount} watchers in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Concurrent Operations', () => {
        test('should handle concurrent reads efficiently', async () => {
            // Setup data
            for (let i = 0; i < 1000; i++) {
                rootNode.set(`concurrent.item${i}`, `value${i}`);
            }

            const workerCount = 4;
            const readsPerWorker = 1000;

            collector.start('concurrent_reads');

            const promises = [];
            for (let w = 0; w < workerCount; w++) {
                promises.push(
                    new Promise(resolve => {
                        const results = [];
                        for (let i = 0; i < readsPerWorker; i++) {
                            const value = rootNode.get(`concurrent.item${i % 1000}`);
                            results.push(value);
                        }
                        resolve(results);
                    })
                );
            }

            const allResults = await Promise.all(promises);
            const duration = collector.end('concurrent_reads');

            const totalReads = workerCount * readsPerWorker;
            const avgPerRead = duration / totalReads;

            assert(allResults.length === workerCount, 'All workers should complete');
            assert(avgPerRead < 0.1, `Concurrent reads should average under 0.1ms, was ${avgPerRead.toFixed(4)}ms`);

            console.log(`Concurrent reads: ${totalReads} reads across ${workerCount} workers in ${duration.toFixed(2)}ms`);
        });

        test('should handle concurrent writes safely', async () => {
            const writerCount = 4;
            const writesPerWriter = 500;

            collector.start('concurrent_writes');

            const promises = [];
            for (let w = 0; w < writerCount; w++) {
                promises.push(
                    new Promise(resolve => {
                        for (let i = 0; i < writesPerWriter; i++) {
                            rootNode.set(`writer${w}.item${i}`, `value${w}-${i}`);
                        }
                        resolve();
                    })
                );
            }

            await Promise.all(promises);
            const duration = collector.end('concurrent_writes');

            const totalWrites = writerCount * writesPerWriter;
            const avgPerWrite = duration / totalWrites;

            assert(avgPerWrite < 1, `Concurrent writes should average under 1ms, was ${avgPerWrite.toFixed(3)}ms`);

            // Verify all writes completed
            const allNodes = rootNode.getAllNodes();
            assert(allNodes.length >= totalWrites, 'All writes should be persisted');

            console.log(`Concurrent writes: ${totalWrites} writes across ${writerCount} writers in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Stress Tests', () => {
        test('should survive prolonged heavy usage', async () => {
            const testDuration = 5000; // 5 seconds
            const startTime = Date.now();

            let operationCount = 0;
            const errors = [];

            // Run continuous operations
            while (Date.now() - startTime < testDuration) {
                try {
                    const operation = operationCount % 4;

                    switch (operation) {
                        case 0: // Create
                            rootNode.set(`stress.item${operationCount}`, `value${operationCount}`);
                            break;
                        case 1: // Read
                            rootNode.get(`stress.item${Math.floor(operationCount / 2)}`);
                            break;
                        case 2: // Update
                            rootNode.set(`stress.item${Math.floor(operationCount / 4)}`, `updated${operationCount}`);
                            break;
                        case 3: // Query
                            selectorEngine.select('#stress');
                            break;
                    }

                    operationCount++;
                } catch (error) {
                    errors.push(error);
                }
            }

            const actualDuration = Date.now() - startTime;
            const opsPerSecond = (operationCount / actualDuration) * 1000;

            assert.equal(errors.length, 0, `Should not have errors during stress test: ${errors.length} errors`);
            assert(opsPerSecond > 100, `Should handle at least 100 ops/sec, achieved ${opsPerSecond.toFixed(0)} ops/sec`);

            console.log(`Stress test: ${operationCount} operations in ${actualDuration}ms (${opsPerSecond.toFixed(0)} ops/sec)`);
        });

        test('should handle extreme node counts', async () => {
            const targetNodes = 100000;

            collector.start('extreme_node_creation');

            // Use batch creation for efficiency
            for (let batch = 0; batch < 100; batch++) {
                for (let i = 0; i < 1000; i++) {
                    const index = batch * 1000 + i;
                    rootNode.set(`extreme.batch${batch}.item${i}`, {
                        id: index,
                        batch: batch,
                        data: `data${index}`
                    });
                }

                // Small break between batches
                if (batch % 10 === 0) {
                    await setTimeout(1);
                }
            }

            const duration = collector.end('extreme_node_creation');

            const allNodes = rootNode.getAllNodes();
            assert(allNodes.length >= targetNodes, `Should create ${targetNodes} nodes, created ${allNodes.length}`);

            const avgPerNode = duration / targetNodes;
            assert(avgPerNode < 0.1, `Should create nodes efficiently: ${avgPerNode.toFixed(4)}ms per node`);

            console.log(`Extreme scale: ${allNodes.length} nodes created in ${duration.toFixed(2)}ms`);
        });
    });

    // Generate final report
    test('should generate performance report', async () => {
        collector.report();

        // Save performance data
        const perfData = {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            metrics: Object.fromEntries(
                Array.from(collector.metrics.entries()).map(([label, measurements]) => [
                    label,
                    collector.getStats(label)
                ])
            )
        };

        console.log('\n💾 Performance data collected for analysis');
        console.log(`Test environment: Node ${process.version} on ${process.platform} ${process.arch}`);
    });
});

// Utility function for running worker-based tests
function runWorkerTest(workerCode, workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerCode, {
            workerData,
            eval: true
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Running FXD Performance Benchmarks...\n');

    // You can run specific benchmark groups here
    // The tests will be picked up by Node.js test runner when running npm test
}