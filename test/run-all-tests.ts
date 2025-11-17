/**
 * FXD Test Runner - Auto-Discovery with JSON Reporting
 *
 * Features:
 * - Auto-discovers all *.test.ts files
 * - Generates JSON and console reports
 * - Per-file, per-module, and global statistics
 * - Saves detailed logs to test-results/
 *
 * Usage:
 *   deno run -A test/run-all-tests.ts          # Run all tests
 *   deno run -A test/run-all-tests.ts --dry-run # List tests only
 */

import { walk } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { relative } from "https://deno.land/std@0.208.0/path/mod.ts";

interface FileReport {
  file: string;
  module: string;
  status: "passed" | "failed" | "error";
  tests: number;
  passed: number;
  failed: number;
  duration: number;
  errors: string[];
  output: string;
}

interface TestReport {
  timestamp: string;
  totalFiles: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  files: FileReport[];
}

// Auto-discover test files
async function discoverTests(): Promise<string[]> {
  const tests: string[] = [];
  const testDir = "./test";

  for await (const entry of walk(testDir, {
    exts: [".ts"],
    skip: [/node_modules/, /\.d\.ts$/, /run-all-tests\.ts$/, /report-generator\.ts$/],
  })) {
    if (entry.isFile && entry.name.endsWith(".test.ts")) {
      tests.push(relative(Deno.cwd(), entry.path));
    }
  }

  return tests.sort();
}

// Extract module name from filename
function getModuleName(filePath: string): string {
  // Handle both forward and back slashes (Windows)
  const filename = filePath.split(/[\/\\]/).pop() || "";
  return filename.replace(".test.ts", "").replace("fx-", "");
}

// Parse test output to count tests
function parseTestOutput(output: string): { total: number; passed: number; failed: number } {
  // Deno test output format: "test result: ok. X passed; Y failed; Z ignored"
  const match = output.match(/(\d+) passed.*?(\d+) failed/);
  if (match) {
    const passed = parseInt(match[1]);
    const failed = parseInt(match[2]);
    return { total: passed + failed, passed, failed };
  }

  // Fallback: count individual test lines
  const testLines = output.match(/^test .+\.\.\. (ok|FAILED)/gm) || [];
  const passed = testLines.filter(l => l.includes("ok")).length;
  const failed = testLines.filter(l => l.includes("FAILED")).length;

  return { total: testLines.length, passed, failed };
}

// Run a single test file
async function runTest(filePath: string): Promise<FileReport> {
  const startTime = Date.now();
  const module = getModuleName(filePath);

  try {
    const command = new Deno.Command("deno", {
      args: ["test", "-A", "--no-check", filePath],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);
    const allOutput = output + errorOutput;

    const duration = Date.now() - startTime;
    const { total, passed, failed } = parseTestOutput(allOutput);

    // Extract error messages
    const errors: string[] = [];
    if (code !== 0) {
      const errorLines = allOutput.split("\n").filter(line =>
        line.includes("error:") || line.includes("FAILED") || line.includes("Error")
      );
      errors.push(...errorLines);
    }

    return {
      file: filePath,
      module,
      status: code === 0 ? "passed" : "failed",
      tests: total || 1,
      passed: passed || (code === 0 ? 1 : 0),
      failed: failed || (code !== 0 ? 1 : 0),
      duration,
      errors,
      output: allOutput,
    };
  } catch (error) {
    return {
      file: filePath,
      module,
      status: "error",
      tests: 1,
      passed: 0,
      failed: 1,
      duration: Date.now() - startTime,
      errors: [String(error)],
      output: String(error),
    };
  }
}

// Save individual test log
async function saveTestLog(report: FileReport): Promise<void> {
  const dir = "./test-results";
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch {
    // Directory exists
  }

  const filename = `${dir}/${report.module}.log`;
  await Deno.writeTextFile(filename, report.output);
}

// Generate and save JSON report
async function saveJsonReport(report: TestReport): Promise<void> {
  const filename = "./test-results/report.json";
  await Deno.writeTextFile(filename, JSON.stringify(report, null, 2));
}

// Main execution
async function main() {
  const args = Deno.args;
  const dryRun = args.includes("--dry-run");

  console.log("🧪 FXD Test Runner");
  console.log("═".repeat(70));

  // Discover tests
  const testFiles = await discoverTests();
  console.log(`\n📁 Discovered ${testFiles.length} test files:\n`);
  testFiles.forEach(file => console.log(`   ${file}`));

  if (dryRun) {
    console.log("\n✅ Dry run complete. Use without --dry-run to execute tests.");
    return;
  }

  console.log("\n" + "═".repeat(70));
  console.log("🏃 Running tests...\n");

  // Run all tests
  const startTime = Date.now();
  const fileReports: FileReport[] = [];

  for (const file of testFiles) {
    console.log(`\n📝 ${file}`);
    console.log("─".repeat(70));

    const report = await runTest(file);
    fileReports.push(report);

    // Save individual log
    await saveTestLog(report);

    // Display result
    const icon = report.status === "passed" ? "✅" : "❌";
    console.log(`${icon} ${report.module}: ${report.passed}/${report.tests} passed (${report.duration}ms)`);

    if (report.errors.length > 0) {
      console.log("   Errors:");
      report.errors.slice(0, 3).forEach(err => console.log(`   - ${err}`));
      if (report.errors.length > 3) {
        console.log(`   ... and ${report.errors.length - 3} more errors`);
      }
    }
  }

  // Calculate totals
  const totalDuration = Date.now() - startTime;
  const totalTests = fileReports.reduce((sum, r) => sum + r.tests, 0);
  const totalPassed = fileReports.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = fileReports.reduce((sum, r) => sum + r.failed, 0);
  const failedFiles = fileReports.filter(r => r.status !== "passed").length;

  // Generate report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalFiles: testFiles.length,
    totalTests,
    passed: totalPassed,
    failed: totalFailed,
    skipped: 0,
    duration: totalDuration,
    files: fileReports,
  };

  // Save JSON report
  await saveJsonReport(report);

  // Display summary
  console.log("\n" + "═".repeat(70));
  console.log("📊 Test Results Summary");
  console.log("═".repeat(70));
  console.log(`Files:    ${testFiles.length} total, ${testFiles.length - failedFiles} passed, ${failedFiles} failed`);
  console.log(`Tests:    ${totalTests} total, ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log(`Reports:  test-results/report.json`);
  console.log("═".repeat(70));

  // Module breakdown
  console.log("\n📋 Per-Module Breakdown:");
  const moduleStats = new Map<string, { passed: number; failed: number; tests: number }>();

  for (const report of fileReports) {
    const stats = moduleStats.get(report.module) || { passed: 0, failed: 0, tests: 0 };
    stats.passed += report.passed;
    stats.failed += report.failed;
    stats.tests += report.tests;
    moduleStats.set(report.module, stats);
  }

  for (const [module, stats] of moduleStats) {
    const icon = stats.failed === 0 ? "✅" : "❌";
    const passRate = ((stats.passed / stats.tests) * 100).toFixed(1);
    console.log(`  ${icon} ${module.padEnd(20)} ${stats.passed}/${stats.tests} (${passRate}%)`);
  }

  console.log("\n");

  // Exit with appropriate code
  if (totalFailed > 0) {
    console.log("❌ Some tests failed. See test-results/*.log for details.");
    Deno.exit(1);
  } else {
    console.log("✅ All tests passed!");
    Deno.exit(0);
  }
}

// Run
if (import.meta.main) {
  main();
}
