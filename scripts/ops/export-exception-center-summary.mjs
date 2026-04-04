/* eslint-disable no-console -- CLI ops script */
/**
 * ExceptionCenter JSON Exporter
 *
 * 目的:
 * - ExceptionCenter の生データから Nightly 判定用の要約JSONを生成する
 *
 * 入力:
 * - --input <path> または EXCEPTION_CENTER_RAW_PATH
 *
 * 出力:
 * - --output <path> または EXCEPTION_CENTER_SUMMARY_OUTPUT_PATH
 * - 省略時: docs/nightly-patrol/exception-center-summary-<date>.json
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

const SEVERITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

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
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toRate(value) {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  if (n < 0) return 0;
  if (n > 1 && n <= 100) return n / 100;
  return n;
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

function pickFirstRate(obj, paths) {
  for (const p of paths) {
    const r = toRate(getByPath(obj, p));
    if (r !== null) return r;
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeSeverity(raw) {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.trim().toLowerCase();
  if (value === 'critical' || value.includes('致命')) return 'critical';
  if (value === 'high' || value.includes('高')) return 'high';
  if (value === 'medium' || value.includes('中')) return 'medium';
  if (value === 'low' || value.includes('低')) return 'low';
  return 'unknown';
}

function safeDateMs(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildRecurringKey(item) {
  if (typeof item?.stableId === 'string' && item.stableId.trim()) return `stable:${item.stableId.trim()}`;
  if (typeof item?.parentId === 'string' && item.parentId.trim()) return `parent:${item.parentId.trim()}`;
  const category = typeof item?.category === 'string' ? item.category.trim() : 'unknown';
  const user = typeof item?.targetUserId === 'string'
    ? item.targetUserId.trim()
    : (typeof item?.targetUser === 'string' ? item.targetUser.trim() : 'unknown');
  const title = normalizeText(item?.title).slice(0, 80);
  return `${category}:${user}:${title}`;
}

function uniqueStrings(values, limit = 30) {
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
    path.join(REPORT_DIR, `exception-center-raw-${date}.json`),
    path.join(REPORT_DIR, `exception-center-${date}.json`),
  ];

  const inputPathFromEnv = process.env.EXCEPTION_CENTER_RAW_PATH || '';
  const inputPath = args.input || inputPathFromEnv || defaultInputCandidates.find((p) => fs.existsSync(p)) || '';

  const outputPath = args.output
    || process.env.EXCEPTION_CENTER_SUMMARY_OUTPUT_PATH
    || path.join(REPORT_DIR, `exception-center-summary-${date}.json`);

  const staleMinutesThreshold = toFiniteNumber(process.env.EXCEPTION_STALE_MINUTES) ?? 120;

  const source = readJsonFile(inputPath);
  const raw = source.data;
  const envelope = raw && typeof raw === 'object' ? raw : {};
  const summary = envelope.summary && typeof envelope.summary === 'object'
    ? envelope.summary
    : envelope;
  const items = asArray(envelope.items || envelope.exceptions || summary.items || summary.exceptions || (Array.isArray(raw) ? raw : []));

  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byCategory = {};
  for (const item of items) {
    const severity = normalizeSeverity(item?.severity);
    if (severity in bySeverity) bySeverity[severity] += 1;
    const category = typeof item?.category === 'string' && item.category.trim()
      ? item.category.trim()
      : 'unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  const openExceptionCount = pickFirstNumber(envelope, [
    'openExceptionCount',
    'summary.openExceptionCount',
    'totalCount',
    'summary.totalCount',
    'stats.total',
    'summary.stats.total',
  ]) ?? items.length;

  const statsBySeverityInput = getByPath(envelope, 'stats.bySeverity') || getByPath(summary, 'stats.bySeverity') || getByPath(summary, 'bySeverity');
  if (statsBySeverityInput && typeof statsBySeverityInput === 'object') {
    for (const key of ['critical', 'high', 'medium', 'low']) {
      const n = toFiniteNumber(statsBySeverityInput[key]);
      if (n !== null) bySeverity[key] = n;
    }
  }

  const statsByCategoryInput = getByPath(envelope, 'stats.byCategory') || getByPath(summary, 'stats.byCategory') || getByPath(summary, 'byCategory');
  if (statsByCategoryInput && typeof statsByCategoryInput === 'object') {
    for (const [key, value] of Object.entries(statsByCategoryInput)) {
      const n = toFiniteNumber(value);
      if (n !== null) byCategory[key] = n;
    }
  }

  const highSeverityCount = pickFirstNumber(envelope, [
    'highSeverityCount',
    'summary.highSeverityCount',
    'unresolvedHighSeverity',
    'summary.unresolvedHighSeverity',
    'highSeverityOpen',
    'openHighSeverity',
  ]) ?? (bySeverity.critical + bySeverity.high);

  const overdueCountFromItems = items.filter((item) => {
    const category = typeof item?.category === 'string' ? item.category.toLowerCase() : '';
    if (category === 'overdue-plan') return true;
    const title = normalizeText(item?.title);
    const description = normalizeText(item?.description);
    return title.includes('期限超過') || title.includes('overdue') || description.includes('期限超過') || description.includes('overdue');
  }).length;

  const overdueCount = pickFirstNumber(envelope, [
    'overdueCount',
    'summary.overdueCount',
    'overdueExceptionCount',
    'summary.overdueExceptionCount',
  ]) ?? overdueCountFromItems;

  const nowMs = Date.now();
  const staleCountFromItems = items.filter((item) => {
    const ms = safeDateMs(item?.updatedAt);
    if (ms === null) return false;
    return (nowMs - ms) >= staleMinutesThreshold * 60 * 1000;
  }).length;
  const staleExceptionCount = pickFirstNumber(envelope, [
    'staleExceptionCount',
    'summary.staleExceptionCount',
    'staleExceptions',
    'summary.staleExceptions',
  ]) ?? staleCountFromItems;

  const repeatedKeysInput = asArray(
    getByPath(envelope, 'repeatedExceptionKeys')
    || getByPath(summary, 'repeatedExceptionKeys')
    || getByPath(envelope, 'summary.repeatedExceptionKeys'),
  )
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);

  const repeatedKeysFromItems = (() => {
    const counts = new Map();
    for (const item of items) {
      const key = buildRecurringKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key]) => key);
  })();

  const repeatedExceptionKeys = uniqueStrings([...repeatedKeysInput, ...repeatedKeysFromItems], 30);
  const recurringExceptionCount = pickFirstNumber(envelope, [
    'recurringExceptionCount',
    'summary.recurringExceptionCount',
    'repeatedExceptionCount',
    'summary.repeatedExceptionCount',
  ]) ?? repeatedExceptionKeys.length;

  const topActionableItemsInput = asArray(
    getByPath(envelope, 'topActionableItems')
    || getByPath(summary, 'topActionableItems')
    || getByPath(envelope, 'summary.topActionableItems'),
  )
    .map((item) => ({
      id: typeof item?.id === 'string' ? item.id : null,
      title: typeof item?.title === 'string' ? item.title : null,
      severity: normalizeSeverity(item?.severity),
      category: typeof item?.category === 'string' ? item.category : null,
      targetUser: typeof item?.targetUser === 'string' ? item.targetUser : null,
      targetUserId: typeof item?.targetUserId === 'string' ? item.targetUserId : null,
      updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
      actionLabel: typeof item?.actionLabel === 'string' ? item.actionLabel : null,
      actionPath: typeof item?.actionPath === 'string' ? item.actionPath : null,
    }))
    .filter((item) => item.id || item.title);

  const topActionableItemsFromItems = items
    .slice()
    .sort((a, b) => {
      const sevA = normalizeSeverity(a?.severity);
      const sevB = normalizeSeverity(b?.severity);
      if (SEVERITY_RANK[sevA] !== SEVERITY_RANK[sevB]) {
        return SEVERITY_RANK[sevA] - SEVERITY_RANK[sevB];
      }
      const aMs = safeDateMs(a?.updatedAt) ?? 0;
      const bMs = safeDateMs(b?.updatedAt) ?? 0;
      return bMs - aMs;
    })
    .slice(0, 5)
    .map((item) => ({
      id: typeof item?.id === 'string' ? item.id : null,
      title: typeof item?.title === 'string' ? item.title : null,
      severity: normalizeSeverity(item?.severity),
      category: typeof item?.category === 'string' ? item.category : null,
      targetUser: typeof item?.targetUser === 'string' ? item.targetUser : null,
      targetUserId: typeof item?.targetUserId === 'string' ? item.targetUserId : null,
      updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
      actionLabel: typeof item?.actionLabel === 'string' ? item.actionLabel : null,
      actionPath: typeof item?.actionPath === 'string' ? item.actionPath : null,
    }));
  const topActionableItems = topActionableItemsInput.length > 0
    ? topActionableItemsInput.slice(0, 5)
    : topActionableItemsFromItems;

  const actionResolveRate = pickFirstRate(envelope, [
    'actionResolveRate',
    'summary.actionResolveRate',
    'kpis.actionResolveRate',
    'metrics.actionResolveRate',
  ]);
  const mttrMinutes = pickFirstNumber(envelope, [
    'mttrMinutes',
    'summary.mttrMinutes',
    'kpis.mttrMinutes',
    'metrics.mttrMinutes',
    'mttr',
  ]);
  const falsePositiveRate = pickFirstRate(envelope, [
    'falsePositiveRate',
    'summary.falsePositiveRate',
    'kpis.falsePositiveRate',
    'metrics.falsePositiveRate',
  ]);

  const generatedAt = pickFirstString(envelope, [
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
    openExceptionCount,
    highSeverityCount,
    overdueCount,
    staleExceptionCount,
    repeatedExceptionKeys,
    recurringExceptionCount,
    unresolvedHighSeverity: highSeverityCount,
    topActionableItems,
    actionResolveRate,
    mttrMinutes,
    falsePositiveRate,
    stats: {
      bySeverity,
      byCategory,
    },
    missingInput: !source.exists || !!source.error,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log('🚨 exception center summary exported');
  console.log(`   input:  ${source.path || '(none)'}`);
  console.log(`   output: ${path.relative(ROOT, outputPath)}`);
  console.log(`   open=${openExceptionCount}, high=${highSeverityCount}, overdue=${overdueCount}`);

  if (args.printJson) {
    console.log(JSON.stringify(out, null, 2));
  }
}

main();
