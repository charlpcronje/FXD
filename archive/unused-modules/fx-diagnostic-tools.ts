/**
 * @file fx-diagnostic-tools.ts
 * @description Comprehensive diagnostic and troubleshooting tools for FXD
 *
 * Provides advanced diagnostic capabilities including:
 * - System health diagnostics
 * - Performance profiling and analysis
 * - Error tracing and root cause analysis
 * - Network connectivity diagnostics
 * - Resource utilization analysis
 * - Configuration validation
 * - Automated troubleshooting workflows
 * - Diagnostic report generation
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager } from './fx-error-handling.ts';
import { PerformanceMonitoringManager } from './fx-performance-monitoring.ts';
import { DataIntegrityManager } from './fx-data-integrity.ts';
import { SecurityHardeningManager } from './fx-security-hardening.ts';

// Diagnostic test types
export enum DiagnosticTestType {
    SYSTEM_HEALTH = 'system_health',
    PERFORMANCE = 'performance',
    CONNECTIVITY = 'connectivity',
    SECURITY = 'security',
    DATA_INTEGRITY = 'data_integrity',
    CONFIGURATION = 'configuration',
    MEMORY = 'memory',
    STORAGE = 'storage',
    NETWORK = 'network',
    DEPENDENCIES = 'dependencies'
}

// Test severity levels
export enum TestSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

// Test result status
export enum TestStatus {
    PASS = 'pass',
    FAIL = 'fail',
    WARNING = 'warning',
    SKIP = 'skip',
    RUNNING = 'running'
}

// Diagnostic test interface
export interface DiagnosticTest {
    id: string;
    name: string;
    type: DiagnosticTestType;
    description: string;
    severity: TestSeverity;
    enabled: boolean;
    timeout: number;
    dependencies?: string[];
    parameters?: Record<string, any>;
    run: (context: DiagnosticContext) => Promise<TestResult>;
}

// Test result interface
export interface TestResult {
    testId: string;
    status: TestStatus;
    message: string;
    duration: number;
    timestamp: Date;
    details?: Record<string, any>;
    recommendations?: string[];
    metrics?: Record<string, number>;
    errors?: string[];
}

// Diagnostic context
export interface DiagnosticContext {
    fx: FXCore;
    errorManager?: ErrorHandlingManager;
    performanceManager?: PerformanceMonitoringManager;
    integrityManager?: DataIntegrityManager;
    securityManager?: SecurityHardeningManager;
    parameters?: Record<string, any>;
    environment: {
        platform: string;
        nodeVersion?: string;
        memoryLimit?: number;
        userAgent?: string;
    };
}

// Diagnostic report interface
export interface DiagnosticReport {
    id: string;
    timestamp: Date;
    duration: number;
    summary: {
        totalTests: number;
        passed: number;
        failed: number;
        warnings: number;
        skipped: number;
        criticalIssues: number;
    };
    tests: TestResult[];
    recommendations: string[];
    systemInfo: {
        platform: string;
        memory: {
            total: number;
            used: number;
            free: number;
        };
        performance: {
            uptime: number;
            loadAverage?: number[];
        };
    };
    troubleshootingGuide?: TroubleshootingGuide;
}

// Troubleshooting guide interface
export interface TroubleshootingGuide {
    issues: Array<{
        category: string;
        problem: string;
        symptoms: string[];
        causes: string[];
        solutions: Array<{
            step: number;
            description: string;
            command?: string;
            expected?: string;
        }>;
        prevention?: string[];
    }>;
}

// Issue pattern interface
export interface IssuePattern {
    id: string;
    name: string;
    symptoms: Array<{
        type: 'error' | 'performance' | 'behavior';
        pattern: string;
        threshold?: number;
    }>;
    confidence: number;
    resolution: {
        steps: string[];
        commands?: string[];
        documentation?: string;
    };
}

/**
 * System health diagnostics
 */
export class SystemHealthDiagnostics {
    /**
     * Test basic system functionality
     */
    static async testBasicFunctionality(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const metrics: Record<string, number> = {};

        try {
            // Test FX core functionality
            const testNode = context.fx.proxy('diagnostic.test');
            testNode.val('test-value');
            const retrievedValue = testNode.val();

            if (retrievedValue !== 'test-value') {
                errors.push('FX core node value storage/retrieval failed');
            }

            // Test proxy functionality
            const childNode = testNode('child');
            childNode.val('child-value');
            const childValue = childNode.val();

            if (childValue !== 'child-value') {
                errors.push('FX proxy child node functionality failed');
            }

            // Test node traversal
            const nodes = testNode.nodes();
            if (!nodes.child) {
                errors.push('FX node traversal failed');
            }

            // Cleanup test nodes
            testNode.val(undefined);

            metrics.testNodesCreated = 2;
            metrics.testOperations = 4;

            const duration = Date.now() - startTime;

            return {
                testId: 'system-basic-functionality',
                status: errors.length === 0 ? TestStatus.PASS : TestStatus.FAIL,
                message: errors.length === 0
                    ? 'Basic system functionality is working correctly'
                    : `Basic functionality issues: ${errors.join(', ')}`,
                duration,
                timestamp: new Date(),
                details: { errors, operations: metrics.testOperations },
                metrics,
                errors: errors.length > 0 ? errors : undefined,
                recommendations: errors.length > 0 ? [
                    'Check FX core initialization',
                    'Verify proxy configuration',
                    'Review system logs for initialization errors'
                ] : undefined
            };

        } catch (error) {
            return {
                testId: 'system-basic-functionality',
                status: TestStatus.FAIL,
                message: `Basic functionality test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message],
                recommendations: [
                    'Check system initialization',
                    'Verify FX core is properly loaded',
                    'Review error logs for detailed information'
                ]
            };
        }
    }

    /**
     * Test memory usage and limits
     */
    static async testMemoryHealth(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const metrics: Record<string, number> = {};
        const recommendations: string[] = [];

        try {
            // Get current memory usage
            let memoryInfo: any = {};

            if (typeof process !== 'undefined' && process.memoryUsage) {
                memoryInfo = process.memoryUsage();
            } else if (typeof (performance as any).memory !== 'undefined') {
                memoryInfo = {
                    heapUsed: (performance as any).memory.usedJSHeapSize,
                    heapTotal: (performance as any).memory.totalJSHeapSize,
                    external: 0,
                    rss: (performance as any).memory.totalJSHeapSize
                };
            }

            metrics.heapUsed = memoryInfo.heapUsed || 0;
            metrics.heapTotal = memoryInfo.heapTotal || 0;
            metrics.external = memoryInfo.external || 0;
            metrics.rss = memoryInfo.rss || 0;

            // Calculate memory usage percentage
            const heapUsagePercent = metrics.heapTotal > 0
                ? (metrics.heapUsed / metrics.heapTotal) * 100
                : 0;

            metrics.heapUsagePercent = heapUsagePercent;

            // Evaluate memory health
            let status = TestStatus.PASS;
            let message = 'Memory usage is within normal limits';

            if (heapUsagePercent > 90) {
                status = TestStatus.CRITICAL;
                message = `Critical memory usage: ${heapUsagePercent.toFixed(1)}%`;
                recommendations.push('Immediate memory cleanup required');
                recommendations.push('Investigate memory leaks');
                recommendations.push('Consider increasing memory limits');
            } else if (heapUsagePercent > 80) {
                status = TestStatus.WARNING;
                message = `High memory usage: ${heapUsagePercent.toFixed(1)}%`;
                recommendations.push('Monitor memory usage closely');
                recommendations.push('Consider optimizing memory-intensive operations');
            } else if (heapUsagePercent > 70) {
                status = TestStatus.WARNING;
                message = `Elevated memory usage: ${heapUsagePercent.toFixed(1)}%`;
                recommendations.push('Review memory usage patterns');
            }

            // Test memory allocation
            try {
                const testArray = new Array(1000).fill(0);
                metrics.allocationTest = testArray.length;
            } catch (error) {
                status = TestStatus.FAIL;
                message = 'Memory allocation test failed';
                recommendations.push('System may be low on available memory');
            }

            const duration = Date.now() - startTime;

            return {
                testId: 'memory-health',
                status,
                message,
                duration,
                timestamp: new Date(),
                details: {
                    memoryInfo,
                    usagePercent: heapUsagePercent
                },
                metrics,
                recommendations: recommendations.length > 0 ? recommendations : undefined
            };

        } catch (error) {
            return {
                testId: 'memory-health',
                status: TestStatus.FAIL,
                message: `Memory health test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }

    /**
     * Test storage functionality
     */
    static async testStorageHealth(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const metrics: Record<string, number> = {};

        try {
            // Test basic storage operations
            const testKey = 'diagnostic-storage-test';
            const testValue = { timestamp: Date.now(), data: 'test-data' };

            // Test write operation
            const storageNode = context.fx.proxy(`system.storage.test.${testKey}`);
            storageNode.val(testValue);

            // Test read operation
            const retrievedValue = storageNode.val();
            if (!retrievedValue || retrievedValue.data !== testValue.data) {
                errors.push('Storage read/write operation failed');
            }

            // Test node enumeration
            const testNodes = context.fx.proxy('system.storage.test').nodes();
            if (!testNodes[testKey]) {
                errors.push('Storage node enumeration failed');
            }

            // Cleanup
            storageNode.val(undefined);

            metrics.storageOperations = 3;

            // Test storage capacity (basic check)
            try {
                const largeData = new Array(1000).fill('x').join('');
                const capacityTestNode = context.fx.proxy('system.storage.capacity-test');
                capacityTestNode.val(largeData);
                capacityTestNode.val(undefined);
                metrics.largeDataTest = largeData.length;
            } catch (error) {
                errors.push('Large data storage test failed');
            }

            const duration = Date.now() - startTime;

            return {
                testId: 'storage-health',
                status: errors.length === 0 ? TestStatus.PASS : TestStatus.FAIL,
                message: errors.length === 0
                    ? 'Storage functionality is working correctly'
                    : `Storage issues detected: ${errors.join(', ')}`,
                duration,
                timestamp: new Date(),
                details: { testKey, testValue },
                metrics,
                errors: errors.length > 0 ? errors : undefined,
                recommendations: errors.length > 0 ? [
                    'Check storage backend connectivity',
                    'Verify storage permissions',
                    'Review storage configuration'
                ] : undefined
            };

        } catch (error) {
            return {
                testId: 'storage-health',
                status: TestStatus.FAIL,
                message: `Storage health test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }
}

/**
 * Performance diagnostics
 */
export class PerformanceDiagnostics {
    /**
     * Test operation performance
     */
    static async testOperationPerformance(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const metrics: Record<string, number> = {};
        const recommendations: string[] = [];

        try {
            // Test node creation performance
            const nodeCreationStart = Date.now();
            for (let i = 0; i < 100; i++) {
                const node = context.fx.proxy(`performance.test.${i}`);
                node.val(`test-value-${i}`);
            }
            const nodeCreationTime = Date.now() - nodeCreationStart;
            metrics.nodeCreationTime = nodeCreationTime;
            metrics.nodeCreationRate = 100 / (nodeCreationTime / 1000); // nodes per second

            // Test node retrieval performance
            const retrievalStart = Date.now();
            for (let i = 0; i < 100; i++) {
                const node = context.fx.proxy(`performance.test.${i}`);
                node.val();
            }
            const retrievalTime = Date.now() - retrievalStart;
            metrics.retrievalTime = retrievalTime;
            metrics.retrievalRate = 100 / (retrievalTime / 1000);

            // Test node traversal performance
            const traversalStart = Date.now();
            const parentNode = context.fx.proxy('performance.test');
            const childNodes = parentNode.nodes();
            const traversalTime = Date.now() - traversalStart;
            metrics.traversalTime = traversalTime;
            metrics.nodesTraversed = Object.keys(childNodes).length;

            // Cleanup test nodes
            for (let i = 0; i < 100; i++) {
                const node = context.fx.proxy(`performance.test.${i}`);
                node.val(undefined);
            }

            // Evaluate performance
            let status = TestStatus.PASS;
            let message = 'Operation performance is within acceptable limits';

            if (nodeCreationTime > 1000) { // More than 1 second for 100 operations
                status = TestStatus.WARNING;
                message = 'Slow node creation performance detected';
                recommendations.push('Consider optimizing node creation logic');
                recommendations.push('Check for memory pressure');
            }

            if (retrievalTime > 500) { // More than 500ms for 100 retrievals
                status = TestStatus.WARNING;
                message = 'Slow node retrieval performance detected';
                recommendations.push('Consider implementing caching');
                recommendations.push('Review storage backend performance');
            }

            const duration = Date.now() - startTime;

            return {
                testId: 'operation-performance',
                status,
                message,
                duration,
                timestamp: new Date(),
                details: {
                    operations: ['creation', 'retrieval', 'traversal'],
                    testSize: 100
                },
                metrics,
                recommendations: recommendations.length > 0 ? recommendations : undefined
            };

        } catch (error) {
            return {
                testId: 'operation-performance',
                status: TestStatus.FAIL,
                message: `Performance test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }

    /**
     * Test concurrent operation performance
     */
    static async testConcurrentPerformance(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const metrics: Record<string, number> = {};

        try {
            const concurrentOperations = 50;
            const operationsPerBatch = 10;

            // Test concurrent node operations
            const promises = [];
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push((async () => {
                    const batchStart = Date.now();
                    for (let j = 0; j < operationsPerBatch; j++) {
                        const node = context.fx.proxy(`concurrent.test.${i}.${j}`);
                        node.val(`concurrent-value-${i}-${j}`);
                        node.val(); // Read back
                    }
                    return Date.now() - batchStart;
                })());
            }

            const batchTimes = await Promise.all(promises);
            const totalConcurrentTime = Date.now() - startTime;

            metrics.concurrentOperations = concurrentOperations;
            metrics.operationsPerBatch = operationsPerBatch;
            metrics.totalOperations = concurrentOperations * operationsPerBatch;
            metrics.totalConcurrentTime = totalConcurrentTime;
            metrics.averageBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
            metrics.operationsPerSecond = metrics.totalOperations / (totalConcurrentTime / 1000);

            // Cleanup
            for (let i = 0; i < concurrentOperations; i++) {
                for (let j = 0; j < operationsPerBatch; j++) {
                    const node = context.fx.proxy(`concurrent.test.${i}.${j}`);
                    node.val(undefined);
                }
            }

            let status = TestStatus.PASS;
            let message = 'Concurrent operation performance is acceptable';
            const recommendations: string[] = [];

            if (metrics.operationsPerSecond < 100) {
                status = TestStatus.WARNING;
                message = 'Low concurrent operation throughput';
                recommendations.push('Consider optimizing concurrent operations');
                recommendations.push('Review locking mechanisms');
            }

            const duration = Date.now() - startTime;

            return {
                testId: 'concurrent-performance',
                status,
                message,
                duration,
                timestamp: new Date(),
                details: {
                    concurrentBatches: concurrentOperations,
                    operationsPerBatch,
                    batchTimes
                },
                metrics,
                recommendations: recommendations.length > 0 ? recommendations : undefined
            };

        } catch (error) {
            return {
                testId: 'concurrent-performance',
                status: TestStatus.FAIL,
                message: `Concurrent performance test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }
}

/**
 * Network and connectivity diagnostics
 */
export class ConnectivityDiagnostics {
    /**
     * Test network connectivity
     */
    static async testNetworkConnectivity(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const metrics: Record<string, number> = {};
        const errors: string[] = [];

        try {
            // Test basic fetch capability
            if (typeof fetch !== 'undefined') {
                try {
                    const testUrl = 'https://httpbin.org/json'; // Reliable test endpoint
                    const fetchStart = Date.now();
                    const response = await fetch(testUrl);
                    const fetchTime = Date.now() - fetchStart;

                    metrics.fetchTime = fetchTime;
                    metrics.responseStatus = response.status;

                    if (!response.ok) {
                        errors.push(`HTTP fetch failed with status: ${response.status}`);
                    }

                    const data = await response.json();
                    metrics.responseSize = JSON.stringify(data).length;

                } catch (error) {
                    errors.push(`Network fetch failed: ${error.message}`);
                }
            } else {
                errors.push('Fetch API not available');
            }

            // Test DNS resolution (if available)
            if (typeof (globalThis as any).navigator !== 'undefined' &&
                (globalThis as any).navigator.connection) {
                const connection = (globalThis as any).navigator.connection;
                metrics.effectiveType = connection.effectiveType || 'unknown';
                metrics.downlink = connection.downlink || 0;
                metrics.rtt = connection.rtt || 0;
            }

            const duration = Date.now() - startTime;

            return {
                testId: 'network-connectivity',
                status: errors.length === 0 ? TestStatus.PASS : TestStatus.FAIL,
                message: errors.length === 0
                    ? 'Network connectivity is functioning normally'
                    : `Network connectivity issues: ${errors.join(', ')}`,
                duration,
                timestamp: new Date(),
                details: {
                    fetchSupported: typeof fetch !== 'undefined',
                    connectionInfo: typeof (globalThis as any).navigator?.connection !== 'undefined'
                },
                metrics,
                errors: errors.length > 0 ? errors : undefined,
                recommendations: errors.length > 0 ? [
                    'Check internet connectivity',
                    'Verify firewall settings',
                    'Review proxy configuration'
                ] : undefined
            };

        } catch (error) {
            return {
                testId: 'network-connectivity',
                status: TestStatus.FAIL,
                message: `Network connectivity test failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }
}

/**
 * Configuration validation diagnostics
 */
export class ConfigurationDiagnostics {
    /**
     * Test system configuration
     */
    static async testConfiguration(context: DiagnosticContext): Promise<TestResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const metrics: Record<string, number> = {};

        try {
            // Check FX configuration
            const configNode = context.fx.proxy('config');
            const config = configNode.val();

            if (!config) {
                errors.push('System configuration not found');
            } else {
                metrics.configSize = JSON.stringify(config).length;
            }

            // Check system configuration
            const systemNode = context.fx.proxy('system');
            const systemConfig = systemNode.val();

            if (!systemConfig) {
                warnings.push('System configuration not initialized');
            }

            // Validate required system components
            const requiredComponents = [
                'errorHandling',
                'performance',
                'security',
                'recovery'
            ];

            let componentsFound = 0;
            for (const component of requiredComponents) {
                const componentNode = context.fx.proxy(`system.${component}`);
                const componentConfig = componentNode.val();
                if (componentConfig) {
                    componentsFound++;
                } else {
                    warnings.push(`System component '${component}' not configured`);
                }
            }

            metrics.componentsFound = componentsFound;
            metrics.componentsRequired = requiredComponents.length;
            metrics.configurationCompleteness = (componentsFound / requiredComponents.length) * 100;

            // Check environment variables (if available)
            if (typeof process !== 'undefined' && process.env) {
                const envVars = Object.keys(process.env);
                metrics.environmentVariables = envVars.length;

                // Check for common configuration env vars
                const commonEnvVars = ['NODE_ENV', 'PORT', 'DEBUG'];
                const foundEnvVars = commonEnvVars.filter(env => process.env[env]);
                metrics.commonEnvVarsFound = foundEnvVars.length;
            }

            const duration = Date.now() - startTime;

            let status = TestStatus.PASS;
            let message = 'System configuration is valid';

            if (errors.length > 0) {
                status = TestStatus.FAIL;
                message = `Configuration errors: ${errors.join(', ')}`;
            } else if (warnings.length > 0) {
                status = TestStatus.WARNING;
                message = `Configuration warnings: ${warnings.join(', ')}`;
            }

            return {
                testId: 'configuration-validation',
                status,
                message,
                duration,
                timestamp: new Date(),
                details: {
                    configFound: !!config,
                    systemConfigFound: !!systemConfig,
                    componentsStatus: Object.fromEntries(
                        requiredComponents.map(comp => [
                            comp,
                            !!context.fx.proxy(`system.${comp}`).val()
                        ])
                    )
                },
                metrics,
                errors: errors.length > 0 ? errors : undefined,
                recommendations: [
                    ...errors.map(error => `Fix: ${error}`),
                    ...warnings.map(warning => `Address: ${warning}`)
                ].filter(Boolean)
            };

        } catch (error) {
            return {
                testId: 'configuration-validation',
                status: TestStatus.FAIL,
                message: `Configuration validation failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }
}

/**
 * Comprehensive diagnostic manager
 */
export class DiagnosticManager {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private performanceManager?: PerformanceMonitoringManager;
    private integrityManager?: DataIntegrityManager;
    private securityManager?: SecurityHardeningManager;

    private tests = new Map<string, DiagnosticTest>();
    private reports: DiagnosticReport[] = [];
    private issuePatterns: IssuePattern[] = [];

    constructor(
        fx: FXCore,
        errorManager?: ErrorHandlingManager,
        performanceManager?: PerformanceMonitoringManager,
        integrityManager?: DataIntegrityManager,
        securityManager?: SecurityHardeningManager
    ) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.performanceManager = performanceManager;
        this.integrityManager = integrityManager;
        this.securityManager = securityManager;

        this.initializeDiagnostics();
        this.registerDefaultTests();
        this.initializeIssuePatterns();
    }

    /**
     * Initialize diagnostic system
     */
    private initializeDiagnostics(): void {
        const diagnosticsNode = this.fx.proxy('system.diagnostics');
        diagnosticsNode.val({
            manager: this,
            tests: new Map(),
            reports: [],
            lastRun: null,
            isRunning: false
        });

        console.log('Diagnostic system initialized');
    }

    /**
     * Register default diagnostic tests
     */
    private registerDefaultTests(): void {
        // System health tests
        this.registerTest({
            id: 'system-basic-functionality',
            name: 'Basic System Functionality',
            type: DiagnosticTestType.SYSTEM_HEALTH,
            description: 'Tests basic FX system operations',
            severity: TestSeverity.CRITICAL,
            enabled: true,
            timeout: 30000,
            run: SystemHealthDiagnostics.testBasicFunctionality
        });

        this.registerTest({
            id: 'memory-health',
            name: 'Memory Health Check',
            type: DiagnosticTestType.MEMORY,
            description: 'Analyzes memory usage and allocation',
            severity: TestSeverity.ERROR,
            enabled: true,
            timeout: 30000,
            run: SystemHealthDiagnostics.testMemoryHealth
        });

        this.registerTest({
            id: 'storage-health',
            name: 'Storage Health Check',
            type: DiagnosticTestType.STORAGE,
            description: 'Tests storage read/write operations',
            severity: TestSeverity.ERROR,
            enabled: true,
            timeout: 30000,
            run: SystemHealthDiagnostics.testStorageHealth
        });

        // Performance tests
        this.registerTest({
            id: 'operation-performance',
            name: 'Operation Performance Test',
            type: DiagnosticTestType.PERFORMANCE,
            description: 'Measures operation execution times',
            severity: TestSeverity.WARNING,
            enabled: true,
            timeout: 60000,
            run: PerformanceDiagnostics.testOperationPerformance
        });

        this.registerTest({
            id: 'concurrent-performance',
            name: 'Concurrent Performance Test',
            type: DiagnosticTestType.PERFORMANCE,
            description: 'Tests concurrent operation handling',
            severity: TestSeverity.WARNING,
            enabled: true,
            timeout: 60000,
            run: PerformanceDiagnostics.testConcurrentPerformance
        });

        // Network tests
        this.registerTest({
            id: 'network-connectivity',
            name: 'Network Connectivity Test',
            type: DiagnosticTestType.CONNECTIVITY,
            description: 'Tests network connectivity and performance',
            severity: TestSeverity.WARNING,
            enabled: true,
            timeout: 30000,
            run: ConnectivityDiagnostics.testNetworkConnectivity
        });

        // Configuration tests
        this.registerTest({
            id: 'configuration-validation',
            name: 'Configuration Validation',
            type: DiagnosticTestType.CONFIGURATION,
            description: 'Validates system configuration',
            severity: TestSeverity.ERROR,
            enabled: true,
            timeout: 30000,
            run: ConfigurationDiagnostics.testConfiguration
        });
    }

    /**
     * Initialize issue patterns for automated troubleshooting
     */
    private initializeIssuePatterns(): void {
        this.issuePatterns = [
            {
                id: 'memory-leak',
                name: 'Memory Leak Detection',
                symptoms: [
                    { type: 'performance', pattern: 'memory.*high', threshold: 80 },
                    { type: 'error', pattern: 'out.*memory' }
                ],
                confidence: 0.8,
                resolution: {
                    steps: [
                        'Run memory diagnostics',
                        'Identify memory-intensive operations',
                        'Implement memory leak detection',
                        'Optimize memory usage patterns'
                    ],
                    commands: [
                        'diagnostics.runTest("memory-health")',
                        'performance.getMemoryProfile()'
                    ]
                }
            },
            {
                id: 'slow-performance',
                name: 'Performance Degradation',
                symptoms: [
                    { type: 'performance', pattern: 'slow.*operation', threshold: 1000 },
                    { type: 'performance', pattern: 'high.*latency' }
                ],
                confidence: 0.7,
                resolution: {
                    steps: [
                        'Run performance diagnostics',
                        'Identify bottlenecks',
                        'Optimize critical operations',
                        'Consider caching strategies'
                    ],
                    commands: [
                        'diagnostics.runTest("operation-performance")',
                        'diagnostics.runTest("concurrent-performance")'
                    ]
                }
            },
            {
                id: 'configuration-issues',
                name: 'Configuration Problems',
                symptoms: [
                    { type: 'error', pattern: 'config.*not.*found' },
                    { type: 'error', pattern: 'invalid.*configuration' }
                ],
                confidence: 0.9,
                resolution: {
                    steps: [
                        'Validate configuration files',
                        'Check environment variables',
                        'Verify component initialization',
                        'Reset to default configuration if needed'
                    ],
                    commands: [
                        'diagnostics.runTest("configuration-validation")'
                    ]
                }
            }
        ];
    }

    /**
     * Register a diagnostic test
     */
    registerTest(test: DiagnosticTest): void {
        this.tests.set(test.id, test);
        console.log(`Registered diagnostic test: ${test.name}`);
    }

    /**
     * Run specific diagnostic test
     */
    async runTest(testId: string, parameters?: Record<string, any>): Promise<TestResult> {
        const test = this.tests.get(testId);
        if (!test) {
            throw new Error(`Diagnostic test not found: ${testId}`);
        }

        const context: DiagnosticContext = {
            fx: this.fx,
            errorManager: this.errorManager,
            performanceManager: this.performanceManager,
            integrityManager: this.integrityManager,
            securityManager: this.securityManager,
            parameters,
            environment: {
                platform: typeof process !== 'undefined' ? process.platform : 'browser',
                nodeVersion: typeof process !== 'undefined' ? process.version : undefined,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
            }
        };

        console.log(`Running diagnostic test: ${test.name}`);

        try {
            // Set timeout for test execution
            const timeoutPromise = new Promise<TestResult>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Test timeout: ${test.name}`));
                }, test.timeout);
            });

            const testPromise = test.run(context);
            const result = await Promise.race([testPromise, timeoutPromise]);

            console.log(`Diagnostic test completed: ${test.name} - ${result.status}`);
            return result;

        } catch (error) {
            console.error(`Diagnostic test failed: ${test.name}:`, error);

            return {
                testId: test.id,
                status: TestStatus.FAIL,
                message: `Test execution failed: ${error.message}`,
                duration: 0,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }

    /**
     * Run full diagnostic suite
     */
    async runFullDiagnostics(options?: {
        types?: DiagnosticTestType[];
        excludeTests?: string[];
        includeTests?: string[];
    }): Promise<DiagnosticReport> {
        const startTime = Date.now();
        const reportId = this.generateReportId();

        console.log('Starting full diagnostic suite...');

        // Filter tests based on options
        let testsToRun = Array.from(this.tests.values()).filter(test => test.enabled);

        if (options?.types) {
            testsToRun = testsToRun.filter(test => options.types!.includes(test.type));
        }

        if (options?.excludeTests) {
            testsToRun = testsToRun.filter(test => !options.excludeTests!.includes(test.id));
        }

        if (options?.includeTests) {
            testsToRun = testsToRun.filter(test => options.includeTests!.includes(test.id));
        }

        // Sort tests by severity (critical first)
        testsToRun.sort((a, b) => {
            const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        const results: TestResult[] = [];

        // Run tests
        for (const test of testsToRun) {
            try {
                const result = await this.runTest(test.id);
                results.push(result);
            } catch (error) {
                results.push({
                    testId: test.id,
                    status: TestStatus.FAIL,
                    message: `Test execution error: ${error.message}`,
                    duration: 0,
                    timestamp: new Date(),
                    errors: [error.message]
                });
            }
        }

        // Generate summary
        const summary = {
            totalTests: results.length,
            passed: results.filter(r => r.status === TestStatus.PASS).length,
            failed: results.filter(r => r.status === TestStatus.FAIL).length,
            warnings: results.filter(r => r.status === TestStatus.WARNING).length,
            skipped: results.filter(r => r.status === TestStatus.SKIP).length,
            criticalIssues: results.filter(r => r.status === TestStatus.FAIL &&
                testsToRun.find(t => t.id === r.testId)?.severity === TestSeverity.CRITICAL).length
        };

        // Collect all recommendations
        const recommendations = results
            .flatMap(r => r.recommendations || [])
            .filter((rec, index, arr) => arr.indexOf(rec) === index); // Remove duplicates

        // Get system info
        const systemInfo = await this.getSystemInfo();

        // Generate troubleshooting guide
        const troubleshootingGuide = this.generateTroubleshootingGuide(results);

        const duration = Date.now() - startTime;

        const report: DiagnosticReport = {
            id: reportId,
            timestamp: new Date(),
            duration,
            summary,
            tests: results,
            recommendations,
            systemInfo,
            troubleshootingGuide
        };

        // Store report
        this.reports.push(report);
        if (this.reports.length > 50) { // Keep last 50 reports
            this.reports.shift();
        }

        // Store in FX system
        const reportNode = this.fx.proxy(`system.diagnostics.reports.${reportId}`);
        reportNode.val(report);

        console.log(`Full diagnostics completed in ${duration}ms: ${summary.passed}/${summary.totalTests} tests passed`);

        return report;
    }

    /**
     * Get latest diagnostic report
     */
    getLatestReport(): DiagnosticReport | null {
        return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
    }

    /**
     * Get all diagnostic reports
     */
    getAllReports(): DiagnosticReport[] {
        return [...this.reports];
    }

    /**
     * Get system information
     */
    private async getSystemInfo(): Promise<DiagnosticReport['systemInfo']> {
        let memoryInfo: any = { total: 0, used: 0, free: 0 };

        if (typeof process !== 'undefined' && process.memoryUsage) {
            const mem = process.memoryUsage();
            memoryInfo = {
                total: mem.heapTotal,
                used: mem.heapUsed,
                free: mem.heapTotal - mem.heapUsed
            };
        } else if (typeof (performance as any).memory !== 'undefined') {
            memoryInfo = {
                total: (performance as any).memory.totalJSHeapSize,
                used: (performance as any).memory.usedJSHeapSize,
                free: (performance as any).memory.totalJSHeapSize - (performance as any).memory.usedJSHeapSize
            };
        }

        return {
            platform: typeof process !== 'undefined' ? process.platform : 'browser',
            memory: memoryInfo,
            performance: {
                uptime: typeof process !== 'undefined' ? process.uptime() * 1000 : Date.now(),
                loadAverage: typeof (globalThis as any).os?.loadavg === 'function'
                    ? (globalThis as any).os.loadavg()
                    : undefined
            }
        };
    }

    /**
     * Generate troubleshooting guide based on test results
     */
    private generateTroubleshootingGuide(results: TestResult[]): TroubleshootingGuide {
        const issues: TroubleshootingGuide['issues'] = [];

        // Analyze failed tests
        const failedTests = results.filter(r => r.status === TestStatus.FAIL);

        for (const test of failedTests) {
            // Match against known issue patterns
            for (const pattern of this.issuePatterns) {
                let matches = 0;
                for (const symptom of pattern.symptoms) {
                    const regex = new RegExp(symptom.pattern, 'i');
                    if (regex.test(test.message) ||
                        (test.errors && test.errors.some(error => regex.test(error)))) {
                        matches++;
                    }
                }

                if (matches > 0) {
                    const confidence = matches / pattern.symptoms.length;
                    if (confidence >= 0.5) { // 50% confidence threshold
                        issues.push({
                            category: test.testId,
                            problem: pattern.name,
                            symptoms: [test.message, ...(test.errors || [])],
                            causes: [`Based on test: ${test.testId}`],
                            solutions: pattern.resolution.steps.map((step, index) => ({
                                step: index + 1,
                                description: step,
                                command: pattern.resolution.commands?.[index],
                                expected: 'Issue should be resolved'
                            })),
                            prevention: [
                                'Run regular diagnostic checks',
                                'Monitor system metrics',
                                'Implement proper error handling'
                            ]
                        });
                    }
                }
            }
        }

        return { issues };
    }

    private generateReportId(): string {
        return `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Factory function to create diagnostic manager
 */
export function createDiagnosticManager(
    fx: FXCore,
    errorManager?: ErrorHandlingManager,
    performanceManager?: PerformanceMonitoringManager,
    integrityManager?: DataIntegrityManager,
    securityManager?: SecurityHardeningManager
): DiagnosticManager {
    const manager = new DiagnosticManager(
        fx,
        errorManager,
        performanceManager,
        integrityManager,
        securityManager
    );

    // Attach to FX system
    const diagnosticsNode = fx.proxy('system.diagnostics');
    diagnosticsNode.val({
        manager,
        runTest: manager.runTest.bind(manager),
        runFullDiagnostics: manager.runFullDiagnostics.bind(manager),
        getLatestReport: manager.getLatestReport.bind(manager),
        getAllReports: manager.getAllReports.bind(manager),
        registerTest: manager.registerTest.bind(manager)
    });

    return manager;
}

export default {
    DiagnosticManager,
    SystemHealthDiagnostics,
    PerformanceDiagnostics,
    ConnectivityDiagnostics,
    ConfigurationDiagnostics,
    DiagnosticTestType,
    TestSeverity,
    TestStatus,
    createDiagnosticManager
};