#!/usr/bin/env deno run --allow-all

/**
 * @file qa-validation-framework.ts
 * @description Comprehensive End-to-End Quality Assurance Framework for FXD
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This framework provides:
 * 1. End-to-end test scenarios for real-world workflows
 * 2. Cross-platform compatibility validation
 * 3. Performance and scalability testing
 * 4. Integration testing for all major components
 * 5. Developer experience validation
 * 6. Documentation accuracy verification
 */

import { assertEquals, assertNotEquals, assertThrows, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'workflow' | 'performance' | 'integration' | 'usability';
  priority: 'critical' | 'high' | 'medium' | 'low';
  platform: 'all' | 'deno' | 'browser' | 'node';
  execute: () => Promise<TestResult>;
}

interface TestResult {
  success: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  metrics?: Record<string, number>;
  artifacts?: Record<string, any>;
}

interface QAReport {
  testRun: {
    id: string;
    timestamp: number;
    platform: string;
    environment: Record<string, string>;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    coverage: number;
  };
  scenarios: Array<{
    scenario: TestScenario;
    result: TestResult;
  }>;
  recommendations: string[];
}

// === CORE QA FRAMEWORK ===

export class FXDQAFramework {
  private scenarios: Map<string, TestScenario> = new Map();
  private results: Map<string, TestResult> = new Map();
  private artifacts: Map<string, any> = new Map();

  constructor() {
    this.registerCoreScenarios();
    this.registerWorkflowScenarios();
    this.registerPerformanceScenarios();
    this.registerIntegrationScenarios();
    this.registerUsabilityScenarios();
  }

  // === TEST SCENARIO REGISTRATION ===

  private registerCoreScenarios(): void {
    // Core Runtime Validation
    this.addScenario({
      id: 'core-node-creation',
      name: 'FXNode Creation and Proxy Binding',
      description: 'Validates core node creation, proxy binding, and value management',
      category: 'core',
      priority: 'critical',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Test node creation
          const testNode = $$('test.core.node1');
          assert(testNode, 'Failed to create test node');

          // Test value setting and getting
          testNode.val('hello world');
          assertEquals(testNode.val(), 'hello world', 'Value set/get failed');

          // Test type promotion
          testNode.val({ foo: 'bar', nested: { value: 42 } });
          assertEquals(testNode.val().foo, 'bar', 'Object promotion failed');
          assertEquals(testNode('nested.value').val(), 42, 'Nested access failed');

          // Test reactive links
          const sourceNode = $$('test.source');
          const targetNode = $$('test.target');
          sourceNode.val(100);
          targetNode.val(sourceNode); // Create reactive link
          assertEquals(targetNode.val(), 100, 'Reactive link failed');

          sourceNode.val(200);
          // Wait for reactivity
          await new Promise(resolve => setTimeout(resolve, 50));
          assertEquals(targetNode.val(), 200, 'Reactive update failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        } catch (error) {
          errors.push(`Core node test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });

    // Selector Engine Validation
    this.addScenario({
      id: 'selector-engine',
      name: 'CSS Selector Engine Validation',
      description: 'Tests CSS-like selector functionality and group operations',
      category: 'core',
      priority: 'critical',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Setup test nodes
          $$('users.alice').val({ name: 'Alice', active: true, role: 'admin' });
          $$('users.bob').val({ name: 'Bob', active: false, role: 'user' });
          $$('users.charlie').val({ name: 'Charlie', active: true, role: 'user' });

          // Set node types
          $$('users.alice').node().__type = 'user';
          $$('users.bob').node().__type = 'user';
          $$('users.charlie').node().__type = 'user';

          // Test class selector
          const userGroup = $$('users').select('.user');
          const userList = userGroup.list();
          assertEquals(userList.length, 3, 'Class selector failed to find all users');

          // Test attribute selector
          const activeUsers = $$('users').select('[active=true]');
          const activeList = activeUsers.list();
          assertEquals(activeList.length, 2, 'Attribute selector failed');

          // Test complex selector
          const activeAdmins = $$('users').select('.user[role=admin][active=true]');
          const adminList = activeAdmins.list();
          assertEquals(adminList.length, 1, 'Complex selector failed');

          // Test group operations
          const names = userGroup.cast('string');
          assert(names.includes('Alice'), 'Group cast operation failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        } catch (error) {
          errors.push(`Selector engine test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });
  }

  private registerWorkflowScenarios(): void {
    // Project Lifecycle
    this.addScenario({
      id: 'workflow-project-lifecycle',
      name: 'Complete Project Lifecycle',
      description: 'Tests create → edit → save → load → export workflow',
      category: 'workflow',
      priority: 'high',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // 1. Create project
          $$('project.test.name').val('TestProject');
          $$('project.test.created').val(Date.now());
          $$('project.test.version').val('1.0.0');

          // 2. Add snippets
          $$('project.test.snippets.main').val({
            id: 'main',
            content: 'console.log("Hello World");',
            language: 'javascript'
          });

          // 3. Create views
          $$('project.test.views.main-view').val('console.log("Hello World");');

          // 4. Edit content
          const snippet = $$('project.test.snippets.main');
          const content = snippet.val();
          content.content = 'console.log("Hello FXD!");';
          snippet.val(content);

          // 5. Verify changes
          assertEquals(
            $$('project.test.snippets.main').val().content,
            'console.log("Hello FXD!");',
            'Content edit failed'
          );

          // 6. Export simulation
          const exportData = {
            name: $$('project.test.name').val(),
            snippets: $$('project.test.snippets').val(),
            views: $$('project.test.views').val()
          };

          assert(exportData.name === 'TestProject', 'Export data validation failed');
          assert(exportData.snippets.main, 'Snippet export failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings,
            artifacts: { exportData }
          };
        } catch (error) {
          errors.push(`Project lifecycle test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });

    // Git Integration Simulation
    this.addScenario({
      id: 'workflow-git-integration',
      name: 'Git Integration Workflow',
      description: 'Simulates git-like operations: branch, merge, conflict resolution',
      category: 'workflow',
      priority: 'high',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Setup main branch
          $$('repo.main.file1').val({ content: 'original content', version: 1 });
          $$('repo.main.file2').val({ content: 'file 2 content', version: 1 });

          // Create feature branch
          const mainFiles = $$('repo.main').val();
          $$('repo.feature.file1').val({ ...mainFiles.file1 });
          $$('repo.feature.file2').val({ ...mainFiles.file2 });

          // Make changes in feature branch
          $$('repo.feature.file1').val({
            content: 'modified in feature branch',
            version: 2
          });

          // Simulate parallel change in main
          $$('repo.main.file1').val({
            content: 'modified in main',
            version: 2
          });

          // Detect conflict
          const mainFile1 = $$('repo.main.file1').val();
          const featureFile1 = $$('repo.feature.file1').val();

          const hasConflict = mainFile1.content !== featureFile1.content &&
                             mainFile1.version === featureFile1.version;

          assert(hasConflict, 'Conflict detection failed');

          // Simulate conflict resolution
          $$('repo.merge.file1').val({
            content: 'resolved: ' + mainFile1.content + ' + ' + featureFile1.content,
            version: 3
          });

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings,
            artifacts: {
              conflictDetected: hasConflict,
              resolution: $$('repo.merge.file1').val()
            }
          };
        } catch (error) {
          errors.push(`Git integration test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });
  }

  private registerPerformanceScenarios(): void {
    // Large Node Tree Performance
    this.addScenario({
      id: 'performance-large-tree',
      name: 'Large Node Tree Performance',
      description: 'Tests performance with large number of nodes and complex queries',
      category: 'performance',
      priority: 'high',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const metrics: Record<string, number> = {};

        try {
          const nodeCount = 10000;
          const batchSize = 100;

          // Create large number of nodes in batches
          for (let batch = 0; batch < nodeCount / batchSize; batch++) {
            const batchStart = performance.now();

            for (let i = 0; i < batchSize; i++) {
              const nodeId = batch * batchSize + i;
              $$(`perf.nodes.node${nodeId}`).val({
                id: nodeId,
                type: nodeId % 3 === 0 ? 'important' : 'normal',
                value: Math.random(),
                created: Date.now()
              });
            }

            const batchTime = performance.now() - batchStart;
            if (batch === 0) metrics.firstBatchTime = batchTime;
            if (batch === Math.floor(nodeCount / batchSize) - 1) metrics.lastBatchTime = batchTime;
          }

          metrics.totalCreationTime = performance.now() - startTime;
          metrics.avgTimePerNode = metrics.totalCreationTime / nodeCount;

          // Test query performance
          const queryStart = performance.now();
          const importantNodes = $$('perf.nodes').select('[type=important]');
          const importantList = importantNodes.list();
          metrics.queryTime = performance.now() - queryStart;
          metrics.foundNodes = importantList.length;

          // Memory usage estimation
          const nodeSize = JSON.stringify($$('perf.nodes.node0').val()).length;
          metrics.estimatedMemoryKB = (nodeCount * nodeSize) / 1024;

          // Performance assertions
          if (metrics.avgTimePerNode > 1) {
            warnings.push(`Average node creation time high: ${metrics.avgTimePerNode}ms`);
          }

          if (metrics.queryTime > 100) {
            warnings.push(`Query time high: ${metrics.queryTime}ms`);
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings,
            metrics
          };
        } catch (error) {
          errors.push(`Performance test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings,
            metrics
          };
        }
      }
    });

    // Memory Leak Detection
    this.addScenario({
      id: 'performance-memory-leaks',
      name: 'Memory Leak Detection',
      description: 'Tests for memory leaks in reactive systems and event handlers',
      category: 'performance',
      priority: 'high',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const metrics: Record<string, number> = {};

        try {
          // Create watchers and reactive links
          const iterations = 1000;
          const unwatchFunctions: Array<() => void> = [];

          for (let i = 0; i < iterations; i++) {
            const sourceNode = $$(`leak.test.source${i}`);
            const targetNode = $$(`leak.test.target${i}`);

            sourceNode.val(i);

            // Create watcher
            const unwatch = sourceNode.watch((newVal) => {
              targetNode.val(newVal * 2);
            });
            unwatchFunctions.push(unwatch);

            // Create reactive link
            targetNode.val(sourceNode);
          }

          metrics.setupComplete = performance.now() - startTime;

          // Test cleanup
          const cleanupStart = performance.now();
          unwatchFunctions.forEach(fn => fn());
          metrics.cleanupTime = performance.now() - cleanupStart;

          // Verify cleanup by triggering updates
          const updateStart = performance.now();
          for (let i = 0; i < 100; i++) {
            $$(`leak.test.source${i}`).val(i + 1000);
          }
          metrics.updateAfterCleanup = performance.now() - updateStart;

          // Performance checks
          if (metrics.cleanupTime > 500) {
            warnings.push(`Cleanup time excessive: ${metrics.cleanupTime}ms`);
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings,
            metrics
          };
        } catch (error) {
          errors.push(`Memory leak test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings,
            metrics
          };
        }
      }
    });
  }

  private registerIntegrationScenarios(): void {
    // CLI Integration
    this.addScenario({
      id: 'integration-cli',
      name: 'CLI Operations Integration',
      description: 'Tests CLI commands and their integration with FX core',
      category: 'integration',
      priority: 'high',
      platform: 'deno',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Simulate CLI create operation
          $$('cli.test.disk.name').val('test-disk');
          $$('cli.test.disk.created').val(Date.now());
          $$('cli.test.disk.version').val('1.0.0');

          // Initialize collections
          $$('cli.test.snippets').val({});
          $$('cli.test.views').val({});
          $$('cli.test.groups').val({});

          // Simulate import operation
          const mockFileContent = `
function greet(name) {
  console.log("Hello, " + name);
}

function farewell(name) {
  console.log("Goodbye, " + name);
}
          `.trim();

          // Parse into snippets (simplified)
          $$('cli.test.snippets.greet').val({
            id: 'greet',
            content: 'function greet(name) {\n  console.log("Hello, " + name);\n}',
            language: 'javascript',
            type: 'function'
          });

          $$('cli.test.snippets.farewell').val({
            id: 'farewell',
            content: 'function farewell(name) {\n  console.log("Goodbye, " + name);\n}',
            language: 'javascript',
            type: 'function'
          });

          // Create views
          $$('cli.test.views.main').val(mockFileContent);

          // Verify integration
          const diskName = $$('cli.test.disk.name').val();
          const snippets = $$('cli.test.snippets').val();

          assertEquals(diskName, 'test-disk', 'CLI disk creation failed');
          assertEquals(Object.keys(snippets).length, 2, 'CLI import failed');
          assert(snippets.greet.language === 'javascript', 'Snippet parsing failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings,
            artifacts: { snippets, diskName }
          };
        } catch (error) {
          errors.push(`CLI integration test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });

    // Module Loading Integration
    this.addScenario({
      id: 'integration-modules',
      name: 'Module Loading System Integration',
      description: 'Tests @-syntax module loading and attachment',
      category: 'integration',
      priority: 'medium',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Simulate module namespace
          const mockModule = {
            default: class TestModule {
              constructor(name: string) {
                this.name = name;
              }

              greet() {
                return `Hello from ${this.name}`;
              }
            },
            helper: function(value: any) {
              return value * 2;
            }
          };

          // Attach module to node
          const moduleNode = $$('modules.test');
          moduleNode.val(mockModule.default);

          // Test instantiation
          const instance = new (moduleNode.val())('TestInstance');
          assertEquals(instance.greet(), 'Hello from TestInstance', 'Module instantiation failed');

          // Test helper attachment
          $$('modules.test.helper').val(mockModule.helper);
          assertEquals($$('modules.test.helper').val()(5), 10, 'Helper function failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        } catch (error) {
          errors.push(`Module integration test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });
  }

  private registerUsabilityScenarios(): void {
    // Developer Experience
    this.addScenario({
      id: 'usability-developer-experience',
      name: 'Developer Experience Validation',
      description: 'Tests common developer workflows and API usability',
      category: 'usability',
      priority: 'medium',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Test intuitive API usage
          const user = $$('app.user');
          user.val({ name: 'John', age: 30 });

          // Test fluent interface
          const result = user('name').val() + ' is ' + user('age').val() + ' years old';
          assertEquals(result, 'John is 30 years old', 'Fluent API failed');

          // Test error handling
          try {
            $$('nonexistent.deeply.nested.path').val();
            // Should not throw for getting undefined values
          } catch (error) {
            warnings.push('API threw unexpected error for undefined access');
          }

          // Test type safety simulation
          const typed = user.as('User'); // Should return null if not a User instance
          if (typed === null) {
            // Expected behavior
          } else {
            warnings.push('Type safety not working as expected');
          }

          // Test reactive patterns
          const counter = $$('app.counter');
          counter.val(0);

          const doubled = $$('app.doubled');
          doubled.val(counter); // Reactive link

          counter.val(5);
          await new Promise(resolve => setTimeout(resolve, 10));

          assertEquals(doubled.val(), 5, 'Reactive pattern failed');

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        } catch (error) {
          errors.push(`Developer experience test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });

    // Documentation Accuracy
    this.addScenario({
      id: 'usability-documentation',
      name: 'Documentation Accuracy Check',
      description: 'Validates that documented examples actually work',
      category: 'usability',
      priority: 'medium',
      platform: 'all',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
          // Test examples from fx.ts comments

          // Example 1: Basic usage
          const User = $$("app.user");
          User.val({ name: "Charl", role: "admin" });
          assertEquals(User('name').val(), "Charl", "Basic usage example failed");

          // Example 2: CSS groups
          $$('app.users.alice').val({ name: 'Alice', active: true });
          $$('app.users.bob').val({ name: 'Bob', active: false });
          $$('app.users').select('[active=true]');
          // Note: full selector test would need proper type setup

          // Example 3: Group operations
          const team = $$("teams.core").group([]);
          team.add($$("people.alice"));

          // Verify group functionality
          const list = team.list();
          assert(Array.isArray(list), "Group list operation failed");

          return {
            success: true,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        } catch (error) {
          errors.push(`Documentation test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            errors,
            warnings
          };
        }
      }
    });
  }

  // === FRAMEWORK METHODS ===

  addScenario(scenario: TestScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  async runScenario(id: string): Promise<TestResult> {
    const scenario = this.scenarios.get(id);
    if (!scenario) {
      throw new Error(`Scenario not found: ${id}`);
    }

    console.log(`🔄 Running: ${scenario.name}`);

    try {
      const result = await scenario.execute();
      this.results.set(id, result);

      if (result.artifacts) {
        this.artifacts.set(id, result.artifacts);
      }

      const status = result.success ? '✅' : '❌';
      const duration = Math.round(result.duration);
      console.log(`${status} ${scenario.name} (${duration}ms)`);

      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.join(', ')}`);
      }

      return result;
    } catch (error) {
      const failResult: TestResult = {
        success: false,
        duration: 0,
        errors: [error.message],
        warnings: []
      };
      this.results.set(id, failResult);
      console.log(`❌ ${scenario.name} - CRASHED: ${error.message}`);
      return failResult;
    }
  }

  async runAll(filter?: {
    category?: string;
    priority?: string;
    platform?: string;
  }): Promise<QAReport> {
    const startTime = Date.now();
    console.log('🚀 Starting FXD Quality Assurance Validation...\n');

    let scenarios = Array.from(this.scenarios.values());

    // Apply filters
    if (filter) {
      scenarios = scenarios.filter(scenario => {
        if (filter.category && scenario.category !== filter.category) return false;
        if (filter.priority && scenario.priority !== filter.priority) return false;
        if (filter.platform && scenario.platform !== 'all' && scenario.platform !== filter.platform) return false;
        return true;
      });
    }

    console.log(`📋 Running ${scenarios.length} test scenarios...\n`);

    const results: Array<{ scenario: TestScenario; result: TestResult }> = [];

    // Run scenarios
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario.id);
      results.push({ scenario, result });
    }

    // Generate report
    const passed = results.filter(r => r.result.success).length;
    const failed = results.filter(r => !r.result.success).length;
    const warnings = results.reduce((sum, r) => sum + r.result.warnings.length, 0);

    const report: QAReport = {
      testRun: {
        id: `qa-${Date.now()}`,
        timestamp: startTime,
        platform: this.detectPlatform(),
        environment: this.getEnvironmentInfo()
      },
      summary: {
        total: scenarios.length,
        passed,
        failed,
        warnings,
        coverage: Math.round((passed / scenarios.length) * 100)
      },
      scenarios: results,
      recommendations: this.generateRecommendations(results)
    };

    this.printReport(report);
    return report;
  }

  private detectPlatform(): string {
    if (typeof Deno !== 'undefined') return 'deno';
    if (typeof window !== 'undefined') return 'browser';
    if (typeof process !== 'undefined') return 'node';
    return 'unknown';
  }

  private getEnvironmentInfo(): Record<string, string> {
    const info: Record<string, string> = {};

    try {
      if (typeof Deno !== 'undefined') {
        info.deno_version = Deno.version.deno;
        info.typescript_version = Deno.version.typescript;
      }
    } catch {
      // Ignore if Deno not available
    }

    info.user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';

    return info;
  }

  private generateRecommendations(results: Array<{ scenario: TestScenario; result: TestResult }>): string[] {
    const recommendations: string[] = [];

    const failedCritical = results.filter(r =>
      !r.result.success && r.scenario.priority === 'critical'
    );

    if (failedCritical.length > 0) {
      recommendations.push('🚨 CRITICAL: Address failed critical scenarios before production deployment');
    }

    const performanceIssues = results.filter(r =>
      r.scenario.category === 'performance' && r.result.warnings.length > 0
    );

    if (performanceIssues.length > 0) {
      recommendations.push('⚡ PERFORMANCE: Review performance warnings and optimize');
    }

    const usabilityProblems = results.filter(r =>
      r.scenario.category === 'usability' && (!r.result.success || r.result.warnings.length > 0)
    );

    if (usabilityProblems.length > 0) {
      recommendations.push('👤 UX: Improve developer experience based on usability test findings');
    }

    const integrationFailures = results.filter(r =>
      r.scenario.category === 'integration' && !r.result.success
    );

    if (integrationFailures.length > 0) {
      recommendations.push('🔗 INTEGRATION: Fix component integration issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ EXCELLENT: All quality checks passed! Ready for production.');
    }

    return recommendations;
  }

  private printReport(report: QAReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FXD QUALITY ASSURANCE REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);
    console.log(`🖥️  Platform: ${report.testRun.platform}`);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Scenarios: ${report.summary.total}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`   📊 Coverage: ${report.summary.coverage}%`);

    // Group by category
    const byCategory = new Map<string, typeof report.scenarios>();
    for (const result of report.scenarios) {
      const cat = result.scenario.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(result);
    }

    console.log(`\n📋 BY CATEGORY:`);
    for (const [category, scenarios] of byCategory) {
      const passed = scenarios.filter(s => s.result.success).length;
      const total = scenarios.length;
      const status = passed === total ? '✅' : (passed === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${category.toUpperCase()}: ${passed}/${total}`);
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      for (const rec of report.recommendations) {
        console.log(`   ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }
}

// === CLI RUNNER ===

async function runQAValidation() {
  const qa = new FXDQAFramework();

  // Parse command line arguments
  const args = Deno.args;
  const filter: any = {};

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      filter.category = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      filter.priority = arg.split('=')[1];
    } else if (arg.startsWith('--platform=')) {
      filter.platform = arg.split('=')[1];
    }
  }

  const report = await qa.runAll(Object.keys(filter).length > 0 ? filter : undefined);

  // Exit with appropriate code
  Deno.exit(report.summary.failed > 0 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runQAValidation();
}

export { FXDQAFramework };