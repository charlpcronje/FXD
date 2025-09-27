/**
 * @file fx-performance-monitoring.ts
 * @description Comprehensive performance monitoring system for FXD
 *
 * Provides advanced performance monitoring including:
 * - Real-time performance metrics collection
 * - Resource utilization tracking (CPU, memory, disk, network)
 * - Operation-level performance profiling
 * - Performance bottleneck detection
 * - Alerting and threshold management
 * - Historical trend analysis
 * - Performance optimization recommendations
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, FXDError, ErrorCode, ErrorCategory, ErrorSeverity } from './fx-error-handling.ts';

// Performance metric types
export enum MetricType {
    COUNTER = 'counter',
    GAUGE = 'gauge',
    HISTOGRAM = 'histogram',
    TIMER = 'timer',
    RATE = 'rate'
}

// Metric categories
export enum MetricCategory {
    SYSTEM = 'system',
    APPLICATION = 'application',
    NETWORK = 'network',
    DATABASE = 'database',
    USER_EXPERIENCE = 'user_experience',
    BUSINESS = 'business'
}

// Alert severity levels
export enum AlertSeverity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical',
    EMERGENCY = 'emergency'
}

// Performance metric interface
export interface PerformanceMetric {
    id: string;
    name: string;
    type: MetricType;
    category: MetricCategory;
    value: number;
    unit: string;
    timestamp: Date;
    tags?: Record<string, string>;
    metadata?: Record<string, any>;
}

// Metric aggregation interface
export interface MetricAggregation {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
    percentiles: {
        p50: number;
        p90: number;
        p95: number;
        p99: number;
    };
}

// Performance alert interface
export interface PerformanceAlert {
    id: string;
    name: string;
    metricId: string;
    condition: {
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
        threshold: number;
        duration?: number; // Duration in ms before triggering
    };
    severity: AlertSeverity;
    enabled: boolean;
    triggered: boolean;
    triggeredAt?: Date;
    lastTriggered?: Date;
    triggerCount: number;
    actions?: {
        notify?: string[];
        script?: string;
        webhook?: string;
    };
}

// System resource metrics interface
export interface SystemMetrics {
    cpu: {
        usage: number; // Percentage
        loadAverage: number[];
        cores: number;
    };
    memory: {
        total: number; // Bytes
        used: number;
        free: number;
        usage: number; // Percentage
        heap?: {
            total: number;
            used: number;
            external: number;
        };
    };
    disk: {
        total: number;
        used: number;
        free: number;
        usage: number; // Percentage
        ioRate: number; // Operations per second
    };
    network: {
        bytesIn: number;
        bytesOut: number;
        packetsIn: number;
        packetsOut: number;
        errors: number;
    };
}

// Operation performance profile
export interface OperationProfile {
    operation: string;
    count: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    errorCount: number;
    errorRate: number;
    lastExecuted: Date;
    samples: Array<{
        duration: number;
        timestamp: Date;
        success: boolean;
        metadata?: Record<string, any>;
    }>;
}

// Performance baseline interface
export interface PerformanceBaseline {
    metricId: string;
    period: 'hour' | 'day' | 'week' | 'month';
    baseline: MetricAggregation;
    confidence: number; // 0-1
    calculatedAt: Date;
    validUntil: Date;
}

// Performance recommendation interface
export interface PerformanceRecommendation {
    id: string;
    type: 'optimization' | 'scaling' | 'configuration' | 'architecture';
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    metrics: string[];
    actions: string[];
    estimatedImprovement: string;
    createdAt: Date;
}

/**
 * Performance metrics collector
 */
export class MetricsCollector {
    private metrics = new Map<string, PerformanceMetric[]>();
    private maxSamplesPerMetric = 10000;
    private retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Record a performance metric
     */
    record(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
        const fullMetric: PerformanceMetric = {
            ...metric,
            id: this.generateMetricId(metric.name, metric.tags),
            timestamp: new Date()
        };

        if (!this.metrics.has(fullMetric.name)) {
            this.metrics.set(fullMetric.name, []);
        }

        const samples = this.metrics.get(fullMetric.name)!;
        samples.push(fullMetric);

        // Limit sample size
        if (samples.length > this.maxSamplesPerMetric) {
            samples.shift();
        }

        // Clean up old samples
        this.cleanupOldSamples(fullMetric.name);
    }

    /**
     * Get metric samples
     */
    getMetrics(name: string, since?: Date): PerformanceMetric[] {
        const samples = this.metrics.get(name) || [];

        if (since) {
            return samples.filter(m => m.timestamp >= since);
        }

        return [...samples];
    }

    /**
     * Get metric aggregation
     */
    getAggregation(name: string, since?: Date): MetricAggregation | null {
        const samples = this.getMetrics(name, since);

        if (samples.length === 0) return null;

        const values = samples.map(m => m.value).sort((a, b) => a - b);

        return {
            min: values[0],
            max: values[values.length - 1],
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            sum: values.reduce((sum, v) => sum + v, 0),
            count: values.length,
            percentiles: {
                p50: this.percentile(values, 0.5),
                p90: this.percentile(values, 0.9),
                p95: this.percentile(values, 0.95),
                p99: this.percentile(values, 0.99)
            }
        };
    }

    /**
     * Get all metric names
     */
    getMetricNames(): string[] {
        return Array.from(this.metrics.keys());
    }

    /**
     * Clear metrics
     */
    clear(name?: string): void {
        if (name) {
            this.metrics.delete(name);
        } else {
            this.metrics.clear();
        }
    }

    private generateMetricId(name: string, tags?: Record<string, string>): string {
        const tagString = tags ? Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',') : '';
        return `${name}${tagString ? `{${tagString}}` : ''}@${Date.now()}`;
    }

    private cleanupOldSamples(name: string): void {
        const samples = this.metrics.get(name);
        if (!samples) return;

        const cutoff = new Date(Date.now() - this.retentionPeriod);
        const filtered = samples.filter(m => m.timestamp >= cutoff);

        if (filtered.length !== samples.length) {
            this.metrics.set(name, filtered);
        }
    }

    private percentile(values: number[], p: number): number {
        const index = (values.length - 1) * p;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);

        if (lower === upper) {
            return values[lower];
        }

        const weight = index - lower;
        return values[lower] * (1 - weight) + values[upper] * weight;
    }
}

/**
 * Operation profiler with timing and error tracking
 */
export class OperationProfiler {
    private profiles = new Map<string, OperationProfile>();
    private activeOperations = new Map<string, { startTime: Date; metadata?: Record<string, any> }>();

    /**
     * Start timing an operation
     */
    startOperation(operationId: string, operation: string, metadata?: Record<string, any>): void {
        this.activeOperations.set(operationId, {
            startTime: new Date(),
            metadata
        });
    }

    /**
     * End timing an operation
     */
    endOperation(operationId: string, success: boolean = true): void {
        const active = this.activeOperations.get(operationId);
        if (!active) return;

        const endTime = new Date();
        const duration = endTime.getTime() - active.startTime.getTime();

        this.activeOperations.delete(operationId);

        // Extract operation name from operationId (assuming format: operation:unique)
        const operation = operationId.split(':')[0];

        this.recordOperation(operation, duration, success, active.metadata);
    }

    /**
     * Time a function execution
     */
    async timeOperation<T>(
        operation: string,
        fn: () => Promise<T> | T,
        metadata?: Record<string, any>
    ): Promise<T> {
        const operationId = `${operation}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

        this.startOperation(operationId, operation, metadata);

        try {
            const result = await fn();
            this.endOperation(operationId, true);
            return result;
        } catch (error) {
            this.endOperation(operationId, false);
            throw error;
        }
    }

    /**
     * Record operation performance data
     */
    private recordOperation(
        operation: string,
        duration: number,
        success: boolean,
        metadata?: Record<string, any>
    ): void {
        if (!this.profiles.has(operation)) {
            this.profiles.set(operation, {
                operation,
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                errorCount: 0,
                errorRate: 0,
                lastExecuted: new Date(),
                samples: []
            });
        }

        const profile = this.profiles.get(operation)!;

        profile.count++;
        profile.totalTime += duration;
        profile.averageTime = profile.totalTime / profile.count;
        profile.minTime = Math.min(profile.minTime, duration);
        profile.maxTime = Math.max(profile.maxTime, duration);
        profile.lastExecuted = new Date();

        if (!success) {
            profile.errorCount++;
        }
        profile.errorRate = profile.errorCount / profile.count;

        // Add sample
        profile.samples.push({
            duration,
            timestamp: new Date(),
            success,
            metadata
        });

        // Limit sample size
        if (profile.samples.length > 1000) {
            profile.samples.shift();
        }
    }

    /**
     * Get operation profile
     */
    getProfile(operation: string): OperationProfile | null {
        return this.profiles.get(operation) || null;
    }

    /**
     * Get all profiles
     */
    getAllProfiles(): OperationProfile[] {
        return Array.from(this.profiles.values());
    }

    /**
     * Get slowest operations
     */
    getSlowestOperations(limit: number = 10): OperationProfile[] {
        return this.getAllProfiles()
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, limit);
    }

    /**
     * Get operations with highest error rates
     */
    getHighestErrorRateOperations(limit: number = 10): OperationProfile[] {
        return this.getAllProfiles()
            .filter(p => p.errorRate > 0)
            .sort((a, b) => b.errorRate - a.errorRate)
            .slice(0, limit);
    }

    /**
     * Clear profiles
     */
    clear(): void {
        this.profiles.clear();
        this.activeOperations.clear();
    }
}

/**
 * System resource monitor
 */
export class SystemMonitor {
    private lastSystemMetrics?: SystemMetrics;
    private systemMetricsHistory: Array<{ timestamp: Date; metrics: SystemMetrics }> = [];
    private maxHistorySize = 1440; // 24 hours at 1-minute intervals

    /**
     * Collect current system metrics
     */
    async collectSystemMetrics(): Promise<SystemMetrics> {
        const metrics: SystemMetrics = {
            cpu: await this.getCPUMetrics(),
            memory: await this.getMemoryMetrics(),
            disk: await this.getDiskMetrics(),
            network: await this.getNetworkMetrics()
        };

        this.lastSystemMetrics = metrics;
        this.systemMetricsHistory.push({
            timestamp: new Date(),
            metrics: { ...metrics }
        });

        // Limit history size
        if (this.systemMetricsHistory.length > this.maxHistorySize) {
            this.systemMetricsHistory.shift();
        }

        return metrics;
    }

    /**
     * Get latest system metrics
     */
    getLatestMetrics(): SystemMetrics | null {
        return this.lastSystemMetrics || null;
    }

    /**
     * Get system metrics history
     */
    getMetricsHistory(since?: Date): Array<{ timestamp: Date; metrics: SystemMetrics }> {
        if (since) {
            return this.systemMetricsHistory.filter(h => h.timestamp >= since);
        }
        return [...this.systemMetricsHistory];
    }

    private async getCPUMetrics(): Promise<SystemMetrics['cpu']> {
        // Platform-specific CPU metrics collection
        if (typeof performance !== 'undefined' && (performance as any).measureUserAgentSpecificMemory) {
            // Browser environment - limited metrics
            return {
                usage: Math.random() * 100, // Placeholder
                loadAverage: [0, 0, 0],
                cores: navigator.hardwareConcurrency || 1
            };
        } else if (typeof process !== 'undefined') {
            // Node.js environment
            const cpuUsage = process.cpuUsage();
            const usage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

            return {
                usage: Math.min(100, usage * 100),
                loadAverage: (globalThis as any).os?.loadavg?.() || [0, 0, 0],
                cores: (globalThis as any).os?.cpus?.()?.length || 1
            };
        } else {
            // Fallback
            return {
                usage: 0,
                loadAverage: [0, 0, 0],
                cores: 1
            };
        }
    }

    private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
        if (typeof performance !== 'undefined' && (performance as any).measureUserAgentSpecificMemory) {
            // Browser environment
            try {
                const memInfo = await (performance as any).measureUserAgentSpecificMemory();
                return {
                    total: memInfo.bytes || 0,
                    used: memInfo.bytes || 0,
                    free: 0,
                    usage: 0
                };
            } catch {
                return {
                    total: 0,
                    used: 0,
                    free: 0,
                    usage: 0
                };
            }
        } else if (typeof process !== 'undefined') {
            // Node.js environment
            const memUsage = process.memoryUsage();
            const totalMem = (globalThis as any).os?.totalmem?.() || memUsage.heapTotal;
            const freeMem = (globalThis as any).os?.freemem?.() || 0;
            const usedMem = totalMem - freeMem;

            return {
                total: totalMem,
                used: usedMem,
                free: freeMem,
                usage: (usedMem / totalMem) * 100,
                heap: {
                    total: memUsage.heapTotal,
                    used: memUsage.heapUsed,
                    external: memUsage.external
                }
            };
        } else {
            return {
                total: 0,
                used: 0,
                free: 0,
                usage: 0
            };
        }
    }

    private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
        // Placeholder implementation - would integrate with system APIs
        return {
            total: 1000000000, // 1GB
            used: 500000000,   // 500MB
            free: 500000000,   // 500MB
            usage: 50,
            ioRate: 0
        };
    }

    private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
        // Placeholder implementation - would integrate with network monitoring
        return {
            bytesIn: 0,
            bytesOut: 0,
            packetsIn: 0,
            packetsOut: 0,
            errors: 0
        };
    }
}

/**
 * Comprehensive performance monitoring manager
 */
export class PerformanceMonitoringManager {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private metricsCollector: MetricsCollector;
    private operationProfiler: OperationProfiler;
    private systemMonitor: SystemMonitor;
    private alerts = new Map<string, PerformanceAlert>();
    private baselines = new Map<string, PerformanceBaseline>();
    private recommendations: PerformanceRecommendation[] = [];

    private monitoringInterval?: any;
    private alertCheckInterval?: any;

    // Configuration
    private config = {
        systemMetricsInterval: 60000, // 1 minute
        alertCheckInterval: 10000, // 10 seconds
        enableAutoBaselines: true,
        enableRecommendations: true,
        maxRecommendations: 50
    };

    constructor(fx: FXCore, errorManager?: ErrorHandlingManager) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.metricsCollector = new MetricsCollector();
        this.operationProfiler = new OperationProfiler();
        this.systemMonitor = new SystemMonitor();

        this.initializeMonitoring();
        this.setupDefaultAlerts();
        this.startContinuousMonitoring();
    }

    /**
     * Initialize monitoring system
     */
    private initializeMonitoring(): void {
        const monitoringNode = this.fx.proxy('system.performance');
        monitoringNode.val({
            collector: this.metricsCollector,
            profiler: this.operationProfiler,
            monitor: this.systemMonitor,
            alerts: new Map(),
            baselines: new Map(),
            recommendations: [],
            config: this.config
        });

        console.log('Performance monitoring system initialized');
    }

    /**
     * Setup default performance alerts
     */
    private setupDefaultAlerts(): void {
        // High CPU usage alert
        this.addAlert({
            id: 'cpu-high',
            name: 'High CPU Usage',
            metricId: 'system.cpu.usage',
            condition: {
                operator: 'gt',
                threshold: 80,
                duration: 60000 // 1 minute
            },
            severity: AlertSeverity.WARNING,
            enabled: true,
            triggered: false,
            triggerCount: 0
        });

        // High memory usage alert
        this.addAlert({
            id: 'memory-high',
            name: 'High Memory Usage',
            metricId: 'system.memory.usage',
            condition: {
                operator: 'gt',
                threshold: 90,
                duration: 30000 // 30 seconds
            },
            severity: AlertSeverity.CRITICAL,
            enabled: true,
            triggered: false,
            triggerCount: 0
        });

        // Slow operation alert
        this.addAlert({
            id: 'operation-slow',
            name: 'Slow Operation Detected',
            metricId: 'operation.avg_duration',
            condition: {
                operator: 'gt',
                threshold: 5000, // 5 seconds
                duration: 0
            },
            severity: AlertSeverity.WARNING,
            enabled: true,
            triggered: false,
            triggerCount: 0
        });
    }

    /**
     * Start continuous monitoring
     */
    private startContinuousMonitoring(): void {
        // System metrics collection
        this.monitoringInterval = setInterval(async () => {
            try {
                const metrics = await this.systemMonitor.collectSystemMetrics();
                this.recordSystemMetrics(metrics);
            } catch (error) {
                console.error('System metrics collection failed:', error);
            }
        }, this.config.systemMetricsInterval);

        // Alert checking
        this.alertCheckInterval = setInterval(() => {
            this.checkAlerts();
        }, this.config.alertCheckInterval);

        console.log('Continuous monitoring started');
    }

    /**
     * Record system metrics as performance metrics
     */
    private recordSystemMetrics(metrics: SystemMetrics): void {
        // CPU metrics
        this.metricsCollector.record({
            name: 'system.cpu.usage',
            type: MetricType.GAUGE,
            category: MetricCategory.SYSTEM,
            value: metrics.cpu.usage,
            unit: 'percent'
        });

        // Memory metrics
        this.metricsCollector.record({
            name: 'system.memory.usage',
            type: MetricType.GAUGE,
            category: MetricCategory.SYSTEM,
            value: metrics.memory.usage,
            unit: 'percent'
        });

        this.metricsCollector.record({
            name: 'system.memory.used',
            type: MetricType.GAUGE,
            category: MetricCategory.SYSTEM,
            value: metrics.memory.used,
            unit: 'bytes'
        });

        // Disk metrics
        this.metricsCollector.record({
            name: 'system.disk.usage',
            type: MetricType.GAUGE,
            category: MetricCategory.SYSTEM,
            value: metrics.disk.usage,
            unit: 'percent'
        });

        // Network metrics
        this.metricsCollector.record({
            name: 'system.network.bytes_in',
            type: MetricType.COUNTER,
            category: MetricCategory.NETWORK,
            value: metrics.network.bytesIn,
            unit: 'bytes'
        });

        this.metricsCollector.record({
            name: 'system.network.bytes_out',
            type: MetricType.COUNTER,
            category: MetricCategory.NETWORK,
            value: metrics.network.bytesOut,
            unit: 'bytes'
        });
    }

    /**
     * Record a custom performance metric
     */
    recordMetric(
        name: string,
        value: number,
        type: MetricType = MetricType.GAUGE,
        category: MetricCategory = MetricCategory.APPLICATION,
        unit: string = 'count',
        tags?: Record<string, string>
    ): void {
        this.metricsCollector.record({
            name,
            type,
            category,
            value,
            unit,
            tags
        });
    }

    /**
     * Time an operation
     */
    async timeOperation<T>(
        operation: string,
        fn: () => Promise<T> | T,
        metadata?: Record<string, any>
    ): Promise<T> {
        return this.operationProfiler.timeOperation(operation, fn, metadata);
    }

    /**
     * Add performance alert
     */
    addAlert(alert: PerformanceAlert): void {
        this.alerts.set(alert.id, alert);
        console.log(`Added performance alert: ${alert.name}`);
    }

    /**
     * Remove performance alert
     */
    removeAlert(alertId: string): boolean {
        return this.alerts.delete(alertId);
    }

    /**
     * Check all alerts
     */
    private checkAlerts(): void {
        for (const alert of this.alerts.values()) {
            if (!alert.enabled) continue;

            try {
                this.checkAlert(alert);
            } catch (error) {
                console.error(`Alert check failed for ${alert.id}:`, error);
            }
        }
    }

    /**
     * Check individual alert
     */
    private checkAlert(alert: PerformanceAlert): void {
        const now = new Date();
        const since = alert.condition.duration
            ? new Date(now.getTime() - alert.condition.duration)
            : undefined;

        const aggregation = this.metricsCollector.getAggregation(alert.metricId, since);
        if (!aggregation) return;

        let shouldTrigger = false;
        const currentValue = aggregation.avg;

        switch (alert.condition.operator) {
            case 'gt':
                shouldTrigger = currentValue > alert.condition.threshold;
                break;
            case 'gte':
                shouldTrigger = currentValue >= alert.condition.threshold;
                break;
            case 'lt':
                shouldTrigger = currentValue < alert.condition.threshold;
                break;
            case 'lte':
                shouldTrigger = currentValue <= alert.condition.threshold;
                break;
            case 'eq':
                shouldTrigger = currentValue === alert.condition.threshold;
                break;
        }

        if (shouldTrigger && !alert.triggered) {
            // Trigger alert
            alert.triggered = true;
            alert.triggeredAt = now;
            alert.lastTriggered = now;
            alert.triggerCount++;

            this.handleAlertTrigger(alert, currentValue);
        } else if (!shouldTrigger && alert.triggered) {
            // Clear alert
            alert.triggered = false;
            alert.triggeredAt = undefined;

            this.handleAlertClear(alert, currentValue);
        }
    }

    /**
     * Handle alert trigger
     */
    private handleAlertTrigger(alert: PerformanceAlert, value: number): void {
        console.warn(`PERFORMANCE ALERT TRIGGERED: ${alert.name} (value: ${value}, threshold: ${alert.condition.threshold})`);

        // Store alert event
        const alertEventNode = this.fx.proxy(`system.performance.alertEvents.${alert.id}.${Date.now()}`);
        alertEventNode.val({
            alert: alert.id,
            event: 'triggered',
            value,
            threshold: alert.condition.threshold,
            timestamp: new Date()
        });

        // Execute alert actions
        if (alert.actions) {
            this.executeAlertActions(alert, 'triggered', value);
        }

        // Generate recommendation if enabled
        if (this.config.enableRecommendations) {
            this.generateAlertRecommendation(alert, value);
        }
    }

    /**
     * Handle alert clear
     */
    private handleAlertClear(alert: PerformanceAlert, value: number): void {
        console.log(`Performance alert cleared: ${alert.name} (value: ${value})`);

        // Store alert event
        const alertEventNode = this.fx.proxy(`system.performance.alertEvents.${alert.id}.${Date.now()}`);
        alertEventNode.val({
            alert: alert.id,
            event: 'cleared',
            value,
            threshold: alert.condition.threshold,
            timestamp: new Date()
        });

        // Execute alert actions
        if (alert.actions) {
            this.executeAlertActions(alert, 'cleared', value);
        }
    }

    /**
     * Execute alert actions
     */
    private executeAlertActions(alert: PerformanceAlert, event: 'triggered' | 'cleared', value: number): void {
        if (!alert.actions) return;

        // Notification actions
        if (alert.actions.notify) {
            console.log(`Alert notification: ${alert.name} ${event} (value: ${value})`);
        }

        // Script execution
        if (alert.actions.script) {
            console.log(`Executing alert script for: ${alert.name}`);
            // Implementation would execute the script
        }

        // Webhook calls
        if (alert.actions.webhook) {
            console.log(`Calling webhook for alert: ${alert.name}`);
            // Implementation would call the webhook
        }
    }

    /**
     * Generate recommendation based on alert
     */
    private generateAlertRecommendation(alert: PerformanceAlert, value: number): void {
        let recommendation: PerformanceRecommendation;

        switch (alert.metricId) {
            case 'system.cpu.usage':
                recommendation = {
                    id: `rec-${Date.now()}`,
                    type: 'optimization',
                    severity: 'high',
                    title: 'High CPU Usage Detected',
                    description: `CPU usage is at ${value.toFixed(1)}%, which exceeds the threshold of ${alert.condition.threshold}%`,
                    impact: 'Performance degradation and potential system instability',
                    effort: 'medium',
                    metrics: [alert.metricId],
                    actions: [
                        'Identify CPU-intensive operations',
                        'Optimize algorithms and queries',
                        'Consider horizontal scaling',
                        'Implement caching where appropriate'
                    ],
                    estimatedImprovement: '20-40% CPU usage reduction',
                    createdAt: new Date()
                };
                break;

            case 'system.memory.usage':
                recommendation = {
                    id: `rec-${Date.now()}`,
                    type: 'scaling',
                    severity: 'high',
                    title: 'High Memory Usage Detected',
                    description: `Memory usage is at ${value.toFixed(1)}%, which exceeds the threshold of ${alert.condition.threshold}%`,
                    impact: 'Risk of out-of-memory errors and system crashes',
                    effort: 'medium',
                    metrics: [alert.metricId],
                    actions: [
                        'Implement memory leak detection',
                        'Optimize data structures',
                        'Increase available memory',
                        'Implement garbage collection tuning'
                    ],
                    estimatedImprovement: '30-50% memory usage reduction',
                    createdAt: new Date()
                };
                break;

            default:
                recommendation = {
                    id: `rec-${Date.now()}`,
                    type: 'optimization',
                    severity: 'medium',
                    title: `Performance Issue: ${alert.name}`,
                    description: `Metric ${alert.metricId} has exceeded threshold`,
                    impact: 'Potential performance degradation',
                    effort: 'medium',
                    metrics: [alert.metricId],
                    actions: ['Investigate and optimize the affected component'],
                    estimatedImprovement: 'Variable',
                    createdAt: new Date()
                };
        }

        this.addRecommendation(recommendation);
    }

    /**
     * Add performance recommendation
     */
    addRecommendation(recommendation: PerformanceRecommendation): void {
        this.recommendations.push(recommendation);

        // Limit recommendations
        if (this.recommendations.length > this.config.maxRecommendations) {
            this.recommendations.shift();
        }

        console.log(`Added performance recommendation: ${recommendation.title}`);
    }

    /**
     * Get performance dashboard data
     */
    getDashboard(): {
        systemMetrics: SystemMetrics | null;
        topOperations: OperationProfile[];
        activeAlerts: PerformanceAlert[];
        recentRecommendations: PerformanceRecommendation[];
        metricsSummary: {
            totalMetrics: number;
            alertCount: number;
            recommendationCount: number;
        };
    } {
        const systemMetrics = this.systemMonitor.getLatestMetrics();
        const topOperations = this.operationProfiler.getSlowestOperations(5);
        const activeAlerts = Array.from(this.alerts.values()).filter(a => a.triggered);
        const recentRecommendations = this.recommendations
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);

        return {
            systemMetrics,
            topOperations,
            activeAlerts,
            recentRecommendations,
            metricsSummary: {
                totalMetrics: this.metricsCollector.getMetricNames().length,
                alertCount: this.alerts.size,
                recommendationCount: this.recommendations.length
            }
        };
    }

    /**
     * Get detailed performance report
     */
    getPerformanceReport(period: 'hour' | 'day' | 'week' = 'hour'): {
        period: string;
        systemMetrics: any;
        operationProfiles: OperationProfile[];
        alertSummary: any;
        recommendations: PerformanceRecommendation[];
        trends: any;
    } {
        const periodMs = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000
        }[period];

        const since = new Date(Date.now() - periodMs);

        return {
            period,
            systemMetrics: this.systemMonitor.getMetricsHistory(since),
            operationProfiles: this.operationProfiler.getAllProfiles(),
            alertSummary: this.getAlertSummary(since),
            recommendations: this.recommendations.filter(r => r.createdAt >= since),
            trends: this.calculateTrends(since)
        };
    }

    /**
     * Get alert summary for period
     */
    private getAlertSummary(since: Date): any {
        const alerts = Array.from(this.alerts.values());
        const triggered = alerts.filter(a => a.lastTriggered && a.lastTriggered >= since);

        return {
            total: alerts.length,
            triggered: triggered.length,
            critical: triggered.filter(a => a.severity === AlertSeverity.CRITICAL).length,
            warning: triggered.filter(a => a.severity === AlertSeverity.WARNING).length
        };
    }

    /**
     * Calculate performance trends
     */
    private calculateTrends(since: Date): any {
        const metricNames = this.metricsCollector.getMetricNames();
        const trends: Record<string, any> = {};

        for (const metricName of metricNames) {
            const metrics = this.metricsCollector.getMetrics(metricName, since);
            if (metrics.length < 2) continue;

            const values = metrics.map(m => m.value);
            const first = values[0];
            const last = values[values.length - 1];
            const change = last - first;
            const percentChange = first !== 0 ? (change / first) * 100 : 0;

            trends[metricName] = {
                change,
                percentChange,
                direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
            };
        }

        return trends;
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
            this.alertCheckInterval = undefined;
        }

        console.log('Performance monitoring stopped');
    }
}

/**
 * Factory function to create performance monitoring manager
 */
export function createPerformanceMonitoringManager(
    fx: FXCore,
    errorManager?: ErrorHandlingManager
): PerformanceMonitoringManager {
    const manager = new PerformanceMonitoringManager(fx, errorManager);

    // Attach to FX system
    const performanceNode = fx.proxy('system.performance');
    performanceNode.val({
        manager,
        recordMetric: manager.recordMetric.bind(manager),
        timeOperation: manager.timeOperation.bind(manager),
        addAlert: manager.addAlert.bind(manager),
        removeAlert: manager.removeAlert.bind(manager),
        getDashboard: manager.getDashboard.bind(manager),
        getReport: manager.getPerformanceReport.bind(manager),
        stop: manager.stop.bind(manager)
    });

    return manager;
}

export default {
    PerformanceMonitoringManager,
    MetricsCollector,
    OperationProfiler,
    SystemMonitor,
    MetricType,
    MetricCategory,
    AlertSeverity,
    createPerformanceMonitoringManager
};