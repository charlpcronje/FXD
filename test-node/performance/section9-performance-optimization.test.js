/**
 * Section 9: Performance & Optimization Testing Suite
 *
 * Comprehensive tests for lazy loading efficiency, caching layer effectiveness,
 * database query optimization, memory management, concurrency performance,
 * file I/O throughput, network optimization, startup time, and scalability.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, '../test-data');

// Performance Testing Framework
class PerformanceTestSuite {
    constructor() {
        this.benchmarks = new Map();
        this.thresholds = new Map();
        this.results = new Map();
        this.observers = new Map();
        this.memoryBaseline = process.memoryUsage();
        this.setupTestEnvironment();
    }

    setupTestEnvironment() {
        // Ensure test data directory exists
        if (!existsSync(testDataDir)) {
            mkdirSync(testDataDir, { recursive: true });
        }
    }

    // Benchmark Utilities
    async measurePerformance(name, asyncFunction, iterations = 1) {
        const measurements = [];
        let totalMemoryDelta = { heapUsed: 0, rss: 0 };

        for (let i = 0; i < iterations; i++) {
            const startMemory = process.memoryUsage();
            const startTime = performance.now();

            await asyncFunction();

            const endTime = performance.now();
            const endMemory = process.memoryUsage();

            const duration = endTime - startTime;
            const memoryDelta = {
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                rss: endMemory.rss - startMemory.rss
            };

            measurements.push(duration);
            totalMemoryDelta.heapUsed += memoryDelta.heapUsed;
            totalMemoryDelta.rss += memoryDelta.rss;
        }

        const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const minDuration = Math.min(...measurements);
        const maxDuration = Math.max(...measurements);
        const medianDuration = measurements.sort((a, b) => a - b)[Math.floor(measurements.length / 2)];

        const result = {
            name,
            iterations,
            averageDuration: avgDuration,
            minDuration,
            maxDuration,
            medianDuration,
            totalDuration: measurements.reduce((a, b) => a + b, 0),
            memoryDelta: {
                heapUsed: totalMemoryDelta.heapUsed / iterations,
                rss: totalMemoryDelta.rss / iterations
            },
            measurements
        };

        this.results.set(name, result);
        return result;
    }

    setThreshold(name, thresholds) {
        this.thresholds.set(name, thresholds);
    }

    validateThreshold(name) {
        const result = this.results.get(name);
        const threshold = this.thresholds.get(name);

        if (!result || !threshold) {
            return { valid: false, reason: 'Missing result or threshold' };
        }

        const violations = [];

        if (threshold.maxDuration && result.averageDuration > threshold.maxDuration) {
            violations.push(`Average duration ${result.averageDuration.toFixed(2)}ms exceeds threshold ${threshold.maxDuration}ms`);
        }

        if (threshold.maxMemoryUsage && result.memoryDelta.heapUsed > threshold.maxMemoryUsage) {
            violations.push(`Memory usage ${result.memoryDelta.heapUsed} exceeds threshold ${threshold.maxMemoryUsage}`);
        }

        if (threshold.minThroughput && result.throughput < threshold.minThroughput) {
            violations.push(`Throughput ${result.throughput} below threshold ${threshold.minThroughput}`);
        }

        return {
            valid: violations.length === 0,
            violations,
            result,
            threshold
        };
    }

    // Memory Monitoring
    trackMemoryUsage(name, duration = 5000) {
        return new Promise((resolve) => {
            const measurements = [];
            const startTime = Date.now();
            const baseline = process.memoryUsage();

            const interval = setInterval(() => {
                const current = process.memoryUsage();
                const elapsed = Date.now() - startTime;

                measurements.push({
                    timestamp: elapsed,
                    heapUsed: current.heapUsed,
                    heapTotal: current.heapTotal,
                    rss: current.rss,
                    external: current.external,
                    heapUsedDelta: current.heapUsed - baseline.heapUsed,
                    rssDelta: current.rss - baseline.rss
                });

                if (elapsed >= duration) {
                    clearInterval(interval);
                    resolve({
                        name,
                        duration,
                        baseline,
                        measurements,
                        peak: {
                            heapUsed: Math.max(...measurements.map(m => m.heapUsed)),
                            rss: Math.max(...measurements.map(m => m.rss)),
                            heapUsedDelta: Math.max(...measurements.map(m => m.heapUsedDelta)),
                            rssDelta: Math.max(...measurements.map(m => m.rssDelta))
                        },
                        average: {
                            heapUsed: measurements.reduce((a, m) => a + m.heapUsed, 0) / measurements.length,
                            rss: measurements.reduce((a, m) => a + m.rss, 0) / measurements.length
                        }
                    });
                }
            }, 100);
        });
    }

    // Concurrency Testing
    async runConcurrentTasks(taskFunction, concurrency = 10, taskCount = 100) {
        const tasks = [];
        const results = [];
        const startTime = performance.now();

        // Create task queue
        for (let i = 0; i < taskCount; i++) {
            tasks.push(i);
        }

        // Worker function
        const worker = async () => {
            const workerResults = [];
            while (tasks.length > 0) {
                const taskId = tasks.shift();
                if (taskId !== undefined) {
                    const taskStart = performance.now();
                    try {
                        const result = await taskFunction(taskId);
                        const taskEnd = performance.now();
                        workerResults.push({
                            taskId,
                            duration: taskEnd - taskStart,
                            success: true,
                            result
                        });
                    } catch (error) {
                        const taskEnd = performance.now();
                        workerResults.push({
                            taskId,
                            duration: taskEnd - taskStart,
                            success: false,
                            error: error.message
                        });
                    }
                }
            }
            return workerResults;
        };

        // Start concurrent workers
        const workers = [];
        for (let i = 0; i < concurrency; i++) {
            workers.push(worker());
        }

        // Wait for all workers to complete
        const workerResults = await Promise.all(workers);

        // Flatten results
        for (const workerResult of workerResults) {
            results.push(...workerResult);
        }

        const endTime = performance.now();
        const totalDuration = endTime - startTime;

        return {
            concurrency,
            taskCount,
            totalDuration,
            throughput: taskCount / (totalDuration / 1000),
            results,
            successRate: results.filter(r => r.success).length / results.length,
            averageTaskDuration: results.reduce((a, r) => a + r.duration, 0) / results.length,
            errors: results.filter(r => !r.success).map(r => r.error)
        };
    }

    // Load Testing
    async simulateLoad(loadFunction, {
        duration = 10000,
        rampUpTime = 1000,
        maxConcurrency = 50,
        targetRPS = 100
    } = {}) {
        const results = [];
        const startTime = Date.now();
        const endTime = startTime + duration;
        const rampUpEnd = startTime + rampUpTime;

        let currentConcurrency = 1;
        let activeTasks = 0;
        let completedTasks = 0;

        const executeTask = async () => {
            activeTasks++;
            const taskStart = performance.now();

            try {
                const result = await loadFunction();
                const taskEnd = performance.now();

                results.push({
                    duration: taskEnd - taskStart,
                    success: true,
                    timestamp: Date.now() - startTime,
                    result
                });
            } catch (error) {
                const taskEnd = performance.now();

                results.push({
                    duration: taskEnd - taskStart,
                    success: false,
                    timestamp: Date.now() - startTime,
                    error: error.message
                });
            }

            activeTasks--;
            completedTasks++;
        };

        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                const now = Date.now();

                // Ramp up concurrency
                if (now < rampUpEnd) {
                    const rampProgress = (now - startTime) / rampUpTime;
                    currentConcurrency = Math.ceil(maxConcurrency * rampProgress);
                } else {
                    currentConcurrency = maxConcurrency;
                }

                // Launch tasks to maintain target RPS
                const targetInterval = 1000 / targetRPS;
                if (activeTasks < currentConcurrency) {
                    executeTask();
                }

                // Check if test duration is complete
                if (now >= endTime) {
                    clearInterval(interval);

                    // Wait for active tasks to complete
                    const waitForCompletion = setInterval(() => {
                        if (activeTasks === 0) {
                            clearInterval(waitForCompletion);

                            const totalDuration = Date.now() - startTime;
                            const successfulTasks = results.filter(r => r.success);

                            resolve({
                                duration: totalDuration,
                                totalTasks: results.length,
                                successfulTasks: successfulTasks.length,
                                failedTasks: results.length - successfulTasks.length,
                                successRate: successfulTasks.length / results.length,
                                actualRPS: results.length / (totalDuration / 1000),
                                averageResponseTime: successfulTasks.reduce((a, r) => a + r.duration, 0) / successfulTasks.length,
                                p95ResponseTime: this.calculatePercentile(successfulTasks.map(r => r.duration), 95),
                                p99ResponseTime: this.calculatePercentile(successfulTasks.map(r => r.duration), 99),
                                results
                            });
                        }
                    }, 100);
                }
            }, targetInterval);
        });
    }

    calculatePercentile(values, percentile) {
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
        return sorted[index] || 0;
    }

    // File I/O Performance Testing
    async testFileIOPerformance(fileSize, operations = 100) {
        const testFile = join(testDataDir, `test-file-${fileSize}.bin`);
        const testData = Buffer.alloc(fileSize, 'A');

        // Write performance
        const writeResults = await this.measurePerformance('file_write', async () => {
            writeFileSync(testFile, testData);
        }, operations);

        // Read performance
        const readResults = await this.measurePerformance('file_read', async () => {
            readFileSync(testFile);
        }, operations);

        // Cleanup
        if (existsSync(testFile)) {
            rmSync(testFile);
        }

        return {
            fileSize,
            operations,
            write: {
                ...writeResults,
                throughputMBps: (fileSize / (1024 * 1024)) / (writeResults.averageDuration / 1000)
            },
            read: {
                ...readResults,
                throughputMBps: (fileSize / (1024 * 1024)) / (readResults.averageDuration / 1000)
            }
        };
    }
}

// Mock FXD Performance Components
class FXDLazyLoader {
    constructor() {
        this.cache = new Map();
        this.loadRequests = 0;
        this.cacheHits = 0;
    }

    async loadModule(moduleName) {
        this.loadRequests++;

        if (this.cache.has(moduleName)) {
            this.cacheHits++;
            return this.cache.get(moduleName);
        }

        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        const module = {
            name: moduleName,
            loadTime: Date.now(),
            size: Math.floor(Math.random() * 10000),
            exports: { default: `module_${moduleName}` }
        };

        this.cache.set(moduleName, module);
        return module;
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            hitRate: this.loadRequests > 0 ? this.cacheHits / this.loadRequests : 0,
            totalRequests: this.loadRequests,
            cacheHits: this.cacheHits
        };
    }

    clearCache() {
        this.cache.clear();
        this.loadRequests = 0;
        this.cacheHits = 0;
    }
}

class FXDCacheLayer {
    constructor(maxSize = 1000, ttl = 60000) {
        this.cache = new Map();
        this.accessTimes = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.hits = 0;
        this.misses = 0;
    }

    set(key, value, customTTL = null) {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: customTTL || this.ttl
        });
        this.accessTimes.set(key, Date.now());
    }

    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.misses++;
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.misses++;
            return null;
        }

        this.accessTimes.set(key, Date.now());
        this.hits++;
        return entry.value;
    }

    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, time] of this.accessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
            hits: this.hits,
            misses: this.misses
        };
    }

    clear() {
        this.cache.clear();
        this.accessTimes.clear();
        this.hits = 0;
        this.misses = 0;
    }
}

class FXDDatabaseOptimizer {
    constructor() {
        this.queryCache = new Map();
        this.queryStats = new Map();
        this.indexHints = new Map();
    }

    async executeQuery(sql, params = []) {
        const queryHash = this.hashQuery(sql, params);
        const startTime = performance.now();

        // Check cache
        if (this.queryCache.has(queryHash)) {
            const endTime = performance.now();
            this.recordQueryStats(sql, endTime - startTime, true);
            return this.queryCache.get(queryHash);
        }

        // Simulate query execution
        const optimizedSql = this.optimizeQuery(sql);
        const result = await this.simulateQueryExecution(optimizedSql, params);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Cache result if query is cacheable
        if (this.isCacheable(sql)) {
            this.queryCache.set(queryHash, result);
        }

        this.recordQueryStats(sql, duration, false);
        return result;
    }

    hashQuery(sql, params) {
        return createHash('md5').update(sql + JSON.stringify(params)).digest('hex');
    }

    optimizeQuery(sql) {
        // Simple query optimization simulation
        let optimized = sql.toLowerCase();

        // Add index hints
        const tableMatch = optimized.match(/from\s+(\w+)/);
        if (tableMatch) {
            const table = tableMatch[1];
            const hint = this.indexHints.get(table);
            if (hint) {
                optimized = optimized.replace(
                    `from ${table}`,
                    `from ${table} USE INDEX (${hint})`
                );
            }
        }

        // Optimize WHERE clauses
        if (optimized.includes('where')) {
            optimized = optimized.replace(/\s+and\s+/g, ' AND ');
            optimized = optimized.replace(/\s+or\s+/g, ' OR ');
        }

        return optimized;
    }

    async simulateQueryExecution(sql, params) {
        // Simulate different query complexities
        let delay = 10; // Base delay

        if (sql.includes('join')) delay += 50;
        if (sql.includes('group by')) delay += 30;
        if (sql.includes('order by')) delay += 20;
        if (sql.includes('distinct')) delay += 25;

        // Add random variation
        delay += Math.random() * 50;

        await new Promise(resolve => setTimeout(resolve, delay));

        // Return mock result
        return {
            rows: Array.from({ length: Math.floor(Math.random() * 100) }, (_, i) => ({
                id: i + 1,
                data: `row_${i + 1}`
            })),
            rowCount: Math.floor(Math.random() * 100),
            executionTime: delay
        };
    }

    isCacheable(sql) {
        const nonCacheablePatterns = [
            /insert\s+into/i,
            /update\s+/i,
            /delete\s+from/i,
            /create\s+/i,
            /drop\s+/i,
            /alter\s+/i
        ];

        return !nonCacheablePatterns.some(pattern => pattern.test(sql));
    }

    recordQueryStats(sql, duration, fromCache) {
        const key = sql.toLowerCase().trim();
        const stats = this.queryStats.get(key) || {
            count: 0,
            totalDuration: 0,
            cacheHits: 0,
            avgDuration: 0
        };

        stats.count++;
        if (fromCache) {
            stats.cacheHits++;
        } else {
            stats.totalDuration += duration;
        }
        stats.avgDuration = stats.totalDuration / (stats.count - stats.cacheHits);

        this.queryStats.set(key, stats);
    }

    getQueryStats() {
        return Array.from(this.queryStats.entries()).map(([sql, stats]) => ({
            sql,
            ...stats,
            cacheHitRate: stats.count > 0 ? stats.cacheHits / stats.count : 0
        }));
    }

    addIndexHint(table, index) {
        this.indexHints.set(table, index);
    }
}

// Test Suite
describe('Section 9: Performance & Optimization', () => {
    let performanceTest;
    let lazyLoader;
    let cacheLayer;
    let dbOptimizer;

    test('should initialize performance testing framework', () => {
        performanceTest = new PerformanceTestSuite();
        assert.ok(performanceTest instanceof PerformanceTestSuite);
    });

    describe('Lazy Loading Efficiency Measurement', () => {
        test('should initialize lazy loader', () => {
            lazyLoader = new FXDLazyLoader();
            assert.ok(lazyLoader instanceof FXDLazyLoader);
        });

        test('should measure lazy loading performance', async () => {
            const modules = ['module1', 'module2', 'module3', 'module4', 'module5'];

            const result = await performanceTest.measurePerformance(
                'lazy_loading',
                async () => {
                    for (const moduleName of modules) {
                        await lazyLoader.loadModule(moduleName);
                    }
                },
                10
            );

            assert.ok(result.averageDuration < 2000); // Should load 5 modules in under 2 seconds
            assert.strictEqual(result.iterations, 10);
        });

        test('should demonstrate cache effectiveness', async () => {
            lazyLoader.clearCache();

            // First load - cold cache
            const coldStart = performance.now();
            await lazyLoader.loadModule('test-module');
            const coldDuration = performance.now() - coldStart;

            // Second load - warm cache
            const warmStart = performance.now();
            await lazyLoader.loadModule('test-module');
            const warmDuration = performance.now() - warmStart;

            const stats = lazyLoader.getCacheStats();

            assert.ok(warmDuration < coldDuration); // Cache should be faster
            assert.strictEqual(stats.hitRate, 0.5); // 1 hit out of 2 requests
            assert.strictEqual(stats.cacheHits, 1);
        });

        test('should maintain performance under concurrent loads', async () => {
            lazyLoader.clearCache();

            const concurrentResult = await performanceTest.runConcurrentTasks(
                async (taskId) => {
                    return await lazyLoader.loadModule(`module_${taskId % 10}`);
                },
                10, // 10 concurrent workers
                100 // 100 total tasks
            );

            assert.ok(concurrentResult.successRate >= 0.95); // 95% success rate
            assert.ok(concurrentResult.throughput > 50); // At least 50 tasks per second
            assert.ok(concurrentResult.averageTaskDuration < 200); // Average task under 200ms
        });

        test('should validate lazy loading thresholds', () => {
            performanceTest.setThreshold('lazy_loading', {
                maxDuration: 2000,
                maxMemoryUsage: 10 * 1024 * 1024 // 10MB
            });

            const validation = performanceTest.validateThreshold('lazy_loading');
            assert.strictEqual(validation.valid, true);
            assert.strictEqual(validation.violations.length, 0);
        });
    });

    describe('Caching Layer Effectiveness', () => {
        test('should initialize cache layer', () => {
            cacheLayer = new FXDCacheLayer(1000, 30000); // 1000 items, 30s TTL
            assert.ok(cacheLayer instanceof FXDCacheLayer);
        });

        test('should measure cache performance', async () => {
            const result = await performanceTest.measurePerformance(
                'cache_operations',
                async () => {
                    // Perform mixed cache operations
                    for (let i = 0; i < 100; i++) {
                        const key = `key_${i % 50}`; // 50% chance of hit
                        const value = `value_${i}`;

                        if (i % 3 === 0) {
                            cacheLayer.set(key, value);
                        } else {
                            cacheLayer.get(key);
                        }
                    }
                },
                20
            );

            const stats = cacheLayer.getStats();

            assert.ok(result.averageDuration < 100); // Cache ops should be fast
            assert.ok(stats.hitRate > 0); // Should have some cache hits
        });

        test('should test cache eviction performance', async () => {
            cacheLayer.clear();

            // Fill cache beyond capacity
            const result = await performanceTest.measurePerformance(
                'cache_eviction',
                async () => {
                    for (let i = 0; i < 1200; i++) { // Exceed max size of 1000
                        cacheLayer.set(`key_${i}`, `value_${i}`);
                    }
                },
                5
            );

            const stats = cacheLayer.getStats();

            assert.strictEqual(stats.size, 1000); // Should not exceed max size
            assert.ok(result.averageDuration < 500); // Eviction should be efficient
        });

        test('should handle TTL expiration efficiently', async () => {
            const shortTTLCache = new FXDCacheLayer(100, 100); // 100ms TTL

            // Set some values
            for (let i = 0; i < 10; i++) {
                shortTTLCache.set(`key_${i}`, `value_${i}`);
            }

            // Wait for TTL expiration
            await new Promise(resolve => setTimeout(resolve, 150));

            const result = await performanceTest.measurePerformance(
                'ttl_cleanup',
                async () => {
                    // Access expired keys
                    for (let i = 0; i < 10; i++) {
                        shortTTLCache.get(`key_${i}`);
                    }
                },
                10
            );

            const stats = shortTTLCache.getStats();

            assert.strictEqual(stats.hits, 0); // All should have expired
            assert.ok(result.averageDuration < 50); // TTL checks should be fast
        });

        test('should demonstrate cache layer scalability', async () => {
            cacheLayer.clear();

            const scalabilityResult = await performanceTest.runConcurrentTasks(
                async (taskId) => {
                    const operations = 100;
                    for (let i = 0; i < operations; i++) {
                        const key = `task_${taskId}_key_${i}`;
                        const value = `task_${taskId}_value_${i}`;

                        if (i % 2 === 0) {
                            cacheLayer.set(key, value);
                        } else {
                            cacheLayer.get(key);
                        }
                    }
                    return operations;
                },
                20, // 20 concurrent workers
                50  // 50 total tasks
            );

            assert.ok(scalabilityResult.successRate >= 0.95);
            assert.ok(scalabilityResult.throughput > 20); // At least 20 tasks per second
        });
    });

    describe('Database Query Optimization Validation', () => {
        test('should initialize database optimizer', () => {
            dbOptimizer = new FXDDatabaseOptimizer();
            assert.ok(dbOptimizer instanceof FXDDatabaseOptimizer);
        });

        test('should optimize simple queries', async () => {
            const simpleQuery = 'SELECT * FROM users WHERE active = 1';

            const result = await performanceTest.measurePerformance(
                'simple_query',
                async () => {
                    return await dbOptimizer.executeQuery(simpleQuery);
                },
                20
            );

            assert.ok(result.averageDuration < 200); // Simple queries should be fast
        });

        test('should handle complex queries efficiently', async () => {
            const complexQuery = `
                SELECT u.name, p.title, COUNT(c.id) as comment_count
                FROM users u
                JOIN posts p ON u.id = p.user_id
                LEFT JOIN comments c ON p.id = c.post_id
                WHERE u.active = 1 AND p.published = 1
                GROUP BY u.id, p.id
                ORDER BY comment_count DESC
            `;

            const result = await performanceTest.measurePerformance(
                'complex_query',
                async () => {
                    return await dbOptimizer.executeQuery(complexQuery);
                },
                10
            );

            assert.ok(result.averageDuration < 1000); // Complex queries under 1 second
        });

        test('should demonstrate query caching effectiveness', async () => {
            const query = 'SELECT * FROM products WHERE category = ?';
            const params = ['electronics'];

            // First execution - cold cache
            const coldStart = performance.now();
            await dbOptimizer.executeQuery(query, params);
            const coldDuration = performance.now() - coldStart;

            // Second execution - warm cache
            const warmStart = performance.now();
            await dbOptimizer.executeQuery(query, params);
            const warmDuration = performance.now() - warmStart;

            assert.ok(warmDuration < coldDuration * 0.1); // Cache should be much faster

            const stats = dbOptimizer.getQueryStats();
            const queryStats = stats.find(s => s.sql.includes('products'));
            assert.ok(queryStats.cacheHitRate > 0);
        });

        test('should apply index hints for optimization', async () => {
            dbOptimizer.addIndexHint('users', 'idx_users_active');

            const query = 'SELECT * FROM users WHERE active = 1';

            const result = await performanceTest.measurePerformance(
                'indexed_query',
                async () => {
                    return await dbOptimizer.executeQuery(query);
                },
                15
            );

            assert.ok(result.averageDuration < 100); // Indexed queries should be very fast
        });

        test('should handle concurrent database operations', async () => {
            const queries = [
                'SELECT * FROM users WHERE id = ?',
                'SELECT * FROM posts WHERE user_id = ?',
                'SELECT * FROM comments WHERE post_id = ?',
                'SELECT COUNT(*) FROM users WHERE active = 1',
                'SELECT * FROM categories ORDER BY name'
            ];

            const concurrentResult = await performanceTest.runConcurrentTasks(
                async (taskId) => {
                    const query = queries[taskId % queries.length];
                    const params = query.includes('?') ? [taskId] : [];
                    return await dbOptimizer.executeQuery(query, params);
                },
                15, // 15 concurrent workers
                75  // 75 total queries
            );

            assert.ok(concurrentResult.successRate >= 0.98); // 98% success rate
            assert.ok(concurrentResult.throughput > 30); // At least 30 queries per second
        });
    });

    describe('Memory Management Efficiency', () => {
        test('should track memory usage during operations', async () => {
            const memoryTracking = performanceTest.trackMemoryUsage('memory_test', 3000);

            // Simulate memory-intensive operations
            const largeArrays = [];
            for (let i = 0; i < 100; i++) {
                largeArrays.push(new Array(10000).fill(`item_${i}`));
                await new Promise(resolve => setTimeout(resolve, 20));
            }

            const memoryResult = await memoryTracking;

            assert.ok(memoryResult.peak.heapUsedDelta > 0); // Should use more memory
            assert.ok(memoryResult.measurements.length > 20); // Should have multiple measurements

            // Cleanup
            largeArrays.length = 0;
        });

        test('should detect memory leaks', async () => {
            const initialMemory = process.memoryUsage();

            // Simulate potential memory leak
            const leakyObjects = [];
            for (let i = 0; i < 1000; i++) {
                leakyObjects.push({
                    id: i,
                    data: new Array(1000).fill(`data_${i}`),
                    timestamp: Date.now()
                });
            }

            const afterAllocation = process.memoryUsage();
            const memoryIncrease = afterAllocation.heapUsed - initialMemory.heapUsed;

            assert.ok(memoryIncrease > 0); // Should detect memory usage increase

            // Cleanup
            leakyObjects.length = 0;

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        });

        test('should validate memory efficiency thresholds', async () => {
            const result = await performanceTest.measurePerformance(
                'memory_efficient_operation',
                async () => {
                    // Perform operation that should be memory efficient
                    const tempData = new Array(100).fill(0).map((_, i) => ({ id: i }));
                    return tempData.length;
                },
                50
            );

            performanceTest.setThreshold('memory_efficient_operation', {
                maxDuration: 50,
                maxMemoryUsage: 1024 * 1024 // 1MB
            });

            const validation = performanceTest.validateThreshold('memory_efficient_operation');
            assert.strictEqual(validation.valid, true);
        });
    });

    describe('Concurrency Performance Scaling', () => {
        test('should measure performance under increasing concurrency', async () => {
            const concurrencyLevels = [1, 5, 10, 20, 50];
            const results = [];

            for (const concurrency of concurrencyLevels) {
                const result = await performanceTest.runConcurrentTasks(
                    async (taskId) => {
                        // Simulate CPU-bound work
                        let sum = 0;
                        for (let i = 0; i < 10000; i++) {
                            sum += Math.random();
                        }
                        return sum;
                    },
                    concurrency,
                    concurrency * 10 // 10 tasks per worker
                );

                results.push({
                    concurrency,
                    throughput: result.throughput,
                    averageTaskDuration: result.averageTaskDuration,
                    successRate: result.successRate
                });
            }

            // Validate scaling characteristics
            const maxThroughput = Math.max(...results.map(r => r.throughput));
            const minSuccessRate = Math.min(...results.map(r => r.successRate));

            assert.ok(maxThroughput > 50); // Should achieve reasonable throughput
            assert.ok(minSuccessRate >= 0.95); // Should maintain high success rate
        });

        test('should handle concurrent file operations', async () => {
            const fileOperationTask = async (taskId) => {
                const testFile = join(testDataDir, `concurrent-test-${taskId}.txt`);
                const testData = `Test data for task ${taskId} - ${Date.now()}`;

                // Write file
                writeFileSync(testFile, testData);

                // Read file
                const readData = readFileSync(testFile, 'utf8');

                // Verify data
                assert.strictEqual(readData, testData);

                // Cleanup
                rmSync(testFile);

                return { taskId, success: true };
            };

            const result = await performanceTest.runConcurrentTasks(
                fileOperationTask,
                10, // 10 concurrent file operations
                50  // 50 total operations
            );

            assert.ok(result.successRate >= 0.95);
            assert.ok(result.throughput > 20); // At least 20 file ops per second
        });

        test('should maintain performance under load', async () => {
            const loadResult = await performanceTest.simulateLoad(
                async () => {
                    // Simulate API endpoint
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                    return { status: 'success', timestamp: Date.now() };
                },
                {
                    duration: 5000,      // 5 second test
                    rampUpTime: 1000,    // 1 second ramp up
                    maxConcurrency: 25,  // 25 concurrent requests
                    targetRPS: 100       // 100 requests per second
                }
            );

            assert.ok(loadResult.successRate >= 0.95); // 95% success rate
            assert.ok(loadResult.actualRPS >= 50); // At least 50 RPS achieved
            assert.ok(loadResult.averageResponseTime < 100); // Average response under 100ms
            assert.ok(loadResult.p95ResponseTime < 200); // 95th percentile under 200ms
        });
    });

    describe('File I/O Throughput Benchmarks', () => {
        test('should benchmark small file operations', async () => {
            const smallFileResult = await performanceTest.testFileIOPerformance(
                1024, // 1KB files
                100   // 100 operations
            );

            assert.ok(smallFileResult.write.throughputMBps > 1); // At least 1 MB/s write
            assert.ok(smallFileResult.read.throughputMBps > 10); // At least 10 MB/s read
            assert.ok(smallFileResult.write.averageDuration < 50); // Write under 50ms
            assert.ok(smallFileResult.read.averageDuration < 10); // Read under 10ms
        });

        test('should benchmark medium file operations', async () => {
            const mediumFileResult = await performanceTest.testFileIOPerformance(
                1024 * 1024, // 1MB files
                20            // 20 operations
            );

            assert.ok(mediumFileResult.write.throughputMBps > 10); // At least 10 MB/s write
            assert.ok(mediumFileResult.read.throughputMBps > 50); // At least 50 MB/s read
            assert.ok(mediumFileResult.write.averageDuration < 500); // Write under 500ms
            assert.ok(mediumFileResult.read.averageDuration < 100); // Read under 100ms
        });

        test('should benchmark large file operations', async () => {
            const largeFileResult = await performanceTest.testFileIOPerformance(
                10 * 1024 * 1024, // 10MB files
                5                  // 5 operations
            );

            assert.ok(largeFileResult.write.throughputMBps > 5); // At least 5 MB/s write
            assert.ok(largeFileResult.read.throughputMBps > 20); // At least 20 MB/s read
            assert.ok(largeFileResult.write.averageDuration < 5000); // Write under 5s
            assert.ok(largeFileResult.read.averageDuration < 2000); // Read under 2s
        });

        test('should validate file I/O performance consistency', async () => {
            const iterations = 10;
            const throughputResults = [];

            for (let i = 0; i < iterations; i++) {
                const result = await performanceTest.testFileIOPerformance(
                    64 * 1024, // 64KB files
                    10
                );
                throughputResults.push(result.write.throughputMBps);
            }

            // Calculate coefficient of variation
            const mean = throughputResults.reduce((a, b) => a + b, 0) / throughputResults.length;
            const variance = throughputResults.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / throughputResults.length;
            const stdDev = Math.sqrt(variance);
            const coefficientOfVariation = stdDev / mean;

            // Performance should be consistent (CV < 0.3)
            assert.ok(coefficientOfVariation < 0.3, `Performance too variable: CV=${coefficientOfVariation}`);
        });
    });

    describe('Startup Time Optimization', () => {
        test('should measure application startup time', async () => {
            const startupResult = await performanceTest.measurePerformance(
                'application_startup',
                async () => {
                    // Simulate application initialization
                    const components = [
                        'config_loader',
                        'database_connection',
                        'cache_initialization',
                        'route_registration',
                        'middleware_setup',
                        'service_discovery',
                        'health_checks'
                    ];

                    for (const component of components) {
                        // Simulate component initialization time
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                    }

                    return { status: 'initialized', components: components.length };
                },
                10
            );

            assert.ok(startupResult.averageDuration < 2000); // Startup under 2 seconds
            assert.ok(startupResult.medianDuration < 1500); // Median startup under 1.5 seconds
        });

        test('should optimize cold start performance', async () => {
            // Simulate cold start scenario
            const coldStartResult = await performanceTest.measurePerformance(
                'cold_start',
                async () => {
                    // Clear any existing state
                    if (lazyLoader) lazyLoader.clearCache();
                    if (cacheLayer) cacheLayer.clear();

                    // Simulate loading essential modules only
                    const essentialModules = ['core', 'config', 'logger'];
                    const loadedModules = [];

                    for (const module of essentialModules) {
                        const loaded = await lazyLoader.loadModule(module);
                        loadedModules.push(loaded);
                    }

                    return loadedModules;
                },
                5
            );

            assert.ok(coldStartResult.averageDuration < 1000); // Cold start under 1 second
        });

        test('should demonstrate warm start benefits', async () => {
            // Warm up the application
            await lazyLoader.loadModule('core');
            await lazyLoader.loadModule('config');
            await lazyLoader.loadModule('logger');

            cacheLayer.set('config', { initialized: true });
            cacheLayer.set('routes', ['/', '/api', '/health']);

            const warmStartResult = await performanceTest.measurePerformance(
                'warm_start',
                async () => {
                    // Simulate warm start with pre-loaded state
                    const config = cacheLayer.get('config');
                    const routes = cacheLayer.get('routes');

                    await lazyLoader.loadModule('core'); // Should hit cache
                    await lazyLoader.loadModule('api'); // New module

                    return { config, routes, status: 'warm_started' };
                },
                10
            );

            const coldStartTime = performanceTest.results.get('cold_start')?.averageDuration || 1000;
            const warmStartTime = warmStartResult.averageDuration;

            assert.ok(warmStartTime < coldStartTime * 0.5); // Warm start should be much faster
            assert.ok(warmStartTime < 500); // Warm start under 500ms
        });
    });

    describe('Scalability Stress Testing', () => {
        test('should handle increasing data volumes', async () => {
            const dataVolumes = [100, 1000, 10000, 50000];
            const scalabilityResults = [];

            for (const volume of dataVolumes) {
                const result = await performanceTest.measurePerformance(
                    `data_processing_${volume}`,
                    async () => {
                        // Simulate processing large datasets
                        const data = Array.from({ length: volume }, (_, i) => ({
                            id: i,
                            value: Math.random(),
                            timestamp: Date.now()
                        }));

                        // Process data
                        let processed = 0;
                        for (const item of data) {
                            if (item.value > 0.5) {
                                processed++;
                            }
                        }

                        return { total: volume, processed };
                    },
                    3
                );

                scalabilityResults.push({
                    volume,
                    averageDuration: result.averageDuration,
                    throughput: volume / (result.averageDuration / 1000)
                });
            }

            // Validate scalability characteristics
            const throughputRatio = scalabilityResults[scalabilityResults.length - 1].throughput /
                                   scalabilityResults[0].throughput;

            // Throughput should not degrade too much with volume
            assert.ok(throughputRatio > 0.1, 'Throughput degrades too much with volume');

            // Largest volume should still complete in reasonable time
            const largestVolumeTime = scalabilityResults[scalabilityResults.length - 1].averageDuration;
            assert.ok(largestVolumeTime < 10000, 'Large volume processing takes too long');
        });

        test('should maintain performance under memory pressure', async () => {
            const memoryPressureTest = async () => {
                // Create memory pressure
                const memoryConsumers = [];
                for (let i = 0; i < 100; i++) {
                    memoryConsumers.push(new Array(10000).fill(`pressure_${i}`));
                }

                // Perform operations under pressure
                const operationResults = [];
                for (let i = 0; i < 50; i++) {
                    const start = performance.now();

                    // Simulate typical operation
                    await lazyLoader.loadModule(`pressure_module_${i}`);
                    cacheLayer.set(`pressure_key_${i}`, `pressure_value_${i}`);

                    const duration = performance.now() - start;
                    operationResults.push(duration);
                }

                // Cleanup
                memoryConsumers.length = 0;

                return operationResults;
            };

            const pressureResults = await memoryPressureTest();
            const averageDuration = pressureResults.reduce((a, b) => a + b, 0) / pressureResults.length;

            // Performance should not degrade too much under memory pressure
            assert.ok(averageDuration < 200, 'Performance degrades too much under memory pressure');
        });

        test('should demonstrate horizontal scaling characteristics', async () => {
            // Simulate multiple application instances
            const instances = [1, 2, 4, 8];
            const scalingResults = [];

            for (const instanceCount of instances) {
                const result = await performanceTest.runConcurrentTasks(
                    async (taskId) => {
                        // Simulate instance-specific work
                        const instanceId = taskId % instanceCount;
                        const workItems = 100;

                        let completed = 0;
                        for (let i = 0; i < workItems; i++) {
                            // Simulate work
                            await new Promise(resolve => setTimeout(resolve, 1));
                            completed++;
                        }

                        return { instanceId, completed };
                    },
                    instanceCount, // One worker per instance
                    instanceCount * 20 // 20 tasks per instance
                );

                scalingResults.push({
                    instances: instanceCount,
                    throughput: result.throughput,
                    successRate: result.successRate
                });
            }

            // Validate horizontal scaling
            const maxThroughput = Math.max(...scalingResults.map(r => r.throughput));
            const minSuccessRate = Math.min(...scalingResults.map(r => r.successRate));

            assert.ok(maxThroughput > scalingResults[0].throughput); // Should scale beyond single instance
            assert.ok(minSuccessRate >= 0.95); // Should maintain high success rate
        });
    });

    describe('Performance Regression Detection', () => {
        test('should detect performance regressions', async () => {
            // Baseline performance
            const baselineResult = await performanceTest.measurePerformance(
                'baseline_operation',
                async () => {
                    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms operation
                    return 'baseline';
                },
                20
            );

            // Simulated regression
            const regressionResult = await performanceTest.measurePerformance(
                'regression_operation',
                async () => {
                    await new Promise(resolve => setTimeout(resolve, 150)); // 150ms operation (3x slower)
                    return 'regression';
                },
                20
            );

            const regressionRatio = regressionResult.averageDuration / baselineResult.averageDuration;

            // Should detect significant performance regression
            assert.ok(regressionRatio > 2, 'Should detect performance regression');
            assert.ok(regressionResult.averageDuration > baselineResult.averageDuration * 2);
        });

        test('should validate performance within acceptable bounds', () => {
            const acceptableThresholds = {
                maxDuration: 100,
                maxMemoryUsage: 5 * 1024 * 1024 // 5MB
            };

            performanceTest.setThreshold('baseline_operation', acceptableThresholds);

            const validation = performanceTest.validateThreshold('baseline_operation');
            assert.strictEqual(validation.valid, true);
        });
    });

    describe('Comprehensive Performance Report Generation', () => {
        test('should generate comprehensive performance report', () => {
            const allResults = Array.from(performanceTest.results.entries());
            const allThresholds = Array.from(performanceTest.thresholds.entries());

            assert.ok(allResults.length > 0, 'Should have performance results');

            // Generate summary statistics
            const summary = {
                totalTests: allResults.length,
                averageExecutionTime: allResults.reduce((sum, [, result]) => sum + result.averageDuration, 0) / allResults.length,
                totalMemoryUsage: allResults.reduce((sum, [, result]) => sum + (result.memoryDelta?.heapUsed || 0), 0),
                thresholdViolations: allThresholds.filter(([name]) => {
                    const validation = performanceTest.validateThreshold(name);
                    return !validation.valid;
                }).length
            };

            assert.ok(summary.totalTests >= 10, 'Should have sufficient test coverage');
            assert.ok(summary.averageExecutionTime < 1000, 'Average execution time should be reasonable');
            assert.strictEqual(summary.thresholdViolations, 0, 'Should have no threshold violations');
        });

        test('should identify performance bottlenecks', () => {
            const results = Array.from(performanceTest.results.values());
            const slowestOperations = results
                .sort((a, b) => b.averageDuration - a.averageDuration)
                .slice(0, 3);

            const memoryIntensiveOperations = results
                .sort((a, b) => (b.memoryDelta?.heapUsed || 0) - (a.memoryDelta?.heapUsed || 0))
                .slice(0, 3);

            // Should identify operations for optimization
            assert.ok(slowestOperations.length > 0);
            assert.ok(memoryIntensiveOperations.length > 0);

            // Log bottlenecks for analysis
            console.log('Slowest operations:', slowestOperations.map(op => ({
                name: op.name,
                avgDuration: op.averageDuration.toFixed(2) + 'ms'
            })));

            console.log('Memory intensive operations:', memoryIntensiveOperations.map(op => ({
                name: op.name,
                memoryUsage: ((op.memoryDelta?.heapUsed || 0) / 1024).toFixed(2) + 'KB'
            })));
        });
    });
});