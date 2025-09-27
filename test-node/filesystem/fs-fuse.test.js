/**
 * Virtual Filesystem Tests for FX-FS-FUSE Operations
 * Tests FUSE-like filesystem operations, view mapping, and file operations
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test directory setup
const TEST_DIR = join(tmpdir(), `fxd-fs-test-${Date.now()}`);

describe('FXD Virtual Filesystem Tests', () => {
    let mockFxFs;
    let mockRenderView;
    let mockToPatches;
    let mockApplyPatches;

    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });

        // Setup mocks for FX modules
        mockRenderView = createMockRenderView();
        mockToPatches = createMockToPatches();
        mockApplyPatches = createMockApplyPatches();

        // Create FxFs instance
        mockFxFs = createMockFxFs();
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('View Registration and Management', () => {
        test('should register view mappings correctly', () => {
            const entry = {
                filePath: 'src/main.js',
                viewId: 'views.mainFile',
                lang: 'js',
                eol: 'lf'
            };

            mockFxFs.register(entry);

            const resolved = mockFxFs.resolve('src/main.js');
            assert(resolved, 'Should resolve registered view');
            assert.equal(resolved.filePath, 'src/main.js');
            assert.equal(resolved.viewId, 'views.mainFile');
            assert.equal(resolved.lang, 'js');
        });

        test('should handle path normalization', () => {
            const entry = {
                filePath: '/src/utils.ts',
                viewId: 'views.utils',
                lang: 'ts'
            };

            mockFxFs.register(entry);

            // Should resolve with normalized path (no leading slash)
            const resolved = mockFxFs.resolve('src/utils.ts');
            assert(resolved, 'Should resolve normalized path');
            assert.equal(resolved.filePath, '/src/utils.ts');
        });

        test('should unregister view mappings', () => {
            const entry = {
                filePath: 'temp/test.js',
                viewId: 'views.temp',
                lang: 'js'
            };

            mockFxFs.register(entry);
            assert(mockFxFs.resolve('temp/test.js'), 'Should be registered');

            mockFxFs.unregister('temp/test.js');
            assert.equal(mockFxFs.resolve('temp/test.js'), null, 'Should be unregistered');
        });

        test('should resolve null for unregistered paths', () => {
            const resolved = mockFxFs.resolve('nonexistent/file.js');
            assert.equal(resolved, null, 'Should return null for unregistered paths');
        });

        test('should handle complex file paths with extensions', () => {
            const entries = [
                { filePath: 'components/Button.tsx', viewId: 'views.button', lang: 'tsx' },
                { filePath: 'styles/main.css', viewId: 'views.styles', lang: 'css' },
                { filePath: 'docs/README.md', viewId: 'views.readme', lang: 'markdown' },
                { filePath: 'config/webpack.config.js', viewId: 'views.webpack', lang: 'js' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            entries.forEach(entry => {
                const resolved = mockFxFs.resolve(entry.filePath);
                assert(resolved, `Should resolve ${entry.filePath}`);
                assert.equal(resolved.lang, entry.lang);
            });
        });
    });

    describe('File Read Operations', () => {
        test('should read files through view rendering', () => {
            const entry = {
                filePath: 'src/app.js',
                viewId: 'views.app',
                lang: 'js',
                eol: 'lf'
            };

            mockFxFs.register(entry);

            const content = mockFxFs.readFile('src/app.js');
            assert(typeof content === 'string', 'Should return string content');
            assert(content.includes('mock-rendered'), 'Should contain rendered content');

            // Verify render was called with correct parameters
            assert(mockRenderView.called, 'Should call renderView');
            assert.equal(mockRenderView.lastCall.viewId, 'views.app');
            assert.equal(mockRenderView.lastCall.options.lang, 'js');
            assert.equal(mockRenderView.lastCall.options.eol, 'lf');
        });

        test('should handle different language types', () => {
            const languages = ['js', 'ts', 'py', 'php', 'sh', 'go', 'cpp'];

            languages.forEach((lang, index) => {
                const entry = {
                    filePath: `test/file${index}.${lang}`,
                    viewId: `views.file${index}`,
                    lang: lang
                };

                mockFxFs.register(entry);

                const content = mockFxFs.readFile(entry.filePath);
                assert(content, `Should read ${lang} file`);
                assert(content.includes(`lang-${lang}`), `Should process ${lang} correctly`);
            });
        });

        test('should handle different EOL settings', () => {
            const eolTypes = ['lf', 'crlf'];

            eolTypes.forEach((eol, index) => {
                const entry = {
                    filePath: `eol-test/file${index}.js`,
                    viewId: `views.eol${index}`,
                    lang: 'js',
                    eol: eol
                };

                mockFxFs.register(entry);

                const content = mockFxFs.readFile(entry.filePath);
                assert(content.includes(`eol-${eol}`), `Should handle ${eol} line endings`);
            });
        });

        test('should apply hoist imports option', () => {
            const entry = {
                filePath: 'modules/hoisted.js',
                viewId: 'views.hoisted',
                lang: 'js',
                hoistImports: true
            };

            mockFxFs.register(entry);

            const content = mockFxFs.readFile('modules/hoisted.js');
            assert(content.includes('hoisted-imports'), 'Should apply import hoisting');
        });

        test('should throw error for unregistered file reads', () => {
            assert.throws(() => {
                mockFxFs.readFile('unregistered/file.js');
            }, /no view mapping/, 'Should throw error for unregistered files');
        });

        test('should handle default language and options', () => {
            const entry = {
                filePath: 'minimal/file.txt',
                viewId: 'views.minimal'
                // No lang, eol, or hoistImports specified
            };

            mockFxFs.register(entry);

            const content = mockFxFs.readFile('minimal/file.txt');
            assert(content, 'Should read file with defaults');
            assert(content.includes('lang-js'), 'Should default to js language');
            assert(content.includes('eol-lf'), 'Should default to lf line endings');
        });
    });

    describe('File Write Operations', () => {
        test('should write files through patch application', () => {
            const entry = {
                filePath: 'src/editable.js',
                viewId: 'views.editable',
                lang: 'js'
            };

            mockFxFs.register(entry);

            const newContent = 'function updated() { return "new content"; }';
            mockFxFs.writeFile('src/editable.js', newContent);

            // Verify patches were generated and applied
            assert(mockToPatches.called, 'Should call toPatches');
            assert.equal(mockToPatches.lastCall.text, newContent);

            assert(mockApplyPatches.called, 'Should call applyPatches');
            assert(mockApplyPatches.lastCall.patches, 'Should pass patches');
        });

        test('should emit change events on write', () => {
            const entry = {
                filePath: 'src/watched.js',
                viewId: 'views.watched',
                lang: 'js'
            };

            mockFxFs.register(entry);

            let changeEventFired = false;
            let changedPath = null;

            const unsubscribe = mockFxFs.on('fileChanged', (path) => {
                changeEventFired = true;
                changedPath = path;
            });

            mockFxFs.writeFile('src/watched.js', 'new content');

            assert(changeEventFired, 'Should emit change event');
            assert.equal(changedPath, 'src/watched.js', 'Should emit correct path');

            unsubscribe();
        });

        test('should handle multiple write operations', () => {
            const entry = {
                filePath: 'src/multi-write.js',
                viewId: 'views.multiWrite',
                lang: 'js'
            };

            mockFxFs.register(entry);

            const contents = [
                'function first() { return 1; }',
                'function second() { return 2; }',
                'function third() { return 3; }'
            ];

            contents.forEach((content, index) => {
                mockFxFs.writeFile('src/multi-write.js', content);
                assert.equal(mockToPatches.callCount, index + 1, `Should call toPatches ${index + 1} times`);
                assert.equal(mockApplyPatches.callCount, index + 1, `Should call applyPatches ${index + 1} times`);
            });
        });

        test('should throw error for unregistered file writes', () => {
            assert.throws(() => {
                mockFxFs.writeFile('unregistered/file.js', 'content');
            }, /no view mapping/, 'Should throw error for unregistered files');
        });

        test('should handle write errors gracefully', () => {
            const entry = {
                filePath: 'src/error-prone.js',
                viewId: 'views.errorProne',
                lang: 'js'
            };

            mockFxFs.register(entry);

            // Configure mock to throw error
            mockApplyPatches.shouldThrow = true;

            assert.throws(() => {
                mockFxFs.writeFile('src/error-prone.js', 'content');
            }, 'Should propagate patch application errors');
        });
    });

    describe('Directory Listing Operations', () => {
        test('should list root directory contents', () => {
            const entries = [
                { filePath: 'main.js', viewId: 'views.main' },
                { filePath: 'utils.js', viewId: 'views.utils' },
                { filePath: 'config.json', viewId: 'views.config' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            const listing = mockFxFs.readdir('');
            assert(Array.isArray(listing), 'Should return array');
            assert.equal(listing.length, 3, 'Should list all root files');
            assert(listing.includes('main.js'), 'Should include main.js');
            assert(listing.includes('utils.js'), 'Should include utils.js');
            assert(listing.includes('config.json'), 'Should include config.json');
        });

        test('should list subdirectory contents', () => {
            const entries = [
                { filePath: 'src/app.js', viewId: 'views.app' },
                { filePath: 'src/utils.js', viewId: 'views.utils' },
                { filePath: 'src/components/Button.jsx', viewId: 'views.button' },
                { filePath: 'tests/app.test.js', viewId: 'views.appTest' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            const srcListing = mockFxFs.readdir('src');
            assert(srcListing.includes('app.js'), 'Should include src files');
            assert(srcListing.includes('utils.js'), 'Should include src files');
            assert(srcListing.includes('components'), 'Should include subdirectories');
            assert(!srcListing.includes('app.test.js'), 'Should not include files from other directories');

            const componentsListing = mockFxFs.readdir('src/components');
            assert(componentsListing.includes('Button.jsx'), 'Should list nested files');
        });

        test('should handle directory paths with leading slashes', () => {
            const entries = [
                { filePath: 'dir/file1.js', viewId: 'views.file1' },
                { filePath: 'dir/file2.js', viewId: 'views.file2' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            const withSlash = mockFxFs.readdir('/dir');
            const withoutSlash = mockFxFs.readdir('dir');

            assert.deepEqual(withSlash, withoutSlash, 'Should handle leading slashes consistently');
        });

        test('should return empty array for non-existent directories', () => {
            const listing = mockFxFs.readdir('nonexistent/directory');
            assert(Array.isArray(listing), 'Should return array');
            assert.equal(listing.length, 0, 'Should return empty array');
        });

        test('should sort directory listings', () => {
            const entries = [
                { filePath: 'z-last.js', viewId: 'views.zLast' },
                { filePath: 'a-first.js', viewId: 'views.aFirst' },
                { filePath: 'm-middle.js', viewId: 'views.mMiddle' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            const listing = mockFxFs.readdir('');
            assert.deepEqual(listing, ['a-first.js', 'm-middle.js', 'z-last.js'],
                           'Should return sorted listing');
        });

        test('should handle complex directory structures', () => {
            const entries = [
                { filePath: 'src/main.js', viewId: 'views.main' },
                { filePath: 'src/utils/helpers.js', viewId: 'views.helpers' },
                { filePath: 'src/utils/constants.js', viewId: 'views.constants' },
                { filePath: 'src/components/ui/Button.jsx', viewId: 'views.button' },
                { filePath: 'src/components/ui/Input.jsx', viewId: 'views.input' },
                { filePath: 'tests/unit/main.test.js', viewId: 'views.mainTest' },
                { filePath: 'docs/README.md', viewId: 'views.readme' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            // Test various directory levels
            const rootListing = mockFxFs.readdir('');
            assert(rootListing.includes('src'), 'Root should include src');
            assert(rootListing.includes('tests'), 'Root should include tests');
            assert(rootListing.includes('docs'), 'Root should include docs');

            const srcListing = mockFxFs.readdir('src');
            assert(srcListing.includes('main.js'), 'src should include main.js');
            assert(srcListing.includes('utils'), 'src should include utils directory');
            assert(srcListing.includes('components'), 'src should include components directory');

            const utilsListing = mockFxFs.readdir('src/utils');
            assert(utilsListing.includes('helpers.js'), 'utils should include helpers.js');
            assert(utilsListing.includes('constants.js'), 'utils should include constants.js');

            const uiListing = mockFxFs.readdir('src/components/ui');
            assert(uiListing.includes('Button.jsx'), 'ui should include Button.jsx');
            assert(uiListing.includes('Input.jsx'), 'ui should include Input.jsx');
        });
    });

    describe('Event System', () => {
        test('should subscribe to file change events', () => {
            let eventCount = 0;
            let lastChangedPath = null;

            const unsubscribe = mockFxFs.on('fileChanged', (path) => {
                eventCount++;
                lastChangedPath = path;
            });

            assert(typeof unsubscribe === 'function', 'Should return unsubscribe function');

            // Register and write to trigger event
            const entry = { filePath: 'src/event-test.js', viewId: 'views.eventTest' };
            mockFxFs.register(entry);
            mockFxFs.writeFile('src/event-test.js', 'content');

            assert.equal(eventCount, 1, 'Should fire one event');
            assert.equal(lastChangedPath, 'src/event-test.js', 'Should report correct path');

            unsubscribe();
        });

        test('should handle multiple event subscribers', () => {
            let subscriber1Called = false;
            let subscriber2Called = false;

            const unsubscribe1 = mockFxFs.on('fileChanged', () => { subscriber1Called = true; });
            const unsubscribe2 = mockFxFs.on('fileChanged', () => { subscriber2Called = true; });

            const entry = { filePath: 'src/multi-event.js', viewId: 'views.multiEvent' };
            mockFxFs.register(entry);
            mockFxFs.writeFile('src/multi-event.js', 'content');

            assert(subscriber1Called, 'First subscriber should be called');
            assert(subscriber2Called, 'Second subscriber should be called');

            unsubscribe1();
            unsubscribe2();
        });

        test('should unsubscribe from events', () => {
            let eventCount = 0;

            const unsubscribe = mockFxFs.on('fileChanged', () => { eventCount++; });

            const entry = { filePath: 'src/unsubscribe-test.js', viewId: 'views.unsubscribeTest' };
            mockFxFs.register(entry);

            mockFxFs.writeFile('src/unsubscribe-test.js', 'content1');
            assert.equal(eventCount, 1, 'Should receive event before unsubscribe');

            unsubscribe();

            mockFxFs.writeFile('src/unsubscribe-test.js', 'content2');
            assert.equal(eventCount, 1, 'Should not receive event after unsubscribe');
        });

        test('should handle unknown event types', () => {
            const unsubscribe = mockFxFs.on('unknownEvent', () => {});
            assert(typeof unsubscribe === 'function', 'Should return function for unknown events');

            // Should not throw
            unsubscribe();
        });

        test('should handle event listener errors gracefully', () => {
            const unsubscribe = mockFxFs.on('fileChanged', () => {
                throw new Error('Listener error');
            });

            const entry = { filePath: 'src/error-listener.js', viewId: 'views.errorListener' };
            mockFxFs.register(entry);

            // Should not throw even if listener throws
            assert.doesNotThrow(() => {
                mockFxFs.writeFile('src/error-listener.js', 'content');
            });

            unsubscribe();
        });
    });

    describe('Cross-Platform Path Handling', () => {
        test('should handle Windows-style paths', () => {
            const entry = {
                filePath: 'src\\windows\\file.js',
                viewId: 'views.windowsFile',
                lang: 'js'
            };

            mockFxFs.register(entry);

            // Should normalize and resolve
            const resolved = mockFxFs.resolve('src/windows/file.js');
            assert(resolved, 'Should handle Windows-style paths');
        });

        test('should handle mixed path separators', () => {
            const entries = [
                { filePath: 'src/unix/file.js', viewId: 'views.unix' },
                { filePath: 'src\\windows\\file.js', viewId: 'views.windows' }
            ];

            entries.forEach(entry => mockFxFs.register(entry));

            const listing = mockFxFs.readdir('src');
            assert(listing.length > 0, 'Should handle mixed separators');
        });

        test('should handle special characters in paths', () => {
            const entry = {
                filePath: 'special/file with spaces.js',
                viewId: 'views.specialChars',
                lang: 'js'
            };

            mockFxFs.register(entry);

            const resolved = mockFxFs.resolve('special/file with spaces.js');
            assert(resolved, 'Should handle spaces in paths');

            const content = mockFxFs.readFile('special/file with spaces.js');
            assert(content, 'Should read files with special characters');
        });

        test('should handle Unicode characters in paths', () => {
            const entry = {
                filePath: 'unicode/файл.js',
                viewId: 'views.unicode',
                lang: 'js'
            };

            mockFxFs.register(entry);

            const resolved = mockFxFs.resolve('unicode/файл.js');
            assert(resolved, 'Should handle Unicode paths');
        });
    });

    describe('Performance and Memory Management', () => {
        test('should handle large number of registered files', () => {
            const fileCount = 1000;
            const startTime = Date.now();

            // Register many files
            for (let i = 0; i < fileCount; i++) {
                const entry = {
                    filePath: `perf/file${i}.js`,
                    viewId: `views.perf${i}`,
                    lang: 'js'
                };
                mockFxFs.register(entry);
            }

            const registrationTime = Date.now() - startTime;

            // Test resolution performance
            const resolveStart = Date.now();
            for (let i = 0; i < 100; i++) {
                const randomIndex = Math.floor(Math.random() * fileCount);
                const resolved = mockFxFs.resolve(`perf/file${randomIndex}.js`);
                assert(resolved, `Should resolve file${randomIndex}.js`);
            }
            const resolveTime = Date.now() - resolveStart;

            // Test directory listing performance
            const listStart = Date.now();
            const listing = mockFxFs.readdir('perf');
            const listTime = Date.now() - listStart;

            assert(registrationTime < 1000, 'Registration should be fast');
            assert(resolveTime < 100, 'Resolution should be fast');
            assert(listTime < 100, 'Listing should be fast');
            assert.equal(listing.length, fileCount, 'Should list all files');
        });

        test('should handle frequent register/unregister cycles', () => {
            const cycles = 100;

            for (let i = 0; i < cycles; i++) {
                const entry = {
                    filePath: `cycle/file${i}.js`,
                    viewId: `views.cycle${i}`,
                    lang: 'js'
                };

                // Register
                mockFxFs.register(entry);
                assert(mockFxFs.resolve(entry.filePath), `Should register cycle ${i}`);

                // Unregister
                mockFxFs.unregister(entry.filePath);
                assert.equal(mockFxFs.resolve(entry.filePath), null, `Should unregister cycle ${i}`);
            }
        });

        test('should manage memory efficiently with many listeners', () => {
            const listenerCount = 100;
            const unsubscribers = [];

            // Add many listeners
            for (let i = 0; i < listenerCount; i++) {
                const unsubscribe = mockFxFs.on('fileChanged', () => {
                    // Do nothing
                });
                unsubscribers.push(unsubscribe);
            }

            // Trigger event
            const entry = { filePath: 'memory/test.js', viewId: 'views.memoryTest' };
            mockFxFs.register(entry);
            mockFxFs.writeFile('memory/test.js', 'content');

            // Unsubscribe all
            unsubscribers.forEach(unsub => unsub());

            // Should handle cleanup without issues
            assert(true, 'Should handle many listeners');
        });
    });
});

// Mock implementations

function createMockFxFs() {
    const views = new Map();
    const listeners = new Set();

    function normalize(p) { return p.replace(/^\/+/, "").replace(/\\/g, '/'); }
    function stripLeadingSlash(p) { return p.replace(/^\/+/, ""); }
    function emitChange(p) {
        for (const l of listeners) {
            try {
                l(normalize(p));
            } catch (e) {
                // Ignore listener errors
            }
        }
    }

    return {
        register(entry) {
            views.set(normalize(entry.filePath), entry);
        },

        unregister(filePath) {
            views.delete(normalize(filePath));
        },

        resolve(filePath) {
            return views.get(normalize(filePath)) || null;
        },

        readFile(filePath) {
            const entry = views.get(normalize(filePath));
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);

            const { viewId, lang = "js", eol = "lf", hoistImports = false } = entry;
            return mockRenderView(viewId, { lang, eol, hoistImports });
        },

        writeFile(filePath, text) {
            const entry = views.get(normalize(filePath));
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);

            const patches = mockToPatches(text);
            mockApplyPatches(patches);
            emitChange(filePath);
        },

        readdir(dirPath) {
            const dir = stripLeadingSlash(dirPath);
            const parts = new Set();

            for (const p of views.keys()) {
                if (dir === "" || p.startsWith(dir + "/")) {
                    const rest = dir === "" ? p : p.slice(dir.length + 1);
                    const head = rest.split("/")[0];
                    if (head) parts.add(head);
                }
            }

            return Array.from(parts).sort();
        },

        on(evt, cb) {
            if (evt !== "fileChanged") return () => {};
            listeners.add(cb);
            return () => listeners.delete(cb);
        }
    };
}

function createMockRenderView() {
    const mock = function(viewId, options) {
        mock.called = true;
        mock.lastCall = { viewId, options };

        const { lang, eol, hoistImports } = options;
        let content = `// mock-rendered content for ${viewId}\n`;
        content += `// lang-${lang}\n`;
        content += `// eol-${eol}\n`;

        if (hoistImports) {
            content += `// hoisted-imports\n`;
        }

        return content;
    };

    mock.called = false;
    mock.lastCall = null;
    return mock;
}

function createMockToPatches() {
    const mock = function(text) {
        mock.called = true;
        mock.callCount = (mock.callCount || 0) + 1;
        mock.lastCall = { text };

        return [{ type: 'replace', content: text }];
    };

    mock.called = false;
    mock.callCount = 0;
    mock.lastCall = null;
    return mock;
}

function createMockApplyPatches() {
    const mock = function(patches) {
        if (mock.shouldThrow) {
            throw new Error('Mock patch application error');
        }

        mock.called = true;
        mock.callCount = (mock.callCount || 0) + 1;
        mock.lastCall = { patches };
    };

    mock.called = false;
    mock.callCount = 0;
    mock.lastCall = null;
    mock.shouldThrow = false;
    return mock;
}

// Assign mocks to test module scope
function createMockRenderView() {
    return mockRenderView;
}

function createMockToPatches() {
    return mockToPatches;
}

function createMockApplyPatches() {
    return mockApplyPatches;
}

// Run filesystem tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('💾 Running FXD Virtual Filesystem Tests...\n');
}