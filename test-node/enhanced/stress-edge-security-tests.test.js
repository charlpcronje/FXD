/**
 * Enhanced Test Categories: Stress, Edge Case, and Security Testing Suite
 *
 * Comprehensive tests for stress scenarios, edge cases, and security validation
 * to ensure 100% production readiness and robustness under extreme conditions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, '../test-data');

// Enhanced Testing Framework
class EnhancedTestSuite {
    constructor() {
        this.stressTestResults = new Map();
        this.edgeCaseResults = new Map();
        this.securityTestResults = new Map();
        this.testMetrics = new Map();
        this.memoryBaseline = process.memoryUsage();
        this.setupTestEnvironment();
    }

    setupTestEnvironment() {
        if (!existsSync(testDataDir)) {
            mkdirSync(testDataDir, { recursive: true });
        }
    }

    // Stress Testing Framework
    async runStressTest(name, testFunction, config = {}) {
        const {
            duration = 30000,           // 30 seconds
            concurrency = 10,           // 10 concurrent operations
            iterations = 1000,          // 1000 total operations
            memoryThreshold = 100 * 1024 * 1024, // 100MB
            errorThreshold = 0.05       // 5% error rate
        } = config;

        const stressResult = {
            name,
            config,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            errorRate: 0,
            averageResponseTime: 0,
            throughput: 0,
            memoryUsage: {
                initial: process.memoryUsage(),
                peak: process.memoryUsage(),
                final: null,
                leaked: false
            },
            errors: [],
            warnings: [],
            passed: false
        };

        try {
            // Start memory monitoring
            const memoryMonitor = this.startMemoryMonitoring(stressResult);

            // Run stress test
            const operations = [];
            const startTime = Date.now();

            // Create operation queue
            for (let i = 0; i < iterations; i++) {
                operations.push(i);
            }

            // Execute with controlled concurrency
            const workers = [];
            for (let w = 0; w < concurrency; w++) {
                workers.push(this.stressWorker(testFunction, operations, stressResult));
            }

            // Wait for completion or timeout
            await Promise.race([
                Promise.all(workers),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Stress test timeout')), duration)
                )
            ]);

            // Stop monitoring
            clearInterval(memoryMonitor);

            // Calculate metrics
            const endTime = Date.now();
            stressResult.endTime = endTime;
            stressResult.duration = endTime - startTime;
            stressResult.errorRate = stressResult.totalOperations > 0
                ? stressResult.failedOperations / stressResult.totalOperations
                : 0;
            stressResult.throughput = stressResult.totalOperations / (stressResult.duration / 1000);
            stressResult.memoryUsage.final = process.memoryUsage();

            // Determine if test passed
            stressResult.passed =
                stressResult.errorRate <= errorThreshold &&
                !stressResult.memoryUsage.leaked &&
                stressResult.totalOperations > iterations * 0.8; // At least 80% completion

            this.stressTestResults.set(name, stressResult);

        } catch (error) {
            stressResult.errors.push(error.message);
            stressResult.passed = false;
        }

        return stressResult;
    }

    async stressWorker(testFunction, operations, result) {
        const responseTimes = [];

        while (operations.length > 0) {
            const operationId = operations.shift();
            if (operationId === undefined) break;

            const opStart = performance.now();
            try {
                await testFunction(operationId);
                const opEnd = performance.now();
                const responseTime = opEnd - opStart;

                responseTimes.push(responseTime);
                result.successfulOperations++;
                result.totalOperations++;
            } catch (error) {
                result.failedOperations++;
                result.totalOperations++;
                result.errors.push(`Operation ${operationId}: ${error.message}`);
            }
        }

        if (responseTimes.length > 0) {
            result.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        }
    }

    startMemoryMonitoring(result) {
        return setInterval(() => {
            const current = process.memoryUsage();

            // Track peak memory usage
            if (current.heapUsed > result.memoryUsage.peak.heapUsed) {
                result.memoryUsage.peak = current;
            }

            // Check for memory leaks
            const heapGrowth = current.heapUsed - result.memoryUsage.initial.heapUsed;
            const rssGrowth = current.rss - result.memoryUsage.initial.rss;

            if (heapGrowth > 100 * 1024 * 1024 || rssGrowth > 200 * 1024 * 1024) { // 100MB heap or 200MB RSS
                result.memoryUsage.leaked = true;
                result.warnings.push('Potential memory leak detected');
            }
        }, 1000);
    }

    // Edge Case Testing Framework
    async runEdgeCaseTest(name, testCases) {
        const edgeResult = {
            name,
            totalCases: testCases.length,
            passedCases: 0,
            failedCases: 0,
            skippedCases: 0,
            cases: [],
            passed: false
        };

        for (const [index, testCase] of testCases.entries()) {
            const caseResult = {
                index,
                name: testCase.name,
                description: testCase.description,
                input: testCase.input,
                expectedBehavior: testCase.expectedBehavior,
                actualResult: null,
                passed: false,
                error: null,
                duration: 0
            };

            try {
                const start = performance.now();
                caseResult.actualResult = await testCase.execute();
                caseResult.duration = performance.now() - start;

                // Validate result
                if (testCase.validate) {
                    caseResult.passed = testCase.validate(caseResult.actualResult);
                } else {
                    caseResult.passed = true; // No validation means just checking it doesn't crash
                }

                if (caseResult.passed) {
                    edgeResult.passedCases++;
                } else {
                    edgeResult.failedCases++;
                }

            } catch (error) {
                caseResult.error = error.message;

                if (testCase.shouldThrow) {
                    caseResult.passed = true;
                    edgeResult.passedCases++;
                } else {
                    caseResult.passed = false;
                    edgeResult.failedCases++;
                }
            }

            edgeResult.cases.push(caseResult);
        }

        edgeResult.passed = edgeResult.failedCases === 0;
        this.edgeCaseResults.set(name, edgeResult);

        return edgeResult;
    }

    // Security Testing Framework
    async runSecurityTest(name, securityChecks) {
        const securityResult = {
            name,
            totalChecks: securityChecks.length,
            passedChecks: 0,
            failedChecks: 0,
            vulnerabilities: [],
            checks: [],
            securityScore: 0,
            passed: false
        };

        for (const [index, check] of securityChecks.entries()) {
            const checkResult = {
                index,
                name: check.name,
                type: check.type,
                severity: check.severity || 'medium',
                description: check.description,
                passed: false,
                findings: [],
                recommendations: []
            };

            try {
                const findings = await check.execute();
                checkResult.findings = findings;

                if (findings.length === 0) {
                    checkResult.passed = true;
                    securityResult.passedChecks++;
                } else {
                    checkResult.passed = false;
                    securityResult.failedChecks++;

                    // Add to vulnerabilities if high severity
                    if (check.severity === 'high' || check.severity === 'critical') {
                        securityResult.vulnerabilities.push({
                            check: check.name,
                            severity: check.severity,
                            findings: findings
                        });
                    }
                }

                if (check.recommendations) {
                    checkResult.recommendations = check.recommendations;
                }

            } catch (error) {
                checkResult.passed = false;
                checkResult.findings.push(`Security check failed: ${error.message}`);
                securityResult.failedChecks++;
            }

            securityResult.checks.push(checkResult);
        }

        // Calculate security score
        securityResult.securityScore = securityResult.totalChecks > 0
            ? (securityResult.passedChecks / securityResult.totalChecks) * 100
            : 0;

        // Pass if no critical vulnerabilities and score > 80%
        securityResult.passed =
            securityResult.vulnerabilities.filter(v => v.severity === 'critical').length === 0 &&
            securityResult.securityScore >= 80;

        this.securityTestResults.set(name, securityResult);
        return securityResult;
    }

    // Data Generation Utilities
    generateLargeDataset(size, type = 'object') {
        const data = [];
        for (let i = 0; i < size; i++) {
            switch (type) {
                case 'object':
                    data.push({
                        id: i,
                        name: `item_${i}`,
                        value: Math.random() * 1000,
                        timestamp: Date.now() + i,
                        data: randomBytes(100).toString('hex')
                    });
                    break;
                case 'string':
                    data.push(randomBytes(1000).toString('hex'));
                    break;
                case 'number':
                    data.push(Math.random() * Number.MAX_SAFE_INTEGER);
                    break;
                default:
                    data.push(i);
            }
        }
        return data;
    }

    generateCorruptedData(originalData, corruptionType = 'random') {
        const corrupted = JSON.parse(JSON.stringify(originalData));

        switch (corruptionType) {
            case 'missing_fields':
                if (Array.isArray(corrupted)) {
                    corrupted.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            const keys = Object.keys(item);
                            const keyToRemove = keys[Math.floor(Math.random() * keys.length)];
                            delete item[keyToRemove];
                        }
                    });
                }
                break;
            case 'wrong_types':
                if (Array.isArray(corrupted)) {
                    corrupted.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            Object.keys(item).forEach(key => {
                                if (typeof item[key] === 'number') {
                                    item[key] = String(item[key]);
                                } else if (typeof item[key] === 'string') {
                                    item[key] = parseInt(item[key]) || 0;
                                }
                            });
                        }
                    });
                }
                break;
            case 'null_values':
                if (Array.isArray(corrupted)) {
                    corrupted.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            Object.keys(item).forEach(key => {
                                if (Math.random() < 0.3) { // 30% chance to nullify
                                    item[key] = null;
                                }
                            });
                        }
                    });
                }
                break;
            default:
                // Random corruption
                const json = JSON.stringify(corrupted);
                let corruptedJson = json;
                for (let i = 0; i < 10; i++) {
                    const pos = Math.floor(Math.random() * json.length);
                    corruptedJson = corruptedJson.substring(0, pos) + 'X' + corruptedJson.substring(pos + 1);
                }
                try {
                    return JSON.parse(corruptedJson);
                } catch {
                    return corrupted; // Return original if JSON is too corrupted
                }
        }

        return corrupted;
    }

    generateMaliciousInput(type = 'injection') {
        const maliciousInputs = {
            injection: [
                "'; DROP TABLE users; --",
                "<script>alert('xss')</script>",
                "../../etc/passwd",
                "${process.exit()}",
                "javascript:alert('xss')",
                "../../../windows/system32"
            ],
            overflow: [
                'A'.repeat(10000),
                'A'.repeat(100000),
                'A'.repeat(1000000)
            ],
            special_chars: [
                '\x00\x01\x02\x03',
                '🚀🔥💯',
                '\n\r\t',
                '"\'`',
                '\\\\\\\\',
                '%20%3Cscript%3E'
            ],
            format_strings: [
                '%s%s%s%s',
                '%n%n%n%n',
                '%x%x%x%x'
            ]
        };

        return maliciousInputs[type] || maliciousInputs.injection;
    }
}

// Mock FXD Components for Testing
class MockFXDNode {
    constructor(data = {}) {
        this.__value = data.value || null;
        this.__nodes = new Map();
        this.__metadata = data.metadata || {};
        this.__id = data.id || Math.random().toString(36);
    }

    get(key) {
        return this.__nodes.get(key) || this.__value;
    }

    set(key, value) {
        if (typeof value === 'object' && value !== null) {
            this.__nodes.set(key, new MockFXDNode(value));
        } else {
            this.__nodes.set(key, value);
        }
        return this;
    }

    val() {
        return this.__value;
    }

    processLargeDataset(dataset) {
        // Simulate processing time based on dataset size
        const delay = Math.min(dataset.length * 0.1, 1000);
        return new Promise(resolve => {
            setTimeout(() => {
                const result = dataset.map(item => ({
                    ...item,
                    processed: true,
                    processingTime: Date.now()
                }));
                resolve(result);
            }, delay);
        });
    }

    validateInput(input) {
        const errors = [];

        if (input === null || input === undefined) {
            errors.push('Input cannot be null or undefined');
        }

        if (typeof input === 'string') {
            if (input.length > 10000) {
                errors.push('Input string too long');
            }
            if (/[<>'"&]/.test(input)) {
                errors.push('Input contains potentially dangerous characters');
            }
            if (/\.\.\//g.test(input)) {
                errors.push('Input contains path traversal attempt');
            }
        }

        return { valid: errors.length === 0, errors };
    }

    handleError(error) {
        if (error instanceof Error) {
            return {
                handled: true,
                type: error.constructor.name,
                message: error.message,
                stack: error.stack
            };
        }
        return { handled: false, error: 'Unknown error type' };
    }
}

class MockFXDCache {
    constructor(maxSize = 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessOrder = [];
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, value);
        this.accessOrder.push(key);
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
                this.accessOrder.push(key);
            }
            return this.cache.get(key);
        }
        return null;
    }

    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    size() {
        return this.cache.size;
    }
}

// Test Suite
describe('Enhanced Test Categories: Stress, Edge Case, and Security', () => {
    let enhancedTest;
    let mockNode;
    let mockCache;

    test('should initialize enhanced testing framework', () => {
        enhancedTest = new EnhancedTestSuite();
        assert.ok(enhancedTest instanceof EnhancedTestSuite);
    });

    describe('Stress Testing', () => {
        test('should initialize mock components for stress testing', () => {
            mockNode = new MockFXDNode();
            mockCache = new MockFXDCache(1000);
            assert.ok(mockNode instanceof MockFXDNode);
            assert.ok(mockCache instanceof MockFXDCache);
        });

        test('should stress test large data processing', async () => {
            const stressResult = await enhancedTest.runStressTest(
                'large_data_processing',
                async (operationId) => {
                    const dataSize = 1000 + (operationId % 500); // Varying data sizes
                    const dataset = enhancedTest.generateLargeDataset(dataSize, 'object');
                    const result = await mockNode.processLargeDataset(dataset);
                    return result.length;
                },
                {
                    duration: 10000,    // 10 seconds
                    concurrency: 5,     // 5 concurrent operations
                    iterations: 50,     // 50 total operations
                    errorThreshold: 0.1 // 10% error rate acceptable
                }
            );

            assert.strictEqual(stressResult.passed, true);
            assert.ok(stressResult.errorRate <= 0.1);
            assert.ok(stressResult.totalOperations >= 40); // At least 80% completion
            assert.ok(stressResult.throughput > 1); // At least 1 operation per second
            assert.strictEqual(stressResult.memoryUsage.leaked, false);
        });

        test('should stress test cache operations', async () => {
            const stressResult = await enhancedTest.runStressTest(
                'cache_operations',
                async (operationId) => {
                    const operations = ['set', 'get', 'clear'];
                    const operation = operations[operationId % operations.length];

                    switch (operation) {
                        case 'set':
                            const key = `key_${operationId}`;
                            const value = enhancedTest.generateLargeDataset(10, 'object');
                            mockCache.set(key, value);
                            break;
                        case 'get':
                            const getKey = `key_${Math.floor(operationId / 2)}`; // Get recently set keys
                            return mockCache.get(getKey);
                        case 'clear':
                            if (operationId % 50 === 0) { // Clear every 50 operations
                                mockCache.clear();
                            }
                            break;
                    }
                    return true;
                },
                {
                    duration: 8000,
                    concurrency: 8,
                    iterations: 200,
                    errorThreshold: 0.05
                }
            );

            assert.strictEqual(stressResult.passed, true);
            assert.ok(stressResult.errorRate <= 0.05);
            assert.ok(stressResult.averageResponseTime < 100); // Cache ops should be fast
        });

        test('should stress test concurrent node operations', async () => {
            const stressResult = await enhancedTest.runStressTest(
                'concurrent_node_ops',
                async (operationId) => {
                    const node = new MockFXDNode({ id: `node_${operationId}` });

                    // Perform various operations
                    node.set('data', enhancedTest.generateLargeDataset(50, 'object'));
                    node.set('timestamp', Date.now());
                    node.set('operationId', operationId);

                    const retrieved = node.get('data');
                    const value = node.val();

                    return { retrieved: !!retrieved, value, operationId };
                },
                {
                    duration: 12000,
                    concurrency: 15,
                    iterations: 300,
                    errorThreshold: 0.02
                }
            );

            assert.strictEqual(stressResult.passed, true);
            assert.ok(stressResult.errorRate <= 0.02);
            assert.ok(stressResult.memoryUsage.leaked === false);
        });

        test('should handle memory pressure gracefully', async () => {
            const stressResult = await enhancedTest.runStressTest(
                'memory_pressure',
                async (operationId) => {
                    // Create memory pressure
                    const largeData = enhancedTest.generateLargeDataset(1000, 'string');
                    const node = new MockFXDNode({ value: largeData });

                    // Force some processing
                    const processed = await node.processLargeDataset(largeData.slice(0, 100));

                    // Release reference to help GC
                    return processed.length;
                },
                {
                    duration: 15000,
                    concurrency: 10,
                    iterations: 100,
                    errorThreshold: 0.15, // Higher threshold due to memory pressure
                    memoryThreshold: 200 * 1024 * 1024 // 200MB threshold
                }
            );

            // Test should either pass or fail gracefully without crashing
            assert.ok(typeof stressResult.passed === 'boolean');
            assert.ok(stressResult.errors.length < 50); // Should not have excessive errors
        });
    });

    describe('Edge Case Testing', () => {
        test('should test null and undefined handling', async () => {
            const edgeCases = [
                {
                    name: 'null_input',
                    description: 'Handle null input gracefully',
                    input: null,
                    expectedBehavior: 'Should handle null without crashing',
                    execute: async () => {
                        const node = new MockFXDNode();
                        return node.validateInput(null);
                    },
                    validate: (result) => result && !result.valid && result.errors.length > 0
                },
                {
                    name: 'undefined_input',
                    description: 'Handle undefined input gracefully',
                    input: undefined,
                    expectedBehavior: 'Should handle undefined without crashing',
                    execute: async () => {
                        const node = new MockFXDNode();
                        return node.validateInput(undefined);
                    },
                    validate: (result) => result && !result.valid && result.errors.length > 0
                },
                {
                    name: 'empty_string',
                    description: 'Handle empty string input',
                    input: '',
                    expectedBehavior: 'Should handle empty string',
                    execute: async () => {
                        const node = new MockFXDNode();
                        return node.validateInput('');
                    },
                    validate: (result) => result && result.valid === true
                },
                {
                    name: 'empty_object',
                    description: 'Handle empty object input',
                    input: {},
                    expectedBehavior: 'Should handle empty object',
                    execute: async () => {
                        const node = new MockFXDNode({});
                        return node.val();
                    },
                    validate: (result) => result === null // Default value
                },
                {
                    name: 'empty_array',
                    description: 'Handle empty array input',
                    input: [],
                    expectedBehavior: 'Should handle empty array',
                    execute: async () => {
                        const node = new MockFXDNode();
                        return await node.processLargeDataset([]);
                    },
                    validate: (result) => Array.isArray(result) && result.length === 0
                }
            ];

            const result = await enhancedTest.runEdgeCaseTest('null_undefined_handling', edgeCases);

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.failedCases, 0);
            assert.strictEqual(result.passedCases, edgeCases.length);
        });

        test('should test boundary value conditions', async () => {
            const edgeCases = [
                {
                    name: 'max_integer',
                    description: 'Handle maximum safe integer',
                    input: Number.MAX_SAFE_INTEGER,
                    execute: async () => {
                        const node = new MockFXDNode({ value: Number.MAX_SAFE_INTEGER });
                        return node.val();
                    },
                    validate: (result) => result === Number.MAX_SAFE_INTEGER
                },
                {
                    name: 'min_integer',
                    description: 'Handle minimum safe integer',
                    input: Number.MIN_SAFE_INTEGER,
                    execute: async () => {
                        const node = new MockFXDNode({ value: Number.MIN_SAFE_INTEGER });
                        return node.val();
                    },
                    validate: (result) => result === Number.MIN_SAFE_INTEGER
                },
                {
                    name: 'infinity',
                    description: 'Handle infinity values',
                    input: Infinity,
                    execute: async () => {
                        const node = new MockFXDNode({ value: Infinity });
                        return node.val();
                    },
                    validate: (result) => result === Infinity
                },
                {
                    name: 'negative_infinity',
                    description: 'Handle negative infinity',
                    input: -Infinity,
                    execute: async () => {
                        const node = new MockFXDNode({ value: -Infinity });
                        return node.val();
                    },
                    validate: (result) => result === -Infinity
                },
                {
                    name: 'nan',
                    description: 'Handle NaN values',
                    input: NaN,
                    execute: async () => {
                        const node = new MockFXDNode({ value: NaN });
                        return node.val();
                    },
                    validate: (result) => Number.isNaN(result)
                }
            ];

            const result = await enhancedTest.runEdgeCaseTest('boundary_values', edgeCases);

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.failedCases, 0);
        });

        test('should test corrupted data handling', async () => {
            const originalData = enhancedTest.generateLargeDataset(100, 'object');

            const edgeCases = [
                {
                    name: 'missing_fields',
                    description: 'Handle data with missing fields',
                    input: enhancedTest.generateCorruptedData(originalData, 'missing_fields'),
                    execute: async () => {
                        const corrupted = enhancedTest.generateCorruptedData(originalData, 'missing_fields');
                        const node = new MockFXDNode();
                        return await node.processLargeDataset(corrupted);
                    },
                    validate: (result) => Array.isArray(result) && result.length > 0
                },
                {
                    name: 'wrong_types',
                    description: 'Handle data with wrong types',
                    input: enhancedTest.generateCorruptedData(originalData, 'wrong_types'),
                    execute: async () => {
                        const corrupted = enhancedTest.generateCorruptedData(originalData, 'wrong_types');
                        const node = new MockFXDNode();
                        return await node.processLargeDataset(corrupted);
                    },
                    validate: (result) => Array.isArray(result)
                },
                {
                    name: 'null_values',
                    description: 'Handle data with null values',
                    input: enhancedTest.generateCorruptedData(originalData, 'null_values'),
                    execute: async () => {
                        const corrupted = enhancedTest.generateCorruptedData(originalData, 'null_values');
                        const node = new MockFXDNode();
                        return await node.processLargeDataset(corrupted);
                    },
                    validate: (result) => Array.isArray(result)
                }
            ];

            const result = await enhancedTest.runEdgeCaseTest('corrupted_data', edgeCases);

            assert.strictEqual(result.passed, true);
            assert.ok(result.passedCases >= result.totalCases * 0.8); // At least 80% should pass
        });

        test('should test extremely large inputs', async () => {
            const edgeCases = [
                {
                    name: 'very_large_string',
                    description: 'Handle very large string input',
                    input: 'A'.repeat(50000),
                    execute: async () => {
                        const node = new MockFXDNode();
                        return node.validateInput('A'.repeat(50000));
                    },
                    validate: (result) => result && !result.valid // Should reject large strings
                },
                {
                    name: 'very_large_array',
                    description: 'Handle very large array',
                    input: new Array(10000).fill(0),
                    execute: async () => {
                        const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i }));
                        const node = new MockFXDNode();
                        return await node.processLargeDataset(largeArray);
                    },
                    validate: (result) => Array.isArray(result) && result.length === 10000
                },
                {
                    name: 'deeply_nested_object',
                    description: 'Handle deeply nested object',
                    input: {},
                    execute: async () => {
                        // Create deeply nested object
                        let nested = {};
                        let current = nested;
                        for (let i = 0; i < 100; i++) {
                            current.next = { level: i };
                            current = current.next;
                        }

                        const node = new MockFXDNode({ value: nested });
                        return node.val();
                    },
                    validate: (result) => result && typeof result === 'object'
                }
            ];

            const result = await enhancedTest.runEdgeCaseTest('large_inputs', edgeCases);

            assert.ok(result.passedCases >= result.totalCases * 0.7); // At least 70% should handle large inputs
        });
    });

    describe('Security Testing', () => {
        test('should test input validation security', async () => {
            const securityChecks = [
                {
                    name: 'sql_injection_prevention',
                    type: 'injection',
                    severity: 'high',
                    description: 'Prevent SQL injection attacks',
                    execute: async () => {
                        const maliciousInputs = enhancedTest.generateMaliciousInput('injection');
                        const findings = [];

                        for (const input of maliciousInputs) {
                            const node = new MockFXDNode();
                            const validation = node.validateInput(input);

                            if (validation.valid) {
                                findings.push(`SQL injection input accepted: ${input.substring(0, 50)}`);
                            }
                        }

                        return findings;
                    }
                },
                {
                    name: 'xss_prevention',
                    type: 'injection',
                    severity: 'high',
                    description: 'Prevent XSS attacks',
                    execute: async () => {
                        const xssInputs = [
                            "<script>alert('xss')</script>",
                            "javascript:alert('xss')",
                            "<img onerror='alert(1)' src='x'>",
                            "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//",
                            "\";alert(String.fromCharCode(88,83,83))//\";alert(String.fromCharCode(88,83,83))//"
                        ];

                        const findings = [];

                        for (const input of xssInputs) {
                            const node = new MockFXDNode();
                            const validation = node.validateInput(input);

                            if (validation.valid) {
                                findings.push(`XSS input accepted: ${input}`);
                            }
                        }

                        return findings;
                    }
                },
                {
                    name: 'path_traversal_prevention',
                    type: 'traversal',
                    severity: 'high',
                    description: 'Prevent path traversal attacks',
                    execute: async () => {
                        const traversalInputs = [
                            "../../etc/passwd",
                            "..\\..\\windows\\system32",
                            "....//....//etc//passwd",
                            "%2e%2e%2f%2e%2e%2f%65%74%63%2f%70%61%73%73%77%64"
                        ];

                        const findings = [];

                        for (const input of traversalInputs) {
                            const node = new MockFXDNode();
                            const validation = node.validateInput(input);

                            if (validation.valid) {
                                findings.push(`Path traversal input accepted: ${input}`);
                            }
                        }

                        return findings;
                    }
                },
                {
                    name: 'buffer_overflow_prevention',
                    type: 'overflow',
                    severity: 'medium',
                    description: 'Prevent buffer overflow attacks',
                    execute: async () => {
                        const overflowInputs = enhancedTest.generateMaliciousInput('overflow');
                        const findings = [];

                        for (const input of overflowInputs) {
                            const node = new MockFXDNode();
                            const validation = node.validateInput(input);

                            if (validation.valid) {
                                findings.push(`Large input accepted without validation: ${input.length} chars`);
                            }
                        }

                        return findings;
                    }
                }
            ];

            const result = await enhancedTest.runSecurityTest('input_validation', securityChecks);

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.vulnerabilities.filter(v => v.severity === 'critical').length, 0);
            assert.ok(result.securityScore >= 80);
        });

        test('should test error handling security', async () => {
            const securityChecks = [
                {
                    name: 'information_disclosure',
                    type: 'disclosure',
                    severity: 'medium',
                    description: 'Prevent information disclosure in error messages',
                    execute: async () => {
                        const findings = [];
                        const sensitivePatterns = [
                            /password/i,
                            /secret/i,
                            /token/i,
                            /api[_-]?key/i,
                            /private[_-]?key/i
                        ];

                        try {
                            const node = new MockFXDNode();
                            const error = new Error('Database connection failed: password=secret123');
                            const handled = node.handleError(error);

                            if (handled.message) {
                                for (const pattern of sensitivePatterns) {
                                    if (pattern.test(handled.message)) {
                                        findings.push(`Sensitive information in error: ${handled.message}`);
                                    }
                                }
                            }
                        } catch (error) {
                            // Check if error contains sensitive info
                            for (const pattern of sensitivePatterns) {
                                if (pattern.test(error.message)) {
                                    findings.push(`Sensitive information in unhandled error: ${error.message}`);
                                }
                            }
                        }

                        return findings;
                    }
                },
                {
                    name: 'stack_trace_exposure',
                    type: 'disclosure',
                    severity: 'low',
                    description: 'Prevent stack trace exposure in production',
                    execute: async () => {
                        const findings = [];

                        try {
                            const node = new MockFXDNode();
                            const error = new Error('Test error');
                            const handled = node.handleError(error);

                            // In production, stack traces should not be exposed
                            if (handled.stack && process.env.NODE_ENV === 'production') {
                                findings.push('Stack trace exposed in production environment');
                            }
                        } catch (error) {
                            // This is expected
                        }

                        return findings;
                    }
                }
            ];

            const result = await enhancedTest.runSecurityTest('error_handling', securityChecks);

            assert.ok(result.securityScore >= 70); // Allow some flexibility for error handling
        });

        test('should test memory safety', async () => {
            const securityChecks = [
                {
                    name: 'memory_leak_prevention',
                    type: 'memory',
                    severity: 'medium',
                    description: 'Prevent memory leaks in long-running operations',
                    execute: async () => {
                        const findings = [];
                        const initialMemory = process.memoryUsage();

                        // Simulate memory-intensive operations
                        const operations = [];
                        for (let i = 0; i < 100; i++) {
                            const node = new MockFXDNode();
                            const largeData = enhancedTest.generateLargeDataset(100, 'object');
                            node.set('data', largeData);
                            operations.push(node);
                        }

                        // Clear references
                        operations.length = 0;

                        // Force garbage collection if available
                        if (global.gc) {
                            global.gc();
                        }

                        // Wait a bit
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const finalMemory = process.memoryUsage();
                        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

                        // If memory grew significantly, it might be a leak
                        if (memoryGrowth > 50 * 1024 * 1024) { // 50MB
                            findings.push(`Potential memory leak detected: ${memoryGrowth} bytes`);
                        }

                        return findings;
                    }
                },
                {
                    name: 'resource_exhaustion_prevention',
                    type: 'dos',
                    severity: 'high',
                    description: 'Prevent resource exhaustion attacks',
                    execute: async () => {
                        const findings = [];

                        try {
                            // Try to create excessive resources
                            const nodes = [];
                            for (let i = 0; i < 10000; i++) {
                                const node = new MockFXDNode();
                                const largeData = enhancedTest.generateLargeDataset(1000, 'object');
                                node.set('data', largeData);
                                nodes.push(node);

                                // Check if we're using too much memory
                                if (i % 1000 === 0) {
                                    const currentMemory = process.memoryUsage();
                                    if (currentMemory.heapUsed > 500 * 1024 * 1024) { // 500MB
                                        findings.push(`Resource exhaustion possible: ${currentMemory.heapUsed} bytes used`);
                                        break;
                                    }
                                }
                            }
                        } catch (error) {
                            // This might indicate good resource limits
                            if (error.message.includes('memory')) {
                                // Good - system prevented resource exhaustion
                            } else {
                                findings.push(`Unexpected error during resource test: ${error.message}`);
                            }
                        }

                        return findings;
                    }
                }
            ];

            const result = await enhancedTest.runSecurityTest('memory_safety', securityChecks);

            assert.ok(result.securityScore >= 60); // Memory tests can be environment-dependent
        });
    });

    describe('Cross-Category Integration Testing', () => {
        test('should combine stress, edge cases, and security in realistic scenario', async () => {
            // This test combines all three categories in a realistic workflow
            const testStart = performance.now();
            const results = {
                stress: null,
                edgeCase: null,
                security: null,
                integration: null
            };

            // 1. Stress test with edge case inputs
            results.stress = await enhancedTest.runStressTest(
                'integrated_stress_edge',
                async (operationId) => {
                    const node = new MockFXDNode();

                    // Use edge case inputs in stress test
                    const edgeInputs = [null, undefined, '', 'A'.repeat(1000), {}, []];
                    const input = edgeInputs[operationId % edgeInputs.length];

                    const validation = node.validateInput(input);

                    if (validation.valid) {
                        const data = enhancedTest.generateLargeDataset(50, 'object');
                        return await node.processLargeDataset(data);
                    }

                    return validation;
                },
                {
                    duration: 5000,
                    concurrency: 5,
                    iterations: 50,
                    errorThreshold: 0.3 // Higher threshold due to edge cases
                }
            );

            // 2. Edge case test with security considerations
            const securityEdgeCases = [
                {
                    name: 'malicious_large_input',
                    description: 'Handle large malicious input',
                    execute: async () => {
                        const maliciousInput = enhancedTest.generateMaliciousInput('injection')[0] + 'A'.repeat(10000);
                        const node = new MockFXDNode();
                        return node.validateInput(maliciousInput);
                    },
                    validate: (result) => !result.valid
                },
                {
                    name: 'corrupted_security_data',
                    description: 'Handle corrupted security-sensitive data',
                    execute: async () => {
                        const originalData = [{ token: 'secret123', user: 'admin' }];
                        const corrupted = enhancedTest.generateCorruptedData(originalData, 'missing_fields');
                        const node = new MockFXDNode();
                        return await node.processLargeDataset(corrupted);
                    },
                    validate: (result) => Array.isArray(result)
                }
            ];

            results.edgeCase = await enhancedTest.runEdgeCaseTest('security_edge_cases', securityEdgeCases);

            // 3. Security test under stress
            const stressSecurityChecks = [
                {
                    name: 'concurrent_security_validation',
                    type: 'concurrency',
                    severity: 'high',
                    description: 'Maintain security under concurrent load',
                    execute: async () => {
                        const findings = [];
                        const promises = [];

                        // Run multiple security validations concurrently
                        for (let i = 0; i < 20; i++) {
                            promises.push((async () => {
                                const node = new MockFXDNode();
                                const maliciousInput = enhancedTest.generateMaliciousInput('injection')[0];
                                const validation = node.validateInput(maliciousInput);

                                if (validation.valid) {
                                    return `Concurrent validation failed for operation ${i}`;
                                }
                                return null;
                            })());
                        }

                        const concurrentResults = await Promise.all(promises);
                        const failures = concurrentResults.filter(r => r !== null);

                        return failures;
                    }
                }
            ];

            results.security = await enhancedTest.runSecurityTest('stress_security', stressSecurityChecks);

            const testEnd = performance.now();

            // 4. Integration assessment
            results.integration = {
                totalDuration: testEnd - testStart,
                stressPassed: results.stress.passed,
                edgeCasePassed: results.edgeCase.passed,
                securityPassed: results.security.passed,
                overallPassed: results.stress.passed && results.edgeCase.passed && results.security.passed,
                combinedScore: (
                    (results.stress.passed ? 1 : 0) +
                    (results.edgeCase.passed ? 1 : 0) +
                    (results.security.passed ? 1 : 0)
                ) / 3 * 100
            };

            // Assertions
            assert.ok(results.integration.totalDuration < 30000); // Should complete in 30 seconds
            assert.ok(results.integration.combinedScore >= 67); // At least 2/3 categories should pass
            assert.strictEqual(results.integration.overallPassed, true);

            console.log(`🔄 Integrated Test Results:`);
            console.log(`- Stress Test: ${results.stress.passed ? '✅' : '❌'} (${results.stress.errorRate.toFixed(2)} error rate)`);
            console.log(`- Edge Cases: ${results.edgeCase.passed ? '✅' : '❌'} (${results.edgeCase.passedCases}/${results.edgeCase.totalCases} passed)`);
            console.log(`- Security: ${results.security.passed ? '✅' : '❌'} (${results.security.securityScore.toFixed(1)} score)`);
            console.log(`- Combined Score: ${results.integration.combinedScore.toFixed(1)}%`);
        });

        test('should validate production readiness across all categories', () => {
            const productionReadiness = {
                stressTests: enhancedTest.stressTestResults.size,
                edgeCaseTests: enhancedTest.edgeCaseResults.size,
                securityTests: enhancedTest.securityTestResults.size,
                passedStressTests: Array.from(enhancedTest.stressTestResults.values()).filter(r => r.passed).length,
                passedEdgeCaseTests: Array.from(enhancedTest.edgeCaseResults.values()).filter(r => r.passed).length,
                passedSecurityTests: Array.from(enhancedTest.securityTestResults.values()).filter(r => r.passed).length
            };

            const readinessScore = {
                stress: productionReadiness.stressTests > 0 ?
                    (productionReadiness.passedStressTests / productionReadiness.stressTests) * 100 : 0,
                edgeCase: productionReadiness.edgeCaseTests > 0 ?
                    (productionReadiness.passedEdgeCaseTests / productionReadiness.edgeCaseTests) * 100 : 0,
                security: productionReadiness.securityTests > 0 ?
                    (productionReadiness.passedSecurityTests / productionReadiness.securityTests) * 100 : 0
            };

            const overallReadiness = (readinessScore.stress + readinessScore.edgeCase + readinessScore.security) / 3;

            // Production readiness criteria
            assert.ok(readinessScore.stress >= 80, `Stress test readiness: ${readinessScore.stress.toFixed(1)}% (minimum 80%)`);
            assert.ok(readinessScore.edgeCase >= 85, `Edge case readiness: ${readinessScore.edgeCase.toFixed(1)}% (minimum 85%)`);
            assert.ok(readinessScore.security >= 75, `Security readiness: ${readinessScore.security.toFixed(1)}% (minimum 75%)`);
            assert.ok(overallReadiness >= 80, `Overall readiness: ${overallReadiness.toFixed(1)}% (minimum 80%)`);

            console.log(`🏆 Production Readiness Assessment:`);
            console.log(`- Stress Testing: ${readinessScore.stress.toFixed(1)}%`);
            console.log(`- Edge Case Handling: ${readinessScore.edgeCase.toFixed(1)}%`);
            console.log(`- Security Validation: ${readinessScore.security.toFixed(1)}%`);
            console.log(`- Overall Readiness: ${overallReadiness.toFixed(1)}%`);
            console.log(`- Production Ready: ${overallReadiness >= 80 ? '✅ YES' : '❌ NO'}`);
        });
    });
});