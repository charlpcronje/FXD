/**
 * @file errors.ts
 * @description Error handling utilities for FXD Backend
 *
 * Provides structured error types, error handling utilities,
 * and conversion to API-friendly error responses.
 */

import { ErrorResponse } from './types/api-types.ts';

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Disk errors
  DISK_NOT_FOUND = 'DISK_NOT_FOUND',
  DISK_ALREADY_MOUNTED = 'DISK_ALREADY_MOUNTED',
  DISK_NOT_MOUNTED = 'DISK_NOT_MOUNTED',
  DISK_CORRUPT = 'DISK_CORRUPT',
  DISK_CREATION_FAILED = 'DISK_CREATION_FAILED',
  MOUNT_ERROR = 'MOUNT_ERROR',
  UNMOUNT_ERROR = 'UNMOUNT_ERROR',

  // Node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_ALREADY_EXISTS = 'NODE_ALREADY_EXISTS',
  NODE_INVALID_PATH = 'NODE_INVALID_PATH',
  NODE_INVALID_VALUE = 'NODE_INVALID_VALUE',
  NODE_HAS_CHILDREN = 'NODE_HAS_CHILDREN',

  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  IMPORT_ERROR = 'IMPORT_ERROR',

  // Binding errors
  BINDING_NOT_FOUND = 'BINDING_NOT_FOUND',
  BINDING_INVALID_CONFIG = 'BINDING_INVALID_CONFIG',
  BINDING_CIRCULAR = 'BINDING_CIRCULAR',
  BINDING_CONFLICT = 'BINDING_CONFLICT',

  // Signal errors
  SIGNAL_STREAM_ERROR = 'SIGNAL_STREAM_ERROR',
  SIGNAL_SUBSCRIBE_ERROR = 'SIGNAL_SUBSCRIBE_ERROR',

  // VFS errors
  VFS_NOT_INITIALIZED = 'VFS_NOT_INITIALIZED',
  VFS_MOUNT_ERROR = 'VFS_MOUNT_ERROR',
  VFS_SYNC_ERROR = 'VFS_SYNC_ERROR',

  // RAMDisk errors
  RAMDISK_NOT_FOUND = 'RAMDISK_NOT_FOUND',
  RAMDISK_DRIVER_UNAVAILABLE = 'RAMDISK_DRIVER_UNAVAILABLE',
  RAMDISK_CREATION_FAILED = 'RAMDISK_CREATION_FAILED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_PARAMETER = 'INVALID_PARAMETER',

  // Internal errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base FXD error
 */
export class FXDError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'FXDError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Disk-related errors
 */
export class DiskNotFoundError extends FXDError {
  constructor(diskId: string) {
    super(
      ErrorCode.DISK_NOT_FOUND,
      `Disk not found: ${diskId}`,
      { diskId },
      404
    );
    this.name = 'DiskNotFoundError';
  }
}

export class DiskAlreadyMountedError extends FXDError {
  constructor(diskId: string, mountPoint: string) {
    super(
      ErrorCode.DISK_ALREADY_MOUNTED,
      `Disk ${diskId} is already mounted at ${mountPoint}`,
      { diskId, mountPoint },
      409
    );
    this.name = 'DiskAlreadyMountedError';
  }
}

export class DiskNotMountedError extends FXDError {
  constructor(diskId: string) {
    super(
      ErrorCode.DISK_NOT_MOUNTED,
      `Disk not mounted: ${diskId}`,
      { diskId },
      400
    );
    this.name = 'DiskNotMountedError';
  }
}

export class DiskCorruptError extends FXDError {
  constructor(path: string, reason: string) {
    super(
      ErrorCode.DISK_CORRUPT,
      `Disk file is corrupt: ${path} (${reason})`,
      { path, reason },
      422
    );
    this.name = 'DiskCorruptError';
  }
}

export class MountError extends FXDError {
  constructor(reason: string, details?: any) {
    super(
      ErrorCode.MOUNT_ERROR,
      `Mount failed: ${reason}`,
      details,
      500
    );
    this.name = 'MountError';
  }
}

/**
 * Node-related errors
 */
export class NodeNotFoundError extends FXDError {
  constructor(path: string) {
    super(
      ErrorCode.NODE_NOT_FOUND,
      `Node not found: ${path}`,
      { path },
      404
    );
    this.name = 'NodeNotFoundError';
  }
}

export class NodeAlreadyExistsError extends FXDError {
  constructor(path: string) {
    super(
      ErrorCode.NODE_ALREADY_EXISTS,
      `Node already exists: ${path}`,
      { path },
      409
    );
    this.name = 'NodeAlreadyExistsError';
  }
}

export class InvalidNodePathError extends FXDError {
  constructor(path: string, reason: string) {
    super(
      ErrorCode.NODE_INVALID_PATH,
      `Invalid node path: ${path} (${reason})`,
      { path, reason },
      400
    );
    this.name = 'InvalidNodePathError';
  }
}

export class NodeHasChildrenError extends FXDError {
  constructor(path: string, childCount: number) {
    super(
      ErrorCode.NODE_HAS_CHILDREN,
      `Cannot delete node with children: ${path} (${childCount} children)`,
      { path, childCount },
      400
    );
    this.name = 'NodeHasChildrenError';
  }
}

/**
 * File-related errors
 */
export class FileNotFoundError extends FXDError {
  constructor(path: string) {
    super(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${path}`,
      { path },
      404
    );
    this.name = 'FileNotFoundError';
  }
}

export class FileReadError extends FXDError {
  constructor(path: string, reason: string) {
    super(
      ErrorCode.FILE_READ_ERROR,
      `Failed to read file: ${path} (${reason})`,
      { path, reason },
      500
    );
    this.name = 'FileReadError';
  }
}

export class FileWriteError extends FXDError {
  constructor(path: string, reason: string) {
    super(
      ErrorCode.FILE_WRITE_ERROR,
      `Failed to write file: ${path} (${reason})`,
      { path, reason },
      500
    );
    this.name = 'FileWriteError';
  }
}

/**
 * Binding-related errors
 */
export class BindingNotFoundError extends FXDError {
  constructor(bindingId: string) {
    super(
      ErrorCode.BINDING_NOT_FOUND,
      `Binding not found: ${bindingId}`,
      { bindingId },
      404
    );
    this.name = 'BindingNotFoundError';
  }
}

export class InvalidBindingConfigError extends FXDError {
  constructor(reason: string, details?: any) {
    super(
      ErrorCode.BINDING_INVALID_CONFIG,
      `Invalid binding configuration: ${reason}`,
      details,
      400
    );
    this.name = 'InvalidBindingConfigError';
  }
}

export class CircularBindingError extends FXDError {
  constructor(path: string) {
    super(
      ErrorCode.BINDING_CIRCULAR,
      `Circular binding detected: ${path}`,
      { path },
      400
    );
    this.name = 'CircularBindingError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends FXDError {
  constructor(field: string, reason: string) {
    super(
      ErrorCode.VALIDATION_ERROR,
      `Validation failed for ${field}: ${reason}`,
      { field, reason },
      400
    );
    this.name = 'ValidationError';
  }
}

export class MissingParameterError extends FXDError {
  constructor(parameter: string) {
    super(
      ErrorCode.MISSING_PARAMETER,
      `Missing required parameter: ${parameter}`,
      { parameter },
      400
    );
    this.name = 'MissingParameterError';
  }
}

/**
 * VFS errors
 */
export class VFSNotInitializedError extends FXDError {
  constructor() {
    super(
      ErrorCode.VFS_NOT_INITIALIZED,
      'VFS is not initialized',
      {},
      500
    );
    this.name = 'VFSNotInitializedError';
  }
}

/**
 * RAMDisk errors
 */
export class RAMDiskNotFoundError extends FXDError {
  constructor(id: string) {
    super(
      ErrorCode.RAMDISK_NOT_FOUND,
      `RAMDisk not found: ${id}`,
      { id },
      404
    );
    this.name = 'RAMDiskNotFoundError';
  }
}

export class RAMDiskDriverUnavailableError extends FXDError {
  constructor(driver: string) {
    super(
      ErrorCode.RAMDISK_DRIVER_UNAVAILABLE,
      `RAMDisk driver unavailable: ${driver}`,
      { driver },
      503
    );
    this.name = 'RAMDiskDriverUnavailableError';
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Convert error to API-friendly error response
 */
export function toErrorResponse(error: Error, includeStack = false): ErrorResponse {
  // FXD errors
  if (error instanceof FXDError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: includeStack ? error.stack : undefined,
      timestamp: new Date(),
    };
  }

  // Deno errors
  if (error.name === 'NotFound') {
    return {
      code: ErrorCode.NOT_FOUND,
      message: error.message,
      stack: includeStack ? error.stack : undefined,
      timestamp: new Date(),
    };
  }

  if (error.name === 'PermissionDenied') {
    return {
      code: ErrorCode.FORBIDDEN,
      message: error.message,
      stack: includeStack ? error.stack : undefined,
      timestamp: new Date(),
    };
  }

  // Unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: error.message || 'An unknown error occurred',
    stack: includeStack ? error.stack : undefined,
    timestamp: new Date(),
  };
}

/**
 * Get HTTP status code for error
 */
export function getStatusCode(error: Error): number {
  if (error instanceof FXDError) {
    return error.statusCode;
  }

  if (error.name === 'NotFound') {
    return 404;
  }

  if (error.name === 'PermissionDenied') {
    return 403;
  }

  return 500;
}

/**
 * Safe error logger
 */
export function logError(error: Error, context?: string): void {
  const prefix = context ? `[${context}]` : '';

  if (error instanceof FXDError) {
    console.error(`${prefix} FXD Error [${error.code}]: ${error.message}`, error.details || '');
  } else {
    console.error(`${prefix} Error:`, error.message);
  }

  // Log stack trace in development
  if (Deno.env.get('ENV') === 'development') {
    console.error(error.stack);
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  };
}

/**
 * Validate required parameters
 */
export function validateRequired(params: Record<string, any>, required: string[]): void {
  for (const param of required) {
    if (params[param] === undefined || params[param] === null) {
      throw new MissingParameterError(param);
    }
  }
}

/**
 * Validate parameter type
 */
export function validateType(
  value: any,
  expectedType: string,
  paramName: string
): void {
  const actualType = typeof value;

  if (actualType !== expectedType) {
    throw new ValidationError(
      paramName,
      `Expected ${expectedType}, got ${actualType}`
    );
  }
}

/**
 * Validate path format
 */
export function validatePath(path: string, paramName: string = 'path'): void {
  if (!path || typeof path !== 'string') {
    throw new ValidationError(paramName, 'Path must be a non-empty string');
  }

  // Check for invalid characters
  if (path.includes('..')) {
    throw new InvalidNodePathError(path, 'Path cannot contain ".."');
  }

  // Check for absolute paths (unless it's a file system path)
  if (path.startsWith('/') && !paramName.includes('file')) {
    throw new InvalidNodePathError(path, 'Path must be relative');
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 100,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new FXDError(
        ErrorCode.TIMEOUT_ERROR,
        message,
        { timeoutMs },
        408
      )), timeoutMs)
    )
  ]);
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: Error | string
): asserts condition {
  if (!condition) {
    throw typeof error === 'string'
      ? new Error(error)
      : error;
  }
}
