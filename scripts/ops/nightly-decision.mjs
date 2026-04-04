/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly Patrol Decision Engine
 *
 * 目的:
 * - Nightly の観測結果を「翌日の行動判断」に変換する
 * - 判定を 1 行で固定出力する
 *   - 🟢 Stable（問題なし）
 *   - 🟡 Watch（軽微な懸念あり）
 *   - 🔴 Action Required（明日対応必須）
 *
 * 入力:
 * - docs/nightly-patrol/<date>.json
 * - docs/nightly-patrol/classification-<date>.json
 * - docs/nightly-patrol/dashboard-<date>.md
 * - docs/nightly-patrol/lane-assertion-result.json (任意)
 * - ACT_WARNING_SUMMARY_PATH (任意)
 * - EXCEPTION_CENTER_SUMMARY_PATH (任意)
 * - KPI_SUMMARY_PATH (任意)
 * - DRIFT_SUMMARY_PATH (任意)
 * - LOG_FILE (任意)
 *
 * 出力:
 * - docs/nightly-patrol/decision-<date>.json
 * - docs/nightly-patrol/decision-<date>.md
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

const STATUS_META = {
  pass: { emoji: '🟢', label: 'PASS' },
  warn: { emoji: '🟡', label: 'WARN' },
  fail: { emoji: '🔴', label: 'FAIL' },
  unknown: { emoji: '⚪', label: 'N/A' },
};

const FINAL_META = {
  stable: { emoji: '🟢', line: '🟢 Stable（問題なし）' },
  watch: { emoji: '🟡', line: '🟡 Watch（軽微な懸念あり）' },
  action_required: { emoji: '🔴', line: '🔴 Action Required（明日対応必須）' },
};

function parseArgs(argv) {
  const out = {
    date: null,
    printJson: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      out.date = argv[i + 1] || null;
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
    const normalized = value.trim().replace(/%$/, '');
    if (normalized === '') return null;
    const n = Number(normalized);
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

function rateToPercentText(rate) {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
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
    const value = getByPath(obj, p);
    const n = toFiniteNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function pickFirstRate(obj, paths) {
  for (const p of paths) {
    const value = getByPath(obj, p);
    const r = toRate(value);
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

function pickFirstArrayLength(obj, paths) {
  for (const p of paths) {
    const value = getByPath(obj, p);
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

function envNumber(name, fallback) {
  const n = toFiniteNumber(process.env[name]);
  return n === null ? fallback : n;
}

function readJsonIfExists(filePath) {
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

function readTextIfExists(filePath) {
  if (!filePath) return { path: filePath, exists: false, text: '', error: null };
  if (!fs.existsSync(filePath)) return { path: filePath, exists: false, text: '', error: null };
  try {
    return { path: filePath, exists: true, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function countLinesByPatterns(text, patterns) {
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) count += 1;
  }
  return count;
}

function analyzeLog(text) {
  return {
    driftCount: countLinesByPatterns(text, [
      /schema_drift_detected/i,
      /field drift detected/i,
      /has schema drift/i,
      /\[audit:diagnostics:drift\]/i,
    ]),
    schemaMismatchCount: countLinesByPatterns(text, [
      /\[sp:schema_mismatch\]/i,
      /\bsp:schema_mismatch\b/i,
      /\bschema_mismatch\b/i,
    ]),
    autoHealingSuccessCount: countLinesByPatterns(text, [
      /\bsp:provision_success\b/i,
      /self-healing.*(success|succeeded|completed)/i,
      /healing .* completed/i,
    ]),
    autoHealingFailedCount: countLinesByPatterns(text, [
      /\bsp:provision_failed\b/i,
      /self-healing failed/i,
      /healing .* failed/i,
    ]),
    fetchFallbackCount: countLinesByPatterns(text, [
      /\bsp:fetch_fallback_success\b/i,
      /\bfallback_triggered\b/i,
      /api\.select_fields_fallback/i,
      /legacy fallback/i,
      /fetch fallback/i,
    ]),
  };
}

function normalizeOverallStatus(raw) {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.trim().toLowerCase();
  if (value.includes('pass') || value.includes('ok') || value.includes('green')) return 'pass';
  if (value.includes('warn') || value.includes('yellow')) return 'warn';
  if (value.includes('fail') || value.includes('error') || value.includes('red')) return 'fail';
  return 'unknown';
}

function normalizeClassificationStatus(raw) {
  if (raw === 'stable') return 'pass';
  if (raw === 'monitor' || raw === 'auto-fixable') return 'warn';
  if (raw === 'needs-review') return 'fail';
  return 'unknown';
}

function parseHealthScore(dashboardMarkdown) {
  const scoreMatch = dashboardMarkdown.match(/(\d+)\s*\/\s*100\s*\(Grade\s*([A-F])\)/i);
  if (!scoreMatch) return { score: null, grade: null };
  const score = Number(scoreMatch[1]);
  const grade = scoreMatch[2];
  return {
    score: Number.isFinite(score) ? score : null,
    grade,
  };
}

function pushReason(list, message, codeList = null, code = null) {
  if (!list.includes(message)) list.push(message);
  if (Array.isArray(codeList) && typeof code === 'string' && code.trim().length > 0) {
    if (!codeList.includes(code)) codeList.push(code);
  }
}

function renderStatus(status) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return `${meta.emoji} ${meta.label}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = isDateStamp(args.date) ? args.date : utcTodayStamp();

  const thresholds = {
    healthScoreWarn: envNumber('HEALTH_SCORE_WARN', 80),
    healthScoreFail: envNumber('HEALTH_SCORE_FAIL', 50),
    driftCountWarn: envNumber('DRIFT_COUNT_WARN', 1),
    driftCountFail: envNumber('DRIFT_COUNT_FAIL', 10),
    schemaMismatchWarn: envNumber('SCHEMA_MISMATCH_WARN', 1),
    schemaMismatchFail: envNumber('SCHEMA_MISMATCH_FAIL', 1),
    fetchFallbackWarn: envNumber('FETCH_FALLBACK_WARN', 1),
    fetchFallbackFail: envNumber('FETCH_FALLBACK_FAIL', 999999),
    autoHealingWarnRate: envNumber('AUTO_HEALING_WARN_RATE', 0.9),
    autoHealingFailRate: envNumber('AUTO_HEALING_FAIL_RATE', 0.75),
    actionResolveRateWarn: envNumber('ACTION_RESOLVE_RATE_WARN', 0.9),
    actionResolveRateFail: envNumber('ACTION_RESOLVE_RATE_FAIL', 0.75),
    mttrWarnMinutes: envNumber('MTTR_WARN_MINUTES', 60),
    mttrFailMinutes: envNumber('MTTR_FAIL_MINUTES', 180),
    falsePositiveRateWarn: envNumber('FALSE_POSITIVE_RATE_WARN', 0.2),
    falsePositiveRateFail: envNumber('FALSE_POSITIVE_RATE_FAIL', 0.35),
    unresolvedHighSeverityFail: envNumber('UNRESOLVED_HIGH_SEVERITY_FAIL', 1),
    overdueExceptionsWarn: envNumber('OVERDUE_EXCEPTIONS_WARN', 1),
    staleExceptionsWarn: envNumber('STALE_EXCEPTIONS_WARN', 1),
    recurringExceptionsWarn: envNumber('RECURRING_EXCEPTIONS_WARN', 1),
    actWarningWarn: envNumber('ACT_WARNING_WARN', 1),
  };

  const inputPaths = {
    patrolJson: path.join(REPORT_DIR, `${date}.json`),
    classificationJson: path.join(REPORT_DIR, `classification-${date}.json`),
    dashboardMd: path.join(REPORT_DIR, `dashboard-${date}.md`),
    laneAssertionJson: process.env.LANE_ASSERTION_RESULT_PATH || path.join(REPORT_DIR, 'lane-assertion-result.json'),
    actWarningJson: process.env.ACT_WARNING_SUMMARY_PATH || '',
    exceptionCenterJson: process.env.EXCEPTION_CENTER_SUMMARY_PATH || '',
    kpiJson: process.env.KPI_SUMMARY_PATH || '',
    driftJson: process.env.DRIFT_SUMMARY_PATH || '',
    adminStatusJson: process.env.ADMIN_STATUS_SUMMARY_PATH || '',
    logFile: process.env.LOG_FILE || path.join(ROOT, 'logs', 'today.auto.log'),
  };

  const patrol = readJsonIfExists(inputPaths.patrolJson);
  const classification = readJsonIfExists(inputPaths.classificationJson);
  const laneAssertion = readJsonIfExists(inputPaths.laneAssertionJson);
  const actWarning = readJsonIfExists(inputPaths.actWarningJson);
  const exceptionCenter = readJsonIfExists(inputPaths.exceptionCenterJson);
  const kpiSummary = readJsonIfExists(inputPaths.kpiJson);
  const driftSummary = readJsonIfExists(inputPaths.driftJson);
  const adminStatus = readJsonIfExists(inputPaths.adminStatusJson);
  const dashboard = readTextIfExists(inputPaths.dashboardMd);
  const logFile = readTextIfExists(inputPaths.logFile);

  const logMetrics = analyzeLog(logFile.text || '');
  const dashboardScore = parseHealthScore(dashboard.text || '');

  const checkRows = [];
  const failReasons = [];
  const warnReasons = [];
  const failReasonCodes = [];
  const warnReasonCodes = [];

  const addCheck = (row) => checkRows.push(row);

  // 1) Admin status
  const adminOverallRaw = pickFirstString(adminStatus.data, [
    'overall',
    'status',
    'summary.overall',
    'summary.status',
  ]);
  const adminOverall = normalizeOverallStatus(adminOverallRaw);
  const adminFailCount = pickFirstNumber(adminStatus.data, [
    'failCount',
    'summary.failCount',
    'counts.fail',
    'summary.counts.fail',
  ]) ?? 0;
  const adminWarnCount = pickFirstNumber(adminStatus.data, [
    'warnCount',
    'summary.warnCount',
    'counts.warn',
    'summary.counts.warn',
  ]) ?? 0;
  const adminCriticalListCount = pickFirstArrayLength(adminStatus.data, [
    'criticalListNames',
    'summary.criticalListNames',
    'criticalLists',
    'summary.criticalLists',
  ]) ?? 0;
  const adminInputMissing = !adminStatus.exists
    || !!adminStatus.error
    || adminStatus.data?.missingInput === true;
  const adminStatusValue = adminInputMissing
    ? 'warn'
    : adminOverall;
  addCheck({
    id: 'admin-status',
    label: '/admin/status',
    status: adminStatus.exists ? adminStatusValue : 'warn',
    value: `overall=${adminOverallRaw || 'n/a'}, fail=${adminFailCount}, warn=${adminWarnCount}`,
    note: adminInputMissing
      ? '入力欠損（観測信頼性低下）'
      : `管理画面診断の要約 / criticalLists=${adminCriticalListCount}`,
  });
  if (adminInputMissing) {
    pushReason(warnReasons, '/admin/status summary が欠損（判定信頼性低下）', warnReasonCodes, 'ADMIN_STATUS_SUMMARY_MISSING');
  }
  if (adminOverall === 'fail') {
    pushReason(failReasons, '/admin/status が FAIL', failReasonCodes, 'ADMIN_STATUS_FAIL');
  }
  if (adminFailCount > 0) {
    pushReason(failReasons, `/admin/status FAIL 項目 ${adminFailCount} 件`, failReasonCodes, 'ADMIN_STATUS_FAIL');
  }
  if (adminOverall === 'warn') {
    pushReason(warnReasons, '/admin/status が WARN', warnReasonCodes, 'ADMIN_STATUS_WARN');
  }
  if (adminWarnCount > 0) {
    pushReason(warnReasons, `/admin/status WARN 項目 ${adminWarnCount} 件`, warnReasonCodes, 'ADMIN_STATUS_WARN');
  }

  // 2) Patrol classification
  const overall = pickFirstString(classification.data, ['overall']) || 'unknown';
  const classificationStatus = normalizeClassificationStatus(overall);
  addCheck({
    id: 'patrol-overall',
    label: 'Nightly Patrol 分類',
    status: classification.exists ? classificationStatus : 'unknown',
    value: overall,
    note: classification.exists ? 'classification-<date>.json' : '未生成',
  });
  if (overall === 'needs-review') {
    pushReason(failReasons, 'Nightly Patrol が needs-review', failReasonCodes, 'PATROL_NEEDS_REVIEW');
  }
  if (overall === 'monitor' || overall === 'auto-fixable') {
    pushReason(warnReasons, `Nightly Patrol が ${overall}`, warnReasonCodes, 'PATROL_MONITOR');
  }

  // 3) Gate failures
  const unitGate = patrol.data?.gates?.unitTest;
  const typeGate = patrol.data?.gates?.typeCheck;
  const gateFailures = [];
  if (unitGate && unitGate.pass === false) gateFailures.push(`unit test failed=${unitGate.failed ?? unitGate.errorCount ?? 0}`);
  if (typeGate && typeGate.pass === false) gateFailures.push(`typecheck errors=${typeGate.errorCount ?? typeGate.failed ?? 0}`);
  addCheck({
    id: 'ci-gates',
    label: 'Nightly CI Gates',
    status: gateFailures.length > 0 ? 'fail' : patrol.exists ? 'pass' : 'unknown',
    value: gateFailures.length > 0 ? gateFailures.join(', ') : 'no gate failure',
    note: patrol.exists ? 'patrol JSON gates' : 'patrol JSON 未生成',
  });
  if (gateFailures.length > 0) {
    pushReason(failReasons, `CI gate failure: ${gateFailures.join(' / ')}`, failReasonCodes, 'CI_GATE_FAILURE');
  }

  // 4) Lane assertion
  const laneErrors = Array.isArray(laneAssertion.data?.errors) ? laneAssertion.data.errors.length : 0;
  const laneWarnings = Array.isArray(laneAssertion.data?.warnings) ? laneAssertion.data.warnings.length : 0;
  const laneSuccess = laneAssertion.data?.success;
  const laneStatus = !laneAssertion.exists
    ? 'unknown'
    : laneSuccess === false || laneErrors > 0
      ? 'fail'
      : laneWarnings > 0
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'lane-assertion',
    label: 'Telemetry Lane Assertion',
    status: laneStatus,
    value: laneAssertion.exists ? `errors=${laneErrors}, warnings=${laneWarnings}` : 'n/a',
    note: laneAssertion.exists ? 'read/write/provision lane health' : '入力なし',
  });
  if (laneStatus === 'fail') {
    pushReason(failReasons, 'Telemetry lane assertion failed', failReasonCodes, 'TELEMETRY_LANE_FAIL');
  }
  if (laneStatus === 'warn') {
    pushReason(warnReasons, 'Telemetry lane assertion has warnings', warnReasonCodes, 'TELEMETRY_LANE_WARN');
  }

  // 5) act warnings
  const actWarnings = pickFirstNumber(actWarning.data, ['totalWarnings']) ?? 0;
  const actStatus = !actWarning.exists
    ? 'unknown'
    : actWarnings >= thresholds.actWarningWarn
      ? 'warn'
      : 'pass';
  addCheck({
    id: 'act-warning',
    label: 'act(...) warning',
    status: actStatus,
    value: actWarning.exists ? String(actWarnings) : 'n/a',
    note: actWarning.exists ? 'React act warning regression monitor' : '入力なし',
  });
  if (actStatus === 'warn') {
    pushReason(warnReasons, `act(...) warning ${actWarnings} 件`, warnReasonCodes, 'ACT_WARNING_PRESENT');
  }

  // 6) Drift / schema / fallback / auto-healing
  const driftCount = pickFirstNumber(driftSummary.data, [
    'driftCount',
    'metrics.driftCount',
    'summary.driftCount',
    'unresolvedCount',
  ]) ?? logMetrics.driftCount;

  const schemaMismatchCount = pickFirstNumber(driftSummary.data, [
    'schemaMismatchCount',
    'metrics.schemaMismatchCount',
    'summary.schemaMismatchCount',
    'mismatchCount',
  ]) ?? logMetrics.schemaMismatchCount;

  const fetchFallbackCount = pickFirstNumber(driftSummary.data, [
    'fetchFallbackCount',
    'metrics.fetchFallbackCount',
    'summary.fetchFallbackCount',
    'fallbackCount',
  ]) ?? logMetrics.fetchFallbackCount;

  const autoHealingSuccessCount = pickFirstNumber(driftSummary.data, [
    'autoHealingSuccessCount',
    'metrics.autoHealingSuccessCount',
    'summary.autoHealingSuccessCount',
    'autoHealing.successCount',
  ]) ?? logMetrics.autoHealingSuccessCount;

  const autoHealingFailedCount = pickFirstNumber(driftSummary.data, [
    'autoHealingFailedCount',
    'metrics.autoHealingFailedCount',
    'summary.autoHealingFailedCount',
    'autoHealing.failedCount',
  ]) ?? logMetrics.autoHealingFailedCount;

  const autoHealingAttempts = autoHealingSuccessCount + autoHealingFailedCount;
  const autoHealingSuccessRateFromCount = autoHealingAttempts > 0
    ? autoHealingSuccessCount / autoHealingAttempts
    : null;
  const autoHealingSuccessRate = pickFirstRate(driftSummary.data, [
    'autoHealingSuccessRate',
    'metrics.autoHealingSuccessRate',
    'summary.autoHealingSuccessRate',
    'autoHealing.successRate',
  ]) ?? autoHealingSuccessRateFromCount;

  const driftStatus = driftCount >= thresholds.driftCountFail
    ? 'fail'
    : driftCount >= thresholds.driftCountWarn
      ? 'warn'
      : 'pass';
  addCheck({
    id: 'drift-count',
    label: 'Drift Count',
    status: driftStatus,
    value: String(driftCount),
    note: driftSummary.exists ? 'drift summary 入力' : 'ログ推定',
  });
  if (driftStatus === 'fail') {
    pushReason(failReasons, `Drift count ${driftCount} (閾値 ${thresholds.driftCountFail}+)`, failReasonCodes, 'DRIFT_COUNT_HIGH');
  }
  if (driftStatus === 'warn') {
    pushReason(warnReasons, `Drift count ${driftCount} (監視)`, warnReasonCodes, 'DRIFT_COUNT_PRESENT');
  }

  const schemaStatus = schemaMismatchCount >= thresholds.schemaMismatchFail
    ? 'fail'
    : schemaMismatchCount >= thresholds.schemaMismatchWarn
      ? 'warn'
      : 'pass';
  addCheck({
    id: 'schema-mismatch',
    label: 'Schema Mismatch',
    status: schemaStatus,
    value: String(schemaMismatchCount),
    note: 'sp:schema_mismatch の検知件数',
  });
  if (schemaStatus === 'fail') {
    pushReason(failReasons, `Schema mismatch ${schemaMismatchCount} 件`, failReasonCodes, 'SCHEMA_MISMATCH_HIGH');
  }
  if (schemaStatus === 'warn') {
    pushReason(warnReasons, `Schema mismatch ${schemaMismatchCount} 件`, warnReasonCodes, 'SCHEMA_MISMATCH_PRESENT');
  }

  const fallbackStatus = fetchFallbackCount >= thresholds.fetchFallbackFail
    ? 'fail'
    : fetchFallbackCount >= thresholds.fetchFallbackWarn
      ? 'warn'
      : 'pass';
  addCheck({
    id: 'fetch-fallback',
    label: 'Fetch Fallback',
    status: fallbackStatus,
    value: String(fetchFallbackCount),
    note: 'fallback 発生件数',
  });
  if (fallbackStatus === 'fail') {
    pushReason(failReasons, `Fetch fallback ${fetchFallbackCount} 件`, failReasonCodes, 'FETCH_FALLBACK_HIGH');
  }
  if (fallbackStatus === 'warn') {
    pushReason(warnReasons, `Fetch fallback ${fetchFallbackCount} 件`, warnReasonCodes, 'FETCH_FALLBACK_PRESENT');
  }

  const autoHealingStatus = autoHealingSuccessRate === null
    ? 'unknown'
    : autoHealingSuccessRate < thresholds.autoHealingFailRate
      ? 'fail'
      : autoHealingSuccessRate < thresholds.autoHealingWarnRate
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'auto-healing',
    label: 'Auto-Healing Success Rate',
    status: autoHealingStatus,
    value: autoHealingSuccessRate === null
      ? 'n/a'
      : `${rateToPercentText(autoHealingSuccessRate)} (${autoHealingSuccessCount}/${autoHealingAttempts})`,
    note: autoHealingAttempts > 0 ? 'provision_success / provision_failed 由来' : 'データなし',
  });
  if (autoHealingStatus === 'fail') {
    pushReason(
      failReasons,
      `Auto-healing success rate ${rateToPercentText(autoHealingSuccessRate)}`,
      failReasonCodes,
      'AUTO_HEALING_RATE_LOW',
    );
  }
  if (autoHealingStatus === 'warn') {
    pushReason(
      warnReasons,
      `Auto-healing success rate ${rateToPercentText(autoHealingSuccessRate)}`,
      warnReasonCodes,
      'AUTO_HEALING_RATE_WARN',
    );
  }

  // 7) Dashboard health score
  const healthScore = dashboardScore.score;
  const healthStatus = healthScore === null
    ? 'unknown'
    : healthScore < thresholds.healthScoreFail
      ? 'fail'
      : healthScore < thresholds.healthScoreWarn
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'health-score',
    label: 'OS Health Score',
    status: healthStatus,
    value: healthScore === null ? 'n/a' : `${healthScore}/100 (Grade ${dashboardScore.grade || '?'})`,
    note: dashboard.exists ? 'dashboard-<date>.md 解析' : 'ダッシュボード未生成',
  });
  if (healthStatus === 'fail') {
    pushReason(failReasons, `Health score ${healthScore}/100`, failReasonCodes, 'HEALTH_SCORE_LOW');
  }
  if (healthStatus === 'warn') {
    pushReason(warnReasons, `Health score ${healthScore}/100`, warnReasonCodes, 'HEALTH_SCORE_WARN');
  }

  // 8) KPI + Exception center (optional input)
  const actionResolveRate = pickFirstRate(kpiSummary.data || exceptionCenter.data, [
    'actionResolveRate',
    'action_resolve_rate',
    'kpis.actionResolveRate',
    'metrics.actionResolveRate',
    'summary.actionResolveRate',
    'resolveRate',
  ]);
  const mttrMinutes = pickFirstNumber(kpiSummary.data || exceptionCenter.data, [
    'mttrMinutes',
    'mttr',
    'kpis.mttrMinutes',
    'metrics.mttrMinutes',
    'summary.mttrMinutes',
  ]);
  const falsePositiveRate = pickFirstRate(kpiSummary.data || exceptionCenter.data, [
    'falsePositiveRate',
    'false_positive_rate',
    'kpis.falsePositiveRate',
    'metrics.falsePositiveRate',
    'summary.falsePositiveRate',
  ]);
  const unresolvedHighSeverity = pickFirstNumber(exceptionCenter.data, [
    'unresolvedHighSeverity',
    'unresolved_high_severity',
    'highSeverityCount',
    'summary.highSeverityCount',
    'highSeverityOpen',
    'openHighSeverity',
    'summary.unresolvedHighSeverity',
  ]) ?? 0;
  const overdueExceptions = pickFirstNumber(exceptionCenter.data, [
    'overdueCount',
    'summary.overdueCount',
    'overdueExceptionCount',
    'summary.overdueExceptionCount',
  ]) ?? 0;
  const staleExceptions = pickFirstNumber(exceptionCenter.data, [
    'staleExceptionCount',
    'staleExceptions',
    'summary.staleExceptionCount',
  ]) ?? 0;
  const recurringExceptions = pickFirstNumber(exceptionCenter.data, [
    'recurringExceptionCount',
    'recurringExceptions',
    'repeatedExceptionCount',
    'summary.repeatedExceptionCount',
    'summary.recurringExceptionCount',
  ]) ?? (
    pickFirstArrayLength(exceptionCenter.data, [
      'repeatedExceptionKeys',
      'summary.repeatedExceptionKeys',
    ]) ?? 0
  );
  const exceptionInputMissing = !exceptionCenter.exists
    || !!exceptionCenter.error
    || exceptionCenter.data?.missingInput === true;

  const actionResolveStatus = actionResolveRate === null
    ? 'unknown'
    : actionResolveRate < thresholds.actionResolveRateFail
      ? 'fail'
      : actionResolveRate < thresholds.actionResolveRateWarn
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'kpi-action-resolve-rate',
    label: 'KPI: Action Resolve Rate',
    status: actionResolveStatus,
    value: rateToPercentText(actionResolveRate),
    note: actionResolveRate === null ? '入力なし' : '理想: 90%以上',
  });
  if (actionResolveStatus === 'fail') {
    pushReason(
      failReasons,
      `Action Resolve Rate ${rateToPercentText(actionResolveRate)}`,
      failReasonCodes,
      'KPI_ACTION_RESOLVE_RATE_LOW',
    );
  }
  if (actionResolveStatus === 'warn') {
    pushReason(
      warnReasons,
      `Action Resolve Rate ${rateToPercentText(actionResolveRate)}`,
      warnReasonCodes,
      'KPI_ACTION_RESOLVE_RATE_WARN',
    );
  }

  const mttrStatus = mttrMinutes === null
    ? 'unknown'
    : mttrMinutes > thresholds.mttrFailMinutes
      ? 'fail'
      : mttrMinutes > thresholds.mttrWarnMinutes
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'kpi-mttr',
    label: 'KPI: MTTR',
    status: mttrStatus,
    value: mttrMinutes === null ? 'n/a' : `${mttrMinutes} min`,
    note: mttrMinutes === null ? '入力なし' : '低いほど良い',
  });
  if (mttrStatus === 'fail') pushReason(failReasons, `MTTR ${mttrMinutes} min`, failReasonCodes, 'KPI_MTTR_HIGH');
  if (mttrStatus === 'warn') pushReason(warnReasons, `MTTR ${mttrMinutes} min`, warnReasonCodes, 'KPI_MTTR_WARN');

  const falsePositiveStatus = falsePositiveRate === null
    ? 'unknown'
    : falsePositiveRate > thresholds.falsePositiveRateFail
      ? 'fail'
      : falsePositiveRate > thresholds.falsePositiveRateWarn
        ? 'warn'
        : 'pass';
  addCheck({
    id: 'kpi-false-positive-rate',
    label: 'KPI: False Positive Rate',
    status: falsePositiveStatus,
    value: rateToPercentText(falsePositiveRate),
    note: falsePositiveRate === null ? '入力なし' : '低いほど良い',
  });
  if (falsePositiveStatus === 'fail') {
    pushReason(
      failReasons,
      `False Positive Rate ${rateToPercentText(falsePositiveRate)}`,
      failReasonCodes,
      'KPI_FALSE_POSITIVE_HIGH',
    );
  }
  if (falsePositiveStatus === 'warn') {
    pushReason(
      warnReasons,
      `False Positive Rate ${rateToPercentText(falsePositiveRate)}`,
      warnReasonCodes,
      'KPI_FALSE_POSITIVE_WARN',
    );
  }

  const exceptionStatus = unresolvedHighSeverity >= thresholds.unresolvedHighSeverityFail
    ? 'fail'
    : staleExceptions >= thresholds.staleExceptionsWarn
      || recurringExceptions >= thresholds.recurringExceptionsWarn
      || overdueExceptions >= thresholds.overdueExceptionsWarn
      || exceptionInputMissing
      ? 'warn'
      : exceptionCenter.exists
        ? 'pass'
        : 'unknown';
  addCheck({
    id: 'exception-center',
    label: 'Exception Center',
    status: exceptionStatus,
    value: `high=${unresolvedHighSeverity}, overdue=${overdueExceptions}, stale=${staleExceptions}, recurring=${recurringExceptions}`,
    note: exceptionInputMissing
      ? '入力欠損（観測信頼性低下）'
      : '未対応高優先・期限超過・放置・再発の件数',
  });
  if (exceptionInputMissing) {
    pushReason(warnReasons, 'ExceptionCenter summary が欠損（判定信頼性低下）', warnReasonCodes, 'EXCEPTION_CENTER_SUMMARY_MISSING');
  }
  if (unresolvedHighSeverity >= thresholds.unresolvedHighSeverityFail) {
    pushReason(failReasons, `未対応 high severity が ${unresolvedHighSeverity} 件`, failReasonCodes, 'EXCEPTION_HIGH_SEVERITY');
  }
  if (overdueExceptions >= thresholds.overdueExceptionsWarn) {
    pushReason(warnReasons, `期限超過例外が ${overdueExceptions} 件`, warnReasonCodes, 'EXCEPTION_OVERDUE_PRESENT');
  }
  if (staleExceptions >= thresholds.staleExceptionsWarn) {
    pushReason(warnReasons, `放置例外が ${staleExceptions} 件`, warnReasonCodes, 'EXCEPTION_STALE_PRESENT');
  }
  if (recurringExceptions >= thresholds.recurringExceptionsWarn) {
    pushReason(warnReasons, `再発例外が ${recurringExceptions} 件`, warnReasonCodes, 'EXCEPTION_RECURRING_PRESENT');
  }

  const finalLabel = failReasons.length > 0
    ? 'action_required'
    : warnReasons.length > 0
      ? 'watch'
      : 'stable';
  const final = FINAL_META[finalLabel];

  const result = {
    version: 1,
    date,
    final: {
      label: finalLabel,
      emoji: final.emoji,
      line: final.line,
    },
    thresholds,
    inputs: {
      patrolJson: patrol.path,
      classificationJson: classification.path,
      dashboardMd: dashboard.path,
      laneAssertionJson: laneAssertion.path,
      actWarningJson: actWarning.path,
      exceptionCenterJson: exceptionCenter.path,
      kpiJson: kpiSummary.path,
      driftJson: driftSummary.path,
      adminStatusJson: adminStatus.path,
      logFile: logFile.path,
    },
    metrics: {
      driftCount,
      schemaMismatchCount,
      fetchFallbackCount,
      autoHealingSuccessCount,
      autoHealingFailedCount,
      autoHealingSuccessRate,
      healthScore,
      healthGrade: dashboardScore.grade,
      actionResolveRate,
      mttrMinutes,
      falsePositiveRate,
      unresolvedHighSeverity,
      overdueExceptions,
      staleExceptions,
      recurringExceptions,
      actWarnings,
      classificationOverall: overall,
      laneErrors,
      laneWarnings,
      adminOverall,
      gateFailures,
    },
    checks: checkRows,
    reasons: {
      fail: failReasons,
      warn: warnReasons,
    },
    reasonCodes: {
      fail: failReasonCodes,
      warn: warnReasonCodes,
    },
  };

  const markdown = `# 🛰 Nightly Patrol Decision — ${date}

## 今日の結論

${final.line}

## Health Check

| Check | Status | Value | Note |
|------|:------:|------|------|
${checkRows.map((row) => `| ${row.label} | ${renderStatus(row.status)} | ${row.value} | ${row.note} |`).join('\n')}

## Decision Triggers

### 🔴 Fail Triggers

${failReasons.length > 0 ? failReasons.map((x) => `- ${x}`).join('\n') : '- なし'}

### 🟡 Watch Triggers

${warnReasons.length > 0 ? warnReasons.map((x) => `- ${x}`).join('\n') : '- なし'}

### 🧾 Reason Codes

- fail: ${failReasonCodes.length > 0 ? `\`${failReasonCodes.join(', ')}\`` : 'なし'}
- warn: ${warnReasonCodes.length > 0 ? `\`${warnReasonCodes.join(', ')}\`` : 'なし'}

---

*Generated by Nightly Patrol Decision Engine — ${new Date().toISOString()}*
`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, `decision-${date}.json`);
  const mdPath = path.join(REPORT_DIR, `decision-${date}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');

  console.log('🛰 Nightly Patrol Decision generated');
  console.log(`   JSON: ${path.relative(ROOT, jsonPath)}`);
  console.log(`   MD:   ${path.relative(ROOT, mdPath)}`);
  console.log('');
  console.log(final.line);

  if (args.printJson) {
    console.log(JSON.stringify(result, null, 2));
  }

  if (process.env.NIGHTLY_FAIL_ON_ACTION_REQUIRED === 'true' && finalLabel === 'action_required') {
    process.exit(1);
  }
}

main();
