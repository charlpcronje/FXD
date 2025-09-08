#!/usr/bin/env -S deno run -A

/**
 * Test runner for FXD Phase 1 tests
 * Runs all test files and provides a summary
 */

import { bold, green, red, yellow } from "https://deno.land/std@0.208.0/fmt/colors.ts";

const testFiles = [
    "./test/fx-snippets.test.ts",
    "./test/fx-markers.test.ts", 
    "./test/fx-view.test.ts",
    "./test/fx-parse.test.ts",
    "./test/round-trip.test.ts"
];

console.log(bold("🧪 Running FXD Phase 1 Tests\n"));

let totalPassed = 0;
let totalFailed = 0;
let failedFiles: string[] = [];

for (const file of testFiles) {
    console.log(bold(`\n📁 Testing ${file}...`));
    
    const command = new Deno.Command("deno", {
        args: ["test", "-A", "--no-check", file],
        stdout: "piped",
        stderr: "piped",
    });
    
    const { code, stdout, stderr } = await command.output();
    
    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);
    
    // Parse test results
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    
    totalPassed += passed;
    totalFailed += failed;
    
    if (code === 0) {
        console.log(green(`✅ All tests passed (${passed} tests)`));
    } else {
        console.log(red(`❌ Tests failed (${failed} failed, ${passed} passed)`));
        failedFiles.push(file);
        
        // Show error details
        if (errorOutput) {
            console.log(yellow("\nError output:"));
            console.log(errorOutput);
        }
        
        // Show failed test details from stdout
        const lines = output.split("\n");
        const failureStart = lines.findIndex(line => line.includes("failures:"));
        if (failureStart !== -1) {
            console.log(yellow("\nFailure details:"));
            console.log(lines.slice(failureStart).join("\n"));
        }
    }
}

// Summary
console.log(bold("\n" + "=".repeat(50)));
console.log(bold("📊 Test Summary\n"));

console.log(`Total tests run: ${totalPassed + totalFailed}`);
console.log(green(`✅ Passed: ${totalPassed}`));

if (totalFailed > 0) {
    console.log(red(`❌ Failed: ${totalFailed}`));
    console.log(red("\nFailed files:"));
    failedFiles.forEach(file => console.log(red(`  - ${file}`)));
    Deno.exit(1);
} else {
    console.log(green("\n🎉 All tests passed!"));
}

console.log(bold("=".repeat(50)));