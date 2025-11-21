/**
 * @file api-types.ts
 * @description Complete type definitions for FXD Backend API
 *
 * Provides comprehensive type safety for both IPC and REST API endpoints.
 * All types are shared between Electron and Web implementations.
 */

// ============================================================================
// DISK TYPES
// ============================================================================

/**
 * Disk information (list view)
 */
export interface DiskInfo {
  /** Unique disk identifier */
  id: string;

  /** Display name */
  name: string;

  /** File system path to .fxd or .fxwal file */
  path: string;

  /** Storage format */
  format: 'sqlite' | 'wal';

  /** Total size in bytes */
  size: number;

  /** Number of nodes in the disk */
  nodeCount: number;

  /** Number of files/snippets */
  fileCount: number;

  /** Is currently mounted? */
  mounted: boolean;

  /** Mount point (e.g., "R:\" or "/mnt/fxd") */
  mountPoint?: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** Creation timestamp */
  created: Date;

  /** Sync state */
  syncState: 'synced' | 'pending' | 'error';

  /** Auto-sync enabled? */
  autoSync: boolean;

  /** Auto-import enabled? */
  autoImport: boolean;
}

/**
 * Detailed disk statistics
 */
export interface DiskStats {
  /** Total nodes */
  nodes: number;

  /** Number of code snippets */
  snippets: number;

  /** Number of composite views */
  views: number;

  /** Number of signal records */
  signals: number;

  /** Total size on disk (bytes) */
  totalSize: number;

  /** Memory usage (bytes) */
  memoryUsage: number;

  /** Disk usage (bytes) */
  diskUsage: number;

  /** Compression ratio (0-1) */
  compression: number;

  /** Last sync timestamp */
  lastSync: Date;

  /** Performance metrics */
  performance: {
    avgReadMs: number;
    avgWriteMs: number;
    signalsPerSec: number;
  };
}

/**
 * Create disk request
 */
export interface CreateDiskRequest {
  /** Disk name */
  name: string;

  /** Optional path (defaults to user's documents) */
  path?: string;

  /** Storage format (defaults to 'wal') */
  format?: 'sqlite' | 'wal';

  /** Auto-import directory? */
  autoImport?: boolean;

  /** Directory to import */
  importPath?: string;

  /** Extract symbols from code? */
  extractSymbols?: boolean;

  /** Create default views? */
  createViews?: boolean;

  /** Enable auto-sync? */
  autoSync?: boolean;

  /** Sync interval (ms) */
  syncIntervalMs?: number;
}

/**
 * Create disk response
 */
export interface CreateDiskResponse {
  /** New disk ID */
  id: string;

  /** Creation status */
  status: 'created' | 'error';

  /** Disk stats */
  stats: DiskStats;

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Mount disk request
 */
export interface MountDiskRequest {
  /** Disk ID to mount */
  diskId: string;

  /** Mount point (e.g., "R:\") - optional, auto-assigned if not provided */
  mountPoint?: string;

  /** Enable auto-sync? */
  autoSync?: boolean;

  /** Sync interval (ms) */
  syncIntervalMs?: number;

  /** Read-only mode? */
  readOnly?: boolean;
}

/**
 * Mount disk response
 */
export interface MountDiskResponse {
  /** Mounted successfully? */
  success: boolean;

  /** Actual mount point */
  mountPoint: string;

  /** Stats after mounting */
  stats: DiskStats;

  /** Error message if failed */
  error?: string;
}

/**
 * Unmount disk request
 */
export interface UnmountDiskRequest {
  /** Disk ID to unmount */
  diskId: string;

  /** Save before unmounting? */
  save?: boolean;

  /** Force unmount even if unsaved changes? */
  force?: boolean;
}

/**
 * Unmount disk response
 */
export interface UnmountDiskResponse {
  /** Unmounted successfully? */
  success: boolean;

  /** Stats before unmounting */
  stats?: DiskStats;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Node information (list view)
 */
export interface NodeInfo {
  /** Unique node ID */
  id: string;

  /** Full path (e.g., "app.user.name") */
  path: string;

  /** Node type */
  type: string;

  /** Node value (raw) */
  value: any;

  /** Size in bytes */
  size: number;

  /** Version number */
  version: number;

  /** Last modified timestamp */
  modified: Date;

  /** Creation timestamp */
  created: Date;

  /** Connection summary */
  connections: {
    /** Parent node IDs */
    parents: string[];

    /** Child node IDs */
    children: string[];

    /** Entangled node IDs (atomics) */
    entangled: string[];
  };

  /** Has children? */
  hasChildren: boolean;

  /** Number of children */
  childCount: number;
}

/**
 * Detailed node information
 */
export interface NodeDetails extends NodeInfo {
  /** Full node metadata */
  metadata?: Record<string, any>;

  /** Prototype information */
  proto?: string;

  /** Effects applied to this node */
  effects?: string[];

  /** Signal history (last N signals) */
  signals?: SignalRecord[];

  /** Full connection graph */
  connectionGraph?: {
    /** Immediate parents */
    parents: NodeInfo[];

    /** Immediate children */
    children: NodeInfo[];

    /** All entangled nodes */
    entangled: NodeInfo[];

    /** Dependency tree */
    dependencies: string[];
  };

  /** Performance metrics for this node */
  metrics?: {
    reads: number;
    writes: number;
    avgReadMs: number;
    avgWriteMs: number;
  };
}

/**
 * Create node request
 */
export interface CreateNodeRequest {
  /** Parent node path (empty string for root) */
  parentPath: string;

  /** Node key/name */
  key: string;

  /** Node type */
  type?: string;

  /** Initial value */
  value?: any;

  /** Initial metadata */
  metadata?: Record<string, any>;

  /** Prototype to apply */
  proto?: string;
}

/**
 * Create node response
 */
export interface CreateNodeResponse {
  /** Created successfully? */
  success: boolean;

  /** New node info */
  node: NodeInfo;

  /** Error message if failed */
  error?: string;
}

/**
 * Update node request
 */
export interface UpdateNodeRequest {
  /** Node path */
  path: string;

  /** New value (optional) */
  value?: any;

  /** Metadata updates (merged) */
  metadata?: Record<string, any>;

  /** New prototype (optional) */
  proto?: string;
}

/**
 * Update node response
 */
export interface UpdateNodeResponse {
  /** Updated successfully? */
  success: boolean;

  /** Updated node info */
  node: NodeInfo;

  /** Previous version number */
  previousVersion: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Delete node request
 */
export interface DeleteNodeRequest {
  /** Node path to delete */
  path: string;

  /** Delete recursively (children)? */
  recursive?: boolean;

  /** Confirmation token (required for destructive operations) */
  confirm?: string;
}

/**
 * Delete node response
 */
export interface DeleteNodeResponse {
  /** Deleted successfully? */
  success: boolean;

  /** Number of nodes deleted */
  count: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Node query filter
 */
export interface NodeQueryFilter {
  /** Type filter */
  type?: string;

  /** Value filter (exact match or regex) */
  value?: any;

  /** Metadata filters */
  metadata?: Record<string, any>;

  /** Has prototype? */
  hasProto?: string;

  /** Has effects? */
  hasEffects?: string[];

  /** Modified after timestamp */
  modifiedAfter?: Date;

  /** Modified before timestamp */
  modifiedBefore?: Date;

  /** Size range */
  sizeRange?: { min?: number; max?: number };
}

/**
 * Node list request
 */
export interface ListNodesRequest {
  /** Disk ID */
  diskId: string;

  /** Parent path (empty for root) */
  parentPath?: string;

  /** Include descendants? */
  recursive?: boolean;

  /** Filter criteria */
  filter?: NodeQueryFilter;

  /** Sort by */
  sortBy?: 'path' | 'type' | 'modified' | 'size' | 'version';

  /** Sort direction */
  sortDir?: 'asc' | 'desc';

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Node list response
 */
export interface ListNodesResponse {
  /** Nodes matching criteria */
  nodes: NodeInfo[];

  /** Total count (before pagination) */
  total: number;

  /** Has more results? */
  hasMore: boolean;

  /** Next offset for pagination */
  nextOffset?: number;
}

// ============================================================================
// FILE TYPES
// ============================================================================

/**
 * File information
 */
export interface FileInfo {
  /** File path relative to mount point */
  path: string;

  /** File name */
  name: string;

  /** File type */
  type: 'file' | 'directory';

  /** File size in bytes */
  size: number;

  /** Last modified timestamp */
  modified: Date;

  /** Creation timestamp */
  created: Date;

  /** Language/extension */
  language?: string;

  /** Linked node path */
  nodePath?: string;

  /** Is read-only? */
  readonly: boolean;

  /** MIME type */
  mimeType?: string;
}

/**
 * List files request
 */
export interface ListFilesRequest {
  /** Disk ID */
  diskId: string;

  /** Directory path (relative to mount) */
  path?: string;

  /** Include subdirectories? */
  recursive?: boolean;

  /** File pattern (glob) */
  pattern?: string;
}

/**
 * List files response
 */
export interface ListFilesResponse {
  /** Files in directory */
  files: FileInfo[];

  /** Total count */
  total: number;
}

/**
 * Read file request
 */
export interface ReadFileRequest {
  /** Disk ID */
  diskId: string;

  /** File path */
  path: string;

  /** Encoding (defaults to 'utf-8') */
  encoding?: string;
}

/**
 * Read file response
 */
export interface ReadFileResponse {
  /** File content */
  content: string;

  /** File metadata */
  info: FileInfo;
}

/**
 * Write file request
 */
export interface WriteFileRequest {
  /** Disk ID */
  diskId: string;

  /** File path */
  path: string;

  /** File content */
  content: string;

  /** Encoding (defaults to 'utf-8') */
  encoding?: string;

  /** Create parent directories? */
  createDirs?: boolean;
}

/**
 * Write file response
 */
export interface WriteFileResponse {
  /** Written successfully? */
  success: boolean;

  /** Updated file info */
  info: FileInfo;

  /** Bytes written */
  bytesWritten: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Delete file request
 */
export interface DeleteFileRequest {
  /** Disk ID */
  diskId: string;

  /** File path */
  path: string;

  /** Delete recursively (for directories)? */
  recursive?: boolean;
}

/**
 * Delete file response
 */
export interface DeleteFileResponse {
  /** Deleted successfully? */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Import directory request
 */
export interface ImportDirectoryRequest {
  /** Disk ID */
  diskId: string;

  /** Directory path to import */
  path: string;

  /** Import recursively? */
  recursive?: boolean;

  /** Overwrite existing? */
  overwrite?: boolean;

  /** File pattern (glob) */
  pattern?: string;

  /** Extract symbols? */
  extractSymbols?: boolean;
}

/**
 * Import directory response
 */
export interface ImportDirectoryResponse {
  /** Imported successfully? */
  success: boolean;

  /** Number of files imported */
  imported: number;

  /** Number of files skipped */
  skipped: number;

  /** Number of errors */
  errors: number;

  /** Error messages */
  errorMessages?: string[];
}

// ============================================================================
// BINDING TYPES (Atomics)
// ============================================================================

/**
 * Binding configuration
 */
export interface BindingConfig {
  /** Source node path */
  sourcePath: string;

  /** Target node path */
  targetPath: string;

  /** Binding type */
  type: 'one-way' | 'two-way' | 'transform';

  /** Transform function (for 'transform' type) */
  transform?: string;

  /** Binding options */
  options?: {
    /** Debounce (ms) */
    debounce?: number;

    /** Throttle (ms) */
    throttle?: number;

    /** Batch updates? */
    batch?: boolean;

    /** Conflict resolution */
    onConflict?: 'source-wins' | 'target-wins' | 'merge';
  };
}

/**
 * Binding information
 */
export interface BindingInfo {
  /** Unique binding ID */
  id: string;

  /** Binding configuration */
  config: BindingConfig;

  /** Created timestamp */
  created: Date;

  /** Last sync timestamp */
  lastSync: Date;

  /** Is active? */
  active: boolean;

  /** Statistics */
  stats: {
    /** Total syncs */
    syncs: number;

    /** Total conflicts */
    conflicts: number;

    /** Last error */
    lastError?: string;
  };
}

/**
 * Create binding request
 */
export interface CreateBindingRequest {
  /** Disk ID */
  diskId: string;

  /** Binding configuration */
  config: BindingConfig;
}

/**
 * Create binding response
 */
export interface CreateBindingResponse {
  /** Created successfully? */
  success: boolean;

  /** New binding ID */
  id: string;

  /** Binding info */
  binding: BindingInfo;

  /** Error message if failed */
  error?: string;
}

/**
 * List bindings request
 */
export interface ListBindingsRequest {
  /** Disk ID */
  diskId: string;

  /** Filter by source path */
  sourcePath?: string;

  /** Filter by target path */
  targetPath?: string;

  /** Filter by active status */
  active?: boolean;
}

/**
 * List bindings response
 */
export interface ListBindingsResponse {
  /** Bindings */
  bindings: BindingInfo[];

  /** Total count */
  total: number;
}

/**
 * Update binding request
 */
export interface UpdateBindingRequest {
  /** Disk ID */
  diskId: string;

  /** Binding ID */
  bindingId: string;

  /** Updated config (merged) */
  config?: Partial<BindingConfig>;

  /** Activate/deactivate */
  active?: boolean;
}

/**
 * Update binding response
 */
export interface UpdateBindingResponse {
  /** Updated successfully? */
  success: boolean;

  /** Updated binding info */
  binding: BindingInfo;

  /** Error message if failed */
  error?: string;
}

/**
 * Delete binding request
 */
export interface DeleteBindingRequest {
  /** Disk ID */
  diskId: string;

  /** Binding ID */
  bindingId: string;
}

/**
 * Delete binding response
 */
export interface DeleteBindingResponse {
  /** Deleted successfully? */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// SIGNAL TYPES
// ============================================================================

/**
 * Signal record (from fx-signals.ts)
 */
export interface SignalRecord {
  /** Sequence number */
  seq: number;

  /** Timestamp (nanoseconds) */
  timestamp: bigint;

  /** Signal kind */
  kind: 'value' | 'children' | 'metadata' | 'custom';

  /** Base version */
  baseVersion: number;

  /** New version */
  newVersion: number;

  /** Source node ID */
  sourceNodeId: string;

  /** Delta (what changed) */
  delta: SignalDelta;
}

/**
 * Signal delta
 */
export type SignalDelta =
  | { kind: 'value'; oldValue: any; newValue: any }
  | { kind: 'children'; op: 'add' | 'remove' | 'move'; key: string; childId?: string }
  | { kind: 'metadata'; key: string; oldValue: any; newValue: any }
  | { kind: 'custom'; event: string; payload: any };

/**
 * Subscribe to signals request
 */
export interface SubscribeSignalsRequest {
  /** Disk ID */
  diskId: string;

  /** Filter by kind */
  kind?: 'value' | 'children' | 'metadata' | 'custom';

  /** Filter by node ID */
  nodeId?: string;

  /** Start from cursor */
  cursor?: number;

  /** Tail mode (only new signals)? */
  tail?: boolean;
}

/**
 * Signal history request
 */
export interface SignalHistoryRequest {
  /** Disk ID */
  diskId: string;

  /** Start cursor */
  cursor?: number;

  /** Limit results */
  limit?: number;

  /** Filter by kind */
  kind?: 'value' | 'children' | 'metadata' | 'custom';

  /** Filter by node ID */
  nodeId?: string;
}

/**
 * Signal history response
 */
export interface SignalHistoryResponse {
  /** Signal records */
  signals: SignalRecord[];

  /** Next cursor */
  nextCursor: number;

  /** Has more? */
  hasMore: boolean;

  /** Total signals */
  total: number;
}

/**
 * Signal statistics request
 */
export interface SignalStatsRequest {
  /** Disk ID */
  diskId: string;
}

/**
 * Signal statistics response
 */
export interface SignalStatsResponse {
  /** Total signals */
  totalSignals: number;

  /** Total subscribers */
  totalSubscribers: number;

  /** Average append time (ms) */
  avgAppendTime: number;

  /** Max append time (ms) */
  maxAppendTime: number;

  /** Signals per second */
  signalsPerSec: number;

  /** By kind breakdown */
  byKind: Record<string, number>;
}

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * View information
 */
export interface ViewInfo {
  /** View ID */
  id: string;

  /** View name */
  name: string;

  /** View type */
  type: string;

  /** Creation timestamp */
  created: Date;

  /** Last rendered timestamp */
  lastRendered: Date;

  /** Cache status */
  cached: boolean;

  /** Cache size (bytes) */
  cacheSize?: number;
}

/**
 * List views request
 */
export interface ListViewsRequest {
  /** Disk ID */
  diskId: string;

  /** Filter by type */
  type?: string;
}

/**
 * List views response
 */
export interface ListViewsResponse {
  /** Views */
  views: ViewInfo[];

  /** Total count */
  total: number;
}

/**
 * Create view request
 */
export interface CreateViewRequest {
  /** Disk ID */
  diskId: string;

  /** View name */
  name: string;

  /** View type */
  type: string;

  /** View configuration */
  config: Record<string, any>;
}

/**
 * Create view response
 */
export interface CreateViewResponse {
  /** Created successfully? */
  success: boolean;

  /** New view ID */
  id: string;

  /** View info */
  view: ViewInfo;

  /** Error message if failed */
  error?: string;
}

/**
 * Render view request
 */
export interface RenderViewRequest {
  /** Disk ID */
  diskId: string;

  /** View ID */
  viewId: string;

  /** Use cache? */
  useCache?: boolean;
}

/**
 * Render view response
 */
export interface RenderViewResponse {
  /** Rendered content */
  content: any;

  /** Was cached? */
  fromCache: boolean;

  /** Render time (ms) */
  renderTime: number;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

/**
 * System health check response
 */
export interface SystemHealthResponse {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'error';

  /** Uptime (ms) */
  uptime: number;

  /** Memory usage */
  memory: {
    used: number;
    total: number;
    percent: number;
  };

  /** Disk usage */
  disk: {
    used: number;
    total: number;
    percent: number;
  };

  /** Active disks */
  activeDisks: number;

  /** Active connections */
  activeConnections: number;

  /** Service status */
  services: {
    disk: boolean;
    node: boolean;
    file: boolean;
    binding: boolean;
    signal: boolean;
  };

  /** Recent errors */
  recentErrors: string[];
}

/**
 * System information response
 */
export interface SystemInfoResponse {
  /** FXD version */
  version: string;

  /** Platform */
  platform: string;

  /** Architecture */
  arch: string;

  /** Runtime */
  runtime: 'electron' | 'web' | 'deno';

  /** Available drivers */
  drivers: string[];

  /** Features */
  features: {
    ramdisk: boolean;
    vfs: boolean;
    signals: boolean;
    atomics: boolean;
  };

  /** Configuration */
  config: Record<string, any>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * API error response
 */
export interface ErrorResponse {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Additional details */
  details?: any;

  /** Stack trace (dev mode only) */
  stack?: string;

  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/**
 * WebSocket message (client → server)
 */
export type WSClientMessage =
  | { type: 'subscribe'; diskId: string; kind?: string; nodeId?: string }
  | { type: 'unsubscribe'; diskId: string }
  | { type: 'ping' };

/**
 * WebSocket message (server → client)
 */
export type WSServerMessage =
  | { type: 'signal'; signal: SignalRecord }
  | { type: 'subscribed'; diskId: string }
  | { type: 'unsubscribed'; diskId: string }
  | { type: 'error'; error: ErrorResponse }
  | { type: 'pong' };
