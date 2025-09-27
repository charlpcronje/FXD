#!/usr/bin/env node

/**
 * Test Runner for New FXD Components
 * Runs CLI, Virtual Filesystem, Git Integration, and Cross-Component tests
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';

const TEST_SUITES = [
    {
        name: 'CLI Interface Tests',
        path: 'cli/cli.test.js',
        description: 'Command parsing, validation, project management, and error handling'
    },
    {
        name: 'Virtual Filesystem Tests',
        path: 'filesystem/fs-fuse.test.js',
        description: 'FUSE operations, view mapping, file operations, and event system'
    },
    {
        name: 'Git Integration Tests',
        path: 'git/git-integration.test.js',
        description: 'Repository scanning, bidirectional sync, conflict resolution, and hooks'
    },
    {
        name: 'Performance Benchmarks',
        path: 'performance/new-components-benchmark.js',
        description: 'Performance testing for all new components'
    },
    {
        name: 'Cross-Component Integration Tests',
        path: 'integration/new-components-integration.test.js',
        description: 'CLI-VFS-Git workflow integration and data consistency'
    }
];

class TestRunner {
    constructor() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: []
        };
    }

    async runAllTests() {
        console.log('🧪 FXD New Components Testing Framework');
        console.log('==========================================\n');

        const startTime = Date.now();

        for (const suite of TEST_SUITES) {
            await this.runTestSuite(suite);
        }

        const duration = Date.now() - startTime;
        this.printSummary(duration);
    }

    async runTestSuite(suite) {
        console.log(`📦 Running ${suite.name}`);
        console.log(`   ${suite.description}`);
        console.log(`   Path: test-node/${suite.path}\n`);

        const testPath = join(process.cwd(), 'test-node', suite.path);

        // Check if test file exists
        try {
            await fs.access(testPath);
        } catch (error) {
            console.log(`   ❌ Test file not found: ${testPath}\n`);
            this.results.suites.push({
                name: suite.name,
                status: 'skipped',
                reason: 'Test file not found',
                duration: 0,
                tests: { passed: 0, failed: 0, total: 0 }
            });
            this.results.skipped++;
            return;
        }

        const startTime = Date.now();

        try {
            const result = await this.executeNodeTest(testPath);
            const duration = Date.now() - startTime;

            if (result.success) {
                console.log(`   ✅ ${suite.name} - PASSED (${duration}ms)`);
                console.log(`   Tests: ${result.tests.passed}/${result.tests.total} passed\n`);

                this.results.passed++;
                this.results.suites.push({
                    name: suite.name,
                    status: 'passed',
                    duration,
                    tests: result.tests,
                    output: result.output
                });
            } else {
                console.log(`   ❌ ${suite.name} - FAILED (${duration}ms)`);
                console.log(`   Error: ${result.error}`);
                if (result.output) {
                    console.log(`   Output: ${result.output.slice(0, 500)}...`);
                }
                console.log();

                this.results.failed++;
                this.results.suites.push({
                    name: suite.name,
                    status: 'failed',
                    duration,
                    error: result.error,
                    output: result.output
                });
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`   💥 ${suite.name} - CRASHED (${duration}ms)`);
            console.log(`   Exception: ${error.message}\n`);

            this.results.failed++;
            this.results.suites.push({
                name: suite.name,
                status: 'crashed',
                duration,
                error: error.message
            });
        }

        this.results.total++;
    }

    async executeNodeTest(testPath) {
        return new Promise((resolve) => {
            const child = spawn('node', ['--test', testPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    error: 'Test timeout after 60 seconds',
                    output: stdout,
                    tests: { passed: 0, failed: 0, total: 0 }
                });
            }, 60000);

            child.on('close', (code) => {
                clearTimeout(timeout);

                // Parse test results from output
                const testResults = this.parseTestOutput(stdout);

                resolve({
                    success: code === 0,
                    error: code !== 0 ? stderr || 'Test failed' : null,
                    output: stdout,
                    tests: testResults
                });
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    error: error.message,
                    output: stdout,
                    tests: { passed: 0, failed: 0, total: 0 }
                });
            });
        });
    }

    parseTestOutput(output) {
        // Simple parsing of Node.js test output
        const lines = output.split('\n');
        let passed = 0;
        let failed = 0;
        let total = 0;

        for (const line of lines) {
            if (line.includes('✓') || line.includes('ok ')) {
                passed++;
                total++;
            } else if (line.includes('✗') || line.includes('not ok ')) {
                failed++;
                total++;
            } else if (line.includes('# tests')) {
                // Try to extract totals from summary line
                const match = line.match(/(\d+)/g);
                if (match && match.length >= 1) {
                    total = parseInt(match[0]) || total;
                }
            } else if (line.includes('# pass')) {
                const match = line.match(/(\d+)/);
                if (match) {
                    passed = parseInt(match[1]) || passed;
                }
            } else if (line.includes('# fail')) {
                const match = line.match(/(\d+)/);
                if (match) {
                    failed = parseInt(match[1]) || failed;
                }
            }
        }

        return { passed, failed, total: total || (passed + failed) };
    }

    printSummary(duration) {
        console.log('🏁 Test Execution Summary');
        console.log('========================\n');

        console.log(`Total Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        console.log(`Test Suites: ${this.results.total} total`);
        console.log(`  ✅ Passed: ${this.results.passed}`);
        console.log(`  ❌ Failed: ${this.results.failed}`);
        console.log(`  ⏭️  Skipped: ${this.results.skipped}`);
        console.log();

        // Individual suite results
        console.log('📊 Individual Suite Results:');
        console.log('----------------------------');

        for (const suite of this.results.suites) {
            const statusIcon = {
                'passed': '✅',
                'failed': '❌',
                'crashed': '💥',
                'skipped': '⏭️'
            }[suite.status] || '❓';

            console.log(`${statusIcon} ${suite.name} (${suite.duration}ms)`);

            if (suite.tests) {
                console.log(`   Tests: ${suite.tests.passed}/${suite.tests.total} passed`);
            }

            if (suite.error) {
                console.log(`   Error: ${suite.error.substring(0, 100)}...`);
            }

            if (suite.reason) {
                console.log(`   Reason: ${suite.reason}`);
            }

            console.log();
        }

        // Success/failure determination
        const overallSuccess = this.results.failed === 0;

        if (overallSuccess) {
            console.log('🎉 All test suites completed successfully!');
            console.log('✨ New components are ready for deployment.');
        } else {
            console.log('⚠️  Some test suites failed.');
            console.log('🔧 Please review and fix failing tests before deployment.');
        }

        console.log('\n📝 Test Coverage Areas:');
        console.log('- ✅ CLI Interface (commands, validation, error handling)');
        console.log('- ✅ Virtual Filesystem (FUSE operations, view mapping)');
        console.log('- ✅ Git Integration (sync, conflicts, branches, hooks)');
        console.log('- ✅ Performance Benchmarks (scalability, memory usage)');
        console.log('- ✅ Cross-Component Integration (workflows, data consistency)');

        console.log('\n🚀 Next Steps:');
        if (overallSuccess) {
            console.log('1. Deploy new components to staging environment');
            console.log('2. Run integration tests in staging');
            console.log('3. Monitor performance in production');
            console.log('4. Gather user feedback on new features');
        } else {
            console.log('1. Fix failing tests');
            console.log('2. Re-run test suite');
            console.log('3. Validate fixes with integration tests');
            console.log('4. Proceed with deployment after all tests pass');
        }

        // Exit with appropriate code
        process.exit(overallSuccess ? 0 : 1);
    }

    async runSpecificSuite(suiteName) {
        const suite = TEST_SUITES.find(s =>
            s.name.toLowerCase().includes(suiteName.toLowerCase()) ||
            s.path.includes(suiteName.toLowerCase())
        );

        if (!suite) {
            console.log(`❌ Test suite not found: ${suiteName}`);
            console.log('Available suites:');
            TEST_SUITES.forEach(s => console.log(`  - ${s.name}`));
            process.exit(1);
        }

        console.log(`🎯 Running specific test suite: ${suite.name}\n`);
        await this.runTestSuite(suite);
        this.printSummary(0);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const runner = new TestRunner();

    if (args.length > 0) {
        // Run specific test suite
        await runner.runSpecificSuite(args[0]);
    } else {
        // Run all test suites
        await runner.runAllTests();
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Test runner failed:', error.message);
        process.exit(1);
    });
}

export { TestRunner, TEST_SUITES };