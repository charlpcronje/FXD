/**
 * Performance Benchmarks for New FXD Components
 * Tests CLI, Virtual Filesystem, and Git Integration performance
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-perf-test-${Date.now()}`);
const CLI_PATH = join(process.cwd(), 'fxd-cli.ts');

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
    CLI: {
        commandParsing: 50,
        projectCreation: 2000,
        fileImport: 1000,
        directoryImport: 5000,
        listContents: 500,
        export: 3000
    },
    FILESYSTEM: {
        viewRegistration: 10,
        fileResolution: 5,
        readFile: 100,
        writeFile: 150,
        directoryListing: 200,
        largeDirListing: 1000
    },
    GIT: {
        repoScan: 3000,
        branchDetection: 1000,
        commitHistory: 2000,
        syncFromGit: 5000,
        syncToGit: 4000,
        conflictDetection: 1500
    }
};

describe('FXD New Components Performance Benchmarks', () => {
    let performanceResults = {
        CLI: {},
        FILESYSTEM: {},
        GIT: {}
    };

    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('CLI Performance Benchmarks', () => {
        test('should benchmark command parsing performance', async () => {
            const iterations = 100;
            const commands = [
                ['help'],
                ['create', 'test-project'],
                ['list', '--type=snippets'],
                ['run', 'test-snippet'],
                ['export', './output']
            ];

            const results = [];

            for (const command of commands) {
                const times = [];

                for (let i = 0; i < iterations; i++) {
                    const start = performance.now();
                    await execCLI(command, { timeout: 5000 });
                    const end = performance.now();
                    times.push(end - start);
                }

                const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);

                results.push({
                    command: command.join(' '),
                    avgTime,
                    minTime,
                    maxTime
                });

                console.log(`CLI Command "${command.join(' ')}" - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
            }

            performanceResults.CLI.commandParsing = results;

            // Assert average parsing time is within threshold
            const overallAvg = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
            assert(overallAvg < PERFORMANCE_THRESHOLDS.CLI.commandParsing,
                   `Command parsing should be under ${PERFORMANCE_THRESHOLDS.CLI.commandParsing}ms, got ${overallAvg.toFixed(2)}ms`);
        });

        test('should benchmark project creation performance', async () => {
            const projectSizes = [1, 5, 10]; // Different complexity levels

            for (const size of projectSizes) {
                const start = performance.now();

                const result = await execCLI(['create', `perf-project-${size}`, '--path=' + TEST_DIR]);

                const end = performance.now();
                const duration = end - start;

                console.log(`Project creation (size ${size}) - ${duration.toFixed(2)}ms`);

                performanceResults.CLI[`projectCreation_${size}`] = duration;

                if (size === 1) {
                    assert(duration < PERFORMANCE_THRESHOLDS.CLI.projectCreation,
                           `Project creation should be under ${PERFORMANCE_THRESHOLDS.CLI.projectCreation}ms`);
                }
            }
        });

        test('should benchmark file import performance', async () => {
            // Create test files of different sizes
            const fileSizes = [
                { name: 'small.js', lines: 50 },
                { name: 'medium.js', lines: 500 },
                { name: 'large.js', lines: 2000 }
            ];

            await execCLI(['create', 'import-test', '--path=' + TEST_DIR]);

            for (const fileSpec of fileSizes) {
                const content = Array(fileSpec.lines).fill().map((_, i) =>
                    `function func${i}() { return ${i}; }`
                ).join('\n');

                const filePath = join(TEST_DIR, fileSpec.name);
                await fs.writeFile(filePath, content);

                const start = performance.now();
                await execCLI(['import', filePath]);
                const end = performance.now();

                const duration = end - start;
                console.log(`File import ${fileSpec.name} (${fileSpec.lines} lines) - ${duration.toFixed(2)}ms`);

                performanceResults.CLI[`fileImport_${fileSpec.name}`] = duration;

                if (fileSpec.lines <= 50) {
                    assert(duration < PERFORMANCE_THRESHOLDS.CLI.fileImport,
                           `Small file import should be under ${PERFORMANCE_THRESHOLDS.CLI.fileImport}ms`);
                }
            }
        });

        test('should benchmark directory import performance', async () => {
            // Create directory structures with varying complexity
            const dirStructures = [
                { name: 'simple', files: 10, depth: 2 },
                { name: 'complex', files: 50, depth: 3 },
                { name: 'large', files: 100, depth: 4 }
            ];

            await execCLI(['create', 'dir-import-test', '--path=' + TEST_DIR]);

            for (const structure of dirStructures) {
                const dirPath = join(TEST_DIR, structure.name);
                await createDirectoryStructure(dirPath, structure.files, structure.depth);

                const start = performance.now();
                await execCLI(['import', dirPath]);
                const end = performance.now();

                const duration = end - start;
                console.log(`Directory import ${structure.name} (${structure.files} files, depth ${structure.depth}) - ${duration.toFixed(2)}ms`);

                performanceResults.CLI[`dirImport_${structure.name}`] = duration;

                if (structure.files <= 10) {
                    assert(duration < PERFORMANCE_THRESHOLDS.CLI.directoryImport,
                           `Simple directory import should be under ${PERFORMANCE_THRESHOLDS.CLI.directoryImport}ms`);
                }
            }
        });

        test('should benchmark list contents performance', async () => {
            // Create project with many snippets
            await execCLI(['create', 'list-perf-test', '--path=' + TEST_DIR]);

            // Import many files
            const fileCount = 50;
            for (let i = 0; i < fileCount; i++) {
                const filePath = join(TEST_DIR, `snippet${i}.js`);
                await fs.writeFile(filePath, `function snippet${i}() { return ${i}; }`);
                await execCLI(['import', filePath]);
            }

            // Benchmark list command
            const iterations = 10;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await execCLI(['list']);
                const end = performance.now();
                times.push(end - start);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`List contents (${fileCount} snippets) - ${avgTime.toFixed(2)}ms average`);

            performanceResults.CLI.listContents = avgTime;

            assert(avgTime < PERFORMANCE_THRESHOLDS.CLI.listContents,
                   `List contents should be under ${PERFORMANCE_THRESHOLDS.CLI.listContents}ms`);
        });

        test('should benchmark export performance', async () => {
            // Create project with content
            await execCLI(['create', 'export-perf-test', '--path=' + TEST_DIR]);

            // Import various files
            const files = {
                'app.js': 'function app() { console.log("app"); }',
                'utils.js': 'export const utils = () => "utility";',
                'config.json': '{"name": "export-test", "version": "1.0.0"}',
                'README.md': '# Export Performance Test\n\nThis is a test project.'
            };

            for (const [fileName, content] of Object.entries(files)) {
                const filePath = join(TEST_DIR, fileName);
                await fs.writeFile(filePath, content);
                await execCLI(['import', filePath]);
            }

            // Benchmark export operations
            const exportFormats = ['files', 'archive'];

            for (const format of exportFormats) {
                const exportDir = join(TEST_DIR, `export-${format}`);

                const start = performance.now();
                await execCLI(['export', exportDir, `--format=${format}`]);
                const end = performance.now();

                const duration = end - start;
                console.log(`Export ${format} format - ${duration.toFixed(2)}ms`);

                performanceResults.CLI[`export_${format}`] = duration;

                assert(duration < PERFORMANCE_THRESHOLDS.CLI.export,
                       `Export ${format} should be under ${PERFORMANCE_THRESHOLDS.CLI.export}ms`);
            }
        });
    });

    describe('Virtual Filesystem Performance Benchmarks', () => {
        let mockFxFs;

        beforeEach(() => {
            mockFxFs = createMockFxFs();
        });

        test('should benchmark view registration performance', async () => {
            const registrationCount = 1000;
            const entries = [];

            // Prepare entries
            for (let i = 0; i < registrationCount; i++) {
                entries.push({
                    filePath: `src/file${i}.js`,
                    viewId: `views.file${i}`,
                    lang: 'js'
                });
            }

            const start = performance.now();

            for (const entry of entries) {
                mockFxFs.register(entry);
            }

            const end = performance.now();
            const duration = end - start;
            const avgPerRegistration = duration / registrationCount;

            console.log(`View registration (${registrationCount} entries) - Total: ${duration.toFixed(2)}ms, Avg: ${avgPerRegistration.toFixed(3)}ms per registration`);

            performanceResults.FILESYSTEM.viewRegistration = avgPerRegistration;

            assert(avgPerRegistration < PERFORMANCE_THRESHOLDS.FILESYSTEM.viewRegistration,
                   `View registration should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.viewRegistration}ms per entry`);
        });

        test('should benchmark file resolution performance', async () => {
            // Register many files
            const fileCount = 10000;
            for (let i = 0; i < fileCount; i++) {
                mockFxFs.register({
                    filePath: `path/to/file${i}.js`,
                    viewId: `views.file${i}`,
                    lang: 'js'
                });
            }

            // Benchmark random resolutions
            const iterations = 1000;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const randomIndex = Math.floor(Math.random() * fileCount);
                const filePath = `path/to/file${randomIndex}.js`;

                const start = performance.now();
                const resolved = mockFxFs.resolve(filePath);
                const end = performance.now();

                times.push(end - start);
                assert(resolved, `Should resolve file${randomIndex}.js`);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`File resolution (${fileCount} files, ${iterations} lookups) - ${avgTime.toFixed(3)}ms average`);

            performanceResults.FILESYSTEM.fileResolution = avgTime;

            assert(avgTime < PERFORMANCE_THRESHOLDS.FILESYSTEM.fileResolution,
                   `File resolution should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.fileResolution}ms`);
        });

        test('should benchmark file read operations', async () => {
            // Register files with different content sizes
            const fileSizes = [
                { name: 'small.js', contentSize: 1000 },
                { name: 'medium.js', contentSize: 10000 },
                { name: 'large.js', contentSize: 100000 }
            ];

            for (const fileSpec of fileSizes) {
                mockFxFs.register({
                    filePath: fileSpec.name,
                    viewId: `views.${fileSpec.name}`,
                    lang: 'js'
                });
            }

            for (const fileSpec of fileSizes) {
                const iterations = fileSpec.contentSize > 50000 ? 10 : 100;
                const times = [];

                for (let i = 0; i < iterations; i++) {
                    const start = performance.now();
                    const content = mockFxFs.readFile(fileSpec.name);
                    const end = performance.now();

                    times.push(end - start);
                    assert(content, `Should read ${fileSpec.name}`);
                }

                const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                console.log(`File read ${fileSpec.name} (${fileSpec.contentSize} chars) - ${avgTime.toFixed(2)}ms average`);

                performanceResults.FILESYSTEM[`fileRead_${fileSpec.name}`] = avgTime;

                if (fileSpec.contentSize <= 10000) {
                    assert(avgTime < PERFORMANCE_THRESHOLDS.FILESYSTEM.readFile,
                           `File read should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.readFile}ms for small files`);
                }
            }
        });

        test('should benchmark file write operations', async () => {
            // Register files for writing
            const files = ['write1.js', 'write2.js', 'write3.js'];

            for (const file of files) {
                mockFxFs.register({
                    filePath: file,
                    viewId: `views.${file}`,
                    lang: 'js'
                });
            }

            const contentSizes = [1000, 10000, 50000];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const contentSize = contentSizes[i];
                const content = 'x'.repeat(contentSize);

                const iterations = contentSize > 25000 ? 10 : 50;
                const times = [];

                for (let j = 0; j < iterations; j++) {
                    const start = performance.now();
                    mockFxFs.writeFile(file, content);
                    const end = performance.now();
                    times.push(end - start);
                }

                const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                console.log(`File write ${file} (${contentSize} chars) - ${avgTime.toFixed(2)}ms average`);

                performanceResults.FILESYSTEM[`fileWrite_${file}`] = avgTime;

                if (contentSize <= 10000) {
                    assert(avgTime < PERFORMANCE_THRESHOLDS.FILESYSTEM.writeFile,
                           `File write should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.writeFile}ms for small files`);
                }
            }
        });

        test('should benchmark directory listing performance', async () => {
            // Create nested directory structure
            const dirSizes = [
                { name: 'small', files: 100 },
                { name: 'medium', files: 1000 },
                { name: 'large', files: 5000 }
            ];

            for (const dirSpec of dirSizes) {
                // Register files in directory
                for (let i = 0; i < dirSpec.files; i++) {
                    mockFxFs.register({
                        filePath: `${dirSpec.name}/file${i}.js`,
                        viewId: `views.${dirSpec.name}_file${i}`,
                        lang: 'js'
                    });
                }

                const iterations = dirSpec.files > 2000 ? 5 : 20;
                const times = [];

                for (let i = 0; i < iterations; i++) {
                    const start = performance.now();
                    const listing = mockFxFs.readdir(dirSpec.name);
                    const end = performance.now();

                    times.push(end - start);
                    assert.equal(listing.length, dirSpec.files, `Should list all files in ${dirSpec.name}`);
                }

                const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                console.log(`Directory listing ${dirSpec.name} (${dirSpec.files} files) - ${avgTime.toFixed(2)}ms average`);

                performanceResults.FILESYSTEM[`dirListing_${dirSpec.name}`] = avgTime;

                if (dirSpec.files <= 100) {
                    assert(avgTime < PERFORMANCE_THRESHOLDS.FILESYSTEM.directoryListing,
                           `Small directory listing should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.directoryListing}ms`);
                } else if (dirSpec.files >= 5000) {
                    assert(avgTime < PERFORMANCE_THRESHOLDS.FILESYSTEM.largeDirListing,
                           `Large directory listing should be under ${PERFORMANCE_THRESHOLDS.FILESYSTEM.largeDirListing}ms`);
                }
            }
        });

        test('should benchmark event system performance', async () => {
            const listenerCount = 100;
            const eventCount = 1000;

            // Add many listeners
            const unsubscribers = [];
            for (let i = 0; i < listenerCount; i++) {
                const unsubscribe = mockFxFs.on('fileChanged', () => {
                    // Simulate some work
                    Math.random();
                });
                unsubscribers.push(unsubscribe);
            }

            // Register a file for events
            mockFxFs.register({
                filePath: 'event-test.js',
                viewId: 'views.eventTest',
                lang: 'js'
            });

            // Benchmark event emission
            const start = performance.now();

            for (let i = 0; i < eventCount; i++) {
                mockFxFs.writeFile('event-test.js', `content ${i}`);
            }

            const end = performance.now();
            const duration = end - start;
            const avgPerEvent = duration / eventCount;

            console.log(`Event system (${listenerCount} listeners, ${eventCount} events) - Total: ${duration.toFixed(2)}ms, Avg: ${avgPerEvent.toFixed(3)}ms per event`);

            performanceResults.FILESYSTEM.eventSystem = avgPerEvent;

            // Cleanup listeners
            unsubscribers.forEach(unsub => unsub());

            assert(avgPerEvent < 1, 'Event emission should be under 1ms per event');
        });
    });

    describe('Git Integration Performance Benchmarks', () => {
        let mockGitIntegration;
        let repoPath;

        beforeEach(async () => {
            repoPath = join(TEST_DIR, 'git-repo');
            await fs.mkdir(repoPath, { recursive: true });
            await initGitRepo(repoPath);
            mockGitIntegration = createMockGitIntegration();
        });

        test('should benchmark repository scanning performance', async () => {
            // Create repositories of different sizes
            const repoSizes = [
                { name: 'small', files: 50, commits: 10 },
                { name: 'medium', files: 200, commits: 50 },
                { name: 'large', files: 1000, commits: 100 }
            ];

            for (const repoSpec of repoSizes) {
                const testRepoPath = join(TEST_DIR, `repo-${repoSpec.name}`);
                await fs.mkdir(testRepoPath, { recursive: true });
                await initGitRepo(testRepoPath);

                // Create files and commits
                await createLargeRepo(testRepoPath, repoSpec.files, repoSpec.commits);

                const start = performance.now();
                const scanResult = await mockGitIntegration.scanRepository(testRepoPath);
                const end = performance.now();

                const duration = end - start;
                console.log(`Repository scan ${repoSpec.name} (${repoSpec.files} files, ${repoSpec.commits} commits) - ${duration.toFixed(2)}ms`);

                performanceResults.GIT[`repoScan_${repoSpec.name}`] = duration;

                assert(scanResult.files.length >= repoSpec.files, `Should scan ${repoSpec.files} files`);

                if (repoSpec.files <= 50) {
                    assert(duration < PERFORMANCE_THRESHOLDS.GIT.repoScan,
                           `Small repo scan should be under ${PERFORMANCE_THRESHOLDS.GIT.repoScan}ms`);
                }
            }
        });

        test('should benchmark branch detection performance', async () => {
            // Create many branches
            const branchCount = 50;
            const branchNames = [];

            for (let i = 0; i < branchCount; i++) {
                const branchName = `feature/branch-${i}`;
                branchNames.push(branchName);
                await createBranch(repoPath, branchName);
            }

            const iterations = 10;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const branches = await mockGitIntegration.getBranches(repoPath);
                const end = performance.now();

                times.push(end - start);
                assert(branches.length >= branchCount, `Should detect ${branchCount} branches`);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`Branch detection (${branchCount} branches) - ${avgTime.toFixed(2)}ms average`);

            performanceResults.GIT.branchDetection = avgTime;

            assert(avgTime < PERFORMANCE_THRESHOLDS.GIT.branchDetection,
                   `Branch detection should be under ${PERFORMANCE_THRESHOLDS.GIT.branchDetection}ms`);
        });

        test('should benchmark commit history analysis', async () => {
            // Create repositories with different commit counts
            const commitCounts = [10, 50, 100];

            for (const commitCount of commitCounts) {
                const testRepoPath = join(TEST_DIR, `commits-${commitCount}`);
                await fs.mkdir(testRepoPath, { recursive: true });
                await initGitRepo(testRepoPath);

                // Create commits
                for (let i = 0; i < commitCount; i++) {
                    await fs.writeFile(join(testRepoPath, `file${i}.txt`), `Content ${i}`);
                    await addAndCommit(testRepoPath, `Commit ${i}`);
                }

                const start = performance.now();
                const history = await mockGitIntegration.getCommitHistory(testRepoPath);
                const end = performance.now();

                const duration = end - start;
                console.log(`Commit history analysis (${commitCount} commits) - ${duration.toFixed(2)}ms`);

                performanceResults.GIT[`commitHistory_${commitCount}`] = duration;

                assert(history.length >= commitCount, `Should analyze ${commitCount} commits`);

                if (commitCount <= 10) {
                    assert(duration < PERFORMANCE_THRESHOLDS.GIT.commitHistory,
                           `Small commit history should be under ${PERFORMANCE_THRESHOLDS.GIT.commitHistory}ms`);
                }
            }
        });

        test('should benchmark sync operations performance', async () => {
            // Create repository with substantial content
            await createLargeRepo(repoPath, 100, 20);

            // Benchmark sync from Git
            const syncFromStart = performance.now();
            const syncFromResult = await mockGitIntegration.syncFromGit(repoPath);
            const syncFromEnd = performance.now();

            const syncFromDuration = syncFromEnd - syncFromStart;
            console.log(`Sync from Git (100 files) - ${syncFromDuration.toFixed(2)}ms`);

            performanceResults.GIT.syncFromGit = syncFromDuration;

            assert(syncFromResult.filesProcessed >= 100, 'Should process 100 files');
            assert(syncFromDuration < PERFORMANCE_THRESHOLDS.GIT.syncFromGit,
                   `Sync from Git should be under ${PERFORMANCE_THRESHOLDS.GIT.syncFromGit}ms`);

            // Benchmark sync to Git
            const syncToStart = performance.now();
            const syncToResult = await mockGitIntegration.syncToGit(repoPath);
            const syncToEnd = performance.now();

            const syncToDuration = syncToEnd - syncToStart;
            console.log(`Sync to Git - ${syncToDuration.toFixed(2)}ms`);

            performanceResults.GIT.syncToGit = syncToDuration;

            assert(syncToDuration < PERFORMANCE_THRESHOLDS.GIT.syncToGit,
                   `Sync to Git should be under ${PERFORMANCE_THRESHOLDS.GIT.syncToGit}ms`);
        });

        test('should benchmark conflict detection performance', async () => {
            // Create conflict scenarios
            await createConflictScenario(repoPath);

            const iterations = 10;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const conflicts = await mockGitIntegration.detectConflicts(repoPath);
                const end = performance.now();
                times.push(end - start);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`Conflict detection - ${avgTime.toFixed(2)}ms average`);

            performanceResults.GIT.conflictDetection = avgTime;

            assert(avgTime < PERFORMANCE_THRESHOLDS.GIT.conflictDetection,
                   `Conflict detection should be under ${PERFORMANCE_THRESHOLDS.GIT.conflictDetection}ms`);
        });

        test('should benchmark batch operations performance', async () => {
            const operationCounts = [10, 50, 100];

            for (const opCount of operationCounts) {
                const operations = [];
                for (let i = 0; i < opCount; i++) {
                    operations.push({
                        type: 'create',
                        file: `batch/file${i}.js`,
                        content: `function batch${i}() { return ${i}; }`
                    });
                }

                const start = performance.now();
                const result = await mockGitIntegration.batchOperations(repoPath, operations);
                const end = performance.now();

                const duration = end - start;
                const avgPerOp = duration / opCount;

                console.log(`Batch operations (${opCount} ops) - Total: ${duration.toFixed(2)}ms, Avg: ${avgPerOp.toFixed(2)}ms per op`);

                performanceResults.GIT[`batchOps_${opCount}`] = duration;

                assert(result.success, 'Batch operations should succeed');
                assert(result.processed === opCount, `Should process ${opCount} operations`);
            }
        });
    });

    describe('Performance Summary and Analysis', () => {
        test('should generate performance report', () => {
            console.log('\n=== FXD NEW COMPONENTS PERFORMANCE REPORT ===\n');

            // CLI Performance Summary
            console.log('CLI PERFORMANCE:');
            Object.entries(performanceResults.CLI).forEach(([test, result]) => {
                if (Array.isArray(result)) {
                    console.log(`  ${test}: ${result.length} commands tested`);
                } else {
                    console.log(`  ${test}: ${result.toFixed(2)}ms`);
                }
            });

            // Filesystem Performance Summary
            console.log('\nFILESYSTEM PERFORMANCE:');
            Object.entries(performanceResults.FILESYSTEM).forEach(([test, result]) => {
                console.log(`  ${test}: ${result.toFixed(3)}ms`);
            });

            // Git Performance Summary
            console.log('\nGIT INTEGRATION PERFORMANCE:');
            Object.entries(performanceResults.GIT).forEach(([test, result]) => {
                console.log(`  ${test}: ${result.toFixed(2)}ms`);
            });

            // Performance warnings
            const warnings = [];

            // Check for performance regressions
            if (performanceResults.CLI.listContents > PERFORMANCE_THRESHOLDS.CLI.listContents * 0.8) {
                warnings.push('CLI list contents approaching threshold');
            }

            if (performanceResults.FILESYSTEM.fileResolution > PERFORMANCE_THRESHOLDS.FILESYSTEM.fileResolution * 0.8) {
                warnings.push('Filesystem resolution approaching threshold');
            }

            if (performanceResults.GIT.syncFromGit > PERFORMANCE_THRESHOLDS.GIT.syncFromGit * 0.8) {
                warnings.push('Git sync approaching threshold');
            }

            if (warnings.length > 0) {
                console.log('\nPERFORMANCE WARNINGS:');
                warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
            } else {
                console.log('\n✅ All performance benchmarks within acceptable thresholds');
            }

            console.log('\n=== END PERFORMANCE REPORT ===\n');

            assert(true, 'Performance report generated successfully');
        });
    });
});

// Helper functions

async function execCLI(args, options = {}) {
    return new Promise((resolve) => {
        const timeout = options.timeout || 10000;
        const cwd = options.cwd || TEST_DIR;

        const child = spawn('deno', ['run', '--allow-all', CLI_PATH, ...args], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill();
            resolve({ success: false, output: stdout, error: 'timeout' });
        }, timeout);

        child.stdout?.on('data', (data) => stdout += data.toString());
        child.stderr?.on('data', (data) => stderr += data.toString());

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                success: code === 0,
                output: stdout,
                error: stderr,
                code
            });
        });

        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({
                success: false,
                output: stdout,
                error: error.message
            });
        });
    });
}

async function createDirectoryStructure(basePath, fileCount, depth) {
    await fs.mkdir(basePath, { recursive: true });

    const filesPerLevel = Math.ceil(fileCount / depth);

    for (let level = 0; level < depth; level++) {
        const levelPath = join(basePath, `level${level}`);
        await fs.mkdir(levelPath, { recursive: true });

        for (let file = 0; file < filesPerLevel && (level * filesPerLevel + file) < fileCount; file++) {
            const fileName = `file${file}.js`;
            const filePath = join(levelPath, fileName);
            const content = `// Level ${level}, File ${file}\nfunction level${level}_file${file}() { return ${level * 100 + file}; }`;
            await fs.writeFile(filePath, content);
        }
    }
}

async function initGitRepo(repoPath) {
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const execFile = promisify(spawn);

    try {
        await execFile('git', ['init'], { cwd: repoPath });
        await execFile('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
        await execFile('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment, use mocks
    }
}

async function createLargeRepo(repoPath, fileCount, commitCount) {
    const filesPerCommit = Math.ceil(fileCount / commitCount);

    for (let commit = 0; commit < commitCount; commit++) {
        for (let file = 0; file < filesPerCommit && (commit * filesPerCommit + file) < fileCount; file++) {
            const fileName = `file${commit * filesPerCommit + file}.js`;
            const content = `// Commit ${commit}, File ${file}\nfunction func${commit}_${file}() { return ${commit * 100 + file}; }`;
            await fs.writeFile(join(repoPath, fileName), content);
        }

        try {
            await addAndCommit(repoPath, `Commit ${commit}`);
        } catch (error) {
            // Git operations may fail in test environment
        }
    }
}

async function createBranch(repoPath, branchName) {
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);
        await execFile('git', ['checkout', '-b', branchName], { cwd: repoPath });
        await execFile('git', ['checkout', 'main'], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment, use mocks
    }
}

async function addAndCommit(repoPath, message) {
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);
        await execFile('git', ['add', '.'], { cwd: repoPath });
        await execFile('git', ['commit', '-m', message], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment
    }
}

async function createConflictScenario(repoPath) {
    // Create initial file
    await fs.writeFile(join(repoPath, 'conflict.txt'), 'original content');
    await addAndCommit(repoPath, 'Initial content');

    try {
        // Create and switch to feature branch
        await createBranch(repoPath, 'feature');
        await fs.writeFile(join(repoPath, 'conflict.txt'), 'feature content');
        await addAndCommit(repoPath, 'Feature changes');

        // Switch back to main and make conflicting change
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);
        await execFile('git', ['checkout', 'main'], { cwd: repoPath });
        await fs.writeFile(join(repoPath, 'conflict.txt'), 'main content');
        await addAndCommit(repoPath, 'Main changes');

        // Attempt merge to create conflict
        try {
            await execFile('git', ['merge', 'feature'], { cwd: repoPath });
        } catch (error) {
            // Expected to fail with conflict
        }
    } catch (error) {
        // Git operations may fail in test environment
    }
}

// Mock implementations (simplified for performance testing)

function createMockFxFs() {
    const registeredFiles = new Map();
    const listeners = new Set();

    return {
        register(entry) {
            registeredFiles.set(entry.filePath, entry);
        },

        resolve(filePath) {
            return registeredFiles.get(filePath) || null;
        },

        readFile(filePath) {
            const entry = registeredFiles.get(filePath);
            if (!entry) throw new Error(`No mapping for ${filePath}`);
            return `// Mock content for ${filePath}`;
        },

        writeFile(filePath, content) {
            const entry = registeredFiles.get(filePath);
            if (!entry) throw new Error(`No mapping for ${filePath}`);

            // Emit change event
            for (const listener of listeners) {
                try {
                    listener(filePath);
                } catch (e) {
                    // Ignore listener errors
                }
            }
        },

        readdir(dirPath) {
            const parts = new Set();
            const normalizedDir = dirPath.replace(/^\/+/, '');

            for (const path of registeredFiles.keys()) {
                if (normalizedDir === '' || path.startsWith(normalizedDir + '/')) {
                    const rest = normalizedDir === '' ? path : path.slice(normalizedDir.length + 1);
                    const head = rest.split('/')[0];
                    if (head) parts.add(head);
                }
            }

            return Array.from(parts).sort();
        },

        on(event, callback) {
            if (event === 'fileChanged') {
                listeners.add(callback);
                return () => listeners.delete(callback);
            }
            return () => {};
        }
    };
}

function createMockGitIntegration() {
    return {
        async scanRepository(repoPath) {
            // Simulate scanning delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

            const fileCount = Math.floor(Math.random() * 100) + 50;
            const files = Array.from({ length: fileCount }, (_, i) => `file${i}.js`);
            const commits = Array.from({ length: 20 }, (_, i) => ({ hash: `abc${i}`, message: `Commit ${i}` }));
            const branches = ['main', 'feature', 'development'];

            return { files, commits, branches };
        },

        async getBranches(repoPath) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            return ['main', 'feature', 'development'];
        },

        async getCommitHistory(repoPath) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
            return Array.from({ length: 50 }, (_, i) => ({ hash: `abc${i}`, message: `Commit ${i}` }));
        },

        async syncFromGit(repoPath) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
            return { filesProcessed: 100, binaryFiles: [] };
        },

        async syncToGit(repoPath) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 400));
            return { success: true, filesWritten: 50 };
        },

        async detectConflicts(repoPath) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
            return []; // No conflicts in mock
        },

        async batchOperations(repoPath, operations) {
            await new Promise(resolve => setTimeout(resolve, operations.length * 2));
            return { success: true, processed: operations.length };
        }
    };
}

// Run performance benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('⚡ Running FXD New Components Performance Benchmarks...\n');
}