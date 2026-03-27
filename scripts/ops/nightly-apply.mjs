/* eslint-disable no-console -- CLI ops script */
/**
 * nightly-apply — Classification → GitHub Issue 起票
 *
 * Phase C-2: classification JSON を読み、actionable な項目を GitHub Issue として起票する。
 *
 * Modes:
 *   --dry-run   Issue 本文を表示するだけで起票しない（デフォルト）
 *   --apply     実際に `gh issue create` を実行する
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║ SAFETY RULES                                               ║
 * ║                                                            ║
 * ║ 1. log-only → 何もしない                                    ║
 * ║ 2. needs-review → Issue のみ、PR 自動化しない               ║
 * ║ 3. auto-fixable → draft-issue（PR 自動化は Phase C-3）      ║
 * ║ 4. デフォルトは dry-run（--apply 必須）                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node scripts/ops/nightly-apply.mjs                         # dry-run
 *   node scripts/ops/nightly-apply.mjs --apply                 # 実行
 *   node scripts/ops/nightly-apply.mjs --date 2026-03-27       # 日付指定
 *
 * @see scripts/ops/nightly-classify.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

// ─── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');
const dateArgIdx = args.indexOf('--date');
const dateArg = dateArgIdx >= 0 ? args[dateArgIdx + 1] : null;

// Resolve date: explicit arg or today
const today = new Date();
const stamp = dateArg || [
  today.getUTCFullYear(),
  String(today.getUTCMonth() + 1).padStart(2, '0'),
  String(today.getUTCDate()).padStart(2, '0'),
].join('-');

// ─── Load Classification ────────────────────────────────────────────────────

const classificationPath = path.join(REPORT_DIR, `classification-${stamp}.json`);
if (!fs.existsSync(classificationPath)) {
  console.error(`❌ Classification file not found: ${classificationPath}`);
  console.error('   Run nightly-patrol.mjs first to generate classification.');
  process.exit(1);
}

const classification = JSON.parse(fs.readFileSync(classificationPath, 'utf8'));
console.log(`📋 Loaded classification for ${classification.date}`);
console.log(`   Overall: ${classification.overall}`);
console.log(`   Actions: ${classification.actions.length}`);
console.log(`   Mode: ${isDryRun ? '🔒 DRY-RUN' : '🚀 APPLY'}`);
console.log('');

// ─── Issue Body Builders ────────────────────────────────────────────────────

const SEVERITY_EMOJI = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const ACTION_LABELS = {
  'draft-issue': 'needs human review',
  'draft-pr': 'auto-fixable candidate',
  'log-only': 'monitoring only',
};

/**
 * Build GitHub Issue body from a classification entry.
 * Pure function.
 *
 * @param {object} entry - classification entry
 * @param {string} date - patrol date
 * @returns {{ title: string, body: string, labels: string[] }}
 */
function buildIssueContent(entry, date) {
  const emoji = SEVERITY_EMOJI[entry.severity] || '⚪';
  const kindLabel = entry.kind.replace(/-/g, ' ');

  const title = `[nightly-patrol] ${emoji} ${entry.severity}: ${kindLabel} (${date})`;

  const lines = [
    `## Nightly Patrol Detection — ${date}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Kind | \`${entry.kind}\` |`,
    `| Severity | ${emoji} ${entry.severity} |`,
    `| Classification | ${entry.classification} |`,
    `| Action | ${ACTION_LABELS[entry.action] || entry.action} |`,
    `| Error Count | ${entry.errorCount} |`,
    `| Test Only | ${entry.isTestOnly ? '✅ Yes' : '❌ No'} |`,
    '',
    '### Source',
    '',
    `- **Patrol date:** ${date}`,
    `- **Classification:** ${entry.classification}`,
    `- **Pipeline:** nightly-patrol → nightly-classify → nightly-apply`,
    `- **Report:** \`docs/nightly-patrol/${date}.md\``,
    '',
  ];

  // Affected files
  if (entry.affectedFiles && entry.affectedFiles.length > 0) {
    lines.push('### Affected Files');
    lines.push('');
    for (const f of entry.affectedFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  // Suggested action
  lines.push('### Suggested Action');
  lines.push('');

  if (entry.classification === 'auto-fixable') {
    lines.push('This issue is classified as **auto-fixable** (test/stub files only).');
    lines.push('');
    lines.push('Suggested fix:');
    lines.push('1. Update test expectations to match current implementation');
    lines.push('2. Fix type annotations in test files');
    lines.push('3. Add missing exports to module stubs');
    lines.push('');
    lines.push('> 💡 This may be a candidate for automated PR in a future Phase C-3 cycle.');
  } else if (entry.classification === 'needs-review') {
    lines.push('This issue requires **human review** — it involves production code or unclassifiable errors.');
    lines.push('');
    lines.push('Steps:');
    lines.push('1. Review the affected files and error details');
    lines.push('2. Determine root cause');
    lines.push('3. Create a fix PR with appropriate test coverage');
  } else if (entry.classification === 'monitor') {
    lines.push('This is a **monitoring** item — no immediate action required.');
    lines.push('');
    lines.push('Review during next refactoring cycle or when files are modified.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Auto-generated by Nightly Patrol Phase C-2 — ${date}*`);

  // Labels
  const labels = ['nightly-patrol'];
  if (entry.severity === 'critical' || entry.severity === 'high') {
    labels.push('priority-high');
  } else {
    labels.push(`priority-${entry.severity}`);
  }
  if (entry.kind.includes('test') || entry.kind.includes('typecheck')) {
    labels.push('testing');
  }
  if (entry.kind.includes('large-file')) {
    labels.push('tech-debt');
  }
  if (entry.classification === 'auto-fixable') {
    labels.push('auto-fixable');
  }

  return {
    title,
    body: lines.join('\n'),
    labels,
  };
}

// ─── Execution ──────────────────────────────────────────────────────────────

const actionableEntries = classification.classifications.filter(
  (c) => c.classification !== 'monitor' || c.severity === 'critical' || c.severity === 'high',
);

// Also load issueDrafts from Phase B if they exist (for monitor items that crossed threshold)
const issueDraftsPath = path.join(REPORT_DIR, `issue-drafts-${stamp}.md`);
const hasIssueDrafts = fs.existsSync(issueDraftsPath);

if (actionableEntries.length === 0) {
  console.log('✅ No actionable items. System is stable.');
  console.log('');
  if (hasIssueDrafts) {
    console.log(`   ℹ️  Phase B issue drafts available at: ${issueDraftsPath}`);
  }
  process.exit(0);
}

console.log(`📝 Processing ${actionableEntries.length} actionable item(s)...`);
console.log('');

const results = [];

for (const entry of actionableEntries) {
  // ╔═══════════════════════════════════════╗
  // ║ GUARD: log-only → skip               ║
  // ╚═══════════════════════════════════════╝
  if (entry.action === 'log-only' && entry.severity !== 'critical') {
    console.log(`   ⏭️  Skipping ${entry.kind} (log-only, severity=${entry.severity})`);
    continue;
  }

  const issue = buildIssueContent(entry, classification.date);

  console.log(`   ${SEVERITY_EMOJI[entry.severity] || '⚪'} ${entry.kind}`);
  console.log(`      Title:  ${issue.title}`);
  console.log(`      Labels: ${issue.labels.join(', ')}`);
  console.log(`      Action: ${entry.classification}`);

  if (isDryRun) {
    console.log('      Mode:   🔒 DRY-RUN (not creating issue)');
    console.log('');
    console.log('      --- Issue Body Preview ---');
    // Show first 10 lines of body
    const bodyLines = issue.body.split('\n');
    for (const line of bodyLines.slice(0, 15)) {
      console.log(`      | ${line}`);
    }
    if (bodyLines.length > 15) {
      console.log(`      | ... (${bodyLines.length - 15} more lines)`);
    }
    console.log('      ---');
    console.log('');
    results.push({ kind: entry.kind, status: 'dry-run', title: issue.title });
  } else {
    // ╔═══════════════════════════════════════════════════════╗
    // ║ APPLY: Create GitHub Issue via gh CLI                 ║
    // ╚═══════════════════════════════════════════════════════╝
    try {
      // Write body to temp file to avoid shell escaping issues
      const tmpBodyPath = path.join(ROOT, '.nightly-issue-body.tmp.md');
      fs.writeFileSync(tmpBodyPath, issue.body, 'utf8');

      const labelArgs = issue.labels.map((l) => `--label "${l}"`).join(' ');
      const cmd = `gh issue create --title "${issue.title}" --body-file "${tmpBodyPath}" ${labelArgs}`;

      console.log(`      Executing: gh issue create...`);
      const output = execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim();
      console.log(`      ✅ Created: ${output}`);

      // Cleanup
      fs.unlinkSync(tmpBodyPath);

      results.push({ kind: entry.kind, status: 'created', url: output, title: issue.title });
    } catch (err) {
      console.error(`      ❌ Failed to create issue: ${err.message}`);
      results.push({ kind: entry.kind, status: 'failed', error: err.message, title: issue.title });
    }
    console.log('');
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('');
console.log('=== Apply Summary ===');
console.log(`  Mode:     ${isDryRun ? '🔒 DRY-RUN' : '🚀 APPLIED'}`);
console.log(`  Items:    ${results.length}`);

const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log(`  Results:  ${Object.entries(byStatus).map(([k, v]) => `${k}:${v}`).join(' ')}`);

if (results.some((r) => r.url)) {
  console.log('');
  console.log('  Created Issues:');
  for (const r of results.filter((r) => r.url)) {
    console.log(`    ${r.url}`);
  }
}

console.log('');

// Write apply results
const skippedCount = actionableEntries.length - results.length;
const applySummary = {
  total: actionableEntries.length,
  processed: results.length,
  skipped: skippedCount,
  created: results.filter((r) => r.status === 'created').length,
  dryRun: results.filter((r) => r.status === 'dry-run').length,
  failed: results.filter((r) => r.status === 'failed').length,
};

const applyResultsPath = path.join(REPORT_DIR, `apply-results-${stamp}.json`);
fs.writeFileSync(applyResultsPath, JSON.stringify({
  version: 1,
  date: stamp,
  mode: isDryRun ? 'dry-run' : 'apply',
  summary: applySummary,
  results,
}, null, 2), 'utf8');
console.log(`📄 Results written: docs/nightly-patrol/apply-results-${stamp}.json`);
console.log('');
