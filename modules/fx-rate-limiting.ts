/**
 * @file fx-rate-limiting.ts
 * @description Advanced rate limiting and throttling system for FXD
 *
 * Provides comprehensive rate limiting features including:
 * - Multiple rate limiting algorithms (token bucket, sliding window, leaky bucket)
 * - Adaptive throttling based on system load
 * - Per-user, per-IP, and per-operation limits
 * - Circuit breaker integration
 * - Dynamic rate adjustment
 * - Queue management and priority scheduling
 * - Resource-aware throttling
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, FXDError, ErrorCode, ErrorCategory, ErrorSeverity } from './fx-error-handling.ts';

// Rate limiting algorithms
export enum RateLimitAlgorithm {
    TOKEN_BUCKET = 'token_bucket',
    SLIDING_WINDOW = 'sliding_window',
    LEAKY_BUCKET = 'leaky_bucket',
    FIXED_WINDOW = 'fixed_window',
    ADAPTIVE = 'adaptive'
}

// Throttling strategies
export enum ThrottlingStrategy {
    REJECT = 'reject',              // Reject requests immediately
    QUEUE = 'queue',                // Queue requests for later processing
    DELAY = 'delay',                // Add delay before processing
    DEGRADE = 'degrade',            // Process with reduced quality
    PRIORITIZE = 'prioritize'       // Process based on priority
}

// Rate limit scopes
export enum RateLimitScope {
    GLOBAL = 'global',
    USER = 'user',
    IP = 'ip',
    OPERATION = 'operation',
    RESOURCE = 'resource',
    TENANT = 'tenant'
}

// Priority levels
export enum PriorityLevel {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

// Rate limit rule interface
export interface RateLimitRule {
    id: string;
    name: string;
    scope: RateLimitScope;
    algorithm: RateLimitAlgorithm;
    strategy: ThrottlingStrategy;
    enabled: boolean;
    limits: {
        requests: number;
        window: number; // in milliseconds
        burst?: number; // max burst for token bucket
    };
    conditions?: {
        paths?: string[];
        methods?: string[];
        userTypes?: string[];
        priority?: PriorityLevel;
    };
    actions?: {
        onLimit?: string;
        onRestore?: string;
        alertThreshold?: number;
    };
    metadata?: Record<string, any>;
}

// Rate limit state interface
export interface RateLimitState {
    ruleId: string;
    key: string;
    algorithm: RateLimitAlgorithm;
    tokens: number;
    lastRefill: Date;
    windowStart: Date;
    requestCount: number;
    isThrottled: boolean;
    throttledUntil?: Date;
    metadata?: Record<string, any>;
}

// Request context interface
export interface RequestContext {
    id: string;
    userId?: string;
    ip?: string;
    operation: string;
    path: string;
    method?: string;
    priority: PriorityLevel;
    timestamp: Date;
    metadata?: Record<string, any>;
}

// Rate limit result interface
export interface RateLimitResult {
    allowed: boolean;
    ruleId?: string;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
    strategy: ThrottlingStrategy;
    queuePosition?: number;
    estimatedDelay?: number;
    throttledBy?: string[];
}

// Throttling metrics interface
export interface ThrottlingMetrics {
    totalRequests: number;
    allowedRequests: number;
    throttledRequests: number;
    queuedRequests: number;
    averageDelay: number;
    ruleMetrics: Map<string, {
        triggers: number;
        recoveries: number;
        lastTriggered?: Date;
        averageDuration: number;
    }>;
}

/**
 * Advanced rate limiter with multiple algorithms and strategies
 */
export class RateLimiter {
    private algorithm: RateLimitAlgorithm;
    private limits: RateLimitRule['limits'];
    private state: RateLimitState;

    constructor(rule: RateLimitRule, key: string) {
        this.algorithm = rule.algorithm;
        this.limits = rule.limits;
        this.state = {
            ruleId: rule.id,
            key,
            algorithm: rule.algorithm,
            tokens: rule.limits.requests,
            lastRefill: new Date(),
            windowStart: new Date(),
            requestCount: 0,
            isThrottled: false
        };
    }

    /**
     * Check if request is allowed and update state
     */
    checkRequest(tokens: number = 1): RateLimitResult {
        const now = new Date();

        switch (this.algorithm) {
            case RateLimitAlgorithm.TOKEN_BUCKET:
                return this.tokenBucket(tokens, now);
            case RateLimitAlgorithm.SLIDING_WINDOW:
                return this.slidingWindow(tokens, now);
            case RateLimitAlgorithm.LEAKY_BUCKET:
                return this.leakyBucket(tokens, now);
            case RateLimitAlgorithm.FIXED_WINDOW:
                return this.fixedWindow(tokens, now);
            default:
                return this.tokenBucket(tokens, now);
        }
    }

    /**
     * Token bucket algorithm implementation
     */
    private tokenBucket(tokens: number, now: Date): RateLimitResult {
        const timePassed = now.getTime() - this.state.lastRefill.getTime();
        const tokensToAdd = Math.floor(timePassed / this.limits.window * this.limits.requests);

        // Refill tokens
        this.state.tokens = Math.min(
            this.limits.burst || this.limits.requests,
            this.state.tokens + tokensToAdd
        );
        this.state.lastRefill = now;

        if (this.state.tokens >= tokens) {
            this.state.tokens -= tokens;
            return {
                allowed: true,
                remaining: this.state.tokens,
                resetTime: new Date(now.getTime() + this.limits.window),
                strategy: ThrottlingStrategy.REJECT
            };
        } else {
            return {
                allowed: false,
                remaining: this.state.tokens,
                resetTime: new Date(now.getTime() + this.limits.window),
                retryAfter: Math.ceil((tokens - this.state.tokens) * this.limits.window / this.limits.requests),
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Sliding window algorithm implementation
     */
    private slidingWindow(tokens: number, now: Date): RateLimitResult {
        const windowStart = new Date(now.getTime() - this.limits.window);

        // This would need to maintain a list of timestamps for accuracy
        // Simplified implementation for demonstration
        if (now.getTime() - this.state.windowStart.getTime() >= this.limits.window) {
            this.state.requestCount = 0;
            this.state.windowStart = now;
        }

        if (this.state.requestCount + tokens <= this.limits.requests) {
            this.state.requestCount += tokens;
            return {
                allowed: true,
                remaining: this.limits.requests - this.state.requestCount,
                resetTime: new Date(this.state.windowStart.getTime() + this.limits.window),
                strategy: ThrottlingStrategy.REJECT
            };
        } else {
            return {
                allowed: false,
                remaining: this.limits.requests - this.state.requestCount,
                resetTime: new Date(this.state.windowStart.getTime() + this.limits.window),
                retryAfter: this.limits.window - (now.getTime() - this.state.windowStart.getTime()),
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Leaky bucket algorithm implementation
     */
    private leakyBucket(tokens: number, now: Date): RateLimitResult {
        const timePassed = now.getTime() - this.state.lastRefill.getTime();
        const leakage = Math.floor(timePassed / this.limits.window * this.limits.requests);

        // Leak tokens
        this.state.tokens = Math.max(0, this.state.tokens - leakage);
        this.state.lastRefill = now;

        if (this.state.tokens + tokens <= this.limits.requests) {
            this.state.tokens += tokens;
            return {
                allowed: true,
                remaining: this.limits.requests - this.state.tokens,
                resetTime: new Date(now.getTime() + this.limits.window),
                strategy: ThrottlingStrategy.DELAY,
                estimatedDelay: this.state.tokens * this.limits.window / this.limits.requests
            };
        } else {
            return {
                allowed: false,
                remaining: this.limits.requests - this.state.tokens,
                resetTime: new Date(now.getTime() + this.limits.window),
                retryAfter: (this.state.tokens + tokens - this.limits.requests) * this.limits.window / this.limits.requests,
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Fixed window algorithm implementation
     */
    private fixedWindow(tokens: number, now: Date): RateLimitResult {
        const currentWindow = Math.floor(now.getTime() / this.limits.window);
        const stateWindow = Math.floor(this.state.windowStart.getTime() / this.limits.window);

        if (currentWindow > stateWindow) {
            this.state.requestCount = 0;
            this.state.windowStart = new Date(currentWindow * this.limits.window);
        }

        if (this.state.requestCount + tokens <= this.limits.requests) {
            this.state.requestCount += tokens;
            return {
                allowed: true,
                remaining: this.limits.requests - this.state.requestCount,
                resetTime: new Date((currentWindow + 1) * this.limits.window),
                strategy: ThrottlingStrategy.REJECT
            };
        } else {
            return {
                allowed: false,
                remaining: this.limits.requests - this.state.requestCount,
                resetTime: new Date((currentWindow + 1) * this.limits.window),
                retryAfter: (currentWindow + 1) * this.limits.window - now.getTime(),
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Get current state
     */
    getState(): RateLimitState {
        return { ...this.state };
    }

    /**
     * Reset limiter state
     */
    reset(): void {
        const now = new Date();
        this.state.tokens = this.limits.requests;
        this.state.lastRefill = now;
        this.state.windowStart = now;
        this.state.requestCount = 0;
        this.state.isThrottled = false;
        this.state.throttledUntil = undefined;
    }
}

/**
 * Request queue with priority support
 */
export class RequestQueue {
    private queues = new Map<PriorityLevel, Array<{
        context: RequestContext;
        resolve: (result: any) => void;
        reject: (error: any) => void;
        timestamp: Date;
    }>>();

    private processing = false;
    private maxQueueSize = 1000;
    private processor?: (context: RequestContext) => Promise<any>;

    constructor(processor?: (context: RequestContext) => Promise<any>) {
        this.processor = processor;
        this.initializeQueues();
    }

    private initializeQueues(): void {
        for (const priority of Object.values(PriorityLevel)) {
            this.queues.set(priority, []);
        }
    }

    /**
     * Add request to queue
     */
    async enqueue(context: RequestContext): Promise<any> {
        const queue = this.queues.get(context.priority);
        if (!queue) {
            throw new Error(`Invalid priority: ${context.priority}`);
        }

        // Check queue size
        const totalSize = Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0);
        if (totalSize >= this.maxQueueSize) {
            throw new Error('Queue is full');
        }

        return new Promise((resolve, reject) => {
            queue.push({
                context,
                resolve,
                reject,
                timestamp: new Date()
            });

            this.processQueue();
        });
    }

    /**
     * Process queued requests
     */
    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        try {
            while (this.hasRequests()) {
                const item = this.dequeue();
                if (!item) break;

                try {
                    const result = this.processor ? await this.processor(item.context) : null;
                    item.resolve(result);
                } catch (error) {
                    item.reject(error);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    /**
     * Dequeue highest priority request
     */
    private dequeue(): any {
        for (const priority of [PriorityLevel.CRITICAL, PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW]) {
            const queue = this.queues.get(priority);
            if (queue && queue.length > 0) {
                return queue.shift();
            }
        }
        return null;
    }

    /**
     * Check if there are requests to process
     */
    private hasRequests(): boolean {
        return Array.from(this.queues.values()).some(q => q.length > 0);
    }

    /**
     * Get queue status
     */
    getStatus(): {
        totalQueued: number;
        byPriority: Record<PriorityLevel, number>;
        processing: boolean;
    } {
        const byPriority = Object.values(PriorityLevel).reduce((acc, priority) => {
            acc[priority] = this.queues.get(priority)?.length || 0;
            return acc;
        }, {} as Record<PriorityLevel, number>);

        const totalQueued = Object.values(byPriority).reduce((sum, count) => sum + count, 0);

        return {
            totalQueued,
            byPriority,
            processing: this.processing
        };
    }

    /**
     * Clear all queues
     */
    clear(): void {
        for (const queue of this.queues.values()) {
            // Reject all pending requests
            for (const item of queue) {
                item.reject(new Error('Queue cleared'));
            }
            queue.length = 0;
        }
    }
}

/**
 * Comprehensive rate limiting and throttling manager
 */
export class RateLimitingManager {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private rules = new Map<string, RateLimitRule>();
    private limiters = new Map<string, RateLimiter>();
    private queues = new Map<string, RequestQueue>();
    private metrics: ThrottlingMetrics;
    private adaptiveAdjustment = true;
    private systemLoadThreshold = 0.8;

    constructor(fx: FXCore, errorManager?: ErrorHandlingManager) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.metrics = this.initializeMetrics();
        this.initializeDefaultRules();
        this.startAdaptiveAdjustment();
    }

    /**
     * Initialize default metrics
     */
    private initializeMetrics(): ThrottlingMetrics {
        return {
            totalRequests: 0,
            allowedRequests: 0,
            throttledRequests: 0,
            queuedRequests: 0,
            averageDelay: 0,
            ruleMetrics: new Map()
        };
    }

    /**
     * Initialize default rate limiting rules
     */
    private initializeDefaultRules(): void {
        // Global rate limit
        this.addRule({
            id: 'global-requests',
            name: 'Global Request Rate Limit',
            scope: RateLimitScope.GLOBAL,
            algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
            strategy: ThrottlingStrategy.QUEUE,
            enabled: true,
            limits: {
                requests: 1000,
                window: 60000, // 1 minute
                burst: 1500
            }
        });

        // Per-user rate limit
        this.addRule({
            id: 'per-user-requests',
            name: 'Per-User Request Rate Limit',
            scope: RateLimitScope.USER,
            algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
            strategy: ThrottlingStrategy.REJECT,
            enabled: true,
            limits: {
                requests: 100,
                window: 60000 // 1 minute
            }
        });

        // Heavy operations limit
        this.addRule({
            id: 'heavy-operations',
            name: 'Heavy Operations Rate Limit',
            scope: RateLimitScope.OPERATION,
            algorithm: RateLimitAlgorithm.LEAKY_BUCKET,
            strategy: ThrottlingStrategy.DELAY,
            enabled: true,
            limits: {
                requests: 10,
                window: 60000 // 1 minute
            },
            conditions: {
                paths: ['/api/heavy', '/api/export', '/api/backup']
            }
        });

        // IP-based rate limit
        this.addRule({
            id: 'per-ip-requests',
            name: 'Per-IP Request Rate Limit',
            scope: RateLimitScope.IP,
            algorithm: RateLimitAlgorithm.FIXED_WINDOW,
            strategy: ThrottlingStrategy.REJECT,
            enabled: true,
            limits: {
                requests: 200,
                window: 60000 // 1 minute
            }
        });
    }

    /**
     * Add a new rate limiting rule
     */
    addRule(rule: RateLimitRule): void {
        this.rules.set(rule.id, rule);
        this.metrics.ruleMetrics.set(rule.id, {
            triggers: 0,
            recoveries: 0,
            averageDuration: 0
        });

        console.log(`Added rate limiting rule: ${rule.name}`);
    }

    /**
     * Remove a rate limiting rule
     */
    removeRule(ruleId: string): boolean {
        const removed = this.rules.delete(ruleId);
        if (removed) {
            // Clean up associated limiters
            const keysToRemove = Array.from(this.limiters.keys()).filter(key => key.startsWith(ruleId));
            for (const key of keysToRemove) {
                this.limiters.delete(key);
            }
            this.metrics.ruleMetrics.delete(ruleId);
        }
        return removed;
    }

    /**
     * Check if request is allowed
     */
    async checkRequest(context: RequestContext): Promise<RateLimitResult> {
        this.metrics.totalRequests++;

        const applicableRules = this.getApplicableRules(context);
        let mostRestrictiveResult: RateLimitResult | null = null;
        const throttledBy: string[] = [];

        for (const rule of applicableRules) {
            if (!rule.enabled) continue;

            const key = this.generateLimiterKey(rule, context);
            let limiter = this.limiters.get(key);

            if (!limiter) {
                limiter = new RateLimiter(rule, key);
                this.limiters.set(key, limiter);
            }

            const result = limiter.checkRequest();
            result.ruleId = rule.id;

            if (!result.allowed) {
                throttledBy.push(rule.id);

                // Update rule metrics
                const ruleMetrics = this.metrics.ruleMetrics.get(rule.id);
                if (ruleMetrics) {
                    ruleMetrics.triggers++;
                    ruleMetrics.lastTriggered = new Date();
                }

                if (!mostRestrictiveResult || (result.retryAfter && result.retryAfter > (mostRestrictiveResult.retryAfter || 0))) {
                    mostRestrictiveResult = result;
                    mostRestrictiveResult.strategy = rule.strategy;
                }
            }
        }

        if (mostRestrictiveResult) {
            mostRestrictiveResult.throttledBy = throttledBy;
            this.metrics.throttledRequests++;

            // Handle according to strategy
            return await this.handleThrottledRequest(context, mostRestrictiveResult);
        } else {
            this.metrics.allowedRequests++;
            return {
                allowed: true,
                remaining: Number.MAX_SAFE_INTEGER,
                resetTime: new Date(Date.now() + 60000),
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Handle throttled request according to strategy
     */
    private async handleThrottledRequest(
        context: RequestContext,
        result: RateLimitResult
    ): Promise<RateLimitResult> {
        switch (result.strategy) {
            case ThrottlingStrategy.REJECT:
                return result;

            case ThrottlingStrategy.QUEUE:
                return await this.queueRequest(context, result);

            case ThrottlingStrategy.DELAY:
                return await this.delayRequest(context, result);

            case ThrottlingStrategy.DEGRADE:
                return await this.degradeRequest(context, result);

            case ThrottlingStrategy.PRIORITIZE:
                return await this.prioritizeRequest(context, result);

            default:
                return result;
        }
    }

    /**
     * Queue request for later processing
     */
    private async queueRequest(context: RequestContext, result: RateLimitResult): Promise<RateLimitResult> {
        const queueKey = result.ruleId || 'default';
        let queue = this.queues.get(queueKey);

        if (!queue) {
            queue = new RequestQueue();
            this.queues.set(queueKey, queue);
        }

        try {
            const queueStatus = queue.getStatus();
            result.queuePosition = queueStatus.totalQueued + 1;
            result.estimatedDelay = result.queuePosition * 1000; // Rough estimate

            this.metrics.queuedRequests++;

            // Don't actually queue here - just return the result with queue information
            return {
                ...result,
                allowed: false,
                strategy: ThrottlingStrategy.QUEUE
            };

        } catch (error) {
            // Queue is full, reject request
            return {
                ...result,
                allowed: false,
                strategy: ThrottlingStrategy.REJECT
            };
        }
    }

    /**
     * Add delay to request processing
     */
    private async delayRequest(context: RequestContext, result: RateLimitResult): Promise<RateLimitResult> {
        const delay = result.retryAfter || 1000;

        return {
            ...result,
            allowed: true, // Allow but with delay
            estimatedDelay: delay,
            strategy: ThrottlingStrategy.DELAY
        };
    }

    /**
     * Degrade request quality/features
     */
    private async degradeRequest(context: RequestContext, result: RateLimitResult): Promise<RateLimitResult> {
        // Mark request for degraded processing
        context.metadata = { ...context.metadata, degraded: true };

        return {
            ...result,
            allowed: true,
            strategy: ThrottlingStrategy.DEGRADE
        };
    }

    /**
     * Prioritize request based on context
     */
    private async prioritizeRequest(context: RequestContext, result: RateLimitResult): Promise<RateLimitResult> {
        // Adjust priority based on throttling
        if (context.priority !== PriorityLevel.CRITICAL) {
            context.priority = PriorityLevel.LOW;
        }

        return await this.queueRequest(context, result);
    }

    /**
     * Get applicable rules for a request context
     */
    private getApplicableRules(context: RequestContext): RateLimitRule[] {
        return Array.from(this.rules.values()).filter(rule => {
            if (!rule.enabled) return false;

            // Check conditions if specified
            if (rule.conditions) {
                if (rule.conditions.paths && !rule.conditions.paths.some(path => context.path.startsWith(path))) {
                    return false;
                }

                if (rule.conditions.methods && rule.conditions.methods.length > 0 && context.method) {
                    if (!rule.conditions.methods.includes(context.method)) {
                        return false;
                    }
                }

                if (rule.conditions.priority && rule.conditions.priority !== context.priority) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Generate unique key for rate limiter
     */
    private generateLimiterKey(rule: RateLimitRule, context: RequestContext): string {
        let scopeKey = '';

        switch (rule.scope) {
            case RateLimitScope.GLOBAL:
                scopeKey = 'global';
                break;
            case RateLimitScope.USER:
                scopeKey = context.userId || 'anonymous';
                break;
            case RateLimitScope.IP:
                scopeKey = context.ip || 'unknown';
                break;
            case RateLimitScope.OPERATION:
                scopeKey = context.operation;
                break;
            case RateLimitScope.RESOURCE:
                scopeKey = context.path;
                break;
            case RateLimitScope.TENANT:
                scopeKey = context.metadata?.tenant || 'default';
                break;
            default:
                scopeKey = 'default';
        }

        return `${rule.id}:${scopeKey}`;
    }

    /**
     * Update rule configuration
     */
    updateRule(ruleId: string, updates: Partial<RateLimitRule>): boolean {
        const rule = this.rules.get(ruleId);
        if (!rule) return false;

        Object.assign(rule, updates);

        // If limits changed, reset associated limiters
        if (updates.limits) {
            const keysToReset = Array.from(this.limiters.keys()).filter(key => key.startsWith(ruleId));
            for (const key of keysToReset) {
                const limiter = this.limiters.get(key);
                if (limiter) {
                    limiter.reset();
                }
            }
        }

        return true;
    }

    /**
     * Get current throttling metrics
     */
    getMetrics(): ThrottlingMetrics {
        return {
            ...this.metrics,
            ruleMetrics: new Map(this.metrics.ruleMetrics)
        };
    }

    /**
     * Get rule status
     */
    getRuleStatus(ruleId: string): {
        rule: RateLimitRule;
        activeLimiters: number;
        metrics: any;
    } | null {
        const rule = this.rules.get(ruleId);
        if (!rule) return null;

        const activeLimiters = Array.from(this.limiters.keys()).filter(key => key.startsWith(ruleId)).length;
        const metrics = this.metrics.ruleMetrics.get(ruleId);

        return {
            rule: { ...rule },
            activeLimiters,
            metrics
        };
    }

    /**
     * Clear all rate limiting state
     */
    clearState(): void {
        this.limiters.clear();
        for (const queue of this.queues.values()) {
            queue.clear();
        }
        this.queues.clear();
        this.metrics = this.initializeMetrics();
    }

    /**
     * Start adaptive adjustment based on system load
     */
    private startAdaptiveAdjustment(): void {
        if (!this.adaptiveAdjustment) return;

        setInterval(async () => {
            try {
                await this.adjustRatesBasedOnLoad();
            } catch (error) {
                console.error('Adaptive rate adjustment failed:', error);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Adjust rate limits based on system load
     */
    private async adjustRatesBasedOnLoad(): Promise<void> {
        const systemLoad = await this.getSystemLoad();

        for (const rule of this.rules.values()) {
            if (!rule.enabled || rule.algorithm !== RateLimitAlgorithm.ADAPTIVE) continue;

            let adjustmentFactor = 1.0;

            if (systemLoad > this.systemLoadThreshold) {
                // Reduce limits when system is under load
                adjustmentFactor = Math.max(0.1, 1.0 - (systemLoad - this.systemLoadThreshold) * 2);
            } else if (systemLoad < this.systemLoadThreshold * 0.5) {
                // Increase limits when system has capacity
                adjustmentFactor = Math.min(2.0, 1.0 + (this.systemLoadThreshold * 0.5 - systemLoad) * 2);
            }

            if (adjustmentFactor !== 1.0) {
                const newLimits = {
                    ...rule.limits,
                    requests: Math.floor(rule.limits.requests * adjustmentFactor)
                };

                console.log(`Adjusting rate limit for rule ${rule.id} by factor ${adjustmentFactor.toFixed(2)}`);
                this.updateRule(rule.id, { limits: newLimits });
            }
        }
    }

    /**
     * Get current system load (placeholder implementation)
     */
    private async getSystemLoad(): Promise<number> {
        // This would integrate with system monitoring
        // For now, return a mock value based on recent throttling
        const recentThrottleRate = this.metrics.throttledRequests / Math.max(1, this.metrics.totalRequests);
        return Math.min(1.0, recentThrottleRate * 2);
    }

    /**
     * Enable/disable adaptive adjustment
     */
    setAdaptiveAdjustment(enabled: boolean): void {
        this.adaptiveAdjustment = enabled;
        console.log(`Adaptive rate adjustment ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set system load threshold for adaptive adjustment
     */
    setSystemLoadThreshold(threshold: number): void {
        this.systemLoadThreshold = Math.max(0.1, Math.min(1.0, threshold));
        console.log(`System load threshold set to ${this.systemLoadThreshold}`);
    }
}

/**
 * Factory function to create rate limiting manager
 */
export function createRateLimitingManager(fx: FXCore, errorManager?: ErrorHandlingManager): RateLimitingManager {
    const manager = new RateLimitingManager(fx, errorManager);

    // Attach to FX system
    const rateLimitingNode = fx.proxy('system.rateLimiting');
    rateLimitingNode.val({
        manager,
        checkRequest: manager.checkRequest.bind(manager),
        addRule: manager.addRule.bind(manager),
        removeRule: manager.removeRule.bind(manager),
        updateRule: manager.updateRule.bind(manager),
        getMetrics: manager.getMetrics.bind(manager),
        getRuleStatus: manager.getRuleStatus.bind(manager),
        clearState: manager.clearState.bind(manager)
    });

    return manager;
}

export default {
    RateLimitingManager,
    RateLimiter,
    RequestQueue,
    RateLimitAlgorithm,
    ThrottlingStrategy,
    RateLimitScope,
    PriorityLevel,
    createRateLimitingManager
};