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
const RUNBOOK_PATH = 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md';

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

const DEFAULT_WATCH_STREAK_CODES = [
  'ADMIN_STATUS_SUMMARY_MISSING',
  'EXCEPTION_CENTER_SUMMARY_MISSING',
  'EXCEPTION_OVERDUE_PRESENT',
  'ADMIN_STATUS_WARN',
  'ADMIN_STATUS_WARN_PRESENT',
];

const REASON_CODE_ANCHOR_MAP = {
  ADMIN_STATUS_SUMMARY_MISSING: 'rc-admin-status',
  ADMIN_STATUS_FAIL: 'rc-admin-status',
  ADMIN_STATUS_WARN: 'rc-admin-status',
  PATROL_NEEDS_REVIEW: 'rc-patrol',
  PATROL_MONITOR: 'rc-patrol',
  CI_GATE_FAILURE: 'rc-ci-gate',
  TELEMETRY_LANE_FAIL: 'rc-telemetry-lane',
  TELEMETRY_LANE_WARN: 'rc-telemetry-lane',
  ACT_WARNING_PRESENT: 'rc-act-warning',
  DRIFT_COUNT_HIGH: 'rc-drift',
  DRIFT_COUNT_PRESENT: 'rc-drift',
  SCHEMA_MISMATCH_HIGH: 'rc-schema',
  SCHEMA_MISMATCH_PRESENT: 'rc-schema',
  FETCH_FALLBACK_HIGH: 'rc-fetch-fallback',
  FETCH_FALLBACK_PRESENT: 'rc-fetch-fallback',
  AUTO_HEALING_RATE_LOW: 'rc-auto-healing',
  AUTO_HEALING_RATE_WARN: 'rc-auto-healing',
  HEALTH_SCORE_LOW: 'rc-health-score',
  HEALTH_SCORE_WARN: 'rc-health-score',
  KPI_ACTION_RESOLVE_RATE_LOW: 'rc-kpi-action-resolve',
  KPI_ACTION_RESOLVE_RATE_WARN: 'rc-kpi-action-resolve',
  KPI_MTTR_HIGH: 'rc-kpi-mttr',
  KPI_MTTR_WARN: 'rc-kpi-mttr',
  KPI_FALSE_POSITIVE_HIGH: 'rc-kpi-fp',
  KPI_FALSE_POSITIVE_WARN: 'rc-kpi-fp',
  EXCEPTION_CENTER_SUMMARY_MISSING: 'rc-exception',
  EXCEPTION_HIGH_SEVERITY: 'rc-exception',
  EXCEPTION_OVERDUE_PRESENT: 'rc-exception',
  EXCEPTION_STALE_PRESENT: 'rc-exception',
  EXCEPTION_RECURRING_PRESENT: 'rc-exception',
  REGISTRY_AUDIT_FAIL: 'rc-registry-audit',
  REGISTRY_AUDIT_WARN: 'rc-registry-audit',
  CONTRACT_VIOLATION: 'rc-contract',
  TRANSPORT_CONCURRENCY_PRESSURE: 'rc-transport-concurrency',
  REPEATED_VEHICLE_CONFLICT: 'rc-transport-concurrency',
};

const REASON_CODE_ACTION_MAP = {
  ADMIN_STATUS_SUMMARY_MISSING: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'integration-diagnose のログを開き、/admin/status 入力欠損の有無を確認する。',
  },
  ADMIN_STATUS_FAIL: {
    owner: 'Release Owner',
    severity: 'blocked',
    firstAction: '/admin/status の FAIL 項目を解消するまで NO-GO を維持する。',
  },
  ADMIN_STATUS_WARN: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: '/admin/status の WARN 項目を確認し、連続発生なら対応を開始する。',
  },
  PATROL_NEEDS_REVIEW: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: 'decision-YYYY-MM-DD.md の Fail Trigger を順に割当し、再実行を行う。',
  },
  PATROL_MONITOR: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'monitor/auto-fixable の対象を確認し、継続発生時は escalation する。',
  },
  CI_GATE_FAILURE: {
    owner: 'Release Owner',
    severity: 'blocked',
    firstAction: 'unit/typecheck を復旧し、green になるまで投入を停止する。',
  },
  TELEMETRY_LANE_FAIL: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: 'lane assertion の error を解消し、read/write/provision の健全性を回復する。',
  },
  TELEMETRY_LANE_WARN: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'lane assertion warning の原因を確認し、悪化傾向がないか監視する。',
  },
  ACT_WARNING_PRESENT: {
    owner: 'Frontend Owner',
    severity: 'watch',
    firstAction: 'act warning 差分を修正し、回帰 issue と照合する。',
  },
  DRIFT_COUNT_HIGH: {
    owner: 'Data Platform Owner',
    severity: 'action_required',
    firstAction: 'drift 発生源を特定し、同一 reason code の再発を止める。',
  },
  DRIFT_COUNT_PRESENT: {
    owner: 'Data Platform Owner',
    severity: 'watch',
    firstAction: 'drift 件数の推移を監視し、増加時は根本原因分析を開始する。',
  },
  SCHEMA_MISMATCH_HIGH: {
    owner: 'Data Platform Owner',
    severity: 'action_required',
    firstAction: 'registry 定義と実リスト差分を是正し、schema mismatch を解消する。',
  },
  SCHEMA_MISMATCH_PRESENT: {
    owner: 'Data Platform Owner',
    severity: 'watch',
    firstAction: 'mismatch の対象列を記録し、次回 Nightly までに是正計画を立てる。',
  },
  FETCH_FALLBACK_HIGH: {
    owner: 'Data Platform Owner',
    severity: 'action_required',
    firstAction: 'fallback 多発 API の select/filter を見直し、通常経路へ戻す。',
  },
  FETCH_FALLBACK_PRESENT: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'fallback 件数推移を監視し、閾値接近時は先行修正する。',
  },
  AUTO_HEALING_RATE_LOW: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: 'self-healing 失敗要因（権限/列/上限）を解消して成功率を回復する。',
  },
  AUTO_HEALING_RATE_WARN: {
    owner: 'Platform Owner',
    severity: 'watch',
    firstAction: 'auto-healing 成功率低下の要因を分析し、次回までに改善する。',
  },
  HEALTH_SCORE_LOW: {
    owner: 'Release Owner',
    severity: 'blocked',
    firstAction: 'health score 低下要因を優先順に解消し、GO 判定を保留する。',
  },
  HEALTH_SCORE_WARN: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'health score の低下要因を確認し、悪化時は即エスカレーションする。',
  },
  KPI_ACTION_RESOLVE_RATE_LOW: {
    owner: 'Ops Manager',
    severity: 'action_required',
    firstAction: '未解消 Action の滞留を解消し、解消率を回復する。',
  },
  KPI_ACTION_RESOLVE_RATE_WARN: {
    owner: 'Ops Manager',
    severity: 'watch',
    firstAction: 'Action 解消率を監視し、停滞案件の優先度を引き上げる。',
  },
  KPI_MTTR_HIGH: {
    owner: 'Ops Manager',
    severity: 'action_required',
    firstAction: '初動遅延のボトルネック（通知/担当/手順）を是正する。',
  },
  KPI_MTTR_WARN: {
    owner: 'Ops Manager',
    severity: 'watch',
    firstAction: 'MTTR 悪化要因を確認し、再発防止策を前倒しで実施する。',
  },
  KPI_FALSE_POSITIVE_HIGH: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: '誤検知要因（閾値/分類）を修正し、信頼性を回復する。',
  },
  KPI_FALSE_POSITIVE_WARN: {
    owner: 'Platform Owner',
    severity: 'watch',
    firstAction: 'false positive の増加傾向を確認し、閾値調整を準備する。',
  },
  EXCEPTION_CENTER_SUMMARY_MISSING: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'Exception Center 入力欠損の原因を確認し、観測信頼性を回復する。',
  },
  EXCEPTION_HIGH_SEVERITY: {
    owner: 'Release Owner',
    severity: 'blocked',
    firstAction: '未対応 high severity を解消するまで NO-GO を維持する。',
  },
  EXCEPTION_OVERDUE_PRESENT: {
    owner: 'Ops Manager',
    severity: 'action_required',
    firstAction: '期限超過例外を優先処理し、期限内状態へ戻す。',
  },
  EXCEPTION_STALE_PRESENT: {
    owner: 'Ops Manager',
    severity: 'watch',
    firstAction: '放置例外の担当を再割当し、進捗を再開する。',
  },
  EXCEPTION_RECURRING_PRESENT: {
    owner: 'Ops Manager',
    severity: 'watch',
    firstAction: '再発例外の共通原因を特定し、再発防止策を適用する。',
  },
  REGISTRY_AUDIT_FAIL: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: 'registry-audit.ts のエラー内容を確認し、ListKeys と Definitions の乖離を是正する。',
  },
  REGISTRY_AUDIT_WARN: {
    owner: 'Ops On-call',
    severity: 'watch',
    firstAction: 'registry-audit.ts の警告（非必須リストの欠損など）を確認し、将来の是正を検討する。',
  },
  CONTRACT_VIOLATION: {
    owner: 'Platform Owner',
    severity: 'action_required',
    firstAction: 'contract-patrol.mjs の結果を確認し、Core API の契約違反を解消する。',
  },
  WATCH_STREAK: {
    owner: 'Release Owner',
    severity: 'action_required',
    firstAction: '連続 watch の根本原因を除去し、昇格ループを停止する。',
  },
  TRANSPORT_CONCURRENCY_PRESSURE: {
    owner: 'Ops Manager',
    severity: 'watch',
    firstAction: '送迎配車表での競合発生数を確認し、入力タイミングの重複がないか運用ルールを見直す。',
  },
  REPEATED_VEHICLE_CONFLICT: {
    owner: 'Ops Manager',
    severity: 'action_required',
    firstAction: '特定の車両で競合が多発しています。担当者間の連携不全や、同時編集の頻度を確認してください。',
  },
};

function defaultReasonSeverity(bucket) {
  return bucket === 'fail' ? 'action_required' : 'watch';
}

function defaultReasonOwner(severity) {
  if (severity === 'blocked') return 'Release Owner';
  if (severity === 'action_required') return 'Platform Owner';
  return 'Ops On-call';
}

function normalizeReasonCode(code) {
  if (typeof code !== 'string') return '';
  const trimmed = code.trim();
  if (!trimmed.startsWith('WATCH_STREAK_')) return trimmed;
  const idx = trimmed.indexOf('::');
  if (idx < 0) return 'WATCH_STREAK';
  return trimmed.slice(idx + 2);
}

function resolveRunbookAnchor(code) {
  if (typeof code !== 'string' || !code.trim()) return null;
  if (code.startsWith('WATCH_STREAK_')) return 'rc-watch-streak';
  const normalized = normalizeReasonCode(code);
  return REASON_CODE_ANCHOR_MAP[normalized] || null;
}

function reasonCodeLink(code) {
  const anchor = resolveRunbookAnchor(code);
  if (!anchor) return null;
  return `${RUNBOOK_PATH}#${anchor}`;
}

function resolveReasonAction(code, bucket) {
  const normalized = normalizeReasonCode(code);
  const action = code.startsWith('WATCH_STREAK_')
    ? REASON_CODE_ACTION_MAP.WATCH_STREAK
    : REASON_CODE_ACTION_MAP[normalized];
  const severity = action?.severity || defaultReasonSeverity(bucket);
  return {
    code,
    normalizedCode: normalized,
    owner: action?.owner || defaultReasonOwner(severity),
    severity,
    firstAction: action?.firstAction || '該当 job/step を確認し、NO-GO を維持したまま原因を切り分ける。',
    runbookLink: reasonCodeLink(code),
  };
}

function renderReasonCodeList(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return '- なし';
  return codes
    .map((code) => {
      const link = reasonCodeLink(code);
      if (!link) return `- \`${code}\``;
      return `- [\`${code}\`](${link})`;
    })
    .join('\n');
}

function toReasonCodeLinks(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  return codes.map((code) => ({
    code,
    link: reasonCodeLink(code),
  }));
}

function toReasonCodeActions(codes, bucket) {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  return codes.map((code) => resolveReasonAction(code, bucket));
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function renderReasonActionTable(codes, bucket) {
  const actions = toReasonCodeActions(codes, bucket);
  if (actions.length === 0) return '- なし';
  const rows = actions.map((action) => {
    const runbook = action.runbookLink ? `[Open](${action.runbookLink})` : '-';
    return `| \`${mdCell(action.code)}\` | ${mdCell(action.owner)} | ${mdCell(action.severity)} | ${mdCell(action.firstAction)} | ${runbook} |`;
  }).join('\n');
  return `| Code | Owner | Severity | First Action | Runbook |\n| --- | --- | --- | --- | --- |\n${rows}`;
}

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

function parseCsvList(value, fallback = []) {
  if (typeof value !== 'string' || value.trim().length === 0) return uniqueStrings(fallback);
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? uniqueStrings(parsed) : uniqueStrings(fallback);
}

function shiftDateStamp(dateStamp, daysDelta) {
  if (!isDateStamp(dateStamp)) return null;
  const base = new Date(`${dateStamp}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + daysDelta);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadDecisionSnapshot(dateStamp) {
  const decisionPath = path.join(REPORT_DIR, `decision-${dateStamp}.json`);
  const decision = readJsonIfExists(decisionPath);
  if (!decision.exists || decision.error || !decision.data || typeof decision.data !== 'object') {
    return {
      date: dateStamp,
      path: decisionPath,
      exists: false,
      finalLabel: null,
      warnCodes: [],
    };
  }
  const finalLabel = typeof decision.data?.final?.label === 'string'
    ? decision.data.final.label
    : null;
  const warnCodes = uniqueStrings(Array.isArray(decision.data?.reasonCodes?.warn) ? decision.data.reasonCodes.warn : []);
  return {
    date: dateStamp,
    path: decisionPath,
    exists: true,
    finalLabel,
    warnCodes,
  };
}

function collectWatchStreakEscalations({ date, warnCodes, days, codeAllowList }) {
  if (!isDateStamp(date) || days < 2) return [];
  const allowed = new Set(uniqueStrings(codeAllowList));
  if (allowed.size === 0) return [];

  const currentCodes = uniqueStrings(warnCodes).filter((code) => allowed.has(code));
  if (currentCodes.length === 0) return [];

  const previousDays = [];
  for (let offset = 1; offset < days; offset += 1) {
    const prevDate = shiftDateStamp(date, -offset);
    if (!prevDate) return [];
    previousDays.push(loadDecisionSnapshot(prevDate));
  }

  const escalations = [];
  for (const code of currentCodes) {
    const streakMatched = previousDays.every(
      (snapshot) => snapshot.exists && snapshot.finalLabel === 'watch' && snapshot.warnCodes.includes(code),
    );
    if (streakMatched) {
      escalations.push({
        type: 'watch_streak',
        days,
        code,
      });
    }
  }

  return escalations;
}

function pushReason(list, message, codeList = null, code = null) {
  if (!list.includes(message)) list.push(message);
  if (Array.isArray(codeList) && typeof code === 'string' && code.trim().length > 0) {
    if (!codeList.includes(code)) codeList.push(code);
  }
}

/**
 * Returns true when an export summary signals "not configured" rather than
 * a genuine data-quality failure.  Pattern:
 *   missingInput=true + source.exists=false + source.error=null
 * This happens when the raw URL env var was never set.
 */
function isNotConfiguredMissing(summaryData) {
  if (!summaryData || typeof summaryData !== 'object') return false;
  if (summaryData.missingInput !== true) return false;
  const src = summaryData.source;
  if (!src || typeof src !== 'object') return false;
  return src.exists === false && !src.error;
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
    transportConcurrencyWarn: envNumber('TRANSPORT_CONCURRENCY_WARN', 5),
  };
  const watchStreakDays = Math.max(2, Math.trunc(envNumber('WATCH_STREAK_DAYS', 3)));
  const watchStreakCodes = parseCsvList(process.env.WATCH_STREAK_CODES, DEFAULT_WATCH_STREAK_CODES);

  const inputPaths = {
    patrolJson: path.join(REPORT_DIR, `${date}.json`),
    classificationJson: path.join(REPORT_DIR, `classification-${date}.json`),
    dashboardMd: path.join(REPORT_DIR, `dashboard-${date}.md`),
    laneAssertionJson: process.env.LANE_ASSERTION_RESULT_PATH || path.join(REPORT_DIR, 'lane-assertion-result.json'),
    actWarningJson: process.env.ACT_WARNING_SUMMARY_PATH || '',
    exceptionCenterJson: process.env.EXCEPTION_CENTER_SUMMARY_PATH || '',
    kpiJson: process.env.KPI_SUMMARY_PATH || '',
    driftJson: process.env.DRIFT_SUMMARY_PATH || '',
    adminStatusJson: process.env.ADMIN_STATUS_SUMMARY_PATH || path.join(REPORT_DIR, 'admin-status-summary-'), // will be suffixed with date
    registryAuditJson: process.env.REGISTRY_AUDIT_SUMMARY_PATH || path.join(REPORT_DIR, 'registry-audit-result.json'),
    contractDriftJson: process.env.CONTRACT_DRIFT_SUMMARY_PATH || path.join(REPORT_DIR, 'contract-drift.json'),
    driftLedgerJson: process.env.DRIFT_LEDGER_SUMMARY_PATH || path.join(REPORT_DIR, 'drift-ledger.json'),
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
  const registryAudit = readJsonIfExists(inputPaths.registryAuditJson);
  const dashboard = readTextIfExists(inputPaths.dashboardMd);
  const logFile = readTextIfExists(inputPaths.logFile);
  const driftLedger = readJsonIfExists(inputPaths.driftLedgerJson);

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
  const adminNotConfigured = isNotConfiguredMissing(adminStatus.data);
  const adminInputMissing = !adminNotConfigured && (
    !adminStatus.exists
    || !!adminStatus.error
    || adminStatus.data?.missingInput === true
  );
  const adminStatusValue = adminInputMissing
    ? 'warn'
    : adminNotConfigured
      ? 'unknown'
      : adminOverall;
  addCheck({
    id: 'admin-status',
    label: '/admin/status',
    status: adminStatus.exists ? adminStatusValue : 'warn',
    value: `overall=${adminOverallRaw || 'n/a'}, fail=${adminFailCount}, warn=${adminWarnCount}`,
    note: adminNotConfigured
      ? 'raw URL 未設定（観測スキップ）'
      : adminInputMissing
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
  ]) ?? (driftLedger.exists ? (driftLedger.data?.rows || []).filter(r => ['candidate', 'provision', 'keep-warn'].includes(r.classification)).length : logMetrics.driftCount);

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
  const exceptionNotConfigured = isNotConfiguredMissing(exceptionCenter.data);
  const exceptionInputMissing = !exceptionNotConfigured && (
    !exceptionCenter.exists
    || !!exceptionCenter.error
    || exceptionCenter.data?.missingInput === true
  );

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
      : exceptionNotConfigured
        ? 'unknown'
        : exceptionCenter.exists
          ? 'pass'
          : 'unknown';
  addCheck({
    id: 'exception-center',
    label: 'Exception Center',
    status: exceptionStatus,
    value: `high=${unresolvedHighSeverity}, overdue=${overdueExceptions}, stale=${staleExceptions}, recurring=${recurringExceptions}`,
    note: exceptionNotConfigured
      ? 'raw URL 未設定（観測スキップ）'
      : exceptionInputMissing
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

  // 13) Registry Audit
  const regAuditPass = registryAudit.data?.success === true;
  const regAuditErrors = Array.isArray(registryAudit.data?.errors) ? registryAudit.data.errors.length : 0;
  addCheck({
    id: 'registry-audit',
    label: 'Registry Static Audit',
    status: registryAudit.exists ? (regAuditPass ? 'pass' : 'fail') : 'unknown',
    value: regAuditPass ? 'passed' : `errors=${regAuditErrors}`,
    note: registryAudit.exists ? 'registry-audit-result.json' : '未生成',
  });
  if (registryAudit.exists && !regAuditPass) {
    if (regAuditErrors > 0) {
      pushReason(failReasons, `Registry Audit エラー ${regAuditErrors} 件`, failReasonCodes, 'REGISTRY_AUDIT_FAIL');
    } else {
      pushReason(warnReasons, 'Registry Audit 警告あり', warnReasonCodes, 'REGISTRY_AUDIT_WARN');
    }
  }

  // 14) Transport Concurrency (from Classification)
  if (Array.isArray(classification.data?.classifications)) {
    const concurrencyClassification = classification.data.classifications.find(c => c.kind === 'assignment-concurrency');
    if (concurrencyClassification) {
      const conflicts = concurrencyClassification.errorCount || 0;
      const vehicles = Array.isArray(concurrencyClassification.affectedFiles) ? concurrencyClassification.affectedFiles : [];
      const vehicleCounts = vehicles.reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {});
      const repeatedVehicles = Object.entries(vehicleCounts).filter(([, count]) => count >= 3).map(([v]) => v);

      if (repeatedVehicles.length > 0) {
        pushReason(failReasons, `送迎競合多発（車両: ${repeatedVehicles.join(', ')}）`, failReasonCodes, 'REPEATED_VEHICLE_CONFLICT');
      } else if (conflicts >= thresholds.transportConcurrencyWarn || conflicts > 0) {
        const severity = conflicts >= 5 ? 'fail' : 'warn';
        if (severity === 'fail') {
          pushReason(failReasons, `送迎競合プレッシャー高 (${conflicts} 件)`, failReasonCodes, 'TRANSPORT_CONCURRENCY_PRESSURE');
        } else {
          pushReason(warnReasons, `送迎競合検知 (${conflicts} 件)`, warnReasonCodes, 'TRANSPORT_CONCURRENCY_PRESSURE');
        }
      }
    }
  }

  // 15) Contract Patrol
  const contractDrift = readJsonIfExists(inputPaths.contractDriftJson);
  const contractFailures = Array.isArray(contractDrift.data?.results) 
    ? contractDrift.data.results.filter(r => r.status === 'fail').length 
    : 0;
  addCheck({
    id: 'contract-patrol',
    label: 'Core API Contract Patrol',
    status: contractDrift.exists ? (contractFailures > 0 ? 'fail' : 'pass') : 'unknown',
    value: contractDrift.exists ? `violations=${contractFailures}` : 'n/a',
    note: contractDrift.exists ? 'contract-drift.json' : '未生成',
  });
  if (contractFailures > 0) {
    pushReason(failReasons, `Contract violation ${contractFailures} 件`, failReasonCodes, 'CONTRACT_VIOLATION');
  }

  // 16) Drift Ledger Analysis
  const highDrifts = Array.isArray(driftLedger.data?.rows)
    ? driftLedger.data.rows.filter(r => r.confidence === 'high' && r.classification !== 'allow').length
    : 0;
  addCheck({
    id: 'drift-ledger',
    label: 'Drift Evidence Ledger',
    status: driftLedger.exists ? (highDrifts > 0 ? 'warn' : 'pass') : 'unknown',
    value: driftLedger.exists ? `high_confidence=${highDrifts}` : 'n/a',
    note: driftLedger.exists ? 'drift-ledger.json' : '未生成',
  });
  if (highDrifts > 50) { // 大量のドリフトは fail
    pushReason(failReasons, `大量の高信頼度ドリフトを検知 (${highDrifts} 件)`, failReasonCodes, 'DRIFT_COUNT_HIGH');
  } else if (highDrifts > 0) {
    pushReason(warnReasons, `高信頼度ドリフトを検知 (${highDrifts} 件)`, warnReasonCodes, 'DRIFT_COUNT_PRESENT');
  }

  let finalLabel = failReasons.length > 0
    ? 'action_required'
    : warnReasons.length > 0
      ? 'watch'
      : 'stable';
  const escalations = [];

  if (finalLabel === 'watch') {
    const watchStreakEscalations = collectWatchStreakEscalations({
      date,
      warnCodes: warnReasonCodes,
      days: watchStreakDays,
      codeAllowList: watchStreakCodes,
    });

    for (const escalation of watchStreakEscalations) {
      const streakCode = `WATCH_STREAK_${escalation.days}D::${escalation.code}`;
      pushReason(
        failReasons,
        `Watch reason code ${escalation.code} が ${escalation.days} 日連続のため Action Required に昇格`,
        failReasonCodes,
        streakCode,
      );
      escalations.push(escalation);
    }

    if (watchStreakEscalations.length > 0) {
      finalLabel = 'action_required';
    }
  }

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
    escalationPolicy: {
      watchStreakDays,
      watchStreakCodes,
    },
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
    runbook: {
      path: RUNBOOK_PATH,
      reasonCodeLinks: {
        fail: toReasonCodeLinks(failReasonCodes),
        warn: toReasonCodeLinks(warnReasonCodes),
      },
      reasonCodeActions: {
        fail: toReasonCodeActions(failReasonCodes, 'fail'),
        warn: toReasonCodeActions(warnReasonCodes, 'warn'),
      },
    },
    escalations,
    interpretation: {
      signals: [
        ...toReasonCodeActions(failReasonCodes, 'fail').map(action => {
          const anchor = REASON_CODE_ANCHOR_MAP[action.normalizedCode] || '';
          let type = 'zombie';
          if (anchor.includes('drift')) type = 'drift';
          else if (anchor.includes('index')) type = 'index';
          else if (anchor.includes('concurrency')) type = 'concurrency';
          
          // Extract affected items from classification results for this reason
          const affectedItems = classification?.data?.classifications
            ?.filter(c => {
              if (action.normalizedCode === 'REPEATED_VEHICLE_CONFLICT' || action.normalizedCode === 'TRANSPORT_CONCURRENCY_PRESSURE') {
                return c.kind === 'assignment-concurrency';
              }
              return false;
            })
            ?.flatMap(c => c.affectedFiles || []) || [];

          return {
            type,
            severity: action.severity === 'blocked' || action.severity === 'action_required' ? 'critical' : 'warn',
            message: action.code,
            recommendation: action.firstAction,
            affectedItems: affectedItems.length > 0 ? [...new Set(affectedItems)] : undefined,
          };
        }),
        ...toReasonCodeActions(warnReasonCodes, 'warn').map(action => {
          const anchor = REASON_CODE_ANCHOR_MAP[action.normalizedCode] || '';
          let type = 'zombie';
          if (anchor.includes('drift')) type = 'drift';
          else if (anchor.includes('index')) type = 'index';
          else if (anchor.includes('concurrency')) type = 'concurrency';

          const affectedItems = classification?.data?.classifications
            ?.filter(c => {
              if (action.normalizedCode === 'REPEATED_VEHICLE_CONFLICT' || action.normalizedCode === 'TRANSPORT_CONCURRENCY_PRESSURE') {
                return c.kind === 'assignment-concurrency';
              }
              return false;
            })
            ?.flatMap(c => c.affectedFiles || []) || [];

          return {
            type,
            severity: 'warn',
            message: action.code,
            recommendation: action.firstAction,
            affectedItems: affectedItems.length > 0 ? [...new Set(affectedItems)] : undefined,
          };
        }),
      ]
    }
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

#### fail

${renderReasonCodeList(failReasonCodes)}

#### warn

${renderReasonCodeList(warnReasonCodes)}

### 🧭 Owner / Severity / First Action

#### fail

${renderReasonActionTable(failReasonCodes, 'fail')}

#### warn

${renderReasonActionTable(warnReasonCodes, 'warn')}

### ⬆ Escalations

${escalations.length > 0
    ? escalations.map((e) => `- watch_streak (${e.days}d): \`${e.code}\` が連続発生し Action Required へ昇格`).join('\n')
    : '- なし'}

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

  // --- UI Sync ---
  const uiJsonPath = path.join(ROOT, 'src', 'sharepoint', 'latest-decision.json');
  if (fs.existsSync(path.dirname(uiJsonPath))) {
    fs.writeFileSync(uiJsonPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`   UI:   ${path.relative(ROOT, uiJsonPath)} (Updated)`);
  }
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
