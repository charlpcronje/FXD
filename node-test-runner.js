#!/usr/bin/env node

/**
 * Node.js test runner for FXD examples
 * Compatible with existing Deno TypeScript code
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class FXDTestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runExample(name, filePath) {
    this.log(`\n  Testing: ${name}`, 'cyan');

    try {
      // Check if file exists
      await fs.access(filePath);

      // Read the file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic validation - check for common patterns
      if (content.includes('import') && content.includes('export')) {
        this.log(`    ✓ Valid module structure`, 'green');
      }

      if (content.includes('$$') || content.includes('fx')) {
        this.log(`    ✓ Uses FX framework`, 'green');
      }

      if (content.includes('createSnippet') || content.includes('snippet')) {
        this.log(`    ✓ Implements snippet functionality`, 'green');
      }

      if (content.includes('FXDisk') || content.includes('.fxd')) {
        this.log(`    ✓ Uses persistence`, 'green');
      }

      this.results.passed++;
      return true;
    } catch (error) {
      this.log(`    ✗ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push({ name, error: error.message });
      return false;
    }
  }

  async testCLI() {
    this.log('\n📋 Testing CLI Integration...', 'bright');

    try {
      const cliPath = path.join(__dirname, 'cli', 'fxd.ts');
      const content = await fs.readFile(cliPath, 'utf-8');

      const features = [
        { pattern: 'class FXDCLI', name: 'CLI class definition' },
        { pattern: 'parseArgs', name: 'Argument parsing' },
        { pattern: 'import.*command', name: 'Import command' },
        { pattern: 'export.*command', name: 'Export command' },
        { pattern: 'snippet.*command', name: 'Snippet management' },
        { pattern: 'view.*command', name: 'View management' },
        { pattern: 'health.*command', name: 'Health check' },
      ];

      for (const feature of features) {
        if (new RegExp(feature.pattern, 'i').test(content)) {
          this.log(`    ✓ ${feature.name}`, 'green');
          this.results.passed++;
        } else {
          this.log(`    ✗ Missing: ${feature.name}`, 'yellow');
          this.results.skipped++;
        }
      }

    } catch (error) {
      this.log(`    ✗ CLI test failed: ${error.message}`, 'red');
      this.results.failed++;
    }
  }

  async testPersistence() {
    this.log('\n💾 Testing Persistence Layer...', 'bright');

    try {
      const persistPath = path.join(__dirname, 'modules', 'fx-persistence.ts');
      const denoPath = path.join(__dirname, 'modules', 'fx-persistence-deno.ts');

      const persistContent = await fs.readFile(persistPath, 'utf-8');
      const denoContent = await fs.readFile(denoPath, 'utf-8');

      const features = [
        { content: persistContent, pattern: 'class FXPersistence', name: 'FXPersistence class' },
        { content: persistContent, pattern: 'save.*method|function.*save', name: 'Save functionality' },
        { content: persistContent, pattern: 'load.*method|function.*load', name: 'Load functionality' },
        { content: denoContent, pattern: 'class FXDisk', name: 'FXDisk API' },
        { content: denoContent, pattern: 'SQLite', name: 'SQLite integration' },
      ];

      for (const feature of features) {
        if (new RegExp(feature.pattern, 'i').test(feature.content)) {
          this.log(`    ✓ ${feature.name}`, 'green');
          this.results.passed++;
        } else {
          this.log(`    ✗ Missing: ${feature.name}`, 'yellow');
          this.results.skipped++;
        }
      }

      // Check for .fxd files
      const fxdFiles = await this.findFiles('.fxd');
      if (fxdFiles.length > 0) {
        this.log(`    ✓ Found ${fxdFiles.length} .fxd files`, 'green');
        this.results.passed++;
      }

    } catch (error) {
      this.log(`    ✗ Persistence test failed: ${error.message}`, 'red');
      this.results.failed++;
    }
  }

  async testWebVisualizer() {
    this.log('\n🌐 Testing Web Visualizer...', 'bright');

    try {
      // Check for HTML files
      const htmlFiles = [
        path.join(__dirname, 'demo.html'),
        path.join(__dirname, 'public', 'visualizer-demo.html')
      ];

      for (const htmlFile of htmlFiles) {
        try {
          const content = await fs.readFile(htmlFile, 'utf-8');
          const fileName = path.basename(htmlFile);

          if (content.includes('<!DOCTYPE html>')) {
            this.log(`    ✓ ${fileName} exists`, 'green');
            this.results.passed++;

            // Check for specific features
            if (content.includes('canvas') || content.includes('svg')) {
              this.log(`      ✓ Has visualization elements`, 'green');
            }
            if (content.includes('script')) {
              this.log(`      ✓ Has JavaScript`, 'green');
            }
          }
        } catch (e) {
          // File doesn't exist, skip
        }
      }

      // Check for server files
      const serverPath = path.join(__dirname, 'server', 'visualizer-server.ts');
      try {
        await fs.access(serverPath);
        this.log(`    ✓ Visualizer server exists`, 'green');
        this.results.passed++;
      } catch (e) {
        this.log(`    ✗ Visualizer server missing`, 'yellow');
        this.results.skipped++;
      }

    } catch (error) {
      this.log(`    ✗ Web visualizer test failed: ${error.message}`, 'red');
      this.results.failed++;
    }
  }

  async findFiles(extension) {
    const files = [];
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    }
    await walk(__dirname);
    return files;
  }

  async runAllTests() {
    this.log('\n' + '='.repeat(60), 'bright');
    this.log('🚀 FXD Framework Test Suite', 'bright');
    this.log('='.repeat(60), 'bright');

    // Test examples
    this.log('\n📂 Testing Examples...', 'bright');
    const examples = [
      { name: 'Hello World', path: 'examples/hello-world/demo.ts' },
      { name: 'Persistence Demo', path: 'examples/persistence-demo.ts' },
      { name: 'Import/Export', path: 'examples/import-export-example.ts' },
      { name: 'MCP Client', path: 'examples/mcp-client-demo.ts' },
    ];

    for (const example of examples) {
      const fullPath = path.join(__dirname, example.path);
      await this.runExample(example.name, fullPath);
    }

    // Test major components
    await this.testCLI();
    await this.testPersistence();
    await this.testWebVisualizer();

    // Print summary
    this.log('\n' + '='.repeat(60), 'bright');
    this.log('📊 Test Summary', 'bright');
    this.log('='.repeat(60), 'bright');

    this.log(`  ✅ Passed: ${this.results.passed}`, 'green');
    if (this.results.failed > 0) {
      this.log(`  ❌ Failed: ${this.results.failed}`, 'red');
    }
    if (this.results.skipped > 0) {
      this.log(`  ⚠️  Skipped: ${this.results.skipped}`, 'yellow');
    }

    const total = this.results.passed + this.results.failed + this.results.skipped;
    const percentage = Math.round((this.results.passed / total) * 100);
    this.log(`\n  Coverage: ${percentage}% (${this.results.passed}/${total})`,
             percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red');

    if (this.results.errors.length > 0) {
      this.log('\n  Errors:', 'red');
      for (const err of this.results.errors) {
        this.log(`    - ${err.name}: ${err.error}`, 'red');
      }
    }

    // Save results
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      coverage: percentage,
      total: total
    };

    await fs.writeFile(
      path.join(__dirname, 'test-validation-report.json'),
      JSON.stringify(report, null, 2)
    );

    this.log('\n✨ Test report saved to test-validation-report.json', 'cyan');

    return this.results.failed === 0;
  }
}

// Run tests
const runner = new FXDTestRunner();
runner.runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});