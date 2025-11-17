/**
 * @file transaction-manager.ts
 * @agent: agent-persistence
 * @timestamp: 2025-10-02
 * @description Transaction management for FXD persistence layer
 * Provides transaction support, rollback, savepoints, and atomic operations
 */

import { SQLiteDatabase } from './db-connection.ts';

/**
 * Transaction isolation levels
 */
export enum IsolationLevel {
  DEFERRED = 'DEFERRED',
  IMMEDIATE = 'IMMEDIATE',
  EXCLUSIVE = 'EXCLUSIVE'
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolation?: IsolationLevel;
  retries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

/**
 * Savepoint for nested transactions
 */
export class Savepoint {
  constructor(
    public readonly name: string,
    public readonly depth: number,
    public readonly timestamp: Date = new Date()
  ) {}
}

/**
 * Transaction manager for database operations
 */
export class TransactionManager {
  private savepoints: Savepoint[] = [];
  private transactionDepth = 0;
  private currentTransaction: (() => void) | null = null;

  constructor(private db: SQLiteDatabase) {}

  /**
   * Execute a function within a transaction
   */
  async execute<T>(
    fn: () => T | Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      isolation = IsolationLevel.DEFERRED,
      retries = 3,
      retryDelay = 100,
      onError,
      onSuccess
    } = options;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < retries) {
      try {
        const result = await this.executeOnce(fn, isolation);

        if (onSuccess) {
          onSuccess();
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (onError) {
          onError(lastError);
        }

        if (attempt < retries) {
          console.warn(
            `[TransactionManager] Transaction failed (attempt ${attempt}/${retries}), retrying...`,
            lastError.message
          );
          await this.delay(retryDelay * attempt);
        }
      }
    }

    throw new Error(
      `Transaction failed after ${retries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Execute transaction once
   */
  private async executeOnce<T>(
    fn: () => T | Promise<T>,
    isolation: IsolationLevel
  ): Promise<T> {
    if (this.db.inTransaction) {
      // Already in transaction, create savepoint
      return this.executeWithSavepoint(fn);
    }

    // Start new transaction
    const transaction = this.db.transaction(() => {
      this.transactionDepth++;
      try {
        const result = fn();
        this.transactionDepth--;
        return result;
      } catch (error) {
        this.transactionDepth--;
        throw error;
      }
    });

    try {
      const result = transaction();
      return result as T;
    } catch (error) {
      console.error('[TransactionManager] Transaction error:', error);
      throw error;
    }
  }

  /**
   * Execute with savepoint (nested transaction)
   */
  private async executeWithSavepoint<T>(fn: () => T | Promise<T>): Promise<T> {
    const savepoint = this.createSavepoint();

    try {
      const result = await fn();
      this.releaseSavepoint(savepoint);
      return result;
    } catch (error) {
      this.rollbackToSavepoint(savepoint);
      throw error;
    }
  }

  /**
   * Create a savepoint
   */
  private createSavepoint(): Savepoint {
    const depth = this.savepoints.length;
    const name = `sp_${depth}_${Date.now()}`;
    const savepoint = new Savepoint(name, depth);

    this.db.exec(`SAVEPOINT ${name}`);
    this.savepoints.push(savepoint);

    console.log(`[TransactionManager] Created savepoint: ${name}`);
    return savepoint;
  }

  /**
   * Release a savepoint
   */
  private releaseSavepoint(savepoint: Savepoint): void {
    this.db.exec(`RELEASE SAVEPOINT ${savepoint.name}`);

    const index = this.savepoints.indexOf(savepoint);
    if (index !== -1) {
      this.savepoints.splice(index, 1);
    }

    console.log(`[TransactionManager] Released savepoint: ${savepoint.name}`);
  }

  /**
   * Rollback to a savepoint
   */
  private rollbackToSavepoint(savepoint: Savepoint): void {
    this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint.name}`);

    // Remove this and all deeper savepoints
    const index = this.savepoints.indexOf(savepoint);
    if (index !== -1) {
      this.savepoints.splice(index);
    }

    console.log(`[TransactionManager] Rolled back to savepoint: ${savepoint.name}`);
  }

  /**
   * Batch execute multiple operations in a single transaction
   */
  async batch<T>(
    operations: Array<() => T | Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.execute(async () => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Execute operation with automatic retry on deadlock
   */
  async withRetry<T>(
    fn: () => T | Promise<T>,
    maxRetries = 5,
    baseDelay = 50
  ): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        const errorMessage = (error as Error).message.toLowerCase();

        // Check if it's a lock or busy error
        if (
          errorMessage.includes('locked') ||
          errorMessage.includes('busy') ||
          errorMessage.includes('database is locked')
        ) {
          attempt++;

          if (attempt >= maxRetries) {
            throw new Error(`Operation failed after ${maxRetries} retries: ${errorMessage}`);
          }

          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(
            `[TransactionManager] Database locked, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
          );

          await this.delay(delay);
        } else {
          // Not a lock error, rethrow
          throw error;
        }
      }
    }

    throw new Error('Unexpected error in retry logic');
  }

  /**
   * Check if currently in a transaction
   */
  get inTransaction(): boolean {
    return this.db.inTransaction;
  }

  /**
   * Get current transaction depth
   */
  get depth(): number {
    return this.transactionDepth;
  }

  /**
   * Get active savepoints
   */
  getSavepoints(): Savepoint[] {
    return [...this.savepoints];
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute multiple independent transactions in parallel
   * WARNING: Use with caution - can cause database locks
   */
  async parallel<T>(
    transactions: Array<() => T | Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    console.warn(
      '[TransactionManager] Parallel transactions may cause locks, consider using batch() instead'
    );

    const promises = transactions.map(transaction =>
      this.execute(transaction, options)
    );

    return Promise.all(promises);
  }

  /**
   * Begin an explicit transaction (manual mode)
   */
  begin(isolation: IsolationLevel = IsolationLevel.DEFERRED): void {
    if (this.db.inTransaction) {
      throw new Error('Transaction already in progress');
    }

    this.db.exec(`BEGIN ${isolation} TRANSACTION`);
    this.transactionDepth++;
    console.log(`[TransactionManager] Transaction started (${isolation})`);
  }

  /**
   * Commit explicit transaction (manual mode)
   */
  commit(): void {
    if (!this.db.inTransaction) {
      throw new Error('No transaction in progress');
    }

    this.db.exec('COMMIT');
    this.transactionDepth--;
    this.savepoints = [];
    console.log('[TransactionManager] Transaction committed');
  }

  /**
   * Rollback explicit transaction (manual mode)
   */
  rollback(): void {
    if (!this.db.inTransaction) {
      throw new Error('No transaction in progress');
    }

    this.db.exec('ROLLBACK');
    this.transactionDepth--;
    this.savepoints = [];
    console.log('[TransactionManager] Transaction rolled back');
  }

  /**
   * Get transaction statistics
   */
  getStats(): {
    inTransaction: boolean;
    depth: number;
    savepointCount: number;
    savepoints: Array<{ name: string; depth: number; age: number }>;
  } {
    return {
      inTransaction: this.inTransaction,
      depth: this.transactionDepth,
      savepointCount: this.savepoints.length,
      savepoints: this.savepoints.map(sp => ({
        name: sp.name,
        depth: sp.depth,
        age: Date.now() - sp.timestamp.getTime()
      }))
    };
  }

  /**
   * Cleanup all savepoints (emergency use only)
   */
  cleanup(): void {
    if (this.db.inTransaction) {
      console.warn('[TransactionManager] Force cleanup - rolling back transaction');
      try {
        this.rollback();
      } catch (error) {
        console.error('[TransactionManager] Cleanup error:', error);
      }
    }

    this.savepoints = [];
    this.transactionDepth = 0;
    console.log('[TransactionManager] Cleanup completed');
  }
}

/**
 * Helper class for atomic operations
 */
export class AtomicOperations {
  constructor(private tm: TransactionManager) {}

  /**
   * Atomic increment
   */
  async increment(
    tableName: string,
    field: string,
    id: string,
    amount = 1
  ): Promise<number> {
    return this.tm.execute(() => {
      const db = (this.tm as any).db;
      const stmt = db.prepare(`
        UPDATE ${tableName}
        SET ${field} = ${field} + ?
        WHERE id = ?
        RETURNING ${field}
      `);

      const result = stmt.get(amount, id) as any;
      return result?.[field] || 0;
    });
  }

  /**
   * Atomic decrement
   */
  async decrement(
    tableName: string,
    field: string,
    id: string,
    amount = 1
  ): Promise<number> {
    return this.increment(tableName, field, id, -amount);
  }

  /**
   * Compare and swap operation
   */
  async compareAndSwap(
    tableName: string,
    field: string,
    id: string,
    expectedValue: any,
    newValue: any
  ): Promise<boolean> {
    return this.tm.execute(() => {
      const db = (this.tm as any).db;

      // Check current value
      const checkStmt = db.prepare(`
        SELECT ${field} FROM ${tableName} WHERE id = ?
      `);
      const current = checkStmt.get(id) as any;

      if (current?.[field] !== expectedValue) {
        return false;
      }

      // Update if matches
      const updateStmt = db.prepare(`
        UPDATE ${tableName} SET ${field} = ? WHERE id = ? AND ${field} = ?
      `);
      const result = updateStmt.run(newValue, id, expectedValue);

      return result.changes > 0;
    });
  }
}

/**
 * Factory function to create transaction manager
 */
export function createTransactionManager(db: SQLiteDatabase): TransactionManager {
  return new TransactionManager(db);
}

/**
 * Factory function to create atomic operations
 */
export function createAtomicOperations(tm: TransactionManager): AtomicOperations {
  return new AtomicOperations(tm);
}
