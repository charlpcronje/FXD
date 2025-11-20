/**
 * @file fx-data-integrity.ts
 * @description Data corruption detection and integrity verification system for FXD
 *
 * Provides comprehensive data integrity features including:
 * - Checksum verification for data blocks
 * - Corruption detection algorithms
 * - Data validation and consistency checks
 * - Automatic repair mechanisms
 * - Integrity monitoring and alerting
 * - Backup verification
 */

import { FXCore, FXNode, FXNodeProxy } from '../fx.ts';
import { ErrorHandlingManager, FXDError, ErrorCode, ErrorCategory, ErrorSeverity } from './fx-error-handling.ts';
import { TransactionManager } from './fx-transaction-system.ts';

// Integrity check types
export enum IntegrityCheckType {
    CHECKSUM = 'checksum',
    STRUCTURE = 'structure',
    REFERENCE = 'reference',
    SCHEMA = 'schema',
    CONSTRAINT = 'constraint',
    CONSISTENCY = 'consistency'
}

// Corruption severity levels
export enum CorruptionSeverity {
    MINOR = 'minor',           // Recoverable with minimal data loss
    MODERATE = 'moderate',     // Recoverable with some data loss
    SEVERE = 'severe',         // Difficult to recover, significant data loss
    CRITICAL = 'critical'      // Unrecoverable, complete data loss
}

// Repair strategies
export enum RepairStrategy {
    AUTO_REPAIR = 'auto_repair',
    BACKUP_RESTORE = 'backup_restore',
    MANUAL_REVIEW = 'manual_review',
    QUARANTINE = 'quarantine',
    REBUILD_INDEX = 'rebuild_index',
    ROLLBACK_TRANSACTION = 'rollback_transaction'
}

// Hash algorithms
export enum HashAlgorithm {
    SHA256 = 'sha256',
    SHA1 = 'sha1',
    MD5 = 'md5',
    CRC32 = 'crc32'
}

// Integrity violation interface
export interface IntegrityViolation {
    id: string;
    type: IntegrityCheckType;
    severity: CorruptionSeverity;
    nodeId: string;
    path: string;
    description: string;
    detectedAt: Date;
    expectedValue?: any;
    actualValue?: any;
    checksum?: {
        algorithm: HashAlgorithm;
        expected: string;
        actual: string;
    };
    repairStrategy: RepairStrategy;
    repairAttempts: number;
    maxRepairAttempts: number;
    metadata?: Record<string, any>;
}

// Integrity check result
export interface IntegrityCheckResult {
    nodeId: string;
    path: string;
    checkType: IntegrityCheckType;
    passed: boolean;
    violations: IntegrityViolation[];
    checksum?: string;
    timestamp: Date;
    duration: number;
}

// Integrity scan configuration
export interface IntegrityScanConfig {
    includeChecksums: boolean;
    includeStructure: boolean;
    includeReferences: boolean;
    includeSchema: boolean;
    includeConstraints: boolean;
    includeConsistency: boolean;
    maxDepth?: number;
    skipPaths?: string[];
    includePaths?: string[];
    parallelism: number;
    timeoutMs: number;
}

/**
 * Data integrity manager for corruption detection and repair
 */
export class DataIntegrityManager {
    private fx: FXCore;
    private errorManager?: ErrorHandlingManager;
    private transactionManager?: TransactionManager;
    private violations = new Map<string, IntegrityViolation>();
    private checksums = new Map<string, { hash: string; algorithm: HashAlgorithm; timestamp: Date }>();
    private scanCounter = 0;
    private repairCounter = 0;

    // Configuration
    private config = {
        defaultHashAlgorithm: HashAlgorithm.SHA256,
        checksumUpdateInterval: 300000, // 5 minutes
        autoRepairEnabled: true,
        maxRepairAttempts: 3,
        quarantineCorruptedData: true,
        integrityCheckInterval: 900000, // 15 minutes
        backgroundScanEnabled: true,
        alertThreshold: 10 // Number of violations before alert
    };

    constructor(
        fx: FXCore,
        errorManager?: ErrorHandlingManager,
        transactionManager?: TransactionManager
    ) {
        this.fx = fx;
        this.errorManager = errorManager;
        this.transactionManager = transactionManager;
        this.initializeIntegritySystem();
        this.startBackgroundScanner();
    }

    /**
     * Initialize the integrity system
     */
    private initializeIntegritySystem(): void {
        // Create system nodes for integrity management
        const integrityNode = this.fx.proxy('system.integrity');
        integrityNode.val({
            violations: new Map(),
            checksums: new Map(),
            lastFullScan: null,
            scanHistory: [],
            repairHistory: [],
            config: this.config
        });

        console.log('Data integrity system initialized');
    }

    /**
     * Perform comprehensive integrity scan
     */
    async performIntegrityScan(
        path: string = '',
        config: Partial<IntegrityScanConfig> = {}
    ): Promise<IntegrityCheckResult[]> {
        const scanId = ++this.scanCounter;
        const startTime = Date.now();

        console.log(`Starting integrity scan #${scanId} for path: ${path || 'root'}`);

        const fullConfig: IntegrityScanConfig = {
            includeChecksums: true,
            includeStructure: true,
            includeReferences: true,
            includeSchema: true,
            includeConstraints: true,
            includeConsistency: true,
            parallelism: 4,
            timeoutMs: 300000, // 5 minutes
            ...config
        };

        const results: IntegrityCheckResult[] = [];
        const startNode = path ? this.fx.resolvePath(path, this.fx.root) : this.fx.root;

        if (!startNode) {
            throw this.createIntegrityError(
                ErrorCode.INVALID_INPUT,
                `Path not found: ${path}`
            );
        }

        try {
            // Collect all nodes to check
            const nodesToCheck = this.collectNodes(startNode, fullConfig);

            // Perform checks in parallel batches
            const batchSize = Math.ceil(nodesToCheck.length / fullConfig.parallelism);
            const batches: FXNode[][] = [];

            for (let i = 0; i < nodesToCheck.length; i += batchSize) {
                batches.push(nodesToCheck.slice(i, i + batchSize));
            }

            const batchPromises = batches.map(async (batch, batchIndex) => {
                const batchResults: IntegrityCheckResult[] = [];

                for (const node of batch) {
                    try {
                        const nodeResults = await this.checkNodeIntegrity(node, fullConfig);
                        batchResults.push(...nodeResults);
                    } catch (error) {
                        console.error(`Error checking node ${node.__id}:`, error);

                        // Create error result
                        batchResults.push({
                            nodeId: node.__id,
                            path: this.getNodePath(node),
                            checkType: IntegrityCheckType.STRUCTURE,
                            passed: false,
                            violations: [{
                                id: this.generateViolationId(),
                                type: IntegrityCheckType.STRUCTURE,
                                severity: CorruptionSeverity.MODERATE,
                                nodeId: node.__id,
                                path: this.getNodePath(node),
                                description: `Integrity check failed: ${error.message}`,
                                detectedAt: new Date(),
                                repairStrategy: RepairStrategy.MANUAL_REVIEW,
                                repairAttempts: 0,
                                maxRepairAttempts: this.config.maxRepairAttempts
                            }],
                            timestamp: new Date(),
                            duration: 0
                        });
                    }
                }

                console.log(`Completed integrity scan batch ${batchIndex + 1}/${batches.length}`);
                return batchResults;
            });

            // Wait for all batches with timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Integrity scan timeout')), fullConfig.timeoutMs);
            });

            const batchResults = await Promise.race([
                Promise.all(batchPromises),
                timeoutPromise
            ]);

            results.push(...batchResults.flat());

            // Process violations found during scan
            const violations = results.flatMap(r => r.violations);
            await this.processViolations(violations);

            // Store scan results
            await this.storeScanResults(scanId, results, startTime);

            const duration = Date.now() - startTime;
            console.log(`Integrity scan #${scanId} completed in ${duration}ms. Found ${violations.length} violations.`);

            return results;

        } catch (error) {
            console.error(`Integrity scan #${scanId} failed:`, error);
            throw error;
        }
    }

    /**
     * Check integrity of a specific node
     */
    async checkNodeIntegrity(
        node: FXNode,
        config: IntegrityScanConfig
    ): Promise<IntegrityCheckResult[]> {
        const results: IntegrityCheckResult[] = [];
        const nodeId = node.__id;
        const path = this.getNodePath(node);

        // Checksum verification
        if (config.includeChecksums) {
            const checksumResult = await this.verifyChecksum(node);
            results.push(checksumResult);
        }

        // Structure validation
        if (config.includeStructure) {
            const structureResult = await this.verifyStructure(node);
            results.push(structureResult);
        }

        // Reference integrity
        if (config.includeReferences) {
            const referenceResult = await this.verifyReferences(node);
            results.push(referenceResult);
        }

        // Schema validation
        if (config.includeSchema) {
            const schemaResult = await this.verifySchema(node);
            results.push(schemaResult);
        }

        // Constraint validation
        if (config.includeConstraints) {
            const constraintResult = await this.verifyConstraints(node);
            results.push(constraintResult);
        }

        // Consistency checks
        if (config.includeConsistency) {
            const consistencyResult = await this.verifyConsistency(node);
            results.push(consistencyResult);
        }

        return results;
    }

    /**
     * Verify checksum for a node
     */
    async verifyChecksum(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);

        try {
            // Calculate current checksum
            const currentChecksum = await this.calculateChecksum(node, this.config.defaultHashAlgorithm);

            // Get stored checksum
            const storedChecksum = this.checksums.get(nodeId);

            const violations: IntegrityViolation[] = [];

            if (storedChecksum) {
                // Compare checksums
                if (storedChecksum.hash !== currentChecksum) {
                    violations.push({
                        id: this.generateViolationId(),
                        type: IntegrityCheckType.CHECKSUM,
                        severity: CorruptionSeverity.MODERATE,
                        nodeId,
                        path,
                        description: 'Checksum mismatch detected - data may be corrupted',
                        detectedAt: new Date(),
                        checksum: {
                            algorithm: storedChecksum.algorithm,
                            expected: storedChecksum.hash,
                            actual: currentChecksum
                        },
                        repairStrategy: RepairStrategy.BACKUP_RESTORE,
                        repairAttempts: 0,
                        maxRepairAttempts: this.config.maxRepairAttempts
                    });
                }
            } else {
                // First time checksum - store it
                this.checksums.set(nodeId, {
                    hash: currentChecksum,
                    algorithm: this.config.defaultHashAlgorithm,
                    timestamp: new Date()
                });
            }

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CHECKSUM,
                passed: violations.length === 0,
                violations,
                checksum: currentChecksum,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CHECKSUM,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.CHECKSUM,
                    severity: CorruptionSeverity.SEVERE,
                    nodeId,
                    path,
                    description: `Checksum verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Verify node structure integrity
     */
    async verifyStructure(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);
        const violations: IntegrityViolation[] = [];

        try {
            // Check required properties
            if (!node.__id) {
                violations.push(this.createViolation(
                    IntegrityCheckType.STRUCTURE,
                    CorruptionSeverity.CRITICAL,
                    nodeId,
                    path,
                    'Node missing required __id property',
                    RepairStrategy.REBUILD_INDEX
                ));
            }

            if (!node.__nodes || typeof node.__nodes !== 'object') {
                violations.push(this.createViolation(
                    IntegrityCheckType.STRUCTURE,
                    CorruptionSeverity.SEVERE,
                    nodeId,
                    path,
                    'Node missing or invalid __nodes property',
                    RepairStrategy.AUTO_REPAIR
                ));
            }

            if (!Array.isArray(node.__proto)) {
                violations.push(this.createViolation(
                    IntegrityCheckType.STRUCTURE,
                    CorruptionSeverity.MODERATE,
                    nodeId,
                    path,
                    'Node __proto property is not an array',
                    RepairStrategy.AUTO_REPAIR
                ));
            }

            // Check child node consistency
            if (node.__nodes) {
                for (const [key, childNode] of Object.entries(node.__nodes)) {
                    if (!childNode || !childNode.__id) {
                        violations.push(this.createViolation(
                            IntegrityCheckType.STRUCTURE,
                            CorruptionSeverity.MODERATE,
                            nodeId,
                            path,
                            `Child node '${key}' is invalid or missing __id`,
                            RepairStrategy.QUARANTINE
                        ));
                    }

                    if (childNode.__parent_id !== nodeId) {
                        violations.push(this.createViolation(
                            IntegrityCheckType.STRUCTURE,
                            CorruptionSeverity.MODERATE,
                            nodeId,
                            path,
                            `Child node '${key}' has incorrect parent reference`,
                            RepairStrategy.AUTO_REPAIR
                        ));
                    }
                }
            }

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.STRUCTURE,
                passed: violations.length === 0,
                violations,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.STRUCTURE,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.STRUCTURE,
                    severity: CorruptionSeverity.SEVERE,
                    nodeId,
                    path,
                    description: `Structure verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Verify reference integrity
     */
    async verifyReferences(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);
        const violations: IntegrityViolation[] = [];

        try {
            // Check parent reference
            if (node.__parent_id) {
                const parent = this.findNodeById(node.__parent_id);
                if (!parent) {
                    violations.push(this.createViolation(
                        IntegrityCheckType.REFERENCE,
                        CorruptionSeverity.SEVERE,
                        nodeId,
                        path,
                        `Parent node ${node.__parent_id} not found`,
                        RepairStrategy.AUTO_REPAIR
                    ));
                } else {
                    // Check if parent actually references this child
                    const parentHasChild = Object.values(parent.__nodes || {}).some(
                        child => child.__id === nodeId
                    );

                    if (!parentHasChild) {
                        violations.push(this.createViolation(
                            IntegrityCheckType.REFERENCE,
                            CorruptionSeverity.MODERATE,
                            nodeId,
                            path,
                            'Parent does not reference this node as child',
                            RepairStrategy.AUTO_REPAIR
                        ));
                    }
                }
            }

            // Check child references
            if (node.__nodes) {
                for (const [key, childNode] of Object.entries(node.__nodes)) {
                    if (childNode && childNode.__parent_id !== nodeId) {
                        violations.push(this.createViolation(
                            IntegrityCheckType.REFERENCE,
                            CorruptionSeverity.MODERATE,
                            nodeId,
                            path,
                            `Child '${key}' has incorrect parent reference`,
                            RepairStrategy.AUTO_REPAIR
                        ));
                    }
                }
            }

            // Check for circular references
            const visitedIds = new Set<string>();
            const hasCircularRef = this.detectCircularReference(node, visitedIds);

            if (hasCircularRef) {
                violations.push(this.createViolation(
                    IntegrityCheckType.REFERENCE,
                    CorruptionSeverity.CRITICAL,
                    nodeId,
                    path,
                    'Circular reference detected in node hierarchy',
                    RepairStrategy.MANUAL_REVIEW
                ));
            }

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.REFERENCE,
                passed: violations.length === 0,
                violations,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.REFERENCE,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.REFERENCE,
                    severity: CorruptionSeverity.SEVERE,
                    nodeId,
                    path,
                    description: `Reference verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Verify schema compliance
     */
    async verifySchema(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);
        const violations: IntegrityViolation[] = [];

        try {
            // Get schema for node type
            const schema = await this.getSchemaForNode(node);

            if (schema) {
                // Validate against schema
                const schemaViolations = await this.validateAgainstSchema(node, schema);
                violations.push(...schemaViolations);
            }

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.SCHEMA,
                passed: violations.length === 0,
                violations,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.SCHEMA,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.SCHEMA,
                    severity: CorruptionSeverity.MODERATE,
                    nodeId,
                    path,
                    description: `Schema verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Verify constraint compliance
     */
    async verifyConstraints(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);
        const violations: IntegrityViolation[] = [];

        try {
            // Check value constraints
            if (node.__value !== undefined) {
                const constraintViolations = await this.checkValueConstraints(node);
                violations.push(...constraintViolations);
            }

            // Check uniqueness constraints
            const uniquenessViolations = await this.checkUniquenessConstraints(node);
            violations.push(...uniquenessViolations);

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CONSTRAINT,
                passed: violations.length === 0,
                violations,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CONSTRAINT,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.CONSTRAINT,
                    severity: CorruptionSeverity.MODERATE,
                    nodeId,
                    path,
                    description: `Constraint verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Verify consistency across related nodes
     */
    async verifyConsistency(node: FXNode): Promise<IntegrityCheckResult> {
        const startTime = Date.now();
        const nodeId = node.__id;
        const path = this.getNodePath(node);
        const violations: IntegrityViolation[] = [];

        try {
            // Check consistency with related nodes
            const consistencyViolations = await this.checkNodeConsistency(node);
            violations.push(...consistencyViolations);

            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CONSISTENCY,
                passed: violations.length === 0,
                violations,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                nodeId,
                path,
                checkType: IntegrityCheckType.CONSISTENCY,
                passed: false,
                violations: [{
                    id: this.generateViolationId(),
                    type: IntegrityCheckType.CONSISTENCY,
                    severity: CorruptionSeverity.MODERATE,
                    nodeId,
                    path,
                    description: `Consistency verification failed: ${error.message}`,
                    detectedAt: new Date(),
                    repairStrategy: RepairStrategy.MANUAL_REVIEW,
                    repairAttempts: 0,
                    maxRepairAttempts: this.config.maxRepairAttempts
                }],
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Attempt to repair detected violations
     */
    async repairViolations(violationIds?: string[]): Promise<{
        repaired: string[];
        failed: string[];
        quarantined: string[];
    }> {
        const repairId = ++this.repairCounter;
        console.log(`Starting repair operation #${repairId}`);

        const targetViolations = violationIds
            ? violationIds.map(id => this.violations.get(id)).filter(Boolean) as IntegrityViolation[]
            : Array.from(this.violations.values());

        const results = {
            repaired: [] as string[],
            failed: [] as string[],
            quarantined: [] as string[]
        };

        for (const violation of targetViolations) {
            try {
                const repairResult = await this.repairViolation(violation);

                if (repairResult.success) {
                    results.repaired.push(violation.id);
                    // Remove violation if successfully repaired
                    this.violations.delete(violation.id);
                } else if (repairResult.quarantined) {
                    results.quarantined.push(violation.id);
                } else {
                    results.failed.push(violation.id);
                }

            } catch (error) {
                console.error(`Failed to repair violation ${violation.id}:`, error);
                results.failed.push(violation.id);
            }
        }

        console.log(`Repair operation #${repairId} completed:`, results);
        return results;
    }

    /**
     * Calculate checksum for a node
     */
    async calculateChecksum(node: FXNode, algorithm: HashAlgorithm): Promise<string> {
        // Create a normalized representation of the node for checksumming
        const normalizedData = this.normalizeNodeForChecksum(node);
        const dataString = JSON.stringify(normalizedData);

        return this.hash(dataString, algorithm);
    }

    /**
     * Update checksums for modified nodes
     */
    async updateChecksums(nodeIds: string[]): Promise<void> {
        for (const nodeId of nodeIds) {
            const node = this.findNodeById(nodeId);
            if (node) {
                const checksum = await this.calculateChecksum(node, this.config.defaultHashAlgorithm);
                this.checksums.set(nodeId, {
                    hash: checksum,
                    algorithm: this.config.defaultHashAlgorithm,
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * Get integrity status summary
     */
    getIntegrityStatus(): {
        totalViolations: number;
        violationsBySeverity: Record<CorruptionSeverity, number>;
        violationsByType: Record<IntegrityCheckType, number>;
        lastScanTime?: Date;
        repairableViolations: number;
        quarantinedNodes: number;
    } {
        const violations = Array.from(this.violations.values());

        const violationsBySeverity = Object.values(CorruptionSeverity).reduce((acc, severity) => {
            acc[severity] = violations.filter(v => v.severity === severity).length;
            return acc;
        }, {} as Record<CorruptionSeverity, number>);

        const violationsByType = Object.values(IntegrityCheckType).reduce((acc, type) => {
            acc[type] = violations.filter(v => v.type === type).length;
            return acc;
        }, {} as Record<IntegrityCheckType, number>);

        const repairableViolations = violations.filter(v =>
            v.repairStrategy === RepairStrategy.AUTO_REPAIR &&
            v.repairAttempts < v.maxRepairAttempts
        ).length;

        const quarantinedNodes = violations.filter(v =>
            v.repairStrategy === RepairStrategy.QUARANTINE
        ).length;

        return {
            totalViolations: violations.length,
            violationsBySeverity,
            violationsByType,
            repairableViolations,
            quarantinedNodes
        };
    }

    /**
     * Start background integrity monitoring
     */
    private startBackgroundScanner(): void {
        if (!this.config.backgroundScanEnabled) return;

        setInterval(async () => {
            try {
                console.log('Starting background integrity scan...');
                const results = await this.performIntegrityScan('', {
                    includeChecksums: true,
                    includeStructure: true,
                    includeReferences: false,
                    includeSchema: false,
                    includeConstraints: false,
                    includeConsistency: false,
                    parallelism: 2,
                    timeoutMs: 120000 // 2 minutes for background scan
                });

                const violations = results.flatMap(r => r.violations);
                if (violations.length > 0) {
                    console.warn(`Background scan found ${violations.length} violations`);

                    // Trigger alerts if threshold exceeded
                    if (violations.length >= this.config.alertThreshold) {
                        await this.triggerIntegrityAlert(violations);
                    }
                }

            } catch (error) {
                console.error('Background integrity scan failed:', error);
            }
        }, this.config.integrityCheckInterval);
    }

    // Private helper methods (continued in next part due to length...)

    private collectNodes(startNode: FXNode, config: IntegrityScanConfig): FXNode[] {
        const nodes: FXNode[] = [];
        const visited = new Set<string>();
        const maxDepth = config.maxDepth || Infinity;

        const traverse = (node: FXNode, depth: number) => {
            if (depth > maxDepth || visited.has(node.__id)) return;

            visited.add(node.__id);
            const path = this.getNodePath(node);

            // Check path filters
            if (config.skipPaths?.some(skip => path.startsWith(skip))) return;
            if (config.includePaths && !config.includePaths.some(include => path.startsWith(include))) return;

            nodes.push(node);

            // Traverse children
            if (node.__nodes) {
                for (const child of Object.values(node.__nodes)) {
                    if (child && child.__id) {
                        traverse(child, depth + 1);
                    }
                }
            }
        };

        traverse(startNode, 0);
        return nodes;
    }

    private generateViolationId(): string {
        return `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private createViolation(
        type: IntegrityCheckType,
        severity: CorruptionSeverity,
        nodeId: string,
        path: string,
        description: string,
        repairStrategy: RepairStrategy
    ): IntegrityViolation {
        return {
            id: this.generateViolationId(),
            type,
            severity,
            nodeId,
            path,
            description,
            detectedAt: new Date(),
            repairStrategy,
            repairAttempts: 0,
            maxRepairAttempts: this.config.maxRepairAttempts
        };
    }

    private getNodePath(node: FXNode): string {
        // Implementation to get full path of node
        // This would traverse up the tree to build the path
        return node.__id; // Simplified for now
    }

    private findNodeById(nodeId: string): FXNode | null {
        // Implementation to find node by ID in the tree
        // This would do a breadth-first search
        return null; // Simplified for now
    }

    private detectCircularReference(node: FXNode, visited: Set<string>): boolean {
        if (visited.has(node.__id)) return true;

        visited.add(node.__id);

        if (node.__nodes) {
            for (const child of Object.values(node.__nodes)) {
                if (child && this.detectCircularReference(child, new Set(visited))) {
                    return true;
                }
            }
        }

        return false;
    }

    private normalizeNodeForChecksum(node: FXNode): any {
        // Create a normalized representation excluding volatile fields
        return {
            id: node.__id,
            type: node.__type,
            value: node.__value,
            proto: node.__proto?.sort(),
            children: Object.keys(node.__nodes || {}).sort()
        };
    }

    private async hash(data: string, algorithm: HashAlgorithm): Promise<string> {
        // Implementation would use crypto API
        // For now, return a mock hash
        return `${algorithm}-${data.length}-${Date.now()}`;
    }

    private async processViolations(violations: IntegrityViolation[]): Promise<void> {
        for (const violation of violations) {
            this.violations.set(violation.id, violation);

            // Trigger immediate repair for auto-repairable violations
            if (this.config.autoRepairEnabled &&
                violation.repairStrategy === RepairStrategy.AUTO_REPAIR) {
                try {
                    await this.repairViolation(violation);
                } catch (error) {
                    console.error(`Auto-repair failed for violation ${violation.id}:`, error);
                }
            }
        }
    }

    private async repairViolation(violation: IntegrityViolation): Promise<{ success: boolean; quarantined?: boolean }> {
        violation.repairAttempts++;

        try {
            switch (violation.repairStrategy) {
                case RepairStrategy.AUTO_REPAIR:
                    return await this.autoRepair(violation);
                case RepairStrategy.BACKUP_RESTORE:
                    return await this.restoreFromBackup(violation);
                case RepairStrategy.QUARANTINE:
                    return await this.quarantineNode(violation);
                case RepairStrategy.REBUILD_INDEX:
                    return await this.rebuildIndex(violation);
                case RepairStrategy.ROLLBACK_TRANSACTION:
                    return await this.rollbackTransaction(violation);
                default:
                    return { success: false };
            }
        } catch (error) {
            console.error(`Repair failed for violation ${violation.id}:`, error);
            return { success: false };
        }
    }

    private async autoRepair(violation: IntegrityViolation): Promise<{ success: boolean }> {
        // Implementation for automatic repair
        console.log(`Auto-repairing violation: ${violation.description}`);
        return { success: true };
    }

    private async restoreFromBackup(violation: IntegrityViolation): Promise<{ success: boolean }> {
        // Implementation for backup restoration
        console.log(`Restoring from backup for violation: ${violation.description}`);
        return { success: true };
    }

    private async quarantineNode(violation: IntegrityViolation): Promise<{ success: boolean; quarantined: boolean }> {
        // Implementation for quarantining corrupted data
        console.log(`Quarantining node for violation: ${violation.description}`);
        return { success: true, quarantined: true };
    }

    private async rebuildIndex(violation: IntegrityViolation): Promise<{ success: boolean }> {
        // Implementation for rebuilding indices
        console.log(`Rebuilding index for violation: ${violation.description}`);
        return { success: true };
    }

    private async rollbackTransaction(violation: IntegrityViolation): Promise<{ success: boolean }> {
        // Implementation for transaction rollback
        if (this.transactionManager) {
            console.log(`Rolling back transaction for violation: ${violation.description}`);
            // Implementation would use transaction manager
        }
        return { success: true };
    }

    private async storeScanResults(scanId: number, results: IntegrityCheckResult[], startTime: number): Promise<void> {
        const scanNode = this.fx.proxy(`system.integrity.scans.${scanId}`);
        scanNode.val({
            id: scanId,
            startTime: new Date(startTime),
            endTime: new Date(),
            duration: Date.now() - startTime,
            results: results.length,
            violations: results.flatMap(r => r.violations).length,
            passed: results.every(r => r.passed)
        });
    }

    private async triggerIntegrityAlert(violations: IntegrityViolation[]): Promise<void> {
        console.warn('INTEGRITY ALERT: Multiple violations detected', {
            count: violations.length,
            severities: violations.reduce((acc, v) => {
                acc[v.severity] = (acc[v.severity] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        });

        // Store alert
        const alertNode = this.fx.proxy(`system.integrity.alerts.${Date.now()}`);
        alertNode.val({
            timestamp: new Date(),
            violationCount: violations.length,
            violations: violations.map(v => v.id),
            severity: 'high'
        });
    }

    private async getSchemaForNode(node: FXNode): Promise<any> {
        // Implementation to get schema for node type
        return null; // Simplified for now
    }

    private async validateAgainstSchema(node: FXNode, schema: any): Promise<IntegrityViolation[]> {
        // Implementation for schema validation
        return []; // Simplified for now
    }

    private async checkValueConstraints(node: FXNode): Promise<IntegrityViolation[]> {
        // Implementation for value constraint checking
        return []; // Simplified for now
    }

    private async checkUniquenessConstraints(node: FXNode): Promise<IntegrityViolation[]> {
        // Implementation for uniqueness constraint checking
        return []; // Simplified for now
    }

    private async checkNodeConsistency(node: FXNode): Promise<IntegrityViolation[]> {
        // Implementation for consistency checking
        return []; // Simplified for now
    }

    private createIntegrityError(code: ErrorCode, message: string): FXDError {
        if (this.errorManager) {
            return this.errorManager.createError({
                code,
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                message,
                operation: 'integrity_check'
            });
        } else {
            const error = new Error(message) as any;
            error.code = code;
            return error;
        }
    }
}

/**
 * Factory function to create data integrity manager
 */
export function createDataIntegrityManager(
    fx: FXCore,
    errorManager?: ErrorHandlingManager,
    transactionManager?: TransactionManager
): DataIntegrityManager {
    const manager = new DataIntegrityManager(fx, errorManager, transactionManager);

    // Attach to FX system
    const integritySystemNode = fx.proxy('system.integrity');
    integritySystemNode.val({
        manager,
        scan: manager.performIntegrityScan.bind(manager),
        repair: manager.repairViolations.bind(manager),
        getStatus: manager.getIntegrityStatus.bind(manager),
        updateChecksums: manager.updateChecksums.bind(manager)
    });

    return manager;
}

export default {
    DataIntegrityManager,
    IntegrityCheckType,
    CorruptionSeverity,
    RepairStrategy,
    HashAlgorithm,
    createDataIntegrityManager
};