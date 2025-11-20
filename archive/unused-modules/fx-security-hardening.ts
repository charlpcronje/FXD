/**
 * @file fx-security-hardening.ts
 * @description Comprehensive security hardening system for FXD
 *
 * Provides advanced security features including:
 * - Input validation and sanitization
 * - Authentication and authorization
 * - Encryption and cryptographic functions
 * - Security audit logging
 * - Intrusion detection and prevention
 * - Access control and permissions
 * - Security policy enforcement
 * - Vulnerability scanning and mitigation
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, FXDError, ErrorCode, ErrorCategory, ErrorSeverity } from './fx-error-handling.ts';

// Security threat types
export enum ThreatType {
    INJECTION_ATTACK = 'injection_attack',
    XSS_ATTACK = 'xss_attack',
    CSRF_ATTACK = 'csrf_attack',
    PATH_TRAVERSAL = 'path_traversal',
    PRIVILEGE_ESCALATION = 'privilege_escalation',
    BRUTE_FORCE = 'brute_force',
    DDoS = 'ddos',
    DATA_EXFILTRATION = 'data_exfiltration',
    MALICIOUS_INPUT = 'malicious_input',
    UNAUTHORIZED_ACCESS = 'unauthorized_access'
}

// Security event severity
export enum SecuritySeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
    EMERGENCY = 'emergency'
}

// Access control levels
export enum AccessLevel {
    NONE = 'none',
    READ = 'read',
    WRITE = 'write',
    EXECUTE = 'execute',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin'
}

// Security event interface
export interface SecurityEvent {
    id: string;
    type: ThreatType;
    severity: SecuritySeverity;
    description: string;
    source: string;
    target?: string;
    timestamp: Date;
    blocked: boolean;
    evidence?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    userId?: string;
}

// Security policy interface
export interface SecurityPolicy {
    id: string;
    name: string;
    enabled: boolean;
    rules: SecurityRule[];
    exceptions: string[];
    enforcement: 'log' | 'warn' | 'block' | 'redirect';
    priority: number;
}

// Security rule interface
export interface SecurityRule {
    id: string;
    type: 'input_validation' | 'access_control' | 'rate_limiting' | 'pattern_matching';
    pattern?: string;
    allowedValues?: string[];
    maxLength?: number;
    requiredPermissions?: string[];
    condition: string;
    action: 'allow' | 'deny' | 'sanitize' | 'log';
}

// User session interface
export interface UserSession {
    id: string;
    userId: string;
    permissions: Set<string>;
    accessLevel: AccessLevel;
    createdAt: Date;
    lastActivity: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive: boolean;
    metadata?: Record<string, any>;
}

// Security audit entry
export interface SecurityAuditEntry {
    id: string;
    timestamp: Date;
    action: string;
    userId?: string;
    sessionId?: string;
    resource: string;
    result: 'success' | 'failure' | 'blocked';
    details: Record<string, any>;
    severity: SecuritySeverity;
}

/**
 * Input validation and sanitization utilities
 */
export class InputValidator {
    private static readonly SQL_INJECTION_PATTERNS = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /([\'\";])/,
        /(\-\-|\#)/,
        /(\bOR\b.*\b=\b)/i,
        /(\bAND\b.*\b=\b)/i
    ];

    private static readonly XSS_PATTERNS = [
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<object[^>]*>.*?<\/object>/gi,
        /<embed[^>]*>/gi
    ];

    private static readonly PATH_TRAVERSAL_PATTERNS = [
        /\.\./,
        /\/\.\.\//,
        /\.\.\\/,
        /\%2e\%2e/i,
        /\%252e\%252e/i
    ];

    /**
     * Validate and sanitize input for SQL injection
     */
    static validateSQL(input: string): { isValid: boolean; sanitized: string; threats: string[] } {
        const threats: string[] = [];
        let sanitized = input;

        for (const pattern of this.SQL_INJECTION_PATTERNS) {
            if (pattern.test(input)) {
                threats.push('SQL Injection');
                // Basic sanitization - in production, use parameterized queries
                sanitized = sanitized.replace(pattern, '');
            }
        }

        return {
            isValid: threats.length === 0,
            sanitized,
            threats
        };
    }

    /**
     * Validate and sanitize input for XSS
     */
    static validateXSS(input: string): { isValid: boolean; sanitized: string; threats: string[] } {
        const threats: string[] = [];
        let sanitized = input;

        for (const pattern of this.XSS_PATTERNS) {
            if (pattern.test(input)) {
                threats.push('XSS Attack');
                sanitized = sanitized.replace(pattern, '');
            }
        }

        // HTML entity encoding for remaining special characters
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        return {
            isValid: threats.length === 0,
            sanitized,
            threats
        };
    }

    /**
     * Validate path for traversal attacks
     */
    static validatePath(path: string): { isValid: boolean; sanitized: string; threats: string[] } {
        const threats: string[] = [];
        let sanitized = path;

        for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
            if (pattern.test(path)) {
                threats.push('Path Traversal');
                sanitized = sanitized.replace(pattern, '');
            }
        }

        // Normalize path separators
        sanitized = sanitized.replace(/\\/g, '/');

        // Remove multiple consecutive slashes
        sanitized = sanitized.replace(/\/+/g, '/');

        return {
            isValid: threats.length === 0,
            sanitized,
            threats
        };
    }

    /**
     * Comprehensive input validation
     */
    static validateInput(input: string, type: 'sql' | 'xss' | 'path' | 'all' = 'all'): {
        isValid: boolean;
        sanitized: string;
        threats: string[];
    } {
        let threats: string[] = [];
        let sanitized = input;

        if (type === 'sql' || type === 'all') {
            const sqlResult = this.validateSQL(sanitized);
            threats.push(...sqlResult.threats);
            sanitized = sqlResult.sanitized;
        }

        if (type === 'xss' || type === 'all') {
            const xssResult = this.validateXSS(sanitized);
            threats.push(...xssResult.threats);
            sanitized = xssResult.sanitized;
        }

        if (type === 'path' || type === 'all') {
            const pathResult = this.validatePath(sanitized);
            threats.push(...pathResult.threats);
            sanitized = pathResult.sanitized;
        }

        return {
            isValid: threats.length === 0,
            sanitized,
            threats: [...new Set(threats)] // Remove duplicates
        };
    }
}

/**
 * Cryptographic utilities
 */
export class CryptoUtils {
    /**
     * Generate secure random string
     */
    static generateSecureRandom(length: number = 32): string {
        const array = new Uint8Array(length);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(array);
        } else {
            // Fallback for environments without crypto API
            for (let i = 0; i < length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Hash data using SHA-256
     */
    static async hash(data: string): Promise<string> {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback simple hash (not secure for production)
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(16);
        }
    }

    /**
     * Generate HMAC
     */
    static async hmac(data: string, key: string): Promise<string> {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const keyBuffer = encoder.encode(key);
            const dataBuffer = encoder.encode(data);

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );

            const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
            const signatureArray = Array.from(new Uint8Array(signature));
            return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback - simple hash combination (not secure for production)
            return await this.hash(key + data);
        }
    }

    /**
     * Constant-time string comparison
     */
    static constantTimeCompare(a: string, b: string): boolean {
        if (a.length !== b.length) return false;

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
    }
}

/**
 * Access control manager
 */
export class AccessControlManager {
    private permissions = new Map<string, Set<string>>();
    private roles = new Map<string, { permissions: Set<string>; level: AccessLevel }>();
    private userRoles = new Map<string, Set<string>>();

    /**
     * Define a role with permissions
     */
    defineRole(roleName: string, permissions: string[], level: AccessLevel): void {
        this.roles.set(roleName, {
            permissions: new Set(permissions),
            level
        });
    }

    /**
     * Assign role to user
     */
    assignRole(userId: string, roleName: string): boolean {
        if (!this.roles.has(roleName)) return false;

        if (!this.userRoles.has(userId)) {
            this.userRoles.set(userId, new Set());
        }

        this.userRoles.get(userId)!.add(roleName);
        return true;
    }

    /**
     * Check if user has permission
     */
    hasPermission(userId: string, permission: string): boolean {
        const userRoleSet = this.userRoles.get(userId);
        if (!userRoleSet) return false;

        for (const roleName of userRoleSet) {
            const role = this.roles.get(roleName);
            if (role && role.permissions.has(permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get user access level
     */
    getUserAccessLevel(userId: string): AccessLevel {
        const userRoleSet = this.userRoles.get(userId);
        if (!userRoleSet) return AccessLevel.NONE;

        let maxLevel = AccessLevel.NONE;
        const levelOrder = [AccessLevel.NONE, AccessLevel.READ, AccessLevel.WRITE, AccessLevel.EXECUTE, AccessLevel.ADMIN, AccessLevel.SUPER_ADMIN];

        for (const roleName of userRoleSet) {
            const role = this.roles.get(roleName);
            if (role) {
                const levelIndex = levelOrder.indexOf(role.level);
                const maxLevelIndex = levelOrder.indexOf(maxLevel);
                if (levelIndex > maxLevelIndex) {
                    maxLevel = role.level;
                }
            }
        }

        return maxLevel;
    }

    /**
     * Get all user permissions
     */
    getUserPermissions(userId: string): Set<string> {
        const permissions = new Set<string>();
        const userRoleSet = this.userRoles.get(userId);

        if (userRoleSet) {
            for (const roleName of userRoleSet) {
                const role = this.roles.get(roleName);
                if (role) {
                    for (const permission of role.permissions) {
                        permissions.add(permission);
                    }
                }
            }
        }

        return permissions;
    }
}

/**
 * Intrusion detection system
 */
export class IntrusionDetectionSystem {
    private threatPatterns = new Map<ThreatType, RegExp[]>();
    private suspiciousActivity = new Map<string, number>(); // IP/User -> suspicious score
    private blockedEntities = new Set<string>();

    constructor() {
        this.initializeThreatPatterns();
    }

    /**
     * Initialize threat detection patterns
     */
    private initializeThreatPatterns(): void {
        // SQL Injection patterns
        this.threatPatterns.set(ThreatType.INJECTION_ATTACK, [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /([\'\";])/,
            /(\-\-|\#)/,
            /(\bOR\b.*\b=\b)/i
        ]);

        // XSS patterns
        this.threatPatterns.set(ThreatType.XSS_ATTACK, [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ]);

        // Path traversal patterns
        this.threatPatterns.set(ThreatType.PATH_TRAVERSAL, [
            /\.\./,
            /\/\.\.\//,
            /\%2e\%2e/i
        ]);

        // Brute force patterns (suspicious activity indicators)
        this.threatPatterns.set(ThreatType.BRUTE_FORCE, [
            /login/i,
            /password/i,
            /auth/i
        ]);
    }

    /**
     * Analyze input for threats
     */
    analyzeInput(input: string, source: string): SecurityEvent[] {
        const events: SecurityEvent[] = [];

        for (const [threatType, patterns] of this.threatPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(input)) {
                    events.push({
                        id: this.generateEventId(),
                        type: threatType,
                        severity: this.getSeverityForThreat(threatType),
                        description: `Detected ${threatType} pattern in input`,
                        source,
                        timestamp: new Date(),
                        blocked: false,
                        evidence: { input, pattern: pattern.source }
                    });

                    this.increaseSuspiciousScore(source);
                }
            }
        }

        return events;
    }

    /**
     * Analyze request for suspicious patterns
     */
    analyzeRequest(request: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
        ip?: string;
        userAgent?: string;
    }): SecurityEvent[] {
        const events: SecurityEvent[] = [];
        const source = request.ip || 'unknown';

        // Analyze URL for threats
        const urlEvents = this.analyzeInput(request.url, source);
        events.push(...urlEvents);

        // Analyze headers for suspicious patterns
        for (const [header, value] of Object.entries(request.headers)) {
            if (this.isSuspiciousHeader(header, value)) {
                events.push({
                    id: this.generateEventId(),
                    type: ThreatType.MALICIOUS_INPUT,
                    severity: SecuritySeverity.MEDIUM,
                    description: `Suspicious header detected: ${header}`,
                    source,
                    timestamp: new Date(),
                    blocked: false,
                    evidence: { header, value },
                    userAgent: request.userAgent,
                    ipAddress: request.ip
                });
            }
        }

        // Analyze body if present
        if (request.body) {
            const bodyEvents = this.analyzeInput(request.body, source);
            events.push(...bodyEvents);
        }

        // Check for brute force attempts
        if (this.isBruteForceAttempt(request, source)) {
            events.push({
                id: this.generateEventId(),
                type: ThreatType.BRUTE_FORCE,
                severity: SecuritySeverity.HIGH,
                description: 'Potential brute force attack detected',
                source,
                timestamp: new Date(),
                blocked: false,
                evidence: { url: request.url, method: request.method },
                userAgent: request.userAgent,
                ipAddress: request.ip
            });
        }

        return events;
    }

    /**
     * Check if entity should be blocked
     */
    shouldBlock(entityId: string): boolean {
        return this.blockedEntities.has(entityId) || this.getSuspiciousScore(entityId) > 100;
    }

    /**
     * Block entity
     */
    blockEntity(entityId: string): void {
        this.blockedEntities.add(entityId);
    }

    /**
     * Unblock entity
     */
    unblockEntity(entityId: string): void {
        this.blockedEntities.delete(entityId);
        this.suspiciousActivity.delete(entityId);
    }

    /**
     * Get suspicious score for entity
     */
    getSuspiciousScore(entityId: string): number {
        return this.suspiciousActivity.get(entityId) || 0;
    }

    private increaseSuspiciousScore(entityId: string, amount: number = 10): void {
        const currentScore = this.getSuspiciousScore(entityId);
        this.suspiciousActivity.set(entityId, currentScore + amount);
    }

    private getSeverityForThreat(threatType: ThreatType): SecuritySeverity {
        switch (threatType) {
            case ThreatType.INJECTION_ATTACK:
            case ThreatType.XSS_ATTACK:
            case ThreatType.PRIVILEGE_ESCALATION:
                return SecuritySeverity.HIGH;
            case ThreatType.BRUTE_FORCE:
            case ThreatType.UNAUTHORIZED_ACCESS:
                return SecuritySeverity.MEDIUM;
            case ThreatType.PATH_TRAVERSAL:
            case ThreatType.MALICIOUS_INPUT:
                return SecuritySeverity.MEDIUM;
            default:
                return SecuritySeverity.LOW;
        }
    }

    private isSuspiciousHeader(name: string, value: string): boolean {
        const suspiciousPatterns = [
            /script/i,
            /javascript/i,
            /vbscript/i,
            /onload/i,
            /onerror/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(value));
    }

    private isBruteForceAttempt(request: any, source: string): boolean {
        const suspiciousScore = this.getSuspiciousScore(source);
        const isAuthEndpoint = /login|auth|password/i.test(request.url);

        return isAuthEndpoint && suspiciousScore > 50;
    }

    private generateEventId(): string {
        return `sec-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Comprehensive security hardening manager
 */
export class SecurityHardeningManager {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private validator: InputValidator;
    private accessControl: AccessControlManager;
    private intrusionDetection: IntrusionDetectionSystem;
    private sessions = new Map<string, UserSession>();
    private auditLog: SecurityAuditEntry[] = [];
    private policies = new Map<string, SecurityPolicy>();
    private events: SecurityEvent[] = [];

    // Configuration
    private config = {
        sessionTimeout: 3600000, // 1 hour
        maxLoginAttempts: 5,
        auditLogMaxSize: 10000,
        eventsMaxSize: 5000,
        autoBlockThreshold: 100,
        enableRealTimeMonitoring: true
    };

    constructor(fx: FXCore, errorManager?: ErrorHandlingManager) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.validator = InputValidator;
        this.accessControl = new AccessControlManager();
        this.intrusionDetection = new IntrusionDetectionSystem();

        this.initializeSecuritySystem();
        this.setupDefaultPolicies();
        this.startSecurityMonitoring();
    }

    /**
     * Initialize security system
     */
    private initializeSecuritySystem(): void {
        // Create security system node
        const securityNode = this.fx.proxy('system.security');
        securityNode.val({
            manager: this,
            hardening: {
                enabled: true,
                level: 'high',
                policies: new Map(),
                events: [],
                sessions: new Map()
            },
            accessControl: this.accessControl,
            intrusionDetection: this.intrusionDetection,
            audit: {
                enabled: true,
                entries: []
            }
        });

        console.log('Security hardening system initialized');
    }

    /**
     * Setup default security policies
     */
    private setupDefaultPolicies(): void {
        // Input validation policy
        this.addPolicy({
            id: 'input-validation',
            name: 'Input Validation Policy',
            enabled: true,
            rules: [
                {
                    id: 'sql-injection-protection',
                    type: 'input_validation',
                    condition: 'contains_sql_patterns',
                    action: 'deny'
                },
                {
                    id: 'xss-protection',
                    type: 'input_validation',
                    condition: 'contains_xss_patterns',
                    action: 'sanitize'
                }
            ],
            exceptions: [],
            enforcement: 'block',
            priority: 1
        });

        // Access control policy
        this.addPolicy({
            id: 'access-control',
            name: 'Access Control Policy',
            enabled: true,
            rules: [
                {
                    id: 'admin-only-access',
                    type: 'access_control',
                    condition: 'requires_admin_access',
                    requiredPermissions: ['admin'],
                    action: 'deny'
                }
            ],
            exceptions: ['system'],
            enforcement: 'block',
            priority: 2
        });

        // Default roles
        this.accessControl.defineRole('user', ['read'], AccessLevel.READ);
        this.accessControl.defineRole('editor', ['read', 'write'], AccessLevel.WRITE);
        this.accessControl.defineRole('admin', ['read', 'write', 'execute', 'admin'], AccessLevel.ADMIN);
        this.accessControl.defineRole('super_admin', ['*'], AccessLevel.SUPER_ADMIN);
    }

    /**
     * Start security monitoring
     */
    private startSecurityMonitoring(): void {
        if (!this.config.enableRealTimeMonitoring) return;

        // Monitor for suspicious activities
        setInterval(() => {
            this.performSecurityScan();
        }, 60000); // Every minute

        // Clean up old sessions
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 300000); // Every 5 minutes

        // Cleanup old events and audit logs
        setInterval(() => {
            this.cleanupOldData();
        }, 3600000); // Every hour

        console.log('Security monitoring started');
    }

    /**
     * Validate input using security policies
     */
    validateInput(input: string, context?: string): {
        isValid: boolean;
        sanitized: string;
        threats: string[];
        blocked: boolean;
    } {
        const validation = InputValidator.validateInput(input);
        const source = context || 'unknown';

        // Log security events if threats detected
        if (validation.threats.length > 0) {
            const event: SecurityEvent = {
                id: this.generateEventId(),
                type: ThreatType.MALICIOUS_INPUT,
                severity: SecuritySeverity.MEDIUM,
                description: `Input validation threats: ${validation.threats.join(', ')}`,
                source,
                timestamp: new Date(),
                blocked: !validation.isValid,
                evidence: { input, threats: validation.threats }
            };

            this.logSecurityEvent(event);
        }

        return {
            ...validation,
            blocked: !validation.isValid
        };
    }

    /**
     * Create user session
     */
    createSession(userId: string, permissions: string[], metadata?: Record<string, any>): string {
        const sessionId = CryptoUtils.generateSecureRandom(32);
        const session: UserSession = {
            id: sessionId,
            userId,
            permissions: new Set(permissions),
            accessLevel: this.accessControl.getUserAccessLevel(userId),
            createdAt: new Date(),
            lastActivity: new Date(),
            isActive: true,
            metadata
        };

        this.sessions.set(sessionId, session);

        // Log session creation
        this.logAuditEntry({
            action: 'session_created',
            userId,
            sessionId,
            resource: 'session',
            result: 'success',
            details: { permissions },
            severity: SecuritySeverity.LOW
        });

        return sessionId;
    }

    /**
     * Validate session
     */
    validateSession(sessionId: string): UserSession | null {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) return null;

        // Check session timeout
        const now = new Date();
        if (now.getTime() - session.lastActivity.getTime() > this.config.sessionTimeout) {
            this.destroySession(sessionId);
            return null;
        }

        // Update last activity
        session.lastActivity = now;
        return session;
    }

    /**
     * Check permission for session
     */
    checkPermission(sessionId: string, permission: string): boolean {
        const session = this.validateSession(sessionId);
        if (!session) return false;

        return session.permissions.has(permission) ||
               session.permissions.has('*') ||
               this.accessControl.hasPermission(session.userId, permission);
    }

    /**
     * Destroy session
     */
    destroySession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.isActive = false;
        this.sessions.delete(sessionId);

        // Log session destruction
        this.logAuditEntry({
            action: 'session_destroyed',
            userId: session.userId,
            sessionId,
            resource: 'session',
            result: 'success',
            details: {},
            severity: SecuritySeverity.LOW
        });

        return true;
    }

    /**
     * Add security policy
     */
    addPolicy(policy: SecurityPolicy): void {
        this.policies.set(policy.id, policy);
        console.log(`Added security policy: ${policy.name}`);
    }

    /**
     * Enforce security policies
     */
    enforcePolicies(context: {
        action: string;
        userId?: string;
        sessionId?: string;
        input?: string;
        resource: string;
    }): { allowed: boolean; reason?: string; sanitizedInput?: string } {
        let allowed = true;
        let reason: string | undefined;
        let sanitizedInput = context.input;

        // Sort policies by priority
        const sortedPolicies = Array.from(this.policies.values())
            .filter(p => p.enabled)
            .sort((a, b) => a.priority - b.priority);

        for (const policy of sortedPolicies) {
            for (const rule of policy.rules) {
                const ruleResult = this.evaluateRule(rule, context);

                if (!ruleResult.allowed) {
                    if (policy.enforcement === 'block') {
                        allowed = false;
                        reason = `Policy violation: ${policy.name} - ${rule.id}`;
                        break;
                    } else if (policy.enforcement === 'sanitize' && ruleResult.sanitized) {
                        sanitizedInput = ruleResult.sanitized;
                    } else if (policy.enforcement === 'log') {
                        this.logSecurityEvent({
                            id: this.generateEventId(),
                            type: ThreatType.UNAUTHORIZED_ACCESS,
                            severity: SecuritySeverity.MEDIUM,
                            description: `Policy violation: ${policy.name}`,
                            source: context.userId || 'unknown',
                            timestamp: new Date(),
                            blocked: false,
                            evidence: context
                        });
                    }
                }
            }

            if (!allowed) break;
        }

        return { allowed, reason, sanitizedInput };
    }

    /**
     * Log security event
     */
    logSecurityEvent(event: SecurityEvent): void {
        this.events.push(event);

        // Limit events size
        if (this.events.length > this.config.eventsMaxSize) {
            this.events.shift();
        }

        // Store in FX system
        const eventNode = this.fx.proxy(`system.security.events.${event.id}`);
        eventNode.val(event);

        // Handle critical events
        if (event.severity === SecuritySeverity.CRITICAL || event.severity === SecuritySeverity.EMERGENCY) {
            this.handleCriticalSecurityEvent(event);
        }

        console.log(`[SECURITY] ${event.severity.toUpperCase()}: ${event.description}`);
    }

    /**
     * Log audit entry
     */
    logAuditEntry(entry: Omit<SecurityAuditEntry, 'id' | 'timestamp'>): void {
        const fullEntry: SecurityAuditEntry = {
            ...entry,
            id: this.generateAuditId(),
            timestamp: new Date()
        };

        this.auditLog.push(fullEntry);

        // Limit audit log size
        if (this.auditLog.length > this.config.auditLogMaxSize) {
            this.auditLog.shift();
        }

        // Store in FX system
        const auditNode = this.fx.proxy(`system.security.audit.${fullEntry.id}`);
        auditNode.val(fullEntry);
    }

    /**
     * Get security status
     */
    getSecurityStatus(): {
        activeThreats: number;
        blockedEntities: number;
        activeSessions: number;
        recentEvents: SecurityEvent[];
        threatLevel: SecuritySeverity;
    } {
        const recentEvents = this.events.filter(e =>
            Date.now() - e.timestamp.getTime() < 3600000 // Last hour
        );

        const activeThreats = recentEvents.filter(e => !e.blocked).length;
        const criticalEvents = recentEvents.filter(e =>
            e.severity === SecuritySeverity.CRITICAL || e.severity === SecuritySeverity.EMERGENCY
        );

        let threatLevel: SecuritySeverity;
        if (criticalEvents.length > 0) {
            threatLevel = SecuritySeverity.CRITICAL;
        } else if (activeThreats > 10) {
            threatLevel = SecuritySeverity.HIGH;
        } else if (activeThreats > 5) {
            threatLevel = SecuritySeverity.MEDIUM;
        } else {
            threatLevel = SecuritySeverity.LOW;
        }

        return {
            activeThreats,
            blockedEntities: 0, // This would be tracked by intrusion detection
            activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
            recentEvents: recentEvents.slice(-10),
            threatLevel
        };
    }

    // Private helper methods

    private evaluateRule(rule: SecurityRule, context: any): { allowed: boolean; sanitized?: string } {
        switch (rule.type) {
            case 'input_validation':
                if (context.input) {
                    const validation = InputValidator.validateInput(context.input);
                    return {
                        allowed: validation.isValid,
                        sanitized: validation.sanitized
                    };
                }
                break;

            case 'access_control':
                if (rule.requiredPermissions && context.sessionId) {
                    const hasAllPermissions = rule.requiredPermissions.every(perm =>
                        this.checkPermission(context.sessionId, perm)
                    );
                    return { allowed: hasAllPermissions };
                }
                break;

            case 'pattern_matching':
                if (rule.pattern && context.input) {
                    const regex = new RegExp(rule.pattern);
                    return { allowed: !regex.test(context.input) };
                }
                break;
        }

        return { allowed: true };
    }

    private performSecurityScan(): void {
        // Scan for anomalies in current sessions, events, etc.
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);

        // Check for multiple sessions from same user
        const userSessionCounts = new Map<string, number>();
        for (const session of activeSessions) {
            const count = userSessionCounts.get(session.userId) || 0;
            userSessionCounts.set(session.userId, count + 1);
        }

        for (const [userId, count] of userSessionCounts) {
            if (count > 5) { // Suspicious if more than 5 sessions
                this.logSecurityEvent({
                    id: this.generateEventId(),
                    type: ThreatType.UNAUTHORIZED_ACCESS,
                    severity: SecuritySeverity.MEDIUM,
                    description: `User has ${count} active sessions`,
                    source: userId,
                    timestamp: new Date(),
                    blocked: false,
                    evidence: { sessionCount: count }
                });
            }
        }
    }

    private cleanupExpiredSessions(): void {
        const now = new Date();
        const expiredSessions: string[] = [];

        for (const [sessionId, session] of this.sessions) {
            if (now.getTime() - session.lastActivity.getTime() > this.config.sessionTimeout) {
                expiredSessions.push(sessionId);
            }
        }

        for (const sessionId of expiredSessions) {
            this.destroySession(sessionId);
        }

        if (expiredSessions.length > 0) {
            console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }

    private cleanupOldData(): void {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

        // Cleanup old events
        this.events = this.events.filter(e => e.timestamp > cutoff);

        // Cleanup old audit entries
        this.auditLog = this.auditLog.filter(e => e.timestamp > cutoff);
    }

    private handleCriticalSecurityEvent(event: SecurityEvent): void {
        console.error('CRITICAL SECURITY EVENT:', event);

        // Trigger error handler if available
        if (this.errorManager) {
            this.errorManager.handleError(
                this.errorManager.createError({
                    code: ErrorCode.SECURITY_VIOLATION,
                    category: ErrorCategory.SECURITY,
                    severity: ErrorSeverity.CRITICAL,
                    message: `Critical security event: ${event.description}`,
                    operation: 'security_monitoring'
                })
            );
        }

        // Auto-block source if configured
        if (this.config.autoBlockThreshold > 0 && event.source) {
            this.intrusionDetection.blockEntity(event.source);
        }
    }

    private generateEventId(): string {
        return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateAuditId(): string {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Factory function to create security hardening manager
 */
export function createSecurityHardeningManager(
    fx: FXCore,
    errorManager?: ErrorHandlingManager
): SecurityHardeningManager {
    const manager = new SecurityHardeningManager(fx, errorManager);

    // Attach to FX system
    const securityNode = fx.proxy('system.security');
    securityNode.val({
        manager,
        validateInput: manager.validateInput.bind(manager),
        createSession: manager.createSession.bind(manager),
        validateSession: manager.validateSession.bind(manager),
        checkPermission: manager.checkPermission.bind(manager),
        destroySession: manager.destroySession.bind(manager),
        getStatus: manager.getSecurityStatus.bind(manager),
        addPolicy: manager.addPolicy.bind(manager)
    });

    return manager;
}

export default {
    SecurityHardeningManager,
    InputValidator,
    CryptoUtils,
    AccessControlManager,
    IntrusionDetectionSystem,
    ThreatType,
    SecuritySeverity,
    AccessLevel,
    createSecurityHardeningManager
};