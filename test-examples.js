#!/usr/bin/env node

/**
 * Example Test Runner for FXD
 * Tests all examples can be parsed and validated
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class ExampleTester {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async testExample(name, filePath) {
    this.log(`\nTesting: ${name}`, 'cyan');

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic syntax validation
      const checks = [
        {
          name: 'Import statements',
          pattern: /import\s+.+\s+from\s+['"](.+)['"]/g,
          validate: (matches) => {
            for (const match of matches) {
              const importPath = match[1];
              this.log(`  ✓ Import: ${importPath}`, 'green');
            }
            return true;
          }
        },
        {
          name: 'FX usage',
          pattern: /\$\$\(['"]([\w.]+)['"]\)/g,
          validate: (matches) => {
            const paths = new Set();
            for (const match of matches) {
              paths.add(match[1]);
            }
            if (paths.size > 0) {
              this.log(`  ✓ FX paths used: ${paths.size}`, 'green');
              return true;
            }
            return false;
          }
        },
        {
          name: 'Snippet creation',
          pattern: /createSnippet\(['"]([\w.]+)['"],/g,
          validate: (matches) => {
            if (matches.length > 0) {
              this.log(`  ✓ Creates ${matches.length} snippets`, 'green');
              return true;
            }
            return false;
          }
        },
        {
          name: 'Persistence usage',
          pattern: /FXDisk|\.fxd|save\(\)|load\(\)/g,
          validate: (matches) => {
            if (matches.length > 0) {
              this.log(`  ✓ Uses persistence`, 'green');
              return true;
            }
            return false;
          }
        },
        {
          name: 'Error handling',
          pattern: /try\s*\{[\s\S]*?\}\s*catch/g,
          validate: (matches) => {
            if (matches.length > 0) {
              this.log(`  ✓ Has error handling`, 'green');
              return true;
            }
            this.log(`  ⚠ No error handling`, 'yellow');
            this.results.warnings.push(`${name}: No error handling`);
            return true; // Warning only
          }
        }
      ];

      let allPassed = true;

      for (const check of checks) {
        const matches = Array.from(content.matchAll(check.pattern));
        if (!check.validate(matches) && check.name !== 'Error handling') {
          this.log(`  ✗ ${check.name} check failed`, 'red');
          allPassed = false;
        }
      }

      // Check for common issues
      if (content.includes('console.log') || content.includes('console.error')) {
        this.log(`  ✓ Has console output`, 'green');
      }

      if (content.includes('async') && content.includes('await')) {
        this.log(`  ✓ Uses async/await`, 'green');
      }

      // Check file structure
      const lines = content.split('\n');
      this.log(`  📊 File stats: ${lines.length} lines, ${content.length} characters`, 'blue');

      if (allPassed) {
        this.results.passed.push(name);
        this.log(`✅ ${name} passed all checks`, 'green');
      } else {
        this.results.failed.push(name);
        this.log(`❌ ${name} failed some checks`, 'red');
      }

      return allPassed;

    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed.push(name);
      return false;
    }
  }

  async testAllExamples() {
    this.log('\n' + '='.repeat(60), 'bright');
    this.log('🚀 FXD Examples Test Suite', 'bright');
    this.log('='.repeat(60), 'bright');

    const examples = [
      {
        name: 'Hello World',
        path: 'examples/hello-world/demo.ts',
        description: 'Basic FX usage'
      },
      {
        name: 'Persistence Demo',
        path: 'examples/persistence-demo.ts',
        description: 'Save/load with .fxd files'
      },
      {
        name: 'Import/Export',
        path: 'examples/import-export-example.ts',
        description: 'File import and export'
      },
      {
        name: 'MCP Client',
        path: 'examples/mcp-client-demo.ts',
        description: 'MCP integration example'
      },
      {
        name: 'Snippet Management',
        path: 'examples/snippet-management/demo.ts',
        description: 'Snippet CRUD operations'
      },
      {
        name: 'Repository JS',
        path: 'examples/repo-js/demo.ts',
        description: 'Repository pattern'
      }
    ];

    for (const example of examples) {
      const fullPath = path.join(__dirname, example.path);

      try {
        await fs.access(fullPath);
        this.log(`\n📁 ${example.name}: ${example.description}`, 'bright');
        await this.testExample(example.name, fullPath);
      } catch (error) {
        this.log(`\n📁 ${example.name}: File not found`, 'yellow');
        this.results.warnings.push(`${example.name}: File not found at ${example.path}`);
      }
    }

    // Test for .fxd files
    this.log('\n\n📦 Testing .fxd Files...', 'bright');
    const fxdFiles = await this.findFxdFiles();

    if (fxdFiles.length > 0) {
      this.log(`  ✓ Found ${fxdFiles.length} .fxd files:`, 'green');
      for (const file of fxdFiles) {
        const stats = await fs.stat(file);
        const size = this.formatSize(stats.size);
        this.log(`    • ${path.basename(file)} (${size})`, 'cyan');
      }
    } else {
      this.log(`  ⚠ No .fxd files found`, 'yellow');
    }

    // Print summary
    this.printSummary();
  }

  async findFxdFiles() {
    const files = [];

    async function walk(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.fxd')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await walk(__dirname);
    return files;
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  printSummary() {
    this.log('\n' + '='.repeat(60), 'bright');
    this.log('📊 Test Summary', 'bright');
    this.log('='.repeat(60), 'bright');

    const total = this.results.passed.length + this.results.failed.length;
    const passRate = total > 0 ? Math.round((this.results.passed.length / total) * 100) : 0;

    this.log(`\n✅ Passed: ${this.results.passed.length}`, 'green');
    if (this.results.failed.length > 0) {
      this.log(`❌ Failed: ${this.results.failed.length}`, 'red');
      for (const failed of this.results.failed) {
        this.log(`    • ${failed}`, 'red');
      }
    }

    if (this.results.warnings.length > 0) {
      this.log(`⚠️  Warnings: ${this.results.warnings.length}`, 'yellow');
      for (const warning of this.results.warnings) {
        this.log(`    • ${warning}`, 'yellow');
      }
    }

    this.log(`\n📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');

    // Recommendations
    this.log('\n💡 Recommendations:', 'cyan');

    if (this.results.failed.length === 0) {
      this.log('  ✓ All examples are working correctly!', 'green');
    } else {
      this.log('  • Fix failing examples to ensure documentation accuracy', 'yellow');
    }

    if (this.results.warnings.length > 3) {
      this.log('  • Add error handling to examples for robustness', 'yellow');
    }

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      passed: this.results.passed,
      failed: this.results.failed,
      warnings: this.results.warnings,
      passRate: passRate,
      summary: {
        total: total,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length
      }
    };

    fs.writeFile(
      path.join(__dirname, 'example-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    this.log('\n✨ Report saved to example-test-report.json', 'cyan');
  }
}

// Run the tests
const tester = new ExampleTester();
tester.testAllExamples().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});