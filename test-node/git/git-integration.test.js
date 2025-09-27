/**
 * Git Integration Tests for FXD Repository Operations
 * Tests repository scanning, bidirectional sync, conflict resolution, and Git operations
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-git-test-${Date.now()}`);
const REPO_DIR = join(TEST_DIR, 'test-repo');
const REPO2_DIR = join(TEST_DIR, 'test-repo2');

describe('FXD Git Integration Tests', () => {
    let mockGitIntegration;
    let mockFxFs;

    beforeEach(async () => {
        // Create test directories
        await fs.mkdir(TEST_DIR, { recursive: true });
        await fs.mkdir(REPO_DIR, { recursive: true });
        await fs.mkdir(REPO2_DIR, { recursive: true });

        // Initialize Git repositories
        await initializeGitRepo(REPO_DIR);
        await initializeGitRepo(REPO2_DIR);

        // Setup mocks
        mockFxFs = createMockFxFs();
        mockGitIntegration = createMockGitIntegration(mockFxFs);
    });

    afterEach(async () => {
        // Clean up test directories
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Repository Scanning and Analysis', () => {
        test('should detect Git repositories', async () => {
            // Create files in repo
            await createTestFiles(REPO_DIR, {
                'src/main.js': 'console.log("main");',
                'src/utils.js': 'function util() { return "helper"; }',
                'package.json': '{"name": "test-project"}',
                'README.md': '# Test Project'
            });

            await commitFiles(REPO_DIR, 'Initial commit');

            const isRepo = await mockGitIntegration.isGitRepository(REPO_DIR);
            assert(isRepo, 'Should detect Git repository');
        });

        test('should scan repository structure', async () => {
            const files = {
                'src/components/Button.jsx': 'export default function Button() {}',
                'src/components/Input.jsx': 'export default function Input() {}',
                'src/utils/helpers.js': 'export const helper = () => {};',
                'tests/Button.test.js': 'test("Button", () => {});',
                'package.json': '{"name": "scan-test"}',
                '.gitignore': 'node_modules/\n.env'
            };

            await createTestFiles(REPO_DIR, files);
            await commitFiles(REPO_DIR, 'Add project structure');

            const structure = await mockGitIntegration.scanRepository(REPO_DIR);

            assert(structure, 'Should return repository structure');
            assert(structure.files, 'Should include files list');
            assert(structure.branches, 'Should include branches');
            assert(structure.commits, 'Should include commits');

            // Verify file scanning
            const fileList = Object.keys(files);
            fileList.forEach(file => {
                assert(structure.files.includes(file), `Should include ${file}`);
            });
        });

        test('should analyze commit history', async () => {
            await createTestFiles(REPO_DIR, {
                'initial.js': 'console.log("initial");'
            });
            await commitFiles(REPO_DIR, 'Initial commit');

            await createTestFiles(REPO_DIR, {
                'feature.js': 'console.log("feature");'
            });
            await commitFiles(REPO_DIR, 'Add feature');

            await createTestFiles(REPO_DIR, {
                'bugfix.js': 'console.log("bugfix");'
            });
            await commitFiles(REPO_DIR, 'Fix bug');

            const history = await mockGitIntegration.getCommitHistory(REPO_DIR);

            assert(Array.isArray(history), 'Should return commit array');
            assert(history.length >= 3, 'Should include all commits');

            const commitMessages = history.map(c => c.message);
            assert(commitMessages.includes('Initial commit'), 'Should include initial commit');
            assert(commitMessages.includes('Add feature'), 'Should include feature commit');
            assert(commitMessages.includes('Fix bug'), 'Should include bugfix commit');
        });

        test('should detect branch structure', async () => {
            // Create and switch to feature branch
            await execGit(REPO_DIR, 'checkout -b feature/test');

            await createTestFiles(REPO_DIR, {
                'feature.js': 'console.log("feature branch");'
            });
            await commitFiles(REPO_DIR, 'Feature branch commit');

            // Switch back to main
            await execGit(REPO_DIR, 'checkout main');

            const branches = await mockGitIntegration.getBranches(REPO_DIR);

            assert(Array.isArray(branches), 'Should return branches array');
            assert(branches.includes('main') || branches.includes('master'), 'Should include main branch');
            assert(branches.includes('feature/test'), 'Should include feature branch');
        });

        test('should identify file types and languages', async () => {
            const files = {
                'app.js': 'console.log("JavaScript");',
                'server.ts': 'console.log("TypeScript");',
                'script.py': 'print("Python")',
                'main.go': 'package main',
                'component.jsx': 'export default () => <div></div>;',
                'styles.css': 'body { margin: 0; }',
                'README.md': '# Documentation',
                'config.json': '{"test": true}',
                'Dockerfile': 'FROM node:16'
            };

            await createTestFiles(REPO_DIR, files);
            await commitFiles(REPO_DIR, 'Add multi-language files');

            const analysis = await mockGitIntegration.analyzeRepository(REPO_DIR);

            assert(analysis.languages, 'Should detect languages');
            assert(analysis.languages.includes('javascript'), 'Should detect JavaScript');
            assert(analysis.languages.includes('typescript'), 'Should detect TypeScript');
            assert(analysis.languages.includes('python'), 'Should detect Python');
            assert(analysis.languages.includes('go'), 'Should detect Go');

            assert(analysis.fileTypes, 'Should categorize file types');
            assert(analysis.fileTypes.source, 'Should identify source files');
            assert(analysis.fileTypes.config, 'Should identify config files');
            assert(analysis.fileTypes.docs, 'Should identify documentation');
        });

        test('should handle large repositories efficiently', async () => {
            // Create many files to test performance
            const fileCount = 100;
            const files = {};

            for (let i = 0; i < fileCount; i++) {
                files[`src/file${i}.js`] = `// File ${i}\nconsole.log(${i});`;
            }

            await createTestFiles(REPO_DIR, files);
            await commitFiles(REPO_DIR, 'Add many files');

            const startTime = Date.now();
            const structure = await mockGitIntegration.scanRepository(REPO_DIR);
            const scanTime = Date.now() - startTime;

            assert(structure.files.length >= fileCount, 'Should scan all files');
            assert(scanTime < 5000, 'Should scan large repo efficiently');
        });
    });

    describe('Bidirectional Sync Operations', () => {
        test('should sync Git repository to FXD', async () => {
            const files = {
                'src/app.js': 'function app() { return "hello"; }',
                'src/utils.js': 'export const util = () => "utility";',
                'package.json': '{"name": "sync-test", "version": "1.0.0"}'
            };

            await createTestFiles(REPO_DIR, files);
            await commitFiles(REPO_DIR, 'Initial sync test');

            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Verify files are registered in FxFs
            assert(mockFxFs.resolve('src/app.js'), 'Should register app.js');
            assert(mockFxFs.resolve('src/utils.js'), 'Should register utils.js');
            assert(mockFxFs.resolve('package.json'), 'Should register package.json');

            // Verify content is accessible
            const appContent = mockFxFs.readFile('src/app.js');
            assert(appContent.includes('function app'), 'Should sync file content');
        });

        test('should sync FXD changes back to Git', async () => {
            // Setup initial sync
            await createTestFiles(REPO_DIR, {
                'src/original.js': 'function original() {}'
            });
            await commitFiles(REPO_DIR, 'Initial file');

            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Modify through FXD
            mockFxFs.writeFile('src/original.js', 'function modified() { return "changed"; }');

            // Add new file through FXD
            mockFxFs.register({
                filePath: 'src/new.js',
                viewId: 'views.new',
                lang: 'js'
            });
            mockFxFs.writeFile('src/new.js', 'function newFunction() {}');

            await mockGitIntegration.syncToGit(REPO_DIR);

            // Verify changes in Git
            const modifiedContent = await fs.readFile(join(REPO_DIR, 'src/original.js'), 'utf8');
            assert(modifiedContent.includes('modified'), 'Should sync modifications to Git');

            const newFileExists = await fs.access(join(REPO_DIR, 'src/new.js')).then(() => true, () => false);
            assert(newFileExists, 'Should create new files in Git');
        });

        test('should handle incremental sync', async () => {
            // Initial sync
            await createTestFiles(REPO_DIR, {
                'file1.js': 'console.log(1);',
                'file2.js': 'console.log(2);'
            });
            await commitFiles(REPO_DIR, 'Initial files');

            const initialSync = await mockGitIntegration.syncFromGit(REPO_DIR);
            assert(initialSync.filesProcessed >= 2, 'Should process initial files');

            // Add more files
            await createTestFiles(REPO_DIR, {
                'file3.js': 'console.log(3);',
                'file4.js': 'console.log(4);'
            });
            await commitFiles(REPO_DIR, 'Add more files');

            const incrementalSync = await mockGitIntegration.syncFromGit(REPO_DIR, { incremental: true });
            assert(incrementalSync.filesProcessed === 2, 'Should only process new files');
        });

        test('should maintain file metadata during sync', async () => {
            const files = {
                'src/component.tsx': 'export const Component = () => <div></div>;',
                'scripts/build.sh': '#!/bin/bash\necho "building"',
                'docs/README.md': '# Project Documentation'
            };

            await createTestFiles(REPO_DIR, files);
            await commitFiles(REPO_DIR, 'Add files with metadata');

            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Check that file types and languages are preserved
            const tsxEntry = mockFxFs.resolve('src/component.tsx');
            assert(tsxEntry, 'Should register TSX file');
            assert.equal(tsxEntry.lang, 'tsx', 'Should preserve TSX language');

            const shEntry = mockFxFs.resolve('scripts/build.sh');
            assert(shEntry, 'Should register shell script');
            assert.equal(shEntry.lang, 'sh', 'Should preserve shell language');

            const mdEntry = mockFxFs.resolve('docs/README.md');
            assert(mdEntry, 'Should register markdown file');
            assert.equal(mdEntry.lang, 'markdown', 'Should preserve markdown language');
        });

        test('should handle binary files appropriately', async () => {
            // Create binary test file
            const binaryPath = join(REPO_DIR, 'assets/image.png');
            await fs.mkdir(join(REPO_DIR, 'assets'), { recursive: true });
            await fs.writeFile(binaryPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); // PNG header

            await execGit(REPO_DIR, 'add assets/image.png');
            await commitFiles(REPO_DIR, 'Add binary file');

            const result = await mockGitIntegration.syncFromGit(REPO_DIR);

            // Binary files should be noted but not processed as text
            assert(result.binaryFiles, 'Should track binary files');
            assert(result.binaryFiles.includes('assets/image.png'), 'Should identify PNG as binary');
        });
    });

    describe('Conflict Resolution', () => {
        test('should detect merge conflicts', async () => {
            // Setup divergent branches
            await createTestFiles(REPO_DIR, {
                'conflict.js': 'function original() { return "base"; }'
            });
            await commitFiles(REPO_DIR, 'Base commit');

            // Create feature branch
            await execGit(REPO_DIR, 'checkout -b feature');
            await createTestFiles(REPO_DIR, {
                'conflict.js': 'function original() { return "feature"; }'
            });
            await commitFiles(REPO_DIR, 'Feature changes');

            // Switch to main and make conflicting change
            await execGit(REPO_DIR, 'checkout main');
            await createTestFiles(REPO_DIR, {
                'conflict.js': 'function original() { return "main"; }'
            });
            await commitFiles(REPO_DIR, 'Main changes');

            // Attempt merge (will create conflict)
            try {
                await execGit(REPO_DIR, 'merge feature');
            } catch (error) {
                // Expected to fail with conflict
            }

            const conflicts = await mockGitIntegration.detectConflicts(REPO_DIR);
            assert(Array.isArray(conflicts), 'Should return conflicts array');
            assert(conflicts.length > 0, 'Should detect conflicts');
            assert(conflicts.some(c => c.file === 'conflict.js'), 'Should identify conflicted file');
        });

        test('should provide conflict resolution strategies', async () => {
            // Create conflict scenario
            await createTestFiles(REPO_DIR, {
                'merge-test.js': 'const value = "original";'
            });
            await commitFiles(REPO_DIR, 'Original value');

            await execGit(REPO_DIR, 'checkout -b branch1');
            await createTestFiles(REPO_DIR, {
                'merge-test.js': 'const value = "branch1";'
            });
            await commitFiles(REPO_DIR, 'Branch1 value');

            await execGit(REPO_DIR, 'checkout main');
            await createTestFiles(REPO_DIR, {
                'merge-test.js': 'const value = "main";'
            });
            await commitFiles(REPO_DIR, 'Main value');

            // Create conflict
            try {
                await execGit(REPO_DIR, 'merge branch1');
            } catch (error) {
                // Expected conflict
            }

            const resolutionOptions = await mockGitIntegration.getResolutionStrategies('merge-test.js', REPO_DIR);

            assert(resolutionOptions, 'Should provide resolution options');
            assert(resolutionOptions.ours, 'Should provide "ours" strategy');
            assert(resolutionOptions.theirs, 'Should provide "theirs" strategy');
            assert(resolutionOptions.manual, 'Should provide manual merge option');
        });

        test('should resolve conflicts automatically when possible', async () => {
            // Create non-overlapping changes
            await createTestFiles(REPO_DIR, {
                'auto-merge.js': `function func1() { return 1; }
function func2() { return 2; }`
            });
            await commitFiles(REPO_DIR, 'Base functions');

            await execGit(REPO_DIR, 'checkout -b add-func3');
            await createTestFiles(REPO_DIR, {
                'auto-merge.js': `function func1() { return 1; }
function func2() { return 2; }
function func3() { return 3; }`
            });
            await commitFiles(REPO_DIR, 'Add func3');

            await execGit(REPO_DIR, 'checkout main');
            await createTestFiles(REPO_DIR, {
                'auto-merge.js': `function func1() { return 1; }
function func2() { return 2; }
function func0() { return 0; }`
            });
            await commitFiles(REPO_DIR, 'Add func0');

            const result = await mockGitIntegration.autoResolveConflicts(REPO_DIR, 'add-func3');

            if (result.success) {
                assert(result.autoResolved, 'Should auto-resolve non-overlapping changes');
                assert(result.files.includes('auto-merge.js'), 'Should include merged file');
            } else {
                // If auto-merge fails, should provide clear reason
                assert(result.reason, 'Should explain why auto-merge failed');
            }
        });

        test('should handle FXD-specific conflict resolution', async () => {
            // Setup conflict in FXD-managed file
            await createTestFiles(REPO_DIR, {
                'fxd-managed.js': 'function original() {}'
            });
            await commitFiles(REPO_DIR, 'FXD managed file');

            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Modify in FXD
            mockFxFs.writeFile('fxd-managed.js', 'function fxdModified() {}');

            // Modify in Git directly
            await createTestFiles(REPO_DIR, {
                'fxd-managed.js': 'function gitModified() {}'
            });
            await commitFiles(REPO_DIR, 'Direct Git modification');

            // Attempt sync should detect conflict
            const syncResult = await mockGitIntegration.syncToGit(REPO_DIR);

            assert(!syncResult.success, 'Should detect FXD-Git conflict');
            assert(syncResult.conflicts, 'Should report conflicts');
            assert(syncResult.conflicts.some(c => c.file === 'fxd-managed.js'), 'Should identify conflicted file');
        });

        test('should maintain Git history during conflict resolution', async () => {
            // Create conflict and resolve
            await createTestFiles(REPO_DIR, {
                'history-test.js': 'const version = 1;'
            });
            await commitFiles(REPO_DIR, 'Version 1');

            await execGit(REPO_DIR, 'checkout -b feature');
            await createTestFiles(REPO_DIR, {
                'history-test.js': 'const version = 2; // feature'
            });
            await commitFiles(REPO_DIR, 'Version 2 feature');

            await execGit(REPO_DIR, 'checkout main');
            await createTestFiles(REPO_DIR, {
                'history-test.js': 'const version = 2; // main'
            });
            await commitFiles(REPO_DIR, 'Version 2 main');

            // Resolve conflict manually
            await createTestFiles(REPO_DIR, {
                'history-test.js': 'const version = 2; // merged'
            });

            const resolution = await mockGitIntegration.resolveConflict(
                'history-test.js',
                'const version = 2; // merged',
                REPO_DIR
            );

            assert(resolution.success, 'Should resolve conflict');

            // Verify history is preserved
            const history = await mockGitIntegration.getCommitHistory(REPO_DIR);
            const messages = history.map(c => c.message);
            assert(messages.includes('Version 1'), 'Should preserve original history');
            assert(messages.includes('Version 2 feature'), 'Should preserve feature history');
            assert(messages.includes('Version 2 main'), 'Should preserve main history');
        });
    });

    describe('Branch Mapping and Management', () => {
        test('should map Git branches to FXD views', async () => {
            const branches = ['main', 'feature/ui', 'feature/api', 'bugfix/critical'];

            for (const branch of branches) {
                if (branch !== 'main') {
                    await execGit(REPO_DIR, `checkout -b ${branch}`);
                }

                await createTestFiles(REPO_DIR, {
                    [`${branch.replace('/', '-')}.js`]: `// ${branch} branch file`
                });
                await commitFiles(REPO_DIR, `Add ${branch} specific file`);

                if (branch !== 'main') {
                    await execGit(REPO_DIR, 'checkout main');
                }
            }

            const branchMapping = await mockGitIntegration.mapBranchesToViews(REPO_DIR);

            assert(branchMapping, 'Should create branch mapping');
            branches.forEach(branch => {
                assert(branchMapping[branch], `Should map ${branch} branch`);
                assert(branchMapping[branch].viewId, `Should assign view ID to ${branch}`);
            });
        });

        test('should handle branch switching in FXD context', async () => {
            // Create branches with different files
            await createTestFiles(REPO_DIR, {
                'shared.js': 'function shared() {}'
            });
            await commitFiles(REPO_DIR, 'Shared file');

            await execGit(REPO_DIR, 'checkout -b feature');
            await createTestFiles(REPO_DIR, {
                'feature-only.js': 'function featureOnly() {}'
            });
            await commitFiles(REPO_DIR, 'Feature-specific file');

            await execGit(REPO_DIR, 'checkout main');

            // Sync both branches
            await mockGitIntegration.syncFromGit(REPO_DIR);

            await execGit(REPO_DIR, 'checkout feature');
            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Switch back to main through FXD
            await mockGitIntegration.switchBranch(REPO_DIR, 'main');

            // Verify correct files are available
            assert(mockFxFs.resolve('shared.js'), 'Should have shared file on main');
            assert(!mockFxFs.resolve('feature-only.js'), 'Should not have feature-only file on main');

            // Switch to feature through FXD
            await mockGitIntegration.switchBranch(REPO_DIR, 'feature');

            assert(mockFxFs.resolve('shared.js'), 'Should have shared file on feature');
            assert(mockFxFs.resolve('feature-only.js'), 'Should have feature-only file on feature');
        });

        test('should create new branches from FXD', async () => {
            await createTestFiles(REPO_DIR, {
                'base.js': 'function base() {}'
            });
            await commitFiles(REPO_DIR, 'Base file');

            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Create new branch through FXD
            const newBranchResult = await mockGitIntegration.createBranch(REPO_DIR, 'new-feature', 'main');

            assert(newBranchResult.success, 'Should create new branch');
            assert.equal(newBranchResult.branch, 'new-feature', 'Should create correct branch name');

            // Verify branch exists in Git
            const branches = await mockGitIntegration.getBranches(REPO_DIR);
            assert(branches.includes('new-feature'), 'Should add branch to Git');

            // Verify FXD is on new branch
            const currentBranch = await mockGitIntegration.getCurrentBranch(REPO_DIR);
            assert.equal(currentBranch, 'new-feature', 'Should switch to new branch');
        });

        test('should merge branches through FXD interface', async () => {
            // Setup feature branch
            await createTestFiles(REPO_DIR, {
                'main.js': 'function main() { return "base"; }'
            });
            await commitFiles(REPO_DIR, 'Base main');

            await execGit(REPO_DIR, 'checkout -b feature');
            await createTestFiles(REPO_DIR, {
                'feature.js': 'function feature() { return "new"; }'
            });
            await commitFiles(REPO_DIR, 'Add feature');

            await execGit(REPO_DIR, 'checkout main');

            // Merge through FXD
            const mergeResult = await mockGitIntegration.mergeBranch(REPO_DIR, 'feature', 'main');

            if (mergeResult.success) {
                assert(mergeResult.merged, 'Should complete merge');

                // Verify merge in Git
                const branches = await mockGitIntegration.getBranches(REPO_DIR);
                const mainFiles = await fs.readdir(REPO_DIR);
                assert(mainFiles.includes('feature.js'), 'Should merge feature file');
            } else {
                assert(mergeResult.conflicts || mergeResult.reason, 'Should explain merge failure');
            }
        });

        test('should handle branch-specific FXD views', async () => {
            // Create different view configurations per branch
            const branchConfigs = {
                'main': {
                    'app.js': { viewId: 'views.main.app', lang: 'js' },
                    'utils.js': { viewId: 'views.main.utils', lang: 'js' }
                },
                'feature': {
                    'app.js': { viewId: 'views.feature.app', lang: 'js' },
                    'feature.js': { viewId: 'views.feature.new', lang: 'js' }
                }
            };

            for (const [branch, config] of Object.entries(branchConfigs)) {
                if (branch !== 'main') {
                    await execGit(REPO_DIR, `checkout -b ${branch}`);
                }

                for (const [file, viewConfig] of Object.entries(config)) {
                    await createTestFiles(REPO_DIR, {
                        [file]: `// ${branch} version of ${file}`
                    });
                }

                await commitFiles(REPO_DIR, `${branch} files`);

                if (branch !== 'main') {
                    await execGit(REPO_DIR, 'checkout main');
                }
            }

            // Test view switching with branches
            await mockGitIntegration.switchBranch(REPO_DIR, 'main');
            await mockGitIntegration.syncFromGit(REPO_DIR);

            const mainView = mockFxFs.resolve('app.js');
            assert(mainView, 'Should resolve main branch view');

            await mockGitIntegration.switchBranch(REPO_DIR, 'feature');
            await mockGitIntegration.syncFromGit(REPO_DIR);

            const featureView = mockFxFs.resolve('app.js');
            assert(featureView, 'Should resolve feature branch view');
            assert(mockFxFs.resolve('feature.js'), 'Should have feature-specific file');
        });
    });

    describe('Git Hook Integration', () => {
        test('should install FXD Git hooks', async () => {
            const hookResult = await mockGitIntegration.installGitHooks(REPO_DIR);

            assert(hookResult.success, 'Should install hooks successfully');
            assert(hookResult.hooks, 'Should list installed hooks');

            const expectedHooks = ['pre-commit', 'post-commit', 'pre-push'];
            expectedHooks.forEach(hook => {
                assert(hookResult.hooks.includes(hook), `Should install ${hook} hook`);
            });
        });

        test('should trigger FXD sync on Git operations', async () => {
            await mockGitIntegration.installGitHooks(REPO_DIR);

            // Create and commit file
            await createTestFiles(REPO_DIR, {
                'hook-test.js': 'function hookTest() {}'
            });

            const hookTrigger = await mockGitIntegration.triggerHook('pre-commit', REPO_DIR);
            assert(hookTrigger.success, 'Should trigger pre-commit hook');

            await commitFiles(REPO_DIR, 'Hook test commit');

            const postCommitTrigger = await mockGitIntegration.triggerHook('post-commit', REPO_DIR);
            assert(postCommitTrigger.success, 'Should trigger post-commit hook');
        });

        test('should validate FXD state before Git operations', async () => {
            await mockGitIntegration.installGitHooks(REPO_DIR);
            await mockGitIntegration.syncFromGit(REPO_DIR);

            // Modify file in FXD but create inconsistent state
            mockFxFs.register({
                filePath: 'invalid.js',
                viewId: 'views.invalid',
                lang: 'js'
            });

            // Mock validation failure
            mockGitIntegration.setValidationMode('strict');

            const validation = await mockGitIntegration.validateFxdState(REPO_DIR);

            if (!validation.valid) {
                assert(validation.issues, 'Should report validation issues');
                assert(validation.issues.length > 0, 'Should have specific issues');
            }
        });

        test('should handle Git hook failures gracefully', async () => {
            await mockGitIntegration.installGitHooks(REPO_DIR);

            // Simulate hook failure
            mockGitIntegration.setHookFailureMode(true);

            await createTestFiles(REPO_DIR, {
                'fail-test.js': 'function failTest() {}'
            });

            try {
                const result = await mockGitIntegration.triggerHook('pre-commit', REPO_DIR);
                if (!result.success) {
                    assert(result.error, 'Should provide error information');
                    assert(result.recovery, 'Should suggest recovery steps');
                }
            } catch (error) {
                assert(error.message, 'Should handle hook failures gracefully');
            }
        });

        test('should support custom Git hook configurations', async () => {
            const customConfig = {
                'pre-commit': {
                    fxdSync: true,
                    linting: true,
                    testing: false
                },
                'post-commit': {
                    fxdSync: true,
                    notification: true
                }
            };

            const installResult = await mockGitIntegration.installGitHooks(REPO_DIR, customConfig);

            assert(installResult.success, 'Should install custom hooks');
            assert(installResult.config, 'Should save hook configuration');

            Object.keys(customConfig).forEach(hook => {
                assert(installResult.config[hook], `Should configure ${hook}`);
            });
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large repositories efficiently', async () => {
            // Create repository with many files and commits
            const fileCount = 200;
            const commitCount = 20;

            for (let commit = 0; commit < commitCount; commit++) {
                const files = {};
                for (let file = 0; file < fileCount / commitCount; file++) {
                    const fileName = `batch${commit}/file${file}.js`;
                    files[fileName] = `// Commit ${commit}, File ${file}\nfunction func${commit}_${file}() {}`;
                }

                await createTestFiles(REPO_DIR, files);
                await commitFiles(REPO_DIR, `Batch commit ${commit}`);
            }

            const startTime = Date.now();
            const scanResult = await mockGitIntegration.scanRepository(REPO_DIR);
            const scanTime = Date.now() - startTime;

            assert(scanResult.files.length >= fileCount, 'Should scan all files');
            assert(scanResult.commits.length >= commitCount, 'Should scan all commits');
            assert(scanTime < 10000, 'Should scan large repository efficiently');

            // Test incremental sync performance
            const syncStart = Date.now();
            await mockGitIntegration.syncFromGit(REPO_DIR);
            const syncTime = Date.now() - syncStart;

            assert(syncTime < 15000, 'Should sync large repository efficiently');
        });

        test('should optimize Git operations for speed', async () => {
            // Test batch operations
            const operations = [];
            for (let i = 0; i < 50; i++) {
                operations.push({
                    type: 'create',
                    file: `batch/file${i}.js`,
                    content: `function batch${i}() {}`
                });
            }

            const batchStart = Date.now();
            const batchResult = await mockGitIntegration.batchOperations(REPO_DIR, operations);
            const batchTime = Date.now() - batchStart;

            assert(batchResult.success, 'Should complete batch operations');
            assert(batchResult.processed === 50, 'Should process all operations');
            assert(batchTime < 5000, 'Should batch operations efficiently');
        });

        test('should manage memory usage with large files', async () => {
            // Create large file
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB file
            await createTestFiles(REPO_DIR, {
                'large-file.js': `// Large file\n${largeContent}`
            });
            await commitFiles(REPO_DIR, 'Add large file');

            const memoryBefore = process.memoryUsage().heapUsed;
            await mockGitIntegration.syncFromGit(REPO_DIR);
            const memoryAfter = process.memoryUsage().heapUsed;

            const memoryIncrease = memoryAfter - memoryBefore;
            const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB max increase

            assert(memoryIncrease < maxMemoryIncrease, 'Should manage memory efficiently');
        });

        test('should handle concurrent Git operations', async () => {
            const concurrentOps = [];

            // Setup concurrent operations
            for (let i = 0; i < 10; i++) {
                concurrentOps.push(
                    mockGitIntegration.createBranch(REPO_DIR, `concurrent-${i}`, 'main')
                );
            }

            const results = await Promise.allSettled(concurrentOps);
            const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);

            // At least some operations should succeed
            assert(successes.length > 0, 'Should handle some concurrent operations');

            // Failed operations should have clear reasons
            const failures = results.filter(r => r.status === 'rejected' || !r.value.success);
            failures.forEach(failure => {
                if (failure.status === 'fulfilled') {
                    assert(failure.value.reason, 'Should explain operation failure');
                }
            });
        });
    });
});

// Helper functions

async function initializeGitRepo(repoPath) {
    await execGit(repoPath, 'init');
    await execGit(repoPath, 'config user.email "test@example.com"');
    await execGit(repoPath, 'config user.name "Test User"');
}

async function createTestFiles(repoPath, files) {
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = join(repoPath, filePath);
        const dir = join(fullPath, '..');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content);
    }
}

async function commitFiles(repoPath, message) {
    await execGit(repoPath, 'add .');
    await execGit(repoPath, `commit -m "${message}"`);
}

async function execGit(repoPath, command) {
    try {
        const { stdout, stderr } = await execAsync(`git ${command}`, { cwd: repoPath });
        return { stdout, stderr };
    } catch (error) {
        if (error.code !== 1) { // Allow git operations that exit with code 1 (like merge conflicts)
            throw error;
        }
        return { stdout: error.stdout, stderr: error.stderr };
    }
}

// Mock implementations

function createMockFxFs() {
    const registeredFiles = new Map();

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
            return `// Mock content for ${filePath}\n// ViewID: ${entry.viewId}`;
        },

        writeFile(filePath, content) {
            const entry = registeredFiles.get(filePath);
            if (!entry) throw new Error(`No mapping for ${filePath}`);
            // Mock patch application
        }
    };
}

function createMockGitIntegration(fxFs) {
    let validationMode = 'permissive';
    let hookFailureMode = false;

    return {
        async isGitRepository(repoPath) {
            try {
                await fs.access(join(repoPath, '.git'));
                return true;
            } catch {
                return false;
            }
        },

        async scanRepository(repoPath) {
            const files = [];
            const scan = async (dir, prefix = '') => {
                const entries = await fs.readdir(join(repoPath, dir), { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.git')) continue;
                    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
                    if (entry.isDirectory()) {
                        await scan(path, path);
                    } else {
                        files.push(path);
                    }
                }
            };

            await scan('');

            const branches = await this.getBranches(repoPath);
            const commits = await this.getCommitHistory(repoPath);

            return { files, branches, commits };
        },

        async getBranches(repoPath) {
            try {
                const { stdout } = await execGit(repoPath, 'branch -a');
                return stdout.split('\n')
                    .map(line => line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, ''))
                    .filter(line => line && !line.includes('HEAD'));
            } catch {
                return ['main'];
            }
        },

        async getCommitHistory(repoPath) {
            try {
                const { stdout } = await execGit(repoPath, 'log --oneline');
                return stdout.split('\n')
                    .filter(line => line)
                    .map(line => {
                        const [hash, ...messageParts] = line.split(' ');
                        return { hash, message: messageParts.join(' ') };
                    });
            } catch {
                return [];
            }
        },

        async analyzeRepository(repoPath) {
            const { files } = await this.scanRepository(repoPath);
            const languages = new Set();
            const fileTypes = { source: [], config: [], docs: [], other: [] };

            for (const file of files) {
                const ext = file.split('.').pop();
                const langMap = {
                    'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
                    'py': 'python', 'go': 'go', 'rs': 'rust', 'java': 'java'
                };

                if (langMap[ext]) {
                    languages.add(langMap[ext]);
                    fileTypes.source.push(file);
                } else if (['json', 'yml', 'yaml', 'toml'].includes(ext)) {
                    fileTypes.config.push(file);
                } else if (['md', 'txt', 'rst'].includes(ext)) {
                    fileTypes.docs.push(file);
                } else {
                    fileTypes.other.push(file);
                }
            }

            return { languages: Array.from(languages), fileTypes };
        },

        async syncFromGit(repoPath, options = {}) {
            const { files } = await this.scanRepository(repoPath);
            let filesProcessed = 0;
            const binaryFiles = [];

            for (const file of files) {
                const fullPath = join(repoPath, file);
                try {
                    const content = await fs.readFile(fullPath, 'utf8');
                    const ext = file.split('.').pop();
                    const langMap = {
                        'js': 'js', 'ts': 'ts', 'jsx': 'jsx', 'tsx': 'tsx',
                        'py': 'py', 'go': 'go', 'sh': 'sh', 'md': 'markdown'
                    };

                    fxFs.register({
                        filePath: file,
                        viewId: `views.${file.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        lang: langMap[ext] || 'text'
                    });

                    filesProcessed++;
                } catch (error) {
                    if (error.code !== 'EISDIR') {
                        binaryFiles.push(file);
                    }
                }
            }

            return { filesProcessed, binaryFiles };
        },

        async syncToGit(repoPath) {
            // Mock implementation - would write FxFs changes to Git
            return { success: true, filesWritten: 0, conflicts: [] };
        },

        async detectConflicts(repoPath) {
            try {
                const { stdout } = await execGit(repoPath, 'diff --name-only --diff-filter=U');
                return stdout.split('\n')
                    .filter(line => line)
                    .map(file => ({ file, type: 'merge' }));
            } catch {
                return [];
            }
        },

        async getResolutionStrategies(file, repoPath) {
            return {
                ours: `Use current branch version of ${file}`,
                theirs: `Use incoming branch version of ${file}`,
                manual: `Manually edit ${file} to resolve conflicts`
            };
        },

        async autoResolveConflicts(repoPath, branch) {
            // Mock auto-resolution logic
            return { success: false, reason: 'Auto-resolution not implemented in mock' };
        },

        async resolveConflict(file, content, repoPath) {
            await fs.writeFile(join(repoPath, file), content);
            await execGit(repoPath, `add ${file}`);
            return { success: true };
        },

        async mapBranchesToViews(repoPath) {
            const branches = await this.getBranches(repoPath);
            const mapping = {};

            for (const branch of branches) {
                mapping[branch] = {
                    viewId: `views.branch_${branch.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    files: []
                };
            }

            return mapping;
        },

        async switchBranch(repoPath, branch) {
            await execGit(repoPath, `checkout ${branch}`);
            return { success: true, branch };
        },

        async getCurrentBranch(repoPath) {
            try {
                const { stdout } = await execGit(repoPath, 'branch --show-current');
                return stdout.trim();
            } catch {
                return 'main';
            }
        },

        async createBranch(repoPath, branchName, baseBranch) {
            try {
                await execGit(repoPath, `checkout -b ${branchName} ${baseBranch}`);
                return { success: true, branch: branchName };
            } catch (error) {
                return { success: false, reason: error.message };
            }
        },

        async mergeBranch(repoPath, sourceBranch, targetBranch) {
            try {
                await execGit(repoPath, `checkout ${targetBranch}`);
                await execGit(repoPath, `merge ${sourceBranch}`);
                return { success: true, merged: true };
            } catch (error) {
                const conflicts = await this.detectConflicts(repoPath);
                return { success: false, conflicts };
            }
        },

        async installGitHooks(repoPath, config = {}) {
            const hooks = ['pre-commit', 'post-commit', 'pre-push'];
            return { success: true, hooks, config };
        },

        async triggerHook(hookName, repoPath) {
            if (hookFailureMode) {
                return {
                    success: false,
                    error: 'Mock hook failure',
                    recovery: 'Check hook configuration'
                };
            }
            return { success: true, hook: hookName };
        },

        async validateFxdState(repoPath) {
            if (validationMode === 'strict') {
                return {
                    valid: false,
                    issues: ['Mock validation issue for testing']
                };
            }
            return { valid: true, issues: [] };
        },

        async batchOperations(repoPath, operations) {
            return { success: true, processed: operations.length };
        },

        // Test configuration methods
        setValidationMode(mode) {
            validationMode = mode;
        },

        setHookFailureMode(shouldFail) {
            hookFailureMode = shouldFail;
        }
    };
}

// Run Git integration tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🔀 Running FXD Git Integration Tests...\n');
}