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

// ─── Load Decision (optional) ───────────────────────────────────────────────

const decisionPath = path.join(REPORT_DIR, `decision-${stamp}.json`);
const decision = fs.existsSync(decisionPath)
  ? JSON.parse(fs.readFileSync(decisionPath, 'utf8'))
  : null;

const REASON_CODE_META = {
  ADMIN_STATUS_FAIL: {
    domain: 'health',
    signal: '/admin/status が FAIL',
    action: '/admin/status を優先修復',
    suggestedLabel: 'kind:health',
  },
  ADMIN_STATUS_WARN: {
    domain: 'health',
    signal: '/admin/status が WARN',
    action: '/admin/status の WARN を監視',
    suggestedLabel: 'kind:health',
  },
  ADMIN_STATUS_SUMMARY_MISSING: {
    domain: 'observability',
    signal: '/admin/status summary 欠損',
    action: 'raw JSON 供給経路を復旧',
    suggestedLabel: 'kind:observability',
  },
  EXCEPTION_HIGH_SEVERITY: {
    domain: 'exception',
    signal: 'high severity 例外あり',
    action: '/admin/exception-center の high severity を解消',
    suggestedLabel: 'kind:exception',
  },
  EXCEPTION_OVERDUE_PRESENT: {
    domain: 'exception',
    signal: '期限超過例外あり',
    action: 'overdue 例外の解消計画を実施',
    suggestedLabel: 'kind:exception',
  },
  EXCEPTION_STALE_PRESENT: {
    domain: 'exception',
    signal: '放置例外あり',
    action: '放置時間の長い例外を優先解消',
    suggestedLabel: 'kind:exception',
  },
  EXCEPTION_RECURRING_PRESENT: {
    domain: 'exception',
    signal: '再発例外あり',
    action: '再発キーの恒久対策を実施',
    suggestedLabel: 'kind:exception',
  },
  EXCEPTION_CENTER_SUMMARY_MISSING: {
    domain: 'observability',
    signal: 'ExceptionCenter summary 欠損',
    action: 'raw JSON 供給経路を復旧',
    suggestedLabel: 'kind:observability',
  },
  CI_GATE_FAILURE: {
    domain: 'quality',
    signal: 'CI gate failure',
    action: '失敗ゲートを解消',
    suggestedLabel: 'kind:quality',
  },
  PATROL_NEEDS_REVIEW: {
    domain: 'quality',
    signal: 'Nightly Patrol needs-review',
    action: '分類対象を人手で確認',
    suggestedLabel: 'kind:quality',
  },
  INDEX_PRESSURE_FAIL: {
    domain: 'infrastructure',
    signal: 'SharePoint インデックス不足/圧迫',
    action: '提案された修復コマンドを実行',
    suggestedLabel: 'kind:infrastructure',
  },
  default: {
    domain: 'operations',
    signal: 'Nightly 判定シグナル',
    action: '判定理由を確認',
    suggestedLabel: 'kind:operations',
  },
};

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function resolveReasonMeta(code) {
  const watchStreakMatch = /^WATCH_STREAK_(\d+)D::(.+)$/.exec(code);
  if (watchStreakMatch) {
    const days = watchStreakMatch[1];
    const sourceCode = watchStreakMatch[2];
    return {
      domain: 'operations',
      signal: `${days}日連続 Watch (${sourceCode})`,
      action: `慢性化した warn code (${sourceCode}) の根本対応を実施`,
      suggestedLabel: 'kind:operations',
    };
  }
  return REASON_CODE_META[code] || REASON_CODE_META.default;
}

function buildReasonRows(codes, level) {
  return (Array.isArray(codes) ? codes : []).map((code) => {
    const meta = resolveReasonMeta(code);
    return {
      code,
      level,
      domain: meta.domain,
      signal: meta.signal,
      action: meta.action,
      suggestedLabel: meta.suggestedLabel,
    };
  });
}

function buildDecisionContext(decisionJson) {
  if (!decisionJson || typeof decisionJson !== 'object') {
    return {
      exists: false,
      finalLabel: null,
      finalLine: null,
      failCodes: [],
      warnCodes: [],
      rows: [],
      suggestedLabels: [],
    };
  }

  const failCodes = uniqueStrings(decisionJson?.reasonCodes?.fail || []);
  const warnCodes = uniqueStrings(decisionJson?.reasonCodes?.warn || []);
  const rows = [
    ...buildReasonRows(failCodes, 'fail'),
    ...buildReasonRows(warnCodes, 'warn'),
  ];
  const suggestedLabels = uniqueStrings(rows.map((row) => row.suggestedLabel));

  return {
    exists: true,
    finalLabel: decisionJson?.final?.label || null,
    finalLine: decisionJson?.final?.line || null,
    failCodes,
    warnCodes,
    rows,
    suggestedLabels,
  };
}

const decisionContext = buildDecisionContext(decision);
if (decisionContext.exists) {
  console.log(`🧾 Loaded decision context: ${decisionPath}`);
  console.log(`   Final: ${decisionContext.finalLabel || 'n/a'}`);
  if (decisionContext.failCodes.length > 0) {
    console.log(`   Fail codes: ${decisionContext.failCodes.join(', ')}`);
  }
  if (decisionContext.warnCodes.length > 0) {
    console.log(`   Warn codes: ${decisionContext.warnCodes.join(', ')}`);
  }
  console.log('');
}

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
function buildIssueContent(entry, date, context = null) {
  const emoji = SEVERITY_EMOJI[entry.severity] || '⚪';
  const kindLabel = entry.kind === 'nightly-decision-control'
    ? 'nightly decision control'
    : entry.kind.replace(/-/g, ' ');

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

  // Index Pressure details
  if (entry.kind === 'index-pressure' && entry.details) {
    lines.push('### Failed SharePoint Indexes');
    lines.push('');
    lines.push('| List | Display Name | Count | Action |');
    lines.push('|------|--------------|:-----:|--------|');
    for (const d of entry.details) {
      lines.push(`| \`${d.list}\` | ${d.displayName} | ${d.count}/20 | 修復コマンドを実行 |`);
    }
    lines.push('');
    
    lines.push('### Remediation Proposals');
    lines.push('');
    for (const d of entry.details) {
      lines.push(`#### List: ${d.displayName} (${d.list})`);
      lines.push('```bash');
      lines.push(`npx tsx scripts/ops/index-remediate-targeted.ts --list "${d.list}" --apply`);
      lines.push('```');
      if (d.remediation && d.remediation.length > 0) {
        lines.push('');
        lines.push('**Dry-run hints:**');
        for (const r of d.remediation) {
          lines.push(`- ${r.internalName}: ${r.message}`);
        }
      }
      lines.push('');
    }
  }

  // Suggested action
  lines.push('### Suggested Action');
  lines.push('');

  if (entry.kind === 'nightly-decision-control') {
    lines.push('This issue is generated from **nightly decision reason codes**.');
    lines.push('');
    lines.push('Steps:');
    lines.push('1. `decision-<date>.json` の fail reason codes を優先順で対応');
    lines.push('2. 欠損コード (`*_MISSING`) は観測経路を復旧');
    lines.push('3. 例外系コードは `/admin/exception-center` で未解消項目を解消');
  } else if (entry.classification === 'auto-fixable') {
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

  if (context?.exists) {
    lines.push('');
    lines.push('### Nightly Decision Context');
    lines.push('');
    lines.push(`- Final verdict: ${context.finalLine || context.finalLabel || 'n/a'}`);
    lines.push(`- Fail reason codes: ${context.failCodes.length > 0 ? `\`${context.failCodes.join(', ')}\`` : 'なし'}`);
    lines.push(`- Watch reason codes: ${context.warnCodes.length > 0 ? `\`${context.warnCodes.join(', ')}\`` : 'なし'}`);
    lines.push('');

    if (context.rows.length > 0) {
      lines.push('| Code | Level | Domain | Signal | Suggested Action |');
      lines.push('|------|:-----:|--------|--------|------------------|');
      for (const row of context.rows) {
        lines.push(`| \`${row.code}\` | ${row.level} | ${row.domain} | ${row.signal} | ${row.action} |`);
      }
      lines.push('');
      lines.push(`- Suggested labels from reason codes: ${context.suggestedLabels.length > 0 ? context.suggestedLabels.map((x) => `\`${x}\``).join(', ') : 'なし'}`);
    }
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
  if (entry.kind === 'index-pressure') {
    labels.push('infrastructure');
    labels.push('ops');
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

if (actionableEntries.length === 0 && decisionContext.failCodes.length > 0) {
  actionableEntries.push({
    kind: 'nightly-decision-control',
    severity: 'critical',
    classification: 'needs-review',
    action: 'draft-issue',
    errorCount: decisionContext.failCodes.length,
    isTestOnly: false,
    affectedFiles: [],
  });
}

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

  const issue = buildIssueContent(entry, classification.date, decisionContext);

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
    results.push({
      kind: entry.kind,
      status: 'dry-run',
      title: issue.title,
      decisionFailCodes: decisionContext.failCodes,
      decisionWarnCodes: decisionContext.warnCodes,
    });
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

      results.push({
        kind: entry.kind,
        status: 'created',
        url: output,
        title: issue.title,
        decisionFailCodes: decisionContext.failCodes,
        decisionWarnCodes: decisionContext.warnCodes,
      });
    } catch (err) {
      console.error(`      ❌ Failed to create issue: ${err.message}`);
      results.push({
        kind: entry.kind,
        status: 'failed',
        error: err.message,
        title: issue.title,
        decisionFailCodes: decisionContext.failCodes,
        decisionWarnCodes: decisionContext.warnCodes,
      });
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
  decision: {
    exists: decisionContext.exists,
    finalLabel: decisionContext.finalLabel,
    finalLine: decisionContext.finalLine,
    failCodes: decisionContext.failCodes,
    warnCodes: decisionContext.warnCodes,
    suggestedLabels: decisionContext.suggestedLabels,
  },
  summary: applySummary,
  results,
}, null, 2), 'utf8');
console.log(`📄 Results written: docs/nightly-patrol/apply-results-${stamp}.json`);
console.log('');
