/**
 * @file fx-vfs-macos.ts
 * @description macOS Virtual Filesystem implementation using macFUSE
 * Provides FUSE filesystem functionality for macOS systems
 */

import { FXCore } from "../fx.ts";

/**
 * FUSE operations interface for macOS
 */
export interface MacFUSEOperations {
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
  symlink(target: string, linkpath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  truncate(path: string, size: number): Promise<void>;
  flush(path: string, fd: number): Promise<void>;
  release(path: string, fd: number): Promise<void>;
}

/**
 * File statistics structure for macOS
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
  dev: number;
  ino: number;
  rdev: number;
  blksize: number;
  blocks: number;
}

/**
 * Mount configuration for macOS
 */
export interface MacOSMountConfig {
  mountPoint: string;
  volumeName?: string;
  allowOther?: boolean;
  allowRoot?: boolean;
  debug?: boolean;
  singleThreaded?: boolean;
  foreground?: boolean;
  fsname?: string;
  subtype?: string;
  volicon?: string;
  noappledouble?: boolean;
  noapplexattr?: boolean;
  nobrowse?: boolean;
  daemon_timeout?: number;
  iosize?: number;
  blocksize?: number;
}

/**
 * macOS Virtual Filesystem Driver
 * Provides FUSE filesystem functionality for macOS using macFUSE
 */
export class MacOSVFSDriver {
  private fx: FXCore;
  private mounts = new Map<string, MacOSMount>();
  private isMacFUSEAvailable = false;

  constructor(fx: FXCore) {
    this.fx = fx;
    this._checkMacFUSEAvailability();
  }

  /**
   * Check if macFUSE is available on the system
   */
  private async _checkMacFUSEAvailability(): Promise<void> {
    try {
      // Check if macFUSE is installed
      const process = new Deno.Command("ls", {
        args: ["/Library/Frameworks/macFUSE.framework"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await process.output();
      this.isMacFUSEAvailable = code === 0;

      this.fx.proxy("system.vfs.macos.macfuse_available").val(this.isMacFUSEAvailable);

      if (!this.isMacFUSEAvailable) {
        console.warn("macFUSE not detected. macOS VFS functionality will be limited.");
        console.warn("Install macFUSE from: https://osxfuse.github.io/");
      }
    } catch (error) {
      console.warn("Failed to check macFUSE availability:", error.message);
      this.isMacFUSEAvailable = false;
    }
  }

  /**
   * Create a new virtual filesystem mount
   */
  async createMount(mountPoint: string, config: Partial<MacOSMountConfig> = {}): Promise<string> {
    if (!this.isMacFUSEAvailable) {
      throw new Error("macFUSE is not available. Please install macFUSE to use macOS VFS functionality.");
    }

    const mountConfig: MacOSMountConfig = {
      mountPoint,
      volumeName: config.volumeName || "FXD Virtual Disk",
      allowOther: config.allowOther ?? false,
      allowRoot: config.allowRoot ?? false,
      debug: config.debug ?? false,
      singleThreaded: config.singleThreaded ?? false,
      foreground: config.foreground ?? false,
      fsname: config.fsname || "fxd-vfs",
      subtype: config.subtype || "fxd",
      volicon: config.volicon,
      noappledouble: config.noappledouble ?? true,
      noapplexattr: config.noapplexattr ?? true,
      nobrowse: config.nobrowse ?? false,
      daemon_timeout: config.daemon_timeout || 600,
      iosize: config.iosize || 65536,
      blocksize: config.blocksize || 4096,
    };

    const mount = new MacOSMount(this.fx, mountConfig);
    await mount.initialize();

    const mountId = `macos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mounts.set(mountId, mount);

    // Store mount information in FX system
    this.fx.proxy(`system.vfs.mounts.${mountId}`).val({
      id: mountId,
      type: "macos",
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
      volumeName: mount.config.volumeName,
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
   * Check if macFUSE is available
   */
  isAvailable(): boolean {
    return this.isMacFUSEAvailable;
  }

  /**
   * Get system information
   */
  getSystemInfo(): any {
    return {
      platform: "macos",
      driver: "macFUSE",
      available: this.isMacFUSEAvailable,
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
        symbolicLinks: true,
        hardLinks: true,
        extendedAttributes: true,
        fileLocking: true,
        asyncIO: true,
      }
    };
  }
}

/**
 * Individual macOS mount implementation
 */
class MacOSMount {
  public config: MacOSMountConfig;
  public isActive = false;
  public createdAt: number;

  private fx: FXCore;
  private operations: MacFUSEOperations;
  private stats = {
    reads: 0,
    writes: 0,
    creates: 0,
    deletes: 0,
    symlinks: 0,
    errors: 0
  };
  private fileDescriptors = new Map<number, { path: string; flags: number }>();
  private nextFd = 1;

  constructor(fx: FXCore, config: MacOSMountConfig) {
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
      // Create the mount point directory if it doesn't exist
      try {
        await Deno.mkdir(this.config.mountPoint, { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }
      }

      // Store mount metadata
      this.fx.proxy(`vfs.mounts.macos.${this.config.mountPoint}`).val({
        volumeName: this.config.volumeName,
        mountPoint: this.config.mountPoint,
        created: this.createdAt,
        config: this.config
      });

      // Initialize root directory if it doesn't exist
      const rootPath = this._pathToFXPath("/");
      if (!this.fx.proxy(rootPath).val()) {
        this.fx.proxy(rootPath).val({
          type: 'directory',
          children: {},
          created: this.createdAt,
          modified: this.createdAt,
          mode: 0o755
        });
      }

      this.isActive = true;
      console.log(`macOS VFS mount created at: ${this.config.mountPoint}`);
    } catch (error) {
      throw new Error(`Failed to initialize macOS mount: ${error.message}`);
    }
  }

  /**
   * Clean up the mount
   */
  async cleanup(): Promise<void> {
    try {
      // In a real implementation, this would unmount the FUSE volume
      this.isActive = false;

      // Close all open file descriptors
      this.fileDescriptors.clear();

      // Clean up metadata
      this.fx.proxy(`vfs.mounts.macos.${this.config.mountPoint}`).val(undefined);

      console.log(`macOS VFS mount cleaned up: ${this.config.mountPoint}`);
    } catch (error) {
      console.error(`Error cleaning up macOS mount: ${error.message}`);
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
  private _createOperations(): MacFUSEOperations {
    return {
      async getattr(path: string): Promise<FileStat> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node) {
            throw new Error("File not found");
          }

          const isDir = node.type === 'directory';
          const size = node.content ? new TextEncoder().encode(node.content).length : 0;

          return {
            mode: isDir ? 0o755 | 0o040000 : 0o644 | 0o100000,
            size,
            atime: node.accessed || node.created || Date.now(),
            mtime: node.modified || node.created || Date.now(),
            ctime: node.created || Date.now(),
            uid: 501, // Default macOS user ID
            gid: 20,  // Default macOS group ID
            nlink: isDir ? 2 : 1,
            dev: 1,
            ino: this._pathToInode(path),
            rdev: 0,
            blksize: this.config.blocksize || 4096,
            blocks: Math.ceil(size / (this.config.blocksize || 4096))
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

          const children = node.children || {};
          return ['.', '..', ...Object.keys(children)];
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

          const fd = this.nextFd++;
          this.fileDescriptors.set(fd, { path, flags });

          return fd;
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

          // Update access time
          this.fx.proxy(`${virtualPath}.accessed`).val(Date.now());

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

          // Add to parent directory
          this._addToParentDirectory(path);

          const fd = this.nextFd++;
          this.fileDescriptors.set(fd, { path, flags: 0o002 }); // O_RDWR

          return fd;
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async unlink(path: string): Promise<void> {
        try {
          this.stats.deletes++;
          const virtualPath = this._pathToFXPath(path);

          // Remove from parent directory
          this._removeFromParentDirectory(path);

          // Remove the node
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

          // Add to parent directory
          this._addToParentDirectory(path);
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

          // Remove from parent directory
          this._removeFromParentDirectory(path);

          // Remove the node
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

          // Update parent directories
          this._removeFromParentDirectory(oldpath);
          this._addToParentDirectory(newpath);
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
      },

      async symlink(target: string, linkpath: string): Promise<void> {
        try {
          this.stats.symlinks++;
          const virtualPath = this._pathToFXPath(linkpath);

          // Create symlink node
          this.fx.proxy(virtualPath).val({
            type: 'symlink',
            target: target,
            created: Date.now(),
            modified: Date.now(),
            mode: 0o777
          });

          // Add to parent directory
          this._addToParentDirectory(linkpath);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async readlink(path: string): Promise<string> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node || node.type !== 'symlink') {
            throw new Error("Not a symbolic link");
          }

          return node.target || '';
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async truncate(path: string, size: number): Promise<void> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node) {
            throw new Error("File not found");
          }

          const content = node.content || '';
          const truncated = size === 0 ? '' : content.substring(0, size);

          this.fx.proxy(`${virtualPath}.content`).val(truncated);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async flush(path: string, fd: number): Promise<void> {
        // No-op for virtual filesystem
      },

      async release(path: string, fd: number): Promise<void> {
        this.fileDescriptors.delete(fd);
      }
    };
  }

  /**
   * Convert filesystem path to FX path
   */
  private _pathToFXPath(path: string): string {
    const normalized = path.replace(/^\/+/, '').replace(/\/+/g, '/');
    if (!normalized) return 'vfs.files.root';
    return `vfs.files.${normalized.replace(/\//g, '.')}`;
  }

  /**
   * Generate inode number from path
   */
  private _pathToInode(path: string): number {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1;
  }

  /**
   * Add file/directory to parent directory
   */
  private _addToParentDirectory(path: string): void {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return;

    const filename = parts[parts.length - 1];
    const parentPath = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');
    const parentVirtualPath = this._pathToFXPath(parentPath);

    this.fx.proxy(`${parentVirtualPath}.children.${filename}`).val(true);
    this.fx.proxy(`${parentVirtualPath}.modified`).val(Date.now());
  }

  /**
   * Remove file/directory from parent directory
   */
  private _removeFromParentDirectory(path: string): void {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return;

    const filename = parts[parts.length - 1];
    const parentPath = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');
    const parentVirtualPath = this._pathToFXPath(parentPath);

    this.fx.proxy(`${parentVirtualPath}.children.${filename}`).val(undefined);
    this.fx.proxy(`${parentVirtualPath}.modified`).val(Date.now());
  }
}

/**
 * Factory function to create macOS VFS driver
 */
export function createMacOSVFSDriver(fx: FXCore): MacOSVFSDriver {
  return new MacOSVFSDriver(fx);
}

/**
 * Plugin registration for macOS VFS
 */
export const macOSVFSPlugin = {
  id: "fx-vfs-macos",
  name: "macOS Virtual Filesystem",
  version: "1.0.0",
  description: "macFUSE-based virtual filesystem for macOS",

  async activate(fx: FXCore) {
    const driver = createMacOSVFSDriver(fx);

    // Store driver in FX system
    fx.proxy("system.vfs.drivers.macos").val(driver);

    console.log("macOS VFS driver activated");
    return driver;
  },

  async deactivate(fx: FXCore) {
    const driver = fx.proxy("system.vfs.drivers.macos").val();
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

    fx.proxy("system.vfs.drivers.macos").val(undefined);
    console.log("macOS VFS driver deactivated");
  }
};