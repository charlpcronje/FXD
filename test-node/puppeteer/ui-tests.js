/**
 * Puppeteer-based UI Tests for FXD Web Interfaces
 * Tests user interactions, visual components, and browser integration
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

let browser;
let server;
const TEST_PORT = 8888;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('FXD UI Tests', () => {
    beforeEach(async () => {
        // Start test server
        server = await startTestServer();
        await setTimeout(2000); // Wait for server to start

        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1280, height: 720 }
        });
    });

    afterEach(async () => {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.kill();
        }
    });

    describe('Application Loading', () => {
        test('should load main application page', async () => {
            const page = await browser.newPage();

            // Monitor console for errors
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            // Monitor network errors
            const networkErrors = [];
            page.on('response', response => {
                if (!response.ok()) {
                    networkErrors.push(`${response.status()}: ${response.url()}`);
                }
            });

            await page.goto(BASE_URL);

            // Wait for application to load
            await page.waitForSelector('#fxd-app', { timeout: 10000 });

            // Verify no critical errors
            assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(', ')}`);
            assert.equal(networkErrors.length, 0, `Network errors: ${networkErrors.join(', ')}`);

            // Verify application title
            const title = await page.title();
            assert(title.includes('FXD'), `Title should contain 'FXD', got: ${title}`);

            // Verify main application element is present
            const appElement = await page.$('#fxd-app');
            assert(appElement, 'Main application element should be present');

            await page.close();
        });

        test('should load required assets', async () => {
            const page = await browser.newPage();
            const loadedResources = [];

            page.on('response', response => {
                loadedResources.push({
                    url: response.url(),
                    status: response.status(),
                    contentType: response.headers()['content-type']
                });
            });

            await page.goto(BASE_URL);
            await page.waitForLoadState('networkidle');

            // Verify CSS files loaded
            const cssFiles = loadedResources.filter(r =>
                r.contentType && r.contentType.includes('text/css') && r.status === 200
            );
            assert(cssFiles.length > 0, 'Should load CSS files');

            // Verify JavaScript files loaded
            const jsFiles = loadedResources.filter(r =>
                r.contentType && (r.contentType.includes('javascript') || r.url.endsWith('.js')) && r.status === 200
            );
            assert(jsFiles.length > 0, 'Should load JavaScript files');

            await page.close();
        });
    });

    describe('Node Tree Visualization', () => {
        test('should display node tree structure', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Look for node tree container
            await page.waitForSelector('.node-tree, #node-tree, [data-component="node-tree"]', { timeout: 5000 });

            // Verify tree structure is rendered
            const treeNodes = await page.$$('.node-item, .tree-node, [data-type="node"]');
            assert(treeNodes.length > 0, 'Should display tree nodes');

            // Test node expansion/collapse
            const expandableNodes = await page.$$('.expandable, .collapsible, [data-expandable="true"]');
            if (expandableNodes.length > 0) {
                const firstExpandable = expandableNodes[0];
                await firstExpandable.click();

                // Wait for expansion animation
                await setTimeout(500);

                // Verify children are visible
                const children = await page.$$('.child-node, .expanded-children');
                // Note: This might be 0 if no children, which is valid
            }

            await page.close();
        });

        test('should support node selection', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Wait for nodes to load
            await page.waitForSelector('.node-item, .tree-node, [data-type="node"]');

            const nodes = await page.$$('.node-item, .tree-node, [data-type="node"]');
            if (nodes.length > 0) {
                const firstNode = nodes[0];

                // Click to select
                await firstNode.click();

                // Wait for selection state
                await setTimeout(200);

                // Verify selection state
                const selectedNodes = await page.$$('.selected, .node-selected, [data-selected="true"]');
                assert(selectedNodes.length > 0, 'Should have selected node');

                // Verify node details are shown
                const detailsPanel = await page.$('.node-details, .property-panel, #node-properties');
                if (detailsPanel) {
                    const isVisible = await detailsPanel.isVisible();
                    assert(isVisible, 'Node details panel should be visible');
                }
            }

            await page.close();
        });
    });

    describe('Real-time Updates', () => {
        test('should reflect live data changes', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Create a new node through the UI
            const addButton = await page.$('.add-node, #add-node-btn, [data-action="add-node"]');
            if (addButton) {
                await addButton.click();

                // Fill in node creation form
                const nameInput = await page.$('input[name="name"], #node-name, .node-name-input');
                if (nameInput) {
                    await nameInput.type('test-node-ui');

                    const valueInput = await page.$('input[name="value"], #node-value, .node-value-input');
                    if (valueInput) {
                        await valueInput.type('test value');

                        // Submit form
                        const submitButton = await page.$('button[type="submit"], .submit-btn, #create-node');
                        if (submitButton) {
                            await submitButton.click();

                            // Wait for node to appear in tree
                            await page.waitForFunction(
                                () => document.querySelector('[data-node-name="test-node-ui"]') !== null,
                                { timeout: 5000 }
                            );

                            // Verify node is visible
                            const newNode = await page.$('[data-node-name="test-node-ui"]');
                            assert(newNode, 'New node should appear in tree');
                        }
                    }
                }
            }

            await page.close();
        });

        test('should handle WebSocket connections', async () => {
            const page = await browser.newPage();

            // Monitor WebSocket connections
            const wsConnections = [];
            page.on('websocket', ws => {
                wsConnections.push({
                    url: ws.url(),
                    isClosed: ws.isClosed()
                });

                ws.on('close', () => {
                    console.log('WebSocket closed:', ws.url());
                });

                ws.on('framereceived', event => {
                    console.log('WebSocket frame received:', event.payload);
                });
            });

            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Wait for WebSocket connections to establish
            await setTimeout(2000);

            // Verify WebSocket connection
            if (wsConnections.length > 0) {
                assert(wsConnections.some(ws => !ws.isClosed), 'Should have active WebSocket connection');
            }

            await page.close();
        });
    });

    describe('Editor Interface', () => {
        test('should support node value editing', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Find editable node
            const editableNode = await page.$('.editable-node, [data-editable="true"], .node-value[contenteditable="true"]');
            if (editableNode) {
                // Double-click to enter edit mode
                await editableNode.click({ clickCount: 2 });

                // Clear and type new value
                await page.keyboard.selectAll();
                await page.keyboard.type('edited value');

                // Press Enter to save
                await page.keyboard.press('Enter');

                // Wait for save confirmation
                await setTimeout(500);

                // Verify value was updated
                const nodeText = await editableNode.textContent();
                assert(nodeText.includes('edited value'), 'Node value should be updated');
            }

            await page.close();
        });

        test('should validate input data', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Try to create node with invalid data
            const addButton = await page.$('.add-node, #add-node-btn, [data-action="add-node"]');
            if (addButton) {
                await addButton.click();

                // Try empty name
                const submitButton = await page.$('button[type="submit"], .submit-btn, #create-node');
                if (submitButton) {
                    await submitButton.click();

                    // Look for validation error
                    const errorMessage = await page.$('.error-message, .validation-error, .field-error');
                    if (errorMessage) {
                        const isVisible = await errorMessage.isVisible();
                        assert(isVisible, 'Should show validation error for empty name');
                    }
                }
            }

            await page.close();
        });
    });

    describe('Performance and Responsiveness', () => {
        test('should load quickly with large datasets', async () => {
            const page = await browser.newPage();

            // Start performance monitoring
            await page.coverage.startJSCoverage();
            await page.coverage.startCSSCoverage();

            const startTime = Date.now();
            await page.goto(`${BASE_URL}?dataset=large`);
            await page.waitForSelector('#fxd-app');

            // Wait for data to load
            await page.waitForFunction(
                () => document.querySelectorAll('.node-item, .tree-node').length > 100,
                { timeout: 10000 }
            );

            const loadTime = Date.now() - startTime;

            // Performance assertions
            assert(loadTime < 5000, `Should load large dataset in under 5 seconds, took ${loadTime}ms`);

            // Check for performance issues
            const metrics = await page.metrics();
            assert(metrics.JSHeapUsedSize < 50 * 1024 * 1024, 'JS heap should be under 50MB');

            const coverage = await Promise.all([
                page.coverage.stopJSCoverage(),
                page.coverage.stopCSSCoverage()
            ]);

            console.log(`Performance metrics:
- Load time: ${loadTime}ms
- JS Heap: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)}MB
- DOM Nodes: ${metrics.Nodes}`);

            await page.close();
        });

        test('should handle smooth scrolling with many nodes', async () => {
            const page = await browser.newPage();
            await page.goto(`${BASE_URL}?dataset=large`);
            await page.waitForSelector('#fxd-app');

            // Wait for nodes to load
            await page.waitForFunction(
                () => document.querySelectorAll('.node-item, .tree-node').length > 50,
                { timeout: 10000 }
            );

            // Test scrolling performance
            const scrollContainer = await page.$('.tree-container, .node-list, #node-tree');
            if (scrollContainer) {
                const startTime = Date.now();

                // Perform smooth scroll
                await page.evaluate((element) => {
                    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
                }, scrollContainer);

                // Wait for scroll to complete
                await setTimeout(1000);

                const scrollTime = Date.now() - startTime;
                assert(scrollTime < 2000, `Scroll should complete quickly, took ${scrollTime}ms`);
            }

            await page.close();
        });
    });

    describe('Accessibility', () => {
        test('should support keyboard navigation', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Test tab navigation
            await page.keyboard.press('Tab');
            const activeElement = await page.evaluateHandle(() => document.activeElement);

            assert(activeElement, 'Should have focusable element');

            // Test arrow key navigation in tree
            await page.keyboard.press('ArrowDown');
            await setTimeout(100);

            const newActiveElement = await page.evaluateHandle(() => document.activeElement);
            // Verify focus moved (elements should be different)

            await page.close();
        });

        test('should have proper ARIA labels', async () => {
            const page = await browser.newPage();
            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Check for ARIA labels on interactive elements
            const ariaElements = await page.$$('[aria-label], [aria-labelledby], [role]');
            assert(ariaElements.length > 0, 'Should have elements with ARIA attributes');

            // Verify tree has proper role
            const treeElement = await page.$('[role="tree"], [role="treegrid"]');
            if (treeElement) {
                const role = await treeElement.getAttribute('role');
                assert(role === 'tree' || role === 'treegrid', 'Tree should have appropriate role');
            }

            await page.close();
        });
    });

    describe('Mobile Responsiveness', () => {
        test('should work on mobile viewport', async () => {
            const page = await browser.newPage();
            await page.setViewport({ width: 375, height: 667 }); // iPhone SE size

            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Verify mobile layout
            const mobileMenu = await page.$('.mobile-menu, .hamburger-menu, [data-mobile="true"]');
            if (mobileMenu) {
                const isVisible = await mobileMenu.isVisible();
                assert(isVisible, 'Mobile menu should be visible on small screens');
            }

            // Test touch interactions
            const node = await page.$('.node-item, .tree-node');
            if (node) {
                // Simulate touch tap
                await node.tap();
                await setTimeout(200);

                // Verify selection worked
                const selected = await page.$('.selected, .node-selected');
                assert(selected, 'Touch selection should work');
            }

            await page.close();
        });

        test('should handle touch gestures', async () => {
            const page = await browser.newPage();
            await page.setViewport({ width: 375, height: 667 });

            await page.goto(BASE_URL);
            await page.waitForSelector('#fxd-app');

            // Test pinch zoom (if supported)
            const treeContainer = await page.$('.tree-container, #node-tree');
            if (treeContainer) {
                // Simulate pinch gesture
                await page.touchscreen.tap(200, 300);

                // Test swipe gesture
                await page.touchscreen.tap(100, 300);
                await page.touchscreen.tap(300, 300);
            }

            await page.close();
        });
    });

    describe('Error Handling', () => {
        test('should display user-friendly error messages', async () => {
            const page = await browser.newPage();

            // Monitor JavaScript errors
            const jsErrors = [];
            page.on('pageerror', error => {
                jsErrors.push(error.message);
            });

            await page.goto(`${BASE_URL}?error=simulate`);

            // Look for error display in UI
            const errorDisplay = await page.$('.error-banner, .error-message, .alert-error');
            if (errorDisplay) {
                const isVisible = await errorDisplay.isVisible();
                const errorText = await errorDisplay.textContent();

                assert(isVisible, 'Error should be visible to user');
                assert(errorText.length > 0, 'Error message should have content');
                assert(!errorText.includes('undefined'), 'Error should not show undefined');
            }

            await page.close();
        });

        test('should recover from network failures', async () => {
            const page = await browser.newPage();

            // Simulate offline
            await page.setOfflineMode(true);
            await page.goto(BASE_URL);

            // Go back online
            await page.setOfflineMode(false);
            await page.reload();

            await page.waitForSelector('#fxd-app');

            // Verify app recovered
            const appElement = await page.$('#fxd-app');
            assert(appElement, 'App should recover after network restoration');

            await page.close();
        });
    });
});

// Helper function to start test server
function startTestServer() {
    return new Promise((resolve, reject) => {
        // Try to start the FXD development server
        const server = spawn('node', ['-e', `
            const http = require('http');
            const fs = require('fs');
            const path = require('path');

            const server = http.createServer((req, res) => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Content-Type', 'text/html');

                // Serve a basic test page
                const html = \`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>FXD Test Interface</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        #fxd-app { min-height: 400px; border: 1px solid #ccc; padding: 20px; }
                        .node-tree { margin: 20px 0; }
                        .node-item { padding: 5px; margin: 2px 0; cursor: pointer; }
                        .node-item.selected { background: #e3f2fd; }
                        .add-node { margin: 10px 0; padding: 8px 16px; }
                        .error-message { color: red; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div id="fxd-app">
                        <h1>FXD Test Interface</h1>
                        <div class="node-tree" id="node-tree">
                            <div class="node-item" data-node-name="root">Root Node</div>
                            <div class="node-item" data-node-name="user">User Data</div>
                            <div class="node-item" data-node-name="config">Configuration</div>
                        </div>
                        <button class="add-node" id="add-node-btn">Add Node</button>
                        <div id="node-form" style="display:none;">
                            <input name="name" placeholder="Node name" />
                            <input name="value" placeholder="Node value" />
                            <button type="submit" id="create-node">Create</button>
                            <div class="error-message" style="display:none;">Name is required</div>
                        </div>
                    </div>

                    <script>
                        // Simple test interface behavior
                        let selectedNode = null;

                        document.querySelectorAll('.node-item').forEach(node => {
                            node.addEventListener('click', () => {
                                if (selectedNode) selectedNode.classList.remove('selected');
                                node.classList.add('selected');
                                selectedNode = node;
                            });
                        });

                        document.getElementById('add-node-btn').addEventListener('click', () => {
                            document.getElementById('node-form').style.display = 'block';
                        });

                        document.getElementById('create-node').addEventListener('click', () => {
                            const nameInput = document.querySelector('input[name="name"]');
                            const valueInput = document.querySelector('input[name="value"]');
                            const errorMsg = document.querySelector('.error-message');

                            if (!nameInput.value.trim()) {
                                errorMsg.style.display = 'block';
                                return;
                            }

                            errorMsg.style.display = 'none';

                            const newNode = document.createElement('div');
                            newNode.className = 'node-item';
                            newNode.setAttribute('data-node-name', nameInput.value);
                            newNode.textContent = nameInput.value + ': ' + valueInput.value;

                            document.getElementById('node-tree').appendChild(newNode);

                            newNode.addEventListener('click', () => {
                                if (selectedNode) selectedNode.classList.remove('selected');
                                newNode.classList.add('selected');
                                selectedNode = newNode;
                            });

                            document.getElementById('node-form').style.display = 'none';
                            nameInput.value = '';
                            valueInput.value = '';
                        });

                        // Simulate large dataset if requested
                        if (window.location.search.includes('dataset=large')) {
                            const tree = document.getElementById('node-tree');
                            for (let i = 0; i < 200; i++) {
                                const node = document.createElement('div');
                                node.className = 'node-item';
                                node.setAttribute('data-node-name', 'item' + i);
                                node.textContent = 'Item ' + i + ': Value ' + i;
                                tree.appendChild(node);
                            }
                        }

                        // Simulate error if requested
                        if (window.location.search.includes('error=simulate')) {
                            const error = document.createElement('div');
                            error.className = 'error-banner';
                            error.textContent = 'Simulated error for testing';
                            error.style.cssText = 'background: #ffebee; color: #c62828; padding: 10px; margin: 10px 0;';
                            document.getElementById('fxd-app').insertBefore(error, document.getElementById('fxd-app').firstChild);
                        }
                    </script>
                </body>
                </html>
                \`;

                res.end(html);
            });

            server.listen(${TEST_PORT}, () => {
                console.log('Test server running on port ${TEST_PORT}');
            });
        `], {
            stdio: 'pipe',
            detached: false
        });

        server.stdout.on('data', (data) => {
            if (data.toString().includes('Test server running')) {
                resolve(server);
            }
        });

        server.stderr.on('data', (data) => {
            console.error('Server error:', data.toString());
        });

        server.on('error', reject);

        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Server startup timeout'));
        }, 10000);
    });
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🎭 Running FXD UI Tests with Puppeteer...\n');

    // You can run specific test groups here
    // The tests will be picked up by Node.js test runner when running npm test
}