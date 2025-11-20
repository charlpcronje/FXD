/**
 * @file fx-config.ts
 * @description Advanced configuration management system for FXD
 * Provides hierarchical configuration with validation, environment support, and hot reloading
 */

import { FXCore } from "../fx.ts";

/**
 * Configuration source types
 */
export type ConfigSource = "default" | "file" | "environment" | "runtime" | "override";

/**
 * Configuration value with metadata
 */
export interface ConfigValue<T = any> {
  value: T;
  source: ConfigSource;
  timestamp: Date;
  description?: string;
  validation?: (value: T) => boolean | string;
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "object" | "array";
    default: any;
    required?: boolean;
    description?: string;
    validation?: (value: any) => boolean | string;
    env?: string; // Environment variable name
    sensitive?: boolean; // Hide value in logs
  };
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  source: ConfigSource;
  timestamp: Date;
}

/**
 * Advanced configuration management system
 */
export class FXDConfigManager {
  private fx: FXCore;
  private schema: ConfigSchema = {};
  private values = new Map<string, ConfigValue>();
  private watchers = new Map<string, Set<(event: ConfigChangeEvent) => void>>();
  private globalWatchers = new Set<(event: ConfigChangeEvent) => void>();
  private validationErrors = new Map<string, string>();

  // File watching for hot reload
  private fileWatchers = new Map<string, any>();
  private configFiles = new Set<string>();

  constructor(fx: FXCore) {
    this.fx = fx;
    this._initializeDefaultSchema();
  }

  /**
   * Define configuration schema
   */
  defineSchema(schema: ConfigSchema): void {
    // Merge with existing schema
    this.schema = { ...this.schema, ...schema };

    // Validate existing values against new schema
    this._validateAllValues();

    // Load environment variables for new schema entries
    this._loadEnvironmentVariables();
  }

  /**
   * Set configuration value
   */
  set<T = any>(key: string, value: T, source: ConfigSource = "runtime"): boolean {
    const oldConfigValue = this.values.get(key);
    const oldValue = oldConfigValue?.value;

    // Validate value against schema
    const validationResult = this._validateValue(key, value);
    if (validationResult !== true) {
      this.validationErrors.set(key, validationResult);
      console.warn(`[Config] Validation failed for key '${key}': ${validationResult}`);
      return false;
    }

    // Clear any previous validation errors
    this.validationErrors.delete(key);

    // Create new config value
    const configValue: ConfigValue<T> = {
      value,
      source,
      timestamp: new Date(),
      description: this.schema[key]?.description,
      validation: this.schema[key]?.validation,
    };

    this.values.set(key, configValue);

    // Update FX tree
    this._syncToFX(key, value);

    // Emit change event
    const changeEvent: ConfigChangeEvent = {
      key,
      oldValue,
      newValue: value,
      source,
      timestamp: configValue.timestamp,
    };

    this._emitChange(changeEvent);

    return true;
  }

  /**
   * Get configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T {
    const configValue = this.values.get(key);

    if (configValue) {
      return configValue.value as T;
    }

    // Check schema for default value
    const schemaEntry = this.schema[key];
    if (schemaEntry) {
      return schemaEntry.default as T;
    }

    return defaultValue as T;
  }

  /**
   * Get configuration value with metadata
   */
  getWithMetadata<T = any>(key: string): ConfigValue<T> | undefined {
    return this.values.get(key) as ConfigValue<T>;
  }

  /**
   * Check if configuration key exists
   */
  has(key: string): boolean {
    return this.values.has(key) || key in this.schema;
  }

  /**
   * Delete configuration value (revert to default)
   */
  delete(key: string): boolean {
    const existed = this.values.has(key);
    this.values.delete(key);

    if (existed) {
      // Update FX tree with default value
      const defaultValue = this.schema[key]?.default;
      if (defaultValue !== undefined) {
        this._syncToFX(key, defaultValue);
      }

      // Emit change event
      this._emitChange({
        key,
        oldValue: this.values.get(key)?.value,
        newValue: defaultValue,
        source: "default",
        timestamp: new Date(),
      });
    }

    return existed;
  }

  /**
   * Get all configuration keys
   */
  keys(): string[] {
    const allKeys = new Set<string>();

    // Add keys from values
    for (const key of this.values.keys()) {
      allKeys.add(key);
    }

    // Add keys from schema
    for (const key of Object.keys(this.schema)) {
      allKeys.add(key);
    }

    return Array.from(allKeys).sort();
  }

  /**
   * Get all configuration as plain object
   */
  getAll(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key of this.keys()) {
      result[key] = this.get(key);
    }

    return result;
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string, source: ConfigSource = "file"): Promise<void> {
    try {
      // For Deno environment
      if (typeof Deno !== "undefined") {
        const fileContent = await Deno.readTextFile(filePath);
        const config = JSON.parse(fileContent);
        this._loadFromObject(config, source);
        this.configFiles.add(filePath);

        // Set up file watching for hot reload
        this._watchFile(filePath);
      } else {
        console.warn("[Config] File loading not supported in current environment");
      }
    } catch (error) {
      console.error(`[Config] Failed to load config from file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async saveToFile(filePath: string, includeDefaults = false): Promise<void> {
    try {
      const config: Record<string, any> = {};

      for (const key of this.keys()) {
        const configValue = this.values.get(key);
        const schemaEntry = this.schema[key];

        // Skip sensitive values
        if (schemaEntry?.sensitive) {
          config[key] = "[REDACTED]";
          continue;
        }

        // Include only non-default values unless includeDefaults is true
        if (configValue && (includeDefaults || configValue.source !== "default")) {
          config[key] = configValue.value;
        }
      }

      const content = JSON.stringify(config, null, 2);

      if (typeof Deno !== "undefined") {
        await Deno.writeTextFile(filePath, content);
      } else {
        console.warn("[Config] File saving not supported in current environment");
      }
    } catch (error) {
      console.error(`[Config] Failed to save config to file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment(): void {
    this._loadEnvironmentVariables();
  }

  /**
   * Watch configuration key for changes
   */
  watch(key: string, callback: (event: ConfigChangeEvent) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }

    this.watchers.get(key)!.add(callback);

    // Return unwatch function
    return () => {
      this.watchers.get(key)?.delete(callback);
    };
  }

  /**
   * Watch all configuration changes
   */
  watchAll(callback: (event: ConfigChangeEvent) => void): () => void {
    this.globalWatchers.add(callback);

    // Return unwatch function
    return () => {
      this.globalWatchers.delete(callback);
    };
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): Record<string, string> {
    return Object.fromEntries(this.validationErrors);
  }

  /**
   * Validate all configuration values
   */
  validate(): { isValid: boolean; errors: Record<string, string> } {
    this._validateAllValues();

    return {
      isValid: this.validationErrors.size === 0,
      errors: this.getValidationErrors(),
    };
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    const keys = Array.from(this.values.keys());

    for (const key of keys) {
      this.delete(key);
    }

    this.validationErrors.clear();
  }

  /**
   * Export configuration for debugging
   */
  export(): {
    schema: ConfigSchema;
    values: Record<string, ConfigValue>;
    errors: Record<string, string>;
    files: string[];
  } {
    return {
      schema: this.schema,
      values: Object.fromEntries(this.values),
      errors: this.getValidationErrors(),
      files: Array.from(this.configFiles),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Stop file watchers
    for (const watcher of this.fileWatchers.values()) {
      if (watcher && typeof watcher.close === "function") {
        watcher.close();
      }
    }

    this.fileWatchers.clear();
    this.watchers.clear();
    this.globalWatchers.clear();
  }

  // Private methods

  private _initializeDefaultSchema(): void {
    this.defineSchema({
      "app.name": {
        type: "string",
        default: "FXD Application",
        description: "Application name",
        env: "FXD_APP_NAME",
      },

      "app.version": {
        type: "string",
        default: "1.0.0",
        description: "Application version",
      },

      "app.environment": {
        type: "string",
        default: "development",
        description: "Application environment",
        env: "NODE_ENV",
        validation: (value) => ["development", "production", "test"].includes(value) || "Must be development, production, or test",
      },

      "server.port": {
        type: "number",
        default: 4400,
        description: "HTTP server port",
        env: "PORT",
        validation: (value) => (Number.isInteger(value) && value > 0 && value < 65536) || "Must be a valid port number",
      },

      "server.host": {
        type: "string",
        default: "localhost",
        description: "HTTP server host",
        env: "HOST",
      },

      "logging.level": {
        type: "string",
        default: "info",
        description: "Logging level",
        env: "LOG_LEVEL",
        validation: (value) => ["debug", "info", "warn", "error"].includes(value) || "Must be debug, info, warn, or error",
      },

      "database.path": {
        type: "string",
        default: "./fxd-data/database.sqlite",
        description: "SQLite database file path",
        env: "DATABASE_PATH",
      },

      "security.secretKey": {
        type: "string",
        default: "",
        description: "Secret key for encryption",
        env: "SECRET_KEY",
        sensitive: true,
        required: false,
      },
    });
  }

  private _loadEnvironmentVariables(): void {
    for (const [key, schemaEntry] of Object.entries(this.schema)) {
      if (!schemaEntry.env) continue;

      const envValue = this._getEnvVar(schemaEntry.env);
      if (envValue === undefined) continue;

      const parsedValue = this._parseEnvValue(envValue, schemaEntry.type);
      this.set(key, parsedValue, "environment");
    }
  }

  private _getEnvVar(name: string): string | undefined {
    // Deno environment
    if (typeof Deno !== "undefined") {
      return Deno.env.get(name);
    }

    // Node.js environment
    if (typeof process !== "undefined" && process.env) {
      return process.env[name];
    }

    return undefined;
  }

  private _parseEnvValue(value: string, type: string): any {
    switch (type) {
      case "number":
        const num = Number(value);
        return isNaN(num) ? value : num;

      case "boolean":
        return value.toLowerCase() === "true" || value === "1";

      case "array":
        try {
          return JSON.parse(value);
        } catch {
          return value.split(",").map(s => s.trim());
        }

      case "object":
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }

      default:
        return value;
    }
  }

  private _validateValue(key: string, value: any): boolean | string {
    const schemaEntry = this.schema[key];
    if (!schemaEntry) {
      return true; // No schema means no validation
    }

    // Type validation
    const expectedType = schemaEntry.type;
    const actualType = Array.isArray(value) ? "array" : typeof value;

    if (actualType !== expectedType) {
      return `Expected ${expectedType}, got ${actualType}`;
    }

    // Custom validation
    if (schemaEntry.validation) {
      const result = schemaEntry.validation(value);
      if (result !== true) {
        return typeof result === "string" ? result : "Validation failed";
      }
    }

    return true;
  }

  private _validateAllValues(): void {
    this.validationErrors.clear();

    for (const [key, configValue] of this.values) {
      const result = this._validateValue(key, configValue.value);
      if (result !== true) {
        this.validationErrors.set(key, result);
      }
    }
  }

  private _syncToFX(key: string, value: any): void {
    // Sync configuration to FX tree under config namespace
    const fxPath = `config.${key}`;
    this.fx.proxy(fxPath).val(value);
  }

  private _loadFromObject(config: Record<string, any>, source: ConfigSource): void {
    for (const [key, value] of Object.entries(config)) {
      this.set(key, value, source);
    }
  }

  private _emitChange(event: ConfigChangeEvent): void {
    // Emit to specific key watchers
    const keyWatchers = this.watchers.get(event.key);
    if (keyWatchers) {
      for (const callback of keyWatchers) {
        try {
          callback(event);
        } catch (error) {
          console.error("[Config] Error in config watcher:", error);
        }
      }
    }

    // Emit to global watchers
    for (const callback of this.globalWatchers) {
      try {
        callback(event);
      } catch (error) {
        console.error("[Config] Error in global config watcher:", error);
      }
    }
  }

  private _watchFile(filePath: string): void {
    if (this.fileWatchers.has(filePath)) {
      return; // Already watching
    }

    try {
      if (typeof Deno !== "undefined") {
        const watcher = Deno.watchFs(filePath);
        this.fileWatchers.set(filePath, watcher);

        // Watch for file changes
        (async () => {
          for await (const event of watcher) {
            if (event.kind === "modify") {
              try {
                console.log(`[Config] Reloading config file: ${filePath}`);
                await this.loadFromFile(filePath);
              } catch (error) {
                console.error(`[Config] Failed to reload config file: ${filePath}`, error);
              }
            }
          }
        })();
      }
    } catch (error) {
      console.warn(`[Config] Failed to watch file: ${filePath}`, error);
    }
  }
}

/**
 * Factory function to create a configuration manager
 */
export function createConfigManager(fx: FXCore): FXDConfigManager {
  return new FXDConfigManager(fx);
}

/**
 * Export types
 */
export type { ConfigValue, ConfigSchema, ConfigChangeEvent, ConfigSource };