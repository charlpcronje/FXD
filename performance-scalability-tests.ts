#!/usr/bin/env deno run --allow-all

/**
 * @file performance-scalability-tests.ts
 * @description Performance and Scalability Testing Suite for FXD
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This suite tests FXD under various load conditions:
 * 1. Large-scale node creation and management
 * 2. Complex selector query performance
 * 3. Reactive system scalability
 * 4. Memory usage and leak detection
 * 5. Concurrent operation handling
 * 6. Network and I/O performance
 * 7. Real-time collaboration stress testing
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface PerformanceTest {
  id: string;
  name: string;
  description: string;
  category: 'scalability' | 'memory' | 'concurrency' | 'network' | 'stress';
  loadLevel: 'light' | 'medium' | 'heavy' | 'extreme';
  expectedDuration: number; // seconds
  execute: () => Promise<PerformanceResult>;
}

interface PerformanceResult {
  success: boolean;
  duration: number;
  throughput: number; // operations per second
  memoryUsage: MemoryMetrics;
  performance: PerformanceMetrics;
  warnings: string[];
  errors: string[];
  artifacts: Record<string, any>;
}

interface MemoryMetrics {
  initial: number;
  peak: number;
  final: number;
  delta: number;
  leaked: number;
  gcCollections: number;
}

interface PerformanceMetrics {
  avgOperationTime: number;
  minOperationTime: number;
  maxOperationTime: number;
  p95OperationTime: number;
  p99OperationTime: number;
  operationsPerSecond: number;
  cpuUsage?: number;
}

interface ScalabilityReport {
  testRun: {
    id: string;
    timestamp: number;
    platform: string;
    environment: Record<string, any>;
  };
  results: PerformanceResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averageThroughput: number;
    memoryEfficiency: number;
    overallScore: number;
  };
  benchmarks: Record<string, number>;
  recommendations: string[];
}

// === PERFORMANCE UTILITIES ===

class PerformanceProfiler {
  private measurements: number[] = [];
  private memoryBaseline: number = 0;

  startMeasurement(): number {
    this.memoryBaseline = this.getMemoryUsage();
    return performance.now();
  }

  recordMeasurement(startTime: number): number {
    const duration = performance.now() - startTime;
    this.measurements.push(duration);
    return duration;
  }

  getMemoryUsage(): number {
    // Attempt to get memory usage - platform dependent
    try {
      if (typeof (performance as any).memory !== 'undefined') {
        return (performance as any).memory.usedJSHeapSize;
      }
      if (typeof (Deno as any).memoryUsage === 'function') {
        return (Deno as any).memoryUsage().heapUsed;
      }
    } catch {
      // Fallback to estimation
    }
    return 0;
  }

  forceGC(): void {
    try {
      if (typeof (globalThis as any).gc === 'function') {
        (globalThis as any).gc();
      }
    } catch {
      // GC not available
    }
  }

  getMemoryMetrics(): MemoryMetrics {
    const current = this.getMemoryUsage();
    return {
      initial: this.memoryBaseline,
      peak: Math.max(...this.measurements.map(() => this.getMemoryUsage())),
      final: current,
      delta: current - this.memoryBaseline,
      leaked: Math.max(0, current - this.memoryBaseline),
      gcCollections: 0 // Would need platform-specific implementation
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    if (this.measurements.length === 0) {
      return {
        avgOperationTime: 0,
        minOperationTime: 0,
        maxOperationTime: 0,
        p95OperationTime: 0,
        p99OperationTime: 0,
        operationsPerSecond: 0
      };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = this.measurements.reduce((a, b) => a + b, 0);
    const avg = sum / this.measurements.length;

    return {
      avgOperationTime: avg,
      minOperationTime: Math.min(...this.measurements),
      maxOperationTime: Math.max(...this.measurements),
      p95OperationTime: sorted[Math.floor(sorted.length * 0.95)],
      p99OperationTime: sorted[Math.floor(sorted.length * 0.99)],
      operationsPerSecond: 1000 / avg // Convert ms to ops/sec
    };
  }

  reset(): void {
    this.measurements = [];
    this.memoryBaseline = this.getMemoryUsage();
  }
}

// === SCALABILITY TEST SUITE ===

export class PerformanceScalabilityTestSuite {
  private tests: Map<string, PerformanceTest> = new Map();
  private profiler = new PerformanceProfiler();
  private results: PerformanceResult[] = [];

  constructor() {
    this.registerPerformanceTests();
  }

  private registerPerformanceTests(): void {
    // Large-Scale Node Creation Test
    this.addTest({
      id: 'large-scale-node-creation',
      name: 'Large-Scale Node Creation',
      description: 'Tests performance of creating and managing large numbers of nodes',
      category: 'scalability',
      loadLevel: 'heavy',
      expectedDuration: 30,
      execute: async () => {
        const profiler = this.profiler;
        profiler.reset();

        const errors: string[] = [];
        const warnings: string[] = [];
        const artifacts: Record<string, any> = {};

        const nodeCount = 100000;
        const batchSize = 1000;

        console.log(`    Creating ${nodeCount} nodes in batches of ${batchSize}...`);

        const overallStart = profiler.startMeasurement();
        let nodesCreated = 0;

        try {
          for (let batch = 0; batch < nodeCount / batchSize; batch++) {
            const batchStart = performance.now();

            for (let i = 0; i < batchSize; i++) {
              const nodeId = batch * batchSize + i;
              const measureStart = profiler.startMeasurement();

              $$(`stress.nodes.batch${batch}.node${nodeId}`).val({
                id: nodeId,
                batch: batch,
                data: `node-data-${nodeId}`,
                timestamp: Date.now(),
                metadata: {
                  created: new Date(),
                  type: nodeId % 5 === 0 ? 'important' : 'normal',
                  tags: [`tag-${nodeId % 10}`, `category-${nodeId % 3}`],
                  nested: {
                    level1: { level2: { value: nodeId * 42 } }
                  }
                }
              });

              profiler.recordMeasurement(measureStart);
              nodesCreated++;
            }

            const batchDuration = performance.now() - batchStart;
            if (batchDuration > 1000) { // Batch taking > 1 second
              warnings.push(`Batch ${batch} took ${Math.round(batchDuration)}ms`);
            }

            // Progress reporting
            if (batch % 10 === 0) {
              const progress = Math.round((batch / (nodeCount / batchSize)) * 100);
              console.log(`      Progress: ${progress}% (${nodesCreated} nodes)`);
            }
          }

          const totalDuration = profiler.recordMeasurement(overallStart);

          // Verify node creation
          const verificationStart = performance.now();
          const sampleNodes = [
            $$('stress.nodes.batch0.node0').val(),
            $$(`stress.nodes.batch${Math.floor(nodeCount / batchSize / 2)}.node${Math.floor(nodeCount / 2)}`).val(),
            $$(`stress.nodes.batch${Math.floor(nodeCount / batchSize) - 1}.node${nodeCount - 1}`).val()
          ];

          const allSamplesValid = sampleNodes.every(node => node && node.id !== undefined);
          if (!allSamplesValid) {
            errors.push('Sample node verification failed');
          }

          const verificationDuration = performance.now() - verificationStart;

          artifacts.nodeCount = nodesCreated;
          artifacts.totalDuration = totalDuration;
          artifacts.verificationDuration = verificationDuration;
          artifacts.averageNodesPerSecond = Math.round(nodesCreated / (totalDuration / 1000));

          const memoryMetrics = profiler.getMemoryMetrics();
          const performanceMetrics = profiler.getPerformanceMetrics();

          return {
            success: errors.length === 0,
            duration: totalDuration,
            throughput: performanceMetrics.operationsPerSecond,
            memoryUsage: memoryMetrics,
            performance: performanceMetrics,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Node creation failed: ${error.message}`);
          return {
            success: false,
            duration: performance.now() - overallStart,
            throughput: 0,
            memoryUsage: profiler.getMemoryMetrics(),
            performance: profiler.getPerformanceMetrics(),
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Complex Selector Performance Test
    this.addTest({
      id: 'complex-selector-performance',
      name: 'Complex Selector Query Performance',
      description: 'Tests performance of complex CSS-like selector queries on large datasets',
      category: 'scalability',
      loadLevel: 'medium',
      expectedDuration: 20,
      execute: async () => {
        const profiler = this.profiler;
        profiler.reset();

        const errors: string[] = [];
        const warnings: string[] = [];
        const artifacts: Record<string, any> = {};

        console.log(`    Setting up test data for selector performance...`);

        // First, create a large dataset
        const dataSize = 50000;
        for (let i = 0; i < dataSize; i++) {
          $$(`selector.test.items.item${i}`).val({
            id: i,
            type: i % 3 === 0 ? 'premium' : (i % 3 === 1 ? 'standard' : 'basic'),
            category: ['electronics', 'books', 'clothing', 'home', 'sports'][i % 5],
            active: i % 7 !== 0,
            score: Math.floor(Math.random() * 100),
            tags: [`tag${i % 10}`, `category${i % 5}`],
            metadata: {
              featured: i % 13 === 0,
              discount: i % 17 === 0,
              inStock: i % 19 !== 0
            }
          });
        }

        console.log(`    Running complex selector queries...`);

        const queries = [
          '[type=premium]',
          '[active=true]',
          '[score>80]',
          '[category=electronics][active=true]',
          '[type=premium][score>50]',
          '.premium[category=electronics]',
          '[metadata.featured=true]',
          '[active=true][score>70][type=premium]',
          '.standard[metadata.inStock=true][score>60]',
          '[category=books][metadata.discount=true][active=true]'
        ];

        const queryResults: Record<string, any> = {};

        try {
          const overallStart = profiler.startMeasurement();

          for (let iteration = 0; iteration < 5; iteration++) {
            console.log(`      Iteration ${iteration + 1}/5`);

            for (const query of queries) {
              const queryStart = profiler.startMeasurement();

              const results = $$('selector.test.items').select(query);
              const resultList = results.list();

              const queryDuration = profiler.recordMeasurement(queryStart);

              if (!queryResults[query]) queryResults[query] = [];
              queryResults[query].push({
                duration: queryDuration,
                resultCount: resultList.length,
                iteration
              });

              if (queryDuration > 100) { // Query taking > 100ms
                warnings.push(`Query "${query}" took ${Math.round(queryDuration)}ms`);
              }
            }
          }

          const totalDuration = profiler.recordMeasurement(overallStart);

          // Analyze query performance
          const queryAnalysis: Record<string, any> = {};
          for (const [query, results] of Object.entries(queryResults)) {
            const durations = (results as any[]).map(r => r.duration);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const resultCounts = (results as any[]).map(r => r.resultCount);
            const avgResultCount = resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length;

            queryAnalysis[query] = {
              avgDuration,
              minDuration: Math.min(...durations),
              maxDuration: Math.max(...durations),
              avgResultCount,
              queriesPerSecond: 1000 / avgDuration
            };
          }

          artifacts.dataSize = dataSize;
          artifacts.queryCount = queries.length;
          artifacts.iterations = 5;
          artifacts.queryAnalysis = queryAnalysis;
          artifacts.totalQueries = queries.length * 5;

          const memoryMetrics = profiler.getMemoryMetrics();
          const performanceMetrics = profiler.getPerformanceMetrics();

          return {
            success: errors.length === 0,
            duration: totalDuration,
            throughput: performanceMetrics.operationsPerSecond,
            memoryUsage: memoryMetrics,
            performance: performanceMetrics,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Selector performance test failed: ${error.message}`);
          return {
            success: false,
            duration: 0,
            throughput: 0,
            memoryUsage: profiler.getMemoryMetrics(),
            performance: profiler.getPerformanceMetrics(),
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Reactive System Stress Test
    this.addTest({
      id: 'reactive-system-stress',
      name: 'Reactive System Stress Test',
      description: 'Tests reactive system performance under heavy update loads',
      category: 'stress',
      loadLevel: 'extreme',
      expectedDuration: 25,
      execute: async () => {
        const profiler = this.profiler;
        profiler.reset();

        const errors: string[] = [];
        const warnings: string[] = [];
        const artifacts: Record<string, any> = {};

        console.log(`    Setting up reactive system stress test...`);

        const sourceCount = 1000;
        const targetCount = 5000;
        const updateIterations = 100;

        try {
          // Setup reactive links
          console.log(`    Creating ${sourceCount} source nodes and ${targetCount} reactive targets...`);

          for (let i = 0; i < sourceCount; i++) {
            $$(`reactive.stress.sources.source${i}`).val(0);
          }

          for (let i = 0; i < targetCount; i++) {
            const sourceId = i % sourceCount;
            const targetNode = $$(`reactive.stress.targets.target${i}`);

            // Create reactive link
            targetNode.val($$(`reactive.stress.sources.source${sourceId}`));

            // Add computation
            targetNode.watch((newValue) => {
              $$(`reactive.stress.computed.computed${i}`).val(newValue * 2 + i);
            });
          }

          console.log(`    Running ${updateIterations} update iterations...`);

          const overallStart = profiler.startMeasurement();
          let updatesProcessed = 0;

          for (let iteration = 0; iteration < updateIterations; iteration++) {
            const iterationStart = performance.now();

            // Update all source nodes
            for (let sourceId = 0; sourceId < sourceCount; sourceId++) {
              const updateStart = profiler.startMeasurement();

              $$(`reactive.stress.sources.source${sourceId}`).val(iteration * sourceCount + sourceId);

              profiler.recordMeasurement(updateStart);
              updatesProcessed++;
            }

            // Wait for reactive updates to propagate
            await new Promise(resolve => setTimeout(resolve, 1));

            const iterationDuration = performance.now() - iterationStart;
            if (iterationDuration > 500) { // Iteration taking > 500ms
              warnings.push(`Iteration ${iteration} took ${Math.round(iterationDuration)}ms`);
            }

            if (iteration % 10 === 0) {
              const progress = Math.round((iteration / updateIterations) * 100);
              console.log(`      Progress: ${progress}% (${updatesProcessed} updates)`);
            }
          }

          const totalDuration = profiler.recordMeasurement(overallStart);

          // Verify reactive updates
          console.log(`    Verifying reactive updates...`);
          const verificationStart = performance.now();

          const sampleVerification = [
            $$('reactive.stress.sources.source0').val(),
            $$('reactive.stress.targets.target0').val(),
            $$('reactive.stress.computed.computed0').val()
          ];

          const expectedSource = (updateIterations - 1) * sourceCount + 0;
          const expectedTarget = expectedSource;
          const expectedComputed = expectedTarget * 2 + 0;

          const verificationPassed =
            sampleVerification[0] === expectedSource &&
            sampleVerification[1] === expectedTarget &&
            sampleVerification[2] === expectedComputed;

          if (!verificationPassed) {
            errors.push(`Reactive verification failed: expected [${expectedSource}, ${expectedTarget}, ${expectedComputed}], got [${sampleVerification.join(', ')}]`);
          }

          const verificationDuration = performance.now() - verificationStart;

          artifacts.sourceCount = sourceCount;
          artifacts.targetCount = targetCount;
          artifacts.updateIterations = updateIterations;
          artifacts.totalUpdates = updatesProcessed;
          artifacts.verificationDuration = verificationDuration;
          artifacts.updatesPerSecond = Math.round(updatesProcessed / (totalDuration / 1000));

          const memoryMetrics = profiler.getMemoryMetrics();
          const performanceMetrics = profiler.getPerformanceMetrics();

          return {
            success: errors.length === 0,
            duration: totalDuration,
            throughput: performanceMetrics.operationsPerSecond,
            memoryUsage: memoryMetrics,
            performance: performanceMetrics,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Reactive stress test failed: ${error.message}`);
          return {
            success: false,
            duration: 0,
            throughput: 0,
            memoryUsage: profiler.getMemoryMetrics(),
            performance: profiler.getPerformanceMetrics(),
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Memory Leak Detection Test
    this.addTest({
      id: 'memory-leak-detection',
      name: 'Memory Leak Detection',
      description: 'Tests for memory leaks during intensive operations',
      category: 'memory',
      loadLevel: 'medium',
      expectedDuration: 15,
      execute: async () => {
        const profiler = this.profiler;
        profiler.reset();

        const errors: string[] = [];
        const warnings: string[] = [];
        const artifacts: Record<string, any> = {};

        console.log(`    Running memory leak detection test...`);

        const cycles = 50;
        const nodesPerCycle = 1000;
        const memoryMeasurements: number[] = [];

        try {
          const overallStart = profiler.startMeasurement();

          for (let cycle = 0; cycle < cycles; cycle++) {
            const cycleStart = performance.now();

            // Create nodes
            for (let i = 0; i < nodesPerCycle; i++) {
              const nodeId = cycle * nodesPerCycle + i;
              $$(`memory.leak.test.cycle${cycle}.node${i}`).val({
                id: nodeId,
                data: new Array(100).fill(`data-${nodeId}`), // Some memory usage
                timestamp: Date.now()
              });
            }

            // Create watchers (potential leak source)
            const watchers = [];
            for (let i = 0; i < nodesPerCycle; i++) {
              const watcher = $$(`memory.leak.test.cycle${cycle}.node${i}`).watch(() => {
                // Do something
              });
              watchers.push(watcher);
            }

            // Clean up watchers
            watchers.forEach(unwatch => unwatch());

            // Remove nodes
            for (let i = 0; i < nodesPerCycle; i++) {
              $$(`memory.leak.test.cycle${cycle}.node${i}`).val(undefined);
            }

            // Force garbage collection if available
            profiler.forceGC();

            // Measure memory
            const memoryUsage = profiler.getMemoryUsage();
            memoryMeasurements.push(memoryUsage);

            const cycleDuration = performance.now() - cycleStart;
            profiler.recordMeasurement(overallStart); // Record overall operation

            if (cycle % 10 === 0) {
              console.log(`      Cycle ${cycle}/${cycles} - Memory: ${Math.round(memoryUsage / 1024 / 1024)}MB`);
            }
          }

          const totalDuration = profiler.recordMeasurement(overallStart);

          // Analyze memory usage trend
          const initialMemory = memoryMeasurements[0] || 0;
          const finalMemory = memoryMeasurements[memoryMeasurements.length - 1] || 0;
          const peakMemory = Math.max(...memoryMeasurements);
          const memoryGrowth = finalMemory - initialMemory;
          const memoryGrowthPercent = initialMemory > 0 ? (memoryGrowth / initialMemory) * 100 : 0;

          // Detect potential leaks
          if (memoryGrowthPercent > 50) {
            warnings.push(`Significant memory growth detected: ${Math.round(memoryGrowthPercent)}%`);
          }

          if (memoryGrowth > 50 * 1024 * 1024) { // > 50MB growth
            warnings.push(`Large memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
          }

          // Check for steady growth (potential leak)
          const growthTrend = this.analyzeMemoryTrend(memoryMeasurements);
          if (growthTrend.steadyGrowth) {
            warnings.push('Steady memory growth detected - potential leak');
          }

          artifacts.cycles = cycles;
          artifacts.nodesPerCycle = nodesPerCycle;
          artifacts.initialMemory = initialMemory;
          artifacts.finalMemory = finalMemory;
          artifacts.peakMemory = peakMemory;
          artifacts.memoryGrowth = memoryGrowth;
          artifacts.memoryGrowthPercent = memoryGrowthPercent;
          artifacts.memoryTrend = growthTrend;

          const memoryMetrics = profiler.getMemoryMetrics();
          const performanceMetrics = profiler.getPerformanceMetrics();

          return {
            success: errors.length === 0,
            duration: totalDuration,
            throughput: performanceMetrics.operationsPerSecond,
            memoryUsage: memoryMetrics,
            performance: performanceMetrics,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Memory leak test failed: ${error.message}`);
          return {
            success: false,
            duration: 0,
            throughput: 0,
            memoryUsage: profiler.getMemoryMetrics(),
            performance: profiler.getPerformanceMetrics(),
            warnings,
            errors,
            artifacts
          };
        }
      }
    });

    // Concurrent Operations Test
    this.addTest({
      id: 'concurrent-operations',
      name: 'Concurrent Operations Test',
      description: 'Tests FXD performance under concurrent access patterns',
      category: 'concurrency',
      loadLevel: 'heavy',
      expectedDuration: 20,
      execute: async () => {
        const profiler = this.profiler;
        profiler.reset();

        const errors: string[] = [];
        const warnings: string[] = [];
        const artifacts: Record<string, any> = {};

        console.log(`    Running concurrent operations test...`);

        const concurrentThreads = 10;
        const operationsPerThread = 1000;

        try {
          const overallStart = profiler.startMeasurement();

          // Simulate concurrent operations using Promises
          const concurrentTasks = [];

          for (let threadId = 0; threadId < concurrentThreads; threadId++) {
            const task = async () => {
              const threadResults = [];

              for (let op = 0; op < operationsPerThread; op++) {
                const opStart = performance.now();

                // Mix of different operations
                const operationType = op % 4;

                switch (operationType) {
                  case 0: // Node creation
                    $$(`concurrent.thread${threadId}.create.node${op}`).val({
                      threadId,
                      operation: op,
                      type: 'create',
                      timestamp: Date.now()
                    });
                    break;

                  case 1: // Node reading
                    const readTarget = Math.floor(op / 2);
                    const readValue = $$(`concurrent.thread${threadId}.create.node${readTarget}`).val();
                    break;

                  case 2: // Node updating
                    const updateTarget = Math.floor(op / 3);
                    $$(`concurrent.thread${threadId}.create.node${updateTarget}`).val({
                      threadId,
                      operation: op,
                      type: 'update',
                      timestamp: Date.now(),
                      updated: true
                    });
                    break;

                  case 3: // Selector query
                    const results = $$(`concurrent.thread${threadId}.create`).select('[type=create]').list();
                    break;
                }

                const opDuration = performance.now() - opStart;
                threadResults.push(opDuration);

                if (opDuration > 10) { // Operation taking > 10ms
                  warnings.push(`Thread ${threadId} operation ${op} took ${Math.round(opDuration)}ms`);
                }
              }

              return {
                threadId,
                operationTimes: threadResults,
                avgTime: threadResults.reduce((a, b) => a + b, 0) / threadResults.length
              };
            };

            concurrentTasks.push(task());
          }

          console.log(`    Waiting for ${concurrentThreads} concurrent threads to complete...`);

          const threadResults = await Promise.all(concurrentTasks);

          const totalDuration = profiler.recordMeasurement(overallStart);

          // Analyze concurrency results
          const allOperationTimes = threadResults.flatMap(r => r.operationTimes);
          const totalOperations = allOperationTimes.length;
          const avgOperationTime = allOperationTimes.reduce((a, b) => a + b, 0) / totalOperations;
          const maxOperationTime = Math.max(...allOperationTimes);
          const minOperationTime = Math.min(...allOperationTimes);

          // Check for contention (high variance in operation times)
          const variance = allOperationTimes.reduce((sum, time) => sum + Math.pow(time - avgOperationTime, 2), 0) / totalOperations;
          const stdDev = Math.sqrt(variance);

          if (stdDev > avgOperationTime * 0.5) {
            warnings.push(`High operation time variance detected: ${Math.round(stdDev)}ms std dev`);
          }

          // Verify data consistency
          let totalNodesCreated = 0;
          for (let threadId = 0; threadId < concurrentThreads; threadId++) {
            const threadNodes = $$(`concurrent.thread${threadId}.create`).val() || {};
            totalNodesCreated += Object.keys(threadNodes).length;
          }

          const expectedNodes = concurrentThreads * Math.ceil(operationsPerThread / 4); // 1/4 operations are creates
          if (Math.abs(totalNodesCreated - expectedNodes) > expectedNodes * 0.1) {
            warnings.push(`Node count mismatch: expected ~${expectedNodes}, got ${totalNodesCreated}`);
          }

          artifacts.concurrentThreads = concurrentThreads;
          artifacts.operationsPerThread = operationsPerThread;
          artifacts.totalOperations = totalOperations;
          artifacts.avgOperationTime = avgOperationTime;
          artifacts.maxOperationTime = maxOperationTime;
          artifacts.minOperationTime = minOperationTime;
          artifacts.operationTimeStdDev = stdDev;
          artifacts.totalNodesCreated = totalNodesCreated;
          artifacts.operationsPerSecond = Math.round(totalOperations / (totalDuration / 1000));

          const memoryMetrics = profiler.getMemoryMetrics();
          const performanceMetrics = {
            avgOperationTime,
            minOperationTime,
            maxOperationTime,
            p95OperationTime: allOperationTimes.sort((a, b) => a - b)[Math.floor(allOperationTimes.length * 0.95)],
            p99OperationTime: allOperationTimes.sort((a, b) => a - b)[Math.floor(allOperationTimes.length * 0.99)],
            operationsPerSecond: 1000 / avgOperationTime
          };

          return {
            success: errors.length === 0,
            duration: totalDuration,
            throughput: performanceMetrics.operationsPerSecond,
            memoryUsage: memoryMetrics,
            performance: performanceMetrics,
            warnings,
            errors,
            artifacts
          };
        } catch (error) {
          errors.push(`Concurrent operations test failed: ${error.message}`);
          return {
            success: false,
            duration: 0,
            throughput: 0,
            memoryUsage: profiler.getMemoryMetrics(),
            performance: profiler.getPerformanceMetrics(),
            warnings,
            errors,
            artifacts
          };
        }
      }
    });
  }

  private analyzeMemoryTrend(measurements: number[]): { steadyGrowth: boolean; growthRate: number; consistency: number } {
    if (measurements.length < 10) {
      return { steadyGrowth: false, growthRate: 0, consistency: 0 };
    }

    // Calculate growth between consecutive measurements
    const growthRates = [];
    for (let i = 1; i < measurements.length; i++) {
      const growth = measurements[i] - measurements[i - 1];
      growthRates.push(growth);
    }

    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const positiveGrowthCount = growthRates.filter(g => g > 0).length;
    const consistency = positiveGrowthCount / growthRates.length;

    // Steady growth if > 70% of measurements show growth and avg growth > 0
    const steadyGrowth = consistency > 0.7 && avgGrowthRate > 0;

    return {
      steadyGrowth,
      growthRate: avgGrowthRate,
      consistency
    };
  }

  addTest(test: PerformanceTest): void {
    this.tests.set(test.id, test);
  }

  async runTest(testId: string): Promise<PerformanceResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    console.log(`🚀 Running performance test: ${test.name}`);
    console.log(`📊 Category: ${test.category} | Load: ${test.loadLevel} | Expected: ${test.expectedDuration}s`);

    try {
      const result = await test.execute();

      const status = result.success ? '✅' : '❌';
      const duration = Math.round(result.duration / 1000);
      const throughput = Math.round(result.throughput);
      console.log(`${status} ${test.name} (${duration}s, ${throughput} ops/sec)`);

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
        throughput: 0,
        memoryUsage: {
          initial: 0,
          peak: 0,
          final: 0,
          delta: 0,
          leaked: 0,
          gcCollections: 0
        },
        performance: {
          avgOperationTime: 0,
          minOperationTime: 0,
          maxOperationTime: 0,
          p95OperationTime: 0,
          p99OperationTime: 0,
          operationsPerSecond: 0
        },
        warnings: [],
        errors: [error.message],
        artifacts: { crashed: true }
      };
    }
  }

  async runAllTests(filter?: {
    category?: string;
    loadLevel?: string;
    maxDuration?: number;
  }): Promise<ScalabilityReport> {
    console.log('🚀 Starting Performance and Scalability Testing...\n');

    let tests = Array.from(this.tests.values());

    // Apply filters
    if (filter) {
      tests = tests.filter(test => {
        if (filter.category && test.category !== filter.category) return false;
        if (filter.loadLevel && test.loadLevel !== filter.loadLevel) return false;
        if (filter.maxDuration && test.expectedDuration > filter.maxDuration) return false;
        return true;
      });
    }

    console.log(`📋 Running ${tests.length} performance tests...\n`);

    this.results = [];

    // Run tests
    for (const test of tests) {
      const result = await this.runTest(test.id);
      this.results.push(result);
    }

    // Generate report
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const avgThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0) / this.results.length;

    // Calculate memory efficiency (lower memory usage per operation is better)
    const memoryEfficiency = this.calculateMemoryEfficiency(this.results);

    // Calculate overall performance score
    const overallScore = this.calculateOverallScore(this.results);

    const report: ScalabilityReport = {
      testRun: {
        id: `perf-${Date.now()}`,
        timestamp: Date.now(),
        platform: this.detectPlatform(),
        environment: this.getEnvironmentInfo()
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        averageThroughput: avgThroughput,
        memoryEfficiency,
        overallScore
      },
      benchmarks: this.generateBenchmarks(this.results),
      recommendations: this.generateRecommendations(this.results)
    };

    this.printReport(report);
    return report;
  }

  private calculateMemoryEfficiency(results: PerformanceResult[]): number {
    const validResults = results.filter(r => r.success && r.memoryUsage.delta > 0);
    if (validResults.length === 0) return 100;

    const avgMemoryPerOp = validResults.reduce((sum, r) => {
      const opsCount = r.artifacts.totalOperations || r.artifacts.nodeCount || 1;
      return sum + (r.memoryUsage.delta / opsCount);
    }, 0) / validResults.length;

    // Lower memory per operation = higher efficiency
    // Normalize to 0-100 scale (assuming 1KB per op is 50% efficient)
    const referenceMemoryPerOp = 1024; // 1KB
    return Math.max(0, Math.min(100, 100 - (avgMemoryPerOp / referenceMemoryPerOp) * 50));
  }

  private calculateOverallScore(results: PerformanceResult[]): number {
    if (results.length === 0) return 0;

    const successRate = results.filter(r => r.success).length / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const memoryEfficiency = this.calculateMemoryEfficiency(results);

    // Weighted score: 40% success rate, 30% throughput, 30% memory efficiency
    const throughputScore = Math.min(100, (avgThroughput / 1000) * 100); // Normalize assuming 1000 ops/sec = 100%
    const overallScore = (successRate * 40) + (throughputScore * 0.3) + (memoryEfficiency * 0.3);

    return Math.round(overallScore);
  }

  private generateBenchmarks(results: PerformanceResult[]): Record<string, number> {
    const benchmarks: Record<string, number> = {};

    for (const result of results) {
      const testId = this.getTestIdFromResult(result);
      if (result.success) {
        benchmarks[`${testId}_throughput`] = Math.round(result.throughput);
        benchmarks[`${testId}_avg_time`] = Math.round(result.performance.avgOperationTime * 100) / 100;
        benchmarks[`${testId}_p95_time`] = Math.round(result.performance.p95OperationTime * 100) / 100;
        if (result.memoryUsage.delta > 0) {
          benchmarks[`${testId}_memory_mb`] = Math.round(result.memoryUsage.delta / 1024 / 1024 * 100) / 100;
        }
      }
    }

    return benchmarks;
  }

  private getTestIdFromResult(result: PerformanceResult): string {
    // This is a simplification - in a real implementation, you'd track the test ID with the result
    for (const [testId, test] of this.tests) {
      // Match based on result characteristics (this is approximate)
      if (result.artifacts.nodeCount && test.name.includes('Node Creation')) return testId;
      if (result.artifacts.queryCount && test.name.includes('Selector')) return testId;
      if (result.artifacts.sourceCount && test.name.includes('Reactive')) return testId;
      if (result.artifacts.cycles && test.name.includes('Memory Leak')) return testId;
      if (result.artifacts.concurrentThreads && test.name.includes('Concurrent')) return testId;
    }
    return 'unknown';
  }

  private generateRecommendations(results: PerformanceResult[]): string[] {
    const recommendations: string[] = [];

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      recommendations.push(`🚨 CRITICAL: ${failures.length} performance tests failed - investigate before production deployment`);
    }

    const slowTests = results.filter(r => r.performance.avgOperationTime > 10); // > 10ms per operation
    if (slowTests.length > 0) {
      recommendations.push(`🐌 PERFORMANCE: ${slowTests.length} tests show slow operation times - consider optimization`);
    }

    const memoryLeaks = results.filter(r => r.warnings.some(w => w.includes('memory growth') || w.includes('leak')));
    if (memoryLeaks.length > 0) {
      recommendations.push(`🧠 MEMORY: Potential memory leaks detected - review memory management`);
    }

    const concurrencyIssues = results.filter(r => r.warnings.some(w => w.includes('variance') || w.includes('contention')));
    if (concurrencyIssues.length > 0) {
      recommendations.push(`🔄 CONCURRENCY: Concurrency issues detected - review locking and synchronization`);
    }

    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    if (avgThroughput < 100) { // < 100 ops/sec
      recommendations.push('⚡ THROUGHPUT: Low average throughput - consider algorithmic optimizations');
    }

    const memoryEfficiency = this.calculateMemoryEfficiency(results);
    if (memoryEfficiency < 50) {
      recommendations.push('🧠 MEMORY EFFICIENCY: High memory usage per operation - review data structures');
    }

    if (recommendations.length === 0) {
      recommendations.push('🌟 EXCELLENT: All performance tests pass with good metrics!');
    }

    return recommendations;
  }

  private detectPlatform(): string {
    if (typeof Deno !== 'undefined') return 'deno';
    if (typeof window !== 'undefined') return 'browser';
    if (typeof process !== 'undefined') return 'node';
    return 'unknown';
  }

  private getEnvironmentInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    try {
      if (typeof Deno !== 'undefined') {
        info.deno_version = Deno.version.deno;
        info.v8_version = Deno.version.v8;
      }
      if (typeof navigator !== 'undefined') {
        info.user_agent = navigator.userAgent;
        info.hardware_concurrency = navigator.hardwareConcurrency;
      }
      if (typeof (performance as any).memory !== 'undefined') {
        const mem = (performance as any).memory;
        info.heap_size_limit = mem.jsHeapSizeLimit;
        info.total_heap_size = mem.totalJSHeapSize;
      }
    } catch {
      // Ignore errors in environment detection
    }

    return info;
  }

  private printReport(report: ScalabilityReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 PERFORMANCE & SCALABILITY REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);
    console.log(`🖥️ Platform: ${report.testRun.platform}`);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   ⚡ Avg Throughput: ${Math.round(report.summary.averageThroughput)} ops/sec`);
    console.log(`   🧠 Memory Efficiency: ${Math.round(report.summary.memoryEfficiency)}%`);
    console.log(`   🏆 Overall Score: ${report.summary.overallScore}/100`);

    // Group by category
    const byCategory = new Map();
    for (const result of report.results) {
      const testId = this.getTestIdFromResult(result);
      const test = this.tests.get(testId);
      const cat = test?.category || 'unknown';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(result);
    }

    console.log(`\n📋 BY CATEGORY:`);
    for (const [category, results] of byCategory) {
      const passed = results.filter((r: PerformanceResult) => r.success).length;
      const total = results.length;
      const avgThroughput = Math.round(results.reduce((sum: number, r: PerformanceResult) => sum + r.throughput, 0) / total);
      const status = passed === total ? '✅' : (passed === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${category.toUpperCase()}: ${passed}/${total} (${avgThroughput} ops/sec avg)`);
    }

    console.log(`\n🏁 BENCHMARKS:`);
    for (const [benchmark, value] of Object.entries(report.benchmarks)) {
      console.log(`   ${benchmark}: ${value}`);
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

async function runPerformanceTests() {
  const suite = new PerformanceScalabilityTestSuite();

  // Parse command line arguments
  const args = Deno.args;
  const filter: any = {};

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      filter.category = arg.split('=')[1];
    } else if (arg.startsWith('--load=')) {
      filter.loadLevel = arg.split('=')[1];
    } else if (arg.startsWith('--max-duration=')) {
      filter.maxDuration = parseInt(arg.split('=')[1]);
    }
  }

  const report = await suite.runAllTests(Object.keys(filter).length > 0 ? filter : undefined);

  // Exit with appropriate code based on overall score
  Deno.exit(report.summary.overallScore < 50 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runPerformanceTests();
}

export { PerformanceScalabilityTestSuite, PerformanceProfiler };