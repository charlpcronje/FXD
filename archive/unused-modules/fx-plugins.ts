/**
 * @file fx-plugins.ts
 * @description Advanced plugin lifecycle management system for FXD
 * Provides plugin discovery, loading, dependency resolution, sandboxing, and hot reloading
 */

import { FXCore } from "../fx.ts";
import { FXDEventBus } from "./fx-events.ts";
import { FXDConfigManager } from "./fx-config.ts";

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  DISCOVERED = "discovered",
  LOADING = "loading",
  LOADED = "loaded",
  INITIALIZING = "initializing",
  ACTIVE = "active",
  STOPPING = "stopping",
  STOPPED = "stopped",
  ERROR = "error",
  DISABLED = "disabled"
}

/**
 * Plugin manifest structure
 */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;

  // Entry points
  main: string;
  types?: string;

  // Dependencies
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  fxdDependencies?: Record<string, string>;

  // Plugin metadata
  category?: string;
  keywords?: string[];

  // Runtime configuration
  config?: {
    schema?: Record<string, any>;
    defaults?: Record<string, any>;
  };

  // Capabilities
  capabilities?: {
    hotReload?: boolean;
    sandboxed?: boolean;
    persistent?: boolean;
  };

  // Lifecycle hooks
  hooks?: {
    preInstall?: string;
    postInstall?: string;
    preActivate?: string;
    postActivate?: string;
    preDeactivate?: string;
    postDeactivate?: string;
    preUninstall?: string;
    postUninstall?: string;
  };

  // API exports
  exports?: {
    api?: string[];
    components?: string[];
    commands?: string[];
    views?: string[];
  };

  // Security
  permissions?: {
    filesystem?: "read" | "write" | "full" | "none";
    network?: "read" | "write" | "full" | "none";
    system?: "read" | "write" | "full" | "none";
  };
}

/**
 * Plugin context provided to plugins
 */
export interface PluginContext {
  fx: FXCore;
  events: FXDEventBus;
  config: FXDConfigManager;
  plugin: PluginInstance;
  logger: PluginLogger;
  api: PluginAPI;
}

/**
 * Plugin API for interaction with FXD
 */
export interface PluginAPI {
  // Configuration
  getConfig<T = any>(key: string, defaultValue?: T): T;
  setConfig<T = any>(key: string, value: T): void;

  // Events
  emit<T = any>(type: string, data: T): void;
  on<T = any>(type: string, handler: (data: T) => void): () => void;

  // Storage
  getData<T = any>(key: string): T | undefined;
  setData<T = any>(key: string, value: T): void;
  deleteData(key: string): boolean;

  // Commands
  registerCommand(name: string, handler: (args: any[]) => any): void;
  executeCommand(name: string, args: any[]): Promise<any>;

  // Views
  registerView(name: string, component: any): void;
  unregisterView(name: string): void;

  // Hooks
  addHook(name: string, handler: Function): void;
  removeHook(name: string, handler: Function): void;
  executeHook(name: string, ...args: any[]): Promise<any[]>;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Plugin instance with runtime information
 */
export interface PluginInstance {
  id: string;
  manifest: PluginManifest;
  path: string;
  state: PluginState;

  // Runtime data
  loadedAt?: Date;
  activatedAt?: Date;
  instance?: any;
  context?: PluginContext;

  // Statistics
  stats: {
    loadTime?: number;
    activationTime?: number;
    errors: Array<{ error: Error; timestamp: Date }>;
    events: { emitted: number; received: number };
    apiCalls: number;
  };

  // Dependencies
  dependencies: Set<string>;
  dependents: Set<string>;

  // Configuration
  config: Record<string, any>;

  // Capabilities
  sandbox?: any; // Sandbox context if sandboxed
  hotReloadWatcher?: any; // File watcher for hot reload
}

/**
 * Plugin manager events
 */
export interface PluginManagerEvents {
  "plugin:discovered": { plugin: PluginInstance };
  "plugin:loaded": { plugin: PluginInstance };
  "plugin:activated": { plugin: PluginInstance };
  "plugin:deactivated": { plugin: PluginInstance };
  "plugin:error": { plugin: PluginInstance; error: Error };
  "plugin:dependency-missing": { plugin: PluginInstance; dependency: string };
  "plugin:hot-reload": { plugin: PluginInstance };
}

/**
 * Advanced plugin lifecycle management system
 */
export class FXDPluginManager {
  private fx: FXCore;
  private events: FXDEventBus;
  private config: FXDConfigManager;

  // Plugin registry
  private plugins = new Map<string, PluginInstance>();
  private pluginPaths = new Set<string>();

  // State management
  private loadOrder: string[] = [];
  private dependencyGraph = new Map<string, Set<string>>();

  // API registry
  private commands = new Map<string, { handler: Function; plugin: string }>();
  private views = new Map<string, { component: any; plugin: string }>();
  private hooks = new Map<string, Array<{ handler: Function; plugin: string }>>();

  // Hot reload support
  private fileWatchers = new Map<string, any>();
  private hotReloadEnabled = false;

  // Security and sandboxing
  private sandboxEnabled = false;
  private permissionManager?: any;

  constructor(fx: FXCore, events: FXDEventBus, config: FXDConfigManager) {
    this.fx = fx;
    this.events = events;
    this.config = config;

    this._setupEventListeners();
    this._loadConfiguration();
  }

  /**
   * Discover plugins in specified directories
   */
  async discoverPlugins(directories: string[]): Promise<string[]> {
    const discovered: string[] = [];

    for (const directory of directories) {
      try {
        const plugins = await this._scanDirectory(directory);
        discovered.push(...plugins);
      } catch (error) {
        console.warn(`[Plugins] Failed to scan directory: ${directory}`, error);
      }
    }

    return discovered;
  }

  /**
   * Load plugin from manifest path
   */
  async loadPlugin(manifestPath: string): Promise<PluginInstance> {
    try {
      const manifest = await this._loadManifest(manifestPath);
      const plugin = this._createPluginInstance(manifest, manifestPath);

      plugin.state = PluginState.LOADING;

      // Validate dependencies
      await this._validateDependencies(plugin);

      // Load plugin code
      const startTime = Date.now();
      plugin.instance = await this._loadPluginCode(plugin);
      plugin.stats.loadTime = Date.now() - startTime;

      plugin.state = PluginState.LOADED;
      plugin.loadedAt = new Date();

      this.plugins.set(plugin.id, plugin);
      this._updateDependencyGraph(plugin);

      // Set up hot reload if enabled
      if (this.hotReloadEnabled && plugin.manifest.capabilities?.hotReload) {
        this._setupHotReload(plugin);
      }

      this.events.emit("plugin:loaded", { plugin });
      this._log(plugin, "info", `Plugin loaded successfully`);

      return plugin;

    } catch (error) {
      this._logError(null, error as Error, `Failed to load plugin: ${manifestPath}`);
      throw error;
    }
  }

  /**
   * Activate plugin (initialize and start)
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.state === PluginState.ACTIVE) {
      this._log(plugin, "warn", "Plugin already active");
      return;
    }

    if (plugin.state !== PluginState.LOADED) {
      throw new Error(`Plugin must be loaded before activation: ${pluginId}`);
    }

    try {
      plugin.state = PluginState.INITIALIZING;

      // Activate dependencies first
      await this._activateDependencies(plugin);

      // Initialize plugin
      const startTime = Date.now();
      const context = this._createPluginContext(plugin);
      plugin.context = context;

      if (plugin.instance && typeof plugin.instance.activate === "function") {
        await plugin.instance.activate(context);
      }

      plugin.stats.activationTime = Date.now() - startTime;
      plugin.state = PluginState.ACTIVE;
      plugin.activatedAt = new Date();

      this.loadOrder.push(pluginId);

      this.events.emit("plugin:activated", { plugin });
      this._log(plugin, "info", `Plugin activated successfully`);

    } catch (error) {
      plugin.state = PluginState.ERROR;
      this._logError(plugin, error as Error, "Plugin activation failed");
      this.events.emit("plugin:error", { plugin, error: error as Error });
      throw error;
    }
  }

  /**
   * Deactivate plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.state !== PluginState.ACTIVE) {
      this._log(plugin, "warn", "Plugin not active");
      return;
    }

    try {
      plugin.state = PluginState.STOPPING;

      // Check for dependents
      if (plugin.dependents.size > 0) {
        const dependentNames = Array.from(plugin.dependents);
        throw new Error(`Cannot deactivate plugin with active dependents: ${dependentNames.join(", ")}`);
      }

      // Deactivate plugin
      if (plugin.instance && typeof plugin.instance.deactivate === "function") {
        await plugin.instance.deactivate();
      }

      // Clean up registrations
      this._cleanupPluginRegistrations(plugin);

      plugin.state = PluginState.STOPPED;

      // Remove from load order
      const index = this.loadOrder.indexOf(pluginId);
      if (index >= 0) {
        this.loadOrder.splice(index, 1);
      }

      this.events.emit("plugin:deactivated", { plugin });
      this._log(plugin, "info", `Plugin deactivated successfully`);

    } catch (error) {
      plugin.state = PluginState.ERROR;
      this._logError(plugin, error as Error, "Plugin deactivation failed");
      this.events.emit("plugin:error", { plugin, error: error as Error });
      throw error;
    }
  }

  /**
   * Unload plugin completely
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Deactivate if active
    if (plugin.state === PluginState.ACTIVE) {
      await this.deactivatePlugin(pluginId);
    }

    // Clean up hot reload watcher
    if (plugin.hotReloadWatcher) {
      this._cleanupHotReload(plugin);
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this._updateDependencyGraph(plugin, true);

    this._log(plugin, "info", `Plugin unloaded successfully`);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): PluginInstance[] {
    return this.getPlugins().filter(p => p.state === PluginState.ACTIVE);
  }

  /**
   * Execute command registered by plugin
   */
  async executeCommand(name: string, args: any[] = []): Promise<any> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }

    const plugin = this.plugins.get(command.plugin);
    if (!plugin) {
      throw new Error(`Plugin not found for command: ${name}`);
    }

    plugin.stats.apiCalls++;

    try {
      return await command.handler(args);
    } catch (error) {
      this._logError(plugin, error as Error, `Command execution failed: ${name}`);
      throw error;
    }
  }

  /**
   * Get registered commands
   */
  getCommands(): Array<{ name: string; plugin: string }> {
    return Array.from(this.commands.entries()).map(([name, { plugin }]) => ({ name, plugin }));
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    total: number;
    active: number;
    loaded: number;
    errors: number;
    commands: number;
    views: number;
    hooks: number;
  } {
    const plugins = this.getPlugins();

    return {
      total: plugins.length,
      active: plugins.filter(p => p.state === PluginState.ACTIVE).length,
      loaded: plugins.filter(p => p.state === PluginState.LOADED).length,
      errors: plugins.filter(p => p.state === PluginState.ERROR).length,
      commands: this.commands.size,
      views: this.views.size,
      hooks: this.hooks.size,
    };
  }

  /**
   * Enable hot reload
   */
  enableHotReload(): void {
    this.hotReloadEnabled = true;

    // Set up hot reload for existing plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.manifest.capabilities?.hotReload && !plugin.hotReloadWatcher) {
        this._setupHotReload(plugin);
      }
    }
  }

  /**
   * Disable hot reload
   */
  disableHotReload(): void {
    this.hotReloadEnabled = false;

    // Clean up existing watchers
    for (const plugin of this.plugins.values()) {
      if (plugin.hotReloadWatcher) {
        this._cleanupHotReload(plugin);
      }
    }
  }

  /**
   * Cleanup all plugins and resources
   */
  async cleanup(): Promise<void> {
    // Deactivate all active plugins in reverse order
    const activePlugins = this.loadOrder.slice().reverse();

    for (const pluginId of activePlugins) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        console.error(`[Plugins] Failed to deactivate plugin during cleanup: ${pluginId}`, error);
      }
    }

    // Clean up hot reload
    this.disableHotReload();

    // Clear registries
    this.plugins.clear();
    this.commands.clear();
    this.views.clear();
    this.hooks.clear();
    this.dependencyGraph.clear();
    this.loadOrder = [];
  }

  // Private methods

  private async _scanDirectory(directory: string): Promise<string[]> {
    const discovered: string[] = [];

    if (typeof Deno !== "undefined") {
      try {
        for await (const entry of Deno.readDir(directory)) {
          if (entry.isDirectory) {
            const manifestPath = `${directory}/${entry.name}/plugin.json`;
            try {
              await Deno.stat(manifestPath);
              discovered.push(manifestPath);
            } catch {
              // No manifest file
            }
          }
        }
      } catch (error) {
        console.warn(`[Plugins] Cannot scan directory: ${directory}`, error);
      }
    }

    return discovered;
  }

  private async _loadManifest(manifestPath: string): Promise<PluginManifest> {
    try {
      if (typeof Deno !== "undefined") {
        const content = await Deno.readTextFile(manifestPath);
        return JSON.parse(content);
      } else {
        throw new Error("Manifest loading not supported in current environment");
      }
    } catch (error) {
      throw new Error(`Failed to load plugin manifest: ${manifestPath} - ${error}`);
    }
  }

  private _createPluginInstance(manifest: PluginManifest, manifestPath: string): PluginInstance {
    const pluginDir = manifestPath.replace("/plugin.json", "");

    return {
      id: manifest.name,
      manifest,
      path: pluginDir,
      state: PluginState.DISCOVERED,
      dependencies: new Set(Object.keys(manifest.dependencies || {})),
      dependents: new Set(),
      config: { ...manifest.config?.defaults },
      stats: {
        errors: [],
        events: { emitted: 0, received: 0 },
        apiCalls: 0,
      },
    };
  }

  private async _validateDependencies(plugin: PluginInstance): Promise<void> {
    for (const depName of plugin.dependencies) {
      const dep = this.plugins.get(depName);
      if (!dep) {
        this.events.emit("plugin:dependency-missing", { plugin, dependency: depName });
        throw new Error(`Missing dependency: ${depName}`);
      }

      if (dep.state === PluginState.ERROR) {
        throw new Error(`Dependency in error state: ${depName}`);
      }
    }
  }

  private async _loadPluginCode(plugin: PluginInstance): Promise<any> {
    const mainPath = `${plugin.path}/${plugin.manifest.main}`;

    try {
      if (typeof Deno !== "undefined") {
        const module = await import(mainPath);
        return module.default || module;
      } else {
        throw new Error("Plugin code loading not supported in current environment");
      }
    } catch (error) {
      throw new Error(`Failed to load plugin code: ${mainPath} - ${error}`);
    }
  }

  private _createPluginContext(plugin: PluginInstance): PluginContext {
    const api: PluginAPI = {
      getConfig: <T>(key: string, defaultValue?: T): T => {
        return plugin.config[key] !== undefined ? plugin.config[key] : defaultValue;
      },

      setConfig: <T>(key: string, value: T): void => {
        plugin.config[key] = value;
      },

      emit: <T>(type: string, data: T): void => {
        plugin.stats.events.emitted++;
        this.events.emit(`plugin:${plugin.id}:${type}`, data);
      },

      on: <T>(type: string, handler: (data: T) => void): () => void => {
        plugin.stats.events.received++;
        return this.events.on(`plugin:${plugin.id}:${type}`, handler);
      },

      getData: <T>(key: string): T | undefined => {
        return this.fx.proxy(`plugins.${plugin.id}.data.${key}`).val();
      },

      setData: <T>(key: string, value: T): void => {
        this.fx.proxy(`plugins.${plugin.id}.data.${key}`).val(value);
      },

      deleteData: (key: string): boolean => {
        const proxy = this.fx.proxy(`plugins.${plugin.id}.data.${key}`);
        const existed = proxy.val() !== undefined;
        proxy.val(undefined);
        return existed;
      },

      registerCommand: (name: string, handler: Function): void => {
        if (this.commands.has(name)) {
          throw new Error(`Command already registered: ${name}`);
        }
        this.commands.set(name, { handler, plugin: plugin.id });
      },

      executeCommand: async (name: string, args: any[]): Promise<any> => {
        return this.executeCommand(name, args);
      },

      registerView: (name: string, component: any): void => {
        if (this.views.has(name)) {
          throw new Error(`View already registered: ${name}`);
        }
        this.views.set(name, { component, plugin: plugin.id });
      },

      unregisterView: (name: string): void => {
        this.views.delete(name);
      },

      addHook: (name: string, handler: Function): void => {
        if (!this.hooks.has(name)) {
          this.hooks.set(name, []);
        }
        this.hooks.get(name)!.push({ handler, plugin: plugin.id });
      },

      removeHook: (name: string, handler: Function): void => {
        const hookList = this.hooks.get(name);
        if (hookList) {
          const index = hookList.findIndex(h => h.handler === handler);
          if (index >= 0) {
            hookList.splice(index, 1);
          }
        }
      },

      executeHook: async (name: string, ...args: any[]): Promise<any[]> => {
        const hookList = this.hooks.get(name);
        if (!hookList) return [];

        const results = [];
        for (const { handler } of hookList) {
          try {
            const result = await handler(...args);
            results.push(result);
          } catch (error) {
            this._logError(plugin, error as Error, `Hook execution failed: ${name}`);
          }
        }
        return results;
      },
    };

    const logger: PluginLogger = {
      debug: (message: string, ...args: any[]) => this._log(plugin, "debug", message, ...args),
      info: (message: string, ...args: any[]) => this._log(plugin, "info", message, ...args),
      warn: (message: string, ...args: any[]) => this._log(plugin, "warn", message, ...args),
      error: (message: string, ...args: any[]) => this._log(plugin, "error", message, ...args),
    };

    return {
      fx: this.fx,
      events: this.events,
      config: this.config,
      plugin,
      logger,
      api,
    };
  }

  private async _activateDependencies(plugin: PluginInstance): Promise<void> {
    for (const depName of plugin.dependencies) {
      const dep = this.plugins.get(depName);
      if (!dep) continue;

      if (dep.state !== PluginState.ACTIVE) {
        await this.activatePlugin(depName);
      }

      // Add to dependents
      dep.dependents.add(plugin.id);
    }
  }

  private _updateDependencyGraph(plugin: PluginInstance, removing = false): void {
    if (removing) {
      this.dependencyGraph.delete(plugin.id);

      // Remove from dependents
      for (const depName of plugin.dependencies) {
        const dep = this.plugins.get(depName);
        if (dep) {
          dep.dependents.delete(plugin.id);
        }
      }
    } else {
      this.dependencyGraph.set(plugin.id, new Set(plugin.dependencies));
    }
  }

  private _cleanupPluginRegistrations(plugin: PluginInstance): void {
    // Remove commands
    for (const [name, command] of this.commands.entries()) {
      if (command.plugin === plugin.id) {
        this.commands.delete(name);
      }
    }

    // Remove views
    for (const [name, view] of this.views.entries()) {
      if (view.plugin === plugin.id) {
        this.views.delete(name);
      }
    }

    // Remove hooks
    for (const [name, hookList] of this.hooks.entries()) {
      const filtered = hookList.filter(h => h.plugin !== plugin.id);
      if (filtered.length === 0) {
        this.hooks.delete(name);
      } else {
        this.hooks.set(name, filtered);
      }
    }
  }

  private _setupHotReload(plugin: PluginInstance): void {
    if (typeof Deno === "undefined") return;

    try {
      const watcher = Deno.watchFs(plugin.path);
      plugin.hotReloadWatcher = watcher;

      (async () => {
        for await (const event of watcher) {
          if (event.kind === "modify" && event.paths.some(p => p.endsWith(".ts") || p.endsWith(".js"))) {
            this._log(plugin, "info", "Hot reloading plugin due to file changes");

            try {
              await this.deactivatePlugin(plugin.id);
              await this.loadPlugin(`${plugin.path}/plugin.json`);
              await this.activatePlugin(plugin.id);

              this.events.emit("plugin:hot-reload", { plugin });
            } catch (error) {
              this._logError(plugin, error as Error, "Hot reload failed");
            }
          }
        }
      })();
    } catch (error) {
      this._log(plugin, "warn", `Failed to set up hot reload: ${error}`);
    }
  }

  private _cleanupHotReload(plugin: PluginInstance): void {
    if (plugin.hotReloadWatcher) {
      try {
        plugin.hotReloadWatcher.close();
      } catch (error) {
        console.warn(`[Plugins] Failed to close hot reload watcher for ${plugin.id}:`, error);
      }
      plugin.hotReloadWatcher = undefined;
    }
  }

  private _setupEventListeners(): void {
    // Listen for configuration changes
    this.config.watch("plugins.hotReload", (event) => {
      if (event.newValue) {
        this.enableHotReload();
      } else {
        this.disableHotReload();
      }
    });
  }

  private _loadConfiguration(): void {
    this.hotReloadEnabled = this.config.get("plugins.hotReload", false);
    this.sandboxEnabled = this.config.get("plugins.sandbox", false);
  }

  private _log(plugin: PluginInstance | null, level: "debug" | "info" | "warn" | "error", message: string, ...args: any[]): void {
    const prefix = plugin ? `[Plugin:${plugin.id}]` : "[PluginManager]";
    console[level](`${prefix} ${message}`, ...args);
  }

  private _logError(plugin: PluginInstance | null, error: Error, context?: string): void {
    if (plugin) {
      plugin.stats.errors.push({ error, timestamp: new Date() });

      // Limit error history
      if (plugin.stats.errors.length > 10) {
        plugin.stats.errors.splice(0, plugin.stats.errors.length - 10);
      }
    }

    const prefix = plugin ? `[Plugin:${plugin.id}]` : "[PluginManager]";
    console.error(`${prefix} ${context || "Error"}: ${error.message}`, error);
  }
}

/**
 * Factory function to create a plugin manager
 */
export function createPluginManager(
  fx: FXCore,
  events: FXDEventBus,
  config: FXDConfigManager
): FXDPluginManager {
  return new FXDPluginManager(fx, events, config);
}

/**
 * Export types and enums
 */
export type {
  PluginManifest,
  PluginContext,
  PluginAPI,
  PluginLogger,
  PluginInstance,
  PluginManagerEvents,
};