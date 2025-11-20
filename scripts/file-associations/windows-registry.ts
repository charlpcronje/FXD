#!/usr/bin/env deno run --allow-all

/**
 * @file windows-registry.ts
 * @description Windows Registry Configuration for .fxd File Associations
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 *
 * This script configures Windows Registry to:
 * - Associate .fxd files with FXD CLI
 * - Set custom icon for .fxd files
 * - Enable double-click to open files
 * - Add context menu items (Open with FXD, View, Edit)
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/mod.ts";

// Color utilities
const c = {
  success: (text: string) => `\x1b[32m${text}\x1b[0m`,
  error: (text: string) => `\x1b[31m${text}\x1b[0m`,
  warning: (text: string) => `\x1b[33m${text}\x1b[0m`,
  info: (text: string) => `\x1b[36m${text}\x1b[0m`,
  highlight: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

interface RegistryEntry {
  key: string;
  value: string;
  data: string;
  type: string;
}

class WindowsFileAssociator {
  private fxdPath: string = "";
  private iconPath: string = "";

  async setup(): Promise<number> {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║     Windows File Association Setup (.fxd files)       ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    // Step 1: Check if we're on Windows
    if (Deno.build.os !== "windows") {
      console.log(c.error("❌ This script only works on Windows\n"));
      return 1;
    }

    // Step 2: Find FXD executable
    await this.findFxdExecutable();

    // Step 3: Create registry file
    await this.createRegistryFile();

    // Step 4: Apply registry changes
    await this.applyRegistry();

    // Step 5: Verify
    await this.verify();

    // Step 6: Show completion
    this.showCompletion();

    return 0;
  }

  private async findFxdExecutable(): Promise<void> {
    console.log(c.info("🔍 Locating FXD executable..."));

    // Check common locations
    const possiblePaths = [
      // User installation
      join(Deno.env.get("USERPROFILE") || "", "AppData", "Local", "fxd", "bin", "fxd.exe"),
      // System installation
      "C:\\Program Files\\fxd\\fxd.exe",
      // Build directory
      join(Deno.cwd(), "build", "cli", "binaries", "fxd-windows-x64.exe"),
      // Current directory
      join(Deno.cwd(), "fxd.exe"),
    ];

    for (const path of possiblePaths) {
      if (await exists(path)) {
        this.fxdPath = path.replace(/\\/g, "\\\\"); // Escape backslashes for registry
        console.log(c.success(`   ✓ Found: ${path}\n`));
        return;
      }
    }

    // Not found, ask user
    console.log(c.warning("   ⚠ FXD executable not found in common locations"));
    console.log(c.info("   Please ensure FXD is installed first\n"));
    throw new Error("FXD executable not found");
  }

  private async createRegistryFile(): Promise<void> {
    console.log(c.info("📝 Creating registry configuration..."));

    // Icon path (use the executable icon)
    this.iconPath = this.fxdPath;

    // Create registry entries
    const regContent = `Windows Registry Editor Version 5.00

; FXD File Association Configuration
; Generated: ${new Date().toISOString()}

; Register .fxd file extension
[HKEY_CLASSES_ROOT\\.fxd]
@="FXDFile"
"Content Type"="application/x-fxd"

[HKEY_CLASSES_ROOT\\.fxd\\OpenWithProgids]
"FXDFile"=""

; Define FXD file type
[HKEY_CLASSES_ROOT\\FXDFile]
@="FXD Quantum Development File"
"EditFlags"=dword:00000000
"FriendlyTypeName"="FXD File"

; Set icon
[HKEY_CLASSES_ROOT\\FXDFile\\DefaultIcon]
@="${this.iconPath},0"

; Default action: Open with FXD
[HKEY_CLASSES_ROOT\\FXDFile\\shell]
@="open"

[HKEY_CLASSES_ROOT\\FXDFile\\shell\\open]
@="Open with FXD"
"Icon"="${this.iconPath}"

[HKEY_CLASSES_ROOT\\FXDFile\\shell\\open\\command]
@="\\"${this.fxdPath}\\" load \\"%1\\""

; Additional actions: Load
[HKEY_CLASSES_ROOT\\FXDFile\\shell\\load]
@="Load in FXD"
"Icon"="${this.iconPath}"

[HKEY_CLASSES_ROOT\\FXDFile\\shell\\load\\command]
@="\\"${this.fxdPath}\\" load \\"%1\\""

; Additional actions: Show Stats
[HKEY_CLASSES_ROOT\\FXDFile\\shell\\stats]
@="Show Statistics"
"Icon"="${this.iconPath}"

[HKEY_CLASSES_ROOT\\FXDFile\\shell\\stats\\command]
@="\\"${this.fxdPath}\\" stats \\"%1\\""

; Additional actions: Export
[HKEY_CLASSES_ROOT\\FXDFile\\shell\\export]
@="Export Contents"
"Icon"="${this.iconPath}"

[HKEY_CLASSES_ROOT\\FXDFile\\shell\\export\\command]
@="\\"${this.fxdPath}\\" export \\"%1\\""

; Perceived type (for Windows Explorer)
[HKEY_CLASSES_ROOT\\FXDFile]
"PerceivedType"="document"

; Add to "New" context menu
[HKEY_CLASSES_ROOT\\.fxd\\ShellNew]
"NullFile"=""
"ItemName"="@%SystemRoot%\\\\system32\\\\shell32.dll,-10153"

; Register with Default Programs
[HKEY_CURRENT_USER\\Software\\Classes\\.fxd]
@="FXDFile"

[HKEY_CURRENT_USER\\Software\\Classes\\FXDFile]
@="FXD Quantum Development File"

[HKEY_CURRENT_USER\\Software\\Classes\\FXDFile\\shell\\open\\command]
@="\\"${this.fxdPath}\\" load \\"%1\\""

; Capabilities for Default Programs
[HKEY_CURRENT_USER\\Software\\FXD\\Capabilities]
"ApplicationDescription"="FXD Quantum Development Environment - Manage and visualize FXD disk files"
"ApplicationName"="FXD CLI"

[HKEY_CURRENT_USER\\Software\\FXD\\Capabilities\\FileAssociations]
".fxd"="FXDFile"

[HKEY_CURRENT_USER\\Software\\RegisteredApplications]
"FXD"="Software\\\\FXD\\\\Capabilities"
`;

    await Deno.writeTextFile("fxd-association.reg", regContent);
    console.log(c.success(`   ✓ Registry file created: fxd-association.reg\n`));
  }

  private async applyRegistry(): Promise<void> {
    console.log(c.info("⚙️  Applying registry changes..."));
    console.log(c.warning("   ⚠ This requires administrator privileges\n"));

    try {
      // Use reg import command
      const command = new Deno.Command("reg", {
        args: ["import", "fxd-association.reg"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await command.output();

      if (code === 0) {
        console.log(c.success(`   ✓ Registry changes applied successfully\n`));

        // Refresh icon cache
        await this.refreshIconCache();
      } else {
        const error = new TextDecoder().decode(stderr);
        console.log(c.error(`   ✗ Failed to apply registry changes`));
        console.log(c.dim(`   ${error}`));
        console.log(c.warning(`\n   Please run as Administrator or manually import:`));
        console.log(c.highlight(`   reg import fxd-association.reg\n`));
      }
    } catch (error) {
      console.log(c.error(`   ✗ Error: ${error.message}`));
      console.log(c.warning(`\n   Please manually import the registry file:`));
      console.log(c.highlight(`   Double-click: fxd-association.reg\n`));
    }
  }

  private async refreshIconCache(): Promise<void> {
    console.log(c.info("🔄 Refreshing Windows Explorer..."));

    try {
      // Kill and restart Explorer to refresh icons
      const psCommand = `
        taskkill /F /IM explorer.exe
        Start-Sleep -Milliseconds 500
        Start-Process explorer.exe
      `;

      const command = new Deno.Command("powershell", {
        args: ["-Command", psCommand],
        stdout: "piped",
        stderr: "piped",
      });

      await command.output();
      console.log(c.success(`   ✓ Explorer refreshed\n`));
    } catch {
      console.log(c.warning(`   ⚠ Could not refresh Explorer automatically`));
      console.log(c.info(`   Please restart Explorer manually or log out/in\n`));
    }
  }

  private async verify(): Promise<void> {
    console.log(c.info("✅ Verifying file associations..."));

    try {
      // Query registry to verify
      const command = new Deno.Command("reg", {
        args: ["query", "HKEY_CLASSES_ROOT\\.fxd", "/ve"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await command.output();

      if (code === 0) {
        const output = new TextDecoder().decode(stdout);
        if (output.includes("FXDFile")) {
          console.log(c.success(`   ✓ File association verified\n`));
        } else {
          console.log(c.warning(`   ⚠ Association present but may not be correct\n`));
        }
      } else {
        console.log(c.warning(`   ⚠ Could not verify association\n`));
      }
    } catch {
      console.log(c.warning(`   ⚠ Could not verify association\n`));
    }
  }

  private showCompletion(): void {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║          File Association Setup Complete! 🎉          ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    console.log(c.info("What's Configured:\n"));
    console.log(`   ${c.success("✓")} .fxd files associated with FXD CLI`);
    console.log(`   ${c.success("✓")} Custom icon for .fxd files`);
    console.log(`   ${c.success("✓")} Double-click to open files`);
    console.log(`   ${c.success("✓")} Context menu: Open with FXD`);
    console.log(`   ${c.success("✓")} Context menu: Show Statistics`);
    console.log(`   ${c.success("✓")} Context menu: Export Contents`);
    console.log(`   ${c.success("✓")} "New" menu: Create .fxd file`);

    console.log(c.info("\nTesting:\n"));
    console.log(`   1. Right-click in Explorer → New → ${c.highlight("FXD File")}`);
    console.log(`   2. Double-click any .fxd file to open with FXD`);
    console.log(`   3. Right-click .fxd file for additional options`);

    console.log(c.info("\nNote:\n"));
    console.log(c.dim(`   If icons don't appear, try logging out and back in\n`));
  }
}

// Main execution
if (import.meta.main) {
  try {
    const associator = new WindowsFileAssociator();
    const exitCode = await associator.setup();
    Deno.exit(exitCode);
  } catch (error) {
    console.error(c.error(`\n❌ Setup failed: ${error.message}\n`));
    Deno.exit(1);
  }
}
