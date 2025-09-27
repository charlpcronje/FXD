/**
 * Section 6: Error Handling & Recovery Testing Suite
 *
 * Comprehensive tests for error type validation, transaction rollback,
 * data corruption detection, rate limiting, performance monitoring,
 * memory leak detection, security hardening, and diagnostic tools.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';

// Mock FXD Error Handling Components
class FXDErrorManager {
    constructor() {
        this.errorTypes = new Map();
        this.transactions = new Map();
        this.corruptionChecks = new Map();
        this.rateLimits = new Map();
        this.performanceMetrics = new Map();
        this.memoryBaseline = process.memoryUsage();
        this.diagnostics = new Map();
        this.telemetryData = [];
        this.securityEvents = [];
    }

    // Error Type Management
    registerErrorType(type, handler) {
        this.errorTypes.set(type, handler);
    }

    handleError(error, context = {}) {
        const errorType = error.constructor.name;
        const handler = this.errorTypes.get(errorType) || this.errorTypes.get('default');

        if (handler) {
            return handler(error, context);
        }

        throw new Error(`Unhandled error type: ${errorType}`);
    }

    // Transaction Management
    beginTransaction(id, operations = []) {
        this.transactions.set(id, {
            id,
            operations,
            status: 'active',
            startTime: Date.now(),
            rollbackStack: []
        });
    }

    addOperation(transactionId, operation) {
        const transaction = this.transactions.get(transactionId);
        if (transaction && transaction.status === 'active') {
            transaction.operations.push(operation);
            transaction.rollbackStack.push(operation.rollback);
        }
    }

    commitTransaction(id) {
        const transaction = this.transactions.get(id);
        if (transaction) {
            transaction.status = 'committed';
            return true;
        }
        return false;
    }

    rollbackTransaction(id) {
        const transaction = this.transactions.get(id);
        if (transaction) {
            // Execute rollback operations in reverse order
            for (let i = transaction.rollbackStack.length - 1; i >= 0; i--) {
                try {
                    transaction.rollbackStack[i]();
                } catch (rollbackError) {
                    console.warn(`Rollback operation failed: ${rollbackError.message}`);
                }
            }
            transaction.status = 'rolled_back';
            return true;
        }
        return false;
    }

    // Data Corruption Detection
    addCorruptionCheck(key, validator) {
        this.corruptionChecks.set(key, validator);
    }

    checkDataIntegrity(data, key) {
        const validator = this.corruptionChecks.get(key);
        if (validator) {
            return validator(data);
        }
        return { valid: true, errors: [] };
    }

    repairCorruption(data, key, repairStrategy = 'auto') {
        const integrity = this.checkDataIntegrity(data, key);
        if (!integrity.valid) {
            switch (repairStrategy) {
                case 'auto':
                    return this.autoRepair(data, integrity.errors);
                case 'backup':
                    return this.restoreFromBackup(key);
                case 'rebuild':
                    return this.rebuildFromSource(key);
                default:
                    throw new Error(`Unknown repair strategy: ${repairStrategy}`);
            }
        }
        return data;
    }

    autoRepair(data, errors) {
        // Simulate auto-repair logic
        const repaired = JSON.parse(JSON.stringify(data));
        errors.forEach(error => {
            if (error.type === 'missing_field') {
                repaired[error.field] = error.defaultValue;
            } else if (error.type === 'invalid_type') {
                repaired[error.field] = this.coerceType(repaired[error.field], error.expectedType);
            }
        });
        return repaired;
    }

    coerceType(value, expectedType) {
        switch (expectedType) {
            case 'string': return String(value);
            case 'number': return Number(value) || 0;
            case 'boolean': return Boolean(value);
            case 'array': return Array.isArray(value) ? value : [];
            case 'object': return typeof value === 'object' ? value : {};
            default: return value;
        }
    }

    // Rate Limiting
    configureRateLimit(operation, limit, windowMs = 60000) {
        this.rateLimits.set(operation, {
            limit,
            windowMs,
            requests: [],
            blocked: false
        });
    }

    checkRateLimit(operation, identifier = 'default') {
        const config = this.rateLimits.get(operation);
        if (!config) return { allowed: true, remaining: Infinity };

        const now = Date.now();
        const key = `${operation}:${identifier}`;

        if (!config.requests[key]) {
            config.requests[key] = [];
        }

        // Clean old requests
        config.requests[key] = config.requests[key].filter(
            time => now - time < config.windowMs
        );

        const currentRequests = config.requests[key].length;

        if (currentRequests >= config.limit) {
            config.blocked = true;
            return {
                allowed: false,
                remaining: 0,
                resetTime: Math.min(...config.requests[key]) + config.windowMs
            };
        }

        config.requests[key].push(now);
        return {
            allowed: true,
            remaining: config.limit - currentRequests - 1
        };
    }

    // Performance Monitoring
    startPerformanceMonitoring(operation) {
        const startTime = performance.now();
        const startMemory = process.memoryUsage();

        return {
            operation,
            startTime,
            startMemory,
            end: () => {
                const endTime = performance.now();
                const endMemory = process.memoryUsage();
                const metrics = {
                    operation,
                    duration: endTime - startTime,
                    memoryDelta: {
                        rss: endMemory.rss - startMemory.rss,
                        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                        heapTotal: endMemory.heapTotal - startMemory.heapTotal
                    }
                };

                this.performanceMetrics.set(operation, metrics);
                return metrics;
            }
        };
    }

    getPerformanceMetrics(operation) {
        return this.performanceMetrics.get(operation);
    }

    isPerformanceAcceptable(operation, thresholds) {
        const metrics = this.performanceMetrics.get(operation);
        if (!metrics) return false;

        return (
            metrics.duration <= thresholds.maxDuration &&
            metrics.memoryDelta.heapUsed <= thresholds.maxMemoryIncrease
        );
    }

    // Memory Leak Detection
    detectMemoryLeaks(baseline = this.memoryBaseline) {
        const current = process.memoryUsage();
        const leaks = [];

        if (current.heapUsed > baseline.heapUsed * 2) {
            leaks.push({
                type: 'heap_growth',
                severity: 'high',
                current: current.heapUsed,
                baseline: baseline.heapUsed,
                ratio: current.heapUsed / baseline.heapUsed
            });
        }

        if (current.rss > baseline.rss * 1.5) {
            leaks.push({
                type: 'rss_growth',
                severity: 'medium',
                current: current.rss,
                baseline: baseline.rss,
                ratio: current.rss / baseline.rss
            });
        }

        return leaks;
    }

    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }

    // Security Hardening
    validateInput(input, schema) {
        const errors = [];

        if (schema.required && !input) {
            errors.push({ field: 'input', message: 'Input is required' });
        }

        if (schema.type && typeof input !== schema.type) {
            errors.push({ field: 'input', message: `Expected ${schema.type}, got ${typeof input}` });
        }

        if (schema.maxLength && input.length > schema.maxLength) {
            errors.push({ field: 'input', message: `Input too long (max ${schema.maxLength})` });
        }

        if (schema.pattern && !schema.pattern.test(input)) {
            errors.push({ field: 'input', message: 'Input does not match required pattern' });
        }

        return { valid: errors.length === 0, errors };
    }

    detectSecurityThreats(request) {
        const threats = [];

        // SQL Injection detection
        if (typeof request === 'string' && /['";]|(\bunion\b)|(\bselect\b)/i.test(request)) {
            threats.push({ type: 'sql_injection', severity: 'high' });
        }

        // XSS detection
        if (typeof request === 'string' && /<script|javascript:|on\w+=/i.test(request)) {
            threats.push({ type: 'xss', severity: 'high' });
        }

        // Path traversal detection
        if (typeof request === 'string' && /\.\.\/|\.\.\\/.test(request)) {
            threats.push({ type: 'path_traversal', severity: 'medium' });
        }

        return threats;
    }

    // Diagnostic Tools
    generateDiagnostics() {
        return {
            timestamp: new Date().toISOString(),
            system: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                platform: process.platform,
                nodeVersion: process.version
            },
            fxd: {
                errorTypes: Array.from(this.errorTypes.keys()),
                activeTransactions: Array.from(this.transactions.values())
                    .filter(t => t.status === 'active').length,
                rateLimitConfigs: Array.from(this.rateLimits.keys()),
                performanceMetrics: Array.from(this.performanceMetrics.keys()),
                telemetryEvents: this.telemetryData.length,
                securityEvents: this.securityEvents.length
            }
        };
    }

    exportDiagnostics(format = 'json') {
        const diagnostics = this.generateDiagnostics();

        switch (format) {
            case 'json':
                return JSON.stringify(diagnostics, null, 2);
            case 'csv':
                return this.convertToCSV(diagnostics);
            case 'summary':
                return this.generateSummary(diagnostics);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    // Telemetry Collection
    collectTelemetry(event, data = {}) {
        const telemetryEvent = {
            timestamp: Date.now(),
            event,
            data,
            sessionId: this.sessionId || 'unknown',
            userId: data.userId || 'anonymous'
        };

        this.telemetryData.push(telemetryEvent);

        // Keep only last 1000 events to prevent memory issues
        if (this.telemetryData.length > 1000) {
            this.telemetryData = this.telemetryData.slice(-1000);
        }

        return telemetryEvent;
    }

    getTelemetryData(filter = {}) {
        let data = this.telemetryData;

        if (filter.event) {
            data = data.filter(item => item.event === filter.event);
        }

        if (filter.startTime) {
            data = data.filter(item => item.timestamp >= filter.startTime);
        }

        if (filter.userId) {
            data = data.filter(item => item.data.userId === filter.userId);
        }

        return data;
    }
}

// Error Types for Testing
class FXDValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'FXDValidationError';
        this.field = field;
    }
}

class FXDTransactionError extends Error {
    constructor(message, transactionId) {
        super(message);
        this.name = 'FXDTransactionError';
        this.transactionId = transactionId;
    }
}

class FXDCorruptionError extends Error {
    constructor(message, corruptedData) {
        super(message);
        this.name = 'FXDCorruptionError';
        this.corruptedData = corruptedData;
    }
}

// Test Suite
describe('Section 6: Error Handling & Recovery', () => {
    let errorManager;

    test('should initialize error manager', () => {
        errorManager = new FXDErrorManager();
        assert.ok(errorManager instanceof FXDErrorManager);
    });

    describe('Error Type Validation and Handling', () => {
        test('should register and handle custom error types', () => {
            errorManager.registerErrorType('FXDValidationError', (error, context) => {
                return {
                    handled: true,
                    type: 'validation',
                    field: error.field,
                    message: error.message,
                    context
                };
            });

            const error = new FXDValidationError('Invalid input', 'username');
            const result = errorManager.handleError(error, { operation: 'user_creation' });

            assert.strictEqual(result.handled, true);
            assert.strictEqual(result.type, 'validation');
            assert.strictEqual(result.field, 'username');
        });

        test('should handle unregistered error types with default handler', () => {
            errorManager.registerErrorType('default', (error, context) => {
                return {
                    handled: true,
                    type: 'unknown',
                    message: error.message
                };
            });

            const error = new Error('Unknown error');
            const result = errorManager.handleError(error);

            assert.strictEqual(result.handled, true);
            assert.strictEqual(result.type, 'unknown');
        });

        test('should throw on completely unhandled errors', () => {
            const freshManager = new FXDErrorManager();
            const error = new Error('Unhandled error');

            assert.throws(() => {
                freshManager.handleError(error);
            }, /Unhandled error type/);
        });
    });

    describe('Transaction Rollback and Recovery', () => {
        test('should manage transaction lifecycle', () => {
            const transactionId = 'tx_001';

            errorManager.beginTransaction(transactionId);
            assert.ok(errorManager.transactions.has(transactionId));

            const transaction = errorManager.transactions.get(transactionId);
            assert.strictEqual(transaction.status, 'active');
        });

        test('should add operations to transactions', () => {
            const transactionId = 'tx_002';
            errorManager.beginTransaction(transactionId);

            const operation = {
                type: 'create_file',
                data: { path: '/test.txt', content: 'test' },
                rollback: () => { /* remove file */ }
            };

            errorManager.addOperation(transactionId, operation);

            const transaction = errorManager.transactions.get(transactionId);
            assert.strictEqual(transaction.operations.length, 1);
            assert.strictEqual(transaction.rollbackStack.length, 1);
        });

        test('should commit transactions successfully', () => {
            const transactionId = 'tx_003';
            errorManager.beginTransaction(transactionId);

            const success = errorManager.commitTransaction(transactionId);
            assert.strictEqual(success, true);

            const transaction = errorManager.transactions.get(transactionId);
            assert.strictEqual(transaction.status, 'committed');
        });

        test('should rollback transactions with proper cleanup', () => {
            const transactionId = 'tx_004';
            errorManager.beginTransaction(transactionId);

            let rollbackExecuted = false;
            const operation = {
                type: 'test_operation',
                rollback: () => { rollbackExecuted = true; }
            };

            errorManager.addOperation(transactionId, operation);

            const success = errorManager.rollbackTransaction(transactionId);
            assert.strictEqual(success, true);
            assert.strictEqual(rollbackExecuted, true);

            const transaction = errorManager.transactions.get(transactionId);
            assert.strictEqual(transaction.status, 'rolled_back');
        });

        test('should handle rollback failures gracefully', () => {
            const transactionId = 'tx_005';
            errorManager.beginTransaction(transactionId);

            const operation = {
                type: 'failing_operation',
                rollback: () => { throw new Error('Rollback failed'); }
            };

            errorManager.addOperation(transactionId, operation);

            // Should not throw, but handle rollback failure gracefully
            const success = errorManager.rollbackTransaction(transactionId);
            assert.strictEqual(success, true);
        });
    });

    describe('Data Corruption Detection and Repair', () => {
        test('should register and execute corruption checks', () => {
            const validator = (data) => {
                const errors = [];
                if (!data.id) errors.push({ type: 'missing_field', field: 'id', defaultValue: 'auto-generated' });
                if (typeof data.name !== 'string') errors.push({ type: 'invalid_type', field: 'name', expectedType: 'string' });
                return { valid: errors.length === 0, errors };
            };

            errorManager.addCorruptionCheck('user_data', validator);

            const corruptData = { name: 123 }; // missing id, wrong type for name
            const result = errorManager.checkDataIntegrity(corruptData, 'user_data');

            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.errors.length, 2);
        });

        test('should auto-repair corrupted data', () => {
            const validator = (data) => {
                const errors = [];
                if (!data.id) errors.push({ type: 'missing_field', field: 'id', defaultValue: 'auto-generated' });
                if (typeof data.name !== 'string') errors.push({ type: 'invalid_type', field: 'name', expectedType: 'string' });
                return { valid: errors.length === 0, errors };
            };

            errorManager.addCorruptionCheck('user_data', validator);

            const corruptData = { name: 123 };
            const repaired = errorManager.repairCorruption(corruptData, 'user_data', 'auto');

            assert.ok(repaired.id);
            assert.strictEqual(typeof repaired.name, 'string');
            assert.strictEqual(repaired.name, '123');
        });

        test('should handle different repair strategies', () => {
            const data = { corrupted: true };

            // Test unknown strategy
            assert.throws(() => {
                errorManager.repairCorruption(data, 'test_key', 'unknown_strategy');
            }, /Unknown repair strategy/);
        });

        test('should handle type coercion correctly', () => {
            assert.strictEqual(errorManager.coerceType('123', 'number'), 123);
            assert.strictEqual(errorManager.coerceType(123, 'string'), '123');
            assert.strictEqual(errorManager.coerceType('true', 'boolean'), true);
            assert.ok(Array.isArray(errorManager.coerceType('test', 'array')));
            assert.strictEqual(typeof errorManager.coerceType('test', 'object'), 'object');
        });
    });

    describe('Rate Limiting and Throttling', () => {
        test('should configure rate limits', () => {
            errorManager.configureRateLimit('api_calls', 5, 60000); // 5 calls per minute

            assert.ok(errorManager.rateLimits.has('api_calls'));
            const config = errorManager.rateLimits.get('api_calls');
            assert.strictEqual(config.limit, 5);
            assert.strictEqual(config.windowMs, 60000);
        });

        test('should allow requests within rate limit', () => {
            errorManager.configureRateLimit('test_operation', 3, 60000);

            const result1 = errorManager.checkRateLimit('test_operation', 'user1');
            assert.strictEqual(result1.allowed, true);
            assert.strictEqual(result1.remaining, 2);

            const result2 = errorManager.checkRateLimit('test_operation', 'user1');
            assert.strictEqual(result2.allowed, true);
            assert.strictEqual(result2.remaining, 1);
        });

        test('should block requests exceeding rate limit', () => {
            errorManager.configureRateLimit('limited_operation', 2, 60000);

            // Use up the limit
            errorManager.checkRateLimit('limited_operation', 'user2');
            errorManager.checkRateLimit('limited_operation', 'user2');

            // This should be blocked
            const result = errorManager.checkRateLimit('limited_operation', 'user2');
            assert.strictEqual(result.allowed, false);
            assert.strictEqual(result.remaining, 0);
            assert.ok(result.resetTime);
        });

        test('should handle different users separately', () => {
            errorManager.configureRateLimit('user_operation', 1, 60000);

            const result1 = errorManager.checkRateLimit('user_operation', 'user_a');
            const result2 = errorManager.checkRateLimit('user_operation', 'user_b');

            assert.strictEqual(result1.allowed, true);
            assert.strictEqual(result2.allowed, true);
        });
    });

    describe('Performance Monitoring', () => {
        test('should monitor operation performance', async () => {
            const monitor = errorManager.startPerformanceMonitoring('test_operation');

            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 100));

            const metrics = monitor.end();

            assert.ok(metrics.duration >= 100);
            assert.ok(metrics.memoryDelta);
            assert.strictEqual(metrics.operation, 'test_operation');
        });

        test('should store and retrieve performance metrics', async () => {
            const monitor = errorManager.startPerformanceMonitoring('stored_operation');
            await new Promise(resolve => setTimeout(resolve, 50));
            monitor.end();

            const metrics = errorManager.getPerformanceMetrics('stored_operation');
            assert.ok(metrics);
            assert.strictEqual(metrics.operation, 'stored_operation');
        });

        test('should validate performance against thresholds', async () => {
            const monitor = errorManager.startPerformanceMonitoring('threshold_test');
            await new Promise(resolve => setTimeout(resolve, 10));
            monitor.end();

            const thresholds = {
                maxDuration: 100,
                maxMemoryIncrease: 1000000 // 1MB
            };

            const acceptable = errorManager.isPerformanceAcceptable('threshold_test', thresholds);
            assert.strictEqual(acceptable, true);
        });

        test('should detect performance violations', async () => {
            const monitor = errorManager.startPerformanceMonitoring('slow_operation');
            await new Promise(resolve => setTimeout(resolve, 200));
            monitor.end();

            const thresholds = {
                maxDuration: 100, // This should be violated
                maxMemoryIncrease: 1000000
            };

            const acceptable = errorManager.isPerformanceAcceptable('slow_operation', thresholds);
            assert.strictEqual(acceptable, false);
        });
    });

    describe('Memory Leak Detection', () => {
        test('should detect memory leaks', () => {
            // Simulate memory growth
            const fakeBaseline = {
                rss: 1000000,
                heapUsed: 500000,
                heapTotal: 1000000
            };

            // Mock current memory usage to simulate leak
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = () => ({
                rss: 2000000, // 2x growth
                heapUsed: 1500000, // 3x growth
                heapTotal: 2000000,
                external: 0,
                arrayBuffers: 0
            });

            const leaks = errorManager.detectMemoryLeaks(fakeBaseline);

            assert.ok(leaks.length > 0);
            assert.ok(leaks.some(leak => leak.type === 'heap_growth'));

            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });

        test('should handle garbage collection', () => {
            // This test depends on --expose-gc flag
            const result = errorManager.forceGarbageCollection();
            // Result depends on whether GC is exposed
            assert.ok(typeof result === 'boolean');
        });
    });

    describe('Security Hardening', () => {
        test('should validate input against schema', () => {
            const schema = {
                required: true,
                type: 'string',
                maxLength: 10,
                pattern: /^[a-zA-Z]+$/
            };

            const result1 = errorManager.validateInput('hello', schema);
            assert.strictEqual(result1.valid, true);

            const result2 = errorManager.validateInput('hello123', schema);
            assert.strictEqual(result2.valid, false);
            assert.ok(result2.errors.some(e => e.message.includes('pattern')));

            const result3 = errorManager.validateInput('verylongstring', schema);
            assert.strictEqual(result3.valid, false);
            assert.ok(result3.errors.some(e => e.message.includes('too long')));
        });

        test('should detect SQL injection attempts', () => {
            const threats1 = errorManager.detectSecurityThreats("'; DROP TABLE users; --");
            assert.ok(threats1.some(t => t.type === 'sql_injection'));

            const threats2 = errorManager.detectSecurityThreats("UNION SELECT password FROM users");
            assert.ok(threats2.some(t => t.type === 'sql_injection'));

            const threats3 = errorManager.detectSecurityThreats("normal input");
            assert.strictEqual(threats3.length, 0);
        });

        test('should detect XSS attempts', () => {
            const threats1 = errorManager.detectSecurityThreats("<script>alert('xss')</script>");
            assert.ok(threats1.some(t => t.type === 'xss'));

            const threats2 = errorManager.detectSecurityThreats("javascript:alert('xss')");
            assert.ok(threats2.some(t => t.type === 'xss'));

            const threats3 = errorManager.detectSecurityThreats('<img onerror="alert(1)" src="x">');
            assert.ok(threats3.some(t => t.type === 'xss'));
        });

        test('should detect path traversal attempts', () => {
            const threats1 = errorManager.detectSecurityThreats("../../../etc/passwd");
            assert.ok(threats1.some(t => t.type === 'path_traversal'));

            const threats2 = errorManager.detectSecurityThreats("..\\..\\windows\\system32");
            assert.ok(threats2.some(t => t.type === 'path_traversal'));

            const threats3 = errorManager.detectSecurityThreats("normal/path/file.txt");
            assert.strictEqual(threats3.length, 0);
        });
    });

    describe('Diagnostic Tools', () => {
        test('should generate comprehensive diagnostics', () => {
            const diagnostics = errorManager.generateDiagnostics();

            assert.ok(diagnostics.timestamp);
            assert.ok(diagnostics.system);
            assert.ok(diagnostics.fxd);
            assert.ok(diagnostics.system.memory);
            assert.ok(typeof diagnostics.system.uptime === 'number');
        });

        test('should export diagnostics in different formats', () => {
            const jsonExport = errorManager.exportDiagnostics('json');
            assert.ok(typeof jsonExport === 'string');
            assert.ok(JSON.parse(jsonExport)); // Should be valid JSON

            assert.throws(() => {
                errorManager.exportDiagnostics('unsupported');
            }, /Unsupported format/);
        });
    });

    describe('Telemetry Data Collection', () => {
        test('should collect telemetry events', () => {
            const event = errorManager.collectTelemetry('user_action', {
                action: 'file_create',
                userId: 'user123'
            });

            assert.ok(event.timestamp);
            assert.strictEqual(event.event, 'user_action');
            assert.strictEqual(event.data.action, 'file_create');
        });

        test('should retrieve filtered telemetry data', () => {
            errorManager.collectTelemetry('event1', { userId: 'user1' });
            errorManager.collectTelemetry('event2', { userId: 'user2' });
            errorManager.collectTelemetry('event1', { userId: 'user1' });

            const allData = errorManager.getTelemetryData();
            assert.strictEqual(allData.length, 3);

            const event1Data = errorManager.getTelemetryData({ event: 'event1' });
            assert.strictEqual(event1Data.length, 2);

            const user1Data = errorManager.getTelemetryData({ userId: 'user1' });
            assert.strictEqual(user1Data.length, 2);
        });

        test('should limit telemetry data size', () => {
            // Generate more than 1000 events
            for (let i = 0; i < 1200; i++) {
                errorManager.collectTelemetry(`event_${i}`, { index: i });
            }

            const allData = errorManager.getTelemetryData();
            assert.strictEqual(allData.length, 1000); // Should be limited to 1000
        });
    });

    describe('Integration and Stress Testing', () => {
        test('should handle multiple error scenarios simultaneously', () => {
            // Register multiple error handlers
            errorManager.registerErrorType('FXDValidationError', (error) => ({ type: 'validation', handled: true }));
            errorManager.registerErrorType('FXDTransactionError', (error) => ({ type: 'transaction', handled: true }));
            errorManager.registerErrorType('FXDCorruptionError', (error) => ({ type: 'corruption', handled: true }));

            // Configure rate limiting
            errorManager.configureRateLimit('mixed_operations', 10, 60000);

            // Start multiple transactions
            for (let i = 0; i < 5; i++) {
                errorManager.beginTransaction(`tx_${i}`);
            }

            // Generate various errors
            const errors = [
                new FXDValidationError('Invalid field', 'test'),
                new FXDTransactionError('Transaction failed', 'tx_1'),
                new FXDCorruptionError('Data corrupted', { corrupted: true })
            ];

            const results = errors.map(error => errorManager.handleError(error));
            assert.ok(results.every(result => result.handled));

            // Check that all systems are still functioning
            const diagnostics = errorManager.generateDiagnostics();
            assert.ok(diagnostics);
            assert.strictEqual(diagnostics.fxd.activeTransactions, 5);
        });

        test('should maintain performance under error load', async () => {
            const startTime = performance.now();

            // Generate many errors rapidly
            for (let i = 0; i < 100; i++) {
                try {
                    errorManager.handleError(new Error(`Error ${i}`));
                } catch (e) {
                    // Expected for unregistered errors
                }

                errorManager.collectTelemetry('error_generated', { index: i });
                errorManager.checkRateLimit('error_ops', `user_${i % 10}`);
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Should handle 100 operations in under 1 second
            assert.ok(totalTime < 1000, `Error handling took too long: ${totalTime}ms`);
        });
    });
});