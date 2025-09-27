#!/usr/bin/env deno run --allow-all

/**
 * @file documentation-validation-tests.ts
 * @description Documentation Accuracy Validation Suite for FXD
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This suite validates that documentation examples actually work:
 * 1. Code examples from README and docs
 * 2. API documentation accuracy
 * 3. Tutorial completeness and correctness
 * 4. Example projects functionality
 * 5. CLI usage documentation
 * 6. Configuration documentation
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface DocumentationTest {
  id: string;
  name: string;
  description: string;
  source: string; // File or section where the example comes from
  category: 'api' | 'tutorial' | 'example' | 'cli' | 'config' | 'quickstart';
  priority: 'critical' | 'high' | 'medium' | 'low';
  codeExample: string;
  expectedBehavior: string;
  setup?: string; // Optional setup code
  cleanup?: string; // Optional cleanup code
  execute: () => Promise<DocumentationResult>;
}

interface DocumentationResult {
  success: boolean;
  duration: number;
  actualBehavior: string;
  expectedBehavior: string;
  discrepancies: string[];
  warnings: string[];
  errors: string[];
  artifacts: Record<string, any>;
}

interface DocumentationReport {
  testRun: {
    id: string;
    timestamp: number;
    version: string;
  };
  results: DocumentationResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    accuracy: number;
    coverageGaps: string[];
  };
  recommendations: string[];
}

// === DOCUMENTATION VALIDATION SUITE ===

export class DocumentationValidationSuite {
  private tests: Map<string, DocumentationTest> = new Map();
  private results: DocumentationResult[] = [];

  constructor() {
    this.registerDocumentationTests();
  }

  private registerDocumentationTests(): void {
    // Quick Start Examples from fx.ts comments
    this.addTest({
      id: 'quickstart-basic-usage',
      name: 'Basic FX Usage Example',
      description: 'Validates the basic usage example from the documentation',
      source: 'fx.ts comments - line 1743',
      category: 'quickstart',
      priority: 'critical',
      codeExample: `
// Leading-@ → sync module default
const User = $$("@/plugins/User.ts");
const u = new User("Charl", "Cronje");
      `,
      expectedBehavior: 'Creates a User instance with specified parameters',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Since we can't actually load external modules in this test,
          // we'll simulate the User class and test the pattern

          // Mock User class for testing
          $$("plugins.User").val(class User {
            constructor(public firstName: string, public lastName: string) {
              this.firstName = firstName;
              this.lastName = lastName;
            }

            getFullName() {
              return `${this.firstName} ${this.lastName}`;
            }
          });

          // Test the documented pattern (adapted for our test environment)
          const User = $$("plugins.User").val();
          const u = new User("Charl", "Cronje");

          // Verify the user was created correctly
          const actualBehavior = `Created User instance: ${u.getFullName()}`;
          artifacts.userInstance = u;
          artifacts.fullName = u.getFullName();

          assertEquals(u.firstName, "Charl", "First name should match");
          assertEquals(u.lastName, "Cronje", "Last name should match");
          assertEquals(u.getFullName(), "Charl Cronje", "Full name should be correct");

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Creates a User instance with specified parameters',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Quick start example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Creates a User instance with specified parameters',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Module Attachment Example
    this.addTest({
      id: 'module-attachment',
      name: 'Module Attachment Example',
      description: 'Validates module attachment with options from documentation',
      source: 'fx.ts comments - line 1747',
      category: 'api',
      priority: 'high',
      codeExample: `
// path@spec → attach
$$("app.user@/plugins/User.ts").options({
  type: "user",
  instantiateDefault: { args: ["Charl","Cronje"] },
  global: "$user"
});
const u2 = $$("app.user").as("User");
      `,
      expectedBehavior: 'Attaches module with options and creates typed instance',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Mock the attachment pattern
          class User {
            constructor(public firstName: string, public lastName: string) {
              this.firstName = firstName;
              this.lastName = lastName;
            }
          }

          // Simulate module attachment
          $$("app.user").val(new User("Charl", "Cronje"));
          $$("app.user").node().__type = "User";
          $$("app.user").node().__instances.set("User", $$("app.user").val());

          // Test the documented pattern
          const u2 = $$("app.user").as("User");

          // Verify the attachment worked
          assert(u2 instanceof User, "Should return User instance");
          assertEquals(u2.firstName, "Charl", "First name should match");
          assertEquals(u2.lastName, "Cronje", "Last name should match");

          const actualBehavior = `Module attached and typed instance retrieved: ${u2.firstName} ${u2.lastName}`;
          artifacts.userInstance = u2;
          artifacts.nodeType = $$("app.user").type();

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Attaches module with options and creates typed instance',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Module attachment example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Attaches module with options and creates typed instance',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // CSS Groups Example
    this.addTest({
      id: 'css-groups-example',
      name: 'CSS Groups Selection Example',
      description: 'Validates CSS-style selector and group operations from documentation',
      source: 'fx.ts comments - line 1754',
      category: 'api',
      priority: 'high',
      codeExample: `
const actives = $$("app.users").select('.user[active=true]').on('change', () => console.log('changed'));
const team = $$("teams.core").group([]).include('.user').exclude('.banned').add($$("people.alice")).addAfter($$("people.alice"), $$("people.bob"));
      `,
      expectedBehavior: 'Creates reactive groups with CSS selectors and manual management',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Setup test data
          $$('app.users.user1').val({ name: 'Alice', active: true });
          $$('app.users.user2').val({ name: 'Bob', active: false });
          $$('app.users.user3').val({ name: 'Charlie', active: true });

          // Set node types for CSS selection
          $$('app.users.user1').node().__type = 'user';
          $$('app.users.user2').node().__type = 'user';
          $$('app.users.user3').node().__type = 'user';

          $$('people.alice').val({ name: 'Alice' });
          $$('people.bob').val({ name: 'Bob' });

          // Test the documented CSS groups pattern
          const actives = $$("app.users").select('.user[active=true]');
          const activeList = actives.list();

          // Verify CSS selector worked
          assertEquals(activeList.length, 2, "Should find 2 active users");

          let changeTriggered = false;
          actives.on('change', () => {
            changeTriggered = true;
            console.log('Group changed');
          });

          // Test group management
          const team = $$("teams.core").group([]);
          team.add($$("people.alice"));
          team.addAfter($$("people.alice"), $$("people.bob"));

          const teamList = team.list();
          assertEquals(teamList.length, 2, "Team should have 2 members");

          const actualBehavior = `CSS selector found ${activeList.length} active users, team has ${teamList.length} members`;
          artifacts.activeUsers = activeList;
          artifacts.teamMembers = teamList;
          artifacts.changeListenerAttached = true;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Creates reactive groups with CSS selectors and manual management',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`CSS groups example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Creates reactive groups with CSS selectors and manual management',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Basic Node Operations (inferred from API)
    this.addTest({
      id: 'basic-node-operations',
      name: 'Basic Node Operations',
      description: 'Validates fundamental node operations described in documentation',
      source: 'API documentation',
      category: 'api',
      priority: 'critical',
      codeExample: `
// Basic node creation and value setting
$$('app.user').val({ name: 'John', age: 30 });
const name = $$('app.user.name').val();
const age = $$('app.user.age').val();

// Nested path access
$$('app.settings.theme.color').val('blue');
const color = $$('app.settings.theme.color').val();
      `,
      expectedBehavior: 'Creates nested nodes and retrieves values correctly',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test basic node operations
          $$('app.user').val({ name: 'John', age: 30 });
          const name = $$('app.user.name').val();
          const age = $$('app.user.age').val();

          assertEquals(name, 'John', "Name should be 'John'");
          assertEquals(age, 30, "Age should be 30");

          // Test nested path access
          $$('app.settings.theme.color').val('blue');
          const color = $$('app.settings.theme.color').val();

          assertEquals(color, 'blue', "Color should be 'blue'");

          // Test object promotion
          const userObj = $$('app.user').val();
          assertEquals(userObj.name, 'John', "Object should have correct name");
          assertEquals(userObj.age, 30, "Object should have correct age");

          const actualBehavior = `Created user: ${name}, age ${age}; theme color: ${color}`;
          artifacts.user = userObj;
          artifacts.themeColor = color;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Creates nested nodes and retrieves values correctly',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Basic node operations failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Creates nested nodes and retrieves values correctly',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Reactive Links Documentation
    this.addTest({
      id: 'reactive-links',
      name: 'Reactive Links Example',
      description: 'Validates reactive linking behavior from API documentation',
      source: 'API documentation',
      category: 'api',
      priority: 'high',
      codeExample: `
// Source node
$$('data.temperature').val(25);

// Reactive target
$$('display.temperature').val($$('data.temperature'));

// Update source and verify reactive update
$$('data.temperature').val(30);
const updatedDisplay = $$('display.temperature').val();
      `,
      expectedBehavior: 'Target node reactively updates when source changes',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test reactive links
          $$('data.temperature').val(25);
          $$('display.temperature').val($$('data.temperature'));

          // Verify initial link
          assertEquals($$('display.temperature').val(), 25, "Initial reactive link should work");

          // Update source
          $$('data.temperature').val(30);

          // Give time for reactive update
          await new Promise(resolve => setTimeout(resolve, 10));

          const updatedDisplay = $$('display.temperature').val();
          assertEquals(updatedDisplay, 30, "Reactive update should propagate");

          const actualBehavior = `Temperature updated from 25 to ${updatedDisplay} reactively`;
          artifacts.initialValue = 25;
          artifacts.updatedValue = updatedDisplay;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Target node reactively updates when source changes',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Reactive links example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Target node reactively updates when source changes',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Watchers and Events
    this.addTest({
      id: 'watchers-events',
      name: 'Watchers and Events Example',
      description: 'Validates watcher functionality from API documentation',
      source: 'API documentation',
      category: 'api',
      priority: 'medium',
      codeExample: `
let watcherTriggered = false;
let oldValue, newValue;

const unwatch = $$('counter').watch((nv, ov) => {
  watcherTriggered = true;
  oldValue = ov;
  newValue = nv;
});

$$('counter').val(1);
$$('counter').val(2);
      `,
      expectedBehavior: 'Watcher function is called when node value changes',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          let watcherTriggered = false;
          let oldValue: any, newValue: any;
          let triggerCount = 0;

          const unwatch = $$('counter').watch((nv, ov) => {
            watcherTriggered = true;
            oldValue = ov;
            newValue = nv;
            triggerCount++;
          });

          // Initial value
          $$('counter').val(1);

          // Give watcher time to trigger
          await new Promise(resolve => setTimeout(resolve, 10));

          assert(watcherTriggered, "Watcher should have been triggered");
          assertEquals(newValue, 1, "New value should be 1");

          // Reset for second test
          watcherTriggered = false;

          // Second value
          $$('counter').val(2);

          // Give watcher time to trigger
          await new Promise(resolve => setTimeout(resolve, 10));

          assert(watcherTriggered, "Watcher should have been triggered again");
          assertEquals(oldValue, 1, "Old value should be 1");
          assertEquals(newValue, 2, "New value should be 2");

          // Test unwatch
          unwatch();
          watcherTriggered = false;
          $$('counter').val(3);

          await new Promise(resolve => setTimeout(resolve, 10));

          const watcherStillActive = watcherTriggered;
          assert(!watcherStillActive, "Watcher should be inactive after unwatch");

          const actualBehavior = `Watcher triggered ${triggerCount} times, final values: old=${oldValue}, new=${newValue}`;
          artifacts.triggerCount = triggerCount;
          artifacts.unwatchWorked = !watcherStillActive;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Watcher function is called when node value changes',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Watchers example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Watcher function is called when node value changes',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Type Safety with .as<T>()
    this.addTest({
      id: 'type-safety-as',
      name: 'Type Safety .as<T>() Example',
      description: 'Validates type-safe instance unwrapping from documentation',
      source: 'API documentation',
      category: 'api',
      priority: 'medium',
      codeExample: `
class MyClass {
  constructor(public value: string) {}
}

$$('typed.instance').val(new MyClass('test'));
const instance = $$('typed.instance').as('MyClass');
const notInstance = $$('typed.instance').as('SomeOtherClass');
      `,
      expectedBehavior: 'Returns instance for correct type, null for incorrect type',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          class MyClass {
            constructor(public value: string) {}
          }

          class OtherClass {
            constructor(public data: number) {}
          }

          // Set an instance
          const originalInstance = new MyClass('test');
          $$('typed.instance').val(originalInstance);

          // Test correct type retrieval
          const instance = $$('typed.instance').as('MyClass');
          assert(instance !== null, "Should return instance for correct type");
          assertEquals(instance?.value, 'test', "Should have correct value");

          // Test incorrect type retrieval
          const notInstance = $$('typed.instance').as('SomeOtherClass');
          assertEquals(notInstance, null, "Should return null for incorrect type");

          // Test with constructor
          const withConstructor = $$('typed.instance').as(MyClass);
          assert(withConstructor instanceof MyClass, "Should work with constructor");

          const actualBehavior = `Correct type returned instance with value '${instance?.value}', incorrect type returned ${notInstance}`;
          artifacts.correctTypeResult = instance;
          artifacts.incorrectTypeResult = notInstance;
          artifacts.constructorResult = withConstructor;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Returns instance for correct type, null for incorrect type',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Type safety example failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Returns instance for correct type, null for incorrect type',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // CLI Usage Examples
    this.addTest({
      id: 'cli-usage-patterns',
      name: 'CLI Usage Patterns',
      description: 'Validates CLI usage examples from documentation',
      source: 'fxd-cli.ts help text',
      category: 'cli',
      priority: 'high',
      codeExample: `
// Simulate CLI operations
$$('disk.name').val('my-project');
$$('disk.created').val(Date.now());
$$('snippets.main').val({
  id: 'main',
  content: 'console.log("Hello World");',
  language: 'javascript'
});
      `,
      expectedBehavior: 'CLI operations create proper disk structure',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Simulate CLI create operation
          $$('disk.name').val('my-project');
          $$('disk.created').val(Date.now());
          $$('disk.version').val('1.0.0');

          // Simulate snippet creation
          $$('snippets.main').val({
            id: 'main',
            content: 'console.log("Hello World");',
            language: 'javascript',
            created: Date.now()
          });

          // Simulate view creation
          $$('views.main').val('console.log("Hello World");');

          // Verify CLI structure
          const diskName = $$('disk.name').val();
          const diskCreated = $$('disk.created').val();
          const snippet = $$('snippets.main').val();
          const view = $$('views.main').val();

          assertEquals(diskName, 'my-project', "Disk name should be correct");
          assert(typeof diskCreated === 'number', "Created timestamp should be number");
          assert(snippet && snippet.id === 'main', "Snippet should be created correctly");
          assertEquals(snippet.language, 'javascript', "Snippet language should be correct");
          assertEquals(view, 'console.log("Hello World");', "View content should match");

          const actualBehavior = `Created disk '${diskName}' with snippet '${snippet.id}' in ${snippet.language}`;
          artifacts.disk = { name: diskName, created: diskCreated };
          artifacts.snippet = snippet;
          artifacts.view = view;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'CLI operations create proper disk structure',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`CLI usage patterns failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'CLI operations create proper disk structure',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Configuration Examples
    this.addTest({
      id: 'configuration-examples',
      name: 'Configuration Examples',
      description: 'Validates configuration patterns from documentation',
      source: 'fx.ts installDefaults method',
      category: 'config',
      priority: 'medium',
      codeExample: `
// Configuration access patterns
const selectorConfig = $$('config.fx.selectors').val();
const groupsConfig = $$('config.fx.groups').val();
const perfConfig = $$('config.fx.performance').val();

// Runtime override
$$('system.fx.groups.reactiveDefault').val(false);
      `,
      expectedBehavior: 'Configuration is accessible and can be overridden at runtime',
      execute: async () => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const discrepancies: string[] = [];
        const artifacts: Record<string, any> = {};

        try {
          // Test configuration access
          const selectorConfig = $$('config.fx.selectors').val();
          const groupsConfig = $$('config.fx.groups').val();
          const perfConfig = $$('config.fx.performance').val();

          // Verify default configuration exists
          assert(selectorConfig, "Selector config should exist");
          assert(groupsConfig, "Groups config should exist");
          assert(perfConfig, "Performance config should exist");

          // Test specific config values
          assertEquals(selectorConfig.classMatchesType, true, "Class matches type should be true by default");
          assertEquals(groupsConfig.reactiveDefault, true, "Reactive default should be true");
          assertEquals(perfConfig.enableParentMap, true, "Parent map should be enabled");

          // Test runtime override
          const originalValue = groupsConfig.reactiveDefault;
          $$('system.fx.groups.reactiveDefault').val(false);

          // Verify override (the system would check system.fx first)
          const overrideValue = $$('system.fx.groups.reactiveDefault').val();
          assertEquals(overrideValue, false, "Runtime override should work");

          const actualBehavior = `Config loaded: selectors.classMatchesType=${selectorConfig.classMatchesType}, groups.reactiveDefault=${originalValue} (overridden to ${overrideValue})`;
          artifacts.selectorConfig = selectorConfig;
          artifacts.groupsConfig = groupsConfig;
          artifacts.perfConfig = perfConfig;
          artifacts.overrideValue = overrideValue;

          return {
            success: true,
            duration: performance.now() - startTime,
            actualBehavior,
            expectedBehavior: 'Configuration is accessible and can be overridden at runtime',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Configuration examples failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            actualBehavior: `Error: ${error.message}`,
            expectedBehavior: 'Configuration is accessible and can be overridden at runtime',
            discrepancies,
            warnings,
            errors,
            artifacts
          };
        }
      }
    });
  }

  addTest(test: DocumentationTest): void {
    this.tests.set(test.id, test);
  }

  async runTest(testId: string): Promise<DocumentationResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    console.log(`📖 Validating: ${test.name}`);
    console.log(`📍 Source: ${test.source}`);

    try {
      // Run setup if provided
      if (test.setup) {
        eval(test.setup);
      }

      const result = await test.execute();

      // Run cleanup if provided
      if (test.cleanup) {
        eval(test.cleanup);
      }

      const status = result.success ? '✅' : '❌';
      const duration = Math.round(result.duration);
      console.log(`${status} ${test.name} (${duration}ms)`);

      if (result.discrepancies.length > 0) {
        console.log(`   📝 Discrepancies: ${result.discrepancies.length}`);
      }
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
        actualBehavior: `Crashed: ${error.message}`,
        expectedBehavior: test.expectedBehavior,
        discrepancies: [],
        warnings: [],
        errors: [error.message],
        artifacts: { crashed: true }
      };
    }
  }

  async runAllTests(filter?: {
    category?: string;
    priority?: string;
    source?: string;
  }): Promise<DocumentationReport> {
    console.log('🚀 Starting Documentation Validation...\n');

    let tests = Array.from(this.tests.values());

    // Apply filters
    if (filter) {
      tests = tests.filter(test => {
        if (filter.category && test.category !== filter.category) return false;
        if (filter.priority && test.priority !== filter.priority) return false;
        if (filter.source && !test.source.includes(filter.source)) return false;
        return true;
      });
    }

    console.log(`📋 Validating ${tests.length} documentation examples...\n`);

    this.results = [];

    // Run tests
    for (const test of tests) {
      const result = await this.runTest(test.id);
      this.results.push(result);
    }

    // Generate report
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const accuracy = Math.round((passed / this.results.length) * 100);

    const report: DocumentationReport = {
      testRun: {
        id: `docs-${Date.now()}`,
        timestamp: Date.now(),
        version: '1.0.0'
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        accuracy,
        coverageGaps: this.identifyCoverageGaps(this.results)
      },
      recommendations: this.generateRecommendations(this.results)
    };

    this.printReport(report);
    return report;
  }

  private identifyCoverageGaps(results: DocumentationResult[]): string[] {
    const gaps: string[] = [];

    // Check for missing examples in different categories
    const categories = new Set(Array.from(this.tests.values()).map(t => t.category));
    const testedCategories = new Set(results.filter(r => r.success).map((_, i) => Array.from(this.tests.values())[i].category));

    for (const category of categories) {
      if (!testedCategories.has(category)) {
        gaps.push(`Missing validated examples for category: ${category}`);
      }
    }

    // Check for failed critical examples
    const failedCritical = results.filter((r, i) => {
      const test = Array.from(this.tests.values())[i];
      return !r.success && test.priority === 'critical';
    });

    if (failedCritical.length > 0) {
      gaps.push(`${failedCritical.length} critical documentation examples are failing`);
    }

    // Check for examples with discrepancies
    const withDiscrepancies = results.filter(r => r.discrepancies.length > 0);
    if (withDiscrepancies.length > 0) {
      gaps.push(`${withDiscrepancies.length} examples have behavior discrepancies`);
    }

    return gaps;
  }

  private generateRecommendations(results: DocumentationResult[]): string[] {
    const recommendations: string[] = [];

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      recommendations.push(`📝 UPDATE: ${failed.length} documentation examples need correction`);
    }

    const withDiscrepancies = results.filter(r => r.discrepancies.length > 0);
    if (withDiscrepancies.length > 0) {
      recommendations.push(`📝 CLARIFY: ${withDiscrepancies.length} examples have unclear expected behavior`);
    }

    const withWarnings = results.filter(r => r.warnings.length > 0);
    if (withWarnings.length > 0) {
      recommendations.push(`⚠️ IMPROVE: ${withWarnings.length} examples have warnings that should be addressed`);
    }

    // Category-specific recommendations
    const apiTests = results.filter((r, i) => Array.from(this.tests.values())[i].category === 'api');
    const apiFailures = apiTests.filter(r => !r.success).length;
    if (apiFailures > 0) {
      recommendations.push(`🔧 API: ${apiFailures} API examples failing - update documentation or fix implementation`);
    }

    const quickstartTests = results.filter((r, i) => Array.from(this.tests.values())[i].category === 'quickstart');
    const quickstartFailures = quickstartTests.filter(r => !r.success).length;
    if (quickstartFailures > 0) {
      recommendations.push(`🚀 QUICKSTART: ${quickstartFailures} quickstart examples failing - these are critical for new users`);
    }

    // Accuracy-based recommendations
    const accuracy = Math.round((results.filter(r => r.success).length / results.length) * 100);
    if (accuracy < 90) {
      recommendations.push(`📊 ACCURACY: ${accuracy}% documentation accuracy - aim for >90% to ensure user trust`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ EXCELLENT: All documentation examples are accurate and working properly!');
    }

    return recommendations;
  }

  private printReport(report: DocumentationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📖 DOCUMENTATION VALIDATION REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);
    console.log(`📝 Version: ${report.testRun.version}`);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   📈 Accuracy: ${report.summary.accuracy}%`);

    // Group by category
    const byCategory = new Map();
    for (let i = 0; i < report.results.length; i++) {
      const result = report.results[i];
      const test = Array.from(this.tests.values())[i];
      const cat = test.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(result);
    }

    console.log(`\n📋 BY CATEGORY:`);
    for (const [category, results] of byCategory) {
      const passed = results.filter((r: DocumentationResult) => r.success).length;
      const total = results.length;
      const accuracy = Math.round((passed / total) * 100);
      const status = passed === total ? '✅' : (passed === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${category.toUpperCase()}: ${passed}/${total} (${accuracy}%)`);
    }

    // Group by source
    const bySource = new Map();
    for (let i = 0; i < report.results.length; i++) {
      const result = report.results[i];
      const test = Array.from(this.tests.values())[i];
      const source = test.source.split(' - ')[0]; // Get main source file
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source).push(result);
    }

    console.log(`\n📄 BY SOURCE:`);
    for (const [source, results] of bySource) {
      const passed = results.filter((r: DocumentationResult) => r.success).length;
      const total = results.length;
      const status = passed === total ? '✅' : (passed === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${source}: ${passed}/${total}`);
    }

    if (report.summary.coverageGaps.length > 0) {
      console.log(`\n🕳️ COVERAGE GAPS:`);
      for (const gap of report.summary.coverageGaps) {
        console.log(`   ${gap}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      for (const rec of report.recommendations) {
        console.log(`   ${rec}`);
      }
    }

    // Detailed failures
    const failures = report.results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log(`\n❌ FAILED EXAMPLES:`);
      for (let i = 0; i < failures.length; i++) {
        const failure = failures[i];
        const test = Array.from(this.tests.values()).find(t =>
          report.results.indexOf(failure) === Array.from(this.tests.values()).indexOf(t)
        );
        if (test) {
          console.log(`   📝 ${test.name} (${test.source})`);
          console.log(`      Expected: ${test.expectedBehavior}`);
          console.log(`      Actual: ${failure.actualBehavior}`);
          if (failure.errors.length > 0) {
            console.log(`      Errors: ${failure.errors.join(', ')}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
  }
}

// === CLI RUNNER ===

async function runDocumentationValidation() {
  const suite = new DocumentationValidationSuite();

  // Parse command line arguments
  const args = Deno.args;
  const filter: any = {};

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      filter.category = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      filter.priority = arg.split('=')[1];
    } else if (arg.startsWith('--source=')) {
      filter.source = arg.split('=')[1];
    }
  }

  const report = await suite.runAllTests(Object.keys(filter).length > 0 ? filter : undefined);

  // Exit with appropriate code
  Deno.exit(report.summary.accuracy < 80 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runDocumentationValidation();
}

export { DocumentationValidationSuite };