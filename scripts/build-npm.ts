#!/usr/bin/env deno run --allow-all

// @agent: agent-build
// @timestamp: 2025-10-02
// @task: TRACK-G-BUILD.md - G.4 NPM package creation

/**
 * FXD NPM Package Builder
 * Creates an NPM package structure for distribution
 */

async function createPackageJson() {
  console.log("📦 Creating package.json...");

  const packageJson = {
    name: "fxd",
    version: "1.0.0",
    description: "FXD - Visual Code Management Platform with Quantum Computing capabilities",
    main: "index.js",
    type: "module",
    bin: {
      fxd: "./bin/fxd.js"
    },
    scripts: {
      test: "echo \"Error: no test specified\" && exit 1",
      install: "node postinstall.js"
    },
    keywords: [
      "fxd",
      "quantum",
      "code-management",
      "visualization",
      "3d",
      "snippets",
      "developer-tools"
    ],
    author: "FXD Team",
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/yourusername/fxd.git"
    },
    engines: {
      node: ">=16.0.0"
    },
    os: ["darwin", "linux", "win32"],
    cpu: ["x64", "arm64"]
  };

  await Deno.writeTextFile("dist/npm/package.json", JSON.stringify(packageJson, null, 2));
  console.log("✅ package.json created\n");
}

async function createBinWrapper() {
  console.log("📝 Creating bin wrapper...");

  const binWrapper = `#!/usr/bin/env node

// @agent: agent-build
// FXD Binary Wrapper for NPM

const { execFile } = require('child_process');
const path = require('path');
const os = require('os');

function getBinaryPath() {
  const platform = os.platform();
  const arch = os.arch();

  let binaryName;

  if (platform === 'win32') {
    binaryName = 'fxd-windows-x64.exe';
  } else if (platform === 'darwin') {
    if (arch === 'arm64') {
      binaryName = 'fxd-macos-arm64';
    } else {
      binaryName = 'fxd-macos-x64';
    }
  } else if (platform === 'linux') {
    binaryName = 'fxd-linux-x64';
  } else {
    console.error(\`Unsupported platform: \${platform}\`);
    process.exit(1);
  }

  return path.join(__dirname, '..', 'binaries', binaryName);
}

const binaryPath = getBinaryPath();
const args = process.argv.slice(2);

execFile(binaryPath, args, { stdio: 'inherit' }, (error) => {
  if (error) {
    console.error('Error executing FXD:', error.message);
    process.exit(1);
  }
});
`;

  await Deno.mkdir("dist/npm/bin", { recursive: true });
  await Deno.writeTextFile("dist/npm/bin/fxd.js", binWrapper);

  // Make executable on Unix systems
  try {
    await Deno.chmod("dist/npm/bin/fxd.js", 0o755);
  } catch {
    // Windows doesn't support chmod, that's fine
  }

  console.log("✅ Bin wrapper created\n");
}

async function createPostInstall() {
  console.log("📝 Creating postinstall script...");

  const postInstall = `// @agent: agent-build
// FXD Post-install script

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🎯 Installing FXD...');

const platform = os.platform();
const arch = os.arch();

console.log(\`Platform: \${platform}\`);
console.log(\`Architecture: \${arch}\`);

let binaryName;

if (platform === 'win32') {
  binaryName = 'fxd-windows-x64.exe';
} else if (platform === 'darwin') {
  if (arch === 'arm64') {
    binaryName = 'fxd-macos-arm64';
  } else {
    binaryName = 'fxd-macos-x64';
  }
} else if (platform === 'linux') {
  binaryName = 'fxd-linux-x64';
} else {
  console.error(\`❌ Unsupported platform: \${platform}\`);
  process.exit(1);
}

const binaryPath = path.join(__dirname, 'binaries', binaryName);

if (!fs.existsSync(binaryPath)) {
  console.error(\`❌ Binary not found: \${binaryPath}\`);
  console.error('Please report this issue to the FXD team.');
  process.exit(1);
}

// Make binary executable on Unix systems
if (platform !== 'win32') {
  try {
    fs.chmodSync(binaryPath, 0o755);
    console.log('✅ Binary made executable');
  } catch (err) {
    console.warn('⚠️  Could not make binary executable:', err.message);
  }
}

console.log('✅ FXD installed successfully!');
console.log('');
console.log('🎯 Quick start:');
console.log('   fxd help              # Show all commands');
console.log('   fxd create my-project # Create a new project');
console.log('   fxd visualize         # Start 3D visualizer');
console.log('');
console.log('🌐 Documentation: https://github.com/yourusername/fxd');
`;

  await Deno.writeTextFile("dist/npm/postinstall.js", postInstall);
  console.log("✅ Postinstall script created\n");
}

async function createNpmReadme() {
  console.log("📝 Creating NPM README...");

  const readme = `# FXD - Visual Code Management Platform

FXD is a revolutionary code management platform that combines quantum computing concepts with visual 3D representations of your code.

## Installation

\`\`\`bash
npm install -g fxd
\`\`\`

## Quick Start

\`\`\`bash
# Create a new FXD disk
fxd create my-project

# Import existing code
fxd import ./src

# List contents
fxd list

# Run a snippet
fxd run snippet-name

# Start 3D visualizer
fxd visualize
\`\`\`

## Features

- **Visual Code Management**: See your code as interconnected nodes in 3D space
- **Quantum-Inspired**: Node-based architecture inspired by quantum computing
- **Time Travel**: Navigate through code history with version timelines
- **Live Execution**: Watch code execute in real-time with visual feedback
- **Smart Import**: Automatically parse and organize your code into snippets
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Commands

### Disk Management
- \`fxd create <name>\` - Create a new FXD disk
- \`fxd import <path>\` - Import files into FXD
- \`fxd list\` - List disk contents
- \`fxd export <path>\` - Export FXD contents

### Execution
- \`fxd run <snippet>\` - Execute a snippet
- \`fxd visualize\` - Start 3D visualizer

### System
- \`fxd help\` - Show help
- \`fxd install\` - Install system integration

## Web Interface

FXD includes a web-based interface accessible at:
- Main UI: http://localhost:3000/app
- 3D Visualizer: http://localhost:8080

## Documentation

For full documentation, visit: https://github.com/yourusername/fxd

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: https://github.com/yourusername/fxd/issues
- Email: support@fxd.dev
`;

  await Deno.writeTextFile("dist/npm/README.md", readme);
  console.log("✅ NPM README created\n");
}

async function createIndex() {
  console.log("📝 Creating index.js...");

  const index = `// @agent: agent-build
// FXD NPM Package Index

console.log('FXD should be used via the command line.');
console.log('Run: fxd help');
console.log('');

module.exports = {
  version: '1.0.0',
  name: 'fxd'
};
`;

  await Deno.writeTextFile("dist/npm/index.js", index);
  console.log("✅ index.js created\n");
}

async function copyBinaries() {
  console.log("📦 Copying binaries...");

  await Deno.mkdir("dist/npm/binaries", { recursive: true });

  const binaries = [
    "fxd-windows-x64.exe",
    "fxd-macos-x64",
    "fxd-macos-arm64",
    "fxd-linux-x64"
  ];

  let copiedCount = 0;

  for (const binary of binaries) {
    try {
      await Deno.copyFile(`dist/${binary}`, `dist/npm/binaries/${binary}`);
      console.log(`   ✓ ${binary}`);
      copiedCount++;
    } catch (error) {
      console.log(`   ⚠️  ${binary} - ${error.message}`);
    }
  }

  console.log(`✅ Copied ${copiedCount}/${binaries.length} binaries\n`);

  return copiedCount;
}

async function createLicense() {
  console.log("📝 Creating LICENSE...");

  const license = `MIT License

Copyright (c) 2025 FXD Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

  await Deno.writeTextFile("dist/npm/LICENSE", license);
  console.log("✅ LICENSE created\n");
}

async function main() {
  console.log("🚀 FXD NPM Package Builder\n");
  console.log("=" .repeat(50));
  console.log();

  try {
    // Create NPM directory
    await Deno.mkdir("dist/npm", { recursive: true });

    // Create all package files
    await createPackageJson();
    await createBinWrapper();
    await createPostInstall();
    await createNpmReadme();
    await createIndex();
    await createLicense();

    // Copy binaries
    const binaryCount = await copyBinaries();

    if (binaryCount === 0) {
      console.log("⚠️  WARNING: No binaries found!");
      console.log("Run 'deno run -A scripts/build-executables.ts' first");
      return 1;
    }

    console.log("=" .repeat(50));
    console.log("\n🎉 NPM package created successfully!");
    console.log("📦 Package location: ./dist/npm/");
    console.log("\n🎯 Next steps:");
    console.log("   cd dist/npm");
    console.log("   npm pack              # Create .tgz archive");
    console.log("   npm publish           # Publish to NPM registry");
    console.log("\n   OR test locally:");
    console.log("   npm install -g .      # Install from local directory");
    console.log();

    return 0;

  } catch (error) {
    console.error("❌ Error creating NPM package:", error.message);
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
