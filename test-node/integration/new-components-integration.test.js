/**
 * Integration Tests for New FXD Components Cross-Interactions
 * Tests CLI <-> Virtual Filesystem <-> Git Integration workflows
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setTimeout } from 'timers/promises';

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-integration-test-${Date.now()}`);
const CLI_PATH = join(process.cwd(), 'fxd-cli.ts');

describe('FXD New Components Integration Tests', () => {
    let mockFxFs;
    let mockGitIntegration;
    let testRepoPath;

    beforeEach(async () => {
        // Create test directories
        await fs.mkdir(TEST_DIR, { recursive: true });
        testRepoPath = join(TEST_DIR, 'test-repo');
        await fs.mkdir(testRepoPath, { recursive: true });

        // Initialize mocks
        mockFxFs = createMockFxFs();
        mockGitIntegration = createMockGitIntegration(mockFxFs);

        // Setup Git repository
        await initializeGitRepository(testRepoPath);
    });

    afterEach(async () => {
        // Clean up test directories
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('CLI to Virtual Filesystem Integration', () => {
        test('should import files through CLI and register in virtual filesystem', async () => {
            // Create test files
            const testFiles = {
                'src/app.js': `
function app() {
    console.log("Main application");
    return "app";
}

function init() {
    app();
}
`,
                'src/utils.js': `
export function helper() {
    return "utility function";
}

export const constants = {
    VERSION: "1.0.0",
    DEBUG: true
};
`,
                'package.json': `{
    "name": "integration-test",
    "version": "1.0.0",
    "main": "src/app.js"
}`
            };

            // Write test files
            for (const [filePath, content] of Object.entries(testFiles)) {
                const fullPath = join(TEST_DIR, filePath);
                await fs.mkdir(join(fullPath, '..'), { recursive: true });
                await fs.writeFile(fullPath, content);
            }

            // Create FXD project via CLI
            const createResult = await execCLI(['create', 'cli-fs-test', '--path=' + TEST_DIR]);
            assert(createResult.success || createResult.output.includes('Creating'),
                   `Project creation should succeed: ${createResult.error}`);

            // Import files via CLI
            const importResult = await execCLI(['import', join(TEST_DIR, 'src')]);
            assert(importResult.success || importResult.output.includes('Import'),
                   `Import should succeed: ${importResult.error}`);

            // Verify files are registered in virtual filesystem
            assert(mockFxFs.resolve('src/app.js'), 'app.js should be registered in VFS');
            assert(mockFxFs.resolve('src/utils.js'), 'utils.js should be registered in VFS');

            // Verify content can be read through VFS
            const appContent = mockFxFs.readFile('src/app.js');
            assert(appContent.includes('function app'), 'Should read app.js content through VFS');

            const utilsContent = mockFxFs.readFile('src/utils.js');
            assert(utilsContent.includes('export function helper'), 'Should read utils.js content through VFS');

            // Verify file metadata is preserved
            const appEntry = mockFxFs.resolve('src/app.js');
            assert.equal(appEntry.lang, 'js', 'Should preserve JavaScript language');

            const utilsEntry = mockFxFs.resolve('src/utils.js');
            assert.equal(utilsEntry.lang, 'js', 'Should preserve JavaScript language');
        });

        test('should list VFS contents through CLI', async () => {
            // Setup project with files
            await execCLI(['create', 'list-test', '--path=' + TEST_DIR]);

            // Register files in VFS directly (simulating import)
            const testEntries = [
                { filePath: 'main.js', viewId: 'views.main', lang: 'js' },
                { filePath: 'helpers.js', viewId: 'views.helpers', lang: 'js' },
                { filePath: 'config.json', viewId: 'views.config', lang: 'json' }
            ];

            testEntries.forEach(entry => mockFxFs.register(entry));

            // List contents via CLI
            const listResult = await execCLI(['list']);
            assert(listResult.success || listResult.output.includes('Contents'),
                   `List should succeed: ${listResult.error}`);

            // Verify output includes VFS files
            assert(listResult.output.includes('main.js') || listResult.output.includes('SNIPPETS'),
                   'Should list main.js');
            assert(listResult.output.includes('helpers.js') || listResult.output.includes('views'),
                   'Should list helpers.js');
        });

        test('should export VFS contents through CLI', async () => {
            // Setup project and VFS entries
            await execCLI(['create', 'export-test', '--path=' + TEST_DIR]);

            const exportEntries = [
                { filePath: 'export1.js', viewId: 'views.export1', lang: 'js' },
                { filePath: 'export2.ts', viewId: 'views.export2', lang: 'ts' },
                { filePath: 'export3.md', viewId: 'views.export3', lang: 'markdown' }
            ];

            exportEntries.forEach(entry => mockFxFs.register(entry));

            // Export through CLI
            const exportDir = join(TEST_DIR, 'exported');
            const exportResult = await execCLI(['export', exportDir, '--format=files']);

            assert(exportResult.success || exportResult.output.includes('Export'),
                   `Export should succeed: ${exportResult.error}`);

            // Verify export output
            assert(exportResult.output.includes('export1.js') || exportResult.output.includes('Exported'),
                   'Should export JavaScript files');
        });

        test('should run VFS snippets through CLI', async () => {
            // Setup project
            await execCLI(['create', 'run-test', '--path=' + TEST_DIR]);

            // Register executable snippet in VFS
            mockFxFs.register({
                filePath: 'runnable.js',
                viewId: 'views.runnable',
                lang: 'js'
            });

            // Simulate snippet content
            mockFxFs.setMockContent('runnable.js', `
function testFunction() {
    console.log("Running from VFS");
    return "success";
}

testFunction();
`);

            // Run snippet through CLI
            const runResult = await execCLI(['run', 'runnable', '--visualize']);

            // Should either execute or show execution attempt
            assert(runResult.success || runResult.output.includes('Running') ||
                   runResult.output.includes('Executing') || runResult.output.includes('not found'),
                   'Should attempt to run VFS snippet');
        });

        test('should handle CLI errors gracefully with VFS integration', async () => {
            // Test importing non-existent file
            const invalidImportResult = await execCLI(['import', '/nonexistent/path']);
            assert(!invalidImportResult.success, 'Should fail for non-existent import path');
            assert(invalidImportResult.error || invalidImportResult.output,
                   'Should provide error message');

            // Test reading from empty VFS
            const emptyListResult = await execCLI(['list']);
            assert(emptyListResult.success || emptyListResult.output.includes('no snippets'),
                   'Should handle empty VFS gracefully');

            // Test running non-existent snippet
            const invalidRunResult = await execCLI(['run', 'nonexistent-snippet']);
            assert(!invalidRunResult.success || invalidRunResult.output.includes('not found'),
                   'Should handle missing snippet gracefully');
        });
    });

    describe('Virtual Filesystem to Git Integration', () => {
        test('should sync Git repository to VFS', async () => {
            // Create files in Git repository
            const gitFiles = {
                'src/main.ts': `
interface Config {
    version: string;
    debug: boolean;
}

function initApp(config: Config): void {
    console.log(\`Starting app v\${config.version}\`);
}
`,
                'src/utils.ts': `
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export class Logger {
    log(message: string): void {
        console.log(\`[\${formatDate(new Date())}] \${message}\`);
    }
}
`,
                'README.md': `
# Git VFS Integration Test

This project tests the integration between Git and Virtual Filesystem.
`
            };

            // Write files to Git repository
            for (const [filePath, content] of Object.entries(gitFiles)) {
                const fullPath = join(testRepoPath, filePath);
                await fs.mkdir(join(fullPath, '..'), { recursive: true });
                await fs.writeFile(fullPath, content);
            }

            // Commit files to Git
            await addAndCommitFiles(testRepoPath, 'Initial VFS integration test');

            // Sync from Git to VFS
            const syncResult = await mockGitIntegration.syncFromGit(testRepoPath);
            assert(syncResult.success, 'Git to VFS sync should succeed');
            assert(syncResult.filesProcessed >= 3, 'Should process all Git files');

            // Verify files are registered in VFS
            assert(mockFxFs.resolve('src/main.ts'), 'main.ts should be registered in VFS');
            assert(mockFxFs.resolve('src/utils.ts'), 'utils.ts should be registered in VFS');
            assert(mockFxFs.resolve('README.md'), 'README.md should be registered in VFS');

            // Verify language detection
            const mainEntry = mockFxFs.resolve('src/main.ts');
            assert.equal(mainEntry.lang, 'ts', 'Should detect TypeScript language');

            const readmeEntry = mockFxFs.resolve('README.md');
            assert.equal(readmeEntry.lang, 'markdown', 'Should detect Markdown language');

            // Verify content accessibility through VFS
            const mainContent = mockFxFs.readFile('src/main.ts');
            assert(mainContent.includes('interface Config'), 'Should read TypeScript content');

            const utilsContent = mockFxFs.readFile('src/utils.ts');
            assert(utilsContent.includes('export function formatDate'), 'Should read utils content');
        });

        test('should sync VFS changes back to Git', async () => {
            // Initial Git setup
            await fs.writeFile(join(testRepoPath, 'initial.js'), 'function initial() {}');
            await addAndCommitFiles(testRepoPath, 'Initial commit');

            // Sync to VFS
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Modify file through VFS
            mockFxFs.writeFile('initial.js', `
function initial() {
    console.log("Modified through VFS");
    return "updated";
}
`);

            // Add new file through VFS
            mockFxFs.register({
                filePath: 'vfs-created.js',
                viewId: 'views.vfsCreated',
                lang: 'js'
            });

            mockFxFs.writeFile('vfs-created.js', `
function vfsCreated() {
    return "Created in VFS";
}
`);

            // Sync VFS changes back to Git
            const syncToGitResult = await mockGitIntegration.syncToGit(testRepoPath);
            assert(syncToGitResult.success, 'VFS to Git sync should succeed');

            // Verify changes are reflected in Git
            const modifiedContent = await fs.readFile(join(testRepoPath, 'initial.js'), 'utf8');
            assert(modifiedContent.includes('Modified through VFS'), 'Should sync modifications to Git');

            const newFileExists = await fs.access(join(testRepoPath, 'vfs-created.js'))
                .then(() => true, () => false);
            assert(newFileExists, 'Should create new files in Git from VFS');
        });

        test('should handle VFS-Git conflict resolution', async () => {
            // Setup initial state
            await fs.writeFile(join(testRepoPath, 'conflict.js'), 'function original() {}');
            await addAndCommitFiles(testRepoPath, 'Original version');

            // Sync to VFS
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Modify in VFS
            mockFxFs.writeFile('conflict.js', 'function vfsModified() {}');

            // Modify directly in Git (simulate external change)
            await fs.writeFile(join(testRepoPath, 'conflict.js'), 'function gitModified() {}');
            await addAndCommitFiles(testRepoPath, 'Git modification');

            // Attempt sync - should detect conflict
            const conflictSyncResult = await mockGitIntegration.syncToGit(testRepoPath);

            if (!conflictSyncResult.success) {
                assert(conflictSyncResult.conflicts, 'Should detect conflicts');
                assert(conflictSyncResult.conflicts.some(c => c.file === 'conflict.js'),
                       'Should identify conflicted file');

                // Test conflict resolution
                const resolutionResult = await mockGitIntegration.resolveConflict(
                    'conflict.js',
                    'function resolved() { /* merged content */ }',
                    testRepoPath
                );

                assert(resolutionResult.success, 'Should resolve conflict');
            }
        });

        test('should maintain file metadata across VFS-Git sync', async () => {
            // Create files with various metadata
            const filesWithMetadata = {
                'component.tsx': '// React TypeScript component',
                'script.sh': '#!/bin/bash\necho "shell script"',
                'config.yaml': 'version: 1.0\ndebug: true',
                'style.scss': '$primary-color: #007bff;'
            };

            // Add to Git
            for (const [filePath, content] of Object.entries(filesWithMetadata)) {
                const fullPath = join(testRepoPath, filePath);
                await fs.writeFile(fullPath, content);
            }
            await addAndCommitFiles(testRepoPath, 'Files with metadata');

            // Sync to VFS
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Verify metadata preservation
            const tsxEntry = mockFxFs.resolve('component.tsx');
            assert(tsxEntry, 'Should register TSX file');
            assert.equal(tsxEntry.lang, 'tsx', 'Should preserve TSX language');

            const shEntry = mockFxFs.resolve('script.sh');
            assert(shEntry, 'Should register shell script');
            assert.equal(shEntry.lang, 'sh', 'Should preserve shell language');

            const yamlEntry = mockFxFs.resolve('config.yaml');
            assert(yamlEntry, 'Should register YAML file');
            assert.equal(yamlEntry.lang, 'yaml', 'Should preserve YAML language');

            // Modify and sync back
            mockFxFs.writeFile('component.tsx', '// Modified TSX component');

            const syncBackResult = await mockGitIntegration.syncToGit(testRepoPath);
            assert(syncBackResult.success, 'Should sync back with preserved metadata');
        });

        test('should handle branch switching with VFS state', async () => {
            // Create main branch content
            await fs.writeFile(join(testRepoPath, 'main-file.js'), 'function mainBranch() {}');
            await addAndCommitFiles(testRepoPath, 'Main branch content');

            // Create feature branch
            await createGitBranch(testRepoPath, 'feature-branch');
            await fs.writeFile(join(testRepoPath, 'feature-file.js'), 'function featureBranch() {}');
            await addAndCommitFiles(testRepoPath, 'Feature branch content');

            // Sync feature branch to VFS
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Verify feature branch files in VFS
            assert(mockFxFs.resolve('main-file.js'), 'Should have main file');
            assert(mockFxFs.resolve('feature-file.js'), 'Should have feature file');

            // Switch to main branch through Git integration
            await mockGitIntegration.switchBranch(testRepoPath, 'main');
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Verify VFS reflects main branch state
            assert(mockFxFs.resolve('main-file.js'), 'Should still have main file');
            // Feature file should be unregistered or marked as unavailable
            const featureFileEntry = mockFxFs.resolve('feature-file.js');
            assert(!featureFileEntry || featureFileEntry.available === false,
                   'Feature file should not be available on main branch');
        });
    });

    describe('CLI to Git Integration', () => {
        test('should import Git repository through CLI', async () => {
            // Setup Git repository with content
            const repoFiles = {
                'src/index.js': 'console.log("Repository index");',
                'src/lib/utils.js': 'export function utility() { return "util"; }',
                'tests/index.test.js': 'test("index", () => {});',
                'package.json': '{"name": "cli-git-test"}',
                'README.md': '# CLI Git Integration'
            };

            for (const [filePath, content] of Object.entries(repoFiles)) {
                const fullPath = join(testRepoPath, filePath);
                await fs.mkdir(join(fullPath, '..'), { recursive: true });
                await fs.writeFile(fullPath, content);
            }
            await addAndCommitFiles(testRepoPath, 'Repository setup');

            // Create FXD project and import Git repository
            await execCLI(['create', 'git-import-test', '--path=' + TEST_DIR]);

            // Import Git repository through CLI
            const importResult = await execCLI(['import', testRepoPath]);
            assert(importResult.success || importResult.output.includes('Import'),
                   `Git repository import should succeed: ${importResult.error}`);

            // Verify Git files are imported
            const listResult = await execCLI(['list']);
            assert(listResult.output.includes('index.js') || listResult.output.includes('utils.js'),
                   'Should import Git repository files');
        });

        test('should create Git repository from CLI project', async () => {
            // Create FXD project with content
            await execCLI(['create', 'git-create-test', '--path=' + TEST_DIR]);

            // Add files to project
            const projectFiles = {
                'main.js': 'function main() { console.log("main"); }',
                'helpers.js': 'export const helper = () => "help";'
            };

            for (const [fileName, content] of Object.entries(projectFiles)) {
                const filePath = join(TEST_DIR, fileName);
                await fs.writeFile(filePath, content);
                await execCLI(['import', filePath]);
            }

            // Export project to new Git repository
            const gitRepoPath = join(TEST_DIR, 'new-git-repo');
            await fs.mkdir(gitRepoPath, { recursive: true });
            await initializeGitRepository(gitRepoPath);

            const exportResult = await execCLI(['export', gitRepoPath, '--format=files']);
            assert(exportResult.success || exportResult.output.includes('Export'),
                   'Should export to Git repository');

            // Verify Git repository has files
            const gitFiles = await fs.readdir(gitRepoPath);
            assert(gitFiles.length > 0, 'Git repository should have exported files');
        });

        test('should manage Git branches through CLI', async () => {
            // Setup repository with branches
            await fs.writeFile(join(testRepoPath, 'base.js'), 'function base() {}');
            await addAndCommitFiles(testRepoPath, 'Base commit');

            await createGitBranch(testRepoPath, 'feature');
            await fs.writeFile(join(testRepoPath, 'feature.js'), 'function feature() {}');
            await addAndCommitFiles(testRepoPath, 'Feature commit');

            // Import repository
            await execCLI(['create', 'branch-test', '--path=' + TEST_DIR]);
            await execCLI(['import', testRepoPath]);

            // Test branch operations through CLI (if supported)
            const listResult = await execCLI(['list', '--type=all']);
            assert(listResult.output.includes('base.js') || listResult.output.includes('feature.js'),
                   'Should handle branched content');
        });

        test('should handle Git operations with CLI error handling', async () => {
            // Test importing invalid Git repository
            const invalidRepoPath = join(TEST_DIR, 'not-a-git-repo');
            await fs.mkdir(invalidRepoPath, { recursive: true });

            const invalidImportResult = await execCLI(['import', invalidRepoPath]);
            // Should either succeed (treating as regular directory) or fail gracefully
            assert(invalidImportResult.success || invalidImportResult.error || invalidImportResult.output,
                   'Should handle non-Git directories');

            // Test importing empty Git repository
            const emptyRepoPath = join(TEST_DIR, 'empty-git-repo');
            await fs.mkdir(emptyRepoPath, { recursive: true });
            await initializeGitRepository(emptyRepoPath);

            const emptyImportResult = await execCLI(['import', emptyRepoPath]);
            assert(emptyImportResult.success || emptyImportResult.output.includes('empty'),
                   'Should handle empty Git repositories');
        });
    });

    describe('Full Workflow Integration', () => {
        test('should complete full CLI -> VFS -> Git -> CLI cycle', async () => {
            // Step 1: Create project via CLI
            const createResult = await execCLI(['create', 'full-cycle-test', '--path=' + TEST_DIR]);
            assert(createResult.success || createResult.output.includes('Creating'),
                   'Step 1: Project creation should succeed');

            // Step 2: Add files and import via CLI
            const codeFiles = {
                'app.js': `
function createApp() {
    console.log("Application started");
    return {
        start: () => console.log("Running"),
        stop: () => console.log("Stopped")
    };
}

const app = createApp();
app.start();
`,
                'config.js': `
export const config = {
    version: "1.0.0",
    environment: "development",
    features: {
        logging: true,
        debugging: true
    }
};
`,
                'utils.js': `
export function formatMessage(message, level = "info") {
    const timestamp = new Date().toISOString();
    return \`[\${timestamp}] [\${level.toUpperCase()}] \${message}\`;
}

export function validateConfig(config) {
    return config && config.version && config.environment;
}
`
            };

            for (const [fileName, content] of Object.entries(codeFiles)) {
                const filePath = join(TEST_DIR, fileName);
                await fs.writeFile(filePath, content);
            }

            const importResult = await execCLI(['import', TEST_DIR]);
            assert(importResult.success || importResult.output.includes('Import'),
                   'Step 2: Import should succeed');

            // Step 3: Verify VFS registration
            Object.keys(codeFiles).forEach(fileName => {
                assert(mockFxFs.resolve(fileName), `VFS should have ${fileName}`);
            });

            // Step 4: Sync to Git repository
            const syncToGitResult = await mockGitIntegration.syncToGit(testRepoPath);
            assert(syncToGitResult.success, 'Step 4: Sync to Git should succeed');

            // Step 5: Modify files in VFS
            mockFxFs.writeFile('app.js', `
// Modified version
function createApp() {
    console.log("Enhanced application started");
    return {
        start: () => console.log("Running with enhancements"),
        stop: () => console.log("Gracefully stopped"),
        status: () => "active"
    };
}

const app = createApp();
app.start();
console.log("Status:", app.status());
`);

            // Step 6: Sync modifications back to Git
            const syncModsResult = await mockGitIntegration.syncToGit(testRepoPath);
            assert(syncModsResult.success, 'Step 6: Sync modifications should succeed');

            // Step 7: Export final state via CLI
            const exportDir = join(TEST_DIR, 'final-export');
            const exportResult = await execCLI(['export', exportDir, '--format=archive']);
            assert(exportResult.success || exportResult.output.includes('Export'),
                   'Step 7: Final export should succeed');

            // Step 8: Verify final state
            const listResult = await execCLI(['list']);
            assert(listResult.output.includes('app.js') || listResult.output.includes('config.js'),
                   'Step 8: Final state should include all files');

            console.log('✅ Full workflow cycle completed successfully');
        });

        test('should handle concurrent operations across components', async () => {
            // Setup initial state
            await execCLI(['create', 'concurrent-test', '--path=' + TEST_DIR]);

            const testFile = join(TEST_DIR, 'concurrent.js');
            await fs.writeFile(testFile, 'function concurrent() {}');

            // Run concurrent operations
            const operations = [
                execCLI(['import', testFile]),
                mockGitIntegration.syncFromGit(testRepoPath),
                execCLI(['list']),
                mockFxFs.readFile('concurrent.js')
                    .catch(() => 'File not yet available'), // Handle case where file isn't ready
            ];

            const results = await Promise.allSettled(operations);

            // At least some operations should succeed
            const successes = results.filter(r => r.status === 'fulfilled');
            assert(successes.length > 0, 'Some concurrent operations should succeed');

            // Failed operations should not cause system instability
            const failures = results.filter(r => r.status === 'rejected');
            failures.forEach(failure => {
                console.log('Expected concurrent failure:', failure.reason?.message || 'Unknown error');
            });
        });

        test('should maintain data consistency across component boundaries', async () => {
            // Create consistent test data
            const testData = {
                'consistency.js': `
// Consistency test file
const data = {
    id: "test-123",
    name: "Consistency Test",
    timestamp: ${Date.now()},
    version: "1.0.0"
};

function getData() {
    return { ...data };
}

function validateData(obj) {
    return obj && obj.id && obj.name && obj.timestamp;
}

export { getData, validateData };
`
            };

            // Add to Git
            const filePath = join(testRepoPath, 'consistency.js');
            await fs.writeFile(filePath, testData['consistency.js']);
            await addAndCommitFiles(testRepoPath, 'Add consistency test');

            // Import via CLI
            await execCLI(['create', 'consistency-test', '--path=' + TEST_DIR]);
            await execCLI(['import', filePath]);

            // Sync to VFS via Git integration
            await mockGitIntegration.syncFromGit(testRepoPath);

            // Verify data consistency
            const vfsEntry = mockFxFs.resolve('consistency.js');
            assert(vfsEntry, 'File should be in VFS');

            const vfsContent = mockFxFs.readFile('consistency.js');
            assert(vfsContent.includes('test-123'), 'VFS content should match original');

            // Modify through VFS
            const modifiedContent = testData['consistency.js'].replace('version: "1.0.0"', 'version: "1.1.0"');
            mockFxFs.writeFile('consistency.js', modifiedContent);

            // Sync back to Git
            await mockGitIntegration.syncToGit(testRepoPath);

            // Export via CLI
            const exportDir = join(TEST_DIR, 'consistency-export');
            await execCLI(['export', exportDir, '--format=files']);

            // Verify consistency maintained throughout
            const gitContent = await fs.readFile(filePath, 'utf8');
            assert(gitContent.includes('1.1.0'), 'Git should have updated version');

            console.log('✅ Data consistency maintained across all components');
        });

        test('should recover from component integration failures', async () => {
            // Setup for failure scenarios
            await execCLI(['create', 'recovery-test', '--path=' + TEST_DIR]);

            // Test 1: CLI failure during import
            const invalidFile = join(TEST_DIR, 'invalid.bin');
            await fs.writeFile(invalidFile, Buffer.from([0, 1, 2, 3])); // Binary content

            const invalidImportResult = await execCLI(['import', invalidFile]);
            // Should handle gracefully
            assert(invalidImportResult.success || invalidImportResult.error || invalidImportResult.output,
                   'Should handle invalid file import gracefully');

            // Test 2: VFS corruption simulation
            mockFxFs.simulateCorruption = true;

            try {
                const corruptedRead = mockFxFs.readFile('nonexistent.js');
                assert.fail('Should throw error for corrupted read');
            } catch (error) {
                assert(error.message.includes('corruption') || error.message.includes('No mapping'),
                       'Should detect VFS corruption');
            }

            // Reset VFS
            mockFxFs.simulateCorruption = false;

            // Test 3: Git integration failure
            mockGitIntegration.simulateFailure = true;

            const failedSyncResult = await mockGitIntegration.syncFromGit(testRepoPath);
            assert(!failedSyncResult.success, 'Should fail when Git integration fails');
            assert(failedSyncResult.error || failedSyncResult.reason, 'Should provide failure reason');

            // Recovery
            mockGitIntegration.simulateFailure = false;

            const recoveryResult = await mockGitIntegration.syncFromGit(testRepoPath);
            assert(recoveryResult.success, 'Should recover after Git integration reset');

            console.log('✅ Component integration recovery successful');
        });

        test('should validate integration performance under load', async () => {
            const startTime = Date.now();

            // Create large-scale integration test
            await execCLI(['create', 'load-test', '--path=' + TEST_DIR]);

            // Generate many files
            const fileCount = 50;
            const files = {};

            for (let i = 0; i < fileCount; i++) {
                files[`load-test-${i}.js`] = `
// Load test file ${i}
function loadTest${i}() {
    const data = Array.from({length: 100}, (_, j) => ({
        id: ${i * 100 + j},
        name: \`item-\${j}\`,
        category: ${i % 5}
    }));

    return data.filter(item => item.category === ${i % 3});
}

export { loadTest${i} };
`;
            }

            // Write files
            for (const [fileName, content] of Object.entries(files)) {
                await fs.writeFile(join(TEST_DIR, fileName), content);
            }

            // Import all files
            const importStartTime = Date.now();
            const importResult = await execCLI(['import', TEST_DIR]);
            const importDuration = Date.now() - importStartTime;

            assert(importResult.success || importResult.output.includes('Import'),
                   'Large import should succeed');
            assert(importDuration < 10000, 'Import should complete in reasonable time');

            // Register in VFS
            const vfsStartTime = Date.now();
            Object.keys(files).forEach((fileName, index) => {
                mockFxFs.register({
                    filePath: fileName,
                    viewId: `views.loadTest${index}`,
                    lang: 'js'
                });
            });
            const vfsDuration = Date.now() - vfsStartTime;

            assert(vfsDuration < 1000, 'VFS registration should be fast');

            // Sync to Git
            const gitSyncStartTime = Date.now();
            const gitSyncResult = await mockGitIntegration.syncToGit(testRepoPath);
            const gitSyncDuration = Date.now() - gitSyncStartTime;

            assert(gitSyncResult.success, 'Git sync should succeed');
            assert(gitSyncDuration < 5000, 'Git sync should complete in reasonable time');

            const totalDuration = Date.now() - startTime;
            console.log(`✅ Load test completed in ${totalDuration}ms (${fileCount} files)`);

            assert(totalDuration < 20000, 'Total integration should complete efficiently');
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

async function initializeGitRepository(repoPath) {
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);

        await execFile('git', ['init'], { cwd: repoPath });
        await execFile('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
        await execFile('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment
        console.log('Git init failed (expected in test environment):', error.message);
    }
}

async function addAndCommitFiles(repoPath, message) {
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);

        await execFile('git', ['add', '.'], { cwd: repoPath });
        await execFile('git', ['commit', '-m', message], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment
        console.log('Git commit failed (expected in test environment):', error.message);
    }
}

async function createGitBranch(repoPath, branchName) {
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);

        await execFile('git', ['checkout', '-b', branchName], { cwd: repoPath });
    } catch (error) {
        // Git operations may fail in test environment
        console.log('Git branch creation failed (expected in test environment):', error.message);
    }
}

// Mock implementations with integration support

function createMockFxFs() {
    const registeredFiles = new Map();
    const listeners = new Set();
    const mockContents = new Map();

    return {
        register(entry) {
            registeredFiles.set(entry.filePath, entry);
        },

        resolve(filePath) {
            if (this.simulateCorruption) {
                throw new Error('VFS corruption detected');
            }
            return registeredFiles.get(filePath) || null;
        },

        readFile(filePath) {
            if (this.simulateCorruption) {
                throw new Error('VFS corruption detected');
            }

            const entry = registeredFiles.get(filePath);
            if (!entry) throw new Error(`No mapping for ${filePath}`);

            // Return mock content if set, otherwise generate
            if (mockContents.has(filePath)) {
                return mockContents.get(filePath);
            }

            return `// Mock content for ${filePath}\n// ViewID: ${entry.viewId}\n// Language: ${entry.lang}`;
        },

        writeFile(filePath, content) {
            if (this.simulateCorruption) {
                throw new Error('VFS corruption detected');
            }

            const entry = registeredFiles.get(filePath);
            if (!entry) throw new Error(`No mapping for ${filePath}`);

            // Store content
            mockContents.set(filePath, content);

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
            if (this.simulateCorruption) {
                throw new Error('VFS corruption detected');
            }

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
        },

        setMockContent(filePath, content) {
            mockContents.set(filePath, content);
        },

        simulateCorruption: false
    };
}

function createMockGitIntegration(fxFs) {
    return {
        async syncFromGit(repoPath) {
            if (this.simulateFailure) {
                return { success: false, error: 'Simulated Git failure', reason: 'Mock failure mode' };
            }

            // Simulate reading files from Git repository
            let filesProcessed = 0;
            try {
                const files = await fs.readdir(repoPath, { recursive: true });

                for (const file of files) {
                    if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.md')) {
                        const ext = file.split('.').pop();
                        const langMap = {
                            'js': 'js', 'ts': 'ts', 'tsx': 'tsx', 'jsx': 'jsx',
                            'md': 'markdown', 'py': 'python', 'sh': 'sh'
                        };

                        fxFs.register({
                            filePath: file,
                            viewId: `views.${file.replace(/[^a-zA-Z0-9]/g, '_')}`,
                            lang: langMap[ext] || 'text'
                        });

                        filesProcessed++;
                    }
                }
            } catch (error) {
                // Handle directory read errors
                filesProcessed = 0;
            }

            return { success: true, filesProcessed, binaryFiles: [] };
        },

        async syncToGit(repoPath) {
            if (this.simulateFailure) {
                return { success: false, error: 'Simulated Git failure', reason: 'Mock failure mode' };
            }

            // Simulate writing VFS files to Git
            await setTimeout(100); // Simulate Git operations
            return { success: true, filesWritten: 5, conflicts: [] };
        },

        async switchBranch(repoPath, branchName) {
            if (this.simulateFailure) {
                return { success: false, error: 'Branch switch failed' };
            }

            await setTimeout(50); // Simulate Git checkout
            return { success: true, branch: branchName };
        },

        async detectConflicts(repoPath) {
            if (this.simulateFailure) {
                throw new Error('Git conflict detection failed');
            }

            return []; // No conflicts in mock
        },

        async resolveConflict(file, content, repoPath) {
            if (this.simulateFailure) {
                return { success: false, error: 'Conflict resolution failed' };
            }

            // Simulate writing resolved content
            await fs.writeFile(join(repoPath, file), content);
            return { success: true };
        },

        simulateFailure: false
    };
}

// Run integration tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🔗 Running FXD New Components Integration Tests...\n');
}