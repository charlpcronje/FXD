#!/usr/bin/env deno run --allow-all

// @agent: agent-build
// @timestamp: 2025-10-02
// @task: TRACK-G-BUILD.md - G.2 Build script for all platforms

/**
 * FXD Build Script - Creates executables for Windows, Mac, and Linux
 * Usage: deno run --allow-all scripts/build-executables.ts
 */

interface Platform {
  os: string;
  arch: string;
  ext: string;
  name: string;
}

const platforms: Platform[] = [
  { os: "x86_64-pc-windows-msvc", arch: "", ext: ".exe", name: "fxd-windows-x64.exe" },
  { os: "x86_64-apple-darwin", arch: "", ext: "", name: "fxd-macos-x64" },
  { os: "aarch64-apple-darwin", arch: "", ext: "", name: "fxd-macos-arm64" },
  { os: "x86_64-unknown-linux-gnu", arch: "", ext: "", name: "fxd-linux-x64" },
];

async function cleanDist() {
  console.log("🧹 Cleaning dist directory...");
  try {
    await Deno.remove("dist", { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
  await Deno.mkdir("dist", { recursive: true });
  console.log("✅ Dist directory ready\n");
}

async function buildPlatform(platform: Platform): Promise<boolean> {
  const target = platform.os;
  const output = `dist/${platform.name}`;

  console.log(`🔨 Building for ${platform.os}...`);
  console.log(`   Target: ${target}`);
  console.log(`   Output: ${output}`);

  const command = new Deno.Command("deno", {
    args: [
      "compile",
      "--allow-all",
      "--no-check",
      "--target", target,
      "--output", output,
      "fxd-cli.ts"
    ],
    stdout: "piped",
    stderr: "piped",
  });

  try {
    const process = command.spawn();
    const { code, stdout, stderr } = await process.output();

    if (code === 0) {
      console.log(`✅ Successfully built ${platform.name}`);

      // Check file size
      try {
        const stat = await Deno.stat(output + platform.ext);
        const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
        console.log(`   Size: ${sizeMB} MB\n`);
      } catch {
        console.log(`   (size check skipped)\n`);
      }

      return true;
    } else {
      console.error(`❌ Failed to build ${platform.name}`);
      console.error("STDERR:", new TextDecoder().decode(stderr));
      console.log();
      return false;
    }
  } catch (error) {
    console.error(`❌ Error building ${platform.name}:`, error.message);
    console.log();
    return false;
  }
}

async function createChecksums() {
  console.log("🔐 Creating checksums...");

  const checksumFile = "dist/CHECKSUMS.txt";
  let checksums = "# FXD Executable Checksums (SHA-256)\n\n";

  for await (const entry of Deno.readDir("dist")) {
    if (entry.isFile && entry.name.startsWith("fxd-")) {
      const filePath = `dist/${entry.name}`;
      const data = await Deno.readFile(filePath);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      checksums += `${hashHex}  ${entry.name}\n`;
      console.log(`   ✓ ${entry.name}`);
    }
  }

  await Deno.writeTextFile(checksumFile, checksums);
  console.log(`✅ Checksums saved to ${checksumFile}\n`);
}

async function createReadme() {
  console.log("📝 Creating distribution README...");

  const readme = `# FXD Executables

Built on: ${new Date().toISOString()}
Deno version: ${Deno.version.deno}

## Available Executables

- **fxd-windows-x64.exe** - Windows 64-bit
- **fxd-macos-x64** - macOS Intel (x86_64)
- **fxd-macos-arm64** - macOS Apple Silicon (ARM64)
- **fxd-linux-x64** - Linux 64-bit

## Installation

### Windows
1. Download \`fxd-windows-x64.exe\`
2. Rename to \`fxd.exe\` (optional)
3. Add to PATH or run directly

### macOS
1. Download appropriate version (Intel or ARM)
2. Make executable: \`chmod +x fxd-macos-*\`
3. Rename to \`fxd\`: \`mv fxd-macos-* fxd\`
4. Move to PATH: \`sudo mv fxd /usr/local/bin/\`

### Linux
1. Download \`fxd-linux-x64\`
2. Make executable: \`chmod +x fxd-linux-x64\`
3. Rename to \`fxd\`: \`mv fxd-linux-x64 fxd\`
4. Move to PATH: \`sudo mv fxd /usr/local/bin/\`

## Usage

\`\`\`bash
fxd help                  # Show help
fxd create my-project     # Create new FXD disk
fxd import ./src          # Import code
fxd list                  # List contents
fxd visualize             # Start visualizer
\`\`\`

## Verification

Verify checksums using:
\`\`\`bash
# Windows (PowerShell)
Get-FileHash fxd-windows-x64.exe -Algorithm SHA256

# macOS/Linux
shasum -a 256 fxd-*
\`\`\`

Compare with CHECKSUMS.txt

## License

See main repository for license information.
`;

  await Deno.writeTextFile("dist/README.md", readme);
  console.log("✅ README created\n");
}

async function main() {
  console.log("🚀 FXD Build System\n");
  console.log("=" .repeat(50));
  console.log();

  // Clean dist directory
  await cleanDist();

  // Build for all platforms
  const results: boolean[] = [];
  for (const platform of platforms) {
    const success = await buildPlatform(platform);
    results.push(success);
  }

  // Create checksums
  if (results.some(r => r)) {
    await createChecksums();
    await createReadme();
  }

  // Summary
  console.log("=" .repeat(50));
  console.log("\n📊 Build Summary:\n");

  platforms.forEach((platform, i) => {
    const status = results[i] ? "✅ Success" : "❌ Failed";
    console.log(`   ${status} - ${platform.name}`);
  });

  const successCount = results.filter(r => r).length;
  const totalCount = results.length;

  console.log();
  console.log(`Built ${successCount}/${totalCount} executables`);

  if (successCount === totalCount) {
    console.log("\n🎉 All builds completed successfully!");
    console.log("📦 Executables available in ./dist/");
    return 0;
  } else {
    console.log("\n⚠️  Some builds failed. Check errors above.");
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
