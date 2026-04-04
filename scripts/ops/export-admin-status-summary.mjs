/* eslint-disable no-console -- CLI ops script */
/**
 * /admin/status JSON Exporter
 *
 * 目的:
 * - /admin/status (HealthReport) の生データから Nightly 判定用の最小要約を生成する
 *
 * 入力:
 * - --input <path> または ADMIN_STATUS_RAW_PATH
 *
 * 出力:
 * - --output <path> または ADMIN_STATUS_SUMMARY_OUTPUT_PATH
 * - 省略時: docs/nightly-patrol/admin-status-summary-<date>.json
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

function parseArgs(argv) {
  const out = {
    date: null,
    input: '',
    output: '',
    printJson: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      out.date = argv[i + 1] || null;
      i += 1;
    } else if (arg === '--input') {
      out.input = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--output') {
      out.output = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--print-json') {
      out.printJson = true;
    }
  }
  return out;
}

function isDateStamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getByPath(obj, dottedPath) {
  if (!obj || typeof obj !== 'object' || !dottedPath) return undefined;
  const parts = dottedPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function pickFirstNumber(obj, paths) {
  for (const p of paths) {
    const n = toFiniteNumber(getByPath(obj, p));
    if (n !== null) return n;
  }
  return null;
}

function pickFirstString(obj, paths) {
  for (const p of paths) {
    const value = getByPath(obj, p);
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function pickStringArray(obj, paths) {
  for (const p of paths) {
    const value = getByPath(obj, p);
    if (!Array.isArray(value)) continue;
    const arr = value
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    if (arr.length > 0) return arr;
  }
  return [];
}

function normalizeOverallStatus(raw) {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.trim().toLowerCase();
  if (value.includes('pass') || value.includes('ok') || value.includes('green')) return 'pass';
  if (value.includes('warn') || value.includes('yellow')) return 'warn';
  if (value.includes('fail') || value.includes('error') || value.includes('red')) return 'fail';
  return 'unknown';
}

function readJsonFile(filePath) {
  if (!filePath) return { path: filePath, exists: false, data: null, error: null };
  if (!fs.existsSync(filePath)) return { path: filePath, exists: false, data: null, error: null };
  try {
    return {
      path: filePath,
      exists: true,
      data: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractLikelyListName(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  const source = text.trim();

  const bracket = source.match(/\[([^\]]+)\]/);
  if (bracket?.[1]) return bracket[1].trim();

  const listWord = source.match(/([A-Za-z0-9_/-]{2,})\s*リスト/);
  if (listWord?.[1]) return listWord[1].trim();

  return source.slice(0, 80);
}

function uniqueStrings(values, limit = 20) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = isDateStamp(args.date) ? args.date : utcTodayStamp();

  const defaultInputCandidates = [
    path.join(REPORT_DIR, `admin-status-raw-${date}.json`),
    path.join(REPORT_DIR, `admin-status-${date}.json`),
  ];

  const inputPathFromEnv = process.env.ADMIN_STATUS_RAW_PATH || '';
  const inputPath = args.input || inputPathFromEnv || defaultInputCandidates.find((p) => fs.existsSync(p)) || '';

  const outputPath = args.output
    || process.env.ADMIN_STATUS_SUMMARY_OUTPUT_PATH
    || path.join(REPORT_DIR, `admin-status-summary-${date}.json`);

  const source = readJsonFile(inputPath);
  const raw = source.data;
  const report = raw && typeof raw === 'object'
    ? (raw.report || raw.healthReport || raw.data || raw)
    : null;
  const results = asArray(report?.results || raw?.results);

  const overallRaw = pickFirstString(report || raw, [
    'overall',
    'status',
    'summary.overall',
    'summary.status',
  ]);
  const overall = normalizeOverallStatus(overallRaw);

  const countsPass = pickFirstNumber(report || raw, ['counts.pass', 'summary.counts.pass']) ?? 0;
  const countsWarn = pickFirstNumber(report || raw, ['counts.warn', 'summary.counts.warn']) ?? 0;
  const countsFail = pickFirstNumber(report || raw, ['counts.fail', 'summary.counts.fail']) ?? 0;

  const failCount = (() => {
    const fromRaw = pickFirstNumber(raw, ['failCount', 'summary.failCount']);
    if (fromRaw !== null) return fromRaw;
    if (countsFail > 0) return countsFail;
    return results.filter((r) => normalizeOverallStatus(r?.status) === 'fail').length;
  })();
  const warnCount = (() => {
    const fromRaw = pickFirstNumber(raw, ['warnCount', 'summary.warnCount']);
    if (fromRaw !== null) return fromRaw;
    if (countsWarn > 0) return countsWarn;
    return results.filter((r) => normalizeOverallStatus(r?.status) === 'warn').length;
  })();

  const criticalListNamesRaw = pickStringArray(raw, [
    'criticalListNames',
    'criticalLists',
    'summary.criticalListNames',
    'summary.criticalLists',
  ]);
  const criticalFromResults = results
    .filter((r) => normalizeOverallStatus(r?.status) === 'fail')
    .map((r) => extractLikelyListName(r?.label || r?.summary || r?.key))
    .filter(Boolean);
  const criticalListNames = uniqueStrings([...criticalListNamesRaw, ...criticalFromResults], 20);

  const nextActionsRaw = pickStringArray(raw, [
    'nextActions',
    'summary.nextActions',
  ]);
  const nextActionsFromResults = results
    .flatMap((r) => asArray(r?.nextActions))
    .map((action) => {
      if (typeof action === 'string') return action;
      if (action && typeof action === 'object') {
        if (typeof action.label === 'string') return action.label;
        if (typeof action.value === 'string') return action.value;
      }
      return '';
    })
    .filter(Boolean);
  const nextActions = uniqueStrings([...nextActionsRaw, ...nextActionsFromResults], 20);

  const topIssues = results
    .filter((r) => normalizeOverallStatus(r?.status) !== 'pass')
    .slice(0, 5)
    .map((r) => ({
      key: typeof r?.key === 'string' ? r.key : null,
      label: typeof r?.label === 'string' ? r.label : null,
      status: normalizeOverallStatus(r?.status),
      summary: typeof r?.summary === 'string' ? r.summary : null,
    }));

  const generatedAt = pickFirstString(report || raw, [
    'generatedAt',
    'summary.generatedAt',
  ]) || new Date().toISOString();

  const out = {
    version: 1,
    date,
    generatedAt,
    source: {
      path: source.path || null,
      exists: source.exists,
      error: source.error,
    },
    overall,
    counts: {
      pass: countsPass,
      warn: countsWarn,
      fail: countsFail,
    },
    failCount,
    warnCount,
    criticalListNames,
    nextActions,
    topIssues,
    missingInput: !source.exists || !!source.error,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log('🩺 admin status summary exported');
  console.log(`   input:  ${source.path || '(none)'}`);
  console.log(`   output: ${path.relative(ROOT, outputPath)}`);
  console.log(`   overall=${out.overall}, fail=${out.failCount}, warn=${out.warnCount}`);

  if (args.printJson) {
    console.log(JSON.stringify(out, null, 2));
  }
}

main();
