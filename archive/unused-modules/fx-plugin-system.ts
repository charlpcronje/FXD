/**
 * FX Plugin System
 * Extensible plugin architecture for FXD applications
 */

import { FXCore } from '../fx.ts';

// Plugin manifest interface
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  keywords?: string[];
  
  // FXD specific
  fxdVersion: string; // Required FXD version
  permissions: PluginPermission[];
  dependencies?: PluginDependency[];
  
  // Entry points
  main?: string; // Main plugin file
  ui?: string;   // UI component file
  worker?: string; // Background worker
  
  // Plugin configuration
  config?: PluginConfig;
  
  // Lifecycle hooks
  hooks?: {
    install?: string;
    uninstall?: string;
    activate?: string;
    deactivate?: string;
  };
}

export interface PluginPermission {
  type: 'fx-read' | 'fx-write' | 'network' | 'filesystem' | 'ui' | 'websocket';
  scope?: string; // e.g., "snippets.*", "views.main"
  reason: string; // Why this permission is needed
}

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface PluginConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default?: any;
    required?: boolean;
    description?: string;
    options?: any[]; // For select/enum types
  };
}

// Plugin runtime interface
export interface Plugin {
  manifest: PluginManifest;
  instance?: PluginInstance;
  status: PluginStatus;
  loadedAt?: number;
  error?: string;
  config: Record<string, any>;
}

export interface PluginInstance {
  activate?(context: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
  onFXChange?(path: string, value: any): void;
  onUIEvent?(event: string, data: any): void;
  
  // Plugin-specific methods will be added dynamically
  [key: string]: any;
}

export interface PluginContext {
  fx: typeof FXCore;
  pluginId: string;
  config: Record<string, any>;
  logger: PluginLogger;
  ui: PluginUI;
  storage: PluginStorage;
  events: PluginEvents;
  http: PluginHTTP;
}

export enum PluginStatus {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

// Plugin services
export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface PluginUI {
  addMenuItem(item: MenuItem): void;
  removeMenuItem(id: string): void;
  addToolbarButton(button: ToolbarButton): void;
  addSidebarPanel(panel: SidebarPanel): void;
  showNotification(notification: Notification): void;
  createDialog(dialog: Dialog): Promise<any>;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

export interface PluginEvents {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, data?: any): void;
}

export interface PluginHTTP {
  get(url: string, options?: RequestOptions): Promise<Response>;
  post(url: string, data?: any, options?: RequestOptions): Promise<Response>;
  put(url: string, data?: any, options?: RequestOptions): Promise<Response>;
  delete(url: string, options?: RequestOptions): Promise<Response>;
}

// UI extension interfaces
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  submenu?: MenuItem[];
}

export interface ToolbarButton {
  id: string;
  icon: string;
  tooltip: string;
  onClick: () => void;
}

export interface SidebarPanel {
  id: string;
  title: string;
  icon?: string;
  component: string; // HTML component
}

export interface Notification {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export interface Dialog {
  title: string;
  content: string;
  buttons: Array<{
    label: string;
    value: any;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

// Main plugin manager
export class FXPluginManager {
  private plugins = new Map<string, Plugin>();
  private pluginDirectories: string[] = [];
  private eventBus = new EventTarget();
  
  constructor(private fx: typeof FXCore) {
    this.setupDefaultDirectories();
  }
  
  private setupDefaultDirectories(): void {
    this.pluginDirectories = [
      './plugins',
      './plugins/community',
      './plugins/system'
    ];
  }
  
  // Plugin discovery and loading
  async discoverPlugins(): Promise<string[]> {
    const discovered: string[] = [];
    
    for (const dir of this.pluginDirectories) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          if (entry.isDirectory) {
            const manifestPath = `${dir}/${entry.name}/plugin.json`;
            try {
              await Deno.stat(manifestPath);
              discovered.push(`${dir}/${entry.name}`);
            } catch {
              // No manifest file, skip
            }
          }
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }
    
    return discovered;
  }
  
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Read manifest
      const manifestPath = `${pluginPath}/plugin.json`;
      const manifestContent = await Deno.readTextFile(manifestPath);
      const manifest: PluginManifest = JSON.parse(manifestContent);
      
      // Validate manifest
      this.validateManifest(manifest);
      
      // Check if already loaded
      if (this.plugins.has(manifest.name)) {
        throw new Error(`Plugin ${manifest.name} is already loaded`);
      }
      
      // Create plugin entry
      const plugin: Plugin = {
        manifest,
        status: PluginStatus.LOADING,
        config: this.getPluginConfig(manifest)
      };
      
      this.plugins.set(manifest.name, plugin);
      
      // Load plugin code
      if (manifest.main) {
        const mainPath = `${pluginPath}/${manifest.main}`;
        const module = await import(`file://${Deno.cwd()}/${mainPath}`);
        
        // Create plugin instance
        const PluginClass = module.default || module[manifest.name];
        if (PluginClass) {
          plugin.instance = new PluginClass();
          plugin.status = PluginStatus.LOADED;
          plugin.loadedAt = Date.now();
          
          this.emitEvent('plugin-loaded', { name: manifest.name, plugin });
          
        } else {
          throw new Error('Plugin main file must export a default class or named class');
        }
      }
      
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      
      // Update plugin status
      const plugin = this.plugins.get('unknown');
      if (plugin) {
        plugin.status = PluginStatus.ERROR;
        plugin.error = error.message;
      }
      
      throw error;
    }
  }
  
  async activatePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    if (plugin.status !== PluginStatus.LOADED) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }
    
    try {
      // Check dependencies
      await this.checkDependencies(plugin.manifest);
      
      // Create plugin context
      const context = this.createPluginContext(pluginName);
      
      // Activate plugin
      if (plugin.instance?.activate) {
        await plugin.instance.activate(context);
      }
      
      // Setup FX watchers if plugin has onFXChange
      if (plugin.instance?.onFXChange) {
        const permissions = plugin.manifest.permissions.filter(p => 
          p.type === 'fx-read' || p.type === 'fx-write'
        );
        
        for (const permission of permissions) {
          const scope = permission.scope || '**';
          this.fx.watch(scope, (value: any, path: string) => {
            plugin.instance!.onFXChange!(path, value);
          });
        }
      }
      
      plugin.status = PluginStatus.ACTIVE;
      this.emitEvent('plugin-activated', { name: pluginName, plugin });
      
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = error.message;
      throw error;
    }
  }
  
  async deactivatePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    
    if (plugin.status !== PluginStatus.ACTIVE) {
      return; // Already inactive
    }
    
    try {
      if (plugin.instance?.deactivate) {
        await plugin.instance.deactivate();
      }
      
      plugin.status = PluginStatus.LOADED;
      this.emitEvent('plugin-deactivated', { name: pluginName, plugin });
      
    } catch (error) {
      console.error(`Error deactivating plugin ${pluginName}:`, error);
      throw error;
    }
  }
  
  unloadPlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;
    
    // Deactivate first if active
    if (plugin.status === PluginStatus.ACTIVE) {
      this.deactivatePlugin(pluginName).catch(console.error);
    }
    
    this.plugins.delete(pluginName);
    this.emitEvent('plugin-unloaded', { name: pluginName, plugin });
  }
  
  // Plugin context creation
  private createPluginContext(pluginName: string): PluginContext {
    const plugin = this.plugins.get(pluginName)!;
    
    return {
      fx: this.createScopedFX(plugin.manifest.permissions),
      pluginId: pluginName,
      config: plugin.config,
      logger: this.createLogger(pluginName),
      ui: this.createUI(pluginName),
      storage: this.createStorage(pluginName),
      events: this.createEvents(pluginName),
      http: this.createHTTP(plugin.manifest.permissions)
    };
  }
  
  private createScopedFX(permissions: PluginPermission[]) {
    // Create a scoped FX instance that respects permissions
    const scopedFX = (path: string) => {
      // Check permissions
      const canRead = permissions.some(p => 
        p.type === 'fx-read' && this.matchesScope(path, p.scope)
      );
      const canWrite = permissions.some(p => 
        p.type === 'fx-write' && this.matchesScope(path, p.scope)
      );
      
      const node = this.fx(path);
      
      return {
        val: (value?: any) => {
          if (value !== undefined) {
            if (!canWrite) {
              throw new Error(`Plugin doesn't have write permission for ${path}`);
            }
            return node.val(value);
          } else {
            if (!canRead) {
              throw new Error(`Plugin doesn't have read permission for ${path}`);
            }
            return node.val();
          }
        },
        watch: canRead ? node.watch.bind(node) : () => {
          throw new Error(`Plugin doesn't have read permission for ${path}`);
        },
        // Add other FX methods as needed
      };
    };
    
    // Copy static methods
    Object.assign(scopedFX, {
      watch: this.fx.watch.bind(this.fx)
    });
    
    return scopedFX;
  }
  
  private createLogger(pluginName: string): PluginLogger {
    const prefix = `[Plugin:${pluginName}]`;
    
    return {
      debug: (message: string, ...args: any[]) => console.debug(prefix, message, ...args),
      info: (message: string, ...args: any[]) => console.info(prefix, message, ...args),
      warn: (message: string, ...args: any[]) => console.warn(prefix, message, ...args),
      error: (message: string, ...args: any[]) => console.error(prefix, message, ...args)
    };
  }
  
  private createUI(pluginName: string): PluginUI {
    return {
      addMenuItem: (item: MenuItem) => {
        this.emitEvent('ui-add-menu-item', { pluginName, item });
      },
      removeMenuItem: (id: string) => {
        this.emitEvent('ui-remove-menu-item', { pluginName, id });
      },
      addToolbarButton: (button: ToolbarButton) => {
        this.emitEvent('ui-add-toolbar-button', { pluginName, button });
      },
      addSidebarPanel: (panel: SidebarPanel) => {
        this.emitEvent('ui-add-sidebar-panel', { pluginName, panel });
      },
      showNotification: (notification: Notification) => {
        this.emitEvent('ui-show-notification', { pluginName, notification });
      },
      createDialog: (dialog: Dialog) => {
        return new Promise((resolve) => {
          this.emitEvent('ui-create-dialog', { pluginName, dialog, resolve });
        });
      }
    };
  }
  
  private createStorage(pluginName: string): PluginStorage {
    const storageKey = `plugin-${pluginName}`;
    
    return {
      get: async (key: string) => {
        const data = await this.fx(`storage.${storageKey}.${key}`).val();
        return data;
      },
      set: async (key: string, value: any) => {
        this.fx(`storage.${storageKey}.${key}`).val(value);
      },
      delete: async (key: string) => {
        this.fx(`storage.${storageKey}`).val(undefined);
      },
      list: async () => {
        const storage = await this.fx(`storage.${storageKey}`).val() || {};
        return Object.keys(storage);
      },
      clear: async () => {
        this.fx(`storage.${storageKey}`).val({});
      }
    };
  }
  
  private createEvents(pluginName: string): PluginEvents {
    const eventMap = new Map<string, Function[]>();
    
    return {
      on: (event: string, handler: Function) => {
        if (!eventMap.has(event)) {
          eventMap.set(event, []);
        }
        eventMap.get(event)!.push(handler);
      },
      off: (event: string, handler: Function) => {
        const handlers = eventMap.get(event);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      },
      emit: (event: string, data?: any) => {
        const handlers = eventMap.get(event) || [];
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in plugin ${pluginName} event handler:`, error);
          }
        });
      }
    };
  }
  
  private createHTTP(permissions: PluginPermission[]): PluginHTTP {
    const hasNetworkPermission = permissions.some(p => p.type === 'network');
    
    const makeRequest = async (method: string, url: string, data?: any, options?: RequestOptions) => {
      if (!hasNetworkPermission) {
        throw new Error('Plugin doesn\'t have network permission');
      }
      
      const fetchOptions: RequestInit = {
        method,
        headers: options?.headers,
      };
      
      if (data && method !== 'GET') {
        fetchOptions.body = JSON.stringify(data);
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json'
        };
      }
      
      return fetch(url, fetchOptions);
    };
    
    return {
      get: (url: string, options?: RequestOptions) => makeRequest('GET', url, undefined, options),
      post: (url: string, data?: any, options?: RequestOptions) => makeRequest('POST', url, data, options),
      put: (url: string, data?: any, options?: RequestOptions) => makeRequest('PUT', url, data, options),
      delete: (url: string, options?: RequestOptions) => makeRequest('DELETE', url, undefined, options)
    };
  }
  
  // Utility methods
  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name) throw new Error('Plugin manifest must have a name');
    if (!manifest.version) throw new Error('Plugin manifest must have a version');
    if (!manifest.fxdVersion) throw new Error('Plugin manifest must specify fxdVersion');
    if (!Array.isArray(manifest.permissions)) throw new Error('Plugin manifest must specify permissions array');
  }
  
  private getPluginConfig(manifest: PluginManifest): Record<string, any> {
    const config: Record<string, any> = {};
    
    if (manifest.config) {
      for (const [key, spec] of Object.entries(manifest.config)) {
        config[key] = spec.default;
      }
    }
    
    return config;
  }
  
  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies) return;
    
    for (const dep of manifest.dependencies) {
      const depPlugin = this.plugins.get(dep.name);
      
      if (!depPlugin && !dep.optional) {
        throw new Error(`Required dependency ${dep.name} not found`);
      }
      
      if (depPlugin && depPlugin.status !== PluginStatus.ACTIVE && !dep.optional) {
        throw new Error(`Required dependency ${dep.name} is not active`);
      }
    }
  }
  
  private matchesScope(path: string, scope?: string): boolean {
    if (!scope || scope === '**') return true;
    
    // Simple glob matching - can be enhanced
    const regex = scope.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(path);
  }
  
  private emitEvent(eventName: string, data: any): void {
    this.eventBus.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
  
  // Public API
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }
  
  getActivePlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.status === PluginStatus.ACTIVE);
  }
  
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  addEventListener(event: string, listener: EventListener): void {
    this.eventBus.addEventListener(event, listener);
  }
  
  removeEventListener(event: string, listener: EventListener): void {
    this.eventBus.removeEventListener(event, listener);
  }
  
  // Plugin marketplace methods
  async installFromMarketplace(pluginId: string): Promise<void> {
    // TODO: Implement marketplace integration
    throw new Error('Marketplace integration not implemented');
  }
  
  async updatePlugin(pluginName: string): Promise<void> {
    // TODO: Implement plugin updates
    throw new Error('Plugin updates not implemented');
  }
}

// Helper function to create plugin manager
export function createPluginManager(fx: typeof FXCore): FXPluginManager {
  return new FXPluginManager(fx);
}

// Plugin base class for easy plugin development
export abstract class BasePlugin implements PluginInstance {
  protected context!: PluginContext;
  
  async activate(context: PluginContext): Promise<void> {
    this.context = context;
    await this.onActivate();
  }
  
  async deactivate(): Promise<void> {
    await this.onDeactivate();
  }
  
  protected abstract onActivate(): Promise<void> | void;
  protected abstract onDeactivate(): Promise<void> | void;
  
  // Convenience methods
  protected get fx() { return this.context.fx; }
  protected get config() { return this.context.config; }
  protected get logger() { return this.context.logger; }
  protected get ui() { return this.context.ui; }
  protected get storage() { return this.context.storage; }
  protected get events() { return this.context.events; }
  protected get http() { return this.context.http; }
}