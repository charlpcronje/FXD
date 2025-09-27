/**
 * @file fx-memory-leak-detection.ts
 * @description Advanced memory leak detection and management system for FXD
 *
 * Provides comprehensive memory leak detection including:
 * - Heap analysis and memory profiling
 * - Object lifecycle tracking
 * - Memory usage pattern detection
 * - Automatic leak detection algorithms
 * - Memory optimization recommendations
 * - Garbage collection monitoring
 * - Memory pressure alerts
 * - Proactive memory management
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, FXDError, ErrorCode, ErrorCategory, ErrorSeverity } from './fx-error-handling.ts';
import { PerformanceMonitoringManager } from './fx-performance-monitoring.ts';

// Memory leak types
export enum LeakType {
    CIRCULAR_REFERENCE = 'circular_reference',
    EVENT_LISTENER = 'event_listener',
    CLOSURE_CAPTURE = 'closure_capture',
    DOM_DETACHED = 'dom_detached',
    CACHE_GROWTH = 'cache_growth',
    OBJECT_ACCUMULATION = 'object_accumulation',
    MEMORY_FRAGMENTATION = 'memory_fragmentation',
    RESOURCE_NOT_RELEASED = 'resource_not_released'
}

// Memory analysis result interface
export interface MemoryAnalysis {
    timestamp: Date;
    totalMemory: number;
    usedMemory: number;
    freeMemory: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    memoryGrowthRate: number;
    gcFrequency: number;
    suspiciousObjects: SuspiciousObject[];
    leakSuspicions: LeakSuspicion[];
    recommendations: MemoryRecommendation[];
}

// Suspicious object interface
export interface SuspiciousObject {
    id: string;
    type: string;
    size: number;
    count: number;
    growthRate: number;
    firstSeen: Date;
    lastSeen: Date;
    retentionTime: number;
    references: string[];
    suspicionLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Memory leak suspicion interface
export interface LeakSuspicion {
    id: string;
    type: LeakType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number; // 0-1
    description: string;
    affectedObjects: string[];
    memoryImpact: number; // bytes
    detectedAt: Date;
    source?: string;
    stackTrace?: string[];
    mitigation?: string[];
}

// Memory recommendation interface
export interface MemoryRecommendation {
    id: string;
    type: 'optimization' | 'cleanup' | 'configuration' | 'refactoring';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    actions: string[];
    estimatedSavings: string;
    codeExample?: string;
}

// Object tracking entry
interface ObjectTrackingEntry {
    id: string;
    type: string;
    size: number;
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    references: Set<string>;
    weakRefs: WeakRef<any>[];
    metadata?: Record<string, any>;
}

// Garbage collection stats
interface GCStats {
    collections: number;
    totalTime: number;
    averageTime: number;
    lastCollection: Date;
    memoryBefore: number;
    memoryAfter: number;
    memoryFreed: number;
}

/**
 * Memory leak detector with advanced analysis algorithms
 */
export class MemoryLeakDetector {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private performanceManager?: PerformanceMonitoringManager;

    // Tracking data
    private objectRegistry = new Map<string, ObjectTrackingEntry>();
    private memorySnapshots: Array<{ timestamp: Date; usage: any }> = [];
    private gcStats: GCStats = {
        collections: 0,
        totalTime: 0,
        averageTime: 0,
        lastCollection: new Date(),
        memoryBefore: 0,
        memoryAfter: 0,
        memoryFreed: 0
    };

    // Analysis state
    private lastAnalysis?: MemoryAnalysis;
    private suspiciousObjects = new Map<string, SuspiciousObject>();
    private leakSuspicions = new Map<string, LeakSuspicion>();
    private recommendations: MemoryRecommendation[] = [];

    // Configuration
    private config = {
        snapshotInterval: 30000, // 30 seconds
        maxSnapshots: 1000,
        suspicionThreshold: 0.7,
        growthRateThreshold: 1.5, // 50% growth
        objectRetentionThreshold: 300000, // 5 minutes
        gcMonitoringEnabled: true,
        autoCleanupEnabled: true,
        maxRecommendations: 20
    };

    // Monitoring intervals
    private snapshotInterval?: any;
    private analysisInterval?: any;
    private cleanupInterval?: any;

    constructor(
        fx: FXCore,
        errorManager?: ErrorHandlingManager,
        performanceManager?: PerformanceMonitoringManager
    ) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.performanceManager = performanceManager;

        this.initializeDetector();
        this.startMonitoring();
        this.setupGCMonitoring();
    }

    /**
     * Initialize the memory leak detector
     */
    private initializeDetector(): void {
        // Create system node for memory leak detection
        const memoryNode = this.fx.proxy('system.memory.leakDetection');
        memoryNode.val({
            detector: this,
            analysis: null,
            suspiciousObjects: new Map(),
            leakSuspicions: new Map(),
            recommendations: [],
            config: this.config
        });

        console.log('Memory leak detector initialized');
    }

    /**
     * Start memory monitoring
     */
    private startMonitoring(): void {
        // Memory snapshots
        this.snapshotInterval = setInterval(() => {
            this.takeMemorySnapshot();
        }, this.config.snapshotInterval);

        // Memory analysis
        this.analysisInterval = setInterval(() => {
            this.performAnalysis();
        }, this.config.snapshotInterval * 4); // Every 2 minutes

        // Cleanup old data
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 300000); // Every 5 minutes

        console.log('Memory monitoring started');
    }

    /**
     * Setup garbage collection monitoring
     */
    private setupGCMonitoring(): void {
        if (!this.config.gcMonitoringEnabled) return;

        // Hook into GC events if available
        if (typeof (globalThis as any).gc === 'function') {
            const originalGC = (globalThis as any).gc;
            (globalThis as any).gc = () => {
                const beforeMemory = this.getCurrentMemoryUsage();
                const startTime = performance.now();

                const result = originalGC();

                const afterMemory = this.getCurrentMemoryUsage();
                const duration = performance.now() - startTime;

                this.recordGCEvent(beforeMemory, afterMemory, duration);

                return result;
            };
        }

        // Monitor memory pressure events if available
        if (typeof (performance as any).measureUserAgentSpecificMemory === 'function') {
            setInterval(async () => {
                try {
                    const memInfo = await (performance as any).measureUserAgentSpecificMemory();
                    this.analyzeMemoryPressure(memInfo);
                } catch (error) {
                    // Memory measurement not available
                }
            }, 60000); // Every minute
        }
    }

    /**
     * Track an object for potential memory leaks
     */
    trackObject(obj: any, type: string, metadata?: Record<string, any>): string {
        const id = this.generateObjectId();
        const size = this.estimateObjectSize(obj);

        const entry: ObjectTrackingEntry = {
            id,
            type,
            size,
            createdAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 1,
            references: new Set(),
            weakRefs: [new WeakRef(obj)],
            metadata
        };

        this.objectRegistry.set(id, entry);

        // Hook into object access if possible
        this.hookObjectAccess(obj, id);

        return id;
    }

    /**
     * Untrack an object
     */
    untrackObject(id: string): boolean {
        return this.objectRegistry.delete(id);
    }

    /**
     * Take a memory snapshot
     */
    private takeMemorySnapshot(): void {
        const usage = this.getCurrentMemoryUsage();
        const timestamp = new Date();

        this.memorySnapshots.push({ timestamp, usage });

        // Limit snapshot history
        if (this.memorySnapshots.length > this.config.maxSnapshots) {
            this.memorySnapshots.shift();
        }

        // Update object tracking
        this.updateObjectTracking();
    }

    /**
     * Get current memory usage
     */
    private getCurrentMemoryUsage(): any {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage();
        } else if (typeof (performance as any).memory !== 'undefined') {
            return {
                heapUsed: (performance as any).memory.usedJSHeapSize,
                heapTotal: (performance as any).memory.totalJSHeapSize,
                external: 0,
                rss: (performance as any).memory.totalJSHeapSize
            };
        } else {
            return {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0
            };
        }
    }

    /**
     * Perform comprehensive memory analysis
     */
    private async performAnalysis(): Promise<void> {
        try {
            const analysis = await this.analyzeMemoryUsage();
            this.lastAnalysis = analysis;

            // Update suspicious objects
            this.updateSuspiciousObjects(analysis);

            // Detect potential leaks
            this.detectMemoryLeaks(analysis);

            // Generate recommendations
            this.generateRecommendations(analysis);

            // Store analysis results
            const analysisNode = this.fx.proxy(`system.memory.leakDetection.analysis.${Date.now()}`);
            analysisNode.val(analysis);

            // Trigger alerts if necessary
            if (analysis.leakSuspicions.length > 0) {
                await this.triggerMemoryAlert(analysis);
            }

        } catch (error) {
            console.error('Memory analysis failed:', error);
            if (this.errorManager) {
                this.errorManager.handleError(new Error(`Memory analysis failed: ${error.message}`));
            }
        }
    }

    /**
     * Analyze current memory usage patterns
     */
    private async analyzeMemoryUsage(): Promise<MemoryAnalysis> {
        const currentUsage = this.getCurrentMemoryUsage();
        const timestamp = new Date();

        // Calculate memory growth rate
        const growthRate = this.calculateMemoryGrowthRate();

        // Analyze objects
        const suspiciousObjects = this.analyzeSuspiciousObjects();
        const leakSuspicions = this.analyzeLeakSuspicions();

        // Generate recommendations
        const recommendations = this.generateMemoryRecommendations();

        return {
            timestamp,
            totalMemory: currentUsage.rss || 0,
            usedMemory: currentUsage.heapUsed || 0,
            freeMemory: (currentUsage.heapTotal || 0) - (currentUsage.heapUsed || 0),
            heapUsed: currentUsage.heapUsed || 0,
            heapTotal: currentUsage.heapTotal || 0,
            external: currentUsage.external || 0,
            memoryGrowthRate: growthRate,
            gcFrequency: this.calculateGCFrequency(),
            suspiciousObjects,
            leakSuspicions,
            recommendations
        };
    }

    /**
     * Calculate memory growth rate
     */
    private calculateMemoryGrowthRate(): number {
        if (this.memorySnapshots.length < 2) return 0;

        const recent = this.memorySnapshots.slice(-10); // Last 10 snapshots
        if (recent.length < 2) return 0;

        const first = recent[0];
        const last = recent[recent.length - 1];

        const timeSpan = last.timestamp.getTime() - first.timestamp.getTime();
        const memoryChange = last.usage.heapUsed - first.usage.heapUsed;

        // Return growth rate in bytes per second
        return timeSpan > 0 ? (memoryChange / timeSpan) * 1000 : 0;
    }

    /**
     * Calculate garbage collection frequency
     */
    private calculateGCFrequency(): number {
        if (this.gcStats.collections === 0) return 0;

        const timeSinceFirst = Date.now() - this.gcStats.lastCollection.getTime();
        return this.gcStats.collections / (timeSinceFirst / 1000); // Collections per second
    }

    /**
     * Analyze suspicious objects
     */
    private analyzeSuspiciousObjects(): SuspiciousObject[] {
        const suspicious: SuspiciousObject[] = [];
        const now = new Date();

        for (const [id, entry] of this.objectRegistry) {
            const retentionTime = now.getTime() - entry.createdAt.getTime();
            const isStale = retentionTime > this.config.objectRetentionThreshold;

            // Check if object is still alive
            const isAlive = entry.weakRefs.some(ref => ref.deref() !== undefined);

            if (isStale && isAlive) {
                let suspicionLevel: SuspiciousObject['suspicionLevel'] = 'low';

                if (retentionTime > this.config.objectRetentionThreshold * 5) {
                    suspicionLevel = 'critical';
                } else if (retentionTime > this.config.objectRetentionThreshold * 3) {
                    suspicionLevel = 'high';
                } else if (retentionTime > this.config.objectRetentionThreshold * 2) {
                    suspicionLevel = 'medium';
                }

                const suspiciousObject: SuspiciousObject = {
                    id,
                    type: entry.type,
                    size: entry.size,
                    count: 1, // This would be aggregated for similar objects
                    growthRate: 0, // This would be calculated based on historical data
                    firstSeen: entry.createdAt,
                    lastSeen: entry.lastAccessed,
                    retentionTime,
                    references: Array.from(entry.references),
                    suspicionLevel
                };

                suspicious.push(suspiciousObject);
                this.suspiciousObjects.set(id, suspiciousObject);
            }
        }

        return suspicious;
    }

    /**
     * Analyze potential memory leaks
     */
    private analyzeLeakSuspicions(): LeakSuspicion[] {
        const suspicions: LeakSuspicion[] = [];

        // Analyze memory growth patterns
        if (this.memorySnapshots.length >= 10) {
            const growthRate = this.calculateMemoryGrowthRate();

            if (growthRate > 1024 * 1024) { // 1MB per second growth
                suspicions.push({
                    id: this.generateSuspicionId(),
                    type: LeakType.OBJECT_ACCUMULATION,
                    severity: 'high',
                    confidence: 0.8,
                    description: `Rapid memory growth detected: ${(growthRate / 1024 / 1024).toFixed(2)} MB/s`,
                    affectedObjects: [],
                    memoryImpact: growthRate * 60, // Impact per minute
                    detectedAt: new Date(),
                    mitigation: [
                        'Review object creation patterns',
                        'Implement object pooling',
                        'Check for memory leaks in loops'
                    ]
                });
            }
        }

        // Analyze circular references
        const circularRefs = this.detectCircularReferences();
        if (circularRefs.length > 0) {
            suspicions.push({
                id: this.generateSuspicionId(),
                type: LeakType.CIRCULAR_REFERENCE,
                severity: 'medium',
                confidence: 0.9,
                description: `${circularRefs.length} potential circular references detected`,
                affectedObjects: circularRefs,
                memoryImpact: circularRefs.length * 1024, // Estimated impact
                detectedAt: new Date(),
                mitigation: [
                    'Use WeakMap/WeakSet for bidirectional references',
                    'Implement proper cleanup in destructors',
                    'Review object relationship patterns'
                ]
            });
        }

        // Analyze event listener accumulation
        const listenerLeaks = this.detectEventListenerLeaks();
        if (listenerLeaks.length > 0) {
            suspicions.push({
                id: this.generateSuspicionId(),
                type: LeakType.EVENT_LISTENER,
                severity: 'medium',
                confidence: 0.7,
                description: `${listenerLeaks.length} potential event listener leaks detected`,
                affectedObjects: listenerLeaks,
                memoryImpact: listenerLeaks.length * 512, // Estimated impact
                detectedAt: new Date(),
                mitigation: [
                    'Remove event listeners when objects are destroyed',
                    'Use AbortController for automatic cleanup',
                    'Implement proper component lifecycle management'
                ]
            });
        }

        // Store suspicions
        for (const suspicion of suspicions) {
            this.leakSuspicions.set(suspicion.id, suspicion);
        }

        return suspicions;
    }

    /**
     * Detect circular references
     */
    private detectCircularReferences(): string[] {
        const circular: string[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (objectId: string): boolean => {
            if (recursionStack.has(objectId)) {
                circular.push(objectId);
                return true;
            }

            if (visited.has(objectId)) return false;

            visited.add(objectId);
            recursionStack.add(objectId);

            const entry = this.objectRegistry.get(objectId);
            if (entry) {
                for (const refId of entry.references) {
                    if (dfs(refId)) {
                        return true;
                    }
                }
            }

            recursionStack.delete(objectId);
            return false;
        };

        for (const objectId of this.objectRegistry.keys()) {
            if (!visited.has(objectId)) {
                dfs(objectId);
            }
        }

        return circular;
    }

    /**
     * Detect event listener leaks
     */
    private detectEventListenerLeaks(): string[] {
        // This would analyze objects that are event targets
        // and have accumulated many listeners
        const leaks: string[] = [];

        for (const [id, entry] of this.objectRegistry) {
            if (entry.type.includes('EventTarget') || entry.type.includes('Listener')) {
                const retentionTime = Date.now() - entry.createdAt.getTime();
                if (retentionTime > this.config.objectRetentionThreshold * 2) {
                    leaks.push(id);
                }
            }
        }

        return leaks;
    }

    /**
     * Generate memory optimization recommendations
     */
    private generateMemoryRecommendations(): MemoryRecommendation[] {
        const recommendations: MemoryRecommendation[] = [];

        // High memory usage recommendation
        if (this.lastAnalysis && this.lastAnalysis.memoryGrowthRate > 1024 * 1024) {
            recommendations.push({
                id: `rec-${Date.now()}-growth`,
                type: 'optimization',
                priority: 'high',
                title: 'High Memory Growth Rate',
                description: 'Memory usage is growing rapidly, indicating potential memory leaks',
                impact: 'Prevents out-of-memory errors and improves performance',
                effort: 'medium',
                actions: [
                    'Profile memory usage to identify leak sources',
                    'Implement object pooling for frequently created objects',
                    'Review and optimize data structures',
                    'Add memory monitoring to critical code paths'
                ],
                estimatedSavings: '20-50% memory reduction',
                codeExample: `
// Use object pooling
const objectPool = new Map();
function getObject(type) {
    if (objectPool.has(type)) {
        return objectPool.get(type).pop() || new type();
    }
    return new type();
}
function releaseObject(obj, type) {
    if (!objectPool.has(type)) objectPool.set(type, []);
    objectPool.get(type).push(obj);
}`
            });
        }

        // Suspicious objects recommendation
        if (this.suspiciousObjects.size > 10) {
            recommendations.push({
                id: `rec-${Date.now()}-suspicious`,
                type: 'cleanup',
                priority: 'medium',
                title: 'Clean Up Suspicious Objects',
                description: `${this.suspiciousObjects.size} objects showing suspicious retention patterns`,
                impact: 'Reduces memory usage and prevents potential leaks',
                effort: 'low',
                actions: [
                    'Review object lifecycle management',
                    'Implement proper cleanup procedures',
                    'Use WeakRef for optional references',
                    'Add object disposal methods'
                ],
                estimatedSavings: '10-30% memory reduction'
            });
        }

        // GC frequency recommendation
        if (this.gcStats.averageTime > 100) { // 100ms average GC time
            recommendations.push({
                id: `rec-${Date.now()}-gc`,
                type: 'configuration',
                priority: 'medium',
                title: 'Optimize Garbage Collection',
                description: 'Garbage collection is taking too long, affecting performance',
                impact: 'Reduces GC pause times and improves responsiveness',
                effort: 'low',
                actions: [
                    'Reduce object allocation frequency',
                    'Use object pools for temporary objects',
                    'Optimize data structures to reduce GC pressure',
                    'Consider manual GC scheduling in low-activity periods'
                ],
                estimatedSavings: '50-80% reduction in GC pause time'
            });
        }

        return recommendations;
    }

    /**
     * Update object tracking information
     */
    private updateObjectTracking(): void {
        const now = new Date();
        const toRemove: string[] = [];

        for (const [id, entry] of this.objectRegistry) {
            // Check if object is still alive
            const isAlive = entry.weakRefs.some(ref => ref.deref() !== undefined);

            if (!isAlive) {
                // Object has been garbage collected
                toRemove.push(id);
            } else {
                // Update last seen time if recently accessed
                // This would be updated by the object access hooks
            }
        }

        // Remove garbage collected objects
        for (const id of toRemove) {
            this.objectRegistry.delete(id);
            this.suspiciousObjects.delete(id);
        }
    }

    /**
     * Record garbage collection event
     */
    private recordGCEvent(beforeMemory: any, afterMemory: any, duration: number): void {
        this.gcStats.collections++;
        this.gcStats.totalTime += duration;
        this.gcStats.averageTime = this.gcStats.totalTime / this.gcStats.collections;
        this.gcStats.lastCollection = new Date();
        this.gcStats.memoryBefore = beforeMemory.heapUsed || 0;
        this.gcStats.memoryAfter = afterMemory.heapUsed || 0;
        this.gcStats.memoryFreed = this.gcStats.memoryBefore - this.gcStats.memoryAfter;

        console.log(`GC: Freed ${(this.gcStats.memoryFreed / 1024 / 1024).toFixed(2)}MB in ${duration.toFixed(2)}ms`);
    }

    /**
     * Analyze memory pressure
     */
    private analyzeMemoryPressure(memInfo: any): void {
        // Analyze memory pressure indicators
        if (memInfo.bytes && memInfo.breakdown) {
            // This would analyze the detailed memory breakdown
            // provided by measureUserAgentSpecificMemory
        }
    }

    /**
     * Trigger memory alert
     */
    private async triggerMemoryAlert(analysis: MemoryAnalysis): Promise<void> {
        const highSeverityLeaks = analysis.leakSuspicions.filter(l => l.severity === 'high' || l.severity === 'critical');

        if (highSeverityLeaks.length > 0) {
            console.warn(`MEMORY ALERT: ${highSeverityLeaks.length} high-severity memory leak suspicions detected`);

            // Store alert
            const alertNode = this.fx.proxy(`system.memory.alerts.${Date.now()}`);
            alertNode.val({
                timestamp: new Date(),
                type: 'memory_leak',
                severity: 'high',
                leaks: highSeverityLeaks.length,
                memoryGrowthRate: analysis.memoryGrowthRate,
                totalMemory: analysis.totalMemory
            });

            // Trigger error handler if available
            if (this.errorManager) {
                await this.errorManager.handleError(
                    this.errorManager.createError({
                        code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
                        category: ErrorCategory.PERFORMANCE,
                        severity: ErrorSeverity.HIGH,
                        message: `Memory leak detected: ${highSeverityLeaks.length} suspicious patterns`,
                        operation: 'memory_analysis'
                    })
                );
            }
        }
    }

    /**
     * Perform cleanup of old data
     */
    private performCleanup(): void {
        const now = Date.now();
        const retentionTime = 24 * 60 * 60 * 1000; // 24 hours

        // Clean up old memory snapshots
        this.memorySnapshots = this.memorySnapshots.filter(
            snapshot => now - snapshot.timestamp.getTime() < retentionTime
        );

        // Clean up old suspicious objects
        for (const [id, obj] of this.suspiciousObjects) {
            if (now - obj.firstSeen.getTime() > retentionTime) {
                this.suspiciousObjects.delete(id);
            }
        }

        // Clean up old leak suspicions
        for (const [id, suspicion] of this.leakSuspicions) {
            if (now - suspicion.detectedAt.getTime() > retentionTime) {
                this.leakSuspicions.delete(id);
            }
        }

        // Limit recommendations
        if (this.recommendations.length > this.config.maxRecommendations) {
            this.recommendations.splice(0, this.recommendations.length - this.config.maxRecommendations);
        }
    }

    /**
     * Hook into object access for tracking
     */
    private hookObjectAccess(obj: any, id: string): void {
        // This would set up property access monitoring
        // Implementation would depend on the specific object type
        // and available JavaScript features
    }

    /**
     * Estimate object size in bytes
     */
    private estimateObjectSize(obj: any): number {
        // Rough estimation of object size
        if (obj === null || obj === undefined) return 0;

        if (typeof obj === 'string') return obj.length * 2; // Unicode characters
        if (typeof obj === 'number') return 8; // 64-bit number
        if (typeof obj === 'boolean') return 4;
        if (typeof obj === 'function') return obj.toString().length;

        if (Array.isArray(obj)) {
            return obj.reduce((size, item) => size + this.estimateObjectSize(item), 0) + 8; // Array overhead
        }

        if (typeof obj === 'object') {
            let size = 8; // Object overhead
            for (const [key, value] of Object.entries(obj)) {
                size += key.length * 2; // Property name
                size += this.estimateObjectSize(value); // Property value
            }
            return size;
        }

        return 8; // Default size
    }

    /**
     * Get current memory leak status
     */
    getMemoryLeakStatus(): {
        analysis: MemoryAnalysis | null;
        suspiciousObjectCount: number;
        leakSuspicionCount: number;
        memoryGrowthRate: number;
        gcFrequency: number;
        recommendations: number;
    } {
        return {
            analysis: this.lastAnalysis || null,
            suspiciousObjectCount: this.suspiciousObjects.size,
            leakSuspicionCount: this.leakSuspicions.size,
            memoryGrowthRate: this.lastAnalysis?.memoryGrowthRate || 0,
            gcFrequency: this.calculateGCFrequency(),
            recommendations: this.recommendations.length
        };
    }

    /**
     * Force memory analysis
     */
    async forceAnalysis(): Promise<MemoryAnalysis> {
        await this.performAnalysis();
        return this.lastAnalysis!;
    }

    /**
     * Stop memory leak detection
     */
    stop(): void {
        if (this.snapshotInterval) {
            clearInterval(this.snapshotInterval);
            this.snapshotInterval = undefined;
        }

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = undefined;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }

        console.log('Memory leak detection stopped');
    }

    // Helper methods
    private generateObjectId(): string {
        return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateSuspicionId(): string {
        return `suspicion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private updateSuspiciousObjects(analysis: MemoryAnalysis): void {
        // Update the suspicious objects based on the latest analysis
        for (const obj of analysis.suspiciousObjects) {
            this.suspiciousObjects.set(obj.id, obj);
        }
    }

    private detectMemoryLeaks(analysis: MemoryAnalysis): void {
        // This method would implement advanced leak detection algorithms
        // based on the analysis results
    }

    private generateRecommendations(analysis: MemoryAnalysis): void {
        // Update recommendations based on analysis
        const newRecommendations = this.generateMemoryRecommendations();
        this.recommendations.push(...newRecommendations);

        // Remove duplicates and limit count
        const uniqueRecommendations = new Map();
        for (const rec of this.recommendations) {
            uniqueRecommendations.set(rec.title, rec);
        }
        this.recommendations = Array.from(uniqueRecommendations.values()).slice(-this.config.maxRecommendations);
    }
}

/**
 * Factory function to create memory leak detector
 */
export function createMemoryLeakDetector(
    fx: FXCore,
    errorManager?: ErrorHandlingManager,
    performanceManager?: PerformanceMonitoringManager
): MemoryLeakDetector {
    const detector = new MemoryLeakDetector(fx, errorManager, performanceManager);

    // Attach to FX system
    const memoryNode = fx.proxy('system.memory.leakDetection');
    memoryNode.val({
        detector,
        trackObject: detector.trackObject.bind(detector),
        untrackObject: detector.untrackObject.bind(detector),
        forceAnalysis: detector.forceAnalysis.bind(detector),
        getStatus: detector.getMemoryLeakStatus.bind(detector),
        stop: detector.stop.bind(detector)
    });

    return detector;
}

export default {
    MemoryLeakDetector,
    LeakType,
    createMemoryLeakDetector
};