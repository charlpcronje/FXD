#!/usr/bin/env deno run --allow-all

/**
 * @file build-cli.ts
 * @description Enhanced FXD CLI Build Script - Creates standalone binaries for all platforms
 * @agent Agent 3: CLI Excellence & System Integration
 * @timestamp 2025-11-20
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

// Color utilities for beautiful output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const c = {
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warning: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  highlight: (text: string) => `${colors.bright}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
};

interface Platform {
  os: string;
  target: string;
  ext: string;
  name: string;
  description: string;
}

const platforms: Platform[] = [
  {
    os: "windows",
    target: "x86_64-pc-windows-msvc",
    ext: ".exe",
    name: "fxd-windows-x64.exe",
    description: "Windows 64-bit (Intel/AMD)",
  },
  {
    os: "macos",
    target: "x86_64-apple-darwin",
    ext: "",
    name: "fxd-macos-x64",
    description: "macOS Intel (x86_64)",
  },
  {
    os: "macos",
    target: "aarch64-apple-darwin",
    ext: "",
    name: "fxd-macos-arm64",
    description: "macOS Apple Silicon (ARM64)",
  },
  {
    os: "linux",
    target: "x86_64-unknown-linux-gnu",
    ext: "",
    name: "fxd-linux-x64",
    description: "Linux 64-bit (GNU)",
  },
  {
    os: "linux",
    target: "aarch64-unknown-linux-gnu",
    ext: "",
    name: "fxd-linux-arm64",
    description: "Linux ARM64",
  },
];

interface BuildStats {
  platform: Platform;
  success: boolean;
  sizeMB: number;
  buildTime: number;
  error?: string;
}

class CLIBuilder {
  private buildDir = "build/cli";
  private sourceFile = "cli/fxd-enhanced.ts";
  private stats: BuildStats[] = [];

  async build(): Promise<number> {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║        FXD CLI Builder - Professional Edition          ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    // Step 1: Clean and prepare
    await this.clean();
    await this.prepare();

    // Step 2: Build for all platforms
    console.log(c.info("\n📦 Building binaries for all platforms...\n"));
    for (const platform of platforms) {
      await this.buildPlatform(platform);
    }

    // Step 3: Create additional assets
    await this.createChecksums();
    await this.createReadme();
    await this.createVersionFile();
    await this.packageRelease();

    // Step 4: Show summary
    this.showSummary();

    // Return exit code
    const successCount = this.stats.filter(s => s.success).length;
    return successCount === platforms.length ? 0 : 1;
  }

  private async clean(): Promise<void> {
    console.log(c.info("🧹 Cleaning build directory..."));
    try {
      await Deno.remove(this.buildDir, { recursive: true });
    } catch {
      // Directory doesn't exist
    }
    console.log(c.success("   ✓ Build directory cleaned\n"));
  }

  private async prepare(): Promise<void> {
    console.log(c.info("📁 Preparing build environment..."));
    await ensureDir(this.buildDir);
    await ensureDir(join(this.buildDir, "binaries"));
    await ensureDir(join(this.buildDir, "completions"));
    await ensureDir(join(this.buildDir, "installers"));
    console.log(c.success("   ✓ Build directories created\n"));
  }

  private async buildPlatform(platform: Platform): Promise<void> {
    const startTime = Date.now();
    const outputPath = join(this.buildDir, "binaries", platform.name);

    console.log(c.highlight(`🔨 Building: ${platform.description}`));
    console.log(c.dim(`   Target:   ${platform.target}`));
    console.log(c.dim(`   Output:   ${outputPath}`));

    const command = new Deno.Command("deno", {
      args: [
        "compile",
        "--allow-all",
        "--no-check",
        "--target", platform.target,
        "--output", outputPath,
        this.sourceFile,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    try {
      const process = command.spawn();
      const { code, stderr } = await process.output();
      const buildTime = Date.now() - startTime;

      if (code === 0) {
        // Success - get file size
        try {
          const fullPath = outputPath + platform.ext;
          const stat = await Deno.stat(fullPath);
          const sizeMB = stat.size / 1024 / 1024;

          this.stats.push({
            platform,
            success: true,
            sizeMB,
            buildTime,
          });

          console.log(c.success(`   ✓ Built successfully`));
          console.log(c.dim(`   Size:     ${sizeMB.toFixed(2)} MB`));
          console.log(c.dim(`   Time:     ${(buildTime / 1000).toFixed(2)}s\n`));
        } catch {
          // Can't stat file (cross-compilation)
          this.stats.push({
            platform,
            success: true,
            sizeMB: 0,
            buildTime,
          });
          console.log(c.success(`   ✓ Built successfully (cross-compiled)\n`));
        }
      } else {
        const error = new TextDecoder().decode(stderr);
        this.stats.push({
          platform,
          success: false,
          sizeMB: 0,
          buildTime,
          error,
        });
        console.log(c.error(`   ✗ Build failed`));
        console.log(c.dim(`   ${error.split('\n')[0]}\n`));
      }
    } catch (error) {
      const buildTime = Date.now() - startTime;
      this.stats.push({
        platform,
        success: false,
        sizeMB: 0,
        buildTime,
        error: (error as Error).message,
      });
      console.log(c.error(`   ✗ Build failed: ${(error as Error).message}\n`));
    }
  }

  private async createChecksums(): Promise<void> {
    console.log(c.info("🔐 Generating checksums..."));

    const binariesDir = join(this.buildDir, "binaries");
    const checksumFile = join(this.buildDir, "CHECKSUMS.txt");
    const checksums: string[] = [
      "# FXD CLI Binaries - SHA-256 Checksums",
      `# Generated: ${new Date().toISOString()}`,
      "",
    ];

    for (const stat of this.stats) {
      if (stat.success) {
        const filePath = join(binariesDir, stat.platform.name + stat.platform.ext);
        try {
          const data = await Deno.readFile(filePath);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          checksums.push(`${hashHex}  ${stat.platform.name}${stat.platform.ext}`);
          console.log(c.dim(`   ✓ ${stat.platform.name}`));
        } catch {
          // Skip if file doesn't exist (cross-compile)
        }
      }
    }

    await Deno.writeTextFile(checksumFile, checksums.join('\n'));
    console.log(c.success(`   ✓ Checksums saved\n`));
  }

  private async createReadme(): Promise<void> {
    console.log(c.info("📝 Creating README..."));

    const readme = `# FXD Command Line Interface

## Build Information

- **Built:** ${new Date().toISOString()}
- **Deno Version:** ${Deno.version.deno}
- **V8 Version:** ${Deno.version.v8}
- **TypeScript Version:** ${Deno.version.typescript}

## Available Binaries

${platforms.map(p => `- **${p.name}** - ${p.description}`).join('\n')}

## Quick Installation

### Windows
\`\`\`powershell
# Download and add to PATH
curl -O https://releases.fxd.dev/fxd-windows-x64.exe
move fxd-windows-x64.exe %USERPROFILE%\\bin\\fxd.exe
# Add %USERPROFILE%\\bin to your PATH
\`\`\`

### macOS (Intel)
\`\`\`bash
curl -O https://releases.fxd.dev/fxd-macos-x64
chmod +x fxd-macos-x64
sudo mv fxd-macos-x64 /usr/local/bin/fxd
\`\`\`

### macOS (Apple Silicon)
\`\`\`bash
curl -O https://releases.fxd.dev/fxd-macos-arm64
chmod +x fxd-macos-arm64
sudo mv fxd-macos-arm64 /usr/local/bin/fxd
\`\`\`

### Linux
\`\`\`bash
curl -O https://releases.fxd.dev/fxd-linux-x64
chmod +x fxd-linux-x64
sudo mv fxd-linux-x64 /usr/local/bin/fxd
\`\`\`

## Verification

Verify your download using SHA-256 checksums:

\`\`\`bash
# Windows (PowerShell)
Get-FileHash fxd-windows-x64.exe -Algorithm SHA256

# macOS/Linux
shasum -a 256 fxd-*
\`\`\`

Compare output with \`CHECKSUMS.txt\`.

## Usage

\`\`\`bash
fxd help                    # Show all commands
fxd version                 # Show version
fxd health                  # Check system health

# Project operations
fxd create my-project       # Create new project
fxd load my-project.fxd     # Load existing project
fxd save my-project.fxd     # Save project

# Import/Export
fxd import ./src            # Import directory
fxd export ./output         # Export to files

# File operations
fxd list                    # List all .fxd files
fxd stats project.fxd       # Show statistics
\`\`\`

## Shell Completions

Shell completion scripts are available in the \`completions/\` directory:

- **Bash:** \`cli/completions/fxd.bash\`
- **Zsh:** \`cli/completions/fxd.zsh\`
- **Fish:** \`cli/completions/fxd.fish\`
- **PowerShell:** \`cli/completions/fxd.ps1\`

### Installing Completions

#### Bash
\`\`\`bash
sudo cp completions/fxd.bash /etc/bash_completion.d/fxd
source ~/.bashrc
\`\`\`

#### Zsh
\`\`\`bash
cp completions/fxd.zsh ~/.zsh/completions/_fxd
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
source ~/.zshrc
\`\`\`

#### Fish
\`\`\`bash
cp completions/fxd.fish ~/.config/fish/completions/
\`\`\`

#### PowerShell
\`\`\`powershell
# Add to your PowerShell profile
notepad $PROFILE
# Add: . path\\to\\fxd.ps1
\`\`\`

## File Associations

To enable double-click opening of .fxd files, run the appropriate installer script:

- **Windows:** \`scripts/file-associations/windows-registry.ts\`
- **Linux:** \`scripts/file-associations/linux-desktop.ts\`
- **macOS:** \`scripts/file-associations/macos-plist.ts\`

## Documentation

Full documentation available at:
- [Installation Guide](../../docs/INSTALLATION-GUIDE.md)
- [CLI Reference](../../docs/CLI-REFERENCE.md)
- [Getting Started](../../docs/GETTING-STARTED-COMPLETE.md)

## Support

- **Issues:** https://github.com/fxd/fxd/issues
- **Documentation:** https://fxd.dev/docs
- **Community:** https://discord.gg/fxd

## License

MIT License - See LICENSE file for details.
`;

    await Deno.writeTextFile(join(this.buildDir, "README.md"), readme);
    console.log(c.success(`   ✓ README created\n`));
  }

  private async createVersionFile(): Promise<void> {
    console.log(c.info("📋 Creating version file..."));

    const version = {
      version: "2.0.0",
      codename: "Quantum CLI",
      buildDate: new Date().toISOString(),
      deno: Deno.version.deno,
      v8: Deno.version.v8,
      typescript: Deno.version.typescript,
      platforms: this.stats.map(s => ({
        name: s.platform.name,
        os: s.platform.os,
        target: s.platform.target,
        success: s.success,
        sizeMB: s.sizeMB,
        buildTimeMs: s.buildTime,
      })),
    };

    await Deno.writeTextFile(
      join(this.buildDir, "version.json"),
      JSON.stringify(version, null, 2)
    );
    console.log(c.success(`   ✓ Version file created\n`));
  }

  private async packageRelease(): Promise<void> {
    console.log(c.info("📦 Packaging release..."));

    // Copy additional files
    const filesToCopy = [
      { src: "README.md", dest: join(this.buildDir, "PROJECT-README.md") },
      { src: "LICENSE", dest: join(this.buildDir, "LICENSE"), optional: true },
      { src: "CHANGELOG.md", dest: join(this.buildDir, "CHANGELOG.md"), optional: true },
    ];

    for (const file of filesToCopy) {
      try {
        await Deno.copyFile(file.src, file.dest);
        console.log(c.dim(`   ✓ ${file.src}`));
      } catch {
        if (!file.optional) {
          console.log(c.warning(`   ⚠ ${file.src} not found`));
        }
      }
    }

    console.log(c.success(`   ✓ Release packaged\n`));
  }

  private showSummary(): void {
    console.log(c.highlight("\n╔════════════════════════════════════════════════════════╗"));
    console.log(c.highlight("║                   Build Summary                        ║"));
    console.log(c.highlight("╚════════════════════════════════════════════════════════╝\n"));

    const successCount = this.stats.filter(s => s.success).length;
    const failCount = this.stats.filter(s => !s.success).length;
    const totalSize = this.stats
      .filter(s => s.success)
      .reduce((sum, s) => sum + s.sizeMB, 0);
    const avgBuildTime = this.stats
      .filter(s => s.success)
      .reduce((sum, s) => sum + s.buildTime, 0) / successCount;

    // Platform results
    console.log(c.info("Platform Results:"));
    for (const stat of this.stats) {
      const status = stat.success
        ? c.success("✓ SUCCESS")
        : c.error("✗ FAILED");
      const size = stat.sizeMB > 0
        ? c.dim(` (${stat.sizeMB.toFixed(2)} MB)`)
        : "";
      console.log(`   ${status}  ${stat.platform.description}${size}`);
    }

    // Statistics
    console.log(c.info("\nStatistics:"));
    console.log(`   Total Platforms:    ${c.highlight(platforms.length.toString())}`);
    console.log(`   Successful Builds:  ${c.success(successCount.toString())}`);
    console.log(`   Failed Builds:      ${failCount > 0 ? c.error(failCount.toString()) : c.dim('0')}`);
    if (totalSize > 0) {
      console.log(`   Total Size:         ${c.highlight(totalSize.toFixed(2) + ' MB')}`);
      console.log(`   Average Build Time: ${c.highlight((avgBuildTime / 1000).toFixed(2) + 's')}`);
    }

    // Output location
    console.log(c.info("\nOutput Location:"));
    console.log(`   ${c.highlight(this.buildDir)}/`);

    // Final status
    console.log();
    if (successCount === platforms.length) {
      console.log(c.success("🎉 All builds completed successfully!"));
      console.log(c.info("📦 Binaries ready for distribution\n"));
    } else if (successCount > 0) {
      console.log(c.warning("⚠️  Some builds failed, but others succeeded"));
      console.log(c.info("📦 Partial distribution available\n"));
    } else {
      console.log(c.error("❌ All builds failed"));
      console.log(c.error("💥 Please check errors above\n"));
    }
  }
}

// Main execution
if (import.meta.main) {
  const builder = new CLIBuilder();
  const exitCode = await builder.build();
  Deno.exit(exitCode);
}
