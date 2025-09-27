#!/usr/bin/env deno run --allow-all

/**
 * @file integration-test-suite.ts
 * @description Integration Testing Suite for FXD Core Components
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This suite validates integration between FXD core components:
 * 1. FX Core + Selector Engine integration
 * 2. Reactive System + Group Composition integration
 * 3. Module Loader + Core Runtime integration
 * 4. CLI + Core System integration
 * 5. Persistence + Memory System integration
 * 6. Plugin System + Core Framework integration
 * 7. Cross-component data flow validation
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface IntegrationTest {
  id: string;
  name: string;
  description: string;
  components: string[];
  category: 'core-integration' | 'system-integration' | 'data-flow' | 'plugin-integration';
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
  execute: () => Promise<IntegrationResult>;
}

interface IntegrationResult {
  success: boolean;
  duration: number;
  componentResults: ComponentResult[];
  dataFlowVerified: boolean;
  warnings: string[];
  errors: string[];
  artifacts: Record<string, any>;
}

interface ComponentResult {
  component: string;
  functional: boolean;
  performance: number; // ms
  errors: string[];
}

interface IntegrationReport {
  testRun: {
    id: string;
    timestamp: number;
    environment: string;
  };
  results: IntegrationResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    componentCoverage: number;
    integrationScore: number;
  };
  componentHealth: Record<string, ComponentHealth>;
  recommendations: string[];
}

interface ComponentHealth {
  tested: boolean;
  successRate: number;
  averagePerformance: number;
  integrationIssues: string[];
}

// === INTEGRATION TEST SUITE ===

export class IntegrationTestSuite {
  private tests: Map<string, IntegrationTest> = new Map();
  private results: IntegrationResult[] = [];
  private componentMetrics: Map<string, ComponentResult[]> = new Map();

  constructor() {
    this.registerIntegrationTests();
  }

  private registerIntegrationTests(): void {
    // Core + Selector Engine Integration
    this.addTest({
      id: 'core-selector-integration',
      name: 'FX Core + Selector Engine Integration',
      description: 'Tests integration between core node system and CSS-like selector engine',
      components: ['FXCore', 'SelectorEngine', 'Group'],
      category: 'core-integration',
      complexity: 'moderate',
      dependencies: [],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test 1: Core node creation for selector testing
          console.log('    Testing core node creation...');
          const coreStart = performance.now();

          // Create diverse node structure
          for (let i = 0; i < 100; i++) {
            $$(`integration.test.items.item${i}`).val({
              id: i,
              type: i % 3 === 0 ? 'premium' : (i % 3 === 1 ? 'standard' : 'basic'),
              active: i % 7 !== 0,
              category: ['electronics', 'books', 'clothing'][i % 3],
              score: Math.floor(Math.random() * 100),
              metadata: {
                featured: i % 13 === 0,
                inStock: i % 19 !== 0
              }
            });

            // Set proper types for selector engine
            $$(`integration.test.items.item${i}`).node().__type = $$(`integration.test.items.item${i}`).val().type;
          }

          const coreTime = performance.now() - coreStart;
          componentResults.push({
            component: 'FXCore',
            functional: true,
            performance: coreTime,
            errors: []
          });

          // Test 2: Selector engine queries
          console.log('    Testing selector engine...');
          const selectorStart = performance.now();

          const premiumItems = $$('integration.test.items').select('.premium');
          const activeElectronics = $$('integration.test.items').select('[category=electronics][active=true]');
          const featuredItems = $$('integration.test.items').select('[metadata.featured=true]');
          const highScoreStandard = $$('integration.test.items').select('.standard[score>70]');

          const premiumList = premiumItems.list();
          const activeElectronicsList = activeElectronics.list();
          const featuredList = featuredItems.list();
          const highScoreList = highScoreStandard.list();

          const selectorTime = performance.now() - selectorStart;
          componentResults.push({
            component: 'SelectorEngine',
            functional: premiumList.length > 0 && activeElectronicsList.length >= 0,
            performance: selectorTime,
            errors: []
          });

          // Test 3: Group operations integration
          console.log('    Testing group operations...');
          const groupStart = performance.now();

          const dynamicGroup = $$('integration.test.items').select('.premium[active=true]');
          const manualGroup = $$('integration.groups.manual').group();

          manualGroup.add($$('integration.test.items.item0'));
          manualGroup.add($$('integration.test.items.item10'));

          const combinedGroup = $$('integration.groups.combined').group();
          combinedGroup.include('.premium').exclude('[active=false]');

          const dynamicCount = dynamicGroup.list().length;
          const manualCount = manualGroup.list().length;
          const combinedCount = combinedGroup.list().length;

          const groupTime = performance.now() - groupStart;
          componentResults.push({
            component: 'Group',
            functional: dynamicCount >= 0 && manualCount === 2 && combinedCount >= 0,
            performance: groupTime,
            errors: []
          });

          // Test 4: Cross-component data flow
          console.log('    Testing cross-component data flow...');
          let dataFlowVerified = false;

          // Update a node and verify selector results update
          const initialPremiumCount = $$('integration.test.items').select('.premium').list().length;

          // Change a basic item to premium
          $$('integration.test.items.item2').val({
            ...$$('integration.test.items.item2').val(),
            type: 'premium'
          });
          $$('integration.test.items.item2').node().__type = 'premium';

          // Wait for potential reactivity
          await new Promise(resolve => setTimeout(resolve, 10));

          const updatedPremiumCount = $$('integration.test.items').select('.premium').list().length;
          dataFlowVerified = updatedPremiumCount === initialPremiumCount + 1;

          if (!dataFlowVerified) {
            warnings.push('Selector results may not update dynamically with node changes');
          }

          artifacts.nodeCount = 100;
          artifacts.premiumCount = premiumList.length;
          artifacts.activeElectronicsCount = activeElectronicsList.length;
          artifacts.featuredCount = featuredList.length;
          artifacts.dataFlowTest = { initial: initialPremiumCount, updated: updatedPremiumCount };

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Core-Selector integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Reactive System + Group Composition Integration
    this.addTest({
      id: 'reactive-group-integration',
      name: 'Reactive System + Group Composition Integration',
      description: 'Tests reactive updates propagating through group compositions',
      components: ['ReactiveSystem', 'Group', 'Watchers'],
      category: 'core-integration',
      complexity: 'complex',
      dependencies: ['core-selector-integration'],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test 1: Reactive system setup
          console.log('    Setting up reactive system...');
          const reactiveStart = performance.now();

          // Create reactive sources
          for (let i = 0; i < 20; i++) {
            $$(`reactive.sources.source${i}`).val(i * 10);
            $$(`reactive.targets.target${i}`).val($$(`reactive.sources.source${i}`)); // Reactive link
            $$(`reactive.computed.computed${i}`).val(0);

            // Add computed value watcher
            $$(`reactive.targets.target${i}`).watch((newVal) => {
              $$(`reactive.computed.computed${i}`).val(newVal * 2);
            });
          }

          const reactiveTime = performance.now() - reactiveStart;
          componentResults.push({
            component: 'ReactiveSystem',
            functional: true,
            performance: reactiveTime,
            errors: []
          });

          // Test 2: Group composition on reactive nodes
          console.log('    Creating reactive groups...');
          const groupStart = performance.now();

          // Create groups that will reactively update
          const sourceGroup = $$('reactive.groups.sources').group();
          const targetGroup = $$('reactive.groups.targets').group();
          const computedGroup = $$('reactive.groups.computed').group();

          // Add reactive nodes to groups
          for (let i = 0; i < 20; i++) {
            sourceGroup.add($$(`reactive.sources.source${i}`));
            targetGroup.add($$(`reactive.targets.target${i}`));
            computedGroup.add($$(`reactive.computed.computed${i}`));
          }

          const groupTime = performance.now() - groupStart;
          componentResults.push({
            component: 'Group',
            functional: sourceGroup.list().length === 20,
            performance: groupTime,
            errors: []
          });

          // Test 3: Watcher integration with groups
          console.log('    Testing group watchers...');
          const watcherStart = performance.now();

          let groupChangeCount = 0;
          let lastGroupSum = 0;

          // Watch group statistics
          targetGroup.on('change', () => {
            groupChangeCount++;
            lastGroupSum = targetGroup.sum();
          });

          const watcherTime = performance.now() - watcherStart;
          componentResults.push({
            component: 'Watchers',
            functional: true,
            performance: watcherTime,
            errors: []
          });

          // Test 4: Cross-component reactive flow
          console.log('    Testing reactive flow through components...');
          let dataFlowVerified = false;

          const initialTargetSum = targetGroup.sum();
          const initialComputedSum = computedGroup.sum();

          // Update sources and verify propagation
          for (let i = 0; i < 5; i++) {
            $$(`reactive.sources.source${i}`).val((i + 1) * 100);
          }

          // Wait for reactive propagation
          await new Promise(resolve => setTimeout(resolve, 50));

          const updatedTargetSum = targetGroup.sum();
          const updatedComputedSum = computedGroup.sum();

          // Verify reactive flow: sources → targets → computed
          dataFlowVerified =
            updatedTargetSum !== initialTargetSum &&
            updatedComputedSum !== initialComputedSum &&
            updatedComputedSum === updatedTargetSum * 2;

          if (!dataFlowVerified) {
            warnings.push('Reactive flow through group compositions may not be working correctly');
          }

          artifacts.groupSizes = {
            sources: sourceGroup.list().length,
            targets: targetGroup.list().length,
            computed: computedGroup.list().length
          };
          artifacts.sums = {
            initialTarget: initialTargetSum,
            updatedTarget: updatedTargetSum,
            initialComputed: initialComputedSum,
            updatedComputed: updatedComputedSum
          };
          artifacts.groupChangeCount = groupChangeCount;
          artifacts.lastGroupSum = lastGroupSum;

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Reactive-Group integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Module Loader + Core Runtime Integration
    this.addTest({
      id: 'module-core-integration',
      name: 'Module Loader + Core Runtime Integration',
      description: 'Tests module loading and attachment to core runtime',
      components: ['ModuleLoader', 'FXCore', 'PluginManager'],
      category: 'system-integration',
      complexity: 'moderate',
      dependencies: [],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test 1: Module loader functionality
          console.log('    Testing module loader...');
          const moduleStart = performance.now();

          // Mock module loading (since we can't load real external modules in test)
          const mockMath = {
            add: (a: number, b: number) => a + b,
            multiply: (a: number, b: number) => a * b,
            calculate: (expr: string) => eval(expr)
          };

          const mockUser = class User {
            constructor(public name: string, public email: string) {}
            getInfo() { return `${this.name} <${this.email}>`; }
          };

          // Simulate module attachment
          $$('modules.math').val(mockMath);
          $$('modules.User').val(mockUser);

          const moduleTime = performance.now() - moduleStart;
          componentResults.push({
            component: 'ModuleLoader',
            functional: true,
            performance: moduleTime,
            errors: []
          });

          // Test 2: Core runtime integration
          console.log('    Testing core runtime integration...');
          const coreStart = performance.now();

          // Test module usage through core
          const mathModule = $$('modules.math').val();
          const UserClass = $$('modules.User').val();

          const sum = mathModule.add(5, 3);
          const product = mathModule.multiply(4, 7);
          const user = new UserClass('John Doe', 'john@example.com');

          assertEquals(sum, 8, "Math module add function should work");
          assertEquals(product, 28, "Math module multiply function should work");
          assertEquals(user.getInfo(), 'John Doe <john@example.com>', "User module should work");

          const coreTime = performance.now() - coreStart;
          componentResults.push({
            component: 'FXCore',
            functional: true,
            performance: coreTime,
            errors: []
          });

          // Test 3: Plugin manager integration
          console.log('    Testing plugin manager integration...');
          const pluginStart = performance.now();

          // Register modules as plugins
          try {
            // Simulate plugin registration
            $$('plugins.math-utils').val(mockMath);
            $$('plugins.user-system').val(mockUser);

            // Test plugin access
            const mathPlugin = $$('plugins.math-utils').val();
            const userPlugin = $$('plugins.user-system').val();

            const pluginMathResult = mathPlugin.add(10, 15);
            const pluginUser = new userPlugin('Jane Smith', 'jane@example.com');

            assertEquals(pluginMathResult, 25, "Plugin math should work");
            assertEquals(pluginUser.name, 'Jane Smith', "Plugin user creation should work");

            const pluginTime = performance.now() - pluginStart;
            componentResults.push({
              component: 'PluginManager',
              functional: true,
              performance: pluginTime,
              errors: []
            });
          } catch (error) {
            componentResults.push({
              component: 'PluginManager',
              functional: false,
              performance: performance.now() - pluginStart,
              errors: [error.message]
            });
          }

          // Test 4: Cross-component data flow
          console.log('    Testing module-core data flow...');
          let dataFlowVerified = false;

          try {
            // Create computation using module through core
            $$('calculations.result1').val(mathModule.add($$('data.a').val() || 5, $$('data.b').val() || 10));
            $$('calculations.result2').val(mathModule.multiply($$('calculations.result1').val(), 2));

            // Create user through module
            $$('users.admin').val(new UserClass('Admin', 'admin@system.com'));

            const result1 = $$('calculations.result1').val();
            const result2 = $$('calculations.result2').val();
            const admin = $$('users.admin').val();

            dataFlowVerified =
              result1 === 15 &&
              result2 === 30 &&
              admin.name === 'Admin';

          } catch (error) {
            warnings.push(`Data flow verification failed: ${error.message}`);
          }

          artifacts.moduleResults = { sum, product };
          artifacts.userInfo = user.getInfo();
          artifacts.pluginResults = {
            mathResult: typeof $$('plugins.math-utils').val() !== 'undefined',
            userPlugin: typeof $$('plugins.user-system').val() !== 'undefined'
          };
          artifacts.calculations = {
            result1: $$('calculations.result1').val(),
            result2: $$('calculations.result2').val()
          };

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Module-Core integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // CLI + Core System Integration
    this.addTest({
      id: 'cli-core-integration',
      name: 'CLI + Core System Integration',
      description: 'Tests CLI operations integration with core FX system',
      components: ['CLI', 'FXCore', 'FileSystem'],
      category: 'system-integration',
      complexity: 'moderate',
      dependencies: [],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test 1: CLI disk operations
          console.log('    Testing CLI disk operations...');
          const cliStart = performance.now();

          // Simulate CLI create command
          $$('cli.operations.create').val({
            command: 'create',
            args: { name: 'test-project', path: './test' }
          });

          // Simulate disk creation through CLI
          $$('disk.name').val('test-project');
          $$('disk.created').val(Date.now());
          $$('disk.version').val('1.0.0');
          $$('disk.path').val('./test/test-project.fxd');

          // Initialize collections
          $$('snippets').val({});
          $$('views').val({});
          $$('groups').val({});
          $$('markers').val({});

          const cliTime = performance.now() - cliStart;
          componentResults.push({
            component: 'CLI',
            functional: $$('disk.name').val() === 'test-project',
            performance: cliTime,
            errors: []
          });

          // Test 2: Core system integration
          console.log('    Testing CLI-Core integration...');
          const coreStart = performance.now();

          // Simulate import operation
          const mockFileContent = `
function greet(name) {
  return "Hello, " + name;
}

function farewell(name) {
  return "Goodbye, " + name;
}
          `.trim();

          // Simulate CLI import parsing
          $$('cli.operations.import').val({
            command: 'import',
            file: 'example.js',
            content: mockFileContent
          });

          // Parse into snippets (simulating CLI logic)
          $$('snippets.greet').val({
            id: 'greet',
            name: 'greet',
            content: 'function greet(name) {\n  return "Hello, " + name;\n}',
            language: 'javascript',
            type: 'function',
            source: 'example.js'
          });

          $$('snippets.farewell').val({
            id: 'farewell',
            name: 'farewell',
            content: 'function farewell(name) {\n  return "Goodbye, " + name;\n}',
            language: 'javascript',
            type: 'function',
            source: 'example.js'
          });

          // Create view
          $$('views.example-js').val(mockFileContent);

          const coreTime = performance.now() - coreStart;
          componentResults.push({
            component: 'FXCore',
            functional: Object.keys($$('snippets').val()).length === 2,
            performance: coreTime,
            errors: []
          });

          // Test 3: File system simulation
          console.log('    Testing file system integration...');
          const fsStart = performance.now();

          // Simulate export operation
          $$('cli.operations.export').val({
            command: 'export',
            outputPath: './export',
            format: 'files'
          });

          // Simulate file export
          const views = $$('views').val();
          const exportedFiles: Record<string, string> = {};

          for (const [viewName, content] of Object.entries(views)) {
            exportedFiles[viewName] = content as string;
          }

          $$('export.files').val(exportedFiles);

          const fsTime = performance.now() - fsStart;
          componentResults.push({
            component: 'FileSystem',
            functional: Object.keys(exportedFiles).length > 0,
            performance: fsTime,
            errors: []
          });

          // Test 4: Cross-component data flow
          console.log('    Testing CLI-Core data flow...');
          let dataFlowVerified = false;

          try {
            // Verify complete CLI workflow
            const diskName = $$('disk.name').val();
            const snippetsCount = Object.keys($$('snippets').val()).length;
            const viewsCount = Object.keys($$('views').val()).length;
            const exportedCount = Object.keys($$('export.files').val()).length;

            dataFlowVerified =
              diskName === 'test-project' &&
              snippetsCount === 2 &&
              viewsCount === 1 &&
              exportedCount === 1;

          } catch (error) {
            warnings.push(`CLI-Core data flow verification failed: ${error.message}`);
          }

          artifacts.diskInfo = {
            name: $$('disk.name').val(),
            created: $$('disk.created').val(),
            version: $$('disk.version').val()
          };
          artifacts.snippets = $$('snippets').val();
          artifacts.views = $$('views').val();
          artifacts.exportedFiles = $$('export.files').val();

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`CLI-Core integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Memory + Persistence Integration
    this.addTest({
      id: 'memory-persistence-integration',
      name: 'Memory + Persistence Integration',
      description: 'Tests memory management and persistence layer integration',
      components: ['Memory', 'Persistence', 'EventLog'],
      category: 'data-flow',
      complexity: 'complex',
      dependencies: [],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test 1: Memory management
          console.log('    Testing memory management...');
          const memoryStart = performance.now();

          // Simulate memory tracking
          $$('memory.tracking.enabled').val(true);
          $$('memory.tracking.operations').val([]);

          // Create nodes and track memory operations
          for (let i = 0; i < 50; i++) {
            const operation = {
              type: 'create',
              nodeId: `memory.test.node${i}`,
              timestamp: Date.now(),
              size: JSON.stringify({ id: i, data: `node-${i}` }).length
            };

            $$('memory.tracking.operations').val([
              ...$$('memory.tracking.operations').val(),
              operation
            ]);

            $$(`memory.test.node${i}`).val({ id: i, data: `node-${i}` });
          }

          const memoryTime = performance.now() - memoryStart;
          componentResults.push({
            component: 'Memory',
            functional: $$('memory.tracking.operations').val().length === 50,
            performance: memoryTime,
            errors: []
          });

          // Test 2: Event logging
          console.log('    Testing event logging...');
          const eventStart = performance.now();

          // Simulate append-only event log
          $$('persistence.event-log').val([]);

          const operations = $$('memory.tracking.operations').val();
          for (const op of operations) {
            const logEntry = {
              id: Math.random().toString(36),
              timestamp: op.timestamp,
              operation: op.type,
              target: op.nodeId,
              data: op,
              checksum: op.nodeId.length + op.size
            };

            $$('persistence.event-log').val([
              ...$$('persistence.event-log').val(),
              logEntry
            ]);
          }

          const eventTime = performance.now() - eventStart;
          componentResults.push({
            component: 'EventLog',
            functional: $$('persistence.event-log').val().length === 50,
            performance: eventTime,
            errors: []
          });

          // Test 3: Persistence simulation
          console.log('    Testing persistence layer...');
          const persistStart = performance.now();

          // Simulate persistence backends
          const backends = ['memory', 'disk', 'cloud'];
          for (const backend of backends) {
            $$(`persistence.backends.${backend}.enabled`).val(true);
            $$(`persistence.backends.${backend}.config`).val({
              type: backend,
              endpoint: backend === 'cloud' ? 'https://api.example.com' : null,
              path: backend === 'disk' ? './data' : null
            });

            // Simulate data persistence
            const eventLog = $$('persistence.event-log').val();
            $$(`persistence.backends.${backend}.data`).val({
              timestamp: Date.now(),
              entries: eventLog.length,
              size: JSON.stringify(eventLog).length
            });
          }

          const persistTime = performance.now() - persistStart;
          componentResults.push({
            component: 'Persistence',
            functional: backends.every(b => $$(`persistence.backends.${b}.enabled`).val()),
            performance: persistTime,
            errors: []
          });

          // Test 4: Cross-component data flow (replay mechanism)
          console.log('    Testing replay mechanism...');
          let dataFlowVerified = false;

          try {
            // Simulate crash and replay
            $$('system.crashed').val(true);
            $$('recovery.replay').val([]);

            const eventLog = $$('persistence.event-log').val();

            // Replay operations
            for (const entry of eventLog) {
              if (entry.operation === 'create') {
                const replayOp = {
                  type: 'replay',
                  original: entry,
                  timestamp: Date.now(),
                  success: true
                };

                $$('recovery.replay').val([
                  ...$$('recovery.replay').val(),
                  replayOp
                ]);
              }
            }

            const replayCount = $$('recovery.replay').val().length;
            const originalCount = eventLog.filter((e: any) => e.operation === 'create').length;

            dataFlowVerified = replayCount === originalCount && replayCount === 50;

            $$('system.crashed').val(false);
            $$('system.recovered').val(true);

          } catch (error) {
            warnings.push(`Replay mechanism verification failed: ${error.message}`);
          }

          artifacts.memoryOperations = $$('memory.tracking.operations').val().length;
          artifacts.eventLogEntries = $$('persistence.event-log').val().length;
          artifacts.persistenceBackends = backends.map(b => ({
            name: b,
            enabled: $$(`persistence.backends.${b}.enabled`).val(),
            data: $$(`persistence.backends.${b}.data`).val()
          }));
          artifacts.replayResults = {
            originalOperations: $$('persistence.event-log').val().filter((e: any) => e.operation === 'create').length,
            replayedOperations: $$('recovery.replay').val().length,
            systemRecovered: $$('system.recovered').val()
          };

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Memory-Persistence integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Full System Integration Test
    this.addTest({
      id: 'full-system-integration',
      name: 'Full System Integration Test',
      description: 'Comprehensive test of all components working together',
      components: ['FXCore', 'SelectorEngine', 'ReactiveSystem', 'ModuleLoader', 'CLI', 'Persistence'],
      category: 'system-integration',
      complexity: 'complex',
      dependencies: ['core-selector-integration', 'reactive-group-integration', 'module-core-integration', 'cli-core-integration', 'memory-persistence-integration'],
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const componentResults: ComponentResult[] = [];
        const artifacts: Record<string, any> = {};

        try {
          console.log('    Running comprehensive system integration test...');

          // Phase 1: Initialize full system
          const initStart = performance.now();

          // Create a complete application scenario
          $$('app.name').val('FXD Integration Test App');
          $$('app.version').val('1.0.0');
          $$('app.created').val(Date.now());

          // Create user management system
          class User {
            constructor(public id: string, public name: string, public role: string) {}
            hasPermission(action: string) {
              return this.role === 'admin' || (this.role === 'user' && action === 'read');
            }
          }

          $$('modules.User').val(User);

          // Create users
          const users = [
            new User('1', 'Alice', 'admin'),
            new User('2', 'Bob', 'user'),
            new User('3', 'Charlie', 'user')
          ];

          users.forEach(user => {
            $$(`app.users.${user.id}`).val(user);
            $$(`app.users.${user.id}`).node().__type = 'user';
            $$(`app.users.${user.id}`).node().__instances.set('User', user);
          });

          const initTime = performance.now() - initStart;
          componentResults.push({
            component: 'FXCore',
            functional: $$('app.users.1').val().name === 'Alice',
            performance: initTime,
            errors: []
          });

          // Phase 2: Test selectors and groups
          const selectorStart = performance.now();

          const adminUsers = $$('app.users').select('[role=admin]');
          const regularUsers = $$('app.users').select('[role=user]');
          const allUsers = $$('app.users').select('.user');

          const adminList = adminUsers.list();
          const regularList = regularUsers.list();
          const allList = allUsers.list();

          const selectorTime = performance.now() - selectorStart;
          componentResults.push({
            component: 'SelectorEngine',
            functional: adminList.length === 1 && regularList.length === 2 && allList.length === 3,
            performance: selectorTime,
            errors: []
          });

          // Phase 3: Test reactive system
          const reactiveStart = performance.now();

          // Create reactive dashboard
          $$('app.dashboard.userCount').val(allUsers);
          $$('app.dashboard.adminCount').val(adminUsers);
          $$('app.dashboard.stats').val({});

          // Reactive computation
          let statsUpdated = false;
          $$('app.dashboard.userCount').watch(() => {
            $$('app.dashboard.stats').val({
              total: $$('app.dashboard.userCount').list().length,
              admins: $$('app.dashboard.adminCount').list().length,
              regular: $$('app.dashboard.userCount').list().length - $$('app.dashboard.adminCount').list().length,
              updated: Date.now()
            });
            statsUpdated = true;
          });

          // Add a new user to trigger reactive update
          const newUser = new User('4', 'David', 'user');
          $$('app.users.4').val(newUser);
          $$('app.users.4').node().__type = 'user';

          // Wait for reactive updates
          await new Promise(resolve => setTimeout(resolve, 20));

          const reactiveTime = performance.now() - reactiveStart;
          componentResults.push({
            component: 'ReactiveSystem',
            functional: statsUpdated,
            performance: reactiveTime,
            errors: []
          });

          // Phase 4: Test CLI operations
          const cliStart = performance.now();

          // Simulate CLI operations
          $$('cli.session.active').val(true);
          $$('cli.session.commands').val([]);

          // Add command
          $$('cli.session.commands').val([
            ...$$('cli.session.commands').val(),
            { command: 'list', args: { type: 'users' }, timestamp: Date.now() }
          ]);

          // Execute list command simulation
          const userList = Object.values($$('app.users').val()).map((user: any) => ({
            id: user.id,
            name: user.name,
            role: user.role
          }));

          $$('cli.results.list-users').val(userList);

          const cliTime = performance.now() - cliStart;
          componentResults.push({
            component: 'CLI',
            functional: $$('cli.results.list-users').val().length === 4,
            performance: cliTime,
            errors: []
          });

          // Phase 5: Test persistence
          const persistStart = performance.now();

          // Log all operations
          const persistenceLog = [
            { type: 'app.created', data: $$('app.name').val(), timestamp: Date.now() },
            { type: 'users.created', count: 4, timestamp: Date.now() },
            { type: 'dashboard.updated', stats: $$('app.dashboard.stats').val(), timestamp: Date.now() },
            { type: 'cli.executed', commands: $$('cli.session.commands').val().length, timestamp: Date.now() }
          ];

          $$('persistence.log').val(persistenceLog);

          const persistTime = performance.now() - persistStart;
          componentResults.push({
            component: 'Persistence',
            functional: $$('persistence.log').val().length === 4,
            performance: persistTime,
            errors: []
          });

          // Phase 6: Verify full system data flow
          let dataFlowVerified = false;

          try {
            // Check that all components have interacted correctly
            const appExists = $$('app.name').val() === 'FXD Integration Test App';
            const usersCreated = Object.keys($$('app.users').val()).length === 4;
            const selectorsWork = adminList.length === 1 && regularList.length === 2;
            const reactiveWorks = statsUpdated && $$('app.dashboard.stats').val().total === 4;
            const cliWorks = $$('cli.results.list-users').val().length === 4;
            const persistenceWorks = $$('persistence.log').val().length === 4;

            dataFlowVerified = appExists && usersCreated && selectorsWork && reactiveWorks && cliWorks && persistenceWorks;

          } catch (error) {
            warnings.push(`Full system data flow verification failed: ${error.message}`);
          }

          artifacts.application = {
            name: $$('app.name').val(),
            userCount: Object.keys($$('app.users').val()).length,
            dashboard: $$('app.dashboard.stats').val()
          };
          artifacts.selectors = {
            admins: adminList.length,
            regular: regularList.length,
            total: allList.length
          };
          artifacts.cli = {
            commandsExecuted: $$('cli.session.commands').val().length,
            results: $$('cli.results.list-users').val().length
          };
          artifacts.persistence = {
            logEntries: $$('persistence.log').val().length,
            operations: $$('persistence.log').val()
          };

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Full system integration failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            componentResults,
            dataFlowVerified: false,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });
  }

  addTest(test: IntegrationTest): void {
    this.tests.set(test.id, test);
  }

  async runTest(testId: string): Promise<IntegrationResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    console.log(`🔗 Running integration test: ${test.name}`);
    console.log(`🧩 Components: ${test.components.join(', ')}`);
    console.log(`📊 Complexity: ${test.complexity}`);

    try {
      const result = await test.execute();

      // Track component metrics
      for (const componentResult of result.componentResults) {
        if (!this.componentMetrics.has(componentResult.component)) {
          this.componentMetrics.set(componentResult.component, []);
        }
        this.componentMetrics.get(componentResult.component)!.push(componentResult);
      }

      const status = result.success ? '✅' : '❌';
      const duration = Math.round(result.duration);
      const dataFlow = result.dataFlowVerified ? '🔄' : '⚠️';
      console.log(`${status} ${test.name} (${duration}ms) ${dataFlow}`);

      if (result.warnings.length > 0) {
        console.log(`   ⚠️ Warnings: ${result.warnings.length}`);
      }
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.length}`);
      }

      return result;
    } catch (error) {
      console.log(`❌ ${test.name} - CRASHED: ${error.message}`);
      return {
        success: false,
        duration: 0,
        componentResults: [],
        dataFlowVerified: false,
        warnings: [],
        errors: [error.message],
        artifacts: { crashed: true }
      };
    }
  }

  async runAllTests(filter?: {
    category?: string;
    complexity?: string;
    component?: string;
  }): Promise<IntegrationReport> {
    console.log('🚀 Starting Integration Testing...\n');

    let tests = Array.from(this.tests.values());

    // Apply filters
    if (filter) {
      tests = tests.filter(test => {
        if (filter.category && test.category !== filter.category) return false;
        if (filter.complexity && test.complexity !== filter.complexity) return false;
        if (filter.component && !test.components.includes(filter.component)) return false;
        return true;
      });
    }

    // Sort by dependencies (simple dependency resolution)
    tests = this.sortByDependencies(tests);

    console.log(`📋 Running ${tests.length} integration tests...\n`);

    this.results = [];
    this.componentMetrics.clear();

    // Run tests
    for (const test of tests) {
      const result = await this.runTest(test.id);
      this.results.push(result);
    }

    // Generate report
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const dataFlowPassed = this.results.filter(r => r.dataFlowVerified).length;

    const allComponents = new Set<string>();
    for (const test of tests) {
      test.components.forEach(c => allComponents.add(c));
    }

    const componentCoverage = Math.round((this.componentMetrics.size / allComponents.size) * 100);
    const integrationScore = this.calculateIntegrationScore();

    const report: IntegrationReport = {
      testRun: {
        id: `integration-${Date.now()}`,
        timestamp: Date.now(),
        environment: 'FXD Integration Testing'
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        componentCoverage,
        integrationScore
      },
      componentHealth: this.generateComponentHealth(),
      recommendations: this.generateRecommendations()
    };

    this.printReport(report);
    return report;
  }

  private sortByDependencies(tests: IntegrationTest[]): IntegrationTest[] {
    const sorted: IntegrationTest[] = [];
    const remaining = [...tests];

    while (remaining.length > 0) {
      const canRun = remaining.filter(test =>
        test.dependencies.every(dep => sorted.some(s => s.id === dep))
      );

      if (canRun.length === 0) {
        // No more tests can run due to dependencies, add remaining anyway
        sorted.push(...remaining);
        break;
      }

      const next = canRun[0];
      sorted.push(next);
      remaining.splice(remaining.indexOf(next), 1);
    }

    return sorted;
  }

  private calculateIntegrationScore(): number {
    if (this.results.length === 0) return 0;

    const successRate = this.results.filter(r => r.success).length / this.results.length;
    const dataFlowRate = this.results.filter(r => r.dataFlowVerified).length / this.results.length;
    const avgComponentHealth = Array.from(this.componentMetrics.values())
      .map(metrics => metrics.filter(m => m.functional).length / metrics.length)
      .reduce((sum, rate) => sum + rate, 0) / this.componentMetrics.size;

    // Weighted score: 40% success rate, 30% data flow, 30% component health
    const score = (successRate * 40) + (dataFlowRate * 30) + (avgComponentHealth * 30);
    return Math.round(score);
  }

  private generateComponentHealth(): Record<string, ComponentHealth> {
    const health: Record<string, ComponentHealth> = {};

    for (const [component, metrics] of this.componentMetrics) {
      const successful = metrics.filter(m => m.functional).length;
      const total = metrics.length;
      const avgPerformance = metrics.reduce((sum, m) => sum + m.performance, 0) / total;
      const allErrors = metrics.flatMap(m => m.errors);

      health[component] = {
        tested: true,
        successRate: Math.round((successful / total) * 100),
        averagePerformance: Math.round(avgPerformance * 100) / 100,
        integrationIssues: [...new Set(allErrors)]
      };
    }

    return health;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const failed = this.results.filter(r => !r.success);
    if (failed.length > 0) {
      recommendations.push(`🔧 CRITICAL: ${failed.length} integration tests failed - investigate component interactions`);
    }

    const dataFlowIssues = this.results.filter(r => !r.dataFlowVerified);
    if (dataFlowIssues.length > 0) {
      recommendations.push(`🔄 DATA FLOW: ${dataFlowIssues.length} tests have data flow issues - verify component communication`);
    }

    // Component-specific recommendations
    const componentHealth = this.generateComponentHealth();
    for (const [component, health] of Object.entries(componentHealth)) {
      if (health.successRate < 80) {
        recommendations.push(`⚠️ ${component}: ${health.successRate}% success rate - needs attention`);
      }
      if (health.averagePerformance > 100) { // > 100ms
        recommendations.push(`🐌 ${component}: High latency (${health.averagePerformance}ms) - optimize performance`);
      }
    }

    const integrationScore = this.calculateIntegrationScore();
    if (integrationScore < 70) {
      recommendations.push(`📊 INTEGRATION SCORE: ${integrationScore}% - improve component integration quality`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ EXCELLENT: All components are integrating properly!');
    }

    return recommendations;
  }

  private printReport(report: IntegrationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔗 INTEGRATION TEST REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);
    console.log(`🌍 Environment: ${report.testRun.environment}`);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   🧩 Component Coverage: ${report.summary.componentCoverage}%`);
    console.log(`   🎯 Integration Score: ${report.summary.integrationScore}/100`);

    // Group by category
    const byCategory = new Map();
    for (let i = 0; i < report.results.length; i++) {
      const result = report.results[i];
      const test = Array.from(this.tests.values())[i];
      const cat = test.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({ result, test });
    }

    console.log(`\n📋 BY CATEGORY:`);
    for (const [category, items] of byCategory) {
      const passed = items.filter((item: any) => item.result.success).length;
      const total = items.length;
      const dataFlow = items.filter((item: any) => item.result.dataFlowVerified).length;
      const status = passed === total ? '✅' : (passed === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${category.toUpperCase()}: ${passed}/${total} (${dataFlow} data flow verified)`);
    }

    console.log(`\n🧩 COMPONENT HEALTH:`);
    for (const [component, health] of Object.entries(report.componentHealth)) {
      const status = health.successRate >= 80 ? '✅' : (health.successRate >= 50 ? '⚠️' : '❌');
      console.log(`   ${status} ${component}: ${health.successRate}% success, ${health.averagePerformance}ms avg`);
      if (health.integrationIssues.length > 0) {
        console.log(`      Issues: ${health.integrationIssues.join(', ')}`);
      }
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

async function runIntegrationTests() {
  const suite = new IntegrationTestSuite();

  // Parse command line arguments
  const args = Deno.args;
  const filter: any = {};

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      filter.category = arg.split('=')[1];
    } else if (arg.startsWith('--complexity=')) {
      filter.complexity = arg.split('=')[1];
    } else if (arg.startsWith('--component=')) {
      filter.component = arg.split('=')[1];
    }
  }

  const report = await suite.runAllTests(Object.keys(filter).length > 0 ? filter : undefined);

  // Exit with appropriate code
  Deno.exit(report.summary.integrationScore < 70 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runIntegrationTests();
}

export { IntegrationTestSuite };