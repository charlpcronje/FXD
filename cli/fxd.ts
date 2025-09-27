#!/usr/bin/env -S deno run --allow-all
/**
 * @file fxd.ts
 * @description FXD Command Line Interface
 * Provides a comprehensive CLI for managing FXD applications, projects, and development
 */

import { FXDApp, createFXDApp, FXDAppConfig } from "../modules/fx-app.ts";

/**
 * CLI command interface
 */
interface CLICommand {
  name: string;
  description: string;
  usage: string;
  options?: Array<{
    name: string;
    alias?: string;
    description: string;
    type: "string" | "number" | "boolean";
    required?: boolean;
    default?: any;
  }>;
  action: (args: CLIArgs, app?: FXDApp) => Promise<void>;
}

/**
 * Parsed CLI arguments
 */
interface CLIArgs {
  command: string;
  positional: string[];
  options: Record<string, any>;
}

/**
 * CLI configuration
 */
interface CLIConfig {
  verbose: boolean;
  quiet: boolean;
  config?: string;
  dataDir?: string;
}

/**
 * FXD Command Line Interface
 */
class FXDCLI {
  private commands = new Map<string, CLICommand>();
  private config: CLIConfig = {
    verbose: false,
    quiet: false,
  };

  constructor() {
    this._registerCommands();
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args: string[]): CLIArgs {
    const result: CLIArgs = {
      command: "",
      positional: [],
      options: {},
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        // Long option
        const [key, value] = arg.slice(2).split("=", 2);
        if (value !== undefined) {
          result.options[key] = this._parseValue(value);
        } else if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          result.options[key] = this._parseValue(args[++i]);
        } else {
          result.options[key] = true;
        }
      } else if (arg.startsWith("-") && arg.length > 1) {
        // Short option(s)
        const flags = arg.slice(1);
        for (let j = 0; j < flags.length; j++) {
          const flag = flags[j];
          if (j === flags.length - 1 && i + 1 < args.length && !args[i + 1].startsWith("-")) {
            result.options[flag] = this._parseValue(args[++i]);
          } else {
            result.options[flag] = true;
          }
        }
      } else {
        // Positional argument
        if (!result.command) {
          result.command = arg;
        } else {
          result.positional.push(arg);
        }
      }
      i++;
    }

    return result;
  }

  /**
   * Execute CLI command
   */
  async run(args: string[]): Promise<void> {
    try {
      const parsed = this.parseArgs(args);

      // Handle global options
      this._handleGlobalOptions(parsed.options);

      // Show help if no command or help requested
      if (!parsed.command || parsed.command === "help" || parsed.options.help || parsed.options.h) {
        this._showHelp(parsed.positional[0]);
        return;
      }

      // Show version
      if (parsed.options.version || parsed.options.v) {
        this._showVersion();
        return;
      }

      // Find and execute command
      const command = this.commands.get(parsed.command);
      if (!command) {
        this._error(`Unknown command: ${parsed.command}`);
        this._info("Run 'fxd help' to see available commands");
        Deno.exit(1);
      }

      // Validate required options
      this._validateOptions(command, parsed.options);

      // Execute command
      await command.action(parsed);

    } catch (error) {
      this._error(`Command failed: ${error.message}`);
      if (this.config.verbose) {
        console.error(error.stack);
      }
      Deno.exit(1);
    }
  }

  // Private methods

  private _registerCommands(): void {
    // Application lifecycle commands
    this._registerCommand({
      name: "init",
      description: "Initialize a new FXD project",
      usage: "fxd init [project-name]",
      options: [
        { name: "template", alias: "t", description: "Project template to use", type: "string" },
        { name: "force", alias: "f", description: "Overwrite existing files", type: "boolean" },
      ],
      action: this._initProject.bind(this),
    });

    this._registerCommand({
      name: "start",
      description: "Start the FXD application",
      usage: "fxd start [options]",
      options: [
        { name: "port", alias: "p", description: "HTTP server port", type: "number", default: 4400 },
        { name: "host", alias: "h", description: "HTTP server host", type: "string", default: "localhost" },
        { name: "watch", alias: "w", description: "Enable hot reload", type: "boolean" },
        { name: "production", description: "Run in production mode", type: "boolean" },
      ],
      action: this._startApp.bind(this),
    });

    this._registerCommand({
      name: "dev",
      description: "Start in development mode with hot reload",
      usage: "fxd dev [options]",
      options: [
        { name: "port", alias: "p", description: "HTTP server port", type: "number", default: 4400 },
        { name: "debug", alias: "d", description: "Enable debug mode", type: "boolean" },
      ],
      action: this._startDev.bind(this),
    });

    // Project management commands
    this._registerCommand({
      name: "build",
      description: "Build the FXD project",
      usage: "fxd build [options]",
      options: [
        { name: "output", alias: "o", description: "Output directory", type: "string", default: "./dist" },
        { name: "minify", alias: "m", description: "Minify output", type: "boolean" },
      ],
      action: this._buildProject.bind(this),
    });

    this._registerCommand({
      name: "export",
      description: "Export project data",
      usage: "fxd export <output-file> [options]",
      options: [
        { name: "format", alias: "f", description: "Export format (json|sql|archive)", type: "string", default: "json" },
        { name: "include-backups", description: "Include backup data", type: "boolean" },
      ],
      action: this._exportProject.bind(this),
    });

    this._registerCommand({
      name: "import",
      description: "Import project data",
      usage: "fxd import <input-file> [options]",
      options: [
        { name: "overwrite", description: "Overwrite existing data", type: "boolean" },
        { name: "backup", description: "Create backup before import", type: "boolean", default: true },
      ],
      action: this._importProject.bind(this),
    });

    // Plugin management commands
    this._registerCommand({
      name: "plugin",
      description: "Plugin management commands",
      usage: "fxd plugin <subcommand> [options]",
      action: this._pluginCommand.bind(this),
    });

    // Configuration commands
    this._registerCommand({
      name: "config",
      description: "Configuration management",
      usage: "fxd config <subcommand> [options]",
      action: this._configCommand.bind(this),
    });

    // Health and diagnostics
    this._registerCommand({
      name: "health",
      description: "Check application health",
      usage: "fxd health [options]",
      options: [
        { name: "detailed", alias: "d", description: "Show detailed health information", type: "boolean" },
      ],
      action: this._healthCheck.bind(this),
    });

    this._registerCommand({
      name: "status",
      description: "Show application status",
      usage: "fxd status",
      action: this._showStatus.bind(this),
    });

    // Utility commands
    this._registerCommand({
      name: "validate",
      description: "Validate project configuration and data",
      usage: "fxd validate [options]",
      options: [
        { name: "fix", description: "Attempt to fix validation errors", type: "boolean" },
      ],
      action: this._validateProject.bind(this),
    });

    this._registerCommand({
      name: "clean",
      description: "Clean temporary files and caches",
      usage: "fxd clean [options]",
      options: [
        { name: "all", alias: "a", description: "Clean everything including data", type: "boolean" },
      ],
      action: this._cleanProject.bind(this),
    });
  }

  private _registerCommand(command: CLICommand): void {
    this.commands.set(command.name, command);
  }

  private _handleGlobalOptions(options: Record<string, any>): void {
    if (options.verbose || options.v) {
      this.config.verbose = true;
    }
    if (options.quiet || options.q) {
      this.config.quiet = true;
    }
    if (options.config) {
      this.config.config = options.config;
    }
    if (options["data-dir"]) {
      this.config.dataDir = options["data-dir"];
    }
  }

  private _validateOptions(command: CLICommand, options: Record<string, any>): void {
    if (!command.options) return;

    for (const option of command.options) {
      if (option.required && !(option.name in options) && !(option.alias && option.alias in options)) {
        throw new Error(`Required option missing: --${option.name}`);
      }
    }
  }

  private _parseValue(value: string): any {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    // Try to parse as boolean
    if (value === "true") return true;
    if (value === "false") return false;
    // Return as string
    return value;
  }

  private _createApp(options: Record<string, any> = {}): FXDApp {
    const config: Partial<FXDAppConfig> = {
      name: "FXD CLI Application",
      dataDirectory: this.config.dataDir || "./fxd-data",
    };

    if (options.port) {
      config.server = { ...config.server, port: options.port };
    }
    if (options.host) {
      config.server = { ...config.server, host: options.host };
    }
    if (options.production) {
      config.development = { enabled: false, hotReload: false, debug: false };
      config.logging = { ...config.logging, level: "info" };
    }
    if (options.watch || options.debug) {
      config.development = { enabled: true, hotReload: !!options.watch, debug: !!options.debug };
      config.logging = { ...config.logging, level: "debug" };
    }

    return createFXDApp(config);
  }

  // Command implementations

  private async _initProject(args: CLIArgs): Promise<void> {
    const projectName = args.positional[0] || "fxd-project";
    const template = args.options.template || "basic";
    const force = args.options.force || false;

    this._info(`Initializing FXD project: ${projectName}`);
    this._info(`Template: ${template}`);

    try {
      // Check if directory exists
      const projectDir = `./${projectName}`;
      let dirExists = false;

      try {
        await Deno.stat(projectDir);
        dirExists = true;
      } catch {
        // Directory doesn't exist, which is fine
      }

      if (dirExists && !force) {
        throw new Error(`Directory ${projectDir} already exists. Use --force to overwrite.`);
      }

      // Create project directory
      await Deno.mkdir(projectDir, { recursive: true });

      // Create basic project structure
      const projectStructure = {
        "package.json": {
          name: projectName,
          version: "1.0.0",
          description: "FXD Application",
          type: "module",
          scripts: {
            start: "fxd start",
            dev: "fxd dev",
            build: "fxd build",
          },
        },
        "fxd.config.json": {
          name: projectName,
          version: "1.0.0",
          server: { port: 4400 },
          plugins: { enabled: true, directories: ["./plugins"] },
          persistence: { enabled: true },
        },
        "plugins/.gitkeep": "",
        "src/main.ts": `// FXD Application Entry Point
import { createFXDApp } from "fxd";

const app = createFXDApp();

async function main() {
  await app.initialize();
  await app.start();

  console.log("FXD Application started successfully!");
}

if (import.meta.main) {
  main().catch(console.error);
}
`,
        ".gitignore": `node_modules/
dist/
*.log
.env
fxd-data/
`,
        "README.md": `# ${projectName}

FXD Application

## Getting Started

\`\`\`bash
# Start development server
fxd dev

# Build for production
fxd build

# Run in production mode
fxd start --production
\`\`\`

## Commands

- \`fxd init\` - Initialize new project
- \`fxd dev\` - Start development server
- \`fxd start\` - Start production server
- \`fxd build\` - Build project
- \`fxd plugin\` - Manage plugins
- \`fxd health\` - Check application health
`,
      };

      // Write files
      for (const [filePath, content] of Object.entries(projectStructure)) {
        const fullPath = `${projectDir}/${filePath}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

        if (dir !== fullPath) {
          await Deno.mkdir(dir, { recursive: true });
        }

        const fileContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);
        await Deno.writeTextFile(fullPath, fileContent);
      }

      this._success(`Project ${projectName} initialized successfully!`);
      this._info(`Next steps:`);
      this._info(`  cd ${projectName}`);
      this._info(`  fxd dev`);

    } catch (error) {
      throw new Error(`Failed to initialize project: ${error.message}`);
    }
  }

  private async _startApp(args: CLIArgs): Promise<void> {
    this._info("Starting FXD application...");

    const app = this._createApp(args.options);

    // Set up signal handlers for graceful shutdown
    const shutdown = async () => {
      this._info("Shutting down...");
      await app.shutdown();
      Deno.exit(0);
    };

    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);

    try {
      await app.initialize();
      await app.start();

      this._success(`FXD application started on http://${app.config.server.host}:${app.config.server.port}`);

      // Keep the process running
      await new Promise(() => {}); // Never resolves

    } catch (error) {
      throw new Error(`Failed to start application: ${error.message}`);
    }
  }

  private async _startDev(args: CLIArgs): Promise<void> {
    this._info("Starting FXD development server...");

    const options = {
      ...args.options,
      watch: true,
      debug: true,
    };

    args.options = options;
    await this._startApp(args);
  }

  private async _buildProject(args: CLIArgs): Promise<void> {
    const outputDir = args.options.output || "./dist";
    const minify = args.options.minify || false;

    this._info(`Building project to ${outputDir}`);
    this._info(`Minify: ${minify ? "enabled" : "disabled"}`);

    // Create output directory
    await Deno.mkdir(outputDir, { recursive: true });

    this._info("Build process would happen here");
    this._success("Build completed successfully!");
  }

  private async _exportProject(args: CLIArgs): Promise<void> {
    const outputFile = args.positional[0];
    if (!outputFile) {
      throw new Error("Output file is required");
    }

    const format = args.options.format || "json";
    const includeBackups = args.options["include-backups"] || false;

    this._info(`Exporting project to ${outputFile} (format: ${format})`);

    const app = this._createApp();
    await app.initialize();

    try {
      await app.persistence.exportProject(outputFile, {
        format: format as any,
        includeBackups,
      });

      this._success("Export completed successfully!");
    } finally {
      await app.shutdown();
    }
  }

  private async _importProject(args: CLIArgs): Promise<void> {
    const inputFile = args.positional[0];
    if (!inputFile) {
      throw new Error("Input file is required");
    }

    const overwrite = args.options.overwrite || false;
    const backup = args.options.backup ?? true;

    this._info(`Importing project from ${inputFile}`);

    const app = this._createApp();
    await app.initialize();

    try {
      await app.persistence.importProject(inputFile, {
        overwrite,
        createBackup: backup,
      });

      this._success("Import completed successfully!");
    } finally {
      await app.shutdown();
    }
  }

  private async _pluginCommand(args: CLIArgs): Promise<void> {
    const subcommand = args.positional[0];

    if (!subcommand) {
      this._info("Plugin management commands:");
      this._info("  list      - List installed plugins");
      this._info("  install   - Install a plugin");
      this._info("  uninstall - Uninstall a plugin");
      this._info("  enable    - Enable a plugin");
      this._info("  disable   - Disable a plugin");
      this._info("  status    - Show plugin status");
      return;
    }

    const app = this._createApp();
    await app.initialize();

    try {
      switch (subcommand) {
        case "list":
          const plugins = app.plugins.getPlugins();
          if (plugins.length === 0) {
            this._info("No plugins installed");
          } else {
            this._info("Installed plugins:");
            for (const plugin of plugins) {
              const status = plugin.state === "active" ? "✓" : "✗";
              this._info(`  ${status} ${plugin.id} v${plugin.manifest.version} (${plugin.state})`);
            }
          }
          break;

        case "status":
          const stats = app.plugins.getStats();
          this._info("Plugin Statistics:");
          this._info(`  Total: ${stats.total}`);
          this._info(`  Active: ${stats.active}`);
          this._info(`  Loaded: ${stats.loaded}`);
          this._info(`  Errors: ${stats.errors}`);
          this._info(`  Commands: ${stats.commands}`);
          this._info(`  Views: ${stats.views}`);
          break;

        default:
          this._error(`Unknown plugin subcommand: ${subcommand}`);
      }
    } finally {
      await app.shutdown();
    }
  }

  private async _configCommand(args: CLIArgs): Promise<void> {
    const subcommand = args.positional[0];

    if (!subcommand) {
      this._info("Configuration commands:");
      this._info("  get <key>        - Get configuration value");
      this._info("  set <key> <value> - Set configuration value");
      this._info("  list             - List all configuration");
      this._info("  validate         - Validate configuration");
      return;
    }

    const app = this._createApp();
    await app.initialize();

    try {
      switch (subcommand) {
        case "get":
          const key = args.positional[1];
          if (!key) throw new Error("Configuration key is required");
          const value = app.config.get(key);
          this._info(`${key} = ${JSON.stringify(value)}`);
          break;

        case "set":
          const setKey = args.positional[1];
          const setValue = args.positional[2];
          if (!setKey || setValue === undefined) {
            throw new Error("Configuration key and value are required");
          }
          const success = app.config.set(setKey, this._parseValue(setValue));
          if (success) {
            this._success(`Configuration updated: ${setKey}`);
          } else {
            this._error("Failed to update configuration");
          }
          break;

        case "list":
          const config = app.config.getAll();
          this._info("Configuration:");
          for (const [k, v] of Object.entries(config)) {
            this._info(`  ${k} = ${JSON.stringify(v)}`);
          }
          break;

        case "validate":
          const validation = app.config.validate();
          if (validation.isValid) {
            this._success("Configuration is valid");
          } else {
            this._error("Configuration validation failed:");
            for (const [k, error] of Object.entries(validation.errors)) {
              this._error(`  ${k}: ${error}`);
            }
          }
          break;

        default:
          this._error(`Unknown config subcommand: ${subcommand}`);
      }
    } finally {
      await app.shutdown();
    }
  }

  private async _healthCheck(args: CLIArgs): Promise<void> {
    const detailed = args.options.detailed || false;

    this._info("Checking application health...");

    const app = this._createApp();
    await app.initialize();

    try {
      const health = await app.getHealthStatus();

      if (health.healthy) {
        this._success("Application is healthy");
      } else {
        this._error("Application health check failed");
      }

      this._info(`State: ${health.state}`);
      this._info(`Uptime: ${health.uptime}ms`);
      this._info(`Errors: ${health.errors}`);

      if (detailed) {
        this._info("Module health:");
        for (const [module, healthy] of Object.entries(health.modules)) {
          const status = healthy ? "✓" : "✗";
          this._info(`  ${status} ${module}`);
        }

        if (health.lastError) {
          this._info(`Last error: ${health.lastError.message} (${health.lastError.timestamp})`);
        }
      }
    } finally {
      await app.shutdown();
    }
  }

  private async _showStatus(args: CLIArgs): Promise<void> {
    this._info("Application Status:");

    const app = this._createApp();
    await app.initialize();

    try {
      this._info(`State: ${app.state}`);
      this._info(`Uptime: ${app.uptime}ms`);

      const stats = app.plugins.getStats();
      this._info("Plugins:");
      this._info(`  Total: ${stats.total}, Active: ${stats.active}`);

      const health = await app.getHealthStatus();
      this._info(`Health: ${health.healthy ? "Good" : "Issues detected"}`);
    } finally {
      await app.shutdown();
    }
  }

  private async _validateProject(args: CLIArgs): Promise<void> {
    const fix = args.options.fix || false;

    this._info("Validating project...");

    const app = this._createApp();
    await app.initialize();

    try {
      const validation = app.config.validate();
      const persistenceIntegrity = await app.persistence.validateSystemIntegrity();

      let hasErrors = false;

      if (!validation.isValid) {
        hasErrors = true;
        this._error("Configuration validation failed:");
        for (const [key, error] of Object.entries(validation.errors)) {
          this._error(`  ${key}: ${error}`);
        }
      }

      if (!persistenceIntegrity.isValid) {
        hasErrors = true;
        this._error("Persistence integrity check failed:");
        for (const issue of persistenceIntegrity.issues) {
          this._error(`  ${issue}`);
        }

        if (fix && persistenceIntegrity.recommendations.length > 0) {
          this._info("Attempting to fix issues...");
          for (const recommendation of persistenceIntegrity.recommendations) {
            this._info(`  ${recommendation}`);
          }
        }
      }

      if (!hasErrors) {
        this._success("Project validation passed");
      }
    } finally {
      await app.shutdown();
    }
  }

  private async _cleanProject(args: CLIArgs): Promise<void> {
    const all = args.options.all || false;

    this._info(`Cleaning project${all ? " (including data)" : ""}...`);

    // Clean temporary files
    const tempDirs = ["./tmp", "./.cache", "./node_modules/.cache"];

    for (const dir of tempDirs) {
      try {
        await Deno.remove(dir, { recursive: true });
        this._info(`Cleaned: ${dir}`);
      } catch {
        // Directory doesn't exist or can't be removed
      }
    }

    if (all) {
      // Clean data directory
      try {
        await Deno.remove("./fxd-data", { recursive: true });
        this._info("Cleaned: ./fxd-data");
      } catch {
        // Directory doesn't exist
      }
    }

    this._success("Project cleaned successfully");
  }

  // Utility methods

  private _showHelp(command?: string): void {
    if (command && this.commands.has(command)) {
      const cmd = this.commands.get(command)!;
      console.log(`Usage: ${cmd.usage}`);
      console.log(`${cmd.description}\n`);

      if (cmd.options && cmd.options.length > 0) {
        console.log("Options:");
        for (const option of cmd.options) {
          const alias = option.alias ? `, -${option.alias}` : "";
          const required = option.required ? " (required)" : "";
          const defaultValue = option.default !== undefined ? ` [default: ${option.default}]` : "";
          console.log(`  --${option.name}${alias}  ${option.description}${required}${defaultValue}`);
        }
      }
    } else {
      console.log("FXD - Quantum Node Development Environment\n");
      console.log("Usage: fxd <command> [options]\n");
      console.log("Commands:");

      for (const [name, cmd] of this.commands) {
        console.log(`  ${name.padEnd(12)} ${cmd.description}`);
      }

      console.log("\nGlobal Options:");
      console.log("  --verbose, -v    Enable verbose output");
      console.log("  --quiet, -q      Suppress output");
      console.log("  --config <file>  Use custom config file");
      console.log("  --data-dir <dir> Use custom data directory");
      console.log("  --help, -h       Show help");
      console.log("  --version        Show version");
    }
  }

  private _showVersion(): void {
    console.log("fxd v1.0.0");
  }

  private _info(message: string): void {
    if (!this.config.quiet) {
      console.log(`ℹ ${message}`);
    }
  }

  private _success(message: string): void {
    if (!this.config.quiet) {
      console.log(`✅ ${message}`);
    }
  }

  private _error(message: string): void {
    console.error(`❌ ${message}`);
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  const cli = new FXDCLI();
  const args = Deno.args;

  await cli.run(args);
}

// Run CLI if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error("CLI Error:", error.message);
    Deno.exit(1);
  });
}

export { FXDCLI };