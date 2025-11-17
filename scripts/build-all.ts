#!/usr/bin/env deno run --allow-all

// @agent: agent-build
// @timestamp: 2025-10-02
// @task: TRACK-G-BUILD.md - Master build script

/**
 * FXD Master Build Script
 * Builds all executables and NPM package
 * Usage: deno run --allow-all scripts/build-all.ts
 */

async function runScript(name: string, scriptPath: string): Promise<boolean> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 Running: ${name}`);
  console.log(`${'='.repeat(70)}\n`);

  const command = new Deno.Command("deno", {
    args: ["run", "--allow-all", scriptPath],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();

  if (code === 0) {
    console.log(`\n✅ ${name} completed successfully`);
    return true;
  } else {
    console.error(`\n❌ ${name} failed with code ${code}`);
    return false;
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    FXD MASTER BUILD SYSTEM                         ║
║                    Building All Distributions                      ║
╚════════════════════════════════════════════════════════════════════╝
`);

  const startTime = Date.now();
  const results: { name: string; success: boolean }[] = [];

  // Step 1: Build executables
  const executablesSuccess = await runScript(
    "Build Executables",
    "scripts/build-executables.ts"
  );
  results.push({ name: "Executables (Win/Mac/Linux)", success: executablesSuccess });

  // Step 2: Build NPM package
  const npmSuccess = await runScript(
    "Build NPM Package",
    "scripts/build-npm.ts"
  );
  results.push({ name: "NPM Package", success: npmSuccess });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 BUILD SUMMARY`);
  console.log(`${'='.repeat(70)}\n`);

  results.forEach(({ name, success }) => {
    const status = success ? "✅ Success" : "❌ Failed";
    console.log(`   ${status.padEnd(12)} - ${name}`);
  });

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log();
  console.log(`   Completed: ${successCount}/${totalCount}`);
  console.log(`   Duration:  ${duration}s`);
  console.log();

  if (successCount === totalCount) {
    console.log(`${'='.repeat(70)}`);
    console.log(`🎉 ALL BUILDS COMPLETED SUCCESSFULLY!`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`📦 Deliverables:`);
    console.log(`   • dist/fxd-windows-x64.exe`);
    console.log(`   • dist/fxd-macos-x64`);
    console.log(`   • dist/fxd-macos-arm64`);
    console.log(`   • dist/fxd-linux-x64`);
    console.log(`   • dist/npm/ (NPM package ready)`);
    console.log();
    console.log(`🎯 Next steps:`);
    console.log(`   • Test executables: ./dist/fxd-{platform} help`);
    console.log(`   • Create NPM archive: cd dist/npm && npm pack`);
    console.log(`   • Publish to NPM: cd dist/npm && npm publish`);
    console.log(`   • Create GitHub release with dist/ contents`);
    console.log();
    return 0;
  } else {
    console.log(`${'='.repeat(70)}`);
    console.log(`⚠️  SOME BUILDS FAILED`);
    console.log(`${'='.repeat(70)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
