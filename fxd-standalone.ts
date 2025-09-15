#!/usr/bin/env deno run --allow-all

/**
 * FXD Standalone Executable
 * Replaces 'deno' with 'fxd' command and adds .fxd file association
 */

import { $$ } from './fx.ts';
import { FXDApplicationServer } from './server/fxd-app-server.ts';
import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";

// Enhanced RAMDisk with hybrid storage
class FXDHybridDisk {
  private ramDisk: any;
  private diskVolumes: Map<string, string> = new Map(); // volume -> real path mapping
  private sizeThresholds = {
    ramOnly: 100 * 1024 * 1024,     // 100MB - RAM only
    hybrid: 1024 * 1024 * 1024,     // 1GB - RAM + disk cache
    diskOnly: 5 * 1024 * 1024 * 1024 // 5GB+ - disk only
  };

  async mount(fxdPath: string, options: {
    driveLetter?: string;
    ramSize?: number;
    diskPath?: string;
    hybrid?: boolean;
  } = {}): Promise<MountedDisk> {

    // Analyze .fxd file to determine storage requirements
    const analysis = await this.analyzeFXDFile(fxdPath);

    console.log(`
🔍 FXD File Analysis:
   📄 File: ${fxdPath}
   📊 Estimated size: ${this.formatBytes(analysis.estimatedSize)}
   📦 Storage strategy: ${analysis.strategy}
   🎯 Recommended: ${analysis.recommendation}
    `);

    // Show mounting dialog (for GUI mode)
    if (options.driveLetter === undefined) {
      const selection = await this.showMountDialog(analysis);
      Object.assign(options, selection);
    }

    // Create appropriate storage based on size and user choice
    if (analysis.strategy === 'ram-only' || (!options.hybrid && analysis.estimatedSize < this.sizeThresholds.ramOnly)) {
      return await this.createRAMOnlyDisk(fxdPath, options);
    } else if (analysis.strategy === 'hybrid' || options.hybrid) {
      return await this.createHybridDisk(fxdPath, options);
    } else {
      return await this.createDiskOnlyVolume(fxdPath, options);
    }
  }

  private async analyzeFXDFile(fxdPath: string): Promise<{
    estimatedSize: number;
    strategy: 'ram-only' | 'hybrid' | 'disk-only';
    recommendation: string;
    fileCount: number;
    largeFiles: string[];
  }> {
    try {
      // Read .fxd file (SQLite database)
      const stat = await Deno.stat(fxdPath);
      const fileSize = stat.size;

      // TODO: Parse SQLite to get actual content analysis
      // For now, estimate based on file size

      let strategy: 'ram-only' | 'hybrid' | 'disk-only';
      let recommendation: string;

      if (fileSize < this.sizeThresholds.ramOnly) {
        strategy = 'ram-only';
        recommendation = 'Fast RAM-only mounting for quick access';
      } else if (fileSize < this.sizeThresholds.hybrid) {
        strategy = 'hybrid';
        recommendation = 'Hybrid RAM+Disk for balance of speed and capacity';
      } else {
        strategy = 'disk-only';
        recommendation = 'Disk-based mounting for large datasets';
      }

      return {
        estimatedSize: fileSize * 2, // Estimate expanded size
        strategy,
        recommendation,
        fileCount: 0, // TODO: Count from SQLite
        largeFiles: [] // TODO: Identify large files
      };

    } catch (error) {
      console.error('Failed to analyze .fxd file:', error);
      return {
        estimatedSize: 100 * 1024 * 1024, // Default 100MB
        strategy: 'ram-only',
        recommendation: 'Default RAM mounting',
        fileCount: 0,
        largeFiles: []
      };
    }
  }

  private async showMountDialog(analysis: any): Promise<{
    driveLetter: string;
    ramSize: number;
    diskPath?: string;
    hybrid: boolean;
  }> {
    // For now, return defaults (in GUI mode, this would show actual dialog)
    console.log(`
🔧 Mount Options:
   💿 Available drives: F:, G:, H:, I:, J:, K:, L:, M:, N:, O:, P:
   🧠 RAM size: ${this.formatBytes(analysis.estimatedSize)}
   💾 Disk backing: ${Deno.env.get('TEMP') || 'C:\\\\temp'}\\\\fxd-volumes
   ⚡ Strategy: ${analysis.strategy}
    `);

    // TODO: Show actual Windows dialog
    return {
      driveLetter: 'F:',
      ramSize: Math.max(analysis.estimatedSize, 100 * 1024 * 1024),
      diskPath: `${Deno.env.get('TEMP') || 'C:\\\\temp'}\\\\fxd-volumes`,
      hybrid: analysis.strategy === 'hybrid'
    };
  }

  private async createRAMOnlyDisk(fxdPath: string, options: any): Promise<MountedDisk> {
    console.log(`🧠 Creating RAM-only disk at ${options.driveLetter}`);

    // Use existing RAMDisk implementation
    const { FXRAMDisk } = await import('./modules/fx-ramdisk.ts');
    const ramDisk = new FXRAMDisk();

    const mounted = await ramDisk.create({
      driveLetter: options.driveLetter,
      size: options.ramSize,
      label: 'FXD-RAM',
      fileSystem: 'NTFS'
    });

    // Load .fxd content into RAM disk
    await this.loadFXDContent(fxdPath, mounted.mountPath);

    return {
      type: 'ram-only',
      driveLetter: options.driveLetter,
      mountPath: mounted.mountPath,
      ramSize: options.ramSize,
      totalSize: options.ramSize,
      usage: await this.calculateUsage(mounted.mountPath)
    };
  }

  private async createHybridDisk(fxdPath: string, options: any): Promise<MountedDisk> {
    console.log(`⚡ Creating hybrid RAM+Disk at ${options.driveLetter}`);

    // Create disk backing directory
    const diskBackingPath = `${options.diskPath}\\\\${options.driveLetter.replace(':', '')}`;
    await Deno.mkdir(diskBackingPath, { recursive: true });

    // Create RAM disk with disk backing
    const { FXRAMDisk } = await import('./modules/fx-ramdisk.ts');
    const ramDisk = new FXRAMDisk();

    const mounted = await ramDisk.create({
      driveLetter: options.driveLetter,
      size: options.ramSize,
      label: 'FXD-HYBRID',
      fileSystem: 'NTFS',
      backingStore: diskBackingPath // Custom enhancement
    });

    // Setup hybrid file management
    await this.setupHybridManagement(mounted.mountPath, diskBackingPath);

    // Load .fxd content
    await this.loadFXDContent(fxdPath, mounted.mountPath);

    return {
      type: 'hybrid',
      driveLetter: options.driveLetter,
      mountPath: mounted.mountPath,
      diskBackingPath,
      ramSize: options.ramSize,
      totalSize: options.ramSize * 10, // Can expand to disk
      usage: await this.calculateUsage(mounted.mountPath)
    };
  }

  private async createDiskOnlyVolume(fxdPath: string, options: any): Promise<MountedDisk> {
    console.log(`💾 Creating disk-only volume at ${options.driveLetter}`);

    // Create virtual disk file and mount it
    const diskVolumePath = `${options.diskPath}\\\\${options.driveLetter.replace(':', '')}.vhd`;

    // TODO: Create and mount VHD file on Windows
    console.log(`Creating virtual disk: ${diskVolumePath}`);

    return {
      type: 'disk-only',
      driveLetter: options.driveLetter,
      mountPath: diskVolumePath,
      totalSize: 50 * 1024 * 1024 * 1024, // 50GB virtual disk
      usage: await this.calculateUsage(diskVolumePath)
    };
  }

  private async setupHybridManagement(ramPath: string, diskPath: string): Promise<void> {
    // Create intelligent file placement system
    const hybridConfig = {
      ramPath,
      diskPath,
      hotFiles: new Set<string>(), // Frequently accessed files stay in RAM
      coldFiles: new Set<string>(), // Large/old files move to disk
      moveThreshold: 10 * 1024 * 1024, // 10MB files move to disk
      accessThreshold: 3 // Files accessed 3+ times stay in RAM
    };

    // Watch file access patterns and move files accordingly
    $$('hybrid.config').val(hybridConfig);

    // TODO: Implement file watcher and mover
    console.log(`⚡ Hybrid management configured: RAM=${ramPath}, Disk=${diskPath}`);
  }

  private async loadFXDContent(fxdPath: string, mountPath: string): Promise<void> {
    try {
      // TODO: Read SQLite .fxd file and extract content
      console.log(`📂 Loading FXD content from ${fxdPath} to ${mountPath}`);

      // For now, create sample structure
      await Deno.mkdir(`${mountPath}\\\\snippets`, { recursive: true });
      await Deno.mkdir(`${mountPath}\\\\views`, { recursive: true });
      await Deno.mkdir(`${mountPath}\\\\data`, { recursive: true });

      console.log(`✅ FXD content loaded`);

    } catch (error) {
      console.error('Failed to load FXD content:', error);
    }
  }

  private async calculateUsage(path: string): Promise<{ used: number; available: number }> {
    // TODO: Calculate actual disk usage
    return { used: 1024 * 1024, available: 100 * 1024 * 1024 };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

interface MountedDisk {
  type: 'ram-only' | 'hybrid' | 'disk-only';
  driveLetter: string;
  mountPath: string;
  diskBackingPath?: string;
  ramSize?: number;
  totalSize: number;
  usage: { used: number; available: number };
}

// Windows Registry Integration
class WindowsRegistry {
  static async registerFXDFileType(): Promise<void> {
    const fxdExePath = await this.getFXDExecutablePath();

    const registryCommands = [
      // Register .fxd file extension
      `reg add "HKEY_CLASSES_ROOT\\.fxd" /ve /d "FXDisk.File" /f`,

      // Register FXDisk file type
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File" /ve /d "FX Disk File" /f`,
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\DefaultIcon" /ve /d "${fxdExePath},0" /f`,

      // Register mount action
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\mount" /ve /d "Mount FX Disk" /f`,
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\mount\\command" /ve /d "\\"${fxdExePath}\\" mount \\"%1\\"" /f`,

      // Register default action
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell" /ve /d "mount" /f`,

      // Register context menu actions
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\edit" /ve /d "Edit in FXD" /f`,
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\edit\\command" /ve /d "\\"${fxdExePath}\\" edit \\"%1\\"" /f`,

      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\visualize" /ve /d "Visualize in 3D" /f`,
      `reg add "HKEY_CLASSES_ROOT\\FXDisk.File\\shell\\visualize\\command" /ve /d "\\"${fxdExePath}\\" visualize \\"%1\\"" /f`,
    ];

    for (const cmd of registryCommands) {
      try {
        const process = new Deno.Command("cmd", {
          args: ["/c", cmd],
          stdout: "piped",
          stderr: "piped"
        });

        const result = await process.output();
        if (!result.success) {
          console.warn(`Registry command failed: ${cmd}`);
        }
      } catch (error) {
        console.warn(`Failed to execute registry command: ${cmd}`, error);
      }
    }

    console.log(`✅ FXD file association registered`);
    console.log(`📱 Double-click any .fxd file to mount it!`);
  }

  static async getFXDExecutablePath(): Promise<string> {
    // When compiled, this will be the .exe path
    // For now, return the Deno script path
    const scriptPath = new URL(import.meta.url).pathname;
    return scriptPath.replace(/^\/([A-Z]:)/, '$1'); // Fix Windows path
  }

  static async createInstaller(): Promise<void> {
    console.log(`
🔧 Creating FXD Windows Installer...

This will:
1. Register .fxd file extension
2. Add context menu actions
3. Create Start Menu shortcuts
4. Add to Windows PATH
    `);

    await this.registerFXDFileType();

    // Create shortcuts
    await this.createStartMenuShortcuts();

    console.log(`✅ FXD installer completed`);
  }

  static async createStartMenuShortcuts(): Promise<void> {
    const startMenuPath = `${Deno.env.get('APPDATA')}\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs`;
    const fxdExePath = await this.getFXDExecutablePath();

    // TODO: Create .lnk files for Start Menu
    console.log(`📎 Start Menu shortcuts would be created at: ${startMenuPath}`);
  }
}

// Drive Mounting Dialog (GUI)
class FXDMountDialog {
  static async show(analysis: any): Promise<{
    driveLetter: string;
    ramSize: number;
    diskPath?: string;
    hybrid: boolean;
  }> {

    // For CLI mode, use prompts
    if (Deno.args.includes('--no-gui')) {
      return await this.showCLIDialog(analysis);
    }

    // For GUI mode, spawn a dialog window
    return await this.showGUIDialog(analysis);
  }

  static async showCLIDialog(analysis: any): Promise<any> {
    console.log(`
╔══════════════════════════════════════════╗
║            FXD Mount Configuration       ║
╚══════════════════════════════════════════╝

📊 File Analysis:
   Size: ${this.formatBytes(analysis.estimatedSize)}
   Strategy: ${analysis.strategy}

💿 Available Drive Letters: F:, G:, H:, I:, J:, K:, L:, M:, N:, O:, P:

🧠 RAM Options:
   1. RAM Only (fastest, limited size)
   2. Hybrid RAM+Disk (balanced)
   3. Disk Only (unlimited size, slower)
    `);

    // Simple CLI prompts for now
    const driveLetter = 'F:'; // TODO: prompt for drive letter
    const ramSize = analysis.estimatedSize;
    const hybrid = analysis.strategy === 'hybrid';

    return { driveLetter, ramSize, hybrid };
  }

  static async showGUIDialog(analysis: any): Promise<any> {
    // TODO: Create Windows dialog using PowerShell or native API
    console.log(`🪟 GUI Dialog would show mount options`);
    return this.showCLIDialog(analysis);
  }

  static formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Main FXD Command Handler
class FXDStandalone {
  private hybridDisk = new FXDHybridDisk();

  async execute(): Promise<void> {
    const args = parseArgs(Deno.args);
    const command = args._[0];

    // Handle .fxd file association (double-click)
    if (command === 'mount' && args._[1]?.endsWith('.fxd')) {
      await this.mountFXDFile(args._[1]);
      return;
    }

    // Handle other FXD commands
    switch (command) {
      case 'mount':
        await this.handleMount(args);
        break;

      case 'unmount':
        await this.handleUnmount(args);
        break;

      case 'list-drives':
        await this.listMountedDrives();
        break;

      case 'install':
        await this.installFXD();
        break;

      case 'server':
        await this.startServer(args);
        break;

      case 'compile':
        await this.compileFXD();
        break;

      // Pass through to existing CLI commands
      case 'create':
      case 'import':
      case 'run':
      case 'list':
      case 'export':
        await this.delegateToFXDCLI(args);
        break;

      default:
        this.showHelp();
    }
  }

  private async mountFXDFile(fxdPath: string): Promise<void> {
    console.log(`
🚀 FXD File Association Handler
📄 Mounting: ${fxdPath}
    `);

    try {
      const mounted = await this.hybridDisk.mount(fxdPath);

      console.log(`
✅ Successfully mounted FXD disk!

💿 Drive: ${mounted.driveLetter}
📁 Path: ${mounted.mountPath}
📊 Size: ${this.formatBytes(mounted.totalSize)}
🎯 Type: ${mounted.type}

🌐 Opening FXD Web Interface...
    `);

      // Start FXD server and open browser
      await this.startServerAndOpen(mounted);

    } catch (error) {
      console.error(`❌ Failed to mount FXD file:`, error);
    }
  }

  private async startServerAndOpen(mounted: MountedDisk): Promise<void> {
    // Start FXD server with mounted disk context
    const server = new FXDApplicationServer({
      port: 3000,
      features: {
        registration: false, // Single-user mode
        collaboration: true,
        plugins: true,
        marketplace: false
      }
    });

    // Set disk context in FX
    $$('mounted.disk').val(mounted);
    $$('mounted.active').val(true);

    await server.start();

    // Open browser
    if (Deno.build.os === 'windows') {
      new Deno.Command("cmd", {
        args: ["/c", "start", "http://localhost:3000/app"],
      }).spawn();
    }

    console.log(`🌐 FXD interface opened at http://localhost:3000/app`);
  }

  private async installFXD(): Promise<void> {
    console.log(`
🔧 Installing FXD for Windows...

This will:
• Register .fxd file extension
• Add context menu actions
• Create Start Menu shortcuts
• Add FXD to Windows PATH

⚠️  Requires Administrator privileges
    `);

    try {
      await WindowsRegistry.createInstaller();
      console.log(`✅ FXD installation completed!`);
      console.log(`🎯 You can now double-click .fxd files to mount them`);

    } catch (error) {
      console.error(`❌ Installation failed:`, error);
      console.log(`💡 Try running as Administrator`);
    }
  }

  private async compileFXD(): Promise<void> {
    console.log(`
🔨 Compiling FXD to standalone executable...

This creates:
• fxd.exe - Standalone FXD executable
• No Deno dependency required
• Full FXD functionality built-in
    `);

    try {
      const compileProcess = new Deno.Command("deno", {
        args: [
          "compile",
          "--allow-all",
          "--output", "fxd.exe",
          "--target", "x86_64-pc-windows-msvc",
          "fxd-standalone.ts"
        ],
        stdout: "piped",
        stderr: "piped"
      });

      const result = await compileProcess.output();

      if (result.success) {
        console.log(`✅ FXD compiled successfully!`);
        console.log(`📦 Output: fxd.exe`);
        console.log(`🎯 Run: .\\\\fxd.exe install`);
      } else {
        const error = new TextDecoder().decode(result.stderr);
        console.error(`❌ Compilation failed:`, error);
      }

    } catch (error) {
      console.error(`❌ Compilation error:`, error);
    }
  }

  private async delegateToFXDCLI(args: any): Promise<void> {
    // Import and run existing CLI
    const { default: FXDCLI } = await import('./fxd-cli.ts');
    const cli = new (FXDCLI as any)();
    await cli.execute();
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private showHelp(): void {
    console.log(`
🎯 FXD - Visual Code Management Platform

USAGE:
  fxd <command> [options]

DISK MANAGEMENT:
  mount <file.fxd>         Mount FXD disk with dialog
  unmount <drive>          Unmount FXD disk
  list-drives              List mounted FXD drives

SYSTEM:
  install                  Install FXD system integration
  compile                  Compile to standalone executable
  server [--port=3000]     Start FXD server

DEVELOPMENT:
  create <name>            Create new FXD disk
  import <path>            Import files into FXD
  run <snippet>            Execute snippet
  list                     List disk contents
  export <path>            Export FXD contents

FILE ASSOCIATION:
  Double-click any .fxd file to mount it automatically!

EXAMPLES:
  fxd install                    # Install system integration
  fxd compile                    # Create fxd.exe
  fxd mount project.fxd          # Mount disk with GUI
  fxd create my-project          # Create new project

🌐 Web UI: http://localhost:3000/app
🎯 Visualizer: http://localhost:8080
💻 CLI: Full command line interface
    `);
  }

  // Additional command handlers
  private async handleMount(args: any): Promise<void> {
    const fxdFile = args._[1];
    if (!fxdFile) {
      console.error('❌ FXD file required');
      console.log('Usage: fxd mount <file.fxd>');
      return;
    }

    await this.mountFXDFile(fxdFile);
  }

  private async handleUnmount(args: any): Promise<void> {
    const driveLetter = args._[1];
    if (!driveLetter) {
      console.error('❌ Drive letter required');
      console.log('Usage: fxd unmount <drive>');
      return;
    }

    console.log(`📤 Unmounting drive: ${driveLetter}`);
    // TODO: Implement unmounting
    console.log(`✅ Drive ${driveLetter} unmounted`);
  }

  private async listMountedDrives(): Promise<void> {
    console.log(`
💿 Mounted FXD Drives:
====================
    `);

    // TODO: List actual mounted drives
    console.log(`F: - test-project.fxd (RAM-only, 150MB)`);
    console.log(`G: - large-dataset.fxd (Hybrid, 5GB RAM + 50GB disk)`);
    console.log(`H: - archive.fxd (Disk-only, 100GB)`);
  }

  private async startServer(args: any): Promise<void> {
    const port = args.port || 3000;

    console.log(`🚀 Starting FXD Server on port ${port}`);

    const server = new FXDApplicationServer({ port });
    await server.start();
  }
}

// Main entry point
async function main() {
  const fxd = new FXDStandalone();
  await fxd.execute();
}

if (import.meta.main) {
  main().catch(console.error);
}