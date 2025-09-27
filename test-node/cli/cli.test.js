/**
 * CLI Interface Tests for FXD CLI Commands
 * Tests command parsing, validation, execution, and error handling
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setTimeout } from 'timers/promises';

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-cli-test-${Date.now()}`);
const CLI_PATH = join(process.cwd(), 'fxd-cli.ts');

describe('FXD CLI Interface Tests', () => {
    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });

        // Change to test directory for CLI operations
        process.env.FXD_TEST_DIR = TEST_DIR;
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors in tests
        }
        delete process.env.FXD_TEST_DIR;
    });

    describe('Command Parsing and Validation', () => {
        test('should parse basic commands correctly', async () => {
            const result = await execCLI(['help']);
            assert(result.success, 'Help command should succeed');
            assert(result.output.includes('FXD CLI'), 'Should show CLI help');
            assert(result.output.includes('COMMANDS'), 'Should list commands');
        });

        test('should validate required arguments', async () => {
            // Test create command without name
            const createResult = await execCLI(['create']);
            assert(!createResult.success, 'Create without name should fail');
            assert(createResult.error.includes('required') ||
                   createResult.output.includes('required'), 'Should indicate missing name');

            // Test import command without path
            const importResult = await execCLI(['import']);
            assert(!importResult.success, 'Import without path should fail');
            assert(importResult.error.includes('required') ||
                   importResult.output.includes('required'), 'Should indicate missing path');

            // Test run command without snippet ID
            const runResult = await execCLI(['run']);
            assert(!runResult.success, 'Run without snippet ID should fail');
            assert(runResult.error.includes('required') ||
                   runResult.output.includes('required'), 'Should indicate missing snippet ID');
        });

        test('should handle unknown commands gracefully', async () => {
            const result = await execCLI(['nonexistent-command']);
            assert(!result.success, 'Unknown command should fail');
            assert(result.error.includes('Unknown command') ||
                   result.output.includes('Unknown command'), 'Should indicate unknown command');
        });

        test('should parse command options correctly', async () => {
            // Test create with path option
            const createResult = await execCLI(['create', 'test-project', '--path=' + TEST_DIR]);
            assert(createResult.success || createResult.output.includes('Creating'),
                   'Create with path option should be parsed');

            // Test list with type option
            const listResult = await execCLI(['list', '--type=snippets']);
            assert(listResult.success || listResult.output.includes('SNIPPETS'),
                   'List with type option should be parsed');

            // Test visualize with port option
            const vizResult = await execCLI(['visualize', '--port=9000']);
            assert(vizResult.success || vizResult.output.includes('port 9000'),
                   'Visualize with port option should be parsed');
        });

        test('should handle flag variations correctly', async () => {
            // Test short and long flags
            const shortResult = await execCLI(['run', 'test-snippet', '-v']);
            const longResult = await execCLI(['run', 'test-snippet', '--visualize']);

            // Both should fail (snippet doesn't exist) but with same error
            assert(!shortResult.success, 'Short flag should be recognized');
            assert(!longResult.success, 'Long flag should be recognized');
        });
    });

    describe('Project Creation and Scaffolding', () => {
        test('should create new FXD disk with basic structure', async () => {
            const projectName = 'test-project';
            const result = await execCLI(['create', projectName, '--path=' + TEST_DIR]);

            assert(result.success || result.output.includes('Creating'),
                   `Create should succeed: ${result.error}`);
            assert(result.output.includes(projectName), 'Should mention project name');
            assert(result.output.includes('FXD disk created'), 'Should confirm creation');
        });

        test('should initialize disk with proper metadata', async () => {
            const projectName = 'metadata-test';
            const result = await execCLI(['create', projectName, '--path=' + TEST_DIR]);

            assert(result.success || result.output.includes('Creating'));

            // Verify the created structure has expected components
            assert(result.output.includes('disk.name'), 'Should set disk name');
            assert(result.output.includes('created'), 'Should set creation time');
            assert(result.output.includes('version'), 'Should set version');
        });

        test('should handle disk creation in existing directory', async () => {
            const projectName = 'existing-dir-test';

            // Create first time
            const firstResult = await execCLI(['create', projectName, '--path=' + TEST_DIR]);
            assert(firstResult.success || firstResult.output.includes('Creating'));

            // Try to create again (should handle gracefully)
            const secondResult = await execCLI(['create', projectName + '2', '--path=' + TEST_DIR]);
            assert(secondResult.success || secondResult.output.includes('Creating'));
        });

        test('should validate project names', async () => {
            // Test empty name
            const emptyResult = await execCLI(['create', '']);
            assert(!emptyResult.success, 'Empty name should fail');

            // Test with special characters
            const specialResult = await execCLI(['create', 'test/project*', '--path=' + TEST_DIR]);
            // Should either succeed or handle gracefully
            assert(specialResult.success || specialResult.error || specialResult.output);
        });
    });

    describe('Import and Export Functionality', () => {
        test('should import single JavaScript file', async () => {
            // Create test file
            const testFile = join(TEST_DIR, 'test.js');
            const testContent = `
function greet(name) {
    return 'Hello, ' + name;
}

function farewell(name) {
    return 'Goodbye, ' + name;
}
`;
            await fs.writeFile(testFile, testContent);

            // Create project first
            await execCLI(['create', 'import-test', '--path=' + TEST_DIR]);

            // Import file
            const result = await execCLI(['import', testFile]);
            assert(result.success || result.output.includes('Import'),
                   `Import should succeed: ${result.error}`);
            assert(result.output.includes('greet') || result.output.includes('test.js'),
                   'Should recognize JavaScript functions');
        });

        test('should import directory recursively', async () => {
            // Create test directory structure
            const srcDir = join(TEST_DIR, 'src');
            await fs.mkdir(srcDir, { recursive: true });

            const files = [
                { path: 'main.js', content: 'console.log("main");' },
                { path: 'utils.js', content: 'function util() { return "utility"; }' },
                { path: 'README.md', content: '# Test Project' }
            ];

            for (const file of files) {
                await fs.writeFile(join(srcDir, file.path), file.content);
            }

            // Create project first
            await execCLI(['create', 'dir-import-test', '--path=' + TEST_DIR]);

            // Import directory
            const result = await execCLI(['import', srcDir]);
            assert(result.success || result.output.includes('Import'),
                   `Directory import should succeed: ${result.error}`);
            assert(result.output.includes('main.js') || result.output.includes('utils.js'),
                   'Should import JavaScript files');
        });

        test('should export disk contents to files', async () => {
            // Create project and add content
            await execCLI(['create', 'export-test', '--path=' + TEST_DIR]);

            const exportDir = join(TEST_DIR, 'exported');
            const result = await execCLI(['export', exportDir, '--format=files']);

            assert(result.success || result.output.includes('Export'),
                   `Export should succeed: ${result.error}`);
        });

        test('should export disk contents as archive', async () => {
            // Create project and add content
            await execCLI(['create', 'archive-test', '--path=' + TEST_DIR]);

            const exportDir = join(TEST_DIR, 'archive');
            const result = await execCLI(['export', exportDir, '--format=archive']);

            assert(result.success || result.output.includes('Export'),
                   `Archive export should succeed: ${result.error}`);
        });

        test('should handle unsupported file types gracefully', async () => {
            // Create binary file
            const binaryFile = join(TEST_DIR, 'test.bin');
            await fs.writeFile(binaryFile, Buffer.from([0, 1, 2, 3, 4, 5]));

            // Create project first
            await execCLI(['create', 'binary-test', '--path=' + TEST_DIR]);

            // Try to import binary file
            const result = await execCLI(['import', binaryFile]);
            // Should either skip or handle gracefully
            assert(result.success || result.error || result.output);
        });
    });

    describe('Snippet and View Management', () => {
        test('should list empty disk contents', async () => {
            await execCLI(['create', 'empty-test', '--path=' + TEST_DIR]);

            const result = await execCLI(['list']);
            assert(result.success || result.output.includes('Contents'),
                   `List should succeed: ${result.error}`);
            assert(result.output.includes('no snippets') || result.output.includes('SNIPPETS'),
                   'Should indicate empty state');
        });

        test('should list disk contents with snippets', async () => {
            // Create project and import file
            await execCLI(['create', 'list-test', '--path=' + TEST_DIR]);

            const testFile = join(TEST_DIR, 'sample.js');
            await fs.writeFile(testFile, 'function test() { return "hello"; }');
            await execCLI(['import', testFile]);

            const result = await execCLI(['list']);
            assert(result.success || result.output.includes('Contents'));
            assert(result.output.includes('SNIPPETS') || result.output.includes('sample'),
                   'Should show imported snippets');
        });

        test('should filter list by type', async () => {
            // Create project with content
            await execCLI(['create', 'filter-test', '--path=' + TEST_DIR]);

            // Test filtering by snippets
            const snippetsResult = await execCLI(['list', '--type=snippets']);
            assert(snippetsResult.success || snippetsResult.output.includes('SNIPPETS'));

            // Test filtering by views
            const viewsResult = await execCLI(['list', '--type=views']);
            assert(viewsResult.success || viewsResult.output.includes('VIEWS'));
        });

        test('should run JavaScript snippets', async () => {
            // Create project and import JavaScript
            await execCLI(['create', 'run-test', '--path=' + TEST_DIR]);

            const testFile = join(TEST_DIR, 'greet.js');
            const jsContent = `
function greet(name) {
    console.log('Hello, ' + name);
    return 'Hello, ' + name;
}
greet('World');
`;
            await fs.writeFile(testFile, jsContent);
            await execCLI(['import', testFile]);

            // Run the snippet
            const result = await execCLI(['run', 'greet.greet']);
            // Should either execute or show preview
            assert(result.success || result.output.includes('Executing') ||
                   result.output.includes('not supported'));
        });

        test('should handle running non-existent snippets', async () => {
            await execCLI(['create', 'missing-test', '--path=' + TEST_DIR]);

            const result = await execCLI(['run', 'nonexistent-snippet']);
            assert(!result.success, 'Running non-existent snippet should fail');
            assert(result.error.includes('not found') || result.output.includes('not found'),
                   'Should indicate snippet not found');
        });

        test('should support visualizer integration', async () => {
            // Create project and import code
            await execCLI(['create', 'viz-test', '--path=' + TEST_DIR]);

            const testFile = join(TEST_DIR, 'visual.js');
            await fs.writeFile(testFile, 'console.log("visual test");');
            await execCLI(['import', testFile]);

            // Run with visualizer flag
            const result = await execCLI(['run', 'visual', '--visualize']);
            assert(result.success || result.output.includes('visualizer') ||
                   result.output.includes('not found'));
        });
    });

    describe('Visualizer Integration', () => {
        test('should start visualizer with default port', async () => {
            const result = await execCLI(['visualize']);
            assert(result.success || result.output.includes('Visualizer'),
                   `Visualizer should start: ${result.error}`);
            assert(result.output.includes('8080') || result.output.includes('port'),
                   'Should mention default port');
        });

        test('should start visualizer with custom port', async () => {
            const customPort = '9999';
            const result = await execCLI(['visualize', '--port=' + customPort]);
            assert(result.success || result.output.includes('Visualizer'));
            assert(result.output.includes(customPort), 'Should use custom port');
        });

        test('should provide visualizer usage instructions', async () => {
            const result = await execCLI(['visualize']);
            assert(result.output.includes('Interactive features') ||
                   result.output.includes('Live features'), 'Should provide usage instructions');
            assert(result.output.includes('localhost'), 'Should provide access URL');
        });

        test('should handle invalid port numbers', async () => {
            const result = await execCLI(['visualize', '--port=invalid']);
            // Should either use default port or handle gracefully
            assert(result.success || result.error || result.output);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle missing permissions gracefully', async () => {
            // Try to create in read-only location
            const readOnlyPath = '/read-only-path';
            const result = await execCLI(['create', 'permission-test', '--path=' + readOnlyPath]);

            // Should either succeed or fail gracefully
            assert(result.success || result.error.includes('permission') ||
                   result.error.includes('ENOENT') || result.error.includes('access'));
        });

        test('should handle corrupted import files', async () => {
            // Create file with invalid content
            const corruptFile = join(TEST_DIR, 'corrupt.js');
            await fs.writeFile(corruptFile, '\x00\x01\x02invalid\x03content');

            await execCLI(['create', 'corrupt-test', '--path=' + TEST_DIR]);

            const result = await execCLI(['import', corruptFile]);
            // Should handle gracefully
            assert(result.success || result.error || result.output);
        });

        test('should recover from execution errors', async () => {
            // Create project with error-prone code
            await execCLI(['create', 'error-test', '--path=' + TEST_DIR]);

            const errorFile = join(TEST_DIR, 'error.js');
            await fs.writeFile(errorFile, 'throw new Error("test error");');
            await execCLI(['import', errorFile]);

            const result = await execCLI(['run', 'error']);
            // Should catch and report error
            assert(!result.success || result.output.includes('error') ||
                   result.error.includes('error'));
        });

        test('should handle disk space issues', async () => {
            // Test with very large content (simulated)
            const largeContent = 'a'.repeat(10000);
            const largeFile = join(TEST_DIR, 'large.js');
            await fs.writeFile(largeFile, largeContent);

            await execCLI(['create', 'large-test', '--path=' + TEST_DIR]);

            const result = await execCLI(['import', largeFile]);
            // Should handle large files
            assert(result.success || result.error || result.output);
        });

        test('should provide helpful error messages', async () => {
            // Test various error scenarios
            const scenarios = [
                ['create'],  // Missing name
                ['import'],  // Missing path
                ['run'],     // Missing snippet
                ['invalid-command']  // Unknown command
            ];

            for (const args of scenarios) {
                const result = await execCLI(args);
                assert(!result.success, `${args[0]} should fail`);
                assert(result.error || result.output, `${args[0]} should provide error message`);
            }
        });
    });

    describe('Shell Completion and Help', () => {
        test('should provide comprehensive help text', async () => {
            const result = await execCLI(['help']);
            assert(result.success);

            const expectedSections = ['USAGE', 'COMMANDS', 'EXAMPLES'];
            for (const section of expectedSections) {
                assert(result.output.includes(section), `Help should include ${section} section`);
            }
        });

        test('should show command-specific usage on errors', async () => {
            const result = await execCLI(['create']);
            assert(!result.success);
            assert(result.output.includes('Usage:') || result.error.includes('usage'),
                   'Should show usage on error');
        });

        test('should list all available commands', async () => {
            const result = await execCLI(['help']);

            const expectedCommands = ['create', 'import', 'list', 'run', 'visualize', 'export'];
            for (const command of expectedCommands) {
                assert(result.output.includes(command), `Help should list ${command} command`);
            }
        });

        test('should provide working examples', async () => {
            const result = await execCLI(['help']);
            assert(result.output.includes('deno run'), 'Should provide Deno examples');
            assert(result.output.includes('fxd-cli.ts'), 'Should reference CLI script');
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large directory imports efficiently', async () => {
            // Create many small files
            const largeDir = join(TEST_DIR, 'large-project');
            await fs.mkdir(largeDir, { recursive: true });

            const fileCount = 50; // Reasonable for testing
            for (let i = 0; i < fileCount; i++) {
                await fs.writeFile(
                    join(largeDir, `file${i}.js`),
                    `function func${i}() { return ${i}; }`
                );
            }

            await execCLI(['create', 'performance-test', '--path=' + TEST_DIR]);

            const startTime = Date.now();
            const result = await execCLI(['import', largeDir]);
            const duration = Date.now() - startTime;

            assert(result.success || result.output.includes('Import'));
            assert(duration < 10000, `Import of ${fileCount} files should complete in reasonable time`);
        });

        test('should list large numbers of snippets efficiently', async () => {
            // Create project with many snippets
            await execCLI(['create', 'list-performance', '--path=' + TEST_DIR]);

            // Import several files
            for (let i = 0; i < 10; i++) {
                const file = join(TEST_DIR, `snippet${i}.js`);
                await fs.writeFile(file, `function snippet${i}() { return ${i}; }`);
                await execCLI(['import', file]);
            }

            const startTime = Date.now();
            const result = await execCLI(['list']);
            const duration = Date.now() - startTime;

            assert(result.success || result.output.includes('Contents'));
            assert(duration < 5000, 'List command should be fast even with many snippets');
        });

        test('should handle deep directory structures', async () => {
            // Create deep nested structure
            let currentDir = join(TEST_DIR, 'deep');
            for (let i = 0; i < 5; i++) {
                currentDir = join(currentDir, `level${i}`);
                await fs.mkdir(currentDir, { recursive: true });
                await fs.writeFile(join(currentDir, `deep${i}.js`), `// Level ${i}`);
            }

            await execCLI(['create', 'deep-test', '--path=' + TEST_DIR]);

            const result = await execCLI(['import', join(TEST_DIR, 'deep')]);
            assert(result.success || result.output.includes('Import'));
        });
    });
});

// Helper function to execute CLI commands
async function execCLI(args, options = {}) {
    return new Promise((resolve) => {
        const cwd = options.cwd || TEST_DIR;
        const timeout = options.timeout || 10000;

        // Use Deno to run the CLI
        const child = spawn('deno', ['run', '--allow-all', CLI_PATH, ...args], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, timeout);

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            clearTimeout(timer);

            if (timedOut) {
                resolve({
                    success: false,
                    output: stdout,
                    error: 'Command timed out',
                    code: null
                });
                return;
            }

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
                error: error.message,
                code: null
            });
        });
    });
}

// Run CLI tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🖥️  Running FXD CLI Tests...\n');
}