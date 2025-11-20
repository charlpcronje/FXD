/**
 * @file fx-vfs-windows.ts
 * @description Windows Virtual Filesystem implementation using WinFsp
 * Provides FUSE-like functionality for Windows systems
 */

import { FXCore } from "../fx.ts";

/**
 * Windows FUSE operations interface
 */
export interface WinFSPOperations {
  getattr(path: string): Promise<FileStat>;
  readdir(path: string): Promise<string[]>;
  open(path: string, flags: number): Promise<number>;
  read(path: string, fd: number, buffer: Uint8Array, length: number, position: number): Promise<number>;
  write(path: string, fd: number, buffer: Uint8Array, length: number, position: number): Promise<number>;
  create(path: string, mode: number): Promise<number>;
  unlink(path: string): Promise<void>;
  mkdir(path: string, mode: number): Promise<void>;
  rmdir(path: string): Promise<void>;
  rename(oldpath: string, newpath: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
}

/**
 * File statistics structure
 */
export interface FileStat {
  mode: number;
  size: number;
  atime: number;
  mtime: number;
  ctime: number;
  uid: number;
  gid: number;
  nlink: number;
}

/**
 * Mount configuration for Windows
 */
export interface WindowsMountConfig {
  mountPoint: string;
  volumeLabel?: string;
  sectorSize?: number;
  sectorsPerAllocationUnit?: number;
  maxComponentLength?: number;
  volumeSerialNumber?: number;
  fileInfoTimeout?: number;
  caseSensitiveSearch?: boolean;
  casePreservedNames?: boolean;
  unicodeOnDisk?: boolean;
  persistentAcls?: boolean;
  rejectIrpPriorToTransact0?: boolean;
  flushAndPurgeOnCleanup?: boolean;
}

/**
 * Windows Virtual Filesystem Driver
 * Provides FUSE-like virtual filesystem for Windows using WinFsp
 */
export class WindowsVFSDriver {
  private fx: FXCore;
  private mounts = new Map<string, WindowsMount>();
  private isWinFspAvailable = false;

  constructor(fx: FXCore) {
    this.fx = fx;
    this._checkWinFspAvailability();
  }

  /**
   * Check if WinFsp is available on the system
   */
  private async _checkWinFspAvailability(): Promise<void> {
    try {
      // Check if WinFsp is installed by looking for the driver
      const process = new Deno.Command("reg", {
        args: ["query", "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WinFsp", "/v", "ImagePath"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await process.output();
      this.isWinFspAvailable = code === 0;

      this.fx.proxy("system.vfs.windows.winfsp_available").val(this.isWinFspAvailable);

      if (!this.isWinFspAvailable) {
        console.warn("WinFsp not detected. Windows VFS functionality will be limited.");
        console.warn("Install WinFsp from: https://winfsp.dev/");
      }
    } catch (error) {
      console.warn("Failed to check WinFsp availability:", error.message);
      this.isWinFspAvailable = false;
    }
  }

  /**
   * Create a new virtual filesystem mount
   */
  async createMount(mountPoint: string, config: Partial<WindowsMountConfig> = {}): Promise<string> {
    if (!this.isWinFspAvailable) {
      throw new Error("WinFsp is not available. Please install WinFsp to use Windows VFS functionality.");
    }

    const mountConfig: WindowsMountConfig = {
      mountPoint,
      volumeLabel: config.volumeLabel || "FXD Virtual Disk",
      sectorSize: config.sectorSize || 512,
      sectorsPerAllocationUnit: config.sectorsPerAllocationUnit || 1,
      maxComponentLength: config.maxComponentLength || 255,
      volumeSerialNumber: config.volumeSerialNumber || Math.floor(Math.random() * 0xFFFFFFFF),
      fileInfoTimeout: config.fileInfoTimeout || 1000,
      caseSensitiveSearch: config.caseSensitiveSearch ?? false,
      casePreservedNames: config.casePreservedNames ?? true,
      unicodeOnDisk: config.unicodeOnDisk ?? true,
      persistentAcls: config.persistentAcls ?? false,
      rejectIrpPriorToTransact0: config.rejectIrpPriorToTransact0 ?? false,
      flushAndPurgeOnCleanup: config.flushAndPurgeOnCleanup ?? false,
    };

    const mount = new WindowsMount(this.fx, mountConfig);
    await mount.initialize();

    const mountId = `windows_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mounts.set(mountId, mount);

    // Store mount information in FX system
    this.fx.proxy(`system.vfs.mounts.${mountId}`).val({
      id: mountId,
      type: "windows",
      mountPoint,
      config: mountConfig,
      created: Date.now(),
      status: "active"
    });

    return mountId;
  }

  /**
   * Destroy a virtual filesystem mount
   */
  async destroyMount(mountId: string): Promise<void> {
    const mount = this.mounts.get(mountId);
    if (!mount) {
      throw new Error(`Mount not found: ${mountId}`);
    }

    await mount.cleanup();
    this.mounts.delete(mountId);

    // Remove from FX system
    this.fx.proxy(`system.vfs.mounts.${mountId}`).val(undefined);
  }

  /**
   * Get mount status
   */
  getMountStatus(mountId: string): any {
    const mount = this.mounts.get(mountId);
    if (!mount) {
      return null;
    }

    return {
      id: mountId,
      mountPoint: mount.config.mountPoint,
      status: mount.isActive ? "active" : "inactive",
      volumeLabel: mount.config.volumeLabel,
      created: mount.createdAt,
      operations: mount.getOperationStats()
    };
  }

  /**
   * List all active mounts
   */
  listMounts(): any[] {
    return Array.from(this.mounts.entries()).map(([id, mount]) =>
      this.getMountStatus(id)
    );
  }

  /**
   * Check if WinFsp is available
   */
  isAvailable(): boolean {
    return this.isWinFspAvailable;
  }

  /**
   * Get system information
   */
  getSystemInfo(): any {
    return {
      platform: "windows",
      driver: "WinFsp",
      available: this.isWinFspAvailable,
      activeMounts: this.mounts.size,
      capabilities: {
        createFiles: true,
        createDirectories: true,
        deleteFiles: true,
        deleteDirectories: true,
        renameFiles: true,
        readFiles: true,
        writeFiles: true,
        listDirectories: true,
        fileAttributes: true,
        symbolicLinks: false, // WinFsp doesn't fully support symlinks
        hardLinks: false,
      }
    };
  }
}

/**
 * Individual Windows mount implementation
 */
class WindowsMount {
  public config: WindowsMountConfig;
  public isActive = false;
  public createdAt: number;

  private fx: FXCore;
  private operations: WinFSPOperations;
  private stats = {
    reads: 0,
    writes: 0,
    creates: 0,
    deletes: 0,
    errors: 0
  };

  constructor(fx: FXCore, config: WindowsMountConfig) {
    this.fx = fx;
    this.config = config;
    this.createdAt = Date.now();
    this.operations = this._createOperations();
  }

  /**
   * Initialize the mount
   */
  async initialize(): Promise<void> {
    try {
      // In a real implementation, this would interface with WinFsp
      // For now, we'll simulate the mount process

      // Create the mount point directory if it doesn't exist
      try {
        await Deno.mkdir(this.config.mountPoint, { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }
      }

      // Store mount metadata
      this.fx.proxy(`vfs.mounts.windows.${this.config.mountPoint}`).val({
        volumeLabel: this.config.volumeLabel,
        mountPoint: this.config.mountPoint,
        created: this.createdAt,
        config: this.config
      });

      this.isActive = true;
      console.log(`Windows VFS mount created at: ${this.config.mountPoint}`);
    } catch (error) {
      throw new Error(`Failed to initialize Windows mount: ${error.message}`);
    }
  }

  /**
   * Clean up the mount
   */
  async cleanup(): Promise<void> {
    try {
      // In a real implementation, this would unmount the WinFsp volume
      this.isActive = false;

      // Clean up metadata
      this.fx.proxy(`vfs.mounts.windows.${this.config.mountPoint}`).val(undefined);

      console.log(`Windows VFS mount cleaned up: ${this.config.mountPoint}`);
    } catch (error) {
      console.error(`Error cleaning up Windows mount: ${error.message}`);
    }
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): any {
    return { ...this.stats };
  }

  /**
   * Create FUSE operations implementation
   */
  private _createOperations(): WinFSPOperations {
    return {
      async getattr(path: string): Promise<FileStat> {
        try {
          // Map virtual path to FX data
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node) {
            throw new Error("File not found");
          }

          // Return file statistics
          return {
            mode: node.type === 'directory' ? 0o755 | 0o040000 : 0o644 | 0o100000,
            size: node.content ? node.content.length : 0,
            atime: node.accessed || node.created || Date.now(),
            mtime: node.modified || node.created || Date.now(),
            ctime: node.created || Date.now(),
            uid: 1000,
            gid: 1000,
            nlink: 1
          };
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async readdir(path: string): Promise<string[]> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node || node.type !== 'directory') {
            throw new Error("Not a directory");
          }

          // Return list of files in directory
          const children = this.fx.proxy(`${virtualPath}.children`).val() || {};
          return Object.keys(children);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async open(path: string, flags: number): Promise<number> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node) {
            throw new Error("File not found");
          }

          // Return a fake file descriptor
          return Math.floor(Math.random() * 1000) + 1;
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async read(path: string, fd: number, buffer: Uint8Array, length: number, position: number): Promise<number> {
        try {
          this.stats.reads++;
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node || !node.content) {
            return 0;
          }

          const content = new TextEncoder().encode(node.content);
          const start = Math.min(position, content.length);
          const end = Math.min(start + length, content.length);
          const bytesToRead = end - start;

          if (bytesToRead > 0) {
            buffer.set(content.slice(start, end));
          }

          return bytesToRead;
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async write(path: string, fd: number, buffer: Uint8Array, length: number, position: number): Promise<number> {
        try {
          this.stats.writes++;
          const virtualPath = this._pathToFXPath(path);
          const content = new TextDecoder().decode(buffer.slice(0, length));

          // Update the node content
          this.fx.proxy(`${virtualPath}.content`).val(content);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());

          return length;
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async create(path: string, mode: number): Promise<number> {
        try {
          this.stats.creates++;
          const virtualPath = this._pathToFXPath(path);

          // Create new file node
          this.fx.proxy(virtualPath).val({
            type: 'file',
            content: '',
            created: Date.now(),
            modified: Date.now(),
            mode: mode
          });

          return Math.floor(Math.random() * 1000) + 1;
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async unlink(path: string): Promise<void> {
        try {
          this.stats.deletes++;
          const virtualPath = this._pathToFXPath(path);
          this.fx.proxy(virtualPath).val(undefined);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async mkdir(path: string, mode: number): Promise<void> {
        try {
          this.stats.creates++;
          const virtualPath = this._pathToFXPath(path);

          // Create new directory node
          this.fx.proxy(virtualPath).val({
            type: 'directory',
            children: {},
            created: Date.now(),
            modified: Date.now(),
            mode: mode
          });
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async rmdir(path: string): Promise<void> {
        try {
          this.stats.deletes++;
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node || node.type !== 'directory') {
            throw new Error("Not a directory");
          }

          const children = node.children || {};
          if (Object.keys(children).length > 0) {
            throw new Error("Directory not empty");
          }

          this.fx.proxy(virtualPath).val(undefined);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async rename(oldpath: string, newpath: string): Promise<void> {
        try {
          const oldVirtualPath = this._pathToFXPath(oldpath);
          const newVirtualPath = this._pathToFXPath(newpath);

          const node = this.fx.proxy(oldVirtualPath).val();
          if (!node) {
            throw new Error("File not found");
          }

          // Move the node
          this.fx.proxy(newVirtualPath).val(node);
          this.fx.proxy(oldVirtualPath).val(undefined);
          this.fx.proxy(`${newVirtualPath}.modified`).val(Date.now());
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async chmod(path: string, mode: number): Promise<void> {
        try {
          const virtualPath = this._pathToFXPath(path);
          this.fx.proxy(`${virtualPath}.mode`).val(mode);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      }
    };
  }

  /**
   * Convert filesystem path to FX path
   */
  private _pathToFXPath(path: string): string {
    // Convert Windows path separators and map to FX namespace
    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    return `vfs.files.${normalized.replace(/\//g, '.')}`;
  }
}

/**
 * Factory function to create Windows VFS driver
 */
export function createWindowsVFSDriver(fx: FXCore): WindowsVFSDriver {
  return new WindowsVFSDriver(fx);
}

/**
 * Plugin registration for Windows VFS
 */
export const windowsVFSPlugin = {
  id: "fx-vfs-windows",
  name: "Windows Virtual Filesystem",
  version: "1.0.0",
  description: "WinFsp-based virtual filesystem for Windows",

  async activate(fx: FXCore) {
    const driver = createWindowsVFSDriver(fx);

    // Store driver in FX system
    fx.proxy("system.vfs.drivers.windows").val(driver);

    console.log("Windows VFS driver activated");
    return driver;
  },

  async deactivate(fx: FXCore) {
    const driver = fx.proxy("system.vfs.drivers.windows").val();
    if (driver) {
      // Clean up all mounts
      const mounts = driver.listMounts();
      for (const mount of mounts) {
        try {
          await driver.destroyMount(mount.id);
        } catch (error) {
          console.error(`Failed to cleanup mount ${mount.id}:`, error);
        }
      }
    }

    fx.proxy("system.vfs.drivers.windows").val(undefined);
    console.log("Windows VFS driver deactivated");
  }
};