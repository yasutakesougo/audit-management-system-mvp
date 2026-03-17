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

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

// --- Date ---

const today = new Date();
const yyyy = today.getUTCFullYear();
const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
const dd = String(today.getUTCDate()).padStart(2, '0');
const stamp = `${yyyy}-${mm}-${dd}`;

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
| Handoff | ${lastHandoffInfo.includes('No ') ? '🟡' : '🟢'} | — |

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
  lastHandoffInfo.includes('No ')
    ? '- 🟡 Handoff ファイルを作成 (`/handoff`)'
    : null,
].filter(Boolean).join('\n') || '✅ 特に対応不要'}

---

*Generated by Nightly Patrol (Phase A) — [AI開発OS v2](../../.agents/workflows/scan.md)*
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
console.log('');
