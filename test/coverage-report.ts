// ═══════════════════════════════════════════════════════════════
// @agent: agent-test-infra
// @timestamp: 2025-10-02T07:38:00Z
// @task: TRACK-A-TESTS.md#A.5
// @status: complete
// @notes: Created coverage reporting script
// ═══════════════════════════════════════════════════════════════

/**
 * Coverage Reporter
 * Generates test coverage report for FXD project
 *
 * Usage: deno run -A test/coverage-report.ts
 */

console.log("📊 Generating Test Coverage Report");
console.log("═".repeat(60));
console.log("");

// Run tests with coverage
console.log("🧪 Running tests with coverage...\n");
const testCommand = new Deno.Command("deno", {
  args: [
    "test",
    "-A",
    "--no-check",
    "--coverage=coverage",
    "test/"
  ],
  stdout: "inherit",
  stderr: "inherit",
});

const testResult = await testCommand.output();

if (testResult.code !== 0) {
  console.log("\n⚠️  Some tests failed, but continuing with coverage report...\n");
}

// Generate coverage report
console.log("📈 Generating coverage report...\n");
const coverageCommand = new Deno.Command("deno", {
  args: [
    "coverage",
    "coverage",
    "--lcov",
    "--output=coverage/lcov.info"
  ],
  stdout: "inherit",
  stderr: "inherit",
});

const coverageResult = await coverageCommand.output();

if (coverageResult.code === 0) {
  console.log("\n✅ Coverage report generated successfully!");
  console.log("═".repeat(60));
  console.log("📄 Report location: coverage/lcov.info");
  console.log("═".repeat(60));
} else {
  console.log("\n❌ Failed to generate coverage report");
  Deno.exit(1);
}

// Try to generate HTML report if possible
console.log("\n📊 Attempting to generate HTML coverage report...");
const htmlCommand = new Deno.Command("deno", {
  args: [
    "coverage",
    "coverage",
    "--html"
  ],
  stdout: "inherit",
  stderr: "inherit",
});

const htmlResult = await htmlCommand.output();

if (htmlResult.code === 0) {
  console.log("✅ HTML coverage report available");
} else {
  console.log("ℹ️  HTML coverage report not available (optional)");
}

console.log("\n");
