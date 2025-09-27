#!/usr/bin/env deno run --allow-all

/**
 * @file master-qa-runner.ts
 * @description Master Quality Assurance Runner for FXD
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This master runner orchestrates all QA test suites:
 * 1. End-to-end validation framework
 * 2. Cross-platform compatibility tests
 * 3. Real-world workflow validation
 * 4. Performance and scalability tests
 * 5. Documentation accuracy validation
 * 6. Integration test suite
 */

import { FXDQAFramework } from './qa-validation-framework.ts';
import { CrossPlatformTestSuite } from './cross-platform-test-suite.ts';
import { RealWorldWorkflowTestSuite } from './real-world-workflow-tests.ts';
import { PerformanceScalabilityTestSuite } from './performance-scalability-tests.ts';
import { DocumentationValidationSuite } from './documentation-validation-tests.ts';
import { IntegrationTestSuite } from './integration-test-suite.ts';

// === TYPES & INTERFACES ===

interface MasterQAReport {
  testRun: {
    id: string;
    timestamp: number;
    duration: number;
    platform: string;
    environment: Record<string, string>;
  };
  suiteResults: {
    endToEnd: any;
    crossPlatform: any;
    workflows: any;
    performance: any;
    documentation: any;
    integration: any;
  };
  overallSummary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallScore: number;
    readinessLevel: 'production' | 'staging' | 'development' | 'experimental';
  };
  criticalIssues: string[];
  recommendations: string[];
  certificationStatus: {
    functionalQuality: number;
    performanceQuality: number;
    usabilityQuality: number;
    compatibilityQuality: number;
    documentationQuality: number;
    integrationQuality: number;
    overallCertification: string;
  };
}

interface RunOptions {
  suites?: string[];
  skipSlow?: boolean;
  parallel?: boolean;
  reportFormat?: 'console' | 'json' | 'html';
  outputFile?: string;
  stopOnFailure?: boolean;
  verbosity?: 'minimal' | 'normal' | 'verbose';
}

// === MASTER QA RUNNER ===

export class MasterQARunner {
  private options: RunOptions;
  private startTime: number = 0;

  constructor(options: RunOptions = {}) {
    this.options = {
      suites: ['all'],
      skipSlow: false,
      parallel: false,
      reportFormat: 'console',
      stopOnFailure: false,
      verbosity: 'normal',
      ...options
    };
  }

  async runAllSuites(): Promise<MasterQAReport> {
    this.startTime = Date.now();

    console.log('🚀 Starting FXD Master Quality Assurance Validation');
    console.log('=' .repeat(60));
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🖥️ Platform: ${this.detectPlatform()}`);
    console.log(`⚙️ Options: ${JSON.stringify(this.options, null, 2)}`);
    console.log('=' .repeat(60));

    const suiteResults: any = {};
    const suitesToRun = this.determineSuitesToRun();

    if (this.options.parallel && suitesToRun.length > 1) {
      console.log(`\n🔄 Running ${suitesToRun.length} test suites in parallel...\n`);
      suiteResults = await this.runSuitesInParallel(suitesToRun);
    } else {
      console.log(`\n🔄 Running ${suitesToRun.length} test suites sequentially...\n`);
      suiteResults = await this.runSuitesSequentially(suitesToRun);
    }

    const report = this.generateMasterReport(suiteResults);
    this.printMasterReport(report);

    if (this.options.outputFile) {
      await this.saveReport(report, this.options.outputFile);
    }

    return report;
  }

  private determineSuitesToRun(): string[] {
    const allSuites = ['endToEnd', 'crossPlatform', 'workflows', 'performance', 'documentation', 'integration'];

    if (this.options.suites?.includes('all')) {
      return allSuites;
    }

    if (this.options.suites?.includes('fast')) {
      return ['endToEnd', 'documentation', 'integration'];
    }

    if (this.options.suites?.includes('critical')) {
      return ['endToEnd', 'crossPlatform', 'integration'];
    }

    return this.options.suites || allSuites;
  }

  private async runSuitesSequentially(suites: string[]): Promise<any> {
    const results: any = {};

    for (const suite of suites) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🎯 Running ${suite.toUpperCase()} Test Suite`);
      console.log(`${'='.repeat(50)}`);

      try {
        const result = await this.runSingleSuite(suite);
        results[suite] = result;

        if (this.options.stopOnFailure && !this.isSuiteSuccessful(result)) {
          console.log(`\n❌ Suite ${suite} failed. Stopping due to stopOnFailure option.`);
          break;
        }
      } catch (error) {
        console.error(`❌ Suite ${suite} crashed: ${error.message}`);
        results[suite] = { success: false, error: error.message };

        if (this.options.stopOnFailure) {
          break;
        }
      }
    }

    return results;
  }

  private async runSuitesInParallel(suites: string[]): Promise<any> {
    const promises = suites.map(suite => this.runSingleSuite(suite));

    try {
      const results = await Promise.allSettled(promises);
      const resultMap: any = {};

      suites.forEach((suite, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          resultMap[suite] = result.value;
        } else {
          resultMap[suite] = { success: false, error: result.reason.message };
        }
      });

      return resultMap;
    } catch (error) {
      throw new Error(`Parallel execution failed: ${error.message}`);
    }
  }

  private async runSingleSuite(suite: string): Promise<any> {
    const suiteStart = performance.now();

    switch (suite) {
      case 'endToEnd':
        const e2eFramework = new FXDQAFramework();
        const filter = this.options.skipSlow ? { priority: 'critical' } : undefined;
        return await e2eFramework.runAll(filter);

      case 'crossPlatform':
        const crossPlatform = new CrossPlatformTestSuite();
        return await crossPlatform.runAllTests();

      case 'workflows':
        const workflows = new RealWorldWorkflowTestSuite();
        const workflowFilter = this.options.skipSlow ? { complexity: 'simple' } : undefined;
        return await workflows.runAllScenarios(workflowFilter);

      case 'performance':
        const performance = new PerformanceScalabilityTestSuite();
        const perfFilter = this.options.skipSlow ? { loadLevel: 'light' } : undefined;
        return await performance.runAllTests(perfFilter);

      case 'documentation':
        const docs = new DocumentationValidationSuite();
        return await docs.runAllTests();

      case 'integration':
        const integration = new IntegrationTestSuite();
        const intFilter = this.options.skipSlow ? { complexity: 'simple' } : undefined;
        return await integration.runAllTests(intFilter);

      default:
        throw new Error(`Unknown test suite: ${suite}`);
    }
  }

  private isSuiteSuccessful(result: any): boolean {
    // Different suite types have different success indicators
    if (result.summary) {
      // Framework-style results
      if (typeof result.summary.failed === 'number') {
        return result.summary.failed === 0;
      }
      if (typeof result.summary.successful === 'number' && typeof result.summary.totalScenarios === 'number') {
        return result.summary.successful === result.summary.totalScenarios;
      }
      if (typeof result.summary.passed === 'number' && typeof result.summary.totalTests === 'number') {
        return result.summary.passed === result.summary.totalTests;
      }
    }

    return result.success !== false;
  }

  private generateMasterReport(suiteResults: any): MasterQAReport {
    const duration = Date.now() - this.startTime;

    // Calculate overall metrics
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const passedSuites = Object.values(suiteResults).filter(result => this.isSuiteSuccessful(result)).length;
    const totalSuites = Object.keys(suiteResults).length;
    const failedSuites = totalSuites - passedSuites;

    // Aggregate test counts from all suites
    for (const [suiteName, result] of Object.entries(suiteResults)) {
      if (result && typeof result === 'object' && result.summary) {
        const summary = result.summary;

        if (summary.totalTests) totalTests += summary.totalTests;
        else if (summary.totalScenarios) totalTests += summary.totalScenarios;
        else if (summary.total) totalTests += summary.total;

        if (summary.passed) passedTests += summary.passed;
        else if (summary.successful) passedTests += summary.successful;

        if (summary.failed) failedTests += summary.failed;
      }
    }

    // Calculate certification scores
    const certification = this.calculateCertificationScores(suiteResults);
    const overallScore = Math.round(Object.values(certification).reduce((sum: number, score: any) =>
      sum + (typeof score === 'number' ? score : 0), 0) / 6);

    // Determine readiness level
    const readinessLevel = this.determineReadinessLevel(overallScore, failedSuites, certification);

    // Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(suiteResults);

    // Generate recommendations
    const recommendations = this.generateMasterRecommendations(suiteResults, certification, readinessLevel);

    return {
      testRun: {
        id: `master-qa-${Date.now()}`,
        timestamp: this.startTime,
        duration,
        platform: this.detectPlatform(),
        environment: this.getEnvironmentInfo()
      },
      suiteResults,
      overallSummary: {
        totalSuites,
        passedSuites,
        failedSuites,
        totalTests,
        passedTests,
        failedTests,
        overallScore,
        readinessLevel
      },
      criticalIssues,
      recommendations,
      certificationStatus: {
        ...certification,
        overallCertification: this.getCertificationGrade(overallScore)
      }
    };
  }

  private calculateCertificationScores(suiteResults: any): Record<string, number> {
    const scores: Record<string, number> = {
      functionalQuality: 0,
      performanceQuality: 0,
      usabilityQuality: 0,
      compatibilityQuality: 0,
      documentationQuality: 0,
      integrationQuality: 0
    };

    // End-to-end and integration contribute to functional quality
    if (suiteResults.endToEnd?.summary) {
      scores.functionalQuality += this.calculateSuiteScore(suiteResults.endToEnd) * 0.6;
    }
    if (suiteResults.integration?.summary) {
      scores.functionalQuality += this.calculateSuiteScore(suiteResults.integration) * 0.4;
    }

    // Performance suite
    if (suiteResults.performance?.summary) {
      scores.performanceQuality = this.calculateSuiteScore(suiteResults.performance);
    }

    // Workflows contribute to usability
    if (suiteResults.workflows?.summary) {
      scores.usabilityQuality = this.calculateSuiteScore(suiteResults.workflows);
    }

    // Cross-platform compatibility
    if (suiteResults.crossPlatform?.summary) {
      scores.compatibilityQuality = this.calculateSuiteScore(suiteResults.crossPlatform);
    }

    // Documentation quality
    if (suiteResults.documentation?.summary) {
      scores.documentationQuality = this.calculateSuiteScore(suiteResults.documentation);
    }

    // Integration quality (from integration tests)
    if (suiteResults.integration?.summary) {
      scores.integrationQuality = this.calculateSuiteScore(suiteResults.integration);
    }

    return scores;
  }

  private calculateSuiteScore(suiteResult: any): number {
    const summary = suiteResult.summary;

    if (summary.passed !== undefined && summary.totalTests !== undefined) {
      return Math.round((summary.passed / summary.totalTests) * 100);
    }

    if (summary.successful !== undefined && summary.totalScenarios !== undefined) {
      return Math.round((summary.successful / summary.totalScenarios) * 100);
    }

    if (summary.accuracy !== undefined) {
      return summary.accuracy;
    }

    if (summary.overallCompatibility !== undefined) {
      return summary.overallCompatibility;
    }

    if (summary.overallScore !== undefined) {
      return summary.overallScore;
    }

    return 0;
  }

  private determineReadinessLevel(overallScore: number, failedSuites: number, certification: Record<string, number>): 'production' | 'staging' | 'development' | 'experimental' {
    if (failedSuites > 2) return 'experimental';
    if (overallScore >= 90 && certification.functionalQuality >= 95 && certification.performanceQuality >= 80) return 'production';
    if (overallScore >= 80 && certification.functionalQuality >= 85) return 'staging';
    if (overallScore >= 60) return 'development';
    return 'experimental';
  }

  private identifyCriticalIssues(suiteResults: any): string[] {
    const issues: string[] = [];

    // Check for critical test failures
    for (const [suiteName, result] of Object.entries(suiteResults)) {
      if (!this.isSuiteSuccessful(result)) {
        issues.push(`❌ ${suiteName.toUpperCase()} test suite failed`);
      }
    }

    // Check for specific critical issues
    if (suiteResults.endToEnd?.summary?.failed > 0) {
      issues.push('🚨 Core functionality tests failing');
    }

    if (suiteResults.performance?.summary?.criticalIssues > 0) {
      issues.push('⚡ Performance critical issues detected');
    }

    if (suiteResults.crossPlatform?.summary?.criticalIssues > 0) {
      issues.push('🌐 Cross-platform compatibility issues');
    }

    if (suiteResults.integration?.summary?.integrationScore < 50) {
      issues.push('🔗 Poor component integration quality');
    }

    return issues;
  }

  private generateMasterRecommendations(suiteResults: any, certification: Record<string, number>, readinessLevel: string): string[] {
    const recommendations: string[] = [];

    // Readiness-based recommendations
    switch (readinessLevel) {
      case 'experimental':
        recommendations.push('🚨 CRITICAL: Major issues prevent deployment - focus on core functionality');
        break;
      case 'development':
        recommendations.push('🔧 DEVELOPMENT: Suitable for development only - improve test coverage and stability');
        break;
      case 'staging':
        recommendations.push('🧪 STAGING: Ready for staging deployment - address remaining issues before production');
        break;
      case 'production':
        recommendations.push('🚀 PRODUCTION: Ready for production deployment with monitoring');
        break;
    }

    // Quality-specific recommendations
    if (certification.functionalQuality < 80) {
      recommendations.push('🔧 FUNCTIONAL: Core functionality needs improvement - review failed end-to-end tests');
    }

    if (certification.performanceQuality < 70) {
      recommendations.push('⚡ PERFORMANCE: Performance optimization required - review scalability tests');
    }

    if (certification.usabilityQuality < 70) {
      recommendations.push('👤 USABILITY: Developer experience needs improvement - review workflow tests');
    }

    if (certification.compatibilityQuality < 80) {
      recommendations.push('🌐 COMPATIBILITY: Cross-platform issues need resolution');
    }

    if (certification.documentationQuality < 80) {
      recommendations.push('📚 DOCUMENTATION: Documentation needs updates to match implementation');
    }

    if (certification.integrationQuality < 70) {
      recommendations.push('🔗 INTEGRATION: Component integration needs improvement');
    }

    // Suite-specific recommendations
    Object.entries(suiteResults).forEach(([suiteName, result]) => {
      if (result && result.recommendations) {
        const topRecommendations = result.recommendations.slice(0, 2);
        recommendations.push(...topRecommendations.map((rec: string) => `${suiteName.toUpperCase()}: ${rec}`));
      }
    });

    return recommendations;
  }

  private getCertificationGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
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
        info.v8_version = Deno.version.v8;
      }
    } catch {
      // Ignore if not available
    }

    return info;
  }

  private printMasterReport(report: MasterQAReport): void {
    const duration = Math.round(report.testRun.duration / 1000);

    console.log('\n' + '='.repeat(80));
    console.log('🏆 FXD MASTER QUALITY ASSURANCE REPORT');
    console.log('='.repeat(80));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Duration: ${duration}s`);
    console.log(`🖥️ Platform: ${report.testRun.platform}`);

    console.log(`\n📊 OVERALL SUMMARY:`);
    console.log(`   Test Suites: ${report.overallSummary.passedSuites}/${report.overallSummary.totalSuites} passed`);
    console.log(`   Total Tests: ${report.overallSummary.passedTests}/${report.overallSummary.totalTests} passed`);
    console.log(`   Overall Score: ${report.overallSummary.overallScore}/100`);
    console.log(`   Readiness Level: ${report.overallSummary.readinessLevel.toUpperCase()}`);

    console.log(`\n🎯 SUITE RESULTS:`);
    for (const [suiteName, result] of Object.entries(report.suiteResults)) {
      const status = this.isSuiteSuccessful(result) ? '✅' : '❌';
      const score = this.calculateSuiteScore(result);
      console.log(`   ${status} ${suiteName.toUpperCase()}: ${score}%`);
    }

    console.log(`\n🏅 CERTIFICATION STATUS:`);
    console.log(`   Overall Grade: ${report.certificationStatus.overallCertification}`);
    console.log(`   Functional Quality: ${report.certificationStatus.functionalQuality}%`);
    console.log(`   Performance Quality: ${report.certificationStatus.performanceQuality}%`);
    console.log(`   Usability Quality: ${report.certificationStatus.usabilityQuality}%`);
    console.log(`   Compatibility Quality: ${report.certificationStatus.compatibilityQuality}%`);
    console.log(`   Documentation Quality: ${report.certificationStatus.documentationQuality}%`);
    console.log(`   Integration Quality: ${report.certificationStatus.integrationQuality}%`);

    if (report.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES:`);
      for (const issue of report.criticalIssues) {
        console.log(`   ${issue}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 TOP RECOMMENDATIONS:`);
      for (const rec of report.recommendations.slice(0, 8)) {
        console.log(`   ${rec}`);
      }
    }

    // Readiness assessment
    console.log(`\n🎯 READINESS ASSESSMENT:`);
    switch (report.overallSummary.readinessLevel) {
      case 'production':
        console.log(`   🚀 FXD is READY FOR PRODUCTION deployment`);
        console.log(`   ✅ All critical tests pass with high quality scores`);
        break;
      case 'staging':
        console.log(`   🧪 FXD is ready for STAGING deployment`);
        console.log(`   ⚠️ Minor issues should be addressed before production`);
        break;
      case 'development':
        console.log(`   🔧 FXD is suitable for DEVELOPMENT use`);
        console.log(`   ⚠️ Significant improvements needed before deployment`);
        break;
      case 'experimental':
        console.log(`   🧪 FXD is in EXPERIMENTAL state`);
        console.log(`   🚨 Major issues prevent any deployment`);
        break;
    }

    console.log('\n' + '='.repeat(80));
  }

  private async saveReport(report: MasterQAReport, filename: string): Promise<void> {
    try {
      let content: string;

      if (this.options.reportFormat === 'json') {
        content = JSON.stringify(report, null, 2);
      } else if (this.options.reportFormat === 'html') {
        content = this.generateHTMLReport(report);
      } else {
        content = this.generateTextReport(report);
      }

      await Deno.writeTextFile(filename, content);
      console.log(`\n💾 Report saved to: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to save report: ${error.message}`);
    }
  }

  private generateHTMLReport(report: MasterQAReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>FXD Quality Assurance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .score { font-weight: bold; color: #007acc; }
        .critical { color: #d73a49; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏆 FXD Master Quality Assurance Report</h1>
        <p><strong>Test Run:</strong> ${report.testRun.id}</p>
        <p><strong>Duration:</strong> ${Math.round(report.testRun.duration / 1000)}s</p>
        <p><strong>Overall Score:</strong> <span class="score">${report.overallSummary.overallScore}/100</span></p>
        <p><strong>Readiness:</strong> <span class="score">${report.overallSummary.readinessLevel.toUpperCase()}</span></p>
    </div>

    <div class="section">
        <h2>📊 Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Test Suites Passed</td><td>${report.overallSummary.passedSuites}/${report.overallSummary.totalSuites}</td></tr>
            <tr><td>Total Tests Passed</td><td>${report.overallSummary.passedTests}/${report.overallSummary.totalTests}</td></tr>
            <tr><td>Overall Grade</td><td>${report.certificationStatus.overallCertification}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>🏅 Certification Status</h2>
        <table>
            <tr><th>Quality Area</th><th>Score</th></tr>
            <tr><td>Functional Quality</td><td>${report.certificationStatus.functionalQuality}%</td></tr>
            <tr><td>Performance Quality</td><td>${report.certificationStatus.performanceQuality}%</td></tr>
            <tr><td>Usability Quality</td><td>${report.certificationStatus.usabilityQuality}%</td></tr>
            <tr><td>Compatibility Quality</td><td>${report.certificationStatus.compatibilityQuality}%</td></tr>
            <tr><td>Documentation Quality</td><td>${report.certificationStatus.documentationQuality}%</td></tr>
            <tr><td>Integration Quality</td><td>${report.certificationStatus.integrationQuality}%</td></tr>
        </table>
    </div>

    ${report.criticalIssues.length > 0 ? `
    <div class="section">
        <h2 class="critical">🚨 Critical Issues</h2>
        <ul>
            ${report.criticalIssues.map(issue => `<li class="critical">${issue}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>💡 Recommendations</h2>
        <ul>
            ${report.recommendations.slice(0, 10).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `;
  }

  private generateTextReport(report: MasterQAReport): string {
    const lines = [
      'FXD MASTER QUALITY ASSURANCE REPORT',
      '='.repeat(40),
      '',
      `Test Run: ${report.testRun.id}`,
      `Duration: ${Math.round(report.testRun.duration / 1000)}s`,
      `Platform: ${report.testRun.platform}`,
      '',
      'OVERALL SUMMARY:',
      `  Test Suites: ${report.overallSummary.passedSuites}/${report.overallSummary.totalSuites} passed`,
      `  Total Tests: ${report.overallSummary.passedTests}/${report.overallSummary.totalTests} passed`,
      `  Overall Score: ${report.overallSummary.overallScore}/100`,
      `  Readiness Level: ${report.overallSummary.readinessLevel.toUpperCase()}`,
      '',
      'CERTIFICATION STATUS:',
      `  Overall Grade: ${report.certificationStatus.overallCertification}`,
      `  Functional Quality: ${report.certificationStatus.functionalQuality}%`,
      `  Performance Quality: ${report.certificationStatus.performanceQuality}%`,
      `  Usability Quality: ${report.certificationStatus.usabilityQuality}%`,
      `  Compatibility Quality: ${report.certificationStatus.compatibilityQuality}%`,
      `  Documentation Quality: ${report.certificationStatus.documentationQuality}%`,
      `  Integration Quality: ${report.certificationStatus.integrationQuality}%`,
      ''
    ];

    if (report.criticalIssues.length > 0) {
      lines.push('CRITICAL ISSUES:');
      report.criticalIssues.forEach(issue => lines.push(`  ${issue}`));
      lines.push('');
    }

    lines.push('RECOMMENDATIONS:');
    report.recommendations.slice(0, 10).forEach(rec => lines.push(`  ${rec}`));

    return lines.join('\n');
  }
}

// === CLI RUNNER ===

async function main() {
  const args = Deno.args;
  const options: RunOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--suites' && i + 1 < args.length) {
      options.suites = args[++i].split(',');
    } else if (arg === '--skip-slow') {
      options.skipSlow = true;
    } else if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--format' && i + 1 < args.length) {
      options.reportFormat = args[++i] as any;
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputFile = args[++i];
    } else if (arg === '--stop-on-failure') {
      options.stopOnFailure = true;
    } else if (arg === '--verbose') {
      options.verbosity = 'verbose';
    } else if (arg === '--minimal') {
      options.verbosity = 'minimal';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
🎯 FXD Master QA Runner

USAGE:
  deno run --allow-all master-qa-runner.ts [options]

OPTIONS:
  --suites <suites>      Comma-separated list of suites to run
                         Options: all, fast, critical, endToEnd, crossPlatform,
                                 workflows, performance, documentation, integration
  --skip-slow           Skip slow/heavy tests for faster runs
  --parallel            Run compatible suites in parallel
  --format <format>     Report format: console, json, html
  --output <file>       Save report to file
  --stop-on-failure     Stop execution on first suite failure
  --verbose             Verbose output
  --minimal             Minimal output
  --help, -h            Show this help

EXAMPLES:
  # Run all suites
  deno run --allow-all master-qa-runner.ts

  # Run only critical suites quickly
  deno run --allow-all master-qa-runner.ts --suites critical --skip-slow

  # Run fast suites in parallel with JSON output
  deno run --allow-all master-qa-runner.ts --suites fast --parallel --format json --output report.json

  # Run specific suites
  deno run --allow-all master-qa-runner.ts --suites endToEnd,integration,documentation
      `);
      Deno.exit(0);
    }
  }

  const runner = new MasterQARunner(options);
  const report = await runner.runAllSuites();

  // Exit with appropriate code
  const exitCode = report.overallSummary.readinessLevel === 'experimental' ? 2 :
                   report.overallSummary.readinessLevel === 'development' ? 1 : 0;

  Deno.exit(exitCode);
}

// Run if this is the main module
if (import.meta.main) {
  await main();
}

export { MasterQARunner };