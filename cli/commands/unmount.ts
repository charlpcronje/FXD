#!/usr/bin/env -S deno run --allow-all
/**
 * @file unmount.ts
 * @description FXD unmount command - Unmount and destroy virtual filesystems
 *
 * Usage:
 *   fxd unmount [id]
 *   fxd unmount all
 *   fxd unmount --force
 *
 * Examples:
 *   fxd unmount disk_123              # Unmount specific disk
 *   fxd unmount all                   # Unmount all disks
 *   fxd unmount disk_123 --no-save    # Unmount without saving
 *   fxd unmount --force               # Force unmount all
 */

import { FXCore } from "../../fxn.ts";
import { RAMDiskManager } from "../../modules/fx-ramdisk.ts";
import { VFSManager } from "../../modules/fx-vfs.ts";

/**
 * Unmount command options
 */
export interface UnmountOptions {
  /** Force unmount */
  force?: boolean;

  /** Save changes before unmount */
  save?: boolean;

  /** Export to directory before unmount */
  export?: string;

  /** Keep RAMDisk but unmount VFS */
  keepDisk?: boolean;

  /** Quiet mode (no confirmations) */
  quiet?: boolean;
}

/**
 * Unmount command handler
 */
export class UnmountCommand {
  private fx: FXCore;
  private ramdiskManager: RAMDiskManager;
  private vfsManager: VFSManager;

  constructor(fx: FXCore) {
    this.fx = fx;
    this.ramdiskManager = new RAMDiskManager(fx);
    this.vfsManager = new VFSManager(fx);
  }

  /**
   * Execute unmount command
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

    // Parse options
    const options = this.parseOptions(args.slice(1));

    // Handle subcommands
    if (subcommand === "all") {
      await this.unmountAll(options);
    } else {
      await this.unmountDisk(subcommand, options);
    }
  }

  /**
   * Unmount a specific RAMDisk
   */
  private async unmountDisk(diskId: string, options: UnmountOptions): Promise<void> {
    console.log(`🔽 Unmounting ${diskId}...`);

    try {
      // Check if disk exists
      const status = await this.ramdiskManager.getStatus(diskId);

      if (!status.mounted && !options.force) {
        console.log(`ℹ️  RAMDisk ${diskId} is not mounted`);
        return;
      }

      // Confirm if not quiet
      if (!options.quiet && !await this.confirm(`Unmount ${diskId}?`)) {
        console.log("❌ Cancelled");
        return;
      }

      // Export if requested
      if (options.export) {
        console.log(`📤 Exporting to ${options.export}...`);

        await this.vfsManager.syncToDirectory(options.export);

        console.log("✅ Export complete");
      }

      // Save changes if requested
      if (options.save !== false) {
        console.log("💾 Saving changes...");

        const result = await this.ramdiskManager.syncToFXD(diskId);

        console.log(`   Imported: ${result.imported}`);
        console.log(`   Skipped: ${result.skipped}`);
        console.log(`   Errors: ${result.errors}`);
      }

      // Unmount VFS
      console.log("🔽 Unmounting VFS...");

      await this.vfsManager.unmount();

      console.log("✅ VFS unmounted");

      // Destroy RAMDisk unless keepDisk is set
      if (!options.keepDisk) {
        console.log("🗑️  Destroying RAMDisk...");

        await this.ramdiskManager.destroyDisk(diskId);

        console.log("✅ RAMDisk destroyed");
      }

      console.log(`\n🎉 ${diskId} unmounted successfully`);

    } catch (error) {
      console.error(`❌ Failed to unmount: ${error.message}`);

      if (options.force) {
        console.log("⚠️  Force mode: Attempting cleanup anyway...");

        try {
          await this.vfsManager.unmount();
          await this.ramdiskManager.destroyDisk(diskId);
          console.log("✅ Cleanup complete");
        } catch (cleanupError) {
          console.error(`❌ Cleanup failed: ${cleanupError.message}`);
        }
      }

      Deno.exit(1);
    }
  }

  /**
   * Unmount all RAMDisks
   */
  private async unmountAll(options: UnmountOptions): Promise<void> {
    const disks = this.ramdiskManager.listDisks();

    if (disks.length === 0) {
      console.log("ℹ️  No RAMDisks to unmount");
      return;
    }

    console.log(`🔽 Unmounting ${disks.length} RAMDisk(s)...`);

    // Confirm if not quiet
    if (!options.quiet && !await this.confirm(`Unmount all ${disks.length} RAMDisk(s)?`)) {
      console.log("❌ Cancelled");
      return;
    }

    let success = 0;
    let failed = 0;

    for (const disk of disks) {
      console.log(`\n📀 ${disk.id}:`);

      try {
        await this.unmountDisk(disk.id, { ...options, quiet: true });
        success++;
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Unmounted: ${success}`);

    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`);
    }

    console.log("\n🎉 All operations complete");
  }

  /**
   * Show command help
   */
  private showHelp(): void {
    console.log(`
FXD Unmount Command - Unmount and destroy virtual filesystems

USAGE:
  fxd unmount <disk-id> [options]     Unmount specific disk
  fxd unmount all [options]           Unmount all disks
  fxd unmount help                    Show this help

OPTIONS:
  --save                Save changes to FXD before unmount (default: true)
  --no-save             Don't save changes
  --export=<dir>        Export files to directory before unmount
  --keep-disk           Keep RAMDisk, only unmount VFS
  --force               Force unmount even if errors occur
  --quiet               No confirmation prompts

EXAMPLES:
  # Unmount and save changes
  fxd unmount disk_12345

  # Unmount without saving
  fxd unmount disk_12345 --no-save

  # Unmount and export to directory
  fxd unmount disk_12345 --export=/path/to/backup

  # Keep RAMDisk but unmount VFS
  fxd unmount disk_12345 --keep-disk

  # Unmount all disks
  fxd unmount all

  # Force unmount all (no confirmations)
  fxd unmount all --force --quiet

NOTES:
  - Changes are saved to FXD by default before unmount
  - Use --no-save to skip saving (data will be lost!)
  - Use --export to backup files before unmount
  - Use --keep-disk to preserve RAMDisk but unmount VFS
  - Use --force to attempt cleanup even if errors occur
`);
  }

  /**
   * Confirm action with user
   */
  private async confirm(message: string): Promise<boolean> {
    const response = prompt(`${message} (y/n): `);
    return response?.toLowerCase() === 'y';
  }

  /**
   * Parse command options
   */
  private parseOptions(args: string[]): UnmountOptions {
    const options: UnmountOptions = {
      save: true, // Default: save changes
    };

    for (const arg of args) {
      if (arg.startsWith("--")) {
        const [key, value] = arg.substring(2).split("=");

        switch (key) {
          case "force":
            options.force = true;
            break;

          case "save":
            options.save = true;
            break;

          case "no-save":
            options.save = false;
            break;

          case "export":
            options.export = value;
            break;

          case "keep-disk":
            options.keepDisk = true;
            break;

          case "quiet":
            options.quiet = true;
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

  // Create and execute unmount command
  const command = new UnmountCommand(fx);
  await command.execute(Deno.args);
}

// Run if main module
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unmount command error:", error.message);
    Deno.exit(1);
  });
}

export { UnmountCommand };
