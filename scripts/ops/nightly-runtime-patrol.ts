/* eslint-disable no-console -- CLI ops script */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON payloads */
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runNightlyIndexRemediation, type NightlyRemediationResult } from './nightly-index-remediation';
import {
  getTopStreaks,
  loadStreakStore,
  saveStreakStore,
  toJstDateString,
  updateStreakStore,
  STREAK_STORE_PATH,
  type FieldSkipRankEntry,
} from './fieldSkipStreak';
import { getDriftProbeTargets } from '../../src/sharepoint/driftProbeRegistry';

// --- Domain Types ---

export type SeverityLevel = 'silent' | 'watch' | 'action_required' | 'critical';

export interface GitHubWorkflowRun {
  name?: string;
  status?: string | null;
  conclusion?: string | null;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  run_number?: number;
}

export interface RawEvent {
  id: string;
  timestamp: string; // ISO8601
  eventType:
    | 'drift'
    | 'provision_failed'
    | 'provision_skipped:block'
    | 'http_429'
    | 'http_500'
    | 'health_fail'
    | 'index_pressure'
    | 'remediation'
    | 'transient_failure';
  area: string; // e.g. 'UserBenefit', 'StaffAttendance', 'Platform'
  resourceKey: string; // List name or logic module name
  fieldKey?: string; // Target field if applicable
  reasonCode: string;
  message: string;
}

export interface BundledEvent {
  fingerprint: string;
  severity: SeverityLevel;
  eventType: string;
  area: string;
  resourceKey: string;
  reasonCode: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  nextAction: string;
  sampleMessage: string;
}

export interface NightlySummary {
  reportDate: string;
  totalEvents: number;
  bundledCount: number;
  countsBySeverity: Record<SeverityLevel, number>;
  events: BundledEvent[];
  reasonCodeSummary: Array<{
    reasonCode: string;
    count: number;
    resources: string[];
  }>;
  /** Phase B+: sp:field_skipped streak results. Top entries by streak, window-filtered. */
  fieldSkipStreaks?: FieldSkipRankEntry[];
  driftLogReadStats?: {
    fallbackUsed: boolean;
    scannedCount: number;
    filteredCount: number;
    lookbackHours: number;
    topLimit: number;
    safety: 'safe' | 'watch' | 'near_limit';
  };
}

type DriftLogReadStats = NonNullable<NightlySummary['driftLogReadStats']>;

type FetchRealEventsResult = {
  events: RawEvent[];
  driftLogReadStats: DriftLogReadStats;
};

const TRANSIENT_FAILURE_WORKFLOW_TARGETS: Record<string, string> = {
  'integration (users)': 'Users_Master',
  'integration (staff)': 'Staff_Master',
  'integration (dailyops)': 'DailyOpsSignals',
};

const DEFAULT_TRANSIENT_FAILURE_WINDOW_HOURS = 6;
const REPEATED_TRANSIENT_FAILURE_THRESHOLD = 3;
const DRIFT_LOG_FALLBACK_TOP = 200;
const DRIFT_LOG_LOOKBACK_HOURS = 24;

function classifyDriftLogSafety(scannedCount: number): DriftLogReadStats['safety'] {
  if (scannedCount >= 180) return 'near_limit';
  if (scannedCount >= 100) return 'watch';
  return 'safe';
}

// --- Engine Logic ---

/**
 * Fingerprintの生成: 同一原因を束ねるための一意なハッシュ
 */
function generateFingerprint(event: RawEvent): string {
  const rawKey = [
    event.area,
    event.eventType,
    event.resourceKey,
    event.fieldKey || 'none',
    event.reasonCode,
  ].join('|');
  return createHash('sha256').update(rawKey).digest('hex').substring(0, 8);
}

/**
 * 深刻度の判定 (MVP実装: ご提示いただいた条件ベース)
 */
function classifySeverity(event: RawEvent): SeverityLevel {
  // 1. Critical
  if (event.eventType === 'http_429') return 'critical';
  if (
    event.eventType === 'health_fail' &&
    event.reasonCode === 'essential_resource_unavailable'
  )
    return 'critical';
  
  // Pending Essential Index (from emitIndexPressureRecord with severityOverride: 'critical')
  if (event.eventType === 'index_pressure' && event.message.includes('(CRITICAL)')) return 'critical';

  // 2. Action Required
  if (event.eventType === 'provision_failed') return 'action_required';
  if (event.eventType === 'http_500') return 'action_required';
  // Remediation Failure
  if (event.eventType === 'remediation' && (event.message.includes('fail') || event.message.includes('失敗'))) return 'action_required';
  if (event.eventType === 'transient_failure' && event.reasonCode === 'repeated_transient_failure') return 'action_required';

  // 3. Silent
  if (event.eventType === 'provision_skipped:block') return 'silent';
  // Done (Remediation Success)
  if (event.eventType === 'remediation' && (event.message.includes('成功') || event.message.includes('success'))) return 'silent';
  if (event.eventType === 'drift' && event.reasonCode === 'absorbed_strategy_e')
    return 'silent';

  // 4. Watch
  if (event.eventType === 'transient_failure' || event.reasonCode === 'transient_failure') return 'watch';
  // Pending Candidate Index (default warn/info)
  if (event.eventType === 'index_pressure') return 'watch';
  return 'watch';
}

/**
 * NextAction の決定 (読んで終わらせないため)
 */
function determineNextAction(severity: SeverityLevel, event: RawEvent): string {
  if (event.eventType === 'transient_failure') {
    return `[${event.resourceKey}] は Nightly Runtime Patrol 時点で回復しています。再発頻度を監視し、連続発生する場合は action_required へ昇格してください。`;
  }
  const highlight = event.eventType === 'index_pressure' ? 'sp_index_pressure' :
                  event.eventType === 'drift' ? 'sp_schema_drift' : '';
  const listParam = event.resourceKey !== 'Unknown' ? `&list=${encodeURIComponent(event.resourceKey)}` : '';
  const isAdminStatusLink = highlight 
    ? `管理画面 (/admin/status?highlight=${highlight}${listParam}) で具体的な解除コマンドを確認してください。`
    : '管理画面 (/admin/status) で具体的な解除コマンドを確認してください。';

  if (event.eventType === 'index_pressure') {
    return event.message.includes('(CRITICAL)') 
      ? `【至急】[${event.resourceKey}] で必須インデックスが不足しています。${isAdminStatusLink}`
      : `[${event.resourceKey}] でインデックスの最適化が可能です。${isAdminStatusLink}`;
  }
  if (severity === 'critical') {
    return '【至急】運用管理者にエスカレーションし、システム全体の利用可否を確認してください。';
  }
  if (event.eventType === 'provision_failed' || event.eventType === 'http_500') {
    return `[${event.resourceKey}] の保存フローで異常を検知しました。SharePoint リスト設定とデータの整合性を調査してください。`;
  }
  if (event.eventType === 'health_fail') {
    return `[${event.resourceKey}] の健全性チェックに失敗しました。管理画面 (/admin/status) で詳細を確認してください。`;
  }
  if (event.eventType === 'drift') {
    return `[${event.resourceKey}] でスキーマドリフトを検知しました。${isAdminStatusLink}`;
  }
  if (event.eventType === 'remediation') {
    return event.message.includes('失敗') || event.message.includes('fail')
      ? `【要確認】インデックス修復 (${event.fieldKey}) に失敗しました。${isAdminStatusLink}`
      : `インデックス自動修復 (${event.fieldKey}) が正常に完了しました。回復を確認してください。`;
  }
  if (severity === 'silent') {
    return '（対応不要・本システムで安全に吸収済み）';
  }
  return `[${event.resourceKey}] で異常が検出されました。管理画面 (/admin/status) を確認してください。`;
}

function parseEnvInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRunDate(run: GitHubWorkflowRun): Date | null {
  const raw = run.updated_at || run.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftDateStamp(dateStamp: string, daysDelta: number): string {
  const base = new Date(`${dateStamp}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysDelta);
  return base.toISOString().slice(0, 10);
}

export function deriveTransientFailureEvents(
  workflowRuns: GitHubWorkflowRun[],
  existingRawEvents: RawEvent[],
  now = new Date(),
  windowHours = DEFAULT_TRANSIENT_FAILURE_WINDOW_HOURS,
): RawEvent[] {
  const windowStartMs = now.getTime() - windowHours * 60 * 60 * 1000;
  const unresolvedResources = new Set(
    existingRawEvents
      .filter((event) => {
        const severity = classifySeverity(event);
        return severity === 'critical' || severity === 'action_required';
      })
      .map((event) => event.resourceKey),
  );

  const latestFailures = new Map<string, { target: string; run: GitHubWorkflowRun; observedAt: Date }>();
  const failedRunDaysByTarget = new Map<string, Set<string>>();

  for (const run of workflowRuns) {
    const workflowName = typeof run.name === 'string' ? run.name : '';
    const target = TRANSIENT_FAILURE_WORKFLOW_TARGETS[workflowName];
    if (!target || unresolvedResources.has(target)) continue;

    const status = `${run.status ?? ''}`.toLowerCase();
    const conclusion = `${run.conclusion ?? ''}`.toLowerCase();
    if (status !== 'completed' || conclusion !== 'failure') continue;

    const observedAt = parseRunDate(run);
    if (!observedAt) continue;

    const daySet = failedRunDaysByTarget.get(target) ?? new Set<string>();
    daySet.add(toJstDateString(observedAt));
    failedRunDaysByTarget.set(target, daySet);

    if (observedAt.getTime() < windowStartMs) continue;

    const existing = latestFailures.get(target);
    if (!existing || observedAt.getTime() > existing.observedAt.getTime()) {
      latestFailures.set(target, { target, run, observedAt });
    }
  }

  return Array.from(latestFailures.values()).map(({ target, run, observedAt }) => {
    const todayJst = toJstDateString(now);
    const consecutiveDays = Array.from({ length: REPEATED_TRANSIENT_FAILURE_THRESHOLD }, (_, index) =>
      shiftDateStamp(todayJst, -index),
    );
    const failedDays = failedRunDaysByTarget.get(target) ?? new Set<string>();
    const hasRepeatedTransientFailure = consecutiveDays.every((day) => failedDays.has(day));
    const runNumber = Number.isFinite(run.run_number) ? `#${run.run_number}` : 'unknown';
    const runLink = run.html_url ? ` (${run.html_url})` : '';
    const reasonCode = hasRepeatedTransientFailure ? 'repeated_transient_failure' : 'transient_failure';
    const repeatedText = hasRepeatedTransientFailure
      ? ` and has repeated for ${REPEATED_TRANSIENT_FAILURE_THRESHOLD} consecutive nights`
      : '';
    return {
      id: `transient-${target}-${observedAt.getTime()}`,
      timestamp: now.toISOString(),
      eventType: 'transient_failure',
      area: 'Runtime',
      resourceKey: target,
      reasonCode,
      message: `${target} recovered by Nightly Runtime Patrol after ${run.name} failed at ${observedAt.toISOString()} (${runNumber})${runLink}${repeatedText}`,
    };
  });
}

async function fetchTransientFailureEvents(existingRawEvents: RawEvent[]): Promise<RawEvent[]> {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    return [];
  }

  const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
  const perPage = parseEnvInteger('NIGHTLY_TRANSIENT_FAILURE_GITHUB_RUNS_LIMIT', 100);
  const windowHours = parseEnvInteger('NIGHTLY_TRANSIENT_FAILURE_WINDOW_HOURS', DEFAULT_TRANSIENT_FAILURE_WINDOW_HOURS);

  try {
    const response = await globalThis.fetch(`${apiBase}/repos/${repo}/actions/runs?per_page=${perPage}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch GitHub workflow runs: ${response.status} ${response.statusText}`);
      return [];
    }

    const payload = (await response.json()) as { workflow_runs?: GitHubWorkflowRun[] };
    return deriveTransientFailureEvents(payload.workflow_runs ?? [], existingRawEvents, new Date(), windowHours);
  } catch (error) {
    console.warn(`⚠️ Failed to derive transient failures from GitHub workflow runs: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

/**
 * 生イベントを束ねて評価するコアエンジン
 */
export function aggregateEvents(rawEvents: RawEvent[]): NightlySummary {
  const bundles = new Map<string, BundledEvent>();

  for (const event of rawEvents) {
    const fingerprint = generateFingerprint(event);

    if (!bundles.has(fingerprint)) {
      const severity = classifySeverity(event);
      bundles.set(fingerprint, {
        fingerprint,
        severity,
        eventType: event.eventType,
        area: event.area,
        resourceKey: event.resourceKey,
        reasonCode: event.reasonCode,
        occurrences: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        nextAction: determineNextAction(severity, event),
        sampleMessage: event.message,
      });
    } else {
      const bundle = bundles.get(fingerprint)!;
      bundle.occurrences += 1;
      // Update last/first seen
      if (new Date(event.timestamp) > new Date(bundle.lastSeen)) {
        bundle.lastSeen = event.timestamp;
      }
      if (new Date(event.timestamp) < new Date(bundle.firstSeen)) {
        bundle.firstSeen = event.timestamp;
      }
    }
  }

  const bundledArray = Array.from(bundles.values());

  // 深刻度順にソート (critical > action_required > watch > silent)
  const severityScore = { critical: 3, action_required: 2, watch: 1, silent: 0 };
  bundledArray.sort((a, b) => severityScore[b.severity] - severityScore[a.severity]);

  const summaryCounter: Record<SeverityLevel, number> = {
    critical: 0,
    action_required: 0,
    watch: 0,
    silent: 0,
  };

  bundledArray.forEach((b) => {
    summaryCounter[b.severity] += 1;
  });

  const reasonCodeSummary = Array.from(
    bundledArray.reduce((acc, event) => {
      const current = acc.get(event.reasonCode) ?? {
        reasonCode: event.reasonCode,
        count: 0,
        resources: new Set<string>(),
      };
      current.count += 1;
      current.resources.add(event.resourceKey);
      acc.set(event.reasonCode, current);
      return acc;
    }, new Map<string, { reasonCode: string; count: number; resources: Set<string> }>()),
  )
    .map(([, entry]) => ({
      reasonCode: entry.reasonCode,
      count: entry.count,
      resources: Array.from(entry.resources).sort(),
    }))
    .sort((a, b) => b.count - a.count || a.reasonCode.localeCompare(b.reasonCode));

  return {
    reportDate: new Date().toISOString().split('T')[0],
    totalEvents: rawEvents.length,
    bundledCount: bundledArray.length,
    countsBySeverity: summaryCounter,
    events: bundledArray,
    reasonCodeSummary,
  };
}

// --- Output Formatters ---

export function formatMarkdown(summary: NightlySummary): string {
  const driftLogLine = summary.driftLogReadStats
    ? `* 📘 **Drift Log Read**: fallback=${summary.driftLogReadStats.fallbackUsed ? 'yes' : 'no'} / scanned=${summary.driftLogReadStats.scannedCount} / filtered=${summary.driftLogReadStats.filteredCount} / safety=${summary.driftLogReadStats.safety}\n`
    : '';
  const header = `
# Nightly Runtime Patrol Report — ${summary.reportDate}

## 📊 Summary
* **Total Raw Events**: ${summary.totalEvents}
* **Bundled Issues**: ${summary.bundledCount}
  * 🔴 **Critical**: ${summary.countsBySeverity.critical}
  * 🟠 **Action Required**: ${summary.countsBySeverity.action_required}
  * 🟡 **Watch**: ${summary.countsBySeverity.watch}
  * 🟢 **Silent (Absorbed)**: ${summary.countsBySeverity.silent}
${driftLogLine}

---
`;

  const reasonCodeSummaryMarkdown = summary.reasonCodeSummary.length === 0
    ? '_No reason codes recorded._'
    : `| Reason Code | Count | Resources |\n| --- | :---: | --- |\n${summary.reasonCodeSummary
        .map((entry) => `| \`${entry.reasonCode}\` | ${entry.count} | ${entry.resources.join(', ')} |`)
        .join('\n')}`;

  // Silentはレポート本体を汚さないために分離
  const selfHealingEvents = summary.events.filter(
    (e) => e.eventType === 'remediation' && e.severity === 'silent'
  );
  const repeatedTransientEvents = summary.events.filter(
    (e) => e.eventType === 'transient_failure' && e.reasonCode === 'repeated_transient_failure',
  );
  const transientEvents = summary.events.filter(
    (e) => e.eventType === 'transient_failure' && e.reasonCode !== 'repeated_transient_failure',
  );
  const displayEvents = summary.events.filter(
    (e) => e.severity !== 'silent' && e.eventType !== 'transient_failure'
  );
  const silentEvents = summary.events.filter(
    (e) => e.severity === 'silent' && e.eventType !== 'remediation'
  );

  const createTable = (events: BundledEvent[]) => {
    if (events.length === 0) return '_No events recorded._\n';
    let table = '| Severity | Event Type | Resource | Occurrences | Fingerprint | NextAction |\n';
    table += '| --- | --- | --- | :---: | --- | --- |\n';
    events.forEach((e) => {
      const sevIcon =
        e.severity === 'critical'
          ? '🔴'
          : e.severity === 'action_required'
          ? '🟠'
          : e.severity === 'watch'
          ? '🟡'
          : '🟢';
      table += `| ${sevIcon} ${e.severity} | \`${e.eventType}\` | **${e.resourceKey}** | ${e.occurrences} | \`${e.fingerprint}\` | ${e.nextAction} |\n`;
    });
    return table;
  };

  const body = `
## 🧾 Reason Code Summary
${reasonCodeSummaryMarkdown}

## ✨ Self-Healing Results (Auto-Remediated)
${selfHealingEvents.length > 0 ? createTable(selfHealingEvents) : '_No auto-remediation actions were necessary today._\n'}

## 🔁 Repeated Transient Failures
${createTable(repeatedTransientEvents)}

## ♻️ Recovered Transient Failures
${createTable(transientEvents)}

## 🚨 Requires Attention (Critical & Action Required & Watch)
${createTable(displayEvents)}

<details>
<summary><b>🟢 Silent / Absorbed Events (${silentEvents.length})</b></summary>

_These events were safely absorbed by system resilience features (e.g., Strategy E, 8KB Limits). No action is required._

| Event Type | Resource | Occurrences | Fingerprint | Ref |
| --- | --- | :---: | --- | --- |
${silentEvents
  .map(
    (e) =>
      `| \`${e.eventType}\` | **${e.resourceKey}** | ${e.occurrences} | \`${e.fingerprint}\` | ${e.sampleMessage} |`
  )
  .join('\n')}

</details>
`;

  return header + body;
}

export function formatStepSummary(summary: NightlySummary): string {
  const repeatedTransientEvents = summary.events.filter(
    (e) => e.eventType === 'transient_failure' && e.reasonCode === 'repeated_transient_failure',
  );
  const transientEvents = summary.events.filter(
    (e) => e.eventType === 'transient_failure' && e.reasonCode !== 'repeated_transient_failure',
  );
  const attentionEvents = summary.events.filter(
    (e) => e.severity === 'critical' || e.severity === 'action_required',
  );
  const watchEvents = summary.events.filter((e) => e.severity === 'watch');

  const overall =
    summary.countsBySeverity.critical > 0
      ? '🔴 Action Required'
      : summary.countsBySeverity.action_required > 0
        ? '🟠 Action Required'
        : summary.countsBySeverity.watch > 0
          ? '🟡 Watch'
          : '✅ Healthy';

  const listOrNone = (lines: string[]): string =>
    lines.length > 0 ? lines.join('\n') : '- なし';

  const reasonCodeLines = summary.reasonCodeSummary.map(
    (entry) => `- \`${entry.reasonCode}\`: ${entry.count}${entry.resources.length > 0 ? ` (${entry.resources.join(', ')})` : ''}`,
  );
  const attentionLines = attentionEvents.map(
    (event) => `- **${event.resourceKey}** — \`${event.reasonCode}\``,
  );
  const watchLines = watchEvents.map(
    (event) => `- **${event.resourceKey}** — \`${event.reasonCode}\``,
  );
  const transientLines = transientEvents.map(
    (event) => `- **${event.resourceKey}** — recovered (\`${event.reasonCode}\`)`,
  );
  const repeatedTransientLines = repeatedTransientEvents.map(
    (event) => `- **${event.resourceKey}** — repeated (\`${event.reasonCode}\`)`,
  );

  return `## Nightly Runtime Patrol

- Overall: **${overall}**
- Action Required: **${summary.countsBySeverity.action_required}**
- Watch: **${summary.countsBySeverity.watch}**
- Recovered Transient Failures: **${transientEvents.length}**
- Repeated Transient Failures: **${repeatedTransientEvents.length}**

### Requires Attention
${listOrNone(attentionLines)}

### Watch
${listOrNone(watchLines)}

### Reason Code Summary
${listOrNone(reasonCodeLines)}

### Recovered Transient Failures
${listOrNone(transientLines)}

### Repeated Transient Failures
${listOrNone(repeatedTransientLines)}
`;
}

async function writeStepSummary(summary: NightlySummary): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  try {
    await fs.appendFile(summaryPath, `${formatStepSummary(summary)}\n`, 'utf-8');
    console.log(`  └ GitHub Step Summary written: ${summaryPath}`);
  } catch (error) {
    console.warn(`  ⚠️ Failed to write GitHub Step Summary: ${error instanceof Error ? error.message : error}`);
  }
}

// --- Data Ingestion ---

async function fetchRealEvents(fallbackMock: RawEvent[]): Promise<FetchRealEventsResult> {
  const token = process.env.VITE_SP_TOKEN;
  const siteUrl = process.env.VITE_SP_SITE_URL;
  const driftLogReadStats: DriftLogReadStats = {
    fallbackUsed: false,
    scannedCount: 0,
    filteredCount: 0,
    lookbackHours: DRIFT_LOG_LOOKBACK_HOURS,
    topLimit: DRIFT_LOG_FALLBACK_TOP,
    safety: 'safe',
  };

  if (!token || !siteUrl) {
    console.warn('⚠️ VITE_SP_TOKEN or VITE_SP_SITE_URL is not set. Falling back to mock data.');
    return { events: fallbackMock, driftLogReadStats };
  }

  const events: RawEvent[] = [];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const filterDate = yesterday.toISOString();
  
  console.log(`🔍 Fetching telemetry from SharePoint since ${filterDate}...`);
  
  const headers = { 
    'Authorization': `Bearer ${token}`, 
    'Accept': 'application/json;odata=nometadata' 
  };

  const fetchJson = async (url: string) => {
    const res = await globalThis.fetch(url, { headers });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    return { res, data, text };
  };

  const isListViewThresholdResponse = (res: Response, text: string): boolean =>
    res.status === 500 && /list view threshold/i.test(text);

  const mapDriftItemToEvent = (item: any): RawEvent => {
    let eType: RawEvent['eventType'] = 'drift';

    const msg = item.Title || '';
    const field = item.FieldName || item.Field_x0020_Name || 'None';
    if (field === 'INDEX_PRESSURE') eType = 'index_pressure';
    else if (field.startsWith('INDEX_')) eType = 'remediation';
    else if (msg.includes('provision_failed')) eType = 'provision_failed';
    else if (msg.includes('provision_skipped:block')) eType = 'provision_skipped:block';

    return {
      id: `drift-${item.Id}`,
      timestamp: item.DetectedAt || item.Detected_x0020_At || item.Created,
      eventType: eType,
      area: 'Runtime',
      resourceKey: item.ListName || item.List_x0020_Name || 'Unknown',
      fieldKey: field,
      reasonCode: item.ResolutionType || 'unknown',
      message: `${item.Severity === 'critical' ? '(CRITICAL) ' : ''}Severity: ${item.Severity}. ${item.ErrorMessage || msg}`,
    };
  };

  try {
    // 1. DriftEventsLog fetches
    const driftUrl = `${siteUrl}/_api/web/lists/getbytitle('DriftEventsLog')/items?$filter=Created ge datetime'${filterDate}'`;
    const driftAttempt = await fetchJson(driftUrl);

    if (driftAttempt.res.ok) {
      driftAttempt.data.value.forEach((item: any) => {
        events.push(mapDriftItemToEvent(item));
      });
      driftLogReadStats.scannedCount = driftAttempt.data.value.length;
      driftLogReadStats.filteredCount = driftAttempt.data.value.length;
      driftLogReadStats.safety = classifyDriftLogSafety(driftLogReadStats.scannedCount);
      console.log(`  └ Fetched ${driftAttempt.data.value.length} DriftEventsLog events.`);
    } else if (isListViewThresholdResponse(driftAttempt.res, driftAttempt.text)) {
      console.warn(`⚠️ DriftEventsLog threshold detected. Falling back to Id desc top ${DRIFT_LOG_FALLBACK_TOP}.`);
      driftLogReadStats.fallbackUsed = true;
      const fallbackUrl =
        `${siteUrl}/_api/web/lists/getbytitle('DriftEventsLog')/items` +
        `?$select=Id,Title,Created,DetectedAt,Detected_x0020_At,ListName,List_x0020_Name,FieldName,Field_x0020_Name,Severity,ResolutionType,ErrorMessage` +
        `&$orderby=Id desc&$top=${DRIFT_LOG_FALLBACK_TOP}`;
      const fallbackAttempt = await fetchJson(fallbackUrl);
      if (fallbackAttempt.res.ok) {
        const filtered = (fallbackAttempt.data.value as any[])
          .filter((item: any) => {
            const timestamp = item.DetectedAt || item.Detected_x0020_At || item.Created;
            const time = Date.parse(timestamp);
            const since = Date.parse(filterDate);
            return Number.isNaN(time) || Number.isNaN(since) ? true : time >= since;
          });
        filtered.forEach((item: any) => {
          events.push(mapDriftItemToEvent(item));
        });
        driftLogReadStats.scannedCount = fallbackAttempt.data.value.length;
        driftLogReadStats.filteredCount = filtered.length;
        driftLogReadStats.safety = classifyDriftLogSafety(driftLogReadStats.scannedCount);
        console.log(`  └ Fetched ${filtered.length} DriftEventsLog events via fallback (${fallbackAttempt.data.value.length} scanned).`);
      } else {
        console.warn(`⚠️ Failed to fetch DriftEventsLog fallback: ${fallbackAttempt.res.status} ${fallbackAttempt.res.statusText}`);
      }
    } else {
      console.warn(`⚠️ Failed to fetch DriftEventsLog: ${driftAttempt.res.status} ${driftAttempt.res.statusText}`);
    }

    // 2. DiagnosticsReports fetches
    const diagUrl = `${siteUrl}/_api/web/lists/getbytitle('DiagnosticsReports')/items?$filter=Created ge datetime'${filterDate}'`;
    const diagRes = await globalThis.fetch(diagUrl, { headers });
    if (diagRes.ok) {
        const data = await diagRes.json();
        data.value.forEach((item: any) => {
            const isCritical = item.Status === 'FAIL' || item.Title?.includes('FAIL');
            const hasThrottle = item.Payload?.includes('429');
            
            events.push({
                id: `diag-${item.Id}`,
                timestamp: item.Created,
                eventType: hasThrottle ? 'http_429' : (isCritical ? 'health_fail' : 'http_500'),
                area: 'Platform',
                resourceKey: 'DiagnosticsReports',
                reasonCode: isCritical ? 'essential_resource_unavailable' : 'sys_error',
                message: item.Title || 'Diagnostic error reported.'
            });
        });
        console.log(`  └ Fetched ${data.value.length} DiagnosticsReports events.`);
    } else {
        console.warn(`⚠️ Failed to fetch DiagnosticsReports: ${diagRes.status} ${diagRes.statusText} (List may not exist yet)`);
    }

  } catch (err) {
    console.error('Network Error during SharePoint fetch:', err);
    console.warn('Falling back to mock data due to network error.');
    return { events: fallbackMock, driftLogReadStats };
  }

  return { events, driftLogReadStats };
}

// --- Remediation Result → RawEvent conversion ---

function remediationToRawEvents(results: NightlyRemediationResult[]): RawEvent[] {
  return results.map((r, i) => ({
    id: `nightly-remediation-${Date.now()}-${i}`,
    timestamp: new Date().toISOString(),
    eventType: 'remediation' as const,
    area: 'IndexAdvisor',
    resourceKey: r.listTitle,
    fieldKey: r.internalName,
    reasonCode: r.outcome,
    message: r.message,
  }));
}

// --- Field Skip Probe ---

/**
 * Probe each Data Integrity scan target for $select field errors.
 * Uses the same 400-fallback loop as fetchRawItemsWithFieldFallback in the UI.
 * Returns a Set of reasonKeys (listKey:fieldName) that were skipped today.
 *
 * This function is self-contained (no @/ imports) so it runs cleanly in Node.js.
 * The telemetry transport pattern is satisfied: collected events stay in-process
 * and the store is updated before run() exits (transport stays null — no side effects).
 */
async function runFieldSkipProbe(token: string, siteUrl: string): Promise<Set<string>> {
  const PROBE_TARGETS = getDriftProbeTargets();

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json;odata=nometadata',
  };

  const seenTodayKeys = new Set<string>();

  for (const target of PROBE_TARGETS) {
    try {
      const skippedFields: string[] = [];
      let fields: string[] = [...target.selectFields];

      // Field-fallback loop: on HTTP 400 extract the offending field, remove, retry
      for (;;) {
        const select = fields.join(',');
        const url = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(target.listTitle)}')/items?$select=${select}&$top=1`;
        const res = await globalThis.fetch(url, { headers });

        if (res.ok) break;

        if (res.status === 400 && fields.length > 1) {
          const errText = await res.text().catch(() => '');
          const match = errText.match(/'([^']+)'/);
          const missing = match?.[1] ?? null;
          if (missing && fields.includes(missing)) {
            skippedFields.push(missing);
            fields = fields.filter((f) => f !== missing);
            continue;
          }
        }

        console.warn(`  ⚠️ Field skip probe: ${target.displayName} (${target.listTitle}) HTTP ${res.status} (non-recoverable)`);
        break;
      }

      // Dedupe within this run and build reason keys
      const seenFields = new Set<string>();
      for (const fieldName of skippedFields) {
        if (seenFields.has(fieldName)) continue;
        seenFields.add(fieldName);
        seenTodayKeys.add(`${target.key}:${fieldName}`);
      }

      if (skippedFields.length > 0) {
        console.log(`  └ Field skip probe [${target.key}]: skipped [${[...seenFields].join(', ')}]`);
      }
    } catch (err) {
      // Fail-soft: probe error must not stop patrol
      console.warn(`  ⚠️ Field skip probe error [${target.listTitle}]:`, err instanceof Error ? err.message : err);
    }
  }

  return seenTodayKeys;
}

// --- execution block for local testing ---
async function run() {
  // モック生データ: 様々なケースを想定
  const mockRawEvents: RawEvent[] = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      eventType: 'provision_skipped:block',
      area: 'UserBenefit',
      resourceKey: 'UserBenefit_Profile',
      reasonCode: 'max_size_exceeded',
      message: 'Prevented creation to avoid 8KB limits.',
    },
    {
      id: '2',
      timestamp: new Date().toISOString(),
      eventType: 'provision_skipped:block',
      area: 'UserBenefit',
      resourceKey: 'UserBenefit_Profile',
      reasonCode: 'max_size_exceeded',
      message: 'Prevented creation to avoid 8KB limits.',
    },
    {
      id: '3',
      timestamp: new Date().toISOString(),
      eventType: 'http_429',
      area: 'Platform',
      resourceKey: 'SharePoint_API',
      reasonCode: 'rate_limit',
      message: 'SharePoint Throttle occurred.',
    },
    {
      id: '4',
      timestamp: new Date().toISOString(),
      eventType: 'health_fail',
      area: 'Platform',
      resourceKey: 'Users_Master',
      reasonCode: 'list_not_found',
      message: 'Users_Master list does not exist.',
    },
    {
      id: '5',
      timestamp: new Date().toISOString(),
      eventType: 'drift',
      area: 'Daily',
      resourceKey: 'support_record_daily',
      fieldKey: 'unknownField',
      reasonCode: 'unknown_field_added',
      message: 'New field encountered.',
    },
    {
      id: '6',
      timestamp: new Date().toISOString(),
      eventType: 'drift',
      area: 'UserBenefit',
      resourceKey: 'UserBenefit_Profile',
      fieldKey: 'dummy',
      reasonCode: 'absorbed_strategy_e',
      message: 'Strategy E absorbed it.',
    },
    {
      id: '8',
      timestamp: new Date().toISOString(),
      eventType: 'index_pressure',
      area: 'Runtime',
      resourceKey: 'iceberg_analysis',
      reasonCode: 'index_required',
      message: '(CRITICAL) Severity: critical. Index Count: 18 / 20. Essential indexes missing.',
    },
    {
      id: '9',
      timestamp: new Date().toISOString(),
      eventType: 'remediation',
      area: 'Runtime',
      resourceKey: 'UserBenefit_Profile',
      fieldKey: 'RecipientCertNumber',
      reasonCode: 'manual',
      message: 'RecipientCertNumber のインデックス作成に失敗しました: Network Error',
    },
    {
      id: '10',
      timestamp: new Date().toISOString(),
      eventType: 'remediation',
      area: 'Runtime',
      resourceKey: 'StaffAttendance',
      fieldKey: 'RecordDate',
      reasonCode: 'manual',
      message: 'RecordDate のインデックスを作成しました（成功）。',
    },
  ];

  // 実データの取得（失敗時や設定がない場合はモックへフォールバック）
  const { events: rawEvents, driftLogReadStats } = await fetchRealEvents(mockRawEvents);

  const transientFailureEvents = await fetchTransientFailureEvents(rawEvents);
  if (transientFailureEvents.length > 0) {
    rawEvents.push(...transientFailureEvents);
    console.log(`  └ Transient failures recovered by Nightly: ${transientFailureEvents.length}`);
  }

  // ── Nightly Index Remediation (Mode B: guarded add only) ──────────────────
  const token = process.env.VITE_SP_TOKEN;
  const siteUrl = process.env.VITE_SP_SITE_URL;

  if (token && siteUrl) {
    console.log('🔧 Running nightly index remediation...');
    try {
      const remediationResults = await runNightlyIndexRemediation({ token, siteUrl });
      const remediationEvents = remediationToRawEvents(remediationResults);
      rawEvents.push(...remediationEvents);

      const added = remediationResults.filter((r) => r.outcome === 'added').length;
      const failed = remediationResults.filter((r) => r.outcome === 'failed').length;
      const skipped = remediationResults.filter((r) => r.outcome === 'skipped_limit').length;
      console.log(`  └ Remediation: added=${added}, failed=${failed}, skipped=${skipped}`);
    } catch (err) {
      // remediation 全体が失敗しても patrol を止めない (fail-soft)
      console.warn(`  ⚠️ Nightly index remediation error: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.warn('⚠️ Skipping nightly index remediation: VITE_SP_TOKEN or VITE_SP_SITE_URL not set.');
  }
  // ─────────────────────────────────────────────────────────────────────────

  const summary = aggregateEvents(rawEvents);
  summary.driftLogReadStats = driftLogReadStats;

  // ── Phase B: sp:field_skipped streak集計 ─────────────────────────────────
  if (token && siteUrl) {
    console.log('🔍 Running field skip probe...');
    try {
      const today = toJstDateString(new Date());
      const seenTodayKeys = await runFieldSkipProbe(token, siteUrl);

      const streakStore = await loadStreakStore(STREAK_STORE_PATH);
      const updatedStore = updateStreakStore(streakStore, seenTodayKeys, today);
      await saveStreakStore(STREAK_STORE_PATH, updatedStore);

      summary.fieldSkipStreaks = getTopStreaks(updatedStore, today, { windowDays: 7 });

      const persistent = summary.fieldSkipStreaks.filter((e) => e.status === 'persistent_drift');
      console.log(`  └ Streak updated: keys=${Object.keys(updatedStore).length}, persistent_drift=${persistent.length}`);
      if (persistent.length > 0) {
        console.warn(`  ⚠️ persistent_drift detected: ${persistent.map((e) => e.reasonKey).join(', ')}`);
      }
    } catch (err) {
      // Fail-soft: streak error must not stop patrol
      console.warn(`  ⚠️ Field skip streak error: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.warn('⚠️ Skipping field skip probe: VITE_SP_TOKEN or VITE_SP_SITE_URL not set.');
  }
  // ─────────────────────────────────────────────────────────────────────────

  // JSON出力
  const jsonOutput = JSON.stringify(summary, null, 2);
  
  // Markdown出力
  const mdOutput = formatMarkdown(summary);

  // ファイル出力
  await fs.mkdir('.nightly', { recursive: true });
  await fs.writeFile(path.join('.nightly', 'runtime-summary.json'), jsonOutput, 'utf-8');
  await fs.writeFile(path.join('.nightly', 'runtime-summary.md'), mdOutput, 'utf-8');

  // --- Phase D: SharePoint への永続化 (基盤統合) ---
  if (token && siteUrl) {
    try {
      console.log('💾 Saving runtime summary to SharePoint...');
      const saveUrl = `${siteUrl}/_api/web/lists/getbytitle('Diagnostics_Reports')/items`;
      await globalThis.fetch(saveUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: 'runtime-summary',
          Overall:
            summary.countsBySeverity.critical > 0
              ? 'fail'
              : (summary.countsBySeverity.action_required > 0 ||
                  summary.countsBySeverity.watch > 0 ||
                  (summary.fieldSkipStreaks?.length ?? 0) > 0)
                ? 'warn'
                : 'pass',
          TopIssue:
            summary.countsBySeverity.critical > 0
              ? 'Critical failures detected'
              : (summary.fieldSkipStreaks?.length ?? 0) > 0
                ? 'Persistent drifts detected'
                : summary.events.some((event) => event.eventType === 'transient_failure')
                  ? 'Recovered transient failures detected'
                  : 'Healthy',
          SummaryText: jsonOutput, // PayloadJson として使用
        }),
      });
      console.log('  └ Successfully saved to Diagnostics_Reports.');
    } catch (err) {
      console.warn('  ⚠️ Failed to save summary to SharePoint:', err);
    }
  }

  console.log('✅ Nightly Runtime Patrol executed.');
  console.log(`  - Fetch count : ${summary.totalEvents}`);
  console.log(`  - Bundle count: ${summary.bundledCount}`);

  console.log(`  - Silent count: ${summary.countsBySeverity.silent}`);
  console.log('Results written to .nightly/runtime-summary.{json,md}');

  await writeStepSummary(summary);

  // Teams通知の実行
  await sendTeamsNotification(summary);
}

/**
 * Teams Webhook への通知送信
 * Adaptive Cards を使用して視覚的に分かりやすい要約を送信する
 */
export async function sendTeamsNotification(summary: NightlySummary, webhookUrl?: string): Promise<boolean> {
  const url = webhookUrl || process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    console.warn('⚠️ TEAMS_WEBHOOK_URL is not set. Skipping Teams notification.');
    return false;
  }

  const hasCritical = summary.countsBySeverity.critical > 0;
  const hasAction = summary.countsBySeverity.action_required > 0;
  const hasWatch = summary.countsBySeverity.watch > 0;
  const persistentDrifts = (summary.fieldSkipStreaks ?? []).filter((e) => e.status === 'persistent_drift');
  const hasPersistentDrift = persistentDrifts.length > 0;
  const repeatedTransientFailures = summary.events
    .filter((event) => event.eventType === 'transient_failure' && event.reasonCode === 'repeated_transient_failure')
    .slice(0, 5);
  const transientFailures = summary.events
    .filter((event) => event.eventType === 'transient_failure' && event.reasonCode !== 'repeated_transient_failure')
    .slice(0, 5);

  const statusColor = (hasCritical || hasPersistentDrift) ? 'Attention' : ((hasAction || hasWatch) ? 'Warning' : 'Good');
  const statusEmoji = hasCritical ? '🔴 CRITICAL' : (hasAction ? '🟠 Action Required' : (hasWatch ? '🟡 Watch' : '✅ Healthy'));

  // 重要度の高いイベントのみを抽出（Adaptive Card の制限内に収める）
  const highlightEvents = summary.events
    .filter(e => e.severity === 'critical' || e.severity === 'action_required')
    .slice(0, 5);

  const cardItems: any[] = [
    {
      type: 'TextBlock',
      size: 'Medium',
      weight: 'Bolder',
      text: `🌔 Nightly Runtime Patrol Summary — ${summary.reportDate}`
    },
    {
      type: 'TextBlock',
      text: `Status: **${statusEmoji}**`,
      color: statusColor,
      wrap: true
    },
    {
      type: 'FactSet',
      facts: [
        { title: '🔴 Critical', value: `${summary.countsBySeverity.critical}` },
        { title: '🟠 Action Required', value: `${summary.countsBySeverity.action_required}` },
        { title: '🟡 Watch', value: `${summary.countsBySeverity.watch}` },
        { title: '🟢 Silent', value: `${summary.countsBySeverity.silent}` }
      ]
      }
    ];

  if (summary.reasonCodeSummary.length > 0) {
    cardItems.push({
      type: 'TextBlock',
      text: '🧾 **Reason Code Summary**',
      separator: true,
      wrap: true,
      weight: 'Bolder',
    });

    summary.reasonCodeSummary.slice(0, 5).forEach((entry) => {
      const resourceLabel = entry.resources.slice(0, 3).join(', ');
      cardItems.push({
        type: 'TextBlock',
        text: `\`${entry.reasonCode}\`: ${entry.count}${resourceLabel ? ` (${resourceLabel})` : ''}`,
        wrap: true,
        size: 'Small',
        isSubtle: true,
      });
    });
  }

  if (highlightEvents.length > 0) {
    cardItems.push({
      type: 'TextBlock',
      text: '🚨 **Requires Attention (Next Actions)**',
      separator: true,
      wrap: true,
      weight: 'Bolder'
    });

    highlightEvents.forEach(e => {
      cardItems.push({
        type: 'Container',
        items: [
          {
            type: 'TextBlock',
            text: `**[${e.resourceKey}]** ${e.sampleMessage}`,
            wrap: true,
            size: 'Small'
          },
          {
            type: 'TextBlock',
            text: `👉 ${e.nextAction}`,
            wrap: true,
            color: e.severity === 'critical' ? 'Attention' : 'Warning',
            isSubtle: true,
            size: 'Small'
          }
        ],
        spacing: 'Medium'
      });
    });
  } else {
    cardItems.push({
      type: 'TextBlock',
      text: hasWatch
        ? '🟡 **No Critical or Action Required issues detected, but watch items remain.**'
        : '✅ **No Critical or Action Required issues detected.**',
      separator: true,
      wrap: true
    });
  }

  if (transientFailures.length > 0) {
    cardItems.push({
      type: 'TextBlock',
      text: '♻️ **Recovered transient failures**',
      separator: true,
      wrap: true,
      weight: 'Bolder',
    });
    transientFailures.forEach((event) => {
      cardItems.push({
        type: 'TextBlock',
        text: `**${event.resourceKey}** — Nightly が一時障害を吸収しました。再発頻度を監視してください。`,
        wrap: true,
        size: 'Small',
        color: 'Warning',
      });
    });
  }

  if (repeatedTransientFailures.length > 0) {
    cardItems.push({
      type: 'TextBlock',
      text: '🔁 **Repeated transient failures**',
      separator: true,
      wrap: true,
      weight: 'Bolder',
      color: 'Attention',
    });
    repeatedTransientFailures.forEach((event) => {
      cardItems.push({
        type: 'TextBlock',
        text: `**${event.resourceKey}** — 3夜連続で一時障害を吸収しています。認証・スロットリング・SharePoint 到達性を確認してください。`,
        wrap: true,
        size: 'Small',
        color: 'Attention',
      });
    });
  }

  // ── Persistent Field Drift section (Phase C) ─────────────────────────────
  if (hasPersistentDrift) {
    cardItems.push({
      type: 'TextBlock',
      text: '⚠️ **Persistent Field Drift Detected**',
      separator: true,
      wrap: true,
      weight: 'Bolder',
      color: 'Attention',
    });
    persistentDrifts.forEach((e) => {
      cardItems.push({
        type: 'TextBlock',
        text: `**${e.reasonKey}** — ${e.streak}日連続スキップ → ensureField を検討してください`,
        wrap: true,
        size: 'Small',
        color: 'Attention',
      });
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  cardItems.push({
    type: 'TextBlock',
    text: '詳細は `.nightly/runtime-summary.md` または管理画面の健康診断ページを確認してください。',
    wrap: true,
    size: 'Small',
    isSubtle: true,
    separator: true
  });

  const mentionUpn = process.env.TEAMS_MENTION_UPN;
  const shouldMention = (hasCritical || hasAction || hasPersistentDrift) && mentionUpn;

  if (shouldMention) {
    cardItems.push({
      type: 'TextBlock',
      text: `<at>${mentionUpn}</at> 異常を検知しました。内容の確認をお願いします。`,
      wrap: true,
      separator: true,
      weight: 'Bolder'
    });
  }

  const adaptiveCard = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: cardItems,
          msteams: shouldMention ? {
             entities: [
               {
                 type: 'mention',
                 text: `<at>${mentionUpn}</at>`,
                 mentioned: {
                   id: mentionUpn,
                   name: mentionUpn
                 }
               }
             ]
          } : undefined
        }
      }
    ]
  };

  try {
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adaptiveCard)
    });
    
    if (res.ok) {
      console.log('✅ Teams notification sent successfully.');
      return true;
    } else {
      console.error(`❌ Failed to send Teams notification: ${res.status} ${res.statusText}`);
      return false;
    }
  } catch (err) {
    console.error('❌ Error sending Teams notification:', err);
    return false;
  }
}

// --- execution block for local testing ---
// 実行条件 (CLI呼び出しかどうか) を簡易判定
const isCLI = typeof process !== 'undefined' && process.argv[1] && (import.meta.url?.includes(path.basename(process.argv[1])) || (typeof require !== 'undefined' && require.main === module));

if (isCLI) {
  run().catch(console.error);
}
