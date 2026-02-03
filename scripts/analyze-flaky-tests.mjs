#!/usr/bin/env node

/**
 * Flaky Test Analyzer
 * 
 * Analyzes Playwright test results to detect and report flaky tests.
 * A flaky test is one that required retries to pass or exhibited
 * inconsistent behavior across runs.
 * 
 * Usage:
 *   node scripts/analyze-flaky-tests.mjs [test-results-dir]
 * 
 * Default test-results-dir: ./test-results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RETRY_PATTERN = /-retry\d+$/;
const TEST_RESULTS_DIR = process.argv[2] || path.join(process.cwd(), 'test-results');

/**
 * Analyze test results for flaky tests
 */
function analyzeFlakyTests() {
  console.log('🔍 Analyzing test results for flaky tests...\n');
  
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    console.log(`❌ Test results directory not found: ${TEST_RESULTS_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(TEST_RESULTS_DIR, { withFileTypes: true });
  const retryDirs = entries
    .filter(entry => entry.isDirectory() && RETRY_PATTERN.test(entry.name))
    .map(entry => entry.name);

  if (retryDirs.length === 0) {
    console.log('✅ No flaky tests detected - all tests passed on first attempt!\n');
    return { flakyTests: [], totalRetries: 0 };
  }

  console.log(`⚠️  Found ${retryDirs.length} test retry attempt(s)\n`);

  // Group retries by test name
  const testRetries = new Map();
  
  retryDirs.forEach(dirName => {
    const testName = dirName.replace(RETRY_PATTERN, '');
    const retryNumber = parseInt(dirName.match(/retry(\d+)$/)?.[1] || '1', 10);
    
    if (!testRetries.has(testName)) {
      testRetries.set(testName, []);
    }
    testRetries.get(testName).push(retryNumber);
  });

  // Report flaky tests
  console.log('📊 Flaky Test Report:\n');
  console.log('┌─────────────────────────────────────────────────────────┬──────────┐');
  console.log('│ Test Name                                                │ Retries  │');
  console.log('├─────────────────────────────────────────────────────────┼──────────┤');

  const flakyTests = Array.from(testRetries.entries())
    .map(([testName, retries]) => ({
      name: testName,
      retryCount: retries.length,
      retries: retries.sort((a, b) => a - b)
    }))
    .sort((a, b) => b.retryCount - a.retryCount);

  flakyTests.forEach(({ name, retryCount }) => {
    const truncatedName = name.length > 50 
      ? name.substring(0, 47) + '...' 
      : name.padEnd(50);
    console.log(`│ ${truncatedName} │ ${retryCount.toString().padStart(8)} │`);
  });

  console.log('└─────────────────────────────────────────────────────────┴──────────┘\n');

  // Severity assessment
  const totalRetries = flakyTests.reduce((sum, test) => sum + test.retryCount, 0);
  const severityLevel = totalRetries <= 2 ? 'LOW' : totalRetries <= 5 ? 'MEDIUM' : 'HIGH';
  
  console.log(`📈 Summary:`);
  console.log(`   Total flaky tests: ${flakyTests.length}`);
  console.log(`   Total retry attempts: ${totalRetries}`);
  console.log(`   Severity: ${severityLevel}\n`);

  if (severityLevel === 'HIGH') {
    console.log('🚨 HIGH severity detected! Please investigate these tests immediately.');
    console.log('   Consider adding wait conditions or improving test isolation.\n');
  } else if (severityLevel === 'MEDIUM') {
    console.log('⚠️  MEDIUM severity - monitor these tests in future runs.\n');
  }

  // Generate GitHub Actions output if in CI
  if (process.env.GITHUB_ACTIONS === 'true') {
    generateGitHubOutput(flakyTests, totalRetries, severityLevel);
  }

  // Generate markdown report
  const markdownReport = generateMarkdownReport(flakyTests, totalRetries, severityLevel);
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, 'flaky-tests.md');
  fs.writeFileSync(reportPath, markdownReport);
  console.log(`📄 Markdown report saved to: ${reportPath}\n`);

  return { flakyTests, totalRetries, severityLevel };
}

/**
 * Generate GitHub Actions output
 */
function generateGitHubOutput(flakyTests, totalRetries, severityLevel) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const emoji = severityLevel === 'HIGH' ? '🚨' : severityLevel === 'MEDIUM' ? '⚠️' : '📊';
  
  let summary = `## ${emoji} Flaky Test Analysis\n\n`;
  summary += `**Severity:** ${severityLevel}\n`;
  summary += `**Flaky Tests:** ${flakyTests.length}\n`;
  summary += `**Total Retries:** ${totalRetries}\n\n`;

  if (flakyTests.length > 0) {
    summary += `### Tests Requiring Investigation\n\n`;
    summary += `| Test Name | Retry Count |\n`;
    summary += `|-----------|-------------|\n`;
    flakyTests.forEach(({ name, retryCount }) => {
      summary += `| ${name} | ${retryCount} |\n`;
    });
    summary += `\n`;
  }

  if (severityLevel === 'HIGH') {
    summary += `### ⚠️ Action Required\n\n`;
    summary += `The flaky test rate is HIGH. Please:\n`;
    summary += `1. Review the failing tests\n`;
    summary += `2. Add explicit waits or improve test isolation\n`;
    summary += `3. Consider temporarily skipping tests with \`test.skip()\` if needed\n\n`;
  }

  fs.appendFileSync(summaryPath, summary);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(flakyTests, totalRetries, severityLevel) {
  const timestamp = new Date().toISOString();
  
  let report = `# Flaky Test Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Severity:** ${severityLevel}\n`;
  report += `**Total Flaky Tests:** ${flakyTests.length}\n`;
  report += `**Total Retry Attempts:** ${totalRetries}\n\n`;

  if (flakyTests.length === 0) {
    report += `## ✅ No Flaky Tests\n\n`;
    report += `All tests passed on first attempt. Great job!\n`;
    return report;
  }

  report += `## Flaky Tests by Retry Count\n\n`;
  flakyTests.forEach(({ name, retryCount, retries }) => {
    report += `### ${name}\n\n`;
    report += `- **Retry Count:** ${retryCount}\n`;
    report += `- **Retry Numbers:** ${retries.join(', ')}\n`;
    report += `- **Severity:** ${retryCount >= 3 ? 'HIGH' : retryCount >= 2 ? 'MEDIUM' : 'LOW'}\n\n`;
  });

  report += `## Recommendations\n\n`;
  
  if (severityLevel === 'HIGH') {
    report += `### 🚨 Critical Action Required\n\n`;
    report += `1. **Immediate:** Review and fix high-retry tests\n`;
    report += `2. **Short-term:** Add \`test.skip()\` for consistently flaky tests\n`;
    report += `3. **Long-term:** Investigate root causes (timing, state, environment)\n\n`;
  } else if (severityLevel === 'MEDIUM') {
    report += `### ⚠️ Monitor and Improve\n\n`;
    report += `1. Monitor these tests in future runs\n`;
    report += `2. Add explicit waits where timing is an issue\n`;
    report += `3. Review test isolation and cleanup\n\n`;
  } else {
    report += `### 📊 Low Impact\n\n`;
    report += `1. Monitor in future runs\n`;
    report += `2. No immediate action required\n\n`;
  }

  report += `## Investigation Steps\n\n`;
  report += `1. Review test artifacts in \`test-results/<test-name>-retry*/\`\n`;
  report += `2. Check trace files for timing issues\n`;
  report += `3. Look for common patterns across flaky tests\n`;
  report += `4. Consider adding more stable selectors or wait conditions\n\n`;

  return report;
}

// Run analysis
try {
  const result = analyzeFlakyTests();
  
  // Exit with non-zero if HIGH severity
  if (result.severityLevel === 'HIGH') {
    console.log('⚠️  Exiting with status 1 due to HIGH severity flaky tests\n');
    process.exit(1);
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error analyzing flaky tests:', error.message);
  process.exit(1);
}
