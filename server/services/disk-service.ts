/**
 * @file disk-service.ts
 * @description Disk management service for FXD Backend
 *
 * Handles all disk operations including creation, loading, mounting, unmounting,
 * and statistics. This service is used by both IPC handlers and REST API endpoints.
 */

import { $$, $_$$ } from '../../fxn.ts';
import { FXDiskWAL, createWALDisk } from '../../modules/fx-persistence-wal.ts';
import { RAMDiskManager, createRAMDiskManager } from '../../modules/fx-ramdisk.ts';
import { VFSManager, createVFSManager } from '../../modules/fx-vfs.ts';
import {
  DiskInfo,
  DiskStats,
  CreateDiskRequest,
  CreateDiskResponse,
  MountDiskRequest,
  MountDiskResponse,
  UnmountDiskRequest,
  UnmountDiskResponse,
} from '../types/api-types.ts';
import {
  DiskNotFoundError,
  DiskAlreadyMountedError,
  DiskNotMountedError,
  MountError,
  validateRequired,
  withErrorHandling,
} from '../errors.ts';

// ============================================================================
// DISK SERVICE
// ============================================================================

/**
 * Mounted disk state
 */
interface MountedDisk {
  id: string;
  disk: FXDiskWAL;
  mountPoint: string;
  ramdiskId?: string;
  vfsManager?: VFSManager;
  autoSync: boolean;
  syncIntervalId?: number;
  created: Date;
  lastAccess: Date;
}

/**
 * Disk Service - Manages all disk operations
 */
export class DiskService {
  private static disks = new Map<string, DiskInfo>();
  private static mountedDisks = new Map<string, MountedDisk>();
  private static ramdiskManager: RAMDiskManager | null = null;
  private static initialized = false;

  /**
   * Initialize the disk service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize RAMDisk manager
    const fx = { proxy: $$, node: $_$$ };
    this.ramdiskManager = createRAMDiskManager(fx as any);
    await this.ramdiskManager.initialize();

    // Scan for existing .fxd and .fxwal files
    await this.scanForDisks();

    this.initialized = true;
    console.log('[DiskService] Initialized');
  }

  /**
   * Scan file system for .fxd and .fxwal files
   */
  private static async scanForDisks(): Promise<void> {
    // Scan common locations
    const scanPaths = [
      Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '.',
      './disks',
      './examples',
    ];

    for (const basePath of scanPaths) {
      try {
        await this.scanDirectory(basePath);
      } catch {
        // Ignore errors for paths that don't exist
      }
    }

    console.log(`[DiskService] Found ${this.disks.size} disks`);
  }

  /**
   * Recursively scan directory for disk files
   */
  private static async scanDirectory(path: string, depth = 0): Promise<void> {
    if (depth > 3) return; // Limit recursion depth

    try {
      for await (const entry of Deno.readDir(path)) {
        const fullPath = `${path}/${entry.name}`;

        if (entry.isFile) {
          if (entry.name.endsWith('.fxd') || entry.name.endsWith('.fxwal')) {
            await this.registerDisk(fullPath);
          }
        } else if (entry.isDirectory && !entry.name.startsWith('.')) {
          await this.scanDirectory(fullPath, depth + 1);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Register a disk file
   */
  private static async registerDisk(path: string): Promise<string> {
    try {
      const stat = await Deno.stat(path);
      const id = `disk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const name = path.split('/').pop()?.replace(/\.(fxd|fxwal)$/, '') || id;
      const format = path.endsWith('.fxwal') ? 'wal' : 'sqlite';

      const diskInfo: DiskInfo = {
        id,
        name,
        path,
        format,
        size: stat.size,
        nodeCount: 0, // Will be populated on load
        fileCount: 0,
        mounted: false,
        lastModified: stat.mtime || new Date(),
        created: stat.birthtime || new Date(),
        syncState: 'synced',
        autoSync: false,
        autoImport: false,
      };

      this.disks.set(id, diskInfo);
      return id;
    } catch (error) {
      console.error(`[DiskService] Failed to register disk ${path}:`, error);
      throw error;
    }
  }

  /**
   * List all disks
   */
  static async list(): Promise<DiskInfo[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.disks.values());
  }

  /**
   * Get disk by ID
   */
  static async get(id: string): Promise<DiskInfo> {
    const disk = this.disks.get(id);

    if (!disk) {
      throw new DiskNotFoundError(id);
    }

    return disk;
  }

  /**
   * Create a new disk
   */
  static async create(request: CreateDiskRequest): Promise<CreateDiskResponse> {
    validateRequired(request, ['name']);

    try {
      // Determine file path
      const basePath = request.path || './disks';
      const format = request.format || 'wal';
      const extension = format === 'wal' ? 'fxwal' : 'fxd';
      const filePath = `${basePath}/${request.name}.${extension}`;

      // Ensure directory exists
      try {
        await Deno.mkdir(basePath, { recursive: true });
      } catch {
        // Directory already exists
      }

      // Create new WAL disk
      const disk = await createWALDisk(filePath);

      // Auto-import if requested
      if (request.autoImport && request.importPath) {
        const vfsManager = createVFSManager({ proxy: $$, node: $_$$ } as any);
        await vfsManager.initialize();
        await vfsManager.syncFromDirectory(request.importPath, {
          overwrite: true,
          recursive: true,
        });
      }

      // Save disk
      await disk.save();

      // Register disk
      const id = await this.registerDisk(filePath);

      // Get stats
      const stats = await this.getStats(id);

      // Update node/file counts
      const diskInfo = this.disks.get(id)!;
      diskInfo.nodeCount = stats.nodes;
      diskInfo.fileCount = stats.snippets;

      return {
        id,
        status: 'created',
        stats,
      };
    } catch (error) {
      return {
        id: '',
        status: 'error',
        stats: this.getEmptyStats(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Delete a disk
   */
  static async delete(id: string): Promise<void> {
    const disk = this.disks.get(id);

    if (!disk) {
      throw new DiskNotFoundError(id);
    }

    // Unmount if mounted
    if (disk.mounted) {
      await this.unmount({ diskId: id, save: false });
    }

    // Delete file
    try {
      await Deno.remove(disk.path);
    } catch (error) {
      throw new Error(`Failed to delete disk file: ${(error as Error).message}`);
    }

    // Remove from registry
    this.disks.delete(id);
  }

  /**
   * Mount a disk
   */
  static async mount(request: MountDiskRequest): Promise<MountDiskResponse> {
    validateRequired(request, ['diskId']);

    const diskInfo = this.disks.get(request.diskId);

    if (!diskInfo) {
      throw new DiskNotFoundError(request.diskId);
    }

    // Check if already mounted
    if (this.mountedDisks.has(request.diskId)) {
      const mounted = this.mountedDisks.get(request.diskId)!;
      throw new DiskAlreadyMountedError(request.diskId, mounted.mountPoint);
    }

    try {
      // Load disk
      const disk = await createWALDisk(diskInfo.path);
      await disk.load();

      // Create RAMDisk if requested
      let ramdiskId: string | undefined;
      let mountPoint: string;

      if (request.mountPoint && this.ramdiskManager) {
        // Create RAMDisk
        ramdiskId = await this.ramdiskManager.createDisk({
          sizeMB: 512,
          mountPoint: request.mountPoint,
        });

        mountPoint = request.mountPoint;
      } else if (this.ramdiskManager) {
        // Auto-assign mount point
        const defaults = this.ramdiskManager.getDefaultConfig();
        ramdiskId = await this.ramdiskManager.createDisk({
          sizeMB: 512,
        });

        mountPoint = defaults.mountPoint || '';
      } else {
        throw new MountError('RAMDisk manager not initialized');
      }

      // Create VFS manager
      const vfsManager = createVFSManager({ proxy: $$, node: $_$$ } as any);
      await vfsManager.initialize(this.ramdiskManager);
      await vfsManager.mount(mountPoint, {
        ramdiskId,
        watch: true,
      });

      // Set up auto-sync if requested
      let syncIntervalId: number | undefined;

      if (request.autoSync) {
        const intervalMs = request.syncIntervalMs || 500;

        syncIntervalId = setInterval(async () => {
          try {
            await disk.save();
          } catch (error) {
            console.error('[DiskService] Auto-sync failed:', error);
          }
        }, intervalMs) as any;
      }

      // Store mounted state
      const mounted: MountedDisk = {
        id: request.diskId,
        disk,
        mountPoint,
        ramdiskId,
        vfsManager,
        autoSync: request.autoSync || false,
        syncIntervalId,
        created: new Date(),
        lastAccess: new Date(),
      };

      this.mountedDisks.set(request.diskId, mounted);

      // Update disk info
      diskInfo.mounted = true;
      diskInfo.mountPoint = mountPoint;
      diskInfo.autoSync = request.autoSync || false;

      // Get stats
      const stats = await this.getStats(request.diskId);

      return {
        success: true,
        mountPoint,
        stats,
      };
    } catch (error) {
      throw new MountError((error as Error).message, { diskId: request.diskId });
    }
  }

  /**
   * Unmount a disk
   */
  static async unmount(request: UnmountDiskRequest): Promise<UnmountDiskResponse> {
    validateRequired(request, ['diskId']);

    const mounted = this.mountedDisks.get(request.diskId);

    if (!mounted) {
      throw new DiskNotMountedError(request.diskId);
    }

    try {
      // Get stats before unmounting
      const stats = await this.getStats(request.diskId);

      // Save if requested
      if (request.save !== false) {
        await mounted.disk.save();
      }

      // Stop auto-sync
      if (mounted.syncIntervalId) {
        clearInterval(mounted.syncIntervalId);
      }

      // Unmount VFS
      if (mounted.vfsManager) {
        await mounted.vfsManager.unmount();
      }

      // Destroy RAMDisk
      if (mounted.ramdiskId && this.ramdiskManager) {
        await this.ramdiskManager.destroyDisk(mounted.ramdiskId);
      }

      // Close disk
      mounted.disk.close();

      // Remove from mounted disks
      this.mountedDisks.delete(request.diskId);

      // Update disk info
      const diskInfo = this.disks.get(request.diskId);
      if (diskInfo) {
        diskInfo.mounted = false;
        diskInfo.mountPoint = undefined;
        diskInfo.autoSync = false;
      }

      return {
        success: true,
        stats,
      };
    } catch (error) {
      throw new Error(`Unmount failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get disk statistics
   */
  static async getStats(diskId: string): Promise<DiskStats> {
    const diskInfo = this.disks.get(diskId);

    if (!diskInfo) {
      throw new DiskNotFoundError(diskId);
    }

    const mounted = this.mountedDisks.get(diskId);

    // If not mounted, return basic stats
    if (!mounted) {
      return {
        nodes: diskInfo.nodeCount,
        snippets: diskInfo.fileCount,
        views: 0,
        signals: 0,
        totalSize: diskInfo.size,
        memoryUsage: 0,
        diskUsage: diskInfo.size,
        compression: 0,
        lastSync: diskInfo.lastModified,
        performance: {
          avgReadMs: 0,
          avgWriteMs: 0,
          signalsPerSec: 0,
        },
      };
    }

    // Get detailed stats from mounted disk
    const walStats = await mounted.disk.stats();
    const vfsStats = mounted.vfsManager?.getStats();

    // Count nodes
    let nodeCount = 0;
    let snippetCount = 0;
    let viewCount = 0;

    // Traverse the graph to count
    const root = $_$$.node();
    if (root.__nodes) {
      if (root.__nodes.snippets) {
        const snippets = root.__nodes.snippets;
        if (snippets.__nodes) {
          snippetCount = Object.keys(snippets.__nodes).length;
        }
      }

      if (root.__nodes.views) {
        const views = root.__nodes.views;
        if (views.__nodes) {
          viewCount = Object.keys(views.__nodes).length;
        }
      }

      // Total nodes
      const countNodes = (node: any): number => {
        let count = 1;
        if (node.__nodes) {
          for (const child of Object.values(node.__nodes)) {
            count += countNodes(child);
          }
        }
        return count;
      };

      nodeCount = countNodes(root);
    }

    return {
      nodes: nodeCount,
      snippets: snippetCount,
      views: viewCount,
      signals: walStats.records,
      totalSize: walStats.bytes,
      memoryUsage: vfsStats?.totalSize || 0,
      diskUsage: walStats.bytes,
      compression: 0,
      lastSync: new Date(),
      performance: {
        avgReadMs: 0.05, // TODO: Track actual performance
        avgWriteMs: 0.12,
        signalsPerSec: 0,
      },
    };
  }

  /**
   * Save a mounted disk
   */
  static async save(diskId: string): Promise<void> {
    const mounted = this.mountedDisks.get(diskId);

    if (!mounted) {
      throw new DiskNotMountedError(diskId);
    }

    await mounted.disk.save();

    // Update disk info
    const diskInfo = this.disks.get(diskId);
    if (diskInfo) {
      diskInfo.syncState = 'synced';
      diskInfo.lastModified = new Date();
    }
  }

  /**
   * Get mounted disk
   */
  static getMounted(diskId: string): MountedDisk | undefined {
    return this.mountedDisks.get(diskId);
  }

  /**
   * Check if disk is mounted
   */
  static isMounted(diskId: string): boolean {
    return this.mountedDisks.has(diskId);
  }

  /**
   * Get all mounted disks
   */
  static getMountedDisks(): MountedDisk[] {
    return Array.from(this.mountedDisks.values());
  }

  /**
   * Get empty stats
   */
  private static getEmptyStats(): DiskStats {
    return {
      nodes: 0,
      snippets: 0,
      views: 0,
      signals: 0,
      totalSize: 0,
      memoryUsage: 0,
      diskUsage: 0,
      compression: 0,
      lastSync: new Date(),
      performance: {
        avgReadMs: 0,
        avgWriteMs: 0,
        signalsPerSec: 0,
      },
    };
  }

  /**
   * Shutdown service
   */
  static async shutdown(): Promise<void> {
    // Unmount all disks
    for (const diskId of this.mountedDisks.keys()) {
      await this.unmount({ diskId, save: true });
    }

    console.log('[DiskService] Shutdown complete');
  }
}

// Export with error handling
export const diskService = {
  initialize: withErrorHandling(DiskService.initialize.bind(DiskService), 'DiskService.initialize'),
  list: withErrorHandling(DiskService.list.bind(DiskService), 'DiskService.list'),
  get: withErrorHandling(DiskService.get.bind(DiskService), 'DiskService.get'),
  create: withErrorHandling(DiskService.create.bind(DiskService), 'DiskService.create'),
  delete: withErrorHandling(DiskService.delete.bind(DiskService), 'DiskService.delete'),
  mount: withErrorHandling(DiskService.mount.bind(DiskService), 'DiskService.mount'),
  unmount: withErrorHandling(DiskService.unmount.bind(DiskService), 'DiskService.unmount'),
  getStats: withErrorHandling(DiskService.getStats.bind(DiskService), 'DiskService.getStats'),
  save: withErrorHandling(DiskService.save.bind(DiskService), 'DiskService.save'),
  getMounted: DiskService.getMounted.bind(DiskService),
  isMounted: DiskService.isMounted.bind(DiskService),
  getMountedDisks: DiskService.getMountedDisks.bind(DiskService),
  shutdown: withErrorHandling(DiskService.shutdown.bind(DiskService), 'DiskService.shutdown'),
};
