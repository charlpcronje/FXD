/**
 * @file fx-vfs-manager.ts
 * @description Cross-platform Virtual Filesystem Manager
 * Provides unified interface for managing virtual filesystems across Windows, macOS, and Linux
 */

import { FXCore } from "../fx.ts";
import { WindowsVFSDriver, windowsVFSPlugin } from "../plugins/fx-vfs-windows.ts";
import { MacOSVFSDriver, macOSVFSPlugin } from "../plugins/fx-vfs-macos.ts";
import { LinuxVFSDriver, linuxVFSPlugin } from "../plugins/fx-vfs-linux.ts";

/**
 * Platform detection type
 */
type Platform = "windows" | "darwin" | "linux" | "unknown";

/**
 * VFS driver interface
 */
export interface VFSDriver {
  createMount(mountPoint: string, config?: any): Promise<string>;
  destroyMount(mountId: string): Promise<void>;
  getMountStatus(mountId: string): any;
  listMounts(): any[];
  isAvailable(): boolean;
  getSystemInfo(): any;
}

/**
 * Mount configuration interface
 */
export interface MountConfig {
  mountPoint: string;
  type?: "auto" | "windows" | "macos" | "linux";
  options?: Record<string, any>;
}

/**
 * Mount information interface
 */
export interface MountInfo {
  id: string;
  mountPoint: string;
  platform: Platform;
  driver: string;
  status: "active" | "inactive" | "error";
  created: number;
  config: any;
  stats?: any;
}

/**
 * VFS Manager events
 */
export interface VFSManagerEvents {
  'mount-created': { mountId: string; mountPoint: string; platform: Platform };
  'mount-destroyed': { mountId: string; mountPoint: string; platform: Platform };
  'mount-error': { mountId: string; error: Error };
  'driver-loaded': { platform: Platform; available: boolean };
  'driver-error': { platform: Platform; error: Error };
}

/**
 * Cross-platform Virtual Filesystem Manager
 * Provides unified interface for managing virtual filesystems across different platforms
 */
export class VFSManager {
  private fx: FXCore;
  private drivers = new Map<Platform, VFSDriver>();
  private currentPlatform: Platform;
  private eventListeners = new Map<keyof VFSManagerEvents, Set<Function>>();

  constructor(fx: FXCore) {
    this.fx = fx;
    this.currentPlatform = this._detectPlatform();
    this._initializeEventSystem();
  }

  /**
   * Initialize the VFS manager
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Initializing VFS Manager for platform: ${this.currentPlatform}`);

      // Load all available drivers
      await this._loadDrivers();

      // Store manager reference in FX system
      this.fx.proxy("system.vfs.manager").val(this);

      // Initialize mount tracking
      this.fx.proxy("system.vfs.mounts").val({});
      this.fx.proxy("system.vfs.stats").val({
        totalMounts: 0,
        activeMounts: 0,
        platforms: {},
        lastActivity: Date.now()
      });

      console.log("VFS Manager initialized successfully");
      this._emit('driver-loaded', { platform: this.currentPlatform, available: this.isPlatformAvailable() });
    } catch (error) {
      console.error("Failed to initialize VFS Manager:", error);
      this._emit('driver-error', { platform: this.currentPlatform, error: error as Error });
      throw error;
    }
  }

  /**
   * Create a new virtual filesystem mount
   */
  async createMount(config: MountConfig): Promise<string> {
    try {
      const platform = config.type === "auto" ? this.currentPlatform : config.type as Platform;
      const driver = this._getDriver(platform);

      if (!driver) {
        throw new Error(`No driver available for platform: ${platform}`);
      }

      if (!driver.isAvailable()) {
        throw new Error(`VFS driver for ${platform} is not available`);
      }

      console.log(`Creating VFS mount at ${config.mountPoint} on ${platform}`);

      const mountId = await driver.createMount(config.mountPoint, config.options);

      // Store mount information
      const mountInfo: MountInfo = {
        id: mountId,
        mountPoint: config.mountPoint,
        platform,
        driver: platform,
        status: "active",
        created: Date.now(),
        config: config
      };

      this.fx.proxy(`system.vfs.mounts.${mountId}`).val(mountInfo);

      // Update statistics
      this._updateStats();

      this._emit('mount-created', { mountId, mountPoint: config.mountPoint, platform });

      console.log(`VFS mount created successfully: ${mountId}`);
      return mountId;
    } catch (error) {
      console.error(`Failed to create VFS mount:`, error);
      throw error;
    }
  }

  /**
   * Destroy a virtual filesystem mount
   */
  async destroyMount(mountId: string): Promise<void> {
    try {
      const mountInfo = this.getMountInfo(mountId);
      if (!mountInfo) {
        throw new Error(`Mount not found: ${mountId}`);
      }

      const driver = this._getDriver(mountInfo.platform);
      if (!driver) {
        throw new Error(`No driver available for platform: ${mountInfo.platform}`);
      }

      console.log(`Destroying VFS mount: ${mountId} at ${mountInfo.mountPoint}`);

      await driver.destroyMount(mountId);

      // Remove mount information
      this.fx.proxy(`system.vfs.mounts.${mountId}`).val(undefined);

      // Update statistics
      this._updateStats();

      this._emit('mount-destroyed', {
        mountId,
        mountPoint: mountInfo.mountPoint,
        platform: mountInfo.platform
      });

      console.log(`VFS mount destroyed successfully: ${mountId}`);
    } catch (error) {
      console.error(`Failed to destroy VFS mount ${mountId}:`, error);
      this._emit('mount-error', { mountId, error: error as Error });
      throw error;
    }
  }

  /**
   * Get mount information
   */
  getMountInfo(mountId: string): MountInfo | null {
    return this.fx.proxy(`system.vfs.mounts.${mountId}`).val() || null;
  }

  /**
   * List all active mounts
   */
  listMounts(): MountInfo[] {
    const mounts = this.fx.proxy("system.vfs.mounts").val() || {};
    return Object.values(mounts) as MountInfo[];
  }

  /**
   * Get mount status with live statistics
   */
  getMountStatus(mountId: string): any {
    const mountInfo = this.getMountInfo(mountId);
    if (!mountInfo) {
      return null;
    }

    const driver = this._getDriver(mountInfo.platform);
    if (!driver) {
      return { ...mountInfo, status: "error", error: "Driver not available" };
    }

    const driverStatus = driver.getMountStatus(mountId);
    return {
      ...mountInfo,
      ...driverStatus,
      uptime: Date.now() - mountInfo.created
    };
  }

  /**
   * Sync all mounts - refresh status and clean up stale mounts
   */
  async syncMounts(): Promise<void> {
    console.log("Syncing all VFS mounts...");

    const mounts = this.listMounts();
    const results = {
      total: mounts.length,
      active: 0,
      inactive: 0,
      errors: 0,
      cleaned: 0
    };

    for (const mount of mounts) {
      try {
        const driver = this._getDriver(mount.platform);
        if (!driver) {
          console.warn(`No driver available for mount ${mount.id} on ${mount.platform}`);
          results.errors++;
          continue;
        }

        const status = driver.getMountStatus(mount.id);
        if (status) {
          if (status.status === "active") {
            results.active++;
          } else {
            results.inactive++;
          }

          // Update mount info with latest status
          this.fx.proxy(`system.vfs.mounts.${mount.id}.status`).val(status.status);
          this.fx.proxy(`system.vfs.mounts.${mount.id}.stats`).val(status.operations);
        } else {
          // Mount not found in driver - clean up
          console.warn(`Cleaning up stale mount: ${mount.id}`);
          this.fx.proxy(`system.vfs.mounts.${mount.id}`).val(undefined);
          results.cleaned++;
        }
      } catch (error) {
        console.error(`Error syncing mount ${mount.id}:`, error);
        results.errors++;
      }
    }

    // Update global statistics
    this._updateStats();

    console.log(`Mount sync completed:`, results);
  }

  /**
   * Check if the current platform supports VFS
   */
  isPlatformAvailable(): boolean {
    const driver = this._getDriver(this.currentPlatform);
    return driver ? driver.isAvailable() : false;
  }

  /**
   * Get system information for all platforms
   */
  getSystemInfo(): any {
    const info: any = {
      currentPlatform: this.currentPlatform,
      platforms: {},
      totalMounts: this.listMounts().length,
      activeMounts: this.listMounts().filter(m => m.status === "active").length
    };

    for (const [platform, driver] of this.drivers) {
      info.platforms[platform] = driver.getSystemInfo();
    }

    return info;
  }

  /**
   * Get VFS statistics
   */
  getStats(): any {
    const mounts = this.listMounts();
    const platformStats: Record<string, any> = {};

    for (const mount of mounts) {
      if (!platformStats[mount.platform]) {
        platformStats[mount.platform] = {
          total: 0,
          active: 0,
          inactive: 0,
          mounts: []
        };
      }

      platformStats[mount.platform].total++;
      if (mount.status === "active") {
        platformStats[mount.platform].active++;
      } else {
        platformStats[mount.platform].inactive++;
      }

      platformStats[mount.platform].mounts.push({
        id: mount.id,
        mountPoint: mount.mountPoint,
        created: mount.created,
        uptime: Date.now() - mount.created
      });
    }

    return {
      total: mounts.length,
      active: mounts.filter(m => m.status === "active").length,
      inactive: mounts.filter(m => m.status !== "active").length,
      platforms: platformStats,
      currentPlatform: this.currentPlatform,
      available: this.isPlatformAvailable(),
      lastSync: Date.now()
    };
  }

  /**
   * Add event listener
   */
  on<K extends keyof VFSManagerEvents>(event: K, listener: (data: VFSManagerEvents[K]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  /**
   * Remove event listener
   */
  off<K extends keyof VFSManagerEvents>(event: K, listener: (data: VFSManagerEvents[K]) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Cleanup all mounts and resources
   */
  async cleanup(): Promise<void> {
    console.log("Cleaning up VFS Manager...");

    try {
      const mounts = this.listMounts();

      // Destroy all active mounts
      for (const mount of mounts) {
        try {
          await this.destroyMount(mount.id);
        } catch (error) {
          console.error(`Failed to cleanup mount ${mount.id}:`, error);
        }
      }

      // Clear all data
      this.fx.proxy("system.vfs.mounts").val({});
      this.fx.proxy("system.vfs.stats").val({});
      this.fx.proxy("system.vfs.manager").val(undefined);

      // Clear event listeners
      this.eventListeners.clear();

      console.log("VFS Manager cleanup completed");
    } catch (error) {
      console.error("Error during VFS Manager cleanup:", error);
      throw error;
    }
  }

  // Private methods

  /**
   * Detect the current platform
   */
  private _detectPlatform(): Platform {
    const os = Deno.build.os;
    switch (os) {
      case "windows":
        return "windows";
      case "darwin":
        return "darwin";
      case "linux":
        return "linux";
      default:
        return "unknown";
    }
  }

  /**
   * Initialize event system
   */
  private _initializeEventSystem(): void {
    this.eventListeners = new Map();
  }

  /**
   * Load VFS drivers for all platforms
   */
  private async _loadDrivers(): Promise<void> {
    try {
      // Load Windows driver
      try {
        const windowsDriver = await windowsVFSPlugin.activate(this.fx);
        this.drivers.set("windows", windowsDriver);
        console.log("Windows VFS driver loaded");
      } catch (error) {
        console.warn("Failed to load Windows VFS driver:", error.message);
      }

      // Load macOS driver
      try {
        const macosDriver = await macOSVFSPlugin.activate(this.fx);
        this.drivers.set("darwin", macosDriver);
        console.log("macOS VFS driver loaded");
      } catch (error) {
        console.warn("Failed to load macOS VFS driver:", error.message);
      }

      // Load Linux driver
      try {
        const linuxDriver = await linuxVFSPlugin.activate(this.fx);
        this.drivers.set("linux", linuxDriver);
        console.log("Linux VFS driver loaded");
      } catch (error) {
        console.warn("Failed to load Linux VFS driver:", error.message);
      }

      console.log(`Loaded ${this.drivers.size} VFS driver(s)`);
    } catch (error) {
      console.error("Error loading VFS drivers:", error);
      throw error;
    }
  }

  /**
   * Get driver for platform
   */
  private _getDriver(platform: Platform): VFSDriver | null {
    return this.drivers.get(platform) || null;
  }

  /**
   * Emit event to listeners
   */
  private _emit<K extends keyof VFSManagerEvents>(event: K, data: VFSManagerEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in VFS event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Update global statistics
   */
  private _updateStats(): void {
    const stats = this.getStats();
    this.fx.proxy("system.vfs.stats").val(stats);
  }
}

/**
 * Factory function to create VFS manager
 */
export function createVFSManager(fx: FXCore): VFSManager {
  return new VFSManager(fx);
}

/**
 * Enhanced CLI mount command implementation
 */
export class VFSCLICommands {
  constructor(private vfsManager: VFSManager) {}

  /**
   * Handle mount command
   */
  async handleMountCommand(subcommand: string, args: any): Promise<void> {
    switch (subcommand) {
      case "create":
        await this._createMount(args);
        break;
      case "destroy":
        await this._destroyMount(args);
        break;
      case "list":
        await this._listMounts(args);
        break;
      case "status":
        await this._showMountStatus(args);
        break;
      case "sync":
        await this._syncMounts(args);
        break;
      case "info":
        await this._showSystemInfo(args);
        break;
      default:
        this._showMountHelp();
    }
  }

  private async _createMount(args: any): Promise<void> {
    const mountPoint = args.positional[1];
    if (!mountPoint) {
      console.error("❌ Mount point is required");
      console.log("Usage: fxd mount create <mount-point> [--type=auto] [--volume-name=name]");
      return;
    }

    const config: MountConfig = {
      mountPoint,
      type: args.options.type || "auto",
      options: {
        volumeName: args.options["volume-name"] || `FXD-${Date.now()}`,
        allowOther: args.options["allow-other"] || false,
        debug: args.options.debug || false,
      }
    };

    try {
      const mountId = await this.vfsManager.createMount(config);
      console.log(`✅ Mount created successfully`);
      console.log(`📁 Mount ID: ${mountId}`);
      console.log(`📍 Mount Point: ${mountPoint}`);
      console.log(`🖥️  Platform: ${config.type}`);
    } catch (error) {
      console.error(`❌ Failed to create mount: ${error.message}`);
    }
  }

  private async _destroyMount(args: any): Promise<void> {
    const mountId = args.positional[1];
    if (!mountId) {
      console.error("❌ Mount ID is required");
      console.log("Usage: fxd mount destroy <mount-id>");
      return;
    }

    try {
      await this.vfsManager.destroyMount(mountId);
      console.log(`✅ Mount destroyed successfully: ${mountId}`);
    } catch (error) {
      console.error(`❌ Failed to destroy mount: ${error.message}`);
    }
  }

  private async _listMounts(args: any): Promise<void> {
    const mounts = this.vfsManager.listMounts();

    if (mounts.length === 0) {
      console.log("📋 No active mounts found");
      console.log("💡 Use 'fxd mount create <path>' to create a new mount");
      return;
    }

    console.log(`📋 Active VFS Mounts (${mounts.length}):`);
    console.log("=".repeat(60));

    for (const mount of mounts) {
      const status = this.vfsManager.getMountStatus(mount.id);
      const uptime = Math.floor((Date.now() - mount.created) / 1000);

      console.log(`🔗 ${mount.id}`);
      console.log(`   📍 Mount Point: ${mount.mountPoint}`);
      console.log(`   🖥️  Platform: ${mount.platform}`);
      console.log(`   ⚡ Status: ${status?.status || 'unknown'}`);
      console.log(`   ⏱️  Uptime: ${uptime}s`);
      console.log(`   📊 Operations: ${JSON.stringify(status?.operations || {})}`);
      console.log();
    }
  }

  private async _showMountStatus(args: any): Promise<void> {
    const mountId = args.positional[1];

    if (!mountId) {
      // Show overall status
      const stats = this.vfsManager.getStats();
      console.log("🎯 VFS System Status:");
      console.log(`   Total Mounts: ${stats.total}`);
      console.log(`   Active: ${stats.active}`);
      console.log(`   Inactive: ${stats.inactive}`);
      console.log(`   Current Platform: ${stats.currentPlatform}`);
      console.log(`   Platform Available: ${stats.available ? 'Yes' : 'No'}`);
      console.log();

      for (const [platform, info] of Object.entries(stats.platforms)) {
        console.log(`🖥️  ${platform}:`);
        console.log(`   Total: ${(info as any).total || 0}`);
        console.log(`   Active: ${(info as any).active || 0}`);
        console.log();
      }
      return;
    }

    const status = this.vfsManager.getMountStatus(mountId);
    if (!status) {
      console.error(`❌ Mount not found: ${mountId}`);
      return;
    }

    console.log(`🔗 Mount Status: ${mountId}`);
    console.log("=".repeat(40));
    console.log(`📍 Mount Point: ${status.mountPoint}`);
    console.log(`🖥️  Platform: ${status.platform}`);
    console.log(`⚡ Status: ${status.status}`);
    console.log(`⏱️  Created: ${new Date(status.created).toLocaleString()}`);
    console.log(`⏱️  Uptime: ${Math.floor(status.uptime / 1000)}s`);

    if (status.operations) {
      console.log(`📊 Operations:`);
      for (const [op, count] of Object.entries(status.operations)) {
        console.log(`   ${op}: ${count}`);
      }
    }
  }

  private async _syncMounts(args: any): Promise<void> {
    console.log("🔄 Syncing all VFS mounts...");

    try {
      await this.vfsManager.syncMounts();
      console.log("✅ Mount sync completed successfully");
    } catch (error) {
      console.error(`❌ Mount sync failed: ${error.message}`);
    }
  }

  private async _showSystemInfo(args: any): Promise<void> {
    const info = this.vfsManager.getSystemInfo();

    console.log("ℹ️  VFS System Information:");
    console.log("=".repeat(40));
    console.log(`Current Platform: ${info.currentPlatform}`);
    console.log(`Total Mounts: ${info.totalMounts}`);
    console.log(`Active Mounts: ${info.activeMounts}`);
    console.log();

    for (const [platform, platformInfo] of Object.entries(info.platforms)) {
      console.log(`🖥️  ${platform.toUpperCase()}:`);
      const pInfo = platformInfo as any;
      console.log(`   Available: ${pInfo.available ? 'Yes' : 'No'}`);
      console.log(`   Driver: ${pInfo.driver}`);
      console.log(`   Active Mounts: ${pInfo.activeMounts || 0}`);

      if (pInfo.capabilities) {
        console.log(`   Capabilities:`);
        for (const [cap, supported] of Object.entries(pInfo.capabilities)) {
          console.log(`     ${cap}: ${supported ? '✓' : '✗'}`);
        }
      }
      console.log();
    }
  }

  private _showMountHelp(): void {
    console.log("🔧 VFS Mount Management Commands:");
    console.log("  create <path>      - Create new mount point");
    console.log("  destroy <id>       - Destroy mount point");
    console.log("  list               - List all mounts");
    console.log("  status [id]        - Show mount status");
    console.log("  sync               - Sync all mounts");
    console.log("  info               - Show system information");
    console.log();
    console.log("Options for create:");
    console.log("  --type=<platform>  - Platform type (auto|windows|macos|linux)");
    console.log("  --volume-name=<name> - Custom volume name");
    console.log("  --allow-other      - Allow other users to access");
    console.log("  --debug            - Enable debug mode");
  }
}

/**
 * Module exports
 */
export { VFSManager, VFSCLICommands, type MountConfig, type MountInfo, type VFSManagerEvents };