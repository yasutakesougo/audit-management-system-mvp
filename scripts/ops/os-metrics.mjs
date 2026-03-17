/* eslint-disable no-console -- CLI ops script */
/**
 * AI Dev OS — Metrics Dashboard Generator
 *
 * OS の運用状態を可視化するレポートを生成します。
 *
 * メトリクス:
 *   1. Nightly Patrol 実行状況と検知推移
 *   2. Git 活動サマリー（コミット種別、ファイル変更量）
 *   3. Handoff 実施率
 *   4. コード健全性トレンド（大ファイル数、any数の推移）
 *
 * @see docs/operations/ai-dev-os-rules.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const PATROL_DIR = path.join(ROOT, 'docs', 'nightly-patrol');
const HANDOFF_DIR = path.join(ROOT, 'docs', 'handoff');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

// --- Date Helpers ---

const today = new Date();
const yyyy = today.getUTCFullYear();
const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
const dd = String(today.getUTCDate()).padStart(2, '0');
const stamp = `${yyyy}-${mm}-${dd}`;

function daysAgo(n) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --- 1. Patrol Reports ---

console.log('📊 Generating OS Metrics Dashboard...');
console.log('  Reading patrol reports...');

function parsePatrolReport(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');

  const extract = (label) => {
    const match = text.match(new RegExp(`${label}[^|]*\\|[^|]*\\|\\s*(\\d+)`));
    return match ? parseInt(match[1], 10) : null;
  };

  return {
    largeFiles: extract('巨大ファイル'),
    anyHits: extract('型安全性'),
    todos: extract('TODO'),
    untestedFeatures: extract('テスト未整備'),
  };
}

const patrolDays = 7;
const patrolData = [];

for (let i = 0; i < patrolDays; i++) {
  const date = daysAgo(i);
  const file = path.join(PATROL_DIR, `${date}.md`);
  if (fs.existsSync(file)) {
    const data = parsePatrolReport(file);
    patrolData.push({ date, ...data, exists: true });
  } else {
    patrolData.push({ date, exists: false, largeFiles: null, anyHits: null, todos: null, untestedFeatures: null });
  }
}

patrolData.reverse(); // oldest first

const patrolExecutionRate = patrolData.filter((d) => d.exists).length;

// --- 2. Git Activity ---

console.log('  Reading git activity...');

function gitCount(since, until, pattern) {
  try {
    const cmd = `git log --oneline --since="${since}" --until="${until}" --format="%s"`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: ROOT });
    if (!pattern) return output.split('\n').filter(Boolean).length;
    return output.split('\n').filter((l) => l.match(pattern)).length;
  } catch {
    return 0;
  }
}

const weekAgo = daysAgo(7);
const totalCommits = gitCount(weekAgo, stamp);
const featCommits = gitCount(weekAgo, stamp, /^feat/);
const fixCommits = gitCount(weekAgo, stamp, /^fix/);
const refactorCommits = gitCount(weekAgo, stamp, /^refactor/);
const testCommits = gitCount(weekAgo, stamp, /^test/);
const docsCommits = gitCount(weekAgo, stamp, /^docs/);
const choreCommits = gitCount(weekAgo, stamp, /^chore/);

// PR/Issue activity from commit messages
const issueRefs = (() => {
  try {
    const output = execSync(
      `git log --oneline --since="${weekAgo}" --format="%s"`,
      { encoding: 'utf8', cwd: ROOT },
    );
    const refs = new Set();
    for (const line of output.split('\n')) {
      const matches = line.matchAll(/#(\d+)/g);
      for (const m of matches) refs.add(m[1]);
    }
    return refs.size;
  } catch {
    return 0;
  }
})();

// --- 3. Handoff Check ---

console.log('  Reading handoff files...');

let handoffFiles = [];
if (fs.existsSync(HANDOFF_DIR)) {
  const walkFlat = (dir) => {
    const results = [];
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...walkFlat(full));
        else if (entry.name.endsWith('.md') && entry.name !== 'README.md') results.push(entry.name);
      }
    } catch { /* ignore */ }
    return results;
  };
  handoffFiles = walkFlat(HANDOFF_DIR);
}

// Count workdays in last 7 days (Mon-Fri)
let workdaysInWeek = 0;
for (let i = 0; i < 7; i++) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - i);
  const dow = d.getUTCDay();
  if (dow >= 1 && dow <= 5) workdaysInWeek++;
}

const handoffRate = workdaysInWeek > 0
  ? Math.min(100, (handoffFiles.length / workdaysInWeek * 100)).toFixed(0)
  : 0;

// --- 4. Code Health Trend ---

console.log('  Computing code health trend...');

// Current values from latest patrol
const latest = patrolData.filter((d) => d.exists).pop();
const currentHealth = latest || { largeFiles: '?', anyHits: '?', todos: '?', untestedFeatures: '?' };

// --- Generate Dashboard ---

console.log('  Writing dashboard...');

const sparkline = (data, key) => {
  const values = data.map((d) => (d.exists && d[key] != null ? d[key] : '—'));
  return values.join(' → ');
};

const healthScore = (() => {
  if (!latest) return '?';
  let score = 100;
  // Large files penalty
  score -= (latest.largeFiles || 0) * 5;
  // Any hits penalty
  score -= (latest.anyHits || 0) * 2;
  // Untested features penalty
  score -= (latest.untestedFeatures || 0) * 3;
  // TODO penalty (minor)
  score -= Math.min((latest.todos || 0), 10);
  // Handoff bonus
  if (handoffFiles.length > 0) score += 5;
  return Math.max(0, Math.min(100, score));
})();

const healthGrade = (() => {
  if (healthScore === '?') return '?';
  if (healthScore >= 80) return 'A';
  if (healthScore >= 60) return 'B';
  if (healthScore >= 40) return 'C';
  if (healthScore >= 20) return 'D';
  return 'F';
})();

const healthEmoji = (() => {
  if (healthGrade === 'A') return '🟢';
  if (healthGrade === 'B') return '🟡';
  if (healthGrade === 'C') return '🟡';
  return '🔴';
})();

const report = `# 📊 AI Dev OS — Weekly Dashboard (${stamp})

## Health Score

| 指標 | 値 |
|------|-----|
| **総合スコア** | **${healthEmoji} ${healthScore} / 100 (Grade ${healthGrade})** |
| Patrol 実行率 | ${patrolExecutionRate} / ${patrolDays} 日 |
| Handoff 実施率 | ${handoffRate}% (${handoffFiles.length} / ${workdaysInWeek} 営業日) |

---

## 📈 7日間トレンド

| 日付 | Patrol | 大ファイル | any | TODO | テスト未整備 |
|------|:------:|:---------:|:---:|:----:|:----------:|
${patrolData.map((d) =>
  `| ${d.date} | ${d.exists ? '✅' : '—'} | ${d.largeFiles ?? '—'} | ${d.anyHits ?? '—'} | ${d.todos ?? '—'} | ${d.untestedFeatures ?? '—'} |`
).join('\n')}

### 推移

| 観点 | 7日間の推移 | 方向 |
|------|-----------|:----:|
| 巨大ファイル | ${sparkline(patrolData, 'largeFiles')} | ${latest && patrolData[0]?.exists ? (latest.largeFiles <= (patrolData[0].largeFiles || 0) ? '📉 改善' : '📈 悪化') : '—'} |
| any 使用 | ${sparkline(patrolData, 'anyHits')} | ${latest && patrolData[0]?.exists ? (latest.anyHits <= (patrolData[0].anyHits || 0) ? '📉 改善' : '📈 悪化') : '—'} |
| テスト未整備 | ${sparkline(patrolData, 'untestedFeatures')} | ${latest && patrolData[0]?.exists ? (latest.untestedFeatures <= (patrolData[0].untestedFeatures || 0) ? '📉 改善' : '📈 悪化') : '—'} |

---

## 🔨 Git 活動 (7日間)

| 指標 | 値 |
|------|:---:|
| 総コミット数 | **${totalCommits}** |
| Issue/PR 参照数 | **${issueRefs}** |

| 種別 | 件数 | 割合 |
|------|:----:|:----:|
| feat | ${featCommits} | ${totalCommits > 0 ? (featCommits / totalCommits * 100).toFixed(0) : 0}% |
| fix | ${fixCommits} | ${totalCommits > 0 ? (fixCommits / totalCommits * 100).toFixed(0) : 0}% |
| refactor | ${refactorCommits} | ${totalCommits > 0 ? (refactorCommits / totalCommits * 100).toFixed(0) : 0}% |
| test | ${testCommits} | ${totalCommits > 0 ? (testCommits / totalCommits * 100).toFixed(0) : 0}% |
| docs | ${docsCommits} | ${totalCommits > 0 ? (docsCommits / totalCommits * 100).toFixed(0) : 0}% |
| chore | ${choreCommits} | ${totalCommits > 0 ? (choreCommits / totalCommits * 100).toFixed(0) : 0}% |

---

## 🏥 コード健全性（最新）

| 観点 | 現在値 | 閾値 | ステータス |
|------|:------:|:----:|:---------:|
| 巨大ファイル (≥600行) | ${currentHealth.largeFiles ?? '?'} | ≤3 | ${(currentHealth.largeFiles ?? 0) <= 3 ? '🟢' : (currentHealth.largeFiles ?? 0) <= 7 ? '🟡' : '🔴'} |
| any 使用 | ${currentHealth.anyHits ?? '?'} | ≤5 | ${(currentHealth.anyHits ?? 0) <= 5 ? '🟢' : (currentHealth.anyHits ?? 0) <= 15 ? '🟡' : '🔴'} |
| TODO/FIXME | ${currentHealth.todos ?? '?'} | ≤10 | ${(currentHealth.todos ?? 0) <= 10 ? '🟢' : (currentHealth.todos ?? 0) <= 25 ? '🟡' : '🔴'} |
| テスト未整備 feature | ${currentHealth.untestedFeatures ?? '?'} | ≤3 | ${(currentHealth.untestedFeatures ?? 0) <= 3 ? '🟢' : (currentHealth.untestedFeatures ?? 0) <= 8 ? '🟡' : '🔴'} |

---

## 📋 運用状況

| OS コンポーネント | 状態 |
|-----------------|:----:|
| Nightly Patrol | ${patrolExecutionRate > 0 ? '✅ 稼働中' : '❌ 未稼働'} |
| Handoff 運用 | ${handoffFiles.length > 0 ? '✅ 実施中' : '🟡 未開始'} |
| Triage ルーティン | ${patrolExecutionRate > 0 ? '🟡 観測中' : '❌ 未開始'} |
| Phase A (観測) | ✅ 導入済み |
| Phase B (Draft Issue) | ⏳ 未導入 |
| Phase C (自動Issue) | ⏳ 未導入 |

---

## 🎯 今週の推奨アクション

${[
  (currentHealth.untestedFeatures ?? 0) > 5
    ? `1. 🔴 **テスト未整備 ${currentHealth.untestedFeatures} feature** — \`/triage\` → \`/test-design\` で1件ずつ解消`
    : null,
  (currentHealth.largeFiles ?? 0) > 0
    ? `${(currentHealth.untestedFeatures ?? 0) > 5 ? '2' : '1'}. 🟡 **巨大ファイル ${currentHealth.largeFiles} 件** — 800行超は \`/refactor\` で即分割`
    : null,
  (currentHealth.anyHits ?? 0) > 0
    ? `${((currentHealth.untestedFeatures ?? 0) > 5 ? 1 : 0) + ((currentHealth.largeFiles ?? 0) > 0 ? 1 : 0) + 1}. 🟡 **any ${currentHealth.anyHits} 件** — \`/review\` で型安全化`
    : null,
  handoffFiles.length === 0
    ? `- 🟡 **Handoff 未開始** — 今日から \`/handoff\` を開始`
    : null,
].filter(Boolean).join('\n') || '✅ 特に対応不要'}

---

*Generated by AI Dev OS Metrics — ${stamp}*
`;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const outputPath = path.join(OUTPUT_DIR, `dashboard-${stamp}.md`);
fs.writeFileSync(outputPath, report, 'utf8');
console.log(`✅ Dashboard written: docs/nightly-patrol/dashboard-${stamp}.md`);

// Console summary
console.log('');
console.log(`=== AI Dev OS Health: ${healthEmoji} ${healthScore}/100 (Grade ${healthGrade}) ===`);
console.log(`  Patrol:    ${patrolExecutionRate}/${patrolDays} days`);
console.log(`  Handoff:   ${handoffRate}%`);
console.log(`  Commits:   ${totalCommits} (feat:${featCommits} fix:${fixCommits} refactor:${refactorCommits})`);
console.log(`  Health:    large:${currentHealth.largeFiles ?? '?'} any:${currentHealth.anyHits ?? '?'} untested:${currentHealth.untestedFeatures ?? '?'}`);
console.log('');
