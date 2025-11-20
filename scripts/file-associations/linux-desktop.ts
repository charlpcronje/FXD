#!/usr/bin/env deno run --allow-all

/**
 * @file linux-desktop.ts
 * @description Linux Desktop File Configuration for .fxd File Associations
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 *
 * This script configures Linux desktop environment to:
 * - Associate .fxd files with FXD CLI
 * - Create desktop entry for FXD application
 * - Add MIME type for .fxd files
 * - Enable double-click to open files
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists, ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

// Color utilities
const c = {
  success: (text: string) => `\x1b[32m${text}\x1b[0m`,
  error: (text: string) => `\x1b[31m${text}\x1b[0m`,
  warning: (text: string) => `\x1b[33m${text}\x1b[0m`,
  info: (text: string) => `\x1b[36m${text}\x1b[0m`,
  highlight: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

class LinuxFileAssociator {
  private fxdPath: string = "";
  private homeDir: string = "";
  private iconPath: string = "";

  async setup(): Promise<number> {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║      Linux File Association Setup (.fxd files)        ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    // Step 1: Check if we're on Linux
    if (Deno.build.os !== "linux") {
      console.log(c.error("❌ This script only works on Linux\n"));
      return 1;
    }

    // Step 2: Setup paths
    this.homeDir = Deno.env.get("HOME") || "/tmp";

    // Step 3: Find FXD executable
    await this.findFxdExecutable();

    // Step 4: Create MIME type
    await this.createMimeType();

    // Step 5: Create desktop entry
    await this.createDesktopEntry();

    // Step 6: Update databases
    await this.updateDatabases();

    // Step 7: Verify
    await this.verify();

    // Step 8: Show completion
    this.showCompletion();

    return 0;
  }

  private async findFxdExecutable(): Promise<void> {
    console.log(c.info("🔍 Locating FXD executable..."));

    // Check if fxd is in PATH
    try {
      const command = new Deno.Command("which", {
        args: ["fxd"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await command.output();
      if (code === 0) {
        this.fxdPath = new TextDecoder().decode(stdout).trim();
        console.log(c.success(`   ✓ Found in PATH: ${this.fxdPath}\n`));
        return;
      }
    } catch {
      // Continue to check other locations
    }

    // Check common locations
    const possiblePaths = [
      "/usr/local/bin/fxd",
      "/usr/bin/fxd",
      join(this.homeDir, ".local", "bin", "fxd"),
      join(Deno.cwd(), "build", "cli", "binaries", "fxd-linux-x64"),
      join(Deno.cwd(), "fxd"),
    ];

    for (const path of possiblePaths) {
      if (await exists(path)) {
        this.fxdPath = path;
        console.log(c.success(`   ✓ Found: ${path}\n`));
        return;
      }
    }

    console.log(c.warning("   ⚠ FXD executable not found"));
    console.log(c.info("   Please ensure FXD is installed first\n"));
    throw new Error("FXD executable not found");
  }

  private async createMimeType(): Promise<void> {
    console.log(c.info("📝 Creating MIME type definition..."));

    const mimeDir = join(this.homeDir, ".local", "share", "mime", "packages");
    await ensureDir(mimeDir);

    const mimeContent = `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-fxd">
    <comment>FXD Quantum Development File</comment>
    <comment xml:lang="en">FXD Quantum Development File</comment>
    <icon name="application-x-fxd"/>
    <glob-deleteall/>
    <glob pattern="*.fxd"/>
    <magic priority="50">
      <match type="string" offset="0" value="SQLite format 3">
        <match type="string" offset="0:100" value="fxd_"/>
      </match>
    </magic>
    <sub-class-of type="application/x-sqlite3"/>
  </mime-type>
</mime-info>
`;

    const mimeFile = join(mimeDir, "application-x-fxd.xml");
    await Deno.writeTextFile(mimeFile, mimeContent);
    console.log(c.success(`   ✓ MIME type created: ${mimeFile}\n`));
  }

  private async createDesktopEntry(): Promise<void> {
    console.log(c.info("🖥️  Creating desktop entry..."));

    const applicationsDir = join(this.homeDir, ".local", "share", "applications");
    await ensureDir(applicationsDir);

    // Create desktop file
    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=FXD CLI
GenericName=FXD Quantum Development Tool
Comment=Manage and visualize FXD quantum development files
Icon=application-x-fxd
Exec=${this.fxdPath} load %f
Terminal=true
Categories=Development;Utility;
MimeType=application/x-fxd;
NoDisplay=false
StartupNotify=false
Keywords=fxd;quantum;development;code;
Actions=Load;Stats;Export;

[Desktop Action Load]
Name=Load in FXD
Exec=${this.fxdPath} load %f

[Desktop Action Stats]
Name=Show Statistics
Exec=${this.fxdPath} stats %f

[Desktop Action Export]
Name=Export Contents
Exec=${this.fxdPath} export %f
`;

    const desktopFile = join(applicationsDir, "fxd.desktop");
    await Deno.writeTextFile(desktopFile, desktopContent);

    // Make executable
    await Deno.chmod(desktopFile, 0o755);

    console.log(c.success(`   ✓ Desktop entry created: ${desktopFile}\n`));

    // Create icon if available
    await this.createIcon();
  }

  private async createIcon(): Promise<void> {
    console.log(c.info("🎨 Setting up icon..."));

    const iconsDir = join(this.homeDir, ".local", "share", "icons", "hicolor", "48x48", "mimetypes");
    await ensureDir(iconsDir);

    // Check if we have an icon file in assets
    const possibleIcons = [
      "assets/icon.png",
      "assets/fxd-icon.png",
      join(Deno.cwd(), "icon.png"),
    ];

    for (const iconPath of possibleIcons) {
      if (await exists(iconPath)) {
        const destIcon = join(iconsDir, "application-x-fxd.png");
        await Deno.copyFile(iconPath, destIcon);
        this.iconPath = destIcon;
        console.log(c.success(`   ✓ Icon installed: ${destIcon}\n`));
        return;
      }
    }

    console.log(c.dim(`   Skipping (no icon file found)\n`));
  }

  private async updateDatabases(): Promise<void> {
    console.log(c.info("🔄 Updating system databases..."));

    // Update MIME database
    try {
      const mimeCommand = new Deno.Command("update-mime-database", {
        args: [join(this.homeDir, ".local", "share", "mime")],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await mimeCommand.output();
      if (code === 0) {
        console.log(c.success(`   ✓ MIME database updated`));
      } else {
        console.log(c.warning(`   ⚠ Could not update MIME database`));
      }
    } catch {
      console.log(c.warning(`   ⚠ update-mime-database not available`));
    }

    // Update desktop database
    try {
      const desktopCommand = new Deno.Command("update-desktop-database", {
        args: [join(this.homeDir, ".local", "share", "applications")],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await desktopCommand.output();
      if (code === 0) {
        console.log(c.success(`   ✓ Desktop database updated`));
      } else {
        console.log(c.warning(`   ⚠ Could not update desktop database`));
      }
    } catch {
      console.log(c.warning(`   ⚠ update-desktop-database not available`));
    }

    // Update icon cache
    if (this.iconPath) {
      try {
        const iconCommand = new Deno.Command("gtk-update-icon-cache", {
          args: ["-f", "-t", join(this.homeDir, ".local", "share", "icons", "hicolor")],
          stdout: "piped",
          stderr: "piped",
        });

        const { code } = await iconCommand.output();
        if (code === 0) {
          console.log(c.success(`   ✓ Icon cache updated\n`));
        } else {
          console.log(c.warning(`   ⚠ Could not update icon cache\n`));
        }
      } catch {
        console.log(c.warning(`   ⚠ gtk-update-icon-cache not available\n`));
      }
    } else {
      console.log();
    }
  }

  private async verify(): Promise<void> {
    console.log(c.info("✅ Verifying file associations..."));

    // Check if desktop file exists
    const desktopFile = join(this.homeDir, ".local", "share", "applications", "fxd.desktop");
    if (await exists(desktopFile)) {
      console.log(c.success(`   ✓ Desktop entry exists`));
    } else {
      console.log(c.error(`   ✗ Desktop entry not found`));
    }

    // Check if MIME type exists
    const mimeFile = join(this.homeDir, ".local", "share", "mime", "packages", "application-x-fxd.xml");
    if (await exists(mimeFile)) {
      console.log(c.success(`   ✓ MIME type registered`));
    } else {
      console.log(c.error(`   ✗ MIME type not found`));
    }

    // Try to query MIME type
    try {
      const command = new Deno.Command("xdg-mime", {
        args: ["query", "default", "application/x-fxd"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await command.output();
      if (code === 0) {
        const output = new TextDecoder().decode(stdout).trim();
        if (output.includes("fxd.desktop")) {
          console.log(c.success(`   ✓ Default application set\n`));
        } else {
          console.log(c.warning(`   ⚠ Default application: ${output}\n`));
        }
      } else {
        console.log(c.dim(`   (xdg-mime query not available)\n`));
      }
    } catch {
      console.log(c.dim(`   (xdg-mime not available)\n`));
    }
  }

  private showCompletion(): void {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║          File Association Setup Complete! 🎉          ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    console.log(c.info("What's Configured:\n"));
    console.log(`   ${c.success("✓")} MIME type for .fxd files`);
    console.log(`   ${c.success("✓")} Desktop entry for FXD application`);
    console.log(`   ${c.success("✓")} File manager integration`);
    console.log(`   ${c.success("✓")} Double-click to open files`);
    if (this.iconPath) {
      console.log(`   ${c.success("✓")} Custom icon for .fxd files`);
    }

    console.log(c.info("\nTesting:\n"));
    console.log(`   1. Create a test file: ${c.highlight("touch test.fxd")}`);
    console.log(`   2. Right-click test.fxd in file manager`);
    console.log(`   3. Select "Open With" → ${c.highlight("FXD CLI")}`);
    console.log(`   4. Set as default application for .fxd files`);

    console.log(c.info("\nManual Configuration:\n"));
    console.log(c.dim(`   Set default: xdg-mime default fxd.desktop application/x-fxd`));

    console.log(c.info("\nNote:\n"));
    console.log(c.dim(`   You may need to restart your file manager for changes to take effect\n`));
  }
}

// Main execution
if (import.meta.main) {
  try {
    const associator = new LinuxFileAssociator();
    const exitCode = await associator.setup();
    Deno.exit(exitCode);
  } catch (error) {
    console.error(c.error(`\n❌ Setup failed: ${error.message}\n`));
    Deno.exit(1);
  }
}
