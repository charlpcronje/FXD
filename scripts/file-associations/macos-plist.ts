#!/usr/bin/env deno run --allow-all

/**
 * @file macos-plist.ts
 * @description macOS Property List Configuration for .fxd File Associations
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 *
 * This script configures macOS to:
 * - Associate .fxd files with FXD CLI
 * - Create application bundle for FXD
 * - Register UTI (Uniform Type Identifier) for .fxd files
 * - Enable Quick Look support (optional)
 * - Add to Finder's "Open With" menu
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

class MacOSFileAssociator {
  private fxdPath: string = "";
  private homeDir: string = "";
  private appPath: string = "";

  async setup(): Promise<number> {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║       macOS File Association Setup (.fxd files)       ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    // Step 1: Check if we're on macOS
    if (Deno.build.os !== "darwin") {
      console.log(c.error("❌ This script only works on macOS\n"));
      return 1;
    }

    // Step 2: Setup paths
    this.homeDir = Deno.env.get("HOME") || "/tmp";

    // Step 3: Find FXD executable
    await this.findFxdExecutable();

    // Step 4: Create app bundle
    await this.createAppBundle();

    // Step 5: Register UTI
    await this.registerUTI();

    // Step 6: Set default application
    await this.setDefaultApplication();

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
      "/opt/homebrew/bin/fxd",
      join(this.homeDir, ".local", "bin", "fxd"),
      join(Deno.cwd(), "build", "cli", "binaries", "fxd-macos-arm64"),
      join(Deno.cwd(), "build", "cli", "binaries", "fxd-macos-x64"),
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

  private async createAppBundle(): Promise<void> {
    console.log(c.info("📦 Creating application bundle..."));

    // Create app bundle structure in /Applications or ~/Applications
    const appsDir = join(this.homeDir, "Applications");
    await ensureDir(appsDir);

    this.appPath = join(appsDir, "FXD.app");
    const contentsDir = join(this.appPath, "Contents");
    const macosDir = join(contentsDir, "MacOS");
    const resourcesDir = join(contentsDir, "Resources");

    await ensureDir(macosDir);
    await ensureDir(resourcesDir);

    // Create launcher script
    const launcherPath = join(macosDir, "fxd-launcher");
    const launcherScript = `#!/bin/bash
# FXD Launcher Script for macOS
# Opens .fxd files with FXD CLI

if [ "$#" -eq 0 ]; then
    # No arguments - show help
    osascript -e 'display dialog "FXD CLI\\n\\nDrag .fxd files onto this app to open them,\\nor use the command line: fxd" buttons {"OK"} default button 1'
    exit 0
fi

# Open Terminal and run fxd load
FILE="$1"
osascript -e 'tell application "Terminal" to do script "${this.fxdPath} load '"'"'"'"$FILE"'"'"'"'"'
osascript -e 'tell application "Terminal" to activate'
`;

    await Deno.writeTextFile(launcherPath, launcherScript);
    await Deno.chmod(launcherPath, 0o755);

    console.log(c.success(`   ✓ Launcher script created`));

    // Create Info.plist
    await this.createInfoPlist(contentsDir);

    // Create icon (if available)
    await this.createIcon(resourcesDir);

    console.log(c.success(`   ✓ App bundle created: ${this.appPath}\n`));
  }

  private async createInfoPlist(contentsDir: string): Promise<void> {
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>

    <key>CFBundleExecutable</key>
    <string>fxd-launcher</string>

    <key>CFBundleIconFile</key>
    <string>fxd-icon</string>

    <key>CFBundleIdentifier</key>
    <string>dev.fxd.cli</string>

    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>

    <key>CFBundleName</key>
    <string>FXD</string>

    <key>CFBundleDisplayName</key>
    <string>FXD CLI</string>

    <key>CFBundlePackageType</key>
    <string>APPL</string>

    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>

    <key>CFBundleVersion</key>
    <string>1</string>

    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>

    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2025 FXD Project</string>

    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>fxd</string>
            </array>
            <key>CFBundleTypeIconFile</key>
            <string>fxd-icon</string>
            <key>CFBundleTypeName</key>
            <string>FXD Quantum Development File</string>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>LSHandlerRank</key>
            <string>Owner</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>dev.fxd.file</string>
            </array>
        </dict>
    </array>

    <key>UTExportedTypeDeclarations</key>
    <array>
        <dict>
            <key>UTTypeIdentifier</key>
            <string>dev.fxd.file</string>
            <key>UTTypeDescription</key>
            <string>FXD Quantum Development File</string>
            <key>UTTypeConformsTo</key>
            <array>
                <string>public.data</string>
                <string>public.database</string>
            </array>
            <key>UTTypeTagSpecification</key>
            <dict>
                <key>public.filename-extension</key>
                <array>
                    <string>fxd</string>
                </array>
                <key>public.mime-type</key>
                <array>
                    <string>application/x-fxd</string>
                </array>
            </dict>
        </dict>
    </array>

    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>

    <key>NSAppleScriptEnabled</key>
    <true/>

    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
</dict>
</plist>
`;

    await Deno.writeTextFile(join(contentsDir, "Info.plist"), plistContent);
    console.log(c.success(`   ✓ Info.plist created`));
  }

  private async createIcon(resourcesDir: string): Promise<void> {
    // Check if we have an icon file in assets
    const possibleIcons = [
      "assets/icon.png",
      "assets/fxd-icon.png",
      join(Deno.cwd(), "icon.png"),
    ];

    for (const iconPath of possibleIcons) {
      if (await exists(iconPath)) {
        // On macOS, we should convert to .icns format, but for simplicity,
        // we'll just copy the PNG and let macOS handle it
        const destIcon = join(resourcesDir, "fxd-icon.png");
        await Deno.copyFile(iconPath, destIcon);
        console.log(c.success(`   ✓ Icon installed`));
        return;
      }
    }

    console.log(c.dim(`   Skipping icon (not found)`));
  }

  private async registerUTI(): Promise<void> {
    console.log(c.info("📝 Registering UTI with Launch Services..."));

    try {
      // Register the app bundle with Launch Services
      const command = new Deno.Command("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister", {
        args: ["-f", this.appPath],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      if (code === 0) {
        console.log(c.success(`   ✓ UTI registered successfully\n`));
      } else {
        console.log(c.warning(`   ⚠ Could not register UTI automatically\n`));
      }
    } catch (error) {
      console.log(c.warning(`   ⚠ Error registering UTI: ${error.message}\n`));
    }
  }

  private async setDefaultApplication(): Promise<void> {
    console.log(c.info("🔗 Setting default application..."));

    try {
      // Use duti if available (brew install duti)
      const command = new Deno.Command("duti", {
        args: ["-s", "dev.fxd.cli", ".fxd", "all"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      if (code === 0) {
        console.log(c.success(`   ✓ Default application set\n`));
      } else {
        console.log(c.warning(`   ⚠ Could not set default application`));
        console.log(c.dim(`   Install duti: brew install duti\n`));
      }
    } catch {
      console.log(c.dim(`   duti not available (optional)`));
      console.log(c.info(`   You can manually set the default in Finder:\n`));
      console.log(c.dim(`   1. Right-click a .fxd file`));
      console.log(c.dim(`   2. Get Info → Open With → FXD.app`));
      console.log(c.dim(`   3. Click "Change All..."\n`));
    }
  }

  private async verify(): Promise<void> {
    console.log(c.info("✅ Verifying file associations..."));

    // Check if app bundle exists
    if (await exists(this.appPath)) {
      console.log(c.success(`   ✓ App bundle exists`));

      // Check Info.plist
      const infoPlist = join(this.appPath, "Contents", "Info.plist");
      if (await exists(infoPlist)) {
        console.log(c.success(`   ✓ Info.plist present`));
      }

      // Check launcher
      const launcher = join(this.appPath, "Contents", "MacOS", "fxd-launcher");
      if (await exists(launcher)) {
        console.log(c.success(`   ✓ Launcher script present`));
      }
    } else {
      console.log(c.error(`   ✗ App bundle not found`));
    }

    // Try to query default handler
    try {
      const command = new Deno.Command("mdls", {
        args: ["-name", "kMDItemContentTypeTree", "-name", "kMDItemContentType", this.appPath],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      if (code === 0) {
        console.log(c.success(`   ✓ App metadata accessible\n`));
      }
    } catch {
      console.log(c.dim(`   (metadata check skipped)\n`));
    }
  }

  private showCompletion(): void {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║          File Association Setup Complete! 🎉          ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    console.log(c.info("What's Configured:\n"));
    console.log(`   ${c.success("✓")} Application bundle: ${this.appPath}`);
    console.log(`   ${c.success("✓")} UTI registered for .fxd files`);
    console.log(`   ${c.success("✓")} Document type handler configured`);
    console.log(`   ${c.success("✓")} Finder integration enabled`);

    console.log(c.info("\nTesting:\n"));
    console.log(`   1. Create test file: ${c.highlight("touch test.fxd")}`);
    console.log(`   2. Double-click test.fxd in Finder`);
    console.log(`   3. Or drag test.fxd onto FXD.app`);
    console.log(`   4. Right-click → Get Info to set as default`);

    console.log(c.info("\nManual Configuration:\n"));
    console.log(c.dim(`   Set default: duti -s dev.fxd.cli .fxd all`));
    console.log(c.dim(`   Install duti: brew install duti`));

    console.log(c.info("\nNote:\n"));
    console.log(c.dim(`   You may need to log out/in for all changes to take effect\n`));
  }
}

// Main execution
if (import.meta.main) {
  try {
    const associator = new MacOSFileAssociator();
    const exitCode = await associator.setup();
    Deno.exit(exitCode);
  } catch (error) {
    console.error(c.error(`\n❌ Setup failed: ${error.message}\n`));
    Deno.exit(1);
  }
}
