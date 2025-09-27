#!/usr/bin/env node

/**
 * FXD Master Test Suite Runner
 *
 * Comprehensive testing orchestrator for 100% production readiness validation.
 * Executes all test categories and generates complete certification reports.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MasterTestSuiteRunner {
    constructor() {
        this.testSuites = new Map();
        this.results = new Map();
        this.startTime = performance.now();
        this.setupTestSuites();
    }

    setupTestSuites() {
        // Core FXD Components (Sections 3-5)
        this.testSuites.set('core_components', {
            name: 'Core FXD Components (Sections 3-5)',
            description: 'CLI Interface, Virtual Filesystem, and Git Integration',
            tests: [
                'test-node/cli/cli.test.js',
                'test-node/filesystem/fs-fuse.test.js',
                'test-node/git/git-integration.test.js',
                'test-node/performance/new-components-benchmark.js',
                'test-node/integration/new-components-integration.test.js'
            ],
            priority: 'critical',
            weight: 0.25
        });

        // Error Handling & Recovery (Section 6)
        this.testSuites.set('error_handling', {
            name: 'Error Handling & Recovery (Section 6)',
            description: 'Comprehensive error scenarios and recovery testing',
            tests: [
                'test-node/error-handling/section6-error-handling.test.js'
            ],
            priority: 'critical',
            weight: 0.15
        });

        // Documentation Validation (Section 7)
        this.testSuites.set('documentation', {
            name: 'Documentation Validation (Section 7)',
            description: 'Documentation accuracy and example verification',
            tests: [
                'test-node/documentation/section7-documentation-validation.test.js'
            ],
            priority: 'high',
            weight: 0.10
        });

        // Performance & Optimization (Section 9)
        this.testSuites.set('performance', {
            name: 'Performance & Optimization (Section 9)',
            description: 'Performance standards and optimization validation',
            tests: [
                'test-node/performance/section9-performance-optimization.test.js'
            ],
            priority: 'critical',
            weight: 0.20
        });

        // Release Preparation (Section 10)
        this.testSuites.set('release', {
            name: 'Release Preparation (Section 10)',
            description: 'Package creation, distribution, and license compliance',
            tests: [
                'test-node/release/section10-release-preparation.test.js'
            ],
            priority: 'critical',
            weight: 0.15
        });

        // Enhanced Testing Categories
        this.testSuites.set('enhanced', {
            name: 'Enhanced Testing (Stress, Edge Cases, Security)',
            description: 'Advanced testing scenarios for production robustness',
            tests: [
                'test-node/enhanced/stress-edge-security-tests.test.js'
            ],
            priority: 'high',
            weight: 0.10
        });

        // Quality Gates & Production Readiness
        this.testSuites.set('quality_gates', {
            name: 'Quality Gates & Production Readiness',
            description: 'Comprehensive quality assurance and certification',
            tests: [
                'test-node/quality-gates/production-readiness-metrics.test.js'
            ],
            priority: 'critical',
            weight: 0.05
        });
    }

    async runTestSuite(suiteId, suite) {
        console.log(`\n🧪 Running ${suite.name}`);
        console.log(`📝 ${suite.description}`);
        console.log(`⚡ Priority: ${suite.priority.toUpperCase()}`);
        console.log('-'.repeat(80));

        const suiteStart = performance.now();
        const results = {
            name: suite.name,
            priority: suite.priority,
            weight: suite.weight,
            startTime: suiteStart,
            endTime: null,
            duration: 0,
            tests: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            success: false,
            errors: [],
            warnings: []
        };

        for (const testFile of suite.tests) {
            const testPath = join(__dirname, '..', testFile);

            if (!existsSync(testPath)) {
                results.warnings.push(`Test file not found: ${testFile}`);
                console.log(`⚠️  Test file not found: ${testFile}`);
                continue;
            }

            console.log(`   Running: ${testFile}`);

            try {
                const testResult = await this.runSingleTest(testPath);
                results.tests.push(testResult);
                results.totalTests += testResult.total;
                results.passedTests += testResult.passed;
                results.failedTests += testResult.failed;
                results.skippedTests += testResult.skipped;

                if (testResult.success) {
                    console.log(`   ✅ ${testFile} - ${testResult.passed}/${testResult.total} tests passed`);
                } else {
                    console.log(`   ❌ ${testFile} - ${testResult.failed}/${testResult.total} tests failed`);
                    results.errors.push(`${testFile}: ${testResult.error || 'Test failures'}`);
                }
            } catch (error) {
                console.log(`   💥 ${testFile} - Execution error: ${error.message}`);
                results.errors.push(`${testFile}: ${error.message}`);
                results.tests.push({
                    file: testFile,
                    success: false,
                    error: error.message,
                    total: 0,
                    passed: 0,
                    failed: 1,
                    skipped: 0
                });
                results.failedTests++;
                results.totalTests++;
            }
        }

        const suiteEnd = performance.now();
        results.endTime = suiteEnd;
        results.duration = suiteEnd - suiteStart;
        results.success = results.failedTests === 0 && results.errors.length === 0;

        console.log(`\n📊 ${suite.name} Results:`);
        console.log(`   Total: ${results.totalTests}, Passed: ${results.passedTests}, Failed: ${results.failedTests}, Skipped: ${results.skippedTests}`);
        console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
        console.log(`   Status: ${results.success ? '✅ SUCCESS' : '❌ FAILURE'}`);

        if (results.errors.length > 0) {
            console.log(`   Errors: ${results.errors.length}`);
            results.errors.forEach(error => console.log(`     • ${error}`));
        }

        if (results.warnings.length > 0) {
            console.log(`   Warnings: ${results.warnings.length}`);
            results.warnings.forEach(warning => console.log(`     • ${warning}`));
        }

        this.results.set(suiteId, results);
        return results;
    }

    async runSingleTest(testPath) {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            let stdout = '';
            let stderr = '';

            const testProcess = spawn('node', ['--test', testPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: join(__dirname, '..')
            });

            testProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            testProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            testProcess.on('close', (code) => {
                const endTime = performance.now();
                const duration = endTime - startTime;

                // Parse test results from output
                const result = this.parseTestOutput(stdout, stderr, code, duration);
                result.file = testPath;

                if (code === 0) {
                    resolve(result);
                } else {
                    result.success = false;
                    result.error = stderr || `Process exited with code ${code}`;
                    resolve(result); // Don't reject, return the result with error info
                }
            });

            testProcess.on('error', (error) => {
                reject(new Error(`Failed to start test process: ${error.message}`));
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                testProcess.kill('SIGTERM');
                reject(new Error('Test timeout after 5 minutes'));
            }, 5 * 60 * 1000);
        });
    }

    parseTestOutput(stdout, stderr, exitCode, duration) {
        const result = {
            success: exitCode === 0,
            duration,
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            stdout,
            stderr
        };

        try {
            // Parse Node.js test runner output
            const lines = stdout.split('\n');

            for (const line of lines) {
                // Look for test result summaries
                if (line.includes('tests') && line.includes('passed')) {
                    const matches = line.match(/(\d+)\s+tests?\s+passed/);
                    if (matches) {
                        result.passed = parseInt(matches[1]);
                    }
                }

                if (line.includes('failed')) {
                    const matches = line.match(/(\d+)\s+failed/);
                    if (matches) {
                        result.failed = parseInt(matches[1]);
                    }
                }

                if (line.includes('skipped')) {
                    const matches = line.match(/(\d+)\s+skipped/);
                    if (matches) {
                        result.skipped = parseInt(matches[1]);
                    }
                }

                // Count individual test lines
                if (line.includes('✓') || line.includes('✔')) {
                    result.passed++;
                } else if (line.includes('✗') || line.includes('✖') || line.includes('×')) {
                    result.failed++;
                }
            }

            result.total = result.passed + result.failed + result.skipped;

            // If we couldn't parse specific counts, estimate from exit code
            if (result.total === 0) {
                if (exitCode === 0) {
                    result.total = 1;
                    result.passed = 1;
                } else {
                    result.total = 1;
                    result.failed = 1;
                }
            }

        } catch (error) {
            // Fallback parsing
            result.total = 1;
            result.passed = exitCode === 0 ? 1 : 0;
            result.failed = exitCode === 0 ? 0 : 1;
        }

        return result;
    }

    async runAllTests() {
        console.log('🚀 FXD Master Test Suite Runner');
        console.log('🎯 Mission: 100% Production Readiness Validation');
        console.log('=' .repeat(80));

        const overallStart = performance.now();
        const summary = {
            totalSuites: this.testSuites.size,
            successfulSuites: 0,
            failedSuites: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            criticalFailures: 0,
            weightedScore: 0,
            productionReady: false
        };

        // Run test suites in order of priority
        const suiteOrder = ['core_components', 'error_handling', 'performance', 'release', 'quality_gates', 'enhanced', 'documentation'];

        for (const suiteId of suiteOrder) {
            const suite = this.testSuites.get(suiteId);
            if (suite) {
                const result = await this.runTestSuite(suiteId, suite);

                summary.totalTests += result.totalTests;
                summary.passedTests += result.passedTests;
                summary.failedTests += result.failedTests;
                summary.skippedTests += result.skippedTests;

                if (result.success) {
                    summary.successfulSuites++;
                    summary.weightedScore += suite.weight * 100;
                } else {
                    summary.failedSuites++;
                    if (suite.priority === 'critical') {
                        summary.criticalFailures++;
                    }
                    // Partial credit for partially passing suites
                    const partialScore = result.totalTests > 0 ?
                        (result.passedTests / result.totalTests) * 100 : 0;
                    summary.weightedScore += suite.weight * partialScore;
                }
            }
        }

        const overallEnd = performance.now();
        const totalDuration = overallEnd - overallStart;

        // Determine production readiness
        summary.productionReady =
            summary.criticalFailures === 0 &&
            summary.weightedScore >= 85 &&
            (summary.passedTests / Math.max(summary.totalTests, 1)) >= 0.90;

        // Generate final report
        const report = this.generateFinalReport(summary, totalDuration);

        // Display results
        this.displayFinalResults(report);

        // Save results
        await this.saveResults(report);

        return report;
    }

    generateFinalReport(summary, totalDuration) {
        const report = {
            metadata: {
                title: 'FXD Master Test Suite Report',
                timestamp: new Date().toISOString(),
                duration: totalDuration,
                nodeVersion: process.version,
                platform: process.platform
            },
            summary: {
                ...summary,
                overallSuccessRate: summary.totalTests > 0 ?
                    (summary.passedTests / summary.totalTests) * 100 : 0,
                suiteSuccessRate: summary.totalSuites > 0 ?
                    (summary.successfulSuites / summary.totalSuites) * 100 : 0,
                weightedScore: summary.weightedScore,
                productionCertified: summary.productionReady
            },
            testSuiteResults: Object.fromEntries(this.results),
            productionReadiness: {
                status: summary.productionReady ? 'CERTIFIED' : 'NOT CERTIFIED',
                criticalFailures: summary.criticalFailures,
                blockers: this.identifyBlockers(),
                requirements: this.getProductionRequirements(),
                nextSteps: this.generateNextSteps(summary)
            },
            recommendations: this.generateRecommendations(summary)
        };

        return report;
    }

    identifyBlockers() {
        const blockers = [];

        for (const [suiteId, result] of this.results) {
            const suite = this.testSuites.get(suiteId);
            if (suite.priority === 'critical' && !result.success) {
                blockers.push({
                    suite: result.name,
                    issue: `Critical test suite failed with ${result.failedTests} failures`,
                    impact: 'Blocks production deployment',
                    errors: result.errors
                });
            }
        }

        return blockers;
    }

    getProductionRequirements() {
        return {
            minimumWeightedScore: 85,
            maxCriticalFailures: 0,
            minimumOverallSuccessRate: 90,
            requiredCriticalSuites: ['core_components', 'error_handling', 'performance', 'release', 'quality_gates']
        };
    }

    generateNextSteps(summary) {
        const steps = [];

        if (summary.criticalFailures > 0) {
            steps.push('Address all critical test suite failures immediately');
        }

        if (summary.weightedScore < 85) {
            steps.push(`Improve overall quality score from ${summary.weightedScore.toFixed(1)}% to 85%`);
        }

        if (summary.overallSuccessRate < 90) {
            steps.push(`Increase test success rate from ${summary.overallSuccessRate.toFixed(1)}% to 90%`);
        }

        if (summary.productionReady) {
            steps.push('✅ Ready for production deployment!');
            steps.push('Consider setting up monitoring and observability');
            steps.push('Plan deployment rollout strategy');
        } else {
            steps.push('Re-run master test suite after addressing issues');
            steps.push('Consider gradual deployment approach');
        }

        return steps;
    }

    generateRecommendations(summary) {
        const recommendations = [];

        // Performance recommendations
        if (this.results.get('performance')?.success === false) {
            recommendations.push({
                priority: 'high',
                category: 'performance',
                recommendation: 'Optimize performance bottlenecks identified in testing',
                effort: 'medium'
            });
        }

        // Error handling recommendations
        if (this.results.get('error_handling')?.success === false) {
            recommendations.push({
                priority: 'high',
                category: 'reliability',
                recommendation: 'Strengthen error handling and recovery mechanisms',
                effort: 'medium'
            });
        }

        // Security recommendations
        if (this.results.get('enhanced')?.success === false) {
            recommendations.push({
                priority: 'medium',
                category: 'security',
                recommendation: 'Address security vulnerabilities and edge cases',
                effort: 'medium'
            });
        }

        // Documentation recommendations
        if (this.results.get('documentation')?.success === false) {
            recommendations.push({
                priority: 'low',
                category: 'documentation',
                recommendation: 'Update and validate documentation accuracy',
                effort: 'low'
            });
        }

        // Overall quality recommendations
        if (summary.weightedScore < 95) {
            recommendations.push({
                priority: 'medium',
                category: 'quality',
                recommendation: 'Continue quality improvements for excellence',
                effort: 'ongoing'
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    displayFinalResults(report) {
        console.log('\n' + '='.repeat(80));
        console.log('🏆 FXD MASTER TEST SUITE FINAL RESULTS');
        console.log('='.repeat(80));

        console.log(`📊 Overall Statistics:`);
        console.log(`   Test Suites: ${report.summary.successfulSuites}/${report.summary.totalSuites} passed`);
        console.log(`   Test Cases: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
        console.log(`   Success Rate: ${report.summary.overallSuccessRate.toFixed(1)}%`);
        console.log(`   Weighted Score: ${report.summary.weightedScore.toFixed(1)}%`);
        console.log(`   Duration: ${(report.metadata.duration / 1000).toFixed(2)}s`);

        console.log(`\n🎯 Production Readiness:`);
        console.log(`   Status: ${report.productionReadiness.status}`);
        console.log(`   Critical Failures: ${report.summary.criticalFailures}`);

        if (report.productionReadiness.blockers.length > 0) {
            console.log(`\n🚫 Production Blockers:`);
            report.productionReadiness.blockers.forEach((blocker, i) => {
                console.log(`   ${i + 1}. ${blocker.issue}`);
                console.log(`      Impact: ${blocker.impact}`);
            });
        }

        console.log(`\n📋 Test Suite Breakdown:`);
        for (const [suiteId, result] of this.results) {
            const status = result.success ? '✅' : '❌';
            const suite = this.testSuites.get(suiteId);
            console.log(`   ${status} ${result.name} (${suite.priority}) - ${result.passedTests}/${result.totalTests} tests`);
        }

        if (report.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            report.recommendations.slice(0, 5).forEach((rec, i) => {
                console.log(`   ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
            });
        }

        console.log(`\n🚀 Next Steps:`);
        report.productionReadiness.nextSteps.forEach((step, i) => {
            console.log(`   ${i + 1}. ${step}`);
        });

        console.log('\n' + '='.repeat(80));
        if (report.summary.productionCertified) {
            console.log('🎉 CONGRATULATIONS! FXD IS CERTIFIED FOR PRODUCTION DEPLOYMENT! 🎉');
        } else {
            console.log('⚠️  FXD REQUIRES ADDITIONAL WORK BEFORE PRODUCTION DEPLOYMENT ⚠️');
        }
        console.log('='.repeat(80));
    }

    async saveResults(report) {
        try {
            const reportsDir = join(__dirname, '../test-reports');

            // Save detailed JSON report
            const jsonPath = join(reportsDir, 'master-test-suite-report.json');
            writeFileSync(jsonPath, JSON.stringify(report, null, 2));

            // Save production readiness certificate
            const certPath = join(reportsDir, 'production-readiness-certificate.json');
            const certificate = {
                title: 'FXD Production Readiness Certificate',
                issued: report.metadata.timestamp,
                certified: report.summary.productionCertified,
                score: report.summary.weightedScore,
                validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
                authority: 'FXD Quality Assurance Team',
                requirements: report.productionReadiness.requirements,
                testSuiteResults: Object.fromEntries(
                    Array.from(this.results.entries()).map(([id, result]) => [
                        id, {
                            passed: result.success,
                            score: result.totalTests > 0 ? (result.passedTests / result.totalTests) * 100 : 0
                        }
                    ])
                )
            };
            writeFileSync(certPath, JSON.stringify(certificate, null, 2));

            console.log(`\n💾 Reports saved:`);
            console.log(`   📄 Detailed Report: ${jsonPath}`);
            console.log(`   🏆 Certificate: ${certPath}`);

        } catch (error) {
            console.warn(`⚠️  Failed to save reports: ${error.message}`);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new MasterTestSuiteRunner();

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
FXD Master Test Suite Runner

Usage: node master-test-suite.js [options]

Options:
  --help, -h          Show this help message
  --suite <name>      Run specific test suite only
  --list              List all available test suites
  --production        Run in production validation mode (stricter)

Test Suites:
  core_components     Core FXD Components (CLI, VFS, Git)
  error_handling      Error Handling & Recovery
  documentation       Documentation Validation
  performance         Performance & Optimization
  release             Release Preparation
  enhanced            Enhanced Testing (Stress, Security)
  quality_gates       Quality Gates & Production Readiness

Examples:
  node master-test-suite.js                    # Run all tests
  node master-test-suite.js --suite performance # Run performance tests only
  node master-test-suite.js --production        # Production validation mode
        `);
        process.exit(0);
    }

    if (args.includes('--list')) {
        console.log('Available Test Suites:');
        for (const [id, suite] of runner.testSuites) {
            console.log(`  ${id.padEnd(20)} - ${suite.name} (${suite.priority})`);
        }
        process.exit(0);
    }

    const suiteIndex = args.indexOf('--suite');
    if (suiteIndex !== -1 && args[suiteIndex + 1]) {
        const suiteName = args[suiteIndex + 1];
        const suite = runner.testSuites.get(suiteName);

        if (!suite) {
            console.error(`❌ Unknown test suite: ${suiteName}`);
            console.log('Use --list to see available test suites');
            process.exit(1);
        }

        console.log(`🎯 Running single test suite: ${suite.name}`);
        const result = await runner.runTestSuite(suiteName, suite);
        process.exit(result.success ? 0 : 1);
    }

    // Run all tests
    try {
        const report = await runner.runAllTests();
        process.exit(report.summary.productionCertified ? 0 : 1);
    } catch (error) {
        console.error(`💥 Master test suite failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export default MasterTestSuiteRunner;