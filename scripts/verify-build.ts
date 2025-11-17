#!/usr/bin/env deno run --allow-all

// @agent: agent-build
// @timestamp: 2025-10-02
// @task: TRACK-G-BUILD.md - Build verification script

/**
 * FXD Build Verification Script
 * Checks that all build outputs are present and valid
 */

interface CheckResult {
  name: string;
  status: "✅" | "❌" | "⚠️";
  details: string;
}

const results: CheckResult[] = [];

async function checkFile(path: string, name: string, minSize?: number): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (stat.isFile) {
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      if (minSize && stat.size < minSize) {
        results.push({
          name,
          status: "⚠️",
          details: `${sizeMB} MB (smaller than expected)`
        });
      } else {
        results.push({
          name,
          status: "✅",
          details: `${sizeMB} MB`
        });
      }
    } else {
      results.push({
        name,
        status: "❌",
        details: "Not a file"
      });
    }
  } catch {
    results.push({
      name,
      status: "❌",
      details: "Not found"
    });
  }
}

async function checkDirectory(path: string, name: string): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (stat.isDirectory) {
      let fileCount = 0;
      for await (const _ of Deno.readDir(path)) {
        fileCount++;
      }
      results.push({
        name,
        status: "✅",
        details: `${fileCount} files`
      });
    } else {
      results.push({
        name,
        status: "❌",
        details: "Not a directory"
      });
    }
  } catch {
    results.push({
      name,
        status: "❌",
      details: "Not found"
    });
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                  FXD BUILD VERIFICATION                            ║
╚════════════════════════════════════════════════════════════════════╝
`);

  console.log("Checking build outputs...\n");

  // Check executables (minimum 50MB)
  const minExeSize = 50 * 1024 * 1024;
  await checkFile("dist/fxd-windows-x64.exe", "Windows x64 Executable", minExeSize);
  await checkFile("dist/fxd-macos-x64", "macOS Intel Executable", minExeSize);
  await checkFile("dist/fxd-macos-arm64", "macOS ARM64 Executable", minExeSize);
  await checkFile("dist/fxd-linux-x64", "Linux x64 Executable", minExeSize);

  // Check distribution files
  await checkFile("dist/CHECKSUMS.txt", "Checksums File");
  await checkFile("dist/README.md", "Distribution README");
  await checkFile("dist/BUILD-REPORT.md", "Build Report");

  // Check NPM package structure
  await checkDirectory("dist/npm", "NPM Package Directory");
  await checkFile("dist/npm/package.json", "NPM package.json");
  await checkFile("dist/npm/README.md", "NPM README");
  await checkFile("dist/npm/LICENSE", "NPM LICENSE");
  await checkFile("dist/npm/index.js", "NPM index.js");
  await checkFile("dist/npm/postinstall.js", "NPM postinstall.js");
  await checkDirectory("dist/npm/bin", "NPM bin Directory");
  await checkFile("dist/npm/bin/fxd.js", "NPM bin wrapper");
  await checkDirectory("dist/npm/binaries", "NPM binaries Directory");

  // Check NPM binaries
  await checkFile("dist/npm/binaries/fxd-windows-x64.exe", "NPM Windows Binary", minExeSize);
  await checkFile("dist/npm/binaries/fxd-macos-x64", "NPM macOS Intel Binary", minExeSize);
  await checkFile("dist/npm/binaries/fxd-macos-arm64", "NPM macOS ARM Binary", minExeSize);
  await checkFile("dist/npm/binaries/fxd-linux-x64", "NPM Linux Binary", minExeSize);

  // Check build scripts
  await checkFile("scripts/build-executables.ts", "Executable Build Script");
  await checkFile("scripts/build-npm.ts", "NPM Build Script");
  await checkFile("scripts/build-all.ts", "Master Build Script");

  // Print results
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION RESULTS");
  console.log("=".repeat(70) + "\n");

  let maxNameLength = 0;
  for (const result of results) {
    if (result.name.length > maxNameLength) {
      maxNameLength = result.name.length;
    }
  }

  for (const result of results) {
    const namePadded = result.name.padEnd(maxNameLength + 2);
    console.log(`${result.status} ${namePadded} ${result.details}`);
  }

  // Summary
  const successCount = results.filter(r => r.status === "✅").length;
  const warningCount = results.filter(r => r.status === "⚠️").length;
  const failCount = results.filter(r => r.status === "❌").length;
  const totalCount = results.length;

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70) + "\n");

  console.log(`   Total Checks:  ${totalCount}`);
  console.log(`   ✅ Passed:     ${successCount}`);
  console.log(`   ⚠️  Warnings:   ${warningCount}`);
  console.log(`   ❌ Failed:     ${failCount}`);
  console.log();

  if (failCount === 0 && warningCount === 0) {
    console.log("🎉 ALL CHECKS PASSED!");
    console.log("✅ Build is ready for distribution");
    console.log();
    return 0;
  } else if (failCount === 0) {
    console.log("⚠️  BUILD COMPLETE WITH WARNINGS");
    console.log("   Review warnings above before distribution");
    console.log();
    return 0;
  } else {
    console.log("❌ BUILD VERIFICATION FAILED");
    console.log("   Fix failed checks before distribution");
    console.log();
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
