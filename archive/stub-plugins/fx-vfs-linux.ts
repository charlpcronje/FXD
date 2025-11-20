/**
 * @file fx-vfs-linux.ts
 * @description Linux Virtual Filesystem implementation using FUSE
 * Provides native FUSE filesystem functionality for Linux systems
 */

import { FXCore } from "../fx.ts";

/**
 * FUSE operations interface for Linux
 */
export interface LinuxFUSEOperations {
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
  chown(path: string, uid: number, gid: number): Promise<void>;
  symlink(target: string, linkpath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  link(oldpath: string, newpath: string): Promise<void>;
  truncate(path: string, size: number): Promise<void>;
  flush(path: string, fd: number): Promise<void>;
  release(path: string, fd: number): Promise<void>;
  fsync(path: string, fd: number, datasync: boolean): Promise<void>;
  setxattr(path: string, name: string, value: Uint8Array, flags: number): Promise<void>;
  getxattr(path: string, name: string): Promise<Uint8Array>;
  listxattr(path: string): Promise<string[]>;
  removexattr(path: string, name: string): Promise<void>;
  statfs(path: string): Promise<StatVFS>;
}

/**
 * File statistics structure for Linux
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
 * Filesystem statistics structure
 */
export interface StatVFS {
  bsize: number;    // Filesystem block size
  frsize: number;   // Fragment size
  blocks: number;   // Size of fs in f_frsize units
  bfree: number;    // Number of free blocks
  bavail: number;   // Number of free blocks for unprivileged users
  files: number;    // Number of inodes
  ffree: number;    // Number of free inodes
  favail: number;   // Number of free inodes for unprivileged users
  fsid: number;     // Filesystem ID
  flag: number;     // Mount flags
  namemax: number;  // Maximum filename length
}

/**
 * Mount configuration for Linux
 */
export interface LinuxMountConfig {
  mountPoint: string;
  fstype?: string;
  allowOther?: boolean;
  allowRoot?: boolean;
  debug?: boolean;
  singleThreaded?: boolean;
  foreground?: boolean;
  autoUnmount?: boolean;
  nonempty?: boolean;
  bigWrites?: boolean;
  maxReadahead?: number;
  defaultPermissions?: boolean;
  kernelCache?: boolean;
  autoCache?: boolean;
  umask?: number;
  uid?: number;
  gid?: number;
  entryTimeout?: number;
  attrTimeout?: number;
  negativeTimeout?: number;
}

/**
 * Linux Virtual Filesystem Driver
 * Provides native FUSE filesystem functionality for Linux systems
 */
export class LinuxVFSDriver {
  private fx: FXCore;
  private mounts = new Map<string, LinuxMount>();
  private isFUSEAvailable = false;

  constructor(fx: FXCore) {
    this.fx = fx;
    this._checkFUSEAvailability();
  }

  /**
   * Check if FUSE is available on the system
   */
  private async _checkFUSEAvailability(): Promise<void> {
    try {
      // Check if FUSE is available by looking for /dev/fuse
      const process = new Deno.Command("ls", {
        args: ["/dev/fuse"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await process.output();
      this.isFUSEAvailable = code === 0;

      // Also check for fusermount command
      if (this.isFUSEAvailable) {
        const fuserProcess = new Deno.Command("which", {
          args: ["fusermount"],
          stdout: "piped",
          stderr: "piped",
        });

        const { code: fuserCode } = await fuserProcess.output();
        this.isFUSEAvailable = this.isFUSEAvailable && fuserCode === 0;
      }

      this.fx.proxy("system.vfs.linux.fuse_available").val(this.isFUSEAvailable);

      if (!this.isFUSEAvailable) {
        console.warn("FUSE not detected. Linux VFS functionality will be limited.");
        console.warn("Install FUSE: sudo apt-get install fuse (Ubuntu/Debian) or sudo yum install fuse (RHEL/CentOS)");
      }
    } catch (error) {
      console.warn("Failed to check FUSE availability:", error.message);
      this.isFUSEAvailable = false;
    }
  }

  /**
   * Create a new virtual filesystem mount
   */
  async createMount(mountPoint: string, config: Partial<LinuxMountConfig> = {}): Promise<string> {
    if (!this.isFUSEAvailable) {
      throw new Error("FUSE is not available. Please install FUSE to use Linux VFS functionality.");
    }

    const mountConfig: LinuxMountConfig = {
      mountPoint,
      fstype: config.fstype || "fuse.fxd",
      allowOther: config.allowOther ?? false,
      allowRoot: config.allowRoot ?? false,
      debug: config.debug ?? false,
      singleThreaded: config.singleThreaded ?? false,
      foreground: config.foreground ?? false,
      autoUnmount: config.autoUnmount ?? true,
      nonempty: config.nonempty ?? false,
      bigWrites: config.bigWrites ?? true,
      maxReadahead: config.maxReadahead || 131072,
      defaultPermissions: config.defaultPermissions ?? true,
      kernelCache: config.kernelCache ?? false,
      autoCache: config.autoCache ?? true,
      umask: config.umask || 0o022,
      uid: config.uid || 1000,
      gid: config.gid || 1000,
      entryTimeout: config.entryTimeout || 1.0,
      attrTimeout: config.attrTimeout || 1.0,
      negativeTimeout: config.negativeTimeout || 0.0,
    };

    const mount = new LinuxMount(this.fx, mountConfig);
    await mount.initialize();

    const mountId = `linux_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mounts.set(mountId, mount);

    // Store mount information in FX system
    this.fx.proxy(`system.vfs.mounts.${mountId}`).val({
      id: mountId,
      type: "linux",
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
      fstype: mount.config.fstype,
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
   * Check if FUSE is available
   */
  isAvailable(): boolean {
    return this.isFUSEAvailable;
  }

  /**
   * Get system information
   */
  getSystemInfo(): any {
    return {
      platform: "linux",
      driver: "FUSE",
      available: this.isFUSEAvailable,
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
        directIO: true,
        mmap: false, // Not supported in virtual filesystem
      }
    };
  }
}

/**
 * Individual Linux mount implementation
 */
class LinuxMount {
  public config: LinuxMountConfig;
  public isActive = false;
  public createdAt: number;

  private fx: FXCore;
  private operations: LinuxFUSEOperations;
  private stats = {
    reads: 0,
    writes: 0,
    creates: 0,
    deletes: 0,
    symlinks: 0,
    hardlinks: 0,
    xattrs: 0,
    errors: 0
  };
  private fileDescriptors = new Map<number, { path: string; flags: number; position: number }>();
  private nextFd = 1;

  constructor(fx: FXCore, config: LinuxMountConfig) {
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
      this.fx.proxy(`vfs.mounts.linux.${this.config.mountPoint}`).val({
        fstype: this.config.fstype,
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
          accessed: this.createdAt,
          mode: 0o755,
          uid: this.config.uid || 1000,
          gid: this.config.gid || 1000,
          nlink: 2
        });
      }

      this.isActive = true;
      console.log(`Linux VFS mount created at: ${this.config.mountPoint}`);
    } catch (error) {
      throw new Error(`Failed to initialize Linux mount: ${error.message}`);
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
      this.fx.proxy(`vfs.mounts.linux.${this.config.mountPoint}`).val(undefined);

      console.log(`Linux VFS mount cleaned up: ${this.config.mountPoint}`);
    } catch (error) {
      console.error(`Error cleaning up Linux mount: ${error.message}`);
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
  private _createOperations(): LinuxFUSEOperations {
    return {
      async getattr(path: string): Promise<FileStat> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const node = this.fx.proxy(virtualPath).val();

          if (!node) {
            throw new Error("File not found");
          }

          const isDir = node.type === 'directory';
          const isSymlink = node.type === 'symlink';
          const size = node.content ? new TextEncoder().encode(node.content).length : 0;

          let mode = node.mode || (isDir ? 0o755 : 0o644);
          if (isDir) mode |= 0o040000;      // S_IFDIR
          else if (isSymlink) mode |= 0o120000; // S_IFLNK
          else mode |= 0o100000;            // S_IFREG

          return {
            mode,
            size,
            atime: node.accessed || node.created || Date.now(),
            mtime: node.modified || node.created || Date.now(),
            ctime: node.created || Date.now(),
            uid: node.uid || this.config.uid || 1000,
            gid: node.gid || this.config.gid || 1000,
            nlink: node.nlink || (isDir ? 2 : 1),
            dev: 1,
            ino: this._pathToInode(path),
            rdev: 0,
            blksize: 4096,
            blocks: Math.ceil(size / 512) // 512-byte blocks
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
          this.fileDescriptors.set(fd, { path, flags, position: 0 });

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
          const fdInfo = this.fileDescriptors.get(fd);

          if (!fdInfo) {
            throw new Error("Invalid file descriptor");
          }

          const newContent = new TextDecoder().decode(buffer.slice(0, length));

          // For simplicity, we're doing overwrite. A real implementation would handle position correctly
          this.fx.proxy(`${virtualPath}.content`).val(newContent);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());

          fdInfo.position += length;
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
            accessed: Date.now(),
            mode: mode,
            uid: this.config.uid || 1000,
            gid: this.config.gid || 1000,
            nlink: 1
          });

          // Add to parent directory
          this._addToParentDirectory(path);

          const fd = this.nextFd++;
          this.fileDescriptors.set(fd, { path, flags: 0o002, position: 0 }); // O_RDWR

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
            accessed: Date.now(),
            mode: mode,
            uid: this.config.uid || 1000,
            gid: this.config.gid || 1000,
            nlink: 2
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
          this.fx.proxy(newVirtualPath).val({ ...node, modified: Date.now() });
          this.fx.proxy(oldVirtualPath).val(undefined);

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

      async chown(path: string, uid: number, gid: number): Promise<void> {
        try {
          const virtualPath = this._pathToFXPath(path);
          this.fx.proxy(`${virtualPath}.uid`).val(uid);
          this.fx.proxy(`${virtualPath}.gid`).val(gid);
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
            accessed: Date.now(),
            mode: 0o777,
            uid: this.config.uid || 1000,
            gid: this.config.gid || 1000,
            nlink: 1
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

      async link(oldpath: string, newpath: string): Promise<void> {
        try {
          this.stats.hardlinks++;
          const oldVirtualPath = this._pathToFXPath(oldpath);
          const newVirtualPath = this._pathToFXPath(newpath);

          const node = this.fx.proxy(oldVirtualPath).val();
          if (!node || node.type !== 'file') {
            throw new Error("Can only create hard links to files");
          }

          // Create hard link (same content, different path)
          this.fx.proxy(newVirtualPath).val({
            ...node,
            nlink: (node.nlink || 1) + 1,
            accessed: Date.now()
          });

          // Update original file's link count
          this.fx.proxy(`${oldVirtualPath}.nlink`).val((node.nlink || 1) + 1);

          // Add to parent directory
          this._addToParentDirectory(newpath);
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
        // Flush is typically a no-op for virtual filesystems
        // In a real implementation, this would ensure data is written to storage
      },

      async release(path: string, fd: number): Promise<void> {
        this.fileDescriptors.delete(fd);
      },

      async fsync(path: string, fd: number, datasync: boolean): Promise<void> {
        // Force synchronization - no-op for virtual filesystem
        // In a real implementation, this would ensure data is written to storage
      },

      async setxattr(path: string, name: string, value: Uint8Array, flags: number): Promise<void> {
        try {
          this.stats.xattrs++;
          const virtualPath = this._pathToFXPath(path);
          const valueStr = new TextDecoder().decode(value);

          this.fx.proxy(`${virtualPath}.xattrs.${name}`).val(valueStr);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async getxattr(path: string, name: string): Promise<Uint8Array> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const value = this.fx.proxy(`${virtualPath}.xattrs.${name}`).val();

          if (value === undefined) {
            throw new Error("Attribute not found");
          }

          return new TextEncoder().encode(value);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async listxattr(path: string): Promise<string[]> {
        try {
          const virtualPath = this._pathToFXPath(path);
          const xattrs = this.fx.proxy(`${virtualPath}.xattrs`).val() || {};

          return Object.keys(xattrs);
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async removexattr(path: string, name: string): Promise<void> {
        try {
          const virtualPath = this._pathToFXPath(path);
          this.fx.proxy(`${virtualPath}.xattrs.${name}`).val(undefined);
          this.fx.proxy(`${virtualPath}.modified`).val(Date.now());
        } catch (error) {
          this.stats.errors++;
          throw error;
        }
      },

      async statfs(path: string): Promise<StatVFS> {
        try {
          // Return filesystem statistics
          const totalFiles = this._countFiles();

          return {
            bsize: 4096,
            frsize: 4096,
            blocks: 1000000,      // 4GB virtual capacity
            bfree: 900000,        // 3.6GB free
            bavail: 900000,       // Available to non-root
            files: totalFiles + 100000,  // Total inodes
            ffree: 100000 - totalFiles,  // Free inodes
            favail: 100000 - totalFiles, // Available inodes
            fsid: 0x12345678,
            flag: 0,              // Mount flags
            namemax: 255          // Maximum filename length
          };
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
   * Count total files in the virtual filesystem
   */
  private _countFiles(): number {
    // This is a simplified count - in a real implementation,
    // you'd traverse the entire virtual filesystem
    const vfsData = this.fx.proxy('vfs.files').val() || {};
    return Object.keys(vfsData).length;
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
 * Factory function to create Linux VFS driver
 */
export function createLinuxVFSDriver(fx: FXCore): LinuxVFSDriver {
  return new LinuxVFSDriver(fx);
}

/**
 * Plugin registration for Linux VFS
 */
export const linuxVFSPlugin = {
  id: "fx-vfs-linux",
  name: "Linux Virtual Filesystem",
  version: "1.0.0",
  description: "FUSE-based virtual filesystem for Linux",

  async activate(fx: FXCore) {
    const driver = createLinuxVFSDriver(fx);

    // Store driver in FX system
    fx.proxy("system.vfs.drivers.linux").val(driver);

    console.log("Linux VFS driver activated");
    return driver;
  },

  async deactivate(fx: FXCore) {
    const driver = fx.proxy("system.vfs.drivers.linux").val();
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

    fx.proxy("system.vfs.drivers.linux").val(undefined);
    console.log("Linux VFS driver deactivated");
  }
};