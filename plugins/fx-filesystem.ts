/**
 * fx-filesystem.ts - FX Filesystem Plugin for Deno
 *
 * Mirrors FX nodes to RAMDisk for cross-language/cross-app IPC
 *
 * Features:
 * - Syncs FX nodes to /tmp/fx-nodes/ (or custom RAMDisk)
 * - Each node becomes a directory
 * - value.fxval contains the node value
 * - .fxmeta contains metadata
 * - Watches filesystem for changes from other apps
 * - Enables polyglot reactive programming!
 */

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode } from '../fxn.ts';
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

export interface FilesystemPluginOptions {
  baseDir?: string;           // Default: /tmp/fx-nodes
  autoSync?: boolean;          // Auto-sync on node changes
  watchChanges?: boolean;      // Watch filesystem for external changes
  fileExtension?: string;      // Default: .fxval
  metadataFile?: string;       // Default: .fxmeta
  syncInterval?: number;       // ms between syncs (0 = immediate)
  verbose?: boolean;           // Logging
}

interface NodeMetadata {
  __id: string;
  __parent_id: string | null;
  __type: string | null;
  __proto: string[];
  __timestamp: number;
  __fx_version: string;
  __path?: string;
}

export class FXFilesystemPlugin {
  public name = "filesystem";
  public version = "2.0.0";
  public description = "Mirror FX nodes to filesystem for cross-app IPC";

  private options: Required<FilesystemPluginOptions>;
  private syncQueue = new Set<string>();
  private syncActive = false;
  private nodePathMap = new Map<string, string>(); // nodeId → filesystem path
  private pathNodeMap = new Map<string, string>(); // filesystem path → nodeId
  private watcher: Deno.FsWatcher | null = null;
  private syncTimer: number | null = null;

  constructor(opts: FilesystemPluginOptions = {}) {
    this.options = {
      baseDir: opts.baseDir || (Deno.build.os === 'windows' ? 'C:\\tmp\\fx-nodes' : '/tmp/fx-nodes'),
      autoSync: opts.autoSync ?? true,
      watchChanges: opts.watchChanges ?? true,
      fileExtension: opts.fileExtension || '.fxval',
      metadataFile: opts.metadataFile || '.fxmeta',
      syncInterval: opts.syncInterval ?? 1000,
      verbose: opts.verbose ?? false
    };
  }

  async initialize() {
    // Ensure base directory exists
    await Deno.mkdir(this.options.baseDir, { recursive: true });

    // Don't mirror existing tree - only sync new nodes as they're created
    // This avoids syncing system nodes like config, plugins, modules, etc.

    // Start watching if enabled
    if (this.options.watchChanges) {
      this.startWatching();
    }

    // Start periodic sync if enabled
    if (this.options.autoSync && this.options.syncInterval > 0) {
      this.startPeriodicSync();
    }

    this.log(`[FX-Filesystem] Initialized at ${this.options.baseDir}`);
  }

  /**
   * Mirror entire node tree to filesystem
   */
  private async mirrorNodeTree(
    node: FXNode,
    basePath: string,
    nodePath: string
  ): Promise<void> {
    const nodeDir = nodePath ? join(basePath, nodePath) : basePath;

    // Store path mappings
    this.nodePathMap.set(node.__id, nodeDir);
    this.pathNodeMap.set(nodeDir, node.__id);

    // Ensure directory exists
    await Deno.mkdir(nodeDir, { recursive: true });

    // Write metadata
    await this.writeNodeMetadata(node, nodeDir);

    // Write value if exists
    await this.writeNodeValue(node, nodeDir);

    // Recursively mirror children (skip system internals)
    if (node.__nodes) {
      for (const [key, childNode] of Object.entries(node.__nodes)) {
        // Skip system/private nodes
        if (key.startsWith('__')) continue;

        const childPath = nodePath ? `${nodePath}/${key}` : key;
        await this.mirrorNodeTree(childNode, basePath, childPath);
      }
    }
  }

  /**
   * Write node metadata to .fxmeta file
   */
  private async writeNodeMetadata(node: FXNode, nodeDir: string): Promise<void> {
    const metadata: NodeMetadata = {
      __id: node.__id,
      __parent_id: node.__parent_id,
      __type: node.__type,
      __proto: node.__proto || [],
      __timestamp: Date.now(),
      __fx_version: this.version,
      __path: this.nodePathMap.get(node.__id)
    };

    const metadataPath = join(nodeDir, this.options.metadataFile);
    await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Write node value to value.fxval file
   */
  private async writeNodeValue(node: FXNode, nodeDir: string): Promise<void> {
    try {
      if (node.__value === undefined) return;

      // Extract raw value from FX value bag
      let value = node.__value;
      if (value && typeof value === 'object' && 'raw' in value) {
        value = value.raw;
      }

      const valueFile = join(nodeDir, `value${this.options.fileExtension}`);

      let content: string;
      if (typeof value === 'string') {
        content = value;
      } else if (typeof value === 'object' && value !== null) {
        content = JSON.stringify(value, null, 2);
      } else {
        content = String(value);
      }

      await Deno.writeTextFile(valueFile, content);
      this.log(`[FX-Filesystem] Wrote value file: ${valueFile}`);

      // Also write type info
      const typeFile = join(nodeDir, `type${this.options.fileExtension}`);
      await Deno.writeTextFile(typeFile, node.__type || 'raw');
      this.log(`[FX-Filesystem] Wrote type file: ${typeFile}`);
    } catch (error) {
      console.error(`[FX-Filesystem] Failed to write node value for ${node.__id}:`, error);
      throw error;
    }
  }

  /**
   * Queue a node for sync
   */
  queueSync(nodeId: string): void {
    this.syncQueue.add(nodeId);

    if (this.options.syncInterval === 0) {
      // Immediate sync
      queueMicrotask(() => this.processSyncQueue());
    }
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncActive || this.syncQueue.size === 0) return;

    this.syncActive = true;

    try {
      const nodeIds = Array.from(this.syncQueue);
      this.syncQueue.clear();

      for (const nodeId of nodeIds) {
        await this.syncNode(nodeId);
      }
    } catch (error) {
      console.error('[FX-Filesystem] Sync queue error:', error);
    } finally {
      this.syncActive = false;
    }
  }

  /**
   * Sync a single node to filesystem
   */
  private async syncNode(nodeId: string): Promise<void> {
    try {
      // Find the node
      const node = this.findNodeById(nodeId);
      if (!node) {
        this.log(`[FX-Filesystem] Node not found: ${nodeId}`);
        return;
      }

      let nodeDir = this.nodePathMap.get(nodeId);

      if (!nodeDir) {
        // Need to determine path
        const nodePath = this.getNodePath(node);
        if (!nodePath) {
          this.log(`[FX-Filesystem] Could not determine path for ${nodeId}`);
          return;
        }
        nodeDir = join(this.options.baseDir, nodePath);
        this.nodePathMap.set(nodeId, nodeDir);
        this.pathNodeMap.set(nodeDir, nodeId);
      }

      // Ensure directory exists before writing
      await Deno.mkdir(nodeDir, { recursive: true });

      // Write metadata and value
      await this.writeNodeMetadata(node, nodeDir);
      await this.writeNodeValue(node, nodeDir);

      this.log(`[FX-Filesystem] Synced ${nodeId} to ${nodeDir}`);
    } catch (error) {
      console.error(`[FX-Filesystem] Failed to sync ${nodeId}:`, error);
    }
  }

  /**
   * Start watching filesystem for changes
   */
  private async startWatching(): Promise<void> {
    try {
      this.watcher = Deno.watchFs(this.options.baseDir, { recursive: true });

      this.log(`[FX-Filesystem] Watching ${this.options.baseDir}`);

      // Process events in background
      (async () => {
        if (!this.watcher) return;

        for await (const event of this.watcher) {
          // Filter for .fxval files (handle both modify and create events)
          const paths = event.paths.filter(p => {
            // Normalize path separators for consistent checking
            const normalized = p.replace(/\\/g, '/');
            return normalized.endsWith(this.options.fileExtension) &&
                   (event.kind === 'modify' || event.kind === 'create');
          });

          if (paths.length > 0) {
            // Debounce to avoid multiple rapid updates
            await new Promise(resolve => setTimeout(resolve, 100));
            for (const path of paths) {
              await this.syncFileToNode(path);
            }
          }
        }
      })();

    } catch (error) {
      console.error('[FX-Filesystem] Failed to start watching:', error);
    }
  }

  /**
   * Sync filesystem changes back to FX nodes
   */
  private async syncFileToNode(filePath: string): Promise<void> {
    try {
      // Use path separator that works on both Windows and Unix
      const sep = Deno.build.os === 'windows' ? '\\' : '/';
      const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
      const nodeDir = filePath.substring(0, lastSep);
      const nodeId = this.pathNodeMap.get(nodeDir);

      if (!nodeId) {
        this.log(`[FX-Filesystem] No node for path: ${nodeDir}`);
        return;
      }

      const node = this.findNodeById(nodeId);
      if (!node) return;

      // Read value from filesystem
      const content = await Deno.readTextFile(filePath);

      // Try to parse as JSON, fallback to string
      let value: any;
      try {
        value = JSON.parse(content);
      } catch {
        value = content;
      }

      // Update node (will trigger watchers!)
      $$(nodeId).val(value);

      this.log(`[FX-Filesystem] Synced file → node: ${filePath} → ${nodeId}`);

    } catch (error) {
      console.error('[FX-Filesystem] File→Node sync error:', error);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      this.processSyncQueue();
    }, this.options.syncInterval);

    this.log('[FX-Filesystem] Periodic sync started');
  }

  /**
   * Hook into FX to intercept node changes
   */
  setupWatchers(): void {
    // Helper to check if a node should be synced
    const shouldSync = (node: FXNode): boolean => {
      const nodeId = node.__id;
      // Skip system nodes
      if (nodeId.startsWith('__')) return false;

      // Check if node is under a syncable namespace by traversing up
      let current: FXNode | null = node;
      const path: string[] = [];

      while (current && current.__parent_id) {
        const parent = this.findNodeById(current.__parent_id);
        if (!parent) break;

        // Find key in parent
        if (parent.__nodes) {
          for (const [key, child] of Object.entries(parent.__nodes)) {
            if (child.__id === current.__id) {
              path.unshift(key);
              break;
            }
          }
        }

        current = parent;
      }

      if (path.length === 0) return false;

      // Only sync nodes under certain namespaces
      const rootNamespace = path[0];
      const excludedNamespaces = ['config', 'plugins', 'modules', 'atomics', 'dom', 'session', 'system', 'cache', 'code', 'views', 'fs', 'history'];
      return !excludedNamespaces.includes(rootNamespace);
    };

    // Hook into FX structure events to watch for new nodes
    fx.onStructure((event) => {
      if (event.kind === 'create' && event.node) {
        if (shouldSync(event.node)) {
          const nodeId = event.node.__id;

          // Watch this new node
          $$(nodeId).watch(() => {
            if (this.options.autoSync) {
              this.queueSync(nodeId);
            }
          });

          // Queue it for immediate sync
          if (this.options.autoSync) {
            this.queueSync(nodeId);
          }
        }
      } else if (event.kind === 'mutate' && event.node) {
        if (shouldSync(event.node)) {
          if (this.options.autoSync) {
            this.queueSync(event.node.__id);
          }
        }
      }
    });

    this.log('[FX-Filesystem] Watchers installed for structure events');
  }

  /**
   * Find node by ID
   */
  private findNodeById(nodeId: string, start: FXNode = $_$$.node()): FXNode | null {
    if (start.__id === nodeId) return start;

    if (start.__nodes) {
      for (const child of Object.values(start.__nodes)) {
        const found = this.findNodeById(nodeId, child);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Get filesystem path for a node
   */
  private getNodePath(node: FXNode): string {
    const parts: string[] = [];
    let current: FXNode | null = node;

    while (current && current.__parent_id) {
      // Find parent
      const parent = this.findNodeById(current.__parent_id);
      if (!parent) break;

      // Find key in parent
      if (parent.__nodes) {
        for (const [key, child] of Object.entries(parent.__nodes)) {
          if (child.__id === current.__id) {
            parts.unshift(this.sanitizePath(key));
            break;
          }
        }
      }

      current = parent;
    }

    return parts.join('/');
  }

  /**
   * Sanitize path component for filesystem
   */
  private sanitizePath(component: string): string {
    return component
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * Get statistics
   */
  stats() {
    return {
      baseDir: this.options.baseDir,
      autoSync: this.options.autoSync,
      watchChanges: this.options.watchChanges,
      syncQueueSize: this.syncQueue.size,
      nodePathMappings: this.nodePathMap.size
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
    }

    this.log('[FX-Filesystem] Plugin destroyed');
  }

  private log(msg: string): void {
    if (this.options.verbose) {
      console.log(msg);
    }
  }
}

/**
 * Load and initialize the filesystem plugin
 */
export async function loadFilesystemPlugin(opts?: FilesystemPluginOptions) {
  const plugin = new FXFilesystemPlugin(opts);
  await plugin.initialize();
  plugin.setupWatchers();

  // Store in FX
  $$("plugins.filesystem").set(plugin);

  // Global accessor
  (globalThis as any).$filesystem = plugin;

  console.log(`[FX-Filesystem] Plugin loaded, syncing to ${plugin.stats().baseDir}`);

  return plugin;
}

export default FXFilesystemPlugin;
