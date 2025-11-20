#!/usr/bin/env -S deno run --allow-all
/**
 * @file mount.ts
 * @description FXD mount command - Create and mount virtual filesystems
 *
 * Usage:
 *   fxd mount [path] [options]
 *   fxd mount create [options]
 *   fxd mount list
 *   fxd mount status [id]
 *   fxd mount sync [id]
 *
 * Examples:
 *   fxd mount R:\                                  # Windows: Mount to R: drive
 *   fxd mount /mnt/fxd                             # Linux: Mount to /mnt/fxd
 *   fxd mount create --size=1024 --name="MyDisk"   # Create with custom settings
 *   fxd mount list                                 # List all mounts
 *   fxd mount status disk_123                      # Show mount status
 */

import { FXCore } from "../../fxn.ts";
import { RAMDiskManager } from "../../modules/fx-ramdisk.ts";
import { VFSManager } from "../../modules/fx-vfs.ts";
import { AutoImportManager } from "../../modules/fx-auto-import.ts";

/**
 * Mount command options
 */
export interface MountOptions {
  // RAMDisk options
  size?: number;              // Size in MB
  name?: string;              // Volume name
  driver?: string;            // Driver to use (auto, imdisk, winfsp, diskutil, tmpfs)

  // VFS options
  watch?: boolean;            // Enable file watching
  autoSync?: boolean;         // Auto-sync changes
  syncInterval?: number;      // Auto-sync interval in seconds

  // Import options
  autoImport?: boolean;       // Auto-import on mount
  recursive?: boolean;        // Recursive import
  extractSymbols?: boolean;   // Extract functions/classes

  // General options
  allowOther?: boolean;       // Allow other users (Unix)
  debug?: boolean;            // Enable debug logging
  force?: boolean;            // Force mount (unmount existing)
}

/**
 * Mount command handler
 */
export class MountCommand {
  private fx: FXCore;
  private ramdiskManager: RAMDiskManager;
  private vfsManager: VFSManager;
  private autoImportManager: AutoImportManager;

  constructor(fx: FXCore) {
    this.fx = fx;
    this.ramdiskManager = new RAMDiskManager(fx);
    this.vfsManager = new VFSManager(fx);
    this.autoImportManager = new AutoImportManager(fx);
  }

  /**
   * Execute mount command
   */
  async execute(args: string[]): Promise<void> {
    // Parse command
    const subcommand = args[0];

    if (!subcommand || subcommand === "help" || subcommand === "-h" || subcommand === "--help") {
      this.showHelp();
      return;
    }

    // Initialize managers
    await this.ramdiskManager.initialize();
    await this.vfsManager.initialize(this.ramdiskManager);

    // Route to subcommand
    switch (subcommand) {
      case "create":
        await this.createMount(args.slice(1));
        break;

      case "list":
        await this.listMounts();
        break;

      case "status":
        await this.showStatus(args[1]);
        break;

      case "sync":
        await this.syncMount(args[1]);
        break;

      case "info":
        await this.showInfo();
        break;

      default:
        // Treat as mount path
        await this.mountPath(subcommand, args.slice(1));
        break;
    }
  }

  /**
   * Create and mount a new RAMDisk
   */
  private async createMount(args: string[]): Promise<void> {
    const options = this.parseOptions(args);

    console.log("🚀 Creating RAMDisk...");

    try {
      // Get default config
      const defaultConfig = this.ramdiskManager.getDefaultConfig();

      // Create RAMDisk
      const diskId = await this.ramdiskManager.createDisk({
        ...defaultConfig,
        sizeMB: options.size || defaultConfig.sizeMB,
        volumeName: options.name || defaultConfig.volumeName,
        driver: options.driver || defaultConfig.driver,
        allowOther: options.allowOther,
        debug: options.debug,
        autoImport: options.autoImport,
        autoSyncMs: options.syncInterval ? options.syncInterval * 1000 : 0,
      });

      console.log(`✅ RAMDisk created: ${diskId}`);

      // Get status
      const status = await this.ramdiskManager.getStatus(diskId);

      console.log(`📍 Mount point: ${status.mountPoint}`);
      console.log(`💾 Size: ${status.sizeMB}MB`);
      console.log(`🔧 Driver: ${status.driver}`);

      // Mount VFS
      await this.vfsManager.mount(status.mountPoint, {
        ramdiskId: diskId,
        watch: options.watch !== false,
      });

      console.log("✅ VFS mounted");

      // Auto-import if enabled
      if (options.autoImport) {
        console.log("📥 Auto-importing files...");

        const importResult = await this.ramdiskManager.syncToFXD(diskId);

        console.log(`   Imported: ${importResult.imported}`);
        console.log(`   Skipped: ${importResult.skipped}`);
        console.log(`   Errors: ${importResult.errors}`);
      }

      console.log("\n🎉 RAMDisk ready!");
      console.log(`\n💡 Edit files in ${status.mountPoint} to update FXD snippets`);

    } catch (error) {
      console.error(`❌ Failed to create RAMDisk: ${error.message}`);

      if (error.message.includes("not available")) {
        this.showDriverHelp();
      }

      Deno.exit(1);
    }
  }

  /**
   * Mount existing directory or RAMDisk
   */
  private async mountPath(path: string, args: string[]): Promise<void> {
    const options = this.parseOptions(args);

    console.log(`🚀 Mounting ${path}...`);

    try {
      // Check if path is a RAMDisk mount point
      const disks = this.ramdiskManager.listDisks();
      const existingDisk = disks.find(d => d.mountPoint === path);

      let diskId: string | undefined;

      if (existingDisk) {
        // Existing RAMDisk
        diskId = existingDisk.id;
        console.log(`📀 Found existing RAMDisk: ${diskId}`);
      } else {
        // Regular directory or create new RAMDisk
        try {
          const stat = await Deno.stat(path);

          if (!stat.isDirectory) {
            throw new Error("Not a directory");
          }

          console.log("📂 Mounting existing directory");
        } catch {
          // Directory doesn't exist - create RAMDisk
          console.log("📀 Creating new RAMDisk");

          diskId = await this.ramdiskManager.createDisk({
            mountPoint: path,
            sizeMB: options.size || 512,
            volumeName: options.name || "FXD_Disk",
            driver: options.driver,
            allowOther: options.allowOther,
            debug: options.debug,
            autoImport: options.autoImport,
            autoSyncMs: options.syncInterval ? options.syncInterval * 1000 : 0,
          });

          console.log(`✅ RAMDisk created: ${diskId}`);
        }
      }

      // Mount VFS
      await this.vfsManager.mount(path, {
        ramdiskId: diskId,
        watch: options.watch !== false,
      });

      console.log("✅ VFS mounted");

      // Auto-import if enabled
      if (options.autoImport || options.recursive) {
        console.log("📥 Importing files...");

        this.autoImportManager.updateConfig({
          baseDir: path,
          recursive: options.recursive !== false,
          extractSymbols: options.extractSymbols !== false,
        });

        const importResult = await this.autoImportManager.importDirectory(path);

        console.log(`   Imported: ${importResult.imported}`);
        console.log(`   Skipped: ${importResult.skipped}`);
        console.log(`   Errors: ${importResult.errors}`);
        console.log(`   Duration: ${importResult.duration}ms`);
      }

      console.log("\n🎉 Mount ready!");
      console.log(`\n💡 Edit files in ${path} to update FXD snippets`);

    } catch (error) {
      console.error(`❌ Failed to mount: ${error.message}`);
      Deno.exit(1);
    }
  }

  /**
   * List all mounts
   */
  private async listMounts(): Promise<void> {
    const disks = this.ramdiskManager.listDisks();

    if (disks.length === 0) {
      console.log("ℹ️  No RAMDisks mounted");
      return;
    }

    console.log(`📀 RAMDisks (${disks.length}):\n`);

    for (const disk of disks) {
      try {
        const status = await this.ramdiskManager.getStatus(disk.id);

        const healthIcon = status.health === "healthy" ? "✅" :
                          status.health === "warning" ? "⚠️" : "❌";

        console.log(`${healthIcon} ${disk.id}`);
        console.log(`   Mount: ${status.mountPoint}`);
        console.log(`   Size: ${status.usedMB}/${status.sizeMB}MB (${Math.round((status.usedMB / status.sizeMB) * 100)}% used)`);
        console.log(`   Files: ${status.fileCount}`);
        console.log(`   Driver: ${status.driver}`);
        console.log(`   Status: ${status.mounted ? "mounted" : "unmounted"}`);
        console.log();
      } catch (error) {
        console.error(`   Error: ${error.message}`);
      }
    }

    // Show VFS status
    const vfsStats = this.vfsManager.getStats();

    console.log("📂 VFS:");
    console.log(`   Files: ${vfsStats.totalFiles}`);
    console.log(`   Size: ${Math.round(vfsStats.totalSize / 1024)}KB`);
    console.log(`   Watchers: ${vfsStats.watchers}`);
    console.log(`   Pending changes: ${vfsStats.pendingChanges}`);
  }

  /**
   * Show mount status
   */
  private async showStatus(diskId?: string): Promise<void> {
    if (!diskId) {
      console.error("❌ Disk ID required");
      console.log("Usage: fxd mount status <disk-id>");
      Deno.exit(1);
    }

    try {
      const status = await this.ramdiskManager.getStatus(diskId);

      console.log(`📀 RAMDisk: ${status.id}\n`);

      console.log(`Status: ${status.mounted ? "✅ Mounted" : "❌ Unmounted"}`);
      console.log(`Health: ${status.health === "healthy" ? "✅" : status.health === "warning" ? "⚠️" : "❌"} ${status.health}`);
      console.log(`\nMount point: ${status.mountPoint}`);
      console.log(`Platform: ${status.platform}`);
      console.log(`Driver: ${status.driver}`);
      console.log(`\nSize: ${status.sizeMB}MB`);
      console.log(`Used: ${status.usedMB}MB (${Math.round((status.usedMB / status.sizeMB) * 100)}%)`);
      console.log(`Free: ${status.freeMB}MB`);
      console.log(`\nFiles: ${status.fileCount}`);
      console.log(`Created: ${new Date(status.created).toLocaleString()}`);

      if (status.lastSync > 0) {
        console.log(`Last sync: ${new Date(status.lastSync).toLocaleString()}`);
      }

      if (status.errors.length > 0) {
        console.log(`\n⚠️  Errors:`);
        for (const error of status.errors) {
          console.log(`   - ${error}`);
        }
      }

    } catch (error) {
      console.error(`❌ Failed to get status: ${error.message}`);
      Deno.exit(1);
    }
  }

  /**
   * Sync mount with FXD
   */
  private async syncMount(diskId?: string): Promise<void> {
    if (!diskId) {
      console.error("❌ Disk ID required");
      console.log("Usage: fxd mount sync <disk-id>");
      Deno.exit(1);
    }

    console.log(`🔄 Syncing ${diskId}...`);

    try {
      const result = await this.ramdiskManager.syncToFXD(diskId);

      console.log(`✅ Sync complete`);
      console.log(`   Imported: ${result.imported}`);
      console.log(`   Skipped: ${result.skipped}`);
      console.log(`   Errors: ${result.errors}`);

    } catch (error) {
      console.error(`❌ Sync failed: ${error.message}`);
      Deno.exit(1);
    }
  }

  /**
   * Show system information
   */
  private async showInfo(): Promise<void> {
    console.log("🖥️  System Information\n");

    console.log(`Platform: ${Deno.build.os}`);
    console.log(`Architecture: ${Deno.build.arch}`);

    // Check available drivers
    console.log("\n🔧 Available Drivers:");

    const drivers = await this.ramdiskManager.getAvailableDrivers();

    if (drivers.length === 0) {
      console.log("   ⚠️  No drivers available");
      this.showDriverHelp();
    } else {
      for (const driver of drivers) {
        console.log(`   ✅ ${driver}`);
      }
    }

    // Show default configuration
    console.log("\n⚙️  Default Configuration:");

    const defaultConfig = this.ramdiskManager.getDefaultConfig();

    console.log(`   Size: ${defaultConfig.sizeMB}MB`);
    console.log(`   Mount: ${defaultConfig.mountPoint}`);
    console.log(`   Volume: ${defaultConfig.volumeName}`);
    console.log(`   Driver: ${defaultConfig.driver}`);
    console.log(`   FS: ${defaultConfig.fileSystem}`);
  }

  /**
   * Show driver installation help
   */
  private showDriverHelp(): void {
    console.log("\n💡 Driver Installation:");

    if (Deno.build.os === "windows") {
      console.log("   Windows: Install ImDisk Toolkit");
      console.log("   https://sourceforge.net/projects/imdisk-toolkit/");
      console.log("\n   Or install WinFsp:");
      console.log("   https://winfsp.dev/");
    } else if (Deno.build.os === "darwin") {
      console.log("   macOS: Install macFUSE");
      console.log("   https://osxfuse.github.io/");
      console.log("\n   Or use Homebrew:");
      console.log("   brew install macfuse");
    } else if (Deno.build.os === "linux") {
      console.log("   Linux: Install FUSE");
      console.log("   Ubuntu/Debian: sudo apt-get install fuse");
      console.log("   Fedora: sudo dnf install fuse");
      console.log("   Arch: sudo pacman -S fuse");
    }
  }

  /**
   * Show command help
   */
  private showHelp(): void {
    console.log(`
FXD Mount Command - Create and mount virtual filesystems

USAGE:
  fxd mount [path] [options]           Mount directory or create RAMDisk
  fxd mount create [options]           Create new RAMDisk
  fxd mount list                       List all mounts
  fxd mount status <disk-id>           Show mount status
  fxd mount sync <disk-id>             Sync mount with FXD
  fxd mount info                       Show system information
  fxd mount help                       Show this help

OPTIONS:
  --size=<mb>                 RAMDisk size in MB (default: 512)
  --name=<name>               Volume name (default: FXD_Disk)
  --driver=<driver>           Driver to use (auto, imdisk, winfsp, diskutil, tmpfs)

  --watch                     Enable file watching (default: true)
  --no-watch                  Disable file watching
  --auto-sync                 Enable auto-sync
  --sync-interval=<seconds>   Auto-sync interval (default: 0/disabled)

  --auto-import               Import files on mount (default: false)
  --recursive                 Recursive import (default: true)
  --extract-symbols           Extract functions/classes (default: true)

  --allow-other               Allow other users (Unix only)
  --debug                     Enable debug logging
  --force                     Force mount (unmount existing)

EXAMPLES:
  # Windows: Create and mount to R: drive
  fxd mount R:\\ --size=1024 --name="MyDisk"

  # Linux: Create and mount to /mnt/fxd
  fxd mount /mnt/fxd --size=512

  # macOS: Mount to /Volumes/FXD
  fxd mount /Volumes/FXD --auto-import

  # Mount existing directory with auto-import
  fxd mount /path/to/code --auto-import --recursive

  # Create RAMDisk with custom settings
  fxd mount create --size=2048 --name="BigDisk" --auto-sync --sync-interval=60

  # List all mounts
  fxd mount list

  # Show status of specific mount
  fxd mount status disk_12345

  # Sync mount with FXD
  fxd mount sync disk_12345

  # Show system information
  fxd mount info
`);
  }

  /**
   * Parse command options
   */
  private parseOptions(args: string[]): MountOptions {
    const options: MountOptions = {};

    for (const arg of args) {
      if (arg.startsWith("--")) {
        const [key, value] = arg.substring(2).split("=");

        switch (key) {
          case "size":
            options.size = parseInt(value);
            break;

          case "name":
            options.name = value;
            break;

          case "driver":
            options.driver = value;
            break;

          case "watch":
            options.watch = true;
            break;

          case "no-watch":
            options.watch = false;
            break;

          case "auto-sync":
            options.autoSync = true;
            break;

          case "sync-interval":
            options.syncInterval = parseInt(value);
            break;

          case "auto-import":
            options.autoImport = true;
            break;

          case "recursive":
            options.recursive = true;
            break;

          case "extract-symbols":
            options.extractSymbols = true;
            break;

          case "allow-other":
            options.allowOther = true;
            break;

          case "debug":
            options.debug = true;
            break;

          case "force":
            options.force = true;
            break;
        }
      }
    }

    return options;
  }
}

/**
 * Main entry point
 */
async function main() {
  // Create FX instance
  const fx = new FXCore();

  // Create and execute mount command
  const command = new MountCommand(fx);
  await command.execute(Deno.args);
}

// Run if main module
if (import.meta.main) {
  main().catch((error) => {
    console.error("Mount command error:", error.message);
    Deno.exit(1);
  });
}

export { MountCommand };
