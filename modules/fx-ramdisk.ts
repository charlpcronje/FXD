/**
 * @file fx-ramdisk.ts
 * @version 1.0.0
 * @description Cross-platform RAMDisk implementation for FXD
 *
 * Provides in-memory disk management with platform-specific mounting
 * capabilities. Supports Windows (ImDisk, WinFsp), macOS (diskutil),
 * and Linux (tmpfs, mount).
 *
 * Features:
 * - Create/destroy RAMDisks of configurable size
 * - Platform detection and driver selection
 * - File system synchronization
 * - Auto-import directory contents to FXD snippets
 * - Persistent configuration
 * - Health monitoring and statistics
 */

import { FXCore, FXNodeProxy } from "../fxn.ts";

// Platform detection
const IS_WINDOWS = Deno.build.os === "windows";
const IS_MACOS = Deno.build.os === "darwin";
const IS_LINUX = Deno.build.os === "linux";

/**
 * RAMDisk configuration options
 */
export interface RAMDiskConfig {
  /** RAMDisk identifier */
  id: string;

  /** Size in megabytes */
  sizeMB: number;

  /** Mount point (R:\ on Windows, /mnt/fxd on Unix) */
  mountPoint: string;

  /** Volume label */
  volumeName: string;

  /** File system type (NTFS, FAT32, ext4, tmpfs) */
  fileSystem: string;

  /** Platform type (auto-detected if not specified) */
  platform?: "windows" | "macos" | "linux";

  /** Driver to use (auto-selected if not specified) */
  driver?: "imdisk" | "winfsp" | "diskutil" | "tmpfs" | "fuse";

  /** Allow other users to access (Unix only) */
  allowOther?: boolean;

  /** Enable debug logging */
  debug?: boolean;

  /** Auto-import on mount */
  autoImport?: boolean;

  /** Auto-sync interval in milliseconds (0 = disabled) */
  autoSyncMs?: number;
}

/**
 * RAMDisk status information
 */
export interface RAMDiskStatus {
  id: string;
  mounted: boolean;
  mountPoint: string;
  sizeMB: number;
  usedMB: number;
  freeMB: number;
  fileCount: number;
  platform: string;
  driver: string;
  created: number;
  lastSync: number;
  health: "healthy" | "warning" | "error";
  errors: string[];
}

/**
 * Platform-specific driver interface
 */
export interface RAMDiskDriver {
  name: string;
  platform: string;

  /** Check if driver is available on this system */
  isAvailable(): Promise<boolean>;

  /** Create and mount RAMDisk */
  create(config: RAMDiskConfig): Promise<void>;

  /** Unmount and destroy RAMDisk */
  destroy(config: RAMDiskConfig): Promise<void>;

  /** Get RAMDisk status */
  getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>>;

  /** Refresh/remount if needed */
  refresh(config: RAMDiskConfig): Promise<void>;
}

/**
 * Windows ImDisk driver
 */
class ImDiskDriver implements RAMDiskDriver {
  name = "imdisk";
  platform = "windows";

  async isAvailable(): Promise<boolean> {
    try {
      const cmd = new Deno.Command("imdisk", {
        args: ["-h"],
        stdout: "null",
        stderr: "null",
      });
      const result = await cmd.output();
      return result.success;
    } catch {
      return false;
    }
  }

  async create(config: RAMDiskConfig): Promise<void> {
    // Extract drive letter from mount point (e.g., R:\ -> R:)
    const driveLetter = config.mountPoint.replace(/[\\\/]/g, '').replace(':', '');

    // Create RAMDisk using ImDisk
    const cmd = new Deno.Command("imdisk", {
      args: [
        "-a",                                    // Add device
        "-s", `${config.sizeMB}M`,              // Size
        "-m", `${driveLetter}:`,                // Mount point
        "-p", "/fs:ntfs /q /y",                 // Format NTFS quick
        ...(config.volumeName ? ["-v", config.volumeName] : []),
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();

    if (!result.success) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(`ImDisk create failed: ${error}`);
    }

    // Wait for drive to be ready
    await this._waitForDrive(config.mountPoint);
  }

  async destroy(config: RAMDiskConfig): Promise<void> {
    const driveLetter = config.mountPoint.replace(/[\\\/]/g, '').replace(':', '');

    const cmd = new Deno.Command("imdisk", {
      args: [
        "-d",                    // Delete device
        "-m", `${driveLetter}:`, // Mount point
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();

    if (!result.success) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(`ImDisk destroy failed: ${error}`);
    }
  }

  async getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>> {
    try {
      const driveLetter = config.mountPoint.replace(/[\\\/]/g, '').replace(':', '');

      // Check if drive exists
      const cmd = new Deno.Command("imdisk", {
        args: ["-l"],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();
      const output = new TextDecoder().decode(result.stdout);

      const mounted = output.includes(driveLetter);

      if (!mounted) {
        return { mounted: false };
      }

      // Get disk space info using wmic
      const spaceCmd = new Deno.Command("wmic", {
        args: ["logicaldisk", "where", `DeviceID='${driveLetter}:'`, "get", "Size,FreeSpace"],
        stdout: "piped",
        stderr: "piped",
      });

      const spaceResult = await spaceCmd.output();
      const spaceOutput = new TextDecoder().decode(spaceResult.stdout);

      // Parse output (format: "FreeSpace  Size\n12345  67890")
      const lines = spaceOutput.trim().split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        const values = lines[1].trim().split(/\s+/);
        const freeBytes = parseInt(values[0] || "0");
        const totalBytes = parseInt(values[1] || "0");

        const freeMB = Math.floor(freeBytes / (1024 * 1024));
        const totalMB = Math.floor(totalBytes / (1024 * 1024));
        const usedMB = totalMB - freeMB;

        return {
          mounted: true,
          sizeMB: totalMB,
          usedMB,
          freeMB,
        };
      }

      return { mounted: true };
    } catch (error) {
      return { mounted: false };
    }
  }

  async refresh(config: RAMDiskConfig): Promise<void> {
    // ImDisk doesn't require refresh
  }

  private async _waitForDrive(mountPoint: string, timeoutMs = 5000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        await Deno.stat(mountPoint);
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error(`Drive ${mountPoint} did not become ready in time`);
  }
}

/**
 * Windows WinFsp driver
 */
class WinFspDriver implements RAMDiskDriver {
  name = "winfsp";
  platform = "windows";

  async isAvailable(): Promise<boolean> {
    try {
      // Check if WinFsp is installed
      const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
      const winfspPath = `${programFiles}\\WinFsp\\bin\\fsptool.exe`;

      await Deno.stat(winfspPath);
      return true;
    } catch {
      return false;
    }
  }

  async create(config: RAMDiskConfig): Promise<void> {
    // WinFsp requires custom implementation
    // For now, throw not implemented
    throw new Error("WinFsp driver not yet implemented. Use ImDisk or native mounting.");
  }

  async destroy(config: RAMDiskConfig): Promise<void> {
    throw new Error("WinFsp driver not yet implemented");
  }

  async getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>> {
    return { mounted: false };
  }

  async refresh(config: RAMDiskConfig): Promise<void> {
    // No-op
  }
}

/**
 * macOS diskutil driver
 */
class DiskUtilDriver implements RAMDiskDriver {
  name = "diskutil";
  platform = "macos";

  async isAvailable(): Promise<boolean> {
    try {
      const cmd = new Deno.Command("diskutil", {
        args: ["list"],
        stdout: "null",
        stderr: "null",
      });
      const result = await cmd.output();
      return result.success;
    } catch {
      return false;
    }
  }

  async create(config: RAMDiskConfig): Promise<void> {
    // Calculate sectors (512 bytes per sector)
    const sectors = Math.floor((config.sizeMB * 1024 * 1024) / 512);

    // Create RAMDisk
    const createCmd = new Deno.Command("hdiutil", {
      args: [
        "attach",
        "-nomount",
        `ram://${sectors}`,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const createResult = await createCmd.output();

    if (!createResult.success) {
      const error = new TextDecoder().decode(createResult.stderr);
      throw new Error(`hdiutil create failed: ${error}`);
    }

    // Get device name from output (e.g., "/dev/disk2")
    const output = new TextDecoder().decode(createResult.stdout);
    const deviceMatch = output.match(/\/dev\/disk\d+/);

    if (!deviceMatch) {
      throw new Error("Failed to get device name from hdiutil");
    }

    const device = deviceMatch[0];

    // Format the disk
    const formatCmd = new Deno.Command("diskutil", {
      args: [
        "eraseDisk",
        "JHFS+",                           // File system
        config.volumeName || "FXD_Disk",
        device,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const formatResult = await formatCmd.output();

    if (!formatResult.success) {
      const error = new TextDecoder().decode(formatResult.stderr);
      throw new Error(`diskutil format failed: ${error}`);
    }

    // Create mount point if it doesn't exist
    try {
      await Deno.mkdir(config.mountPoint, { recursive: true });
    } catch {
      // Already exists
    }

    // Mount the disk
    const mountCmd = new Deno.Command("diskutil", {
      args: [
        "mount",
        "-mountPoint", config.mountPoint,
        device,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const mountResult = await mountCmd.output();

    if (!mountResult.success) {
      const error = new TextDecoder().decode(mountResult.stderr);
      throw new Error(`diskutil mount failed: ${error}`);
    }

    // Store device name for later unmounting
    await Deno.writeTextFile(
      `${config.mountPoint}/.fxd_device`,
      device
    );
  }

  async destroy(config: RAMDiskConfig): Promise<void> {
    // Read device name
    let device: string;

    try {
      device = await Deno.readTextFile(`${config.mountPoint}/.fxd_device`);
    } catch {
      // Try to find by mount point
      const cmd = new Deno.Command("mount", {
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();
      const output = new TextDecoder().decode(result.stdout);

      const mountLine = output.split('\n').find(line =>
        line.includes(config.mountPoint)
      );

      if (!mountLine) {
        throw new Error(`Cannot find device for ${config.mountPoint}`);
      }

      const deviceMatch = mountLine.match(/^(\/dev\/disk\d+)/);
      if (!deviceMatch) {
        throw new Error("Cannot parse device from mount output");
      }

      device = deviceMatch[1];
    }

    // Unmount
    const unmountCmd = new Deno.Command("diskutil", {
      args: ["unmount", config.mountPoint],
      stdout: "piped",
      stderr: "piped",
    });

    await unmountCmd.output();

    // Eject
    const ejectCmd = new Deno.Command("diskutil", {
      args: ["eject", device],
      stdout: "piped",
      stderr: "piped",
    });

    const ejectResult = await ejectCmd.output();

    if (!ejectResult.success) {
      const error = new TextDecoder().decode(ejectResult.stderr);
      throw new Error(`diskutil eject failed: ${error}`);
    }
  }

  async getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>> {
    try {
      const stat = await Deno.stat(config.mountPoint);

      if (!stat.isDirectory) {
        return { mounted: false };
      }

      // Get disk space using df
      const cmd = new Deno.Command("df", {
        args: ["-k", config.mountPoint],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();
      const output = new TextDecoder().decode(result.stdout);

      // Parse df output
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const values = lines[1].trim().split(/\s+/);
        const totalKB = parseInt(values[1] || "0");
        const usedKB = parseInt(values[2] || "0");
        const freeKB = parseInt(values[3] || "0");

        return {
          mounted: true,
          sizeMB: Math.floor(totalKB / 1024),
          usedMB: Math.floor(usedKB / 1024),
          freeMB: Math.floor(freeKB / 1024),
        };
      }

      return { mounted: true };
    } catch {
      return { mounted: false };
    }
  }

  async refresh(config: RAMDiskConfig): Promise<void> {
    // No refresh needed for diskutil
  }
}

/**
 * Linux tmpfs driver
 */
class TmpfsDriver implements RAMDiskDriver {
  name = "tmpfs";
  platform = "linux";

  async isAvailable(): Promise<boolean> {
    // tmpfs is always available on Linux
    return true;
  }

  async create(config: RAMDiskConfig): Promise<void> {
    // Create mount point
    try {
      await Deno.mkdir(config.mountPoint, { recursive: true });
    } catch {
      // Already exists
    }

    // Mount tmpfs
    const cmd = new Deno.Command("mount", {
      args: [
        "-t", "tmpfs",
        "-o", `size=${config.sizeMB}M`,
        "tmpfs",
        config.mountPoint,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();

    if (!result.success) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(`tmpfs mount failed: ${error}`);
    }

    // Set permissions
    if (config.allowOther) {
      await Deno.chmod(config.mountPoint, 0o777);
    }
  }

  async destroy(config: RAMDiskConfig): Promise<void> {
    const cmd = new Deno.Command("umount", {
      args: [config.mountPoint],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();

    if (!result.success) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(`tmpfs unmount failed: ${error}`);
    }

    // Remove mount point directory
    try {
      await Deno.remove(config.mountPoint, { recursive: true });
    } catch {
      // Ignore errors
    }
  }

  async getStatus(config: RAMDiskConfig): Promise<Partial<RAMDiskStatus>> {
    try {
      const stat = await Deno.stat(config.mountPoint);

      if (!stat.isDirectory) {
        return { mounted: false };
      }

      // Get disk space using df
      const cmd = new Deno.Command("df", {
        args: ["-k", config.mountPoint],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();
      const output = new TextDecoder().decode(result.stdout);

      // Parse df output
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const values = lines[1].trim().split(/\s+/);
        const totalKB = parseInt(values[1] || "0");
        const usedKB = parseInt(values[2] || "0");
        const freeKB = parseInt(values[3] || "0");

        return {
          mounted: true,
          sizeMB: Math.floor(totalKB / 1024),
          usedMB: Math.floor(usedKB / 1024),
          freeMB: Math.floor(freeKB / 1024),
        };
      }

      return { mounted: true };
    } catch {
      return { mounted: false };
    }
  }

  async refresh(config: RAMDiskConfig): Promise<void> {
    // No refresh needed for tmpfs
  }
}

/**
 * RAMDisk Manager
 */
export class RAMDiskManager {
  private fx: FXCore;
  private drivers: Map<string, RAMDiskDriver>;
  private disks: Map<string, RAMDiskConfig>;
  private syncIntervals: Map<string, number>;

  constructor(fx: FXCore) {
    this.fx = fx;
    this.drivers = new Map();
    this.disks = new Map();
    this.syncIntervals = new Map();

    // Register platform-specific drivers
    this._registerDrivers();
  }

  private _registerDrivers(): void {
    if (IS_WINDOWS) {
      this.drivers.set("imdisk", new ImDiskDriver());
      this.drivers.set("winfsp", new WinFspDriver());
    } else if (IS_MACOS) {
      this.drivers.set("diskutil", new DiskUtilDriver());
    } else if (IS_LINUX) {
      this.drivers.set("tmpfs", new TmpfsDriver());
    }
  }

  /**
   * Initialize RAMDisk manager
   */
  async initialize(): Promise<void> {
    // Load persisted disk configurations
    const disksNode = this.fx.proxy("system.ramdisks");
    const disksData = disksNode.val() || {};

    for (const [id, config] of Object.entries(disksData)) {
      if (config && typeof config === 'object') {
        this.disks.set(id, config as RAMDiskConfig);
      }
    }
  }

  /**
   * Get default configuration for current platform
   */
  getDefaultConfig(): Partial<RAMDiskConfig> {
    if (IS_WINDOWS) {
      return {
        sizeMB: 512,
        mountPoint: "R:\\",
        volumeName: "FXD_Disk",
        fileSystem: "NTFS",
        platform: "windows",
        driver: "imdisk",
      };
    } else if (IS_MACOS) {
      return {
        sizeMB: 512,
        mountPoint: "/Volumes/FXD",
        volumeName: "FXD_Disk",
        fileSystem: "JHFS+",
        platform: "macos",
        driver: "diskutil",
      };
    } else if (IS_LINUX) {
      return {
        sizeMB: 512,
        mountPoint: "/mnt/fxd",
        volumeName: "FXD_Disk",
        fileSystem: "tmpfs",
        platform: "linux",
        driver: "tmpfs",
      };
    }

    throw new Error("Unsupported platform");
  }

  /**
   * Create and mount a new RAMDisk
   */
  async createDisk(config: Partial<RAMDiskConfig>): Promise<string> {
    // Merge with defaults
    const defaults = this.getDefaultConfig();
    const fullConfig: RAMDiskConfig = {
      id: `disk_${Date.now()}`,
      ...defaults,
      ...config,
    } as RAMDiskConfig;

    // Validate configuration
    this._validateConfig(fullConfig);

    // Check if driver is available
    const driver = this.drivers.get(fullConfig.driver!);
    if (!driver) {
      throw new Error(`Driver not found: ${fullConfig.driver}`);
    }

    const available = await driver.isAvailable();
    if (!available) {
      throw new Error(`Driver not available: ${fullConfig.driver}`);
    }

    // Create the disk
    try {
      await driver.create(fullConfig);
    } catch (error) {
      throw new Error(`Failed to create RAMDisk: ${error.message}`);
    }

    // Store configuration
    this.disks.set(fullConfig.id, fullConfig);
    this._persistDiskConfig(fullConfig);

    // Set up auto-sync if enabled
    if (fullConfig.autoSyncMs && fullConfig.autoSyncMs > 0) {
      this._startAutoSync(fullConfig);
    }

    return fullConfig.id;
  }

  /**
   * Unmount and destroy a RAMDisk
   */
  async destroyDisk(id: string): Promise<void> {
    const config = this.disks.get(id);

    if (!config) {
      throw new Error(`RAMDisk not found: ${id}`);
    }

    // Stop auto-sync
    this._stopAutoSync(id);

    // Get driver
    const driver = this.drivers.get(config.driver!);
    if (!driver) {
      throw new Error(`Driver not found: ${config.driver}`);
    }

    // Destroy the disk
    try {
      await driver.destroy(config);
    } catch (error) {
      throw new Error(`Failed to destroy RAMDisk: ${error.message}`);
    }

    // Remove configuration
    this.disks.delete(id);
    this._removeDiskConfig(id);
  }

  /**
   * Get status of a RAMDisk
   */
  async getStatus(id: string): Promise<RAMDiskStatus> {
    const config = this.disks.get(id);

    if (!config) {
      throw new Error(`RAMDisk not found: ${id}`);
    }

    const driver = this.drivers.get(config.driver!);
    if (!driver) {
      throw new Error(`Driver not found: ${config.driver}`);
    }

    // Get basic status from driver
    const driverStatus = await driver.getStatus(config);

    // Count files
    let fileCount = 0;
    if (driverStatus.mounted) {
      try {
        fileCount = await this._countFiles(config.mountPoint);
      } catch {
        // Ignore errors
      }
    }

    // Build complete status
    const status: RAMDiskStatus = {
      id: config.id,
      mounted: driverStatus.mounted || false,
      mountPoint: config.mountPoint,
      sizeMB: driverStatus.sizeMB || config.sizeMB,
      usedMB: driverStatus.usedMB || 0,
      freeMB: driverStatus.freeMB || config.sizeMB,
      fileCount,
      platform: config.platform || Deno.build.os,
      driver: config.driver || "unknown",
      created: this._getCreatedTime(id),
      lastSync: this._getLastSyncTime(id),
      health: this._calculateHealth(driverStatus),
      errors: [],
    };

    return status;
  }

  /**
   * List all RAMDisks
   */
  listDisks(): RAMDiskConfig[] {
    return Array.from(this.disks.values());
  }

  /**
   * Get available drivers for current platform
   */
  async getAvailableDrivers(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, driver] of this.drivers) {
      if (await driver.isAvailable()) {
        available.push(name);
      }
    }

    return available;
  }

  /**
   * Sync RAMDisk contents to FXD
   */
  async syncToFXD(id: string, importOptions?: {
    overwrite?: boolean;
    pattern?: string;
  }): Promise<{ imported: number; skipped: number; errors: number }> {
    const config = this.disks.get(id);

    if (!config) {
      throw new Error(`RAMDisk not found: ${id}`);
    }

    const status = await this.getStatus(id);

    if (!status.mounted) {
      throw new Error(`RAMDisk not mounted: ${id}`);
    }

    // Import files to snippets
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
      for await (const entry of Deno.readDir(config.mountPoint)) {
        // Skip hidden files and FXD metadata
        if (entry.name.startsWith('.') || entry.name.startsWith('_fxd')) {
          continue;
        }

        // Check pattern if specified
        if (importOptions?.pattern) {
          const regex = new RegExp(importOptions.pattern);
          if (!regex.test(entry.name)) {
            skipped++;
            continue;
          }
        }

        if (entry.isFile) {
          try {
            const filePath = `${config.mountPoint}/${entry.name}`;
            const content = await Deno.readTextFile(filePath);
            const snippetId = entry.name.replace(/\.[^.]+$/, '');

            // Check if snippet exists
            const existingSnippet = this.fx.proxy(`snippets.${snippetId}`).val();

            if (existingSnippet && !importOptions?.overwrite) {
              skipped++;
              continue;
            }

            // Import as snippet
            this.fx.proxy(`snippets.${snippetId}`).val({
              id: snippetId,
              name: entry.name,
              content,
              language: this._detectLanguage(entry.name),
              created: Date.now(),
              source: 'ramdisk',
              ramdiskId: id,
            });

            imported++;
          } catch (error) {
            console.error(`Failed to import ${entry.name}:`, error);
            errors++;
          }
        }
      }

      // Update last sync time
      this._setLastSyncTime(id, Date.now());
    } catch (error) {
      throw new Error(`Sync failed: ${error.message}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Export FXD snippets to RAMDisk
   */
  async syncFromFXD(id: string, exportOptions?: {
    filter?: (snippet: any) => boolean;
  }): Promise<{ exported: number; skipped: number; errors: number }> {
    const config = this.disks.get(id);

    if (!config) {
      throw new Error(`RAMDisk not found: ${id}`);
    }

    const status = await this.getStatus(id);

    if (!status.mounted) {
      throw new Error(`RAMDisk not mounted: ${id}`);
    }

    let exported = 0;
    let skipped = 0;
    let errors = 0;

    // Get all snippets
    const snippets = this.fx.proxy("snippets").val() || {};

    for (const [id, snippet] of Object.entries(snippets)) {
      if (!snippet || typeof snippet !== 'object') {
        continue;
      }

      const s = snippet as any;

      // Apply filter if specified
      if (exportOptions?.filter && !exportOptions.filter(s)) {
        skipped++;
        continue;
      }

      try {
        const ext = this._getFileExtension(s.language || 'text');
        const filename = `${id}.${ext}`;
        const filePath = `${config.mountPoint}/${filename}`;

        await Deno.writeTextFile(filePath, s.content || '');
        exported++;
      } catch (error) {
        console.error(`Failed to export ${id}:`, error);
        errors++;
      }
    }

    return { exported, skipped, errors };
  }

  // Private helper methods

  private _validateConfig(config: RAMDiskConfig): void {
    if (!config.id) {
      throw new Error("RAMDisk ID is required");
    }

    if (!config.sizeMB || config.sizeMB <= 0) {
      throw new Error("Invalid size: must be positive");
    }

    if (!config.mountPoint) {
      throw new Error("Mount point is required");
    }

    if (!config.driver) {
      throw new Error("Driver is required");
    }
  }

  private _persistDiskConfig(config: RAMDiskConfig): void {
    this.fx.proxy(`system.ramdisks.${config.id}`).val(config);
  }

  private _removeDiskConfig(id: string): void {
    this.fx.proxy(`system.ramdisks.${id}`).val(undefined);
  }

  private _startAutoSync(config: RAMDiskConfig): void {
    if (!config.autoSyncMs || config.autoSyncMs <= 0) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await this.syncToFXD(config.id);
      } catch (error) {
        console.error(`Auto-sync failed for ${config.id}:`, error);
      }
    }, config.autoSyncMs);

    this.syncIntervals.set(config.id, intervalId);
  }

  private _stopAutoSync(id: string): void {
    const intervalId = this.syncIntervals.get(id);

    if (intervalId !== undefined) {
      clearInterval(intervalId);
      this.syncIntervals.delete(id);
    }
  }

  private async _countFiles(dir: string): Promise<number> {
    let count = 0;

    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isFile && !entry.name.startsWith('.')) {
          count++;
        }
      }
    } catch {
      // Ignore errors
    }

    return count;
  }

  private _getCreatedTime(id: string): number {
    const metadata = this.fx.proxy(`system.ramdisks.${id}.metadata`).val();
    return metadata?.created || Date.now();
  }

  private _getLastSyncTime(id: string): number {
    const metadata = this.fx.proxy(`system.ramdisks.${id}.metadata`).val();
    return metadata?.lastSync || 0;
  }

  private _setLastSyncTime(id: string, time: number): void {
    this.fx.proxy(`system.ramdisks.${id}.metadata.lastSync`).val(time);
  }

  private _calculateHealth(status: Partial<RAMDiskStatus>): "healthy" | "warning" | "error" {
    if (!status.mounted) {
      return "error";
    }

    if (status.freeMB !== undefined && status.sizeMB !== undefined) {
      const usagePercent = ((status.sizeMB - status.freeMB) / status.sizeMB) * 100;

      if (usagePercent >= 95) {
        return "warning";
      }
    }

    return "healthy";
  }

  private _detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';

    const langMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'txt': 'text',
    };

    return langMap[ext] || 'text';
  }

  private _getFileExtension(language: string): string {
    const extMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'rust': 'rs',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'css': 'css',
      'html': 'html',
      'markdown': 'md',
      'json': 'json',
      'yaml': 'yaml',
      'text': 'txt',
    };

    return extMap[language] || 'txt';
  }
}

/**
 * Create and initialize RAMDisk manager
 */
export function createRAMDiskManager(fx: FXCore): RAMDiskManager {
  const manager = new RAMDiskManager(fx);
  return manager;
}
