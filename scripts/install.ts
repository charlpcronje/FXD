#!/usr/bin/env deno run --allow-all

/**
 * @file install.ts
 * @description Cross-platform FXD CLI Installer - Installs binary and sets up PATH
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir, exists } from "https://deno.land/std@0.224.0/fs/mod.ts";

// Color utilities
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  success: (text: string) => `\x1b[32m${text}\x1b[0m`,
  error: (text: string) => `\x1b[31m${text}\x1b[0m`,
  warning: (text: string) => `\x1b[33m${text}\x1b[0m`,
  info: (text: string) => `\x1b[36m${text}\x1b[0m`,
  highlight: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

interface InstallConfig {
  os: string;
  arch: string;
  binName: string;
  installDir: string;
  completionsDir?: string;
  profileFile?: string;
}

class FXDInstaller {
  private config!: InstallConfig;
  private isAdmin = false;

  async install(): Promise<number> {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║            FXD CLI Installer v2.0                      ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    // Step 1: Detect system
    await this.detectSystem();
    await this.checkPermissions();

    // Step 2: Confirm installation
    if (!await this.confirmInstallation()) {
      console.log(c.warning("\n⚠️  Installation cancelled by user\n"));
      return 1;
    }

    // Step 3: Install binary
    await this.installBinary();

    // Step 4: Setup PATH
    await this.setupPath();

    // Step 5: Install completions
    await this.installCompletions();

    // Step 6: Setup file associations
    await this.setupFileAssociations();

    // Step 7: Verify installation
    await this.verify();

    // Step 8: Show next steps
    this.showNextSteps();

    return 0;
  }

  private async detectSystem(): Promise<void> {
    console.log(c.info("🔍 Detecting system..."));

    const os = Deno.build.os;
    const arch = Deno.build.arch;

    let binName: string;
    let installDir: string;
    let completionsDir: string | undefined;
    let profileFile: string | undefined;

    if (os === "windows") {
      binName = "fxd.exe";
      const userProfile = Deno.env.get("USERPROFILE") || "C:\\Users\\Default";
      installDir = join(userProfile, "AppData", "Local", "fxd", "bin");
      profileFile = join(userProfile, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    } else if (os === "darwin") {
      binName = "fxd";
      installDir = "/usr/local/bin";
      completionsDir = "/usr/local/share/zsh/site-functions";
      profileFile = join(Deno.env.get("HOME") || "/tmp", ".zshrc");
    } else {
      binName = "fxd";
      installDir = "/usr/local/bin";
      completionsDir = "/etc/bash_completion.d";
      profileFile = join(Deno.env.get("HOME") || "/tmp", ".bashrc");
    }

    this.config = {
      os,
      arch,
      binName,
      installDir,
      completionsDir,
      profileFile,
    };

    console.log(c.dim(`   OS:       ${os}`));
    console.log(c.dim(`   Arch:     ${arch}`));
    console.log(c.dim(`   Install:  ${installDir}`));
    console.log(c.success(`   ✓ System detected\n`));
  }

  private async checkPermissions(): Promise<void> {
    console.log(c.info("🔐 Checking permissions..."));

    // Try to detect admin/root
    if (this.config.os === "windows") {
      // On Windows, check if we can write to system directories
      try {
        const testPath = "C:\\Windows\\Temp\\.fxd-test";
        await Deno.writeTextFile(testPath, "test");
        await Deno.remove(testPath);
        this.isAdmin = true;
        console.log(c.success(`   ✓ Running with administrator privileges\n`));
      } catch {
        console.log(c.warning(`   ⚠ Not running as administrator`));
        console.log(c.dim(`   Will install to user directory\n`));
      }
    } else {
      // On Unix, check if we're root
      this.isAdmin = Deno.uid?.() === 0;
      if (this.isAdmin) {
        console.log(c.success(`   ✓ Running as root\n`));
      } else {
        console.log(c.warning(`   ⚠ Not running as root`));
        console.log(c.dim(`   May need sudo for system-wide installation\n`));
      }
    }
  }

  private async confirmInstallation(): Promise<boolean> {
    console.log(c.info("📋 Installation Plan:\n"));
    console.log(`   Binary:       ${c.highlight(this.config.binName)}`);
    console.log(`   Location:     ${c.highlight(this.config.installDir)}`);
    console.log(`   Completions:  ${this.config.completionsDir ? c.highlight(this.config.completionsDir) : c.dim('(skip)')}`);
    console.log(`   Profile:      ${this.config.profileFile ? c.highlight(this.config.profileFile) : c.dim('(skip)')}`);
    console.log();

    // In non-interactive mode, assume yes
    if (!Deno.stdin.isTerminal()) {
      console.log(c.warning("Running in non-interactive mode, assuming YES\n"));
      return true;
    }

    // Ask for confirmation
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    await Deno.stdout.write(encoder.encode(c.highlight("Proceed with installation? [Y/n] ")));

    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    const answer = decoder.decode(buf.subarray(0, n || 0)).trim().toLowerCase();

    return answer === '' || answer === 'y' || answer === 'yes';
  }

  private async installBinary(): Promise<void> {
    console.log(c.info("📦 Installing FXD binary..."));

    // Ensure install directory exists
    await ensureDir(this.config.installDir);

    // Determine source binary
    let sourceBinary: string;
    const buildDir = "build/cli/binaries";

    if (this.config.os === "windows") {
      sourceBinary = join(buildDir, "fxd-windows-x64.exe");
    } else if (this.config.os === "darwin") {
      if (this.config.arch === "aarch64") {
        sourceBinary = join(buildDir, "fxd-macos-arm64");
      } else {
        sourceBinary = join(buildDir, "fxd-macos-x64");
      }
    } else {
      if (this.config.arch === "aarch64") {
        sourceBinary = join(buildDir, "fxd-linux-arm64");
      } else {
        sourceBinary = join(buildDir, "fxd-linux-x64");
      }
    }

    // Check if source exists
    if (!await exists(sourceBinary)) {
      throw new Error(`Binary not found: ${sourceBinary}\nPlease run: deno run -A scripts/build-cli.ts`);
    }

    // Copy binary to install location
    const destPath = join(this.config.installDir, this.config.binName);
    await Deno.copyFile(sourceBinary, destPath);

    // Make executable on Unix
    if (this.config.os !== "windows") {
      await Deno.chmod(destPath, 0o755);
    }

    console.log(c.success(`   ✓ Binary installed to ${destPath}\n`));
  }

  private async setupPath(): Promise<void> {
    console.log(c.info("🛤️  Setting up PATH..."));

    if (this.config.os === "windows") {
      await this.setupWindowsPath();
    } else {
      await this.setupUnixPath();
    }
  }

  private async setupWindowsPath(): Promise<void> {
    // On Windows, we need to add to user PATH environment variable
    const pathToAdd = this.config.installDir;

    console.log(c.dim(`   Adding to PATH: ${pathToAdd}`));

    try {
      // Use PowerShell to add to user PATH
      const psCommand = `
        $oldPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
        if ($oldPath -notlike "*${pathToAdd}*") {
          $newPath = $oldPath + ';${pathToAdd}'
          [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
          Write-Output 'PATH updated'
        } else {
          Write-Output 'Already in PATH'
        }
      `;

      const command = new Deno.Command("powershell", {
        args: ["-Command", psCommand],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await command.output();
      const output = new TextDecoder().decode(stdout).trim();

      if (code === 0) {
        console.log(c.success(`   ✓ ${output}`));
        console.log(c.warning(`   ⚠ Restart your terminal to apply changes\n`));
      } else {
        console.log(c.warning(`   ⚠ Could not automatically update PATH`));
        console.log(c.info(`   Please manually add to PATH: ${pathToAdd}\n`));
      }
    } catch (error) {
      console.log(c.warning(`   ⚠ Error updating PATH: ${error.message}`));
      console.log(c.info(`   Please manually add to PATH: ${pathToAdd}\n`));
    }
  }

  private async setupUnixPath(): Promise<void> {
    // On Unix, if installed to /usr/local/bin, it's typically already in PATH
    if (this.config.installDir === "/usr/local/bin") {
      console.log(c.success(`   ✓ Installed to /usr/local/bin (already in PATH)\n`));
      return;
    }

    // Otherwise, need to add to profile
    if (!this.config.profileFile) {
      console.log(c.warning(`   ⚠ Could not determine profile file\n`));
      return;
    }

    try {
      const pathLine = `\nexport PATH="${this.config.installDir}:$PATH"\n`;

      // Check if already in profile
      let profileContent = "";
      try {
        profileContent = await Deno.readTextFile(this.config.profileFile);
      } catch {
        // File doesn't exist, will create
      }

      if (profileContent.includes(this.config.installDir)) {
        console.log(c.success(`   ✓ Already configured in ${this.config.profileFile}\n`));
      } else {
        // Append to profile
        await Deno.writeTextFile(this.config.profileFile, profileContent + pathLine);
        console.log(c.success(`   ✓ Added to ${this.config.profileFile}`));
        console.log(c.warning(`   ⚠ Run: source ${this.config.profileFile}\n`));
      }
    } catch (error) {
      console.log(c.warning(`   ⚠ Could not update profile: ${error.message}`));
      console.log(c.info(`   Please manually add: export PATH="${this.config.installDir}:$PATH"\n`));
    }
  }

  private async installCompletions(): Promise<void> {
    console.log(c.info("🎯 Installing shell completions..."));

    if (!this.config.completionsDir) {
      console.log(c.dim(`   Skipping (no completions dir for this platform)\n`));
      return;
    }

    try {
      await ensureDir(this.config.completionsDir);

      // Copy appropriate completion file
      if (this.config.os === "darwin") {
        // macOS uses zsh by default
        const src = "cli/completions/fxd.zsh";
        const dest = join(this.config.completionsDir, "_fxd");
        if (await exists(src)) {
          await Deno.copyFile(src, dest);
          console.log(c.success(`   ✓ Zsh completions installed\n`));
        } else {
          console.log(c.warning(`   ⚠ Completion file not found: ${src}\n`));
        }
      } else {
        // Linux uses bash by default
        const src = "cli/completions/fxd.bash";
        const dest = join(this.config.completionsDir, "fxd");
        if (await exists(src)) {
          await Deno.copyFile(src, dest);
          console.log(c.success(`   ✓ Bash completions installed\n`));
        } else {
          console.log(c.warning(`   ⚠ Completion file not found: ${src}\n`));
        }
      }
    } catch (error) {
      console.log(c.warning(`   ⚠ Could not install completions: ${error.message}\n`));
    }
  }

  private async setupFileAssociations(): Promise<void> {
    console.log(c.info("🔗 Setting up file associations..."));

    try {
      if (this.config.os === "windows") {
        const script = "scripts/file-associations/windows-registry.ts";
        if (await exists(script)) {
          console.log(c.dim(`   Running Windows registry script...`));
          const command = new Deno.Command("deno", {
            args: ["run", "--allow-all", script],
            stdout: "piped",
            stderr: "piped",
          });
          const { code } = await command.output();
          if (code === 0) {
            console.log(c.success(`   ✓ File associations configured\n`));
          } else {
            console.log(c.warning(`   ⚠ Could not configure file associations\n`));
          }
        } else {
          console.log(c.warning(`   ⚠ Association script not found\n`));
        }
      } else if (this.config.os === "darwin") {
        const script = "scripts/file-associations/macos-plist.ts";
        if (await exists(script)) {
          console.log(c.dim(`   Running macOS plist script...`));
          const command = new Deno.Command("deno", {
            args: ["run", "--allow-all", script],
            stdout: "piped",
            stderr: "piped",
          });
          const { code } = await command.output();
          if (code === 0) {
            console.log(c.success(`   ✓ File associations configured\n`));
          } else {
            console.log(c.warning(`   ⚠ Could not configure file associations\n`));
          }
        } else {
          console.log(c.warning(`   ⚠ Association script not found\n`));
        }
      } else {
        const script = "scripts/file-associations/linux-desktop.ts";
        if (await exists(script)) {
          console.log(c.dim(`   Running Linux desktop script...`));
          const command = new Deno.Command("deno", {
            args: ["run", "--allow-all", script],
            stdout: "piped",
            stderr: "piped",
          });
          const { code } = await command.output();
          if (code === 0) {
            console.log(c.success(`   ✓ File associations configured\n`));
          } else {
            console.log(c.warning(`   ⚠ Could not configure file associations\n`));
          }
        } else {
          console.log(c.warning(`   ⚠ Association script not found\n`));
        }
      }
    } catch (error) {
      console.log(c.warning(`   ⚠ Error setting up file associations: ${error.message}\n`));
    }
  }

  private async verify(): Promise<void> {
    console.log(c.info("✅ Verifying installation..."));

    const binPath = join(this.config.installDir, this.config.binName);

    // Check if binary exists
    if (await exists(binPath)) {
      console.log(c.success(`   ✓ Binary exists at ${binPath}`));

      // Try to run it
      try {
        const command = new Deno.Command(binPath, {
          args: ["version"],
          stdout: "piped",
          stderr: "piped",
        });

        const { code, stdout } = await command.output();
        if (code === 0) {
          const output = new TextDecoder().decode(stdout);
          console.log(c.success(`   ✓ Binary executes successfully`));
          console.log(c.dim(`   ${output.split('\n')[0]}\n`));
        } else {
          console.log(c.warning(`   ⚠ Binary exists but failed to execute\n`));
        }
      } catch (error) {
        console.log(c.warning(`   ⚠ Could not execute binary: ${error.message}\n`));
      }
    } else {
      console.log(c.error(`   ✗ Binary not found at ${binPath}\n`));
      throw new Error("Installation verification failed");
    }
  }

  private showNextSteps(): void {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║              Installation Complete! 🎉                  ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    console.log(c.info("Next Steps:\n"));

    if (this.config.os === "windows") {
      console.log(`   1. ${c.highlight("Restart your terminal")} to apply PATH changes`);
      console.log(`   2. Run: ${c.highlight("fxd version")} to verify`);
      console.log(`   3. Run: ${c.highlight("fxd help")} to see available commands`);
    } else {
      console.log(`   1. Run: ${c.highlight(`source ${this.config.profileFile}`)} to apply changes`);
      console.log(`   2. Run: ${c.highlight("fxd version")} to verify`);
      console.log(`   3. Run: ${c.highlight("fxd help")} to see available commands`);
    }

    console.log(c.info("\nQuick Start:\n"));
    console.log(`   ${c.highlight("fxd create my-project")}     # Create a new project`);
    console.log(`   ${c.highlight("fxd import ./src")}          # Import code`);
    console.log(`   ${c.highlight("fxd list")}                  # List all .fxd files`);
    console.log(`   ${c.highlight("fxd help")}                  # Show all commands`);

    console.log(c.info("\nDocumentation:\n"));
    console.log(`   Getting Started:  ${c.dim("docs/GETTING-STARTED-COMPLETE.md")}`);
    console.log(`   CLI Reference:    ${c.dim("docs/CLI-REFERENCE.md")}`);
    console.log(`   Installation:     ${c.dim("docs/INSTALLATION-GUIDE.md")}`);

    console.log();
  }
}

// Main execution
if (import.meta.main) {
  try {
    const installer = new FXDInstaller();
    const exitCode = await installer.install();
    Deno.exit(exitCode);
  } catch (error) {
    console.error(c.error(`\n❌ Installation failed: ${error.message}\n`));
    Deno.exit(1);
  }
}
