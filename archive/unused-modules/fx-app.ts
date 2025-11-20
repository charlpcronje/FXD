/**
 * @file fx-app.ts
 * @description Main FXD Application class - central coordinator for all FXD operations
 * Integrates all modules and provides a unified application interface
 */

import { FXCore } from "../fx.ts";
import { FXDPersistenceSystem, createFXDPersistenceSystem } from "./fx-persistence-integration.ts";
import { FXDEventBus, createEventBus } from "./fx-events.ts";
import { FXDConfigManager, createConfigManager } from "./fx-config.ts";
import { FXDPluginManager, createPluginManager } from "./fx-plugins.ts";
import { startHttpServer } from "../server/http.ts";

/**
 * Application lifecycle state
 */
export type FXDAppState =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "running"
  | "shutting-down"
  | "shutdown"
  | "error";

/**
 * FXD Application configuration options
 */
export interface FXDAppConfig {
  // Core settings
  name?: string;
  version?: string;
  dataDirectory?: string;

  // Server settings
  server?: {
    enabled?: boolean;
    port?: number;
    host?: string;
    autoStart?: boolean;
  };

  // Persistence settings
  persistence?: {
    enabled?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
    createBackups?: boolean;
  };

  // Plugin settings
  plugins?: {
    enabled?: boolean;
    autoLoad?: boolean;
    directories?: string[];
  };

  // Logging settings
  logging?: {
    level?: "debug" | "info" | "warn" | "error";
    enabled?: boolean;
    file?: string;
  };

  // Development settings
  development?: {
    enabled?: boolean;
    hotReload?: boolean;
    debug?: boolean;
  };
}

/**
 * Default application configuration
 */
const DEFAULT_CONFIG: Required<FXDAppConfig> = {
  name: "FXD Application",
  version: "1.0.0",
  dataDirectory: "./fxd-data",

  server: {
    enabled: true,
    port: 4400,
    host: "localhost",
    autoStart: true,
  },

  persistence: {
    enabled: true,
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    createBackups: true,
  },

  plugins: {
    enabled: true,
    autoLoad: true,
    directories: ["./plugins", "./modules"],
  },

  logging: {
    level: "info",
    enabled: true,
    file: "",
  },

  development: {
    enabled: false,
    hotReload: false,
    debug: false,
  },
};

/**
 * Application events interface
 */
export interface FXDAppEvents {
  'state-change': { from: FXDAppState; to: FXDAppState };
  'error': { error: Error; context?: string };
  'ready': { app: FXDApp };
  'shutdown': { app: FXDApp };
  'config-change': { key: string; value: any; oldValue: any };
  'module-loaded': { name: string; module: any };
  'module-unloaded': { name: string };
}

/**
 * Module registration interface
 */
export interface FXDModule {
  name: string;
  version?: string;
  dependencies?: string[];
  initialize?: (app: FXDApp) => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  health?: () => Promise<boolean> | boolean;
}

/**
 * Main FXD Application class
 * Central coordinator that integrates all FXD components into a cohesive application
 */
export class FXDApp {
  // Core components
  public fx: FXCore;
  public persistence: FXDPersistenceSystem;
  public events: FXDEventBus;
  public config: FXDConfigManager;
  public plugins: FXDPluginManager;

  // Application state
  private _state: FXDAppState = "uninitialized";
  private _config: Required<FXDAppConfig>;
  private _startTime?: Date;
  private _httpServer: any;

  // Module management
  private _modules = new Map<string, FXDModule>();
  private _moduleInstances = new Map<string, any>();
  private _dependencyGraph = new Map<string, Set<string>>();

  // Event handling
  private _eventListeners = new Map<keyof FXDAppEvents, Set<Function>>();

  // Timers and intervals
  private _autoSaveTimer?: any;
  private _healthCheckTimer?: any;

  // Error tracking
  private _errors: Array<{ timestamp: Date; error: Error; context?: string }> = [];

  constructor(config: Partial<FXDAppConfig> = {}) {
    // Initialize FX Core
    this.fx = new FXCore();

    // Merge configuration with defaults
    this._config = this._mergeConfig(config);

    // Initialize core systems
    this.events = createEventBus(this.fx);
    this.config = createConfigManager(this.fx);
    this.persistence = createFXDPersistenceSystem(this.fx);
    this.plugins = createPluginManager(this.fx, this.events, this.config);

    // Load configuration from merged config
    this._loadInitialConfiguration();

    // Store app reference in FX system
    this.fx.proxy("system.app").val(this);

    // Set up inter-system communication
    this._setupSystemIntegration();

    this._log("info", "FXD Application initialized", { config: this._config });
  }

  /**
   * Get current application state
   */
  get state(): FXDAppState {
    return this._state;
  }

  /**
   * Get application configuration
   */
  get config(): Readonly<Required<FXDAppConfig>> {
    return { ...this._config };
  }

  /**
   * Get application uptime in milliseconds
   */
  get uptime(): number {
    return this._startTime ? Date.now() - this._startTime.getTime() : 0;
  }

  /**
   * Get health status of the application
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    uptime: number;
    state: FXDAppState;
    modules: Record<string, boolean>;
    errors: number;
    lastError?: { timestamp: Date; message: string };
  }> {
    const moduleHealths: Record<string, boolean> = {};

    // Check health of all registered modules
    for (const [name, module] of this._modules) {
      try {
        moduleHealths[name] = module.health ? await Promise.resolve(module.health()) : true;
      } catch (error) {
        moduleHealths[name] = false;
        this._logError(error as Error, `Health check failed for module: ${name}`);
      }
    }

    const allModulesHealthy = Object.values(moduleHealths).every(Boolean);
    const lastError = this._errors.length > 0 ? this._errors[this._errors.length - 1] : undefined;

    return {
      healthy: allModulesHealthy && this._state === "running",
      uptime: this.uptime,
      state: this._state,
      modules: moduleHealths,
      errors: this._errors.length,
      lastError: lastError ? {
        timestamp: lastError.timestamp,
        message: lastError.error.message
      } : undefined,
    };
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this._state !== "uninitialized") {
      throw new Error(`Cannot initialize app in state: ${this._state}`);
    }

    try {
      this._setState("initializing");
      this._log("info", "Initializing FXD Application...");

      // Initialize persistence system if enabled
      if (this._config.persistence.enabled) {
        await this.persistence.initialize();
        this._log("info", "Persistence system initialized");
        this.events.emit("persistence:load", { source: "initialization", success: true });
      }

      // Discover and load plugins if enabled
      if (this._config.plugins.enabled && this._config.plugins.autoLoad) {
        await this._discoverAndLoadPlugins();
      }

      // Initialize registered modules
      await this._initializeModules();

      this._setState("ready");
      this._log("info", "FXD Application initialized successfully");
      this.events.emit("app:ready", { app: this });

    } catch (error) {
      this._setState("error");
      this._logError(error as Error, "Application initialization failed");
      this.events.emit("app:error", { error: error as Error, context: "initialization" });
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this._state !== "ready") {
      throw new Error(`Cannot start app in state: ${this._state}. Must be in 'ready' state.`);
    }

    try {
      this._log("info", "Starting FXD Application...");
      this._startTime = new Date();

      // Start HTTP server if enabled
      if (this._config.server.enabled && this._config.server.autoStart) {
        await this._startHttpServer();
      }

      // Start auto-save timer if enabled
      if (this._config.persistence.enabled && this._config.persistence.autoSave) {
        this._startAutoSave();
      }

      // Start health monitoring
      this._startHealthMonitoring();

      this._setState("running");
      this._emit("ready", { app: this });
      this._log("info", `FXD Application started successfully on port ${this._config.server.port}`);

    } catch (error) {
      this._setState("error");
      this._logError(error as Error, "Application startup failed");
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async shutdown(): Promise<void> {
    if (this._state === "shutdown" || this._state === "shutting-down") {
      this._log("warn", "Application already shutting down or shutdown");
      return;
    }

    try {
      this._setState("shutting-down");
      this._log("info", "Shutting down FXD Application...");

      // Stop timers
      if (this._autoSaveTimer) {
        clearInterval(this._autoSaveTimer);
        this._autoSaveTimer = undefined;
      }
      if (this._healthCheckTimer) {
        clearInterval(this._healthCheckTimer);
        this._healthCheckTimer = undefined;
      }

      // Perform final save if persistence is enabled
      if (this._config.persistence.enabled) {
        try {
          await this.persistence.saveProject({ createBackup: true });
          this._log("info", "Final save completed");
        } catch (error) {
          this._logError(error as Error, "Final save failed");
        }
      }

      // Cleanup plugins first (in reverse order)
      if (this._config.plugins.enabled) {
        await this.plugins.cleanup();
        this._log("info", "Plugins cleanup completed");
      }

      // Cleanup modules in reverse dependency order
      await this._cleanupModules();

      // Close persistence system
      if (this._config.persistence.enabled) {
        await this.persistence.cleanup();
        this._log("info", "Persistence system cleanup completed");
      }

      // Cleanup configuration manager
      this.config.cleanup();
      this._log("info", "Configuration manager cleanup completed");

      // Stop HTTP server
      if (this._httpServer) {
        await this._httpServer.shutdown?.();
        this._log("info", "HTTP server stopped");
      }

      // Cleanup event bus (this should be last as other systems may emit final events)
      this.events.cleanup();
      this._log("info", "Event bus cleanup completed");

      this._setState("shutdown");
      this._emit("shutdown", { app: this });
      this._log("info", "FXD Application shutdown completed");

    } catch (error) {
      this._setState("error");
      this._logError(error as Error, "Shutdown failed");
      throw error;
    }
  }

  /**
   * Register a module with the application
   */
  registerModule(module: FXDModule): void {
    if (this._modules.has(module.name)) {
      throw new Error(`Module '${module.name}' is already registered`);
    }

    this._log("info", `Registering module: ${module.name}`);
    this._modules.set(module.name, module);

    // Build dependency graph
    if (module.dependencies) {
      this._dependencyGraph.set(module.name, new Set(module.dependencies));
    } else {
      this._dependencyGraph.set(module.name, new Set());
    }
  }

  /**
   * Unregister a module
   */
  async unregisterModule(name: string): Promise<void> {
    const module = this._modules.get(name);
    if (!module) {
      this._log("warn", `Module '${name}' not found for unregistration`);
      return;
    }

    // Check if other modules depend on this one
    const dependents = Array.from(this._dependencyGraph.entries())
      .filter(([_, deps]) => deps.has(name))
      .map(([modName]) => modName);

    if (dependents.length > 0) {
      throw new Error(`Cannot unregister module '${name}' - it has dependents: ${dependents.join(', ')}`);
    }

    // Cleanup module if it has cleanup method
    try {
      if (module.cleanup) {
        await Promise.resolve(module.cleanup());
      }
      this._log("info", `Module '${name}' cleaned up successfully`);
    } catch (error) {
      this._logError(error as Error, `Failed to cleanup module: ${name}`);
    }

    this._modules.delete(name);
    this._moduleInstances.delete(name);
    this._dependencyGraph.delete(name);
    this._emit("module-unloaded", { name });
    this._log("info", `Module '${name}' unregistered`);
  }

  /**
   * Get registered module instance
   */
  getModule<T = any>(name: string): T | undefined {
    return this._moduleInstances.get(name);
  }

  /**
   * Update application configuration
   */
  updateConfig(updates: Partial<FXDAppConfig>): void {
    const oldConfig = { ...this._config };
    this._config = this._mergeConfig(updates, this._config);

    // Emit change events for modified keys
    this._emitConfigChanges(oldConfig, this._config);

    this._log("info", "Configuration updated", { updates });
  }

  /**
   * Add event listener
   */
  on<K extends keyof FXDAppEvents>(event: K, listener: (data: FXDAppEvents[K]) => void): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this._eventListeners.get(event)?.delete(listener);
    };
  }

  /**
   * Remove event listener
   */
  off<K extends keyof FXDAppEvents>(event: K, listener: (data: FXDAppEvents[K]) => void): void {
    this._eventListeners.get(event)?.delete(listener);
  }

  // Private methods

  private _setState(newState: FXDAppState): void {
    const oldState = this._state;
    this._state = newState;
    this._emit("state-change", { from: oldState, to: newState });
    this._log("debug", `State changed: ${oldState} -> ${newState}`);
  }

  private _emit<K extends keyof FXDAppEvents>(event: K, data: FXDAppEvents[K]): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          this._logError(error as Error, `Event listener error for event: ${event}`);
        }
      }
    }
  }

  private _mergeConfig(updates: Partial<FXDAppConfig>, base = DEFAULT_CONFIG): Required<FXDAppConfig> {
    return {
      name: updates.name ?? base.name,
      version: updates.version ?? base.version,
      dataDirectory: updates.dataDirectory ?? base.dataDirectory,

      server: {
        enabled: updates.server?.enabled ?? base.server.enabled,
        port: updates.server?.port ?? base.server.port,
        host: updates.server?.host ?? base.server.host,
        autoStart: updates.server?.autoStart ?? base.server.autoStart,
      },

      persistence: {
        enabled: updates.persistence?.enabled ?? base.persistence.enabled,
        autoSave: updates.persistence?.autoSave ?? base.persistence.autoSave,
        autoSaveInterval: updates.persistence?.autoSaveInterval ?? base.persistence.autoSaveInterval,
        createBackups: updates.persistence?.createBackups ?? base.persistence.createBackups,
      },

      plugins: {
        enabled: updates.plugins?.enabled ?? base.plugins.enabled,
        autoLoad: updates.plugins?.autoLoad ?? base.plugins.autoLoad,
        directories: updates.plugins?.directories ?? base.plugins.directories,
      },

      logging: {
        level: updates.logging?.level ?? base.logging.level,
        enabled: updates.logging?.enabled ?? base.logging.enabled,
        file: updates.logging?.file ?? base.logging.file,
      },

      development: {
        enabled: updates.development?.enabled ?? base.development.enabled,
        hotReload: updates.development?.hotReload ?? base.development.hotReload,
        debug: updates.development?.debug ?? base.development.debug,
      },
    };
  }

  private _emitConfigChanges(oldConfig: Required<FXDAppConfig>, newConfig: Required<FXDAppConfig>): void {
    const checkObject = (obj1: any, obj2: any, prefix = "") => {
      for (const key in obj2) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj2[key] === "object" && obj2[key] !== null && !Array.isArray(obj2[key])) {
          checkObject(obj1[key] || {}, obj2[key], fullKey);
        } else if (obj1[key] !== obj2[key]) {
          this._emit("config-change", { key: fullKey, value: obj2[key], oldValue: obj1[key] });
        }
      }
    };
    checkObject(oldConfig, newConfig);
  }

  private async _discoverAndLoadPlugins(): Promise<void> {
    try {
      this._log("info", "Discovering plugins from directories", {
        directories: this._config.plugins.directories
      });

      const manifestPaths = await this.plugins.discoverPlugins(this._config.plugins.directories);
      this._log("info", `Found ${manifestPaths.length} plugins`);

      // Load discovered plugins
      for (const manifestPath of manifestPaths) {
        try {
          const plugin = await this.plugins.loadPlugin(manifestPath);
          this._log("info", `Plugin loaded: ${plugin.id}`);
        } catch (error) {
          this._log("warn", `Failed to load plugin: ${manifestPath}`, error);
        }
      }

      // Activate loaded plugins
      const loadedPlugins = this.plugins.getPlugins().filter(p => p.state === "loaded");
      for (const plugin of loadedPlugins) {
        try {
          await this.plugins.activatePlugin(plugin.id);
          this._log("info", `Plugin activated: ${plugin.id}`);
        } catch (error) {
          this._log("warn", `Failed to activate plugin: ${plugin.id}`, error);
        }
      }

    } catch (error) {
      this._logError(error as Error, "Plugin discovery and loading failed");
    }
  }

  private _loadInitialConfiguration(): void {
    // Load application configuration into the config manager
    for (const [key, value] of Object.entries(this._flattenConfig(this._config))) {
      this.config.set(key, value, "default");
    }
  }

  private _flattenConfig(obj: any, prefix = ""): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, this._flattenConfig(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    }

    return result;
  }

  private _setupSystemIntegration(): void {
    // Set up event listeners for system coordination

    // Configuration changes should update internal config
    this.config.watchAll((event) => {
      this._log("debug", `Configuration changed: ${event.key}`, {
        oldValue: event.oldValue,
        newValue: event.newValue,
        source: event.source
      });

      // Update internal config if it's a top-level app config
      if (event.key.startsWith("app.") || event.key.startsWith("server.") ||
          event.key.startsWith("persistence.") || event.key.startsWith("plugins.") ||
          event.key.startsWith("logging.") || event.key.startsWith("development.")) {
        this._updateInternalConfigFromKey(event.key, event.newValue);
      }
    });

    // Plugin events
    this.events.on("plugin:error", ({ plugin, error }) => {
      this._logError(error, `Plugin error: ${plugin.id}`);
    });

    this.events.on("plugin:activated", ({ plugin }) => {
      this._log("info", `Plugin activated: ${plugin.id} v${plugin.manifest.version}`);
    });

    this.events.on("plugin:deactivated", ({ plugin }) => {
      this._log("info", `Plugin deactivated: ${plugin.id}`);
    });

    // Health monitoring events
    this.events.on("health:check", ({ healthy, details }) => {
      if (!healthy) {
        this._log("warn", "Health check failed", details);
      }
    });

    // Persistence events
    this.events.on("persistence:save", ({ type, success }) => {
      if (success) {
        this._log("debug", `Persistence save completed: ${type}`);
      } else {
        this._log("warn", `Persistence save failed: ${type}`);
      }
    });
  }

  private _updateInternalConfigFromKey(key: string, value: any): void {
    // Update the internal _config object when configuration changes
    const parts = key.split(".");
    let target: any = this._config;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }

    target[parts[parts.length - 1]] = value;
  }

  private async _initializeModules(): Promise<void> {
    // Resolve dependency order
    const orderedModules = this._resolveDependencyOrder();

    for (const moduleName of orderedModules) {
      const module = this._modules.get(moduleName);
      if (!module) continue;

      try {
        this._log("info", `Initializing module: ${moduleName}`);

        if (module.initialize) {
          const instance = await Promise.resolve(module.initialize(this));
          if (instance) {
            this._moduleInstances.set(moduleName, instance);
          }
        }

        this._emit("module-loaded", { name: moduleName, module });
        this._log("info", `Module '${moduleName}' initialized successfully`);

      } catch (error) {
        this._logError(error as Error, `Failed to initialize module: ${moduleName}`);
        throw error;
      }
    }
  }

  private async _cleanupModules(): Promise<void> {
    // Cleanup in reverse dependency order
    const orderedModules = this._resolveDependencyOrder().reverse();

    for (const moduleName of orderedModules) {
      const module = this._modules.get(moduleName);
      if (!module?.cleanup) continue;

      try {
        this._log("info", `Cleaning up module: ${moduleName}`);
        await Promise.resolve(module.cleanup());
        this._log("info", `Module '${moduleName}' cleaned up successfully`);
      } catch (error) {
        this._logError(error as Error, `Failed to cleanup module: ${moduleName}`);
      }
    }
  }

  private _resolveDependencyOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving module: ${name}`);
      }
      if (visited.has(name)) return;

      visiting.add(name);
      const deps = this._dependencyGraph.get(name) || new Set();

      for (const dep of deps) {
        if (!this._modules.has(dep)) {
          throw new Error(`Module '${name}' depends on unregistered module: ${dep}`);
        }
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const moduleName of this._modules.keys()) {
      visit(moduleName);
    }

    return result;
  }

  private async _startHttpServer(): Promise<void> {
    try {
      this._httpServer = await startHttpServer({
        port: this._config.server.port,
        host: this._config.server.host,
        autoResolver: (filePath) => {
          // Basic file path resolution
          // This can be enhanced based on requirements
          return { viewId: `views.${filePath.replace(/[^a-zA-Z0-9]/g, "_")}`, lang: "js" };
        }
      });
      this._log("info", `HTTP server started on ${this._config.server.host}:${this._config.server.port}`);
    } catch (error) {
      this._logError(error as Error, "Failed to start HTTP server");
      throw error;
    }
  }

  private _startAutoSave(): void {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
    }

    this._autoSaveTimer = setInterval(async () => {
      try {
        await this.persistence.saveProject({
          incremental: true,
          createBackup: this._config.persistence.createBackups
        });
        this._log("debug", "Auto-save completed");
      } catch (error) {
        this._logError(error as Error, "Auto-save failed");
      }
    }, this._config.persistence.autoSaveInterval);

    this._log("info", `Auto-save enabled with interval: ${this._config.persistence.autoSaveInterval}ms`);
  }

  private _startHealthMonitoring(): void {
    // Start periodic health checks every 30 seconds
    this._healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        if (!health.healthy) {
          this._log("warn", "Health check failed", health);
        }
      } catch (error) {
        this._logError(error as Error, "Health check error");
      }
    }, 30000);

    this._log("info", "Health monitoring started");
  }

  private _log(level: "debug" | "info" | "warn" | "error", message: string, data?: any): void {
    if (!this._config.logging.enabled) return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this._config.logging.level];
    const messageLevel = levels[level];

    if (messageLevel < configLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      app: this._config.name,
      message,
      data
    };

    // Console output
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${this._config.name}] ${message}`;
    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }

    // File logging could be implemented here
    if (this._config.logging.file) {
      // TODO: Implement file logging
    }
  }

  private _logError(error: Error, context?: string): void {
    this._errors.push({ timestamp: new Date(), error, context });

    // Keep only last 100 errors to prevent memory leaks
    if (this._errors.length > 100) {
      this._errors.splice(0, this._errors.length - 100);
    }

    this._emit("error", { error, context });
    this._log("error", `${context || "Error"}: ${error.message}`, {
      stack: error.stack,
      context
    });
  }
}

/**
 * Factory function to create and configure an FXD application
 */
export function createFXDApp(config: Partial<FXDAppConfig> = {}): FXDApp {
  return new FXDApp(config);
}

/**
 * Export types for external use
 */
export type { FXDAppConfig, FXDAppState, FXDAppEvents, FXDModule };