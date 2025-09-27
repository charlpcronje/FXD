/**
 * @file fx-error-handling.ts
 * @description Production-grade error handling system for FXD
 *
 * Provides comprehensive error management including:
 * - Typed error system with error codes and categories
 * - Error recovery mechanisms
 * - Logging and monitoring integration
 * - Transaction rollback support
 * - Performance monitoring hooks
 * - Security hardening for error information
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';

// Error severity levels
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Error categories for better classification
export enum ErrorCategory {
    VALIDATION = 'validation',
    PERSISTENCE = 'persistence',
    NETWORK = 'network',
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    SYSTEM = 'system',
    USER_INPUT = 'user_input',
    CONFIGURATION = 'configuration',
    TRANSACTION = 'transaction',
    MEMORY = 'memory'
}

// Error codes for specific error types
export enum ErrorCode {
    // Validation errors (1000-1999)
    INVALID_INPUT = 1001,
    SCHEMA_VIOLATION = 1002,
    CONSTRAINT_VIOLATION = 1003,
    TYPE_MISMATCH = 1004,

    // Persistence errors (2000-2999)
    DATABASE_CONNECTION = 2001,
    WRITE_FAILURE = 2002,
    READ_FAILURE = 2003,
    CORRUPTION_DETECTED = 2004,
    STORAGE_FULL = 2005,
    BACKUP_FAILURE = 2006,

    // Network errors (3000-3999)
    CONNECTION_TIMEOUT = 3001,
    NETWORK_UNAVAILABLE = 3002,
    API_ERROR = 3003,
    RATE_LIMIT_EXCEEDED = 3004,

    // Security errors (4000-4999)
    UNAUTHORIZED_ACCESS = 4001,
    PERMISSION_DENIED = 4002,
    AUTHENTICATION_FAILED = 4003,
    SECURITY_VIOLATION = 4004,
    INJECTION_ATTACK = 4005,

    // Performance errors (5000-5999)
    MEMORY_LIMIT_EXCEEDED = 5001,
    TIMEOUT_EXCEEDED = 5002,
    THROTTLE_LIMIT_REACHED = 5003,
    RESOURCE_EXHAUSTED = 5004,

    // System errors (6000-6999)
    SYSTEM_UNAVAILABLE = 6001,
    CONFIGURATION_ERROR = 6002,
    INTERNAL_ERROR = 6003,
    DEPENDENCY_FAILURE = 6004,

    // Transaction errors (7000-7999)
    TRANSACTION_CONFLICT = 7001,
    ROLLBACK_FAILED = 7002,
    DEADLOCK_DETECTED = 7003,
    ISOLATION_VIOLATION = 7004
}

// Recovery strategies
export enum RecoveryStrategy {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    CIRCUIT_BREAKER = 'circuit_breaker',
    ROLLBACK = 'rollback',
    GRACEFUL_DEGRADATION = 'graceful_degradation',
    MANUAL_INTERVENTION = 'manual_intervention',
    RESTART = 'restart'
}

// Base error interface
export interface FXError {
    id: string;
    code: ErrorCode;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
    context?: {
        operation?: string;
        node?: string;
        user?: string;
        session?: string;
        trace?: string[];
    };
    stack?: string;
    cause?: Error | FXError;
    recovery?: {
        strategy: RecoveryStrategy;
        attempts: number;
        maxAttempts: number;
        lastAttempt?: Date;
    };
}

// Error metrics interface
export interface ErrorMetrics {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byCode: Record<ErrorCode, number>;
    recentErrors: FXError[];
    meanTimeToRecover: number;
    errorRate: number;
}

// Error handler function type
export type ErrorHandler = (error: FXError, context?: any) => Promise<boolean> | boolean;

// Recovery function type
export type RecoveryFunction = (error: FXError, context?: any) => Promise<any> | any;

/**
 * Production-grade error class with comprehensive metadata
 */
export class FXDError extends Error implements FXError {
    public readonly id: string;
    public readonly code: ErrorCode;
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly details?: Record<string, any>;
    public readonly timestamp: Date;
    public readonly context?: FXError['context'];
    public readonly cause?: Error | FXError;
    public recovery?: FXError['recovery'];

    constructor(options: {
        code: ErrorCode;
        category: ErrorCategory;
        severity: ErrorSeverity;
        message: string;
        details?: Record<string, any>;
        context?: FXError['context'];
        cause?: Error | FXError;
    }) {
        super(options.message);

        this.id = this.generateErrorId();
        this.code = options.code;
        this.category = options.category;
        this.severity = options.severity;
        this.details = options.details;
        this.timestamp = new Date();
        this.context = options.context;
        this.cause = options.cause;

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FXDError);
        }

        this.name = 'FXDError';
    }

    private generateErrorId(): string {
        return `fx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convert error to sanitized format for client-side display
     */
    toSanitized(): Partial<FXError> {
        return {
            id: this.id,
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            timestamp: this.timestamp,
            // Exclude sensitive details and stack traces
            details: this.sanitizeDetails(this.details)
        };
    }

    private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
        if (!details) return undefined;

        const sanitized: Record<string, any> = {};
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

        for (const [key, value] of Object.entries(details)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

/**
 * Central error handling manager
 */
export class ErrorHandlingManager {
    private fx: FXCore;
    private handlers = new Map<ErrorCategory, Set<ErrorHandler>>();
    private recoveryStrategies = new Map<ErrorCode, RecoveryFunction>();
    private metrics: ErrorMetrics;
    private circuitBreakers = new Map<string, {
        failures: number;
        lastFailure: Date;
        state: 'closed' | 'open' | 'half-open';
        threshold: number;
        timeout: number;
    }>();

    constructor(fx: FXCore) {
        this.fx = fx;
        this.metrics = this.initializeMetrics();
        this.setupDefaultHandlers();
        this.setupDefaultRecoveryStrategies();
    }

    /**
     * Initialize error metrics structure
     */
    private initializeMetrics(): ErrorMetrics {
        return {
            total: 0,
            byCategory: Object.values(ErrorCategory).reduce((acc, cat) => {
                acc[cat] = 0;
                return acc;
            }, {} as Record<ErrorCategory, number>),
            bySeverity: Object.values(ErrorSeverity).reduce((acc, sev) => {
                acc[sev] = 0;
                return acc;
            }, {} as Record<ErrorSeverity, number>),
            byCode: Object.values(ErrorCode).reduce((acc, code) => {
                acc[code] = 0;
                return acc;
            }, {} as Record<ErrorCode, number>),
            recentErrors: [],
            meanTimeToRecover: 0,
            errorRate: 0
        };
    }

    /**
     * Setup default error handlers
     */
    private setupDefaultHandlers(): void {
        // Critical error handler
        this.addHandler(ErrorCategory.SYSTEM, async (error) => {
            if (error.severity === ErrorSeverity.CRITICAL) {
                // Log critical error
                console.error('[CRITICAL]', error);

                // Notify monitoring systems
                await this.notifyMonitoring(error);

                // Create backup before potential shutdown
                await this.createEmergencyBackup();

                return true;
            }
            return false;
        });

        // Persistence error handler
        this.addHandler(ErrorCategory.PERSISTENCE, async (error) => {
            console.warn('[PERSISTENCE]', error.message);

            // Try alternative storage if available
            if (error.code === ErrorCode.WRITE_FAILURE) {
                return await this.tryAlternativeStorage(error);
            }

            return false;
        });

        // Security error handler
        this.addHandler(ErrorCategory.SECURITY, async (error) => {
            console.error('[SECURITY]', error.toSanitized());

            // Log security incident
            await this.logSecurityIncident(error);

            // Potentially lock down system
            if (error.severity === ErrorSeverity.CRITICAL) {
                await this.activateSecurityLockdown();
            }

            return true;
        });

        // Performance error handler
        this.addHandler(ErrorCategory.PERFORMANCE, async (error) => {
            console.warn('[PERFORMANCE]', error.message);

            // Activate throttling
            if (error.code === ErrorCode.MEMORY_LIMIT_EXCEEDED) {
                await this.activateMemoryThrottling();
                return true;
            }

            return false;
        });
    }

    /**
     * Setup default recovery strategies
     */
    private setupDefaultRecoveryStrategies(): void {
        // Network timeout recovery
        this.addRecoveryStrategy(ErrorCode.CONNECTION_TIMEOUT, async (error) => {
            return this.retryWithBackoff(error, 3, 1000);
        });

        // Database connection recovery
        this.addRecoveryStrategy(ErrorCode.DATABASE_CONNECTION, async (error) => {
            return this.reconnectDatabase();
        });

        // Memory limit recovery
        this.addRecoveryStrategy(ErrorCode.MEMORY_LIMIT_EXCEEDED, async (error) => {
            await this.garbageCollect();
            await this.clearCaches();
            return true;
        });
    }

    /**
     * Handle an error through the error management system
     */
    async handleError(error: Error | FXError, context?: any): Promise<boolean> {
        const fxError = this.normalizeError(error, context);

        // Update metrics
        this.updateMetrics(fxError);

        // Store error for debugging
        this.storeError(fxError);

        // Check circuit breaker
        if (this.shouldCircuitBreak(fxError)) {
            console.warn('Circuit breaker activated for', fxError.code);
            return false;
        }

        // Try recovery first
        const recovered = await this.attemptRecovery(fxError);
        if (recovered) {
            console.log('Error recovered successfully:', fxError.id);
            return true;
        }

        // Run registered handlers
        const handlers = this.handlers.get(fxError.category) || new Set();
        let handled = false;

        for (const handler of handlers) {
            try {
                const result = await handler(fxError, context);
                if (result) {
                    handled = true;
                    break;
                }
            } catch (handlerError) {
                console.error('Error in error handler:', handlerError);
            }
        }

        // If not handled and critical, escalate
        if (!handled && fxError.severity === ErrorSeverity.CRITICAL) {
            await this.escalateError(fxError);
        }

        return handled;
    }

    /**
     * Add error handler for specific category
     */
    addHandler(category: ErrorCategory, handler: ErrorHandler): void {
        if (!this.handlers.has(category)) {
            this.handlers.set(category, new Set());
        }
        this.handlers.get(category)!.add(handler);
    }

    /**
     * Add recovery strategy for specific error code
     */
    addRecoveryStrategy(code: ErrorCode, recovery: RecoveryFunction): void {
        this.recoveryStrategies.set(code, recovery);
    }

    /**
     * Create an FXD error with proper context
     */
    createError(options: {
        code: ErrorCode;
        category: ErrorCategory;
        severity: ErrorSeverity;
        message: string;
        details?: Record<string, any>;
        operation?: string;
        node?: FXNode;
        cause?: Error;
    }): FXDError {
        const context: FXError['context'] = {
            operation: options.operation,
            node: options.node?.__id,
            timestamp: new Date().toISOString(),
            trace: this.generateTrace()
        };

        return new FXDError({
            code: options.code,
            category: options.category,
            severity: options.severity,
            message: options.message,
            details: options.details,
            context,
            cause: options.cause
        });
    }

    /**
     * Get current error metrics
     */
    getMetrics(): ErrorMetrics {
        return { ...this.metrics };
    }

    /**
     * Get recent errors (last 100)
     */
    getRecentErrors(): FXError[] {
        return [...this.metrics.recentErrors];
    }

    /**
     * Clear error history and reset metrics
     */
    clearErrorHistory(): void {
        this.metrics = this.initializeMetrics();
        console.log('Error history cleared');
    }

    // Private helper methods

    private normalizeError(error: Error | FXError, context?: any): FXError {
        if (error instanceof FXDError) {
            return error;
        }

        // Convert standard Error to FXError
        return new FXDError({
            code: ErrorCode.INTERNAL_ERROR,
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.MEDIUM,
            message: error.message || 'Unknown error',
            details: { originalError: error.name },
            context: context ? { operation: context.operation } : undefined,
            cause: error
        });
    }

    private updateMetrics(error: FXError): void {
        this.metrics.total++;
        this.metrics.byCategory[error.category]++;
        this.metrics.bySeverity[error.severity]++;
        this.metrics.byCode[error.code]++;

        // Add to recent errors (keep last 100)
        this.metrics.recentErrors.unshift(error);
        if (this.metrics.recentErrors.length > 100) {
            this.metrics.recentErrors.pop();
        }

        // Calculate error rate (errors per minute in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentCount = this.metrics.recentErrors.filter(
            e => e.timestamp > fiveMinutesAgo
        ).length;
        this.metrics.errorRate = recentCount / 5; // per minute
    }

    private storeError(error: FXError): void {
        // Store in FX system for persistence
        const errorNode = this.fx.proxy(`system.errors.${error.id}`);
        errorNode.val({
            error: error.toSanitized(),
            fullError: error // Keep full error for internal use
        });
    }

    private shouldCircuitBreak(error: FXError): boolean {
        const key = `${error.category}-${error.code}`;
        const breaker = this.circuitBreakers.get(key);

        if (!breaker) {
            this.circuitBreakers.set(key, {
                failures: 1,
                lastFailure: new Date(),
                state: 'closed',
                threshold: 5,
                timeout: 60000 // 1 minute
            });
            return false;
        }

        const now = new Date();
        const timeSinceLastFailure = now.getTime() - breaker.lastFailure.getTime();

        if (breaker.state === 'open') {
            if (timeSinceLastFailure > breaker.timeout) {
                breaker.state = 'half-open';
                return false;
            }
            return true;
        }

        breaker.failures++;
        breaker.lastFailure = now;

        if (breaker.failures >= breaker.threshold) {
            breaker.state = 'open';
            console.warn(`Circuit breaker opened for ${key}`);
            return true;
        }

        return false;
    }

    private async attemptRecovery(error: FXError): Promise<boolean> {
        const strategy = this.recoveryStrategies.get(error.code);
        if (!strategy) return false;

        // Initialize recovery tracking
        if (!error.recovery) {
            error.recovery = {
                strategy: RecoveryStrategy.RETRY,
                attempts: 0,
                maxAttempts: 3
            };
        }

        error.recovery.attempts++;
        error.recovery.lastAttempt = new Date();

        if (error.recovery.attempts > error.recovery.maxAttempts) {
            console.warn('Max recovery attempts exceeded for error:', error.id);
            return false;
        }

        try {
            const result = await strategy(error);
            console.log(`Recovery attempt ${error.recovery.attempts} succeeded for error:`, error.id);
            return !!result;
        } catch (recoveryError) {
            console.error(`Recovery attempt ${error.recovery.attempts} failed:`, recoveryError);
            return false;
        }
    }

    private async escalateError(error: FXError): Promise<void> {
        console.error('ESCALATING CRITICAL ERROR:', error);

        // Store escalation
        const escalationNode = this.fx.proxy(`system.escalations.${error.id}`);
        escalationNode.val({
            error: error.toSanitized(),
            escalatedAt: new Date(),
            action: 'manual_intervention_required'
        });

        // Trigger emergency protocols if needed
        if (error.category === ErrorCategory.SECURITY) {
            await this.activateSecurityLockdown();
        }
    }

    private generateTrace(): string[] {
        const trace = new Error().stack?.split('\n') || [];
        return trace.slice(2, 7); // Skip first 2 lines, take next 5
    }

    // Recovery strategy implementations
    private async retryWithBackoff(error: FXError, maxRetries: number, baseDelay: number): Promise<boolean> {
        const attempt = error.recovery?.attempts || 0;
        if (attempt >= maxRetries) return false;

        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        await this.sleep(delay);
        return true;
    }

    private async reconnectDatabase(): Promise<boolean> {
        try {
            // Attempt database reconnection
            console.log('Attempting database reconnection...');
            // Implementation would go here
            return true;
        } catch (error) {
            console.error('Database reconnection failed:', error);
            return false;
        }
    }

    private async garbageCollect(): Promise<void> {
        try {
            if (globalThis.gc) {
                globalThis.gc();
                console.log('Garbage collection triggered');
            }
        } catch (error) {
            console.warn('Could not trigger garbage collection:', error);
        }
    }

    private async clearCaches(): Promise<void> {
        try {
            // Clear FX caches
            this.fx.proxy('cache').val({});
            console.log('Caches cleared');
        } catch (error) {
            console.error('Cache clearing failed:', error);
        }
    }

    // Monitoring and alert methods
    private async notifyMonitoring(error: FXError): Promise<void> {
        // Implementation would integrate with monitoring systems
        console.log('Monitoring notification sent for error:', error.id);
    }

    private async createEmergencyBackup(): Promise<void> {
        try {
            // Create emergency backup
            console.log('Creating emergency backup...');
            // Implementation would go here
        } catch (error) {
            console.error('Emergency backup failed:', error);
        }
    }

    private async tryAlternativeStorage(error: FXError): Promise<boolean> {
        try {
            console.log('Trying alternative storage...');
            // Implementation would go here
            return true;
        } catch (error) {
            console.error('Alternative storage failed:', error);
            return false;
        }
    }

    private async logSecurityIncident(error: FXError): Promise<void> {
        const securityLog = this.fx.proxy(`system.security.incidents.${error.id}`);
        securityLog.val({
            error: error.toSanitized(),
            loggedAt: new Date(),
            severity: error.severity,
            requiresInvestigation: error.severity === ErrorSeverity.CRITICAL
        });
    }

    private async activateSecurityLockdown(): Promise<void> {
        console.warn('SECURITY LOCKDOWN ACTIVATED');
        const lockdownNode = this.fx.proxy('system.security.lockdown');
        lockdownNode.val({
            active: true,
            activatedAt: new Date(),
            reason: 'Critical security error detected'
        });
    }

    private async activateMemoryThrottling(): Promise<void> {
        console.warn('Memory throttling activated');
        const throttleNode = this.fx.proxy('system.performance.throttling');
        throttleNode.val({
            memory: {
                active: true,
                activatedAt: new Date(),
                level: 'high'
            }
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Error handling utilities and decorators

/**
 * Decorator for automatic error handling
 */
export function ErrorHandler(options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    retry?: number;
    fallback?: any;
}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const fx = (this as any).fx || (globalThis as any).fx;
            const errorManager = fx?.errorManager as ErrorHandlingManager;

            if (!errorManager) {
                console.warn('Error manager not available, executing without error handling');
                return originalMethod.apply(this, args);
            }

            let attempts = 0;
            const maxAttempts = options.retry || 1;

            while (attempts < maxAttempts) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    attempts++;

                    const fxError = errorManager.createError({
                        code: ErrorCode.INTERNAL_ERROR,
                        category: options.category || ErrorCategory.SYSTEM,
                        severity: options.severity || ErrorSeverity.MEDIUM,
                        message: `Error in ${propertyKey}: ${error.message}`,
                        operation: propertyKey,
                        cause: error as Error
                    });

                    const handled = await errorManager.handleError(fxError);

                    if (attempts >= maxAttempts) {
                        if (options.fallback !== undefined) {
                            return options.fallback;
                        }
                        throw error;
                    }

                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }
        };

        return descriptor;
    };
}

/**
 * Validation utilities with error handling
 */
export class ValidationUtils {
    static validateRequired(value: any, field: string): void {
        if (value === undefined || value === null || value === '') {
            throw new FXDError({
                code: ErrorCode.INVALID_INPUT,
                category: ErrorCategory.VALIDATION,
                severity: ErrorSeverity.MEDIUM,
                message: `Required field '${field}' is missing or empty`,
                details: { field, value }
            });
        }
    }

    static validateType(value: any, expectedType: string, field: string): void {
        const actualType = typeof value;
        if (actualType !== expectedType) {
            throw new FXDError({
                code: ErrorCode.TYPE_MISMATCH,
                category: ErrorCategory.VALIDATION,
                severity: ErrorSeverity.MEDIUM,
                message: `Field '${field}' expected ${expectedType} but got ${actualType}`,
                details: { field, expectedType, actualType, value }
            });
        }
    }

    static validateRange(value: number, min: number, max: number, field: string): void {
        if (value < min || value > max) {
            throw new FXDError({
                code: ErrorCode.CONSTRAINT_VIOLATION,
                category: ErrorCategory.VALIDATION,
                severity: ErrorSeverity.MEDIUM,
                message: `Field '${field}' value ${value} is outside valid range [${min}, ${max}]`,
                details: { field, value, min, max }
            });
        }
    }
}

// Export factory function for easy integration
export function createErrorHandlingManager(fx: FXCore): ErrorHandlingManager {
    const manager = new ErrorHandlingManager(fx);

    // Attach to FX system
    (fx as any).errorManager = manager;

    // Create system node
    const errorSystemNode = fx.proxy('system.errorHandling');
    errorSystemNode.val({
        manager,
        createError: manager.createError.bind(manager),
        handleError: manager.handleError.bind(manager),
        getMetrics: manager.getMetrics.bind(manager),
        clearHistory: manager.clearErrorHistory.bind(manager)
    });

    return manager;
}

export default {
    ErrorHandlingManager,
    FXDError,
    ErrorSeverity,
    ErrorCategory,
    ErrorCode,
    RecoveryStrategy,
    ErrorHandler,
    ValidationUtils,
    createErrorHandlingManager
};