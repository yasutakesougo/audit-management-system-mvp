/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly Patrol — Phase A (観測のみ)
 *
 * リポジトリのコード品質を巡回し、レポートを出力します。
 * Issue は作成しません。変更はレポートファイルの追加のみです。
 *
 * 巡回観点:
 *   1. 巨大ファイル (600行超)
 *   2. 型安全性 (any / as any)
 *   3. TODO / FIXME / HACK
 *   4. テストファイル比率
 *   5. Handoff 未実施チェック
 *
 * @see docs/operations/ai-dev-os-rules.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildIssueDrafts } from './buildIssueDrafts.mjs';
import { classify } from './nightly-classify.mjs';
import { renderIssueDraftMarkdown } from './renderIssueDraftMarkdown.mjs';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

// --- Date ---

const today = new Date();
const yyyy = today.getUTCFullYear();
const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
const dd = String(today.getUTCDate()).padStart(2, '0');
const stamp = `${yyyy}-${mm}-${dd}`;

// --- Optional CI Inputs (act warning monitor) ---

const ACT_WARNING_SUMMARY_PATH = process.env.ACT_WARNING_SUMMARY_PATH || '';
const ACT_WARNING_OPEN_ISSUE_COUNT = Number(process.env.ACT_WARNING_OPEN_ISSUE_COUNT || '0');
const ACT_WARNING_OPEN_ISSUE_URL = process.env.ACT_WARNING_OPEN_ISSUE_URL || '';

// --- Optional CI Inputs (gate results for Phase C classify) ---

const GATE_UNIT_TEST_FAILED = Number(process.env.NIGHTLY_TEST_FAILED || '0');
const GATE_UNIT_TEST_TOTAL = Number(process.env.NIGHTLY_TEST_TOTAL || '0');
const GATE_TYPECHECK_ERRORS = Number(process.env.NIGHTLY_TYPECHECK_ERRORS || '0');
const GATE_TYPECHECK_ERROR_FILES = (process.env.NIGHTLY_TYPECHECK_ERROR_FILES || '')
  .split(',')
  .filter(Boolean);

let actWarningSummary = null;
if (ACT_WARNING_SUMMARY_PATH && fs.existsSync(ACT_WARNING_SUMMARY_PATH)) {
  try {
    const raw = fs.readFileSync(ACT_WARNING_SUMMARY_PATH, 'utf8');
    actWarningSummary = JSON.parse(raw);
  } catch {
    actWarningSummary = null;
  }
}

const SP_TELEMETRY_PATH = process.env.SP_TELEMETRY_PATH || '';
let spTelemetrySummary = null;
if (SP_TELEMETRY_PATH && fs.existsSync(SP_TELEMETRY_PATH)) {
  try {
    spTelemetrySummary = JSON.parse(fs.readFileSync(SP_TELEMETRY_PATH, 'utf8'));
  } catch {
    spTelemetrySummary = null;
  }
}

const ORCHESTRATION_AUDIT_PATH = process.env.ORCHESTRATION_AUDIT_PATH || '';
let orchestrationAuditSummary = null;
if (ORCHESTRATION_AUDIT_PATH && fs.existsSync(ORCHESTRATION_AUDIT_PATH)) {
  try {
    orchestrationAuditSummary = JSON.parse(fs.readFileSync(ORCHESTRATION_AUDIT_PATH, 'utf8'));
  } catch {
    orchestrationAuditSummary = null;
  }
}

const CONTRACT_DRIFT_PATH = path.join(REPORT_DIR, 'contract-drift.json');
let contractDriftSummary = null;
if (fs.existsSync(CONTRACT_DRIFT_PATH)) {
  try {
    contractDriftSummary = JSON.parse(fs.readFileSync(CONTRACT_DRIFT_PATH, 'utf8'));
  } catch {
    contractDriftSummary = null;
  }
}

const INDEX_PRESSURE_PATH = path.join(REPORT_DIR, 'index-pressure.json');
let indexPressureSummary = null;
if (fs.existsSync(INDEX_PRESSURE_PATH)) {
  try {
    indexPressureSummary = JSON.parse(fs.readFileSync(INDEX_PRESSURE_PATH, 'utf8'));
  } catch {
    indexPressureSummary = null;
  }
}

// --- File Walking ---

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  'test-results',
  '.wrangler',
  '.storybook',
  '.lighthouseci',
  'tmp',
]);

function walk(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

function toRepoPath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function countLines(text) {
  return text === '' ? 0 : text.split('\n').length;
}

function isCodeFile(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function isTestFile(file) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(file);
}

function isSrcFile(file) {
  return file.startsWith('src/');
}

// --- Scan ---

console.log('🔍 Starting nightly patrol...');

const allFiles = walk(ROOT).map(toRepoPath);
const codeFiles = allFiles.filter(isCodeFile);
const srcCodeFiles = codeFiles.filter(isSrcFile);
const srcNonTestFiles = srcCodeFiles.filter((f) => !isTestFile(f));
const srcTestFiles = srcCodeFiles.filter(isTestFile);

// 1. Large Files (src only, non-test)
console.log('  Checking large files...');
const largeFiles = srcNonTestFiles
  .map((file) => {
    const text = readText(path.join(ROOT, file));
    return { file, lines: countLines(text) };
  })
  .filter((x) => x.lines >= 600)
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 30);

// 2. Type Safety (any detection in src, excluding test files and type declarations)
console.log('  Checking type safety...');
const anyHits = [];

// Patterns that indicate actual `any` usage (not words containing "any")
const ANY_PATTERNS = [
  /:\s*any\b/,           // type annotation `: any`
  /\bas\s+any\b/,        // cast `as any`
  /\bany\s*\[/,          // `any[]`
  /\bany\s*>/,           // `any>`
  /\bany\s*\)/,          // `any)`
  /\bany\s*,/,           // `any,`
  /\bany\s*;/,           // `any;`
  /\bany\s*$/,           // `any` at end of line
  /<\s*any\b/,           // `<any`
  /\bRecord<.*any/,      // `Record<string, any>`
  /\bPromise<any/,       // `Promise<any>`
  /\bArray<any/,         // `Array<any>`
];

for (const file of srcNonTestFiles) {
  // Skip .d.ts files
  if (file.endsWith('.d.ts')) continue;

  const text = readText(path.join(ROOT, file));
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // Skip eslint disable lines
    if (trimmed.includes('eslint-disable')) return;

    for (const pattern of ANY_PATTERNS) {
      if (pattern.test(line)) {
        anyHits.push({ file, line: index + 1, text: trimmed.slice(0, 120) });
        break; // Only count once per line
      }
    }
  });
}

// 3. TODO / FIXME / HACK
console.log('  Checking TODOs...');
const todoHits = [];

for (const file of srcNonTestFiles) {
  const text = readText(path.join(ROOT, file));
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(trimmed)) {
      todoHits.push({ file, line: index + 1, text: trimmed.slice(0, 120) });
    }
  });
}

// 4. Test Coverage (feature directories without test files)
console.log('  Checking test coverage...');
const featureDir = path.join(ROOT, 'src', 'features');
const untestedFeatures = [];

if (fs.existsSync(featureDir)) {
  const features = fs.readdirSync(featureDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const feature of features) {
    const featurePath = `src/features/${feature}`;
    const featureTestFiles = srcTestFiles.filter((f) => f.startsWith(featurePath + '/'));
    const featureCodeFiles = srcNonTestFiles.filter((f) => f.startsWith(featurePath + '/'));
    if (featureCodeFiles.length > 0 && featureTestFiles.length === 0) {
      untestedFeatures.push({ feature: featurePath, codeFiles: featureCodeFiles.length });
    }
  }
}

// 5. Handoff Check
console.log('  Checking handoff...');
const handoffDir = path.join(ROOT, 'docs', 'handoff');
let lastHandoffInfo = 'No handoff directory found';

if (fs.existsSync(handoffDir)) {
  const handoffFiles = walk(handoffDir)
    .map(toRepoPath)
    .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'))
    .sort()
    .reverse();

  if (handoffFiles.length > 0) {
    lastHandoffInfo = `Last: ${handoffFiles[0]} (${handoffFiles.length} total)`;
  } else {
    lastHandoffInfo = 'No handoff files found';
  }
}

// --- Git Info ---

let lastCommit = '(unavailable)';
let commitCount7d = '?';
try {
  lastCommit = execSync('git log -1 --pretty=format:"%h %s"', { encoding: 'utf8' }).trim();
  commitCount7d = execSync('git rev-list --count --since="7 days ago" HEAD', { encoding: 'utf8' }).trim();
} catch {
  // ignore
}

// --- Status Helpers ---

function status(count, warnThreshold, errorThreshold) {
  if (count >= errorThreshold) return '🔴';
  if (count >= warnThreshold) return '🟡';
  return '🟢';
}

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const actTotalWarnings = toNonNegativeNumber(actWarningSummary?.totalWarnings);
const actAffectedFiles = toNonNegativeNumber(actWarningSummary?.affectedFiles);
const actMaxWarningsPerFile = toNonNegativeNumber(actWarningSummary?.maxWarningsPerFile);
const actMaxWarningsFile = typeof actWarningSummary?.maxWarningsFile === 'string'
  ? actWarningSummary.maxWarningsFile
  : null;
const actCountsByFile = actWarningSummary && typeof actWarningSummary.countsByFile === 'object'
  ? actWarningSummary.countsByFile
  : {};

const actCountsEntries = Object.entries(actCountsByFile)
  .map(([file, count]) => ({ file, count: toNonNegativeNumber(count) ?? 0 }))
  .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
  .slice(0, 30);

const actStatusIcon = actTotalWarnings === null
  ? '⚪'
  : actTotalWarnings > 0
    ? '🔴'
    : '🟢';

const actStatusCountLabel = actTotalWarnings === null
  ? 'n/a'
  : `${actTotalWarnings}`;

const actOpenIssueState = ACT_WARNING_OPEN_ISSUE_COUNT > 0
  ? `あり (${ACT_WARNING_OPEN_ISSUE_COUNT})`
  : 'なし';

const actWarningSection = actTotalWarnings === null
  ? 'ℹ️ act warning summary は未提供です（Nightly workflow の入力未設定または読み取り失敗）。'
  : [
    `- totalWarnings: **${actTotalWarnings}**`,
    `- affectedFiles: **${actAffectedFiles ?? 0}**`,
    `- maxWarningsFile: **${actMaxWarningsFile ?? 'none'}**`,
    `- maxWarningsPerFile: **${actMaxWarningsPerFile ?? 0}**`,
    `- openIssue: **${actOpenIssueState}**${ACT_WARNING_OPEN_ISSUE_URL ? ` (${ACT_WARNING_OPEN_ISSUE_URL})` : ''}`,
    '',
    actCountsEntries.length === 0
      ? '✅ countsByFile: なし'
      : `| Count | File |
| ---: | --- |
${actCountsEntries.map((x) => `| ${x.count} | \`${x.file}\` |`).join('\n')}`,
  ].join('\n');

let spHealthSection = 'ℹ️ SP通信状況は未提供です（SP_TELEMETRY_PATH 入力未設定または読み取り失敗）。';
if (spTelemetrySummary && spTelemetrySummary.metrics) {
  const m = spTelemetrySummary.metrics;
  spHealthSection = [
    `- Throttled: **${m.throttledCount}**`,
    `- Retry: **${m.retryCount}**`,
    `- Failed: **${m.failedCount}**`,
    '',
    `- Avg Duration: **${m.avgDurationMs}ms**`,
    `- P95 Duration: **${m.p95DurationMs}ms**`,
    '',
    `- Avg Queue: **${m.avgQueuedMs}ms**`,
    `- Max Queue: **${m.maxQueuedMs}ms**`,
    '',
    '### 🚗 送迎配車 (Transport Assignment)',
    `- Concurrency Conflicts: **${m.assignmentConcurrencyConflicts || 0}**`,
    `- Conflict Vehicles: **${(m.assignmentConflictVehicles && m.assignmentConflictVehicles.length > 0) ? m.assignmentConflictVehicles.join(', ') : '✅ なし'}**`,
    '',
    '### 🚦 Lane 別の通信状況',
    ...(m.lanes ? [
      '| Lane | 実行数 | Failed | Retry | Max Queue | Avg Duration |',
      '|------|:---:|:---:|:---:|:---:|:---:|',
      `| 🟢 Read | ${m.lanes.read?.requests || 0} | ${m.lanes.read?.failed || 0} | ${m.lanes.read?.retries || 0} | ${m.lanes.read?.maxQueuedMs || 0}ms | ${m.lanes.read?.avgDurationMs || 0}ms |`,
      `| 🟡 Write | ${m.lanes.write?.requests || 0} | ${m.lanes.write?.failed || 0} | ${m.lanes.write?.retries || 0} | ${m.lanes.write?.maxQueuedMs || 0}ms | ${m.lanes.write?.avgDurationMs || 0}ms |`,
      `| 🛡️ Provision | ${m.lanes.provisioning?.requests || 0} | ${m.lanes.provisioning?.failed || 0} | ${m.lanes.provisioning?.retries || 0} | ${m.lanes.provisioning?.maxQueuedMs || 0}ms | ${m.lanes.provisioning?.avgDurationMs || 0}ms |`,
    ] : ['ℹ️ レーン情報は提供されていません']),
    '',
    '### Top Failing Endpoints',
    ...(spTelemetrySummary.topEndpoints && spTelemetrySummary.topEndpoints.length > 0
        ? spTelemetrySummary.topEndpoints.map((ep, i) => `${i + 1}. \`${ep.endpoint}\` → ${ep.failures} failures (retries: ${ep.retries})`)
        : ['✅ なし'])
  ].join('\n');
}

let orchestrationSection = 'ℹ️ Orchestration 実行状況は未提供です（ORCHESTRATION_AUDIT_PATH 未設定）。';
let orchestrationHealth = { score: 100, status: 'N/A' };

if (orchestrationAuditSummary) {
  const s = orchestrationAuditSummary;
  
  // ナイトリー側での簡易健康スコア計算
  const total = (s.totalFailures || 0) + (s.totalSuccess || 100); // 概算
  const successRate = ((s.totalSuccess || 100) / total) * 100;
  const score = Math.round(successRate);
  orchestrationHealth = {
    score,
    status: score >= 95 ? 'Excellent' : score >= 80 ? 'Stable' : score >= 60 ? 'Warning' : 'Critical'
  };

  orchestrationSection = [
    `### ⚖️ Business Execution Health: **${orchestrationHealth.score}%** (${orchestrationHealth.status})`,
    `- Total Failures (Recent): **${s.totalFailures || 0}**`,
    `- 🔴 Open (Action Required): **${s.openCount || 0}**`,
    `- 🟢 Resolved: **${s.resolvedCount || 0}**`,
    '',
    '#### 📊 Top Failure Actions (Priority for Improvement)',
    ...(s.topFailureActions && s.topFailureActions.length > 0
      ? s.topFailureActions.map((f, i) => `${i + 1}. **${f.action}** — ${f.count} failures`)
      : ['✅ なし']),
    '',
    '#### 📋 Latest Failures & Remediation Hints',
    ...(s.latestFailures && s.latestFailures.length > 0
      ? s.latestFailures.map((f, i) => {
          return `${i + 1}. \`[${f.action}]\` **${f.error?.kind}**: ${f.error?.message}\n   - 👉 **Action**: ${f.suggestedAction || '調査が必要'}`;
        })
      : ['✅ なし'])
  ].join('\n');
}

// --- Report Generation ---

console.log('  Generating report...');

const report = `# 🔍 Nightly Patrol Report — ${stamp}

## Summary

| 項目 | 値 |
|------|-----|
| Last commit | \`${lastCommit}\` |
| Commits (7d) | ${commitCount7d} |
| Source files | ${srcNonTestFiles.length} |
| Test files | ${srcTestFiles.length} |
| Test ratio | ${srcNonTestFiles.length > 0 ? (srcTestFiles.length / srcNonTestFiles.length * 100).toFixed(1) : 0}% |

## Status

| 観点 | ステータス | 件数 |
|------|:---------:|:----:|
| 巨大ファイル (≥600行) | ${status(largeFiles.length, 3, 8)} | ${largeFiles.length} |
| 型安全性 (any) | ${status(anyHits.length, 10, 30)} | ${anyHits.length} |
| TODO/FIXME/HACK | ${status(todoHits.length, 20, 50)} | ${todoHits.length} |
| テスト未整備 feature | ${status(untestedFeatures.length, 2, 5)} | ${untestedFeatures.length} |
| Index Pressure | ${indexPressureSummary?.results?.filter(r => ['action_required', 'critical'].includes(r.severity)).length > 0 ? '🔴' : (indexPressureSummary?.results?.length > 0 ? '🟡' : '🟢')} | ${indexPressureSummary?.results?.length || 0} |
| Handoff | ${lastHandoffInfo.includes('No ') ? '🟡' : '🟢'} | — |
| Orchestration Health | ${orchestrationHealth.score < 80 ? '🔴' : orchestrationHealth.score < 95 ? '🟡' : '🟢'} | ${orchestrationHealth.score}% |
| act(...) warning (nightly) | ${actStatusIcon} | ${actStatusCountLabel} |

---

## 1. 巨大ファイル (≥600行)

${largeFiles.length === 0
  ? '✅ なし'
  : `| ファイル | 行数 | 推奨 |
|---------|:----:|------|
${largeFiles.map((x) =>
  `| \`${x.file}\` | ${x.lines} | ${x.lines >= 800 ? '🔴 即分割 (/refactor)' : '🟡 監視'} |`
).join('\n')}`
}

---

## 2. 型安全性 (any / as any)

${anyHits.length === 0
  ? '✅ なし'
  : `検出: ${anyHits.length} 件${anyHits.length > 50 ? ' (上位50件を表示)' : ''}

${anyHits.slice(0, 50).map((x) => `- \`${x.file}:${x.line}\` — ${x.text}`).join('\n')}`
}

---

## 3. TODO / FIXME / HACK

${todoHits.length === 0
  ? '✅ なし'
  : `検出: ${todoHits.length} 件${todoHits.length > 50 ? ' (上位50件を表示)' : ''}

${todoHits.slice(0, 50).map((x) => `- \`${x.file}:${x.line}\` — ${x.text}`).join('\n')}`
}

---

## 4. テスト未整備 feature

${untestedFeatures.length === 0
  ? '✅ 全 feature にテストあり'
  : `| Feature | コードファイル数 | 推奨 |
|---------|:-------------:|------|
${untestedFeatures.map((x) =>
  `| \`${x.feature}\` | ${x.codeFiles} | /test-design で観点整理 |`
).join('\n')}`
}

---

## 5. Handoff

${lastHandoffInfo}

---

## 6. 🛡️ Index Pressure (SharePoint)

${!indexPressureSummary || indexPressureSummary.results?.length === 0
  ? '✅ インデックス不足なし'
  : `| リスト | フィールド | 重要度 | 推奨アクション |
|-------|-----------|:---:|--------------|
${indexPressureSummary.results.map((r) => 
  `| \`${r.listKey}\` | \`${r.fieldName}\` | ${r.severity === 'critical' ? '🔴 critical' : (r.severity === 'action_required' ? '🟠 high' : '🟡 low')} | ${['action_required', 'critical'].includes(r.severity) ? 'Issue生成済み' : '要観察'} |`
).join('\n')}`
}

---

## 7. 🌐 SharePoint通信状況

${spHealthSection}

---

## 8. ⚖️ Orchestration 実行状況

${orchestrationSection}

---

## 9. act(...) warning monitor

${actWarningSection}

---

## Suggested Next Actions

${[
  largeFiles.filter(x => x.lines >= 800).length > 0
    ? '- 🔴 800行超のファイルを `/refactor` で分割検討'
    : null,
  largeFiles.length > 0 && largeFiles.filter(x => x.lines >= 800).length === 0
    ? '- 🟡 600行超のファイルを監視（次の変更時に分割検討）'
    : null,
  anyHits.length > 0
    ? `- 🟡 \`any\` 使用 ${anyHits.length} 件を \`/review\` で型安全化`
    : null,
  untestedFeatures.length > 0
    ? `- 🟡 テスト未整備 ${untestedFeatures.length} feature を \`/test-design\` で設計`
    : null,
  actTotalWarnings !== null && actTotalWarnings > 0
    ? `- 🔴 act(...) warning 再発 (${actTotalWarnings}件) を 1 file = 1 PR で解消`
    : null,
  actTotalWarnings === 0
    ? '- ✅ act(...) warning は 0件維持（Nightly確認）'
    : null,
  lastHandoffInfo.includes('No ')
    ? '- 🟡 Handoff ファイルを作成 (`/handoff`)'
    : null,
  orchestrationHealth.score < 95
    ? `- ${orchestrationHealth.score < 80 ? '🔴' : '🟡'} Orchestration Health 低下 (${orchestrationHealth.score}%)。Top Failures の改善を検討。`
    : null,
  orchestrationAuditSummary?.topFailureActions?.[0]
    ? `- 🛠 最優先改善対象: \`${orchestrationAuditSummary.topFailureActions[0].action}\` (${orchestrationAuditSummary.topFailureActions[0].count}件の失敗)`
    : null,
  orchestrationAuditSummary?.totalFailures > 0
    ? `- 🔴 Orchestration Failure 発生 (${orchestrationAuditSummary.totalFailures}件 / 未対応: ${orchestrationAuditSummary.openCount || 0}件)。\`TelemetryDashboard\` で詳細を確認し修正検討。`
    : null,
  orchestrationAuditSummary?.openCount > 0
    ? `- ⚠️ **Action Required**: 未対応の業務エラーが ${orchestrationAuditSummary.openCount} 件あります。現場への確認と解消記録（Resolved Audit）が必要です。`
    : null,
  indexPressureSummary?.results?.filter(r => ['action_required', 'critical'].includes(r.severity)).length > 0
    ? `- 🔴 インデックス不足 (${indexPressureSummary.results.filter(r => ['action_required', 'critical'].includes(r.severity)).length}件) を \`ops:index-remediate\` で解消検討`
    : null,
].filter(Boolean).join('\n') || '✅ 特に対応不要'}

---

*Generated by Nightly Patrol (Phase A+B) — [AI開発OS v2](../../.agents/workflows/nightly.md)*
`;

// --- Write ---

fs.mkdirSync(REPORT_DIR, { recursive: true });
const outputPath = path.join(REPORT_DIR, `${stamp}.md`);
fs.writeFileSync(outputPath, report, 'utf8');
console.log(`✅ Report written: docs/nightly-patrol/${stamp}.md`);

// --- Console Summary ---

console.log('');
console.log('=== Patrol Summary ===');
console.log(`  Large files:     ${largeFiles.length}`);
console.log(`  any hits:        ${anyHits.length}`);
console.log(`  TODO/FIXME:      ${todoHits.length}`);
console.log(`  Untested feat:   ${untestedFeatures.length}`);
console.log(`  Handoff:         ${lastHandoffInfo}`);
if (actTotalWarnings !== null) {
  console.log(`  act warnings:    ${actTotalWarnings} (files=${actAffectedFiles ?? 0}, max=${actMaxWarningsPerFile ?? 0})`);
} else {
  console.log('  act warnings:    n/a');
}
console.log('');

// --- Phase B: Issue Draft Generation ---

console.log('📋 Generating issue drafts (Phase B)...');

const patrolResults = { 
  largeFiles, 
  anyHits, 
  untestedFeatures, 
  todoHits, 
  lastHandoffInfo,
  contractResults: contractDriftSummary?.results || [],
  indexResults: indexPressureSummary?.results || []
};

// --- Phase C-1: Structured PatrolResult for JSON + classify pipeline ---

const patrolResultsJson = {
  version: 1,
  date: stamp,
  summary: {
    sourceFiles: srcNonTestFiles.length,
    testFiles: srcTestFiles.length,
    testRatio: srcNonTestFiles.length > 0
      ? Number((srcTestFiles.length / srcNonTestFiles.length * 100).toFixed(1))
      : 0,
    lastCommit,
    commitCount7d: Number(commitCount7d) || 0,
  },
  metrics: {
    largeFiles: largeFiles.map((f) => ({ file: f.file, lines: f.lines })),
    anyCount: anyHits.length,
    anyFiles: [...new Set(anyHits.map((h) => h.file))],
    todoCount: todoHits.length,
    untestedFeatures: untestedFeatures.map((f) => f.feature),
    assignmentConflictVehicles: spTelemetrySummary?.metrics?.transportConcurrency?.vehicleHistogram ? Object.keys(spTelemetrySummary.metrics.transportConcurrency.vehicleHistogram) : (spTelemetrySummary?.metrics?.assignmentConflictVehicles || []),
    transportConcurrency: spTelemetrySummary?.metrics?.transportConcurrency || null,
    orchestration: orchestrationAuditSummary ? {
      totalFailures: orchestrationAuditSummary.totalFailures,
      byKind: orchestrationAuditSummary.byKind
    } : null,
    contracts: contractDriftSummary ? contractDriftSummary.results : null,
    indexPressure: indexPressureSummary ? indexPressureSummary.results : null,
  },
  gates: {
    unitTest: GATE_UNIT_TEST_TOTAL > 0
      ? {
          pass: GATE_UNIT_TEST_FAILED === 0,
          failed: GATE_UNIT_TEST_FAILED,
          total: GATE_UNIT_TEST_TOTAL,
          errorFiles: [],  // enriched by CI in future
        }
      : null,
    typeCheck: GATE_TYPECHECK_ERRORS > 0 || GATE_TYPECHECK_ERROR_FILES.length > 0
      ? {
          pass: GATE_TYPECHECK_ERRORS === 0,
          errorCount: GATE_TYPECHECK_ERRORS,
          errorFiles: GATE_TYPECHECK_ERROR_FILES,
        }
      : null,
  },
};

// --- Phase C-1: JSON Output ---

const jsonPath = path.join(REPORT_DIR, `${stamp}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(patrolResultsJson, null, 2), 'utf8');
console.log(`📊 JSON written: docs/nightly-patrol/${stamp}.json`);

// --- Phase B.5: Index Dry-run Capture (Evidence for C-1) ---

if (indexPressureSummary && indexPressureSummary.results?.length > 0) {
  console.log('🧪 Capturing dry-run evidence for index pressure...');
  for (const r of indexPressureSummary.results) {
    if (['action_required', 'critical'].includes(r.severity)) {
      try {
        const cmd = `npm run ops:index-remediate -- --list ${r.listKey} --field ${r.fieldName} --dry-run`;
        const log = execSync(cmd, { encoding: 'utf8', env: { ...process.env, CI: 'true' } });
        r.dryRunLog = log;
      } catch (err) {
        r.dryRunLog = `❌ Dry-run failed: ${err.message}`;
      }
    }
  }
  // Re-write summary with logs
  fs.writeFileSync(INDEX_PRESSURE_PATH, JSON.stringify(indexPressureSummary, null, 2), 'utf8');
}

const drafts = buildIssueDrafts(patrolResults);
const draftMarkdown = renderIssueDraftMarkdown(drafts, stamp);

const draftPath = path.join(REPORT_DIR, `issue-drafts-${stamp}.md`);
fs.writeFileSync(draftPath, draftMarkdown, 'utf8');

if (drafts.length === 0) {
  console.log('  ✅ Issue drafts: 0 件（全指標が閾値以内）');
} else {
  const bySev = {};
  for (const d of drafts) bySev[d.severity] = (bySev[d.severity] || 0) + 1;
  const sevSummary = Object.entries(bySev).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  📋 Issue drafts: ${drafts.length} 件 (${sevSummary})`);
  console.log(`  📄 Written: docs/nightly-patrol/issue-drafts-${stamp}.md`);
}
console.log('');

// --- Phase C-1: Classification Pipeline ---

console.log('🏷️  Running classification pipeline (Phase C)...');

const classification = classify(patrolResultsJson);
const classificationPath = path.join(REPORT_DIR, `classification-${stamp}.json`);
fs.writeFileSync(classificationPath, JSON.stringify(classification, null, 2), 'utf8');

console.log(`  Status: ${classification.overall}`);
if (classification.actions.length > 0) {
  for (const a of classification.actions) {
    console.log(`   ${a.priority} ${a.kind} → ${a.action} (${a.fileCount} files)`);
  }
} else {
  console.log('  ✅ No action needed');
}
console.log(`  📄 Written: docs/nightly-patrol/classification-${stamp}.json`);
console.log('');
