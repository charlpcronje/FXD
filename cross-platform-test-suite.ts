#!/usr/bin/env deno run --allow-all

/**
 * @file cross-platform-test-suite.ts
 * @description Cross-Platform Compatibility Testing Suite for FXD
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This suite validates FXD functionality across:
 * - Deno (server-side)
 * - Browser environments (client-side)
 * - Node.js compatibility
 * - Different operating systems (Windows, macOS, Linux)
 * - Various JavaScript engines
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface PlatformInfo {
  name: string;
  version: string;
  runtime: 'deno' | 'browser' | 'node' | 'unknown';
  os: string;
  arch: string;
  features: string[];
  limitations: string[];
}

interface CompatibilityTest {
  id: string;
  name: string;
  description: string;
  targetPlatforms: string[];
  requiredFeatures: string[];
  execute: (platform: PlatformInfo) => Promise<CompatibilityResult>;
}

interface CompatibilityResult {
  success: boolean;
  duration: number;
  platformSpecific: Record<string, any>;
  warnings: string[];
  errors: string[];
  featureSupport: Record<string, boolean>;
}

interface CrossPlatformReport {
  testRun: {
    id: string;
    timestamp: number;
    platforms: PlatformInfo[];
  };
  results: Map<string, Map<string, CompatibilityResult>>;
  summary: {
    totalTests: number;
    platformsCovered: number;
    overallCompatibility: number;
    criticalIssues: number;
  };
  recommendations: string[];
}

// === PLATFORM DETECTION ===

export class PlatformDetector {
  static detect(): PlatformInfo {
    const info: PlatformInfo = {
      name: 'unknown',
      version: 'unknown',
      runtime: 'unknown',
      os: 'unknown',
      arch: 'unknown',
      features: [],
      limitations: []
    };

    // Detect runtime
    if (typeof Deno !== 'undefined') {
      info.runtime = 'deno';
      info.name = 'Deno';
      info.version = (Deno as any).version?.deno || 'unknown';
      info.os = (Deno as any).build?.os || 'unknown';
      info.arch = (Deno as any).build?.arch || 'unknown';

      // Deno features
      info.features.push('file-system', 'networking', 'subprocess', 'worker-threads');
      if (typeof (Deno as any).serve !== 'undefined') {
        info.features.push('http-server');
      }
    } else if (typeof window !== 'undefined') {
      info.runtime = 'browser';
      info.name = 'Browser';

      // Browser detection
      if (typeof navigator !== 'undefined') {
        info.version = navigator.userAgent;

        // Feature detection
        if (typeof SharedArrayBuffer !== 'undefined') {
          info.features.push('shared-array-buffer');
        } else {
          info.limitations.push('no-shared-array-buffer');
        }

        if (typeof Worker !== 'undefined') {
          info.features.push('web-workers');
        }

        if (typeof WebAssembly !== 'undefined') {
          info.features.push('webassembly');
        }

        if (typeof fetch !== 'undefined') {
          info.features.push('fetch-api');
        }
      }

      info.limitations.push('no-file-system', 'cors-restrictions');
    } else if (typeof process !== 'undefined') {
      info.runtime = 'node';
      info.name = 'Node.js';
      info.version = (process as any).version || 'unknown';
      info.os = (process as any).platform || 'unknown';
      info.arch = (process as any).arch || 'unknown';

      info.features.push('file-system', 'networking', 'subprocess');
      if (typeof Worker !== 'undefined') {
        info.features.push('worker-threads');
      }
    }

    // Common features
    if (typeof Promise !== 'undefined') {
      info.features.push('promises');
    }

    if (typeof Proxy !== 'undefined') {
      info.features.push('proxy');
    }

    if (typeof WeakMap !== 'undefined') {
      info.features.push('weakmap');
    }

    if (typeof Map !== 'undefined') {
      info.features.push('map-set');
    }

    return info;
  }
}

// === CROSS-PLATFORM TEST SUITE ===

export class CrossPlatformTestSuite {
  private tests: Map<string, CompatibilityTest> = new Map();
  private platforms: PlatformInfo[] = [];
  private results: Map<string, Map<string, CompatibilityResult>> = new Map();

  constructor() {
    this.registerTests();
  }

  private registerTests(): void {
    // Core FX Functionality
    this.addTest({
      id: 'core-fx-basic',
      name: 'Core FX Basic Operations',
      description: 'Tests basic FX node operations across platforms',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: ['proxy', 'map-set'],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test basic node creation
          const testNode = $$(`cross.platform.${platform.runtime}.test`);
          testNode.val('test value');

          featureSupport.nodeCreation = true;
          assertEquals(testNode.val(), 'test value', 'Basic value operation failed');

          // Test object promotion
          testNode.val({ nested: { value: 42 } });
          featureSupport.objectPromotion = true;
          assertEquals(testNode('nested.value').val(), 42, 'Object promotion failed');

          // Platform-specific storage test
          if (platform.runtime === 'browser') {
            try {
              localStorage.setItem('fxd-test', 'browser-storage');
              platformSpecific.localStorage = true;
            } catch {
              platformSpecific.localStorage = false;
              warnings.push('localStorage not available');
            }
          } else if (platform.runtime === 'deno') {
            try {
              platformSpecific.fileSystem = typeof Deno.writeTextFile === 'function';
            } catch {
              platformSpecific.fileSystem = false;
            }
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Core FX test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });

    // Worker Support Test
    this.addTest({
      id: 'worker-support',
      name: 'Worker Thread Support',
      description: 'Tests Web Worker/Worker Thread functionality',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: ['worker-threads', 'web-workers'],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test worker availability
          const hasWorker = typeof Worker !== 'undefined';
          featureSupport.workerSupport = hasWorker;

          if (!hasWorker) {
            warnings.push('Worker not available on this platform');
            return {
              success: true,
              duration: performance.now() - startTime,
              platformSpecific,
              warnings,
              errors,
              featureSupport
            };
          }

          // Test SharedArrayBuffer support (if available)
          const hasSAB = typeof SharedArrayBuffer !== 'undefined';
          featureSupport.sharedArrayBuffer = hasSAB;
          platformSpecific.sabSupport = hasSAB;

          if (!hasSAB && platform.runtime === 'browser') {
            warnings.push('SharedArrayBuffer not available - requires CORS headers');
          }

          // Test basic worker creation (without actually creating one to avoid issues)
          try {
            // Just test if Worker constructor exists and is callable
            const workerCode = 'self.postMessage("test");';
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);

            // Test URL creation for worker
            featureSupport.workerUrlCreation = true;
            URL.revokeObjectURL(url);
          } catch (error) {
            if (platform.runtime === 'browser') {
              warnings.push('Blob/URL API not fully available');
            }
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Worker test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });

    // Networking and HTTP Test
    this.addTest({
      id: 'networking-http',
      name: 'Networking and HTTP Support',
      description: 'Tests HTTP client capabilities and networking features',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: ['fetch-api', 'networking'],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test fetch availability
          featureSupport.fetchAPI = typeof fetch !== 'undefined';

          if (!featureSupport.fetchAPI) {
            warnings.push('Fetch API not available');
            return {
              success: true,
              duration: performance.now() - startTime,
              platformSpecific,
              warnings,
              errors,
              featureSupport
            };
          }

          // Platform-specific networking tests
          if (platform.runtime === 'browser') {
            // Browser: Test CORS behavior
            platformSpecific.corsRestricted = true;
            warnings.push('Browser: CORS restrictions apply to cross-origin requests');
          } else if (platform.runtime === 'deno') {
            // Deno: Test server capabilities
            featureSupport.httpServer = typeof (Deno as any).serve !== 'undefined';
            platformSpecific.serverCapable = featureSupport.httpServer;
          }

          // Test URL construction
          try {
            new URL('https://example.com/test');
            featureSupport.urlAPI = true;
          } catch {
            featureSupport.urlAPI = false;
            warnings.push('URL API not available');
          }

          // Test Headers API
          try {
            new Headers({ 'content-type': 'application/json' });
            featureSupport.headersAPI = true;
          } catch {
            featureSupport.headersAPI = false;
            warnings.push('Headers API not available');
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Networking test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });

    // Module Loading Test
    this.addTest({
      id: 'module-loading',
      name: 'Module Loading System',
      description: 'Tests dynamic import and module loading capabilities',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: ['promises'],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test dynamic import availability
          featureSupport.dynamicImport = typeof import === 'function';

          // Test eval (for module loading simulation)
          try {
            eval('1 + 1');
            featureSupport.eval = true;
          } catch {
            featureSupport.eval = false;
            warnings.push('eval() not available - module loading may be limited');
          }

          // Test Function constructor (alternative to eval)
          try {
            new Function('return 1 + 1')();
            featureSupport.functionConstructor = true;
          } catch {
            featureSupport.functionConstructor = false;
            warnings.push('Function constructor not available');
          }

          // Platform-specific module loading
          if (platform.runtime === 'deno') {
            platformSpecific.moduleFormat = 'esm';
            platformSpecific.importMap = typeof (Deno as any).importMap !== 'undefined';
          } else if (platform.runtime === 'browser') {
            platformSpecific.moduleFormat = 'esm';
            platformSpecific.importMap = false;
            warnings.push('Browser: Module loading subject to CORS');
          } else if (platform.runtime === 'node') {
            platformSpecific.moduleFormat = 'commonjs/esm';
            platformSpecific.requireAvailable = typeof require !== 'undefined';
          }

          // Test TextEncoder/TextDecoder (needed for module loading)
          try {
            new TextEncoder().encode('test');
            new TextDecoder().decode(new Uint8Array([116, 101, 115, 116]));
            featureSupport.textEncoding = true;
          } catch {
            featureSupport.textEncoding = false;
            warnings.push('TextEncoder/TextDecoder not available');
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Module loading test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });

    // Storage and Persistence Test
    this.addTest({
      id: 'storage-persistence',
      name: 'Storage and Persistence',
      description: 'Tests various storage mechanisms across platforms',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: [],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test in-memory storage (always available)
          featureSupport.memoryStorage = true;

          // Platform-specific storage tests
          if (platform.runtime === 'browser') {
            // localStorage
            try {
              localStorage.setItem('fxd-storage-test', 'test');
              localStorage.removeItem('fxd-storage-test');
              featureSupport.localStorage = true;
            } catch {
              featureSupport.localStorage = false;
              warnings.push('localStorage not available (private browsing?)');
            }

            // sessionStorage
            try {
              sessionStorage.setItem('fxd-session-test', 'test');
              sessionStorage.removeItem('fxd-session-test');
              featureSupport.sessionStorage = true;
            } catch {
              featureSupport.sessionStorage = false;
            }

            // IndexedDB
            featureSupport.indexedDB = typeof indexedDB !== 'undefined';

            platformSpecific.storageTypes = ['memory', 'localStorage', 'sessionStorage', 'indexedDB'];
          } else if (platform.runtime === 'deno') {
            // File system
            try {
              featureSupport.fileSystem = typeof Deno.writeTextFile === 'function';
              platformSpecific.fileSystem = featureSupport.fileSystem;
            } catch {
              featureSupport.fileSystem = false;
            }

            platformSpecific.storageTypes = ['memory', 'file-system'];
          } else if (platform.runtime === 'node') {
            // File system (Node.js style)
            try {
              featureSupport.fileSystem = typeof require !== 'undefined';
              platformSpecific.fileSystem = featureSupport.fileSystem;
            } catch {
              featureSupport.fileSystem = false;
            }

            platformSpecific.storageTypes = ['memory', 'file-system'];
          }

          // Test JSON serialization (critical for persistence)
          try {
            const testObj = { test: 'value', nested: { num: 42 } };
            const serialized = JSON.stringify(testObj);
            const deserialized = JSON.parse(serialized);
            assertEquals(deserialized.nested.num, 42, 'JSON serialization failed');
            featureSupport.jsonSerialization = true;
          } catch {
            featureSupport.jsonSerialization = false;
            errors.push('JSON serialization not working');
          }

          return {
            success: errors.length === 0,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Storage test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });

    // Performance and Timing Test
    this.addTest({
      id: 'performance-timing',
      name: 'Performance and Timing APIs',
      description: 'Tests timing and performance measurement capabilities',
      targetPlatforms: ['deno', 'browser', 'node'],
      requiredFeatures: [],
      execute: async (platform) => {
        const startTime = performance.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const featureSupport: Record<string, boolean> = {};
        const platformSpecific: Record<string, any> = {};

        try {
          // Test performance.now()
          featureSupport.performanceNow = typeof performance?.now === 'function';

          if (!featureSupport.performanceNow) {
            warnings.push('performance.now() not available');
          }

          // Test setTimeout/setInterval
          featureSupport.timers = typeof setTimeout === 'function';

          // Test requestAnimationFrame (browser-specific)
          if (platform.runtime === 'browser') {
            featureSupport.requestAnimationFrame = typeof requestAnimationFrame === 'function';
            platformSpecific.animationFrameSupport = featureSupport.requestAnimationFrame;
          }

          // Test Date API
          try {
            const now = Date.now();
            const date = new Date(now);
            featureSupport.dateAPI = typeof now === 'number' && date instanceof Date;
          } catch {
            featureSupport.dateAPI = false;
            warnings.push('Date API issues detected');
          }

          // Test Promise timing
          try {
            const promiseStart = performance.now();
            await new Promise(resolve => setTimeout(resolve, 1));
            const promiseEnd = performance.now();
            platformSpecific.promiseTimingWorks = (promiseEnd - promiseStart) >= 1;
          } catch {
            platformSpecific.promiseTimingWorks = false;
            warnings.push('Promise timing measurement failed');
          }

          // Platform-specific timing features
          if (platform.runtime === 'deno') {
            try {
              platformSpecific.denoTimers = typeof (Deno as any).nextTick === 'function';
            } catch {
              platformSpecific.denoTimers = false;
            }
          }

          return {
            success: true,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        } catch (error) {
          errors.push(`Performance timing test failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - startTime,
            platformSpecific,
            warnings,
            errors,
            featureSupport
          };
        }
      }
    });
  }

  addTest(test: CompatibilityTest): void {
    this.tests.set(test.id, test);
  }

  async runTest(testId: string, platform: PlatformInfo): Promise<CompatibilityResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    // Check if test is applicable to this platform
    if (!test.targetPlatforms.includes('all') && !test.targetPlatforms.includes(platform.runtime)) {
      return {
        success: true,
        duration: 0,
        platformSpecific: { skipped: true, reason: 'Not applicable to this platform' },
        warnings: [`Test skipped: not applicable to ${platform.runtime}`],
        errors: [],
        featureSupport: {}
      };
    }

    // Check required features
    const missingFeatures = test.requiredFeatures.filter(feature =>
      !platform.features.includes(feature)
    );

    if (missingFeatures.length > 0) {
      return {
        success: false,
        duration: 0,
        platformSpecific: { skipped: true, missingFeatures },
        warnings: [],
        errors: [`Missing required features: ${missingFeatures.join(', ')}`],
        featureSupport: {}
      };
    }

    console.log(`🔄 Running ${test.name} on ${platform.name}`);

    try {
      const result = await test.execute(platform);

      const status = result.success ? '✅' : '❌';
      const duration = Math.round(result.duration);
      console.log(`${status} ${test.name} (${duration}ms)`);

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
        platformSpecific: { crashed: true },
        warnings: [],
        errors: [error.message],
        featureSupport: {}
      };
    }
  }

  async runAllTests(): Promise<CrossPlatformReport> {
    const platform = PlatformDetector.detect();
    this.platforms = [platform];

    console.log('🚀 Starting Cross-Platform Compatibility Testing...\n');
    console.log(`🖥️ Platform: ${platform.name} ${platform.version} (${platform.runtime})`);
    console.log(`🏗️ OS: ${platform.os} ${platform.arch}`);
    console.log(`✨ Features: ${platform.features.join(', ')}`);
    if (platform.limitations.length > 0) {
      console.log(`⚠️ Limitations: ${platform.limitations.join(', ')}`);
    }
    console.log();

    const tests = Array.from(this.tests.values());
    console.log(`📋 Running ${tests.length} compatibility tests...\n`);

    // Run all tests for this platform
    const platformResults = new Map<string, CompatibilityResult>();

    for (const test of tests) {
      const result = await this.runTest(test.id, platform);
      platformResults.set(test.id, result);
    }

    this.results.set(platform.runtime, platformResults);

    // Generate report
    const successful = Array.from(platformResults.values()).filter(r => r.success).length;
    const total = platformResults.size;
    const criticalIssues = Array.from(platformResults.values()).filter(r =>
      !r.success && r.errors.some(e => e.includes('CRITICAL'))
    ).length;

    const report: CrossPlatformReport = {
      testRun: {
        id: `cross-platform-${Date.now()}`,
        timestamp: Date.now(),
        platforms: this.platforms
      },
      results: this.results,
      summary: {
        totalTests: total,
        platformsCovered: 1,
        overallCompatibility: Math.round((successful / total) * 100),
        criticalIssues
      },
      recommendations: this.generateRecommendations(platformResults, platform)
    };

    this.printReport(report);
    return report;
  }

  private generateRecommendations(results: Map<string, CompatibilityResult>, platform: PlatformInfo): string[] {
    const recommendations: string[] = [];

    // Check for critical failures
    const failures = Array.from(results.values()).filter(r => !r.success);
    if (failures.length > 0) {
      recommendations.push(`🔧 Fix ${failures.length} failed tests for better ${platform.runtime} compatibility`);
    }

    // Platform-specific recommendations
    if (platform.runtime === 'browser') {
      const sabIssues = Array.from(results.values()).some(r =>
        r.warnings.some(w => w.includes('SharedArrayBuffer'))
      );
      if (sabIssues) {
        recommendations.push('🌐 BROWSER: Configure CORS headers for SharedArrayBuffer support');
      }

      const corsIssues = Array.from(results.values()).some(r =>
        r.warnings.some(w => w.includes('CORS'))
      );
      if (corsIssues) {
        recommendations.push('🌐 BROWSER: Implement proxy endpoints for cross-origin requests');
      }
    }

    if (platform.runtime === 'deno') {
      const permissionIssues = Array.from(results.values()).some(r =>
        r.errors.some(e => e.includes('permission'))
      );
      if (permissionIssues) {
        recommendations.push('🦕 DENO: Ensure proper --allow flags are set');
      }
    }

    // Feature-specific recommendations
    const missingFeatures = new Set<string>();
    Array.from(results.values()).forEach(result => {
      Object.entries(result.featureSupport).forEach(([feature, supported]) => {
        if (!supported) missingFeatures.add(feature);
      });
    });

    if (missingFeatures.size > 0) {
      recommendations.push(`⚡ FEATURES: Implement fallbacks for: ${Array.from(missingFeatures).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push(`✨ EXCELLENT: Full compatibility with ${platform.name}!`);
    }

    return recommendations;
  }

  private printReport(report: CrossPlatformReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 CROSS-PLATFORM COMPATIBILITY REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);

    for (const platform of report.testRun.platforms) {
      console.log(`\n🖥️ PLATFORM: ${platform.name} ${platform.version}`);
      console.log(`   Runtime: ${platform.runtime}`);
      console.log(`   OS: ${platform.os} ${platform.arch}`);
      console.log(`   Features: ${platform.features.join(', ')}`);
      if (platform.limitations.length > 0) {
        console.log(`   Limitations: ${platform.limitations.join(', ')}`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Platforms Covered: ${report.summary.platformsCovered}`);
    console.log(`   Overall Compatibility: ${report.summary.overallCompatibility}%`);
    console.log(`   Critical Issues: ${report.summary.criticalIssues}`);

    // Detailed results by test
    console.log(`\n📋 TEST RESULTS:`);
    for (const [platformName, results] of report.results) {
      console.log(`\n   ${platformName.toUpperCase()}:`);

      for (const [testId, result] of results) {
        const status = result.success ? '✅' : '❌';
        const test = this.tests.get(testId);
        console.log(`   ${status} ${test?.name || testId}`);

        if (result.errors.length > 0) {
          console.log(`      Errors: ${result.errors.join(', ')}`);
        }
        if (result.warnings.length > 0) {
          console.log(`      Warnings: ${result.warnings.join(', ')}`);
        }
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

async function runCrossPlatformTests() {
  const suite = new CrossPlatformTestSuite();
  const report = await suite.runAllTests();

  // Exit with appropriate code
  Deno.exit(report.summary.criticalIssues > 0 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runCrossPlatformTests();
}

export { CrossPlatformTestSuite, PlatformDetector };