/* eslint-disable no-console -- CLI ops script */
/**
 * E2E Stability Metrics Extractor
 *
 * Extracts structured stability metrics from:
 *   1. Playwright JSON report (test results, retries, flaky detection)
 *   2. Static code analysis (waitForTimeout count, test.skip count)
 *
 * Output: stability-metrics.json + GITHUB_STEP_SUMMARY table
 *
 * Usage:
 *   node scripts/ops/extractStabilityMetrics.mjs [json-report-path]
 *
 * Default json-report-path: test-results/results.json
 *
 * @see docs/operations/stabilization_ops_guide.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const JSON_REPORT_PATH = process.argv[2] || path.join(ROOT, 'test-results', 'results.json');
const OUTPUT_PATH = path.join(ROOT, 'stability-metrics.json');
const E2E_DIR = path.join(ROOT, 'tests', 'e2e');

// ─── 1. Playwright JSON Report Analysis ────────────────

function analyzePlaywrightReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.warn(`⚠️  Playwright JSON report not found: ${reportPath}`);
    return { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0, flakyRate: 0, flakyTests: [] };
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  let total = 0;
  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let skipped = 0;
  let timedOut = 0;
  const flakyTests = [];

  function walkSuites(suites) {
    for (const suite of suites) {
      if (suite.suites) walkSuites(suite.suites);

      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          total++;

          const results = test.results || [];
          const hasRetry = results.length > 1;
          const lastResult = results[results.length - 1];

          if (test.status === 'skipped' || test.status === 'pending') {
            skipped++;
          } else if (test.status === 'expected' || test.status === 'passed') {
            passed++;
            if (hasRetry) {
              flaky++;
              flakyTests.push({
                title: spec.title || test.title || 'unknown',
                file: spec.file || suite.file || 'unknown',
                retries: results.length - 1,
              });
            }
          } else if (test.status === 'unexpected' || test.status === 'failed') {
            failed++;
          } else if (test.status === 'timedOut') {
            timedOut++;
            failed++;
          }

          // Also check for timeout in results
          if (lastResult && lastResult.status === 'timedOut') {
            timedOut++;
          }
        }
      }
    }
  }

  walkSuites(report.suites || []);

  const flakyRate = total > 0 ? parseFloat(((flaky / total) * 100).toFixed(2)) : 0;

  return { total, passed, failed, flaky, skipped, timedOut, flakyRate, flakyTests };
}

// ─── 2. Static Code Analysis ────────────────────────────

function countWaitForTimeout() {
  try {
    const output = execSync(
      `git grep -c "waitForTimeout" -- "tests/e2e/*.spec.ts" "tests/e2e/*.spec.mts"`,
      { encoding: 'utf-8', cwd: ROOT },
    );
    let total = 0;
    const byFile = [];
    for (const line of output.trim().split('\n')) {
      const [file, countStr] = line.split(':');
      const count = parseInt(countStr, 10);
      if (!isNaN(count)) {
        total += count;
        byFile.push({ file: file.replace(/\\/g, '/'), count });
      }
    }
    return { total, byFile: byFile.sort((a, b) => b.count - a.count) };
  } catch {
    // git grep returns exit code 1 when no matches (which is good!)
    return { total: 0, byFile: [] };
  }
}

function countSkippedTests() {
  const patterns = ['describe.skip', 'test.skip', 'it.skip'];
  const results = { total: 0, byFile: [] };

  if (!fs.existsSync(E2E_DIR)) return results;

  const files = fs.readdirSync(E2E_DIR).filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.mts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(E2E_DIR, file), 'utf-8');
    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(new RegExp(pattern.replace('.', '\\.'), 'g'));
      if (matches) count += matches.length;
    }
    if (count > 0) {
      results.total += count;
      results.byFile.push({ file: `tests/e2e/${file}`, count });
    }
  }

  results.byFile.sort((a, b) => b.count - a.count);
  return results;
}

function countAbsoluteAssertions() {
  try {
    const output = execSync(
      `git grep -n "toHaveCount(" -- "tests/e2e/*.spec.ts"`,
      { encoding: 'utf-8', cwd: ROOT },
    );
    let total = 0;
    let absoluteCount = 0;
    for (const line of output.trim().split('\n')) {
      total++;
      // toHaveCount(N) where N >= 2 and not 0
      if (/toHaveCount\(\s*[2-9]\d*\s*\)/.test(line)) {
        absoluteCount++;
      }
    }
    return { total, absoluteCount };
  } catch {
    return { total: 0, absoluteCount: 0 };
  }
}

// ─── 3. Execute & Output ────────────────────────────────

console.log('📊 Extracting E2E stability metrics...\n');

// Playwright results
console.log('  1. Analyzing Playwright report...');
const pw = analyzePlaywrightReport(JSON_REPORT_PATH);

// Static analysis
console.log('  2. Counting waitForTimeout instances...');
const waitForTimeout = countWaitForTimeout();

console.log('  3. Counting skipped tests...');
const skippedTests = countSkippedTests();

console.log('  4. Counting absolute assertions...');
const absoluteAssertions = countAbsoluteAssertions();

// Build metrics object
const timestamp = new Date().toISOString();
const metrics = {
  timestamp,
  playwright: {
    total: pw.total,
    passed: pw.passed,
    failed: pw.failed,
    flaky: pw.flaky,
    skipped: pw.skipped,
    timedOut: pw.timedOut,
    flakyRate: pw.flakyRate,
    flakyTests: pw.flakyTests,
  },
  codeHealth: {
    waitForTimeout: {
      total: waitForTimeout.total,
      topFiles: waitForTimeout.byFile.slice(0, 5),
    },
    skippedTests: {
      total: skippedTests.total,
      files: skippedTests.byFile,
    },
    absoluteAssertions: {
      total: absoluteAssertions.total,
      risky: absoluteAssertions.absoluteCount,
    },
  },
  exitCriteria: {
    waitForTimeoutLe10: waitForTimeout.total <= 10,
    skippedTestsEq0: skippedTests.total === 0,
    flakyRateLt5: pw.flakyRate < 5,
    allMet: waitForTimeout.total <= 10 && skippedTests.total === 0 && pw.flakyRate < 5,
  },
};

// Write JSON
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(metrics, null, 2), 'utf-8');
console.log(`\n✅ Metrics written to: ${OUTPUT_PATH}`);

// Console summary
console.log('\n=== E2E Stability Metrics ===');
console.log(`  Tests:           ${pw.total} total, ${pw.passed} passed, ${pw.failed} failed, ${pw.skipped} skipped`);
console.log(`  Flaky:           ${pw.flaky} (${pw.flakyRate}%)`);
console.log(`  waitForTimeout:  ${waitForTimeout.total} instances`);
console.log(`  Skipped tests:   ${skippedTests.total} skip directives`);
console.log(`  Risky assertions: ${absoluteAssertions.absoluteCount} / ${absoluteAssertions.total} toHaveCount`);
console.log('');
console.log('  Exit Criteria:');
console.log(`    waitForTimeout ≤ 10:  ${metrics.exitCriteria.waitForTimeoutLe10 ? '✅' : '❌'} (${waitForTimeout.total})`);
console.log(`    skipped tests = 0:    ${metrics.exitCriteria.skippedTestsEq0 ? '✅' : '❌'} (${skippedTests.total})`);
console.log(`    flaky rate < 5%:      ${metrics.exitCriteria.flakyRateLt5 ? '✅' : '❌'} (${pw.flakyRate}%)`);
console.log(`    ALL MET:              ${metrics.exitCriteria.allMet ? '🎉 YES' : '⏳ NOT YET'}`);
console.log('');

// GitHub Step Summary
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = `## 📊 E2E Stability Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Tests (total) | ${pw.total} | — | — |
| Passed | ${pw.passed} | — | — |
| Failed | ${pw.failed} | 0 | ${pw.failed === 0 ? '✅' : '❌'} |
| Flaky (retried→passed) | ${pw.flaky} | 0 | ${pw.flaky === 0 ? '✅' : '⚠️'} |
| Flaky Rate | ${pw.flakyRate}% | < 5% | ${pw.flakyRate < 5 ? '✅' : '❌'} |
| \`waitForTimeout\` instances | ${waitForTimeout.total} | ≤ 10 | ${waitForTimeout.total <= 10 ? '✅' : '⚠️'} |
| Skipped test directives | ${skippedTests.total} | 0 | ${skippedTests.total === 0 ? '✅' : '⚠️'} |
| Risky \`toHaveCount(N≥2)\` | ${absoluteAssertions.absoluteCount} | ≤ 3 | ${absoluteAssertions.absoluteCount <= 3 ? '✅' : '⚠️'} |

### Exit Criteria: ${metrics.exitCriteria.allMet ? '🎉 ALL MET' : '⏳ In Progress'}

${pw.flakyTests.length > 0 ? `### Flaky Tests Detail\n\n| Test | File | Retries |\n|------|------|---------|\n${pw.flakyTests.map(t => `| ${t.title} | ${t.file} | ${t.retries} |`).join('\n')}\n` : ''}
${waitForTimeout.byFile.length > 0 ? `### Top waitForTimeout Files\n\n| File | Count |\n|------|-------|\n${waitForTimeout.byFile.slice(0, 5).map(f => `| ${f.file} | ${f.count} |`).join('\n')}\n` : ''}
`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
