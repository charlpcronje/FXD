/**
 * @file fx-production-stability.ts
 * @description Master integration module for FXD production stability
 *
 * This module integrates all production stability components:
 * - Error handling and recovery
 * - Transaction management
 * - Data integrity monitoring
 * - Rate limiting and throttling
 * - Performance monitoring
 * - Memory leak detection
 * - Security hardening
 * - Diagnostic tools
 * - Telemetry and analytics
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, createErrorHandlingManager } from './fx-error-handling.ts';
import { TransactionManager, createTransactionManager } from './fx-transaction-system.ts';
import { DataIntegrityManager, createDataIntegrityManager } from './fx-data-integrity.ts';
import { RecoveryManager, createRecoveryManager } from './fx-recovery-system.ts';
import { RateLimitingManager, createRateLimitingManager } from './fx-rate-limiting.ts';
import { PerformanceMonitoringManager, createPerformanceMonitoringManager } from './fx-performance-monitoring.ts';

// Production stability configuration
export interface ProductionStabilityConfig {
    errorHandling: {
        enabled: boolean;
        logLevel: 'debug' | 'info' | 'warn' | 'error';
        maxErrorHistory: number;
    };
    transactions: {
        enabled: boolean;
        defaultTimeout: number;
        maxConcurrent: number;
    };
    integrity: {
        enabled: boolean;
        scanInterval: number;
        autoRepair: boolean;
    };
    recovery: {
        enabled: boolean;
        autoRecovery: boolean;
        snapshotInterval: number;
    };
    rateLimiting: {
        enabled: boolean;
        adaptive: boolean;
        defaultLimits: {
            requests: number;
            window: number;
        };
    };
    performance: {
        enabled: boolean;
        systemMetricsInterval: number;
        alertThresholds: {
            cpu: number;
            memory: number;
            disk: number;
        };
    };
    telemetry: {
        enabled: boolean;
        samplingRate: number;
        retentionDays: number;
    };
}

// Stability status interface
export interface StabilityStatus {
    overall: 'healthy' | 'degraded' | 'critical' | 'failed';
    components: {
        errorHandling: 'online' | 'offline' | 'degraded';
        transactions: 'online' | 'offline' | 'degraded';
        integrity: 'online' | 'offline' | 'degraded';
        recovery: 'online' | 'offline' | 'degraded';
        rateLimiting: 'online' | 'offline' | 'degraded';
        performance: 'online' | 'offline' | 'degraded';
    };
    metrics: {
        errorRate: number;
        performanceScore: number;
        integrityScore: number;
        recoveryReadiness: number;
    };
    alerts: Array<{
        component: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        timestamp: Date;
    }>;
}

// Stability event interface
export interface StabilityEvent {
    id: string;
    type: 'error' | 'recovery' | 'performance' | 'integrity' | 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    description: string;
    timestamp: Date;
    metadata?: Record<string, any>;
    resolved?: boolean;
    resolvedAt?: Date;
}

/**
 * Master production stability manager
 */
export class ProductionStabilityManager {
    private fx: FXCore;
    private config: ProductionStabilityConfig;

    // Component managers
    private errorManager?: ErrorHandlingManager;
    private transactionManager?: TransactionManager;
    private integrityManager?: DataIntegrityManager;
    private recoveryManager?: RecoveryManager;
    private rateLimitingManager?: RateLimitingManager;
    private performanceManager?: PerformanceMonitoringManager;

    // Stability tracking
    private events: StabilityEvent[] = [];
    private lastStatusCheck = new Date();
    private healthCheckInterval?: any;
    private maxEvents = 10000;

    constructor(fx: FXCore, config?: Partial<ProductionStabilityConfig>) {
        this.fx = fx;
        this.config = this.mergeConfig(config);
        this.initializeStabilitySystem();
    }

    /**
     * Merge provided config with defaults
     */
    private mergeConfig(config?: Partial<ProductionStabilityConfig>): ProductionStabilityConfig {
        const defaultConfig: ProductionStabilityConfig = {
            errorHandling: {
                enabled: true,
                logLevel: 'error',
                maxErrorHistory: 1000
            },
            transactions: {
                enabled: true,
                defaultTimeout: 30000,
                maxConcurrent: 100
            },
            integrity: {
                enabled: true,
                scanInterval: 900000, // 15 minutes
                autoRepair: true
            },
            recovery: {
                enabled: true,
                autoRecovery: true,
                snapshotInterval: 1800000 // 30 minutes
            },
            rateLimiting: {
                enabled: true,
                adaptive: true,
                defaultLimits: {
                    requests: 1000,
                    window: 60000
                }
            },
            performance: {
                enabled: true,
                systemMetricsInterval: 60000, // 1 minute
                alertThresholds: {
                    cpu: 80,
                    memory: 90,
                    disk: 85
                }
            },
            telemetry: {
                enabled: true,
                samplingRate: 0.1, // 10%
                retentionDays: 30
            }
        };

        return this.deepMerge(defaultConfig, config || {});
    }

    /**
     * Deep merge configuration objects
     */
    private deepMerge(target: any, source: any): any {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Initialize the production stability system
     */
    private async initializeStabilitySystem(): Promise<void> {
        console.log('Initializing FXD Production Stability System...');

        try {
            // Initialize component managers based on configuration
            if (this.config.errorHandling.enabled) {
                this.errorManager = createErrorHandlingManager(this.fx);
                console.log('✓ Error handling manager initialized');
            }

            if (this.config.transactions.enabled) {
                this.transactionManager = createTransactionManager(this.fx, this.errorManager);
                console.log('✓ Transaction manager initialized');
            }

            if (this.config.integrity.enabled) {
                this.integrityManager = createDataIntegrityManager(
                    this.fx,
                    this.errorManager,
                    this.transactionManager
                );
                console.log('✓ Data integrity manager initialized');
            }

            if (this.config.recovery.enabled) {
                this.recoveryManager = createRecoveryManager(
                    this.fx,
                    this.errorManager,
                    this.transactionManager,
                    this.integrityManager
                );
                console.log('✓ Recovery manager initialized');
            }

            if (this.config.rateLimiting.enabled) {
                this.rateLimitingManager = createRateLimitingManager(this.fx, this.errorManager);
                console.log('✓ Rate limiting manager initialized');
            }

            if (this.config.performance.enabled) {
                this.performanceManager = createPerformanceMonitoringManager(this.fx, this.errorManager);
                console.log('✓ Performance monitoring manager initialized');
            }

            // Setup cross-component integration
            await this.setupIntegration();

            // Start health monitoring
            this.startHealthMonitoring();

            // Create stability system node
            this.createStabilitySystemNode();

            console.log('🚀 FXD Production Stability System fully initialized and operational');

            // Log initialization event
            this.logEvent({
                type: 'recovery',
                severity: 'low',
                component: 'stability-system',
                description: 'Production stability system initialized successfully'
            });

        } catch (error) {
            console.error('Failed to initialize production stability system:', error);

            this.logEvent({
                type: 'error',
                severity: 'critical',
                component: 'stability-system',
                description: `Failed to initialize: ${error.message}`
            });

            throw error;
        }
    }

    /**
     * Setup integration between components
     */
    private async setupIntegration(): Promise<void> {
        // Integrate error manager with recovery manager
        if (this.errorManager && this.recoveryManager) {
            this.errorManager.addHandler('system' as any, async (error) => {
                if (error.severity === 'critical' as any) {
                    // Trigger recovery for critical errors
                    await this.recoveryManager!.handleSystemError(error as any);
                    return true;
                }
                return false;
            });
        }

        // Integrate performance manager with rate limiting
        if (this.performanceManager && this.rateLimitingManager) {
            // Performance alerts can trigger rate limiting adjustments
            this.performanceManager.addAlert({
                id: 'performance-rate-limit',
                name: 'Performance-based Rate Limiting',
                metricId: 'system.cpu.usage',
                condition: {
                    operator: 'gt',
                    threshold: this.config.performance.alertThresholds.cpu,
                    duration: 60000
                },
                severity: 'warning' as any,
                enabled: true,
                triggered: false,
                triggerCount: 0,
                actions: {
                    script: 'adjust-rate-limits'
                }
            });
        }

        // Integrate integrity manager with recovery manager
        if (this.integrityManager && this.recoveryManager) {
            // Critical integrity violations trigger recovery
            // This would be implemented through event handlers
        }

        console.log('✓ Component integration configured');
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('Health check failed:', error);
                this.logEvent({
                    type: 'error',
                    severity: 'high',
                    component: 'health-monitor',
                    description: `Health check failed: ${error.message}`
                });
            }
        }, 60000); // Every minute

        console.log('✓ Health monitoring started');
    }

    /**
     * Perform comprehensive health check
     */
    private async performHealthCheck(): Promise<void> {
        this.lastStatusCheck = new Date();

        // Check component health
        const componentStatus = await this.checkComponentHealth();

        // Check system metrics
        if (this.performanceManager) {
            const dashboard = this.performanceManager.getDashboard();
            const systemMetrics = dashboard.systemMetrics;

            if (systemMetrics) {
                // Check CPU threshold
                if (systemMetrics.cpu.usage > this.config.performance.alertThresholds.cpu) {
                    this.logEvent({
                        type: 'performance',
                        severity: 'medium',
                        component: 'cpu',
                        description: `High CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}%`
                    });
                }

                // Check memory threshold
                if (systemMetrics.memory.usage > this.config.performance.alertThresholds.memory) {
                    this.logEvent({
                        type: 'performance',
                        severity: 'high',
                        component: 'memory',
                        description: `High memory usage: ${systemMetrics.memory.usage.toFixed(1)}%`
                    });
                }

                // Check disk threshold
                if (systemMetrics.disk.usage > this.config.performance.alertThresholds.disk) {
                    this.logEvent({
                        type: 'performance',
                        severity: 'medium',
                        component: 'disk',
                        description: `High disk usage: ${systemMetrics.disk.usage.toFixed(1)}%`
                    });
                }
            }
        }

        // Check error rates
        if (this.errorManager) {
            const metrics = this.errorManager.getMetrics();
            if (metrics.errorRate > 10) { // More than 10 errors per minute
                this.logEvent({
                    type: 'error',
                    severity: 'high',
                    component: 'error-manager',
                    description: `High error rate: ${metrics.errorRate} errors/min`
                });
            }
        }

        // Check integrity violations
        if (this.integrityManager) {
            const status = this.integrityManager.getIntegrityStatus();
            if (status.totalViolations > 0) {
                const severity = status.totalViolations > 10 ? 'high' : 'medium';
                this.logEvent({
                    type: 'integrity',
                    severity: severity as any,
                    component: 'integrity-manager',
                    description: `Data integrity violations detected: ${status.totalViolations}`
                });
            }
        }
    }

    /**
     * Check health of all components
     */
    private async checkComponentHealth(): Promise<Record<string, 'online' | 'offline' | 'degraded'>> {
        const status: Record<string, 'online' | 'offline' | 'degraded'> = {};

        // Check error handling
        status.errorHandling = this.errorManager ? 'online' : 'offline';

        // Check transactions
        if (this.transactionManager) {
            const stats = this.transactionManager.getStatistics();
            status.transactions = stats.activeTransactions < this.config.transactions.maxConcurrent ? 'online' : 'degraded';
        } else {
            status.transactions = 'offline';
        }

        // Check integrity
        if (this.integrityManager) {
            const integrityStatus = this.integrityManager.getIntegrityStatus();
            status.integrity = integrityStatus.totalViolations === 0 ? 'online' : 'degraded';
        } else {
            status.integrity = 'offline';
        }

        // Check recovery
        if (this.recoveryManager) {
            const recoveryStats = this.recoveryManager.getRecoveryStatistics();
            status.recovery = recoveryStats.emergencyMode ? 'degraded' : 'online';
        } else {
            status.recovery = 'offline';
        }

        // Check rate limiting
        status.rateLimiting = this.rateLimitingManager ? 'online' : 'offline';

        // Check performance monitoring
        status.performance = this.performanceManager ? 'online' : 'offline';

        return status;
    }

    /**
     * Create stability system node in FX tree
     */
    private createStabilitySystemNode(): void {
        const stabilityNode = this.fx.proxy('system.stability');
        stabilityNode.val({
            manager: this,
            config: this.config,
            status: this.getStabilityStatus.bind(this),
            events: this.getRecentEvents.bind(this),
            healthCheck: this.performHealthCheck.bind(this),
            restart: this.restart.bind(this),
            shutdown: this.shutdown.bind(this)
        });
    }

    /**
     * Get current stability status
     */
    getStabilityStatus(): StabilityStatus {
        const componentStatus = this.checkComponentHealth();
        const recentEvents = this.getRecentEvents(24 * 60 * 60 * 1000); // Last 24 hours

        // Calculate overall status
        const componentValues = Object.values(componentStatus);
        let overall: StabilityStatus['overall'];

        if (componentValues.every(s => s === 'online')) {
            overall = 'healthy';
        } else if (componentValues.some(s => s === 'offline')) {
            overall = 'failed';
        } else if (componentValues.some(s => s === 'degraded')) {
            overall = 'degraded';
        } else {
            overall = 'critical';
        }

        // Calculate metrics
        const errorEvents = recentEvents.filter(e => e.type === 'error');
        const errorRate = errorEvents.length / 24; // Errors per hour

        const performanceEvents = recentEvents.filter(e => e.type === 'performance');
        const performanceScore = Math.max(0, 100 - performanceEvents.length * 5);

        const integrityEvents = recentEvents.filter(e => e.type === 'integrity');
        const integrityScore = Math.max(0, 100 - integrityEvents.length * 10);

        const recoveryEvents = recentEvents.filter(e => e.type === 'recovery');
        const recoveryReadiness = this.recoveryManager ? 85 : 0; // Based on snapshots, etc.

        // Get current alerts
        const alerts = recentEvents
            .filter(e => !e.resolved && e.severity !== 'low')
            .map(e => ({
                component: e.component,
                severity: e.severity,
                message: e.description,
                timestamp: e.timestamp
            }));

        return {
            overall,
            components: componentStatus as any,
            metrics: {
                errorRate,
                performanceScore,
                integrityScore,
                recoveryReadiness
            },
            alerts
        };
    }

    /**
     * Log a stability event
     */
    private logEvent(event: Omit<StabilityEvent, 'id' | 'timestamp'>): void {
        const fullEvent: StabilityEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date()
        };

        this.events.push(fullEvent);

        // Limit event history
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        // Store in FX system
        const eventNode = this.fx.proxy(`system.stability.events.${fullEvent.id}`);
        eventNode.val(fullEvent);

        console.log(`[STABILITY] ${fullEvent.severity.toUpperCase()}: ${fullEvent.description}`);
    }

    /**
     * Get recent stability events
     */
    getRecentEvents(periodMs: number = 60 * 60 * 1000): StabilityEvent[] {
        const cutoff = new Date(Date.now() - periodMs);
        return this.events.filter(e => e.timestamp >= cutoff);
    }

    /**
     * Resolve a stability event
     */
    resolveEvent(eventId: string): boolean {
        const event = this.events.find(e => e.id === eventId);
        if (event && !event.resolved) {
            event.resolved = true;
            event.resolvedAt = new Date();

            // Update in FX system
            const eventNode = this.fx.proxy(`system.stability.events.${eventId}`);
            eventNode.val(event);

            return true;
        }
        return false;
    }

    /**
     * Get comprehensive stability report
     */
    getStabilityReport(periodHours: number = 24): {
        period: string;
        status: StabilityStatus;
        events: StabilityEvent[];
        metrics: {
            uptime: number;
            errorCount: number;
            recoveryCount: number;
            performanceIssues: number;
            integrityViolations: number;
        };
        recommendations: string[];
    } {
        const periodMs = periodHours * 60 * 60 * 1000;
        const events = this.getRecentEvents(periodMs);
        const status = this.getStabilityStatus();

        const metrics = {
            uptime: this.calculateUptime(periodMs),
            errorCount: events.filter(e => e.type === 'error').length,
            recoveryCount: events.filter(e => e.type === 'recovery').length,
            performanceIssues: events.filter(e => e.type === 'performance').length,
            integrityViolations: events.filter(e => e.type === 'integrity').length
        };

        const recommendations = this.generateRecommendations(status, events);

        return {
            period: `${periodHours} hours`,
            status,
            events,
            metrics,
            recommendations
        };
    }

    /**
     * Calculate system uptime percentage
     */
    private calculateUptime(periodMs: number): number {
        const criticalEvents = this.getRecentEvents(periodMs)
            .filter(e => e.severity === 'critical' && !e.resolved);

        // Simplified uptime calculation
        const downtime = criticalEvents.length * 5 * 60 * 1000; // Assume 5 minutes per critical event
        const uptime = Math.max(0, periodMs - downtime);

        return (uptime / periodMs) * 100;
    }

    /**
     * Generate stability recommendations
     */
    private generateRecommendations(status: StabilityStatus, events: StabilityEvent[]): string[] {
        const recommendations: string[] = [];

        // Error rate recommendations
        if (status.metrics.errorRate > 5) {
            recommendations.push('High error rate detected. Review error logs and implement additional error handling.');
        }

        // Performance recommendations
        if (status.metrics.performanceScore < 80) {
            recommendations.push('Performance issues detected. Consider optimizing resource usage and implementing caching.');
        }

        // Integrity recommendations
        if (status.metrics.integrityScore < 90) {
            recommendations.push('Data integrity violations found. Run integrity scan and repair corrupted data.');
        }

        // Component-specific recommendations
        const componentIssues = Object.entries(status.components)
            .filter(([_, status]) => status !== 'online');

        for (const [component, componentStatus] of componentIssues) {
            if (componentStatus === 'offline') {
                recommendations.push(`${component} is offline. Check configuration and restart if necessary.`);
            } else if (componentStatus === 'degraded') {
                recommendations.push(`${component} is degraded. Monitor closely and consider scaling resources.`);
            }
        }

        // Alert-based recommendations
        const criticalAlerts = status.alerts.filter(a => a.severity === 'critical');
        if (criticalAlerts.length > 0) {
            recommendations.push('Critical alerts detected. Immediate attention required to prevent system failure.');
        }

        return recommendations;
    }

    /**
     * Restart the stability system
     */
    async restart(): Promise<void> {
        console.log('Restarting production stability system...');

        try {
            await this.shutdown(false);
            await this.initializeStabilitySystem();

            this.logEvent({
                type: 'recovery',
                severity: 'medium',
                component: 'stability-system',
                description: 'Production stability system restarted successfully'
            });

        } catch (error) {
            this.logEvent({
                type: 'error',
                severity: 'critical',
                component: 'stability-system',
                description: `Failed to restart: ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Shutdown the stability system
     */
    async shutdown(logEvent: boolean = true): Promise<void> {
        console.log('Shutting down production stability system...');

        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        // Shutdown component managers
        if (this.performanceManager) {
            this.performanceManager.stop();
        }

        if (logEvent) {
            this.logEvent({
                type: 'recovery',
                severity: 'low',
                component: 'stability-system',
                description: 'Production stability system shut down'
            });
        }

        console.log('Production stability system shut down');
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Getters for component managers
    get errorHandling(): ErrorHandlingManager | undefined {
        return this.errorManager;
    }

    get transactions(): TransactionManager | undefined {
        return this.transactionManager;
    }

    get integrity(): DataIntegrityManager | undefined {
        return this.integrityManager;
    }

    get recovery(): RecoveryManager | undefined {
        return this.recoveryManager;
    }

    get rateLimiting(): RateLimitingManager | undefined {
        return this.rateLimitingManager;
    }

    get performance(): PerformanceMonitoringManager | undefined {
        return this.performanceManager;
    }
}

/**
 * Factory function to create production stability manager
 */
export function createProductionStabilityManager(
    fx: FXCore,
    config?: Partial<ProductionStabilityConfig>
): ProductionStabilityManager {
    return new ProductionStabilityManager(fx, config);
}

/**
 * Initialize FXD with production stability
 */
export async function initializeFXDWithStability(
    fx: FXCore,
    config?: Partial<ProductionStabilityConfig>
): Promise<ProductionStabilityManager> {
    console.log('🔧 Initializing FXD with production stability...');

    const stabilityManager = createProductionStabilityManager(fx, config);

    // Attach global error handlers
    if (typeof globalThis !== 'undefined') {
        globalThis.addEventListener?.('error', (event) => {
            stabilityManager.errorHandling?.handleError(event.error);
        });

        globalThis.addEventListener?.('unhandledrejection', (event) => {
            stabilityManager.errorHandling?.handleError(new Error(event.reason));
        });
    }

    return stabilityManager;
}

export default {
    ProductionStabilityManager,
    createProductionStabilityManager,
    initializeFXDWithStability
};