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
    | 'remediation';
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
  /** Phase B+: sp:field_skipped streak results. Top entries by streak, window-filtered. */
  fieldSkipStreaks?: FieldSkipRankEntry[];
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

  // 3. Silent
  if (event.eventType === 'provision_skipped:block') return 'silent';
  // Done (Remediation Success)
  if (event.eventType === 'remediation' && (event.message.includes('成功') || event.message.includes('success'))) return 'silent';
  if (event.eventType === 'drift' && event.reasonCode === 'absorbed_strategy_e')
    return 'silent';

  // 4. Watch
  // Pending Candidate Index (default warn/info)
  if (event.eventType === 'index_pressure') return 'watch';
  return 'watch';
}

/**
 * NextAction の決定 (読んで終わらせないため)
 */
function determineNextAction(severity: SeverityLevel, event: RawEvent): string {
  if (event.eventType === 'index_pressure') {
    return event.message.includes('(CRITICAL)') 
      ? `【至急】[${event.resourceKey}] で必須インデックスが不足しています。システム停止を防ぐため、Index Advisor で修復を実行してください。`
      : `[${event.resourceKey}] でインデックスの最適化が可能です。計画的なメンテナンス時に Index Advisor を確認してください。`;
  }
  if (severity === 'critical') {
    return '【至急】運用管理者にエスカレーションし、システム全体の利用可否を確認してください。';
  }
  if (event.eventType === 'provision_failed' || event.eventType === 'http_500') {
    return `[${event.resourceKey}] の保存フローで異常を検知しました。SharePoint リスト設定とデータの整合性を調査してください。`;
  }
  if (event.eventType === 'health_fail') {
    return `[${event.resourceKey}] の健全性チェックに失敗しました。SharePoint 管理画面でリストの存在・権限設定を確認してください。`;
  }
  if (event.eventType === 'drift') {
    return `[${event.resourceKey}] に誰かがフィールドを直接追加・削除した可能性があるため、変更履歴を調査してください。`;
  }
  if (event.eventType === 'remediation') {
    return event.message.includes('失敗') || event.message.includes('fail')
      ? `【要確認】インデックス修復 (${event.fieldKey}) に失敗しました。ネットワーク状態や SharePoint 権限を確認してください。`
      : `インデックス自動修復 (${event.fieldKey}) が正常に完了しました。`;
  }
  if (severity === 'silent') {
    return '（対応不要・本システムで安全に吸収済み）';
  }
  return `[${event.resourceKey}] で異常が検出されました。管理画面の状態ページを確認してください。`;
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

  return {
    reportDate: new Date().toISOString().split('T')[0],
    totalEvents: rawEvents.length,
    bundledCount: bundledArray.length,
    countsBySeverity: summaryCounter,
    events: bundledArray,
  };
}

// --- Output Formatters ---

export function formatMarkdown(summary: NightlySummary): string {
  const header = `
# Nightly Runtime Patrol Report — ${summary.reportDate}

## 📊 Summary
* **Total Raw Events**: ${summary.totalEvents}
* **Bundled Issues**: ${summary.bundledCount}
  * 🔴 **Critical**: ${summary.countsBySeverity.critical}
  * 🟠 **Action Required**: ${summary.countsBySeverity.action_required}
  * 🟡 **Watch**: ${summary.countsBySeverity.watch}
  * 🟢 **Silent (Absorbed)**: ${summary.countsBySeverity.silent}

---
`;

  // Silentはレポート本体を汚さないために分離
  const displayEvents = summary.events.filter((e) => e.severity !== 'silent');
  const silentEvents = summary.events.filter((e) => e.severity === 'silent');

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
          : '🟡';
      table += `| ${sevIcon} ${e.severity} | \`${e.eventType}\` | **${e.resourceKey}** | ${e.occurrences} | \`${e.fingerprint}\` | ${e.nextAction} |\n`;
    });
    return table;
  };

  const body = `
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

// --- Data Ingestion ---

async function fetchRealEvents(fallbackMock: RawEvent[]): Promise<RawEvent[]> {
  const token = process.env.VITE_SP_TOKEN;
  const siteUrl = process.env.VITE_SP_SITE_URL;

  if (!token || !siteUrl) {
    console.warn('⚠️ VITE_SP_TOKEN or VITE_SP_SITE_URL is not set. Falling back to mock data.');
    return fallbackMock;
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

  try {
    // 1. DriftEventsLog fetches
    const driftUrl = `${siteUrl}/_api/web/lists/getbytitle('DriftEventsLog')/items?$filter=Created ge datetime'${filterDate}'`;
    // Bypass ESLint rule against raw fetch in this CLI script
    const driftRes = await globalThis.fetch(driftUrl, { headers });
    
    if (driftRes.ok) {
      const data = await driftRes.json();
      data.value.forEach((item: any) => {
         let eType: RawEvent['eventType'] = 'drift';
         
         const msg = item.Title || '';
         const field = item.FieldName || '';
         if (field === 'INDEX_PRESSURE') eType = 'index_pressure';
         else if (field.startsWith('INDEX_')) eType = 'remediation';
         else if (msg.includes('provision_failed')) eType = 'provision_failed';
         else if (msg.includes('provision_skipped:block')) eType = 'provision_skipped:block';
         
         events.push({
            id: `drift-${item.Id}`,
            timestamp: item.DetectedAt || item.Created,
            eventType: eType,
            area: 'Runtime',
            resourceKey: item.ListName || 'Unknown',
            fieldKey: item.FieldName || 'None',
            reasonCode: item.ResolutionType || 'unknown',
            message: `${item.Severity === 'critical' ? '(CRITICAL) ' : ''}Severity: ${item.Severity}. ${item.ErrorMessage || msg}`
         });
      });
      console.log(`  └ Fetched ${data.value.length} DriftEventsLog events.`);
    } else {
      console.warn(`⚠️ Failed to fetch DriftEventsLog: ${driftRes.status} ${driftRes.statusText}`);
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
    return fallbackMock;
  }

  return events;
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
  const rawEvents = await fetchRealEvents(mockRawEvents);

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
          Overall: summary.countsBySeverity.critical > 0 ? 'fail' : (summary.countsBySeverity.action_required > 0 ? 'warn' : 'pass'),
          TopIssue: summary.countsBySeverity.critical > 0 ? 'Critical failures detected' : (summary.fieldSkipStreaks?.length ? 'Persistent drifts detected' : 'Healthy'),
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
  const persistentDrifts = (summary.fieldSkipStreaks ?? []).filter((e) => e.status === 'persistent_drift');
  const hasPersistentDrift = persistentDrifts.length > 0;

  const statusColor = (hasCritical || hasPersistentDrift) ? 'Attention' : (hasAction ? 'Warning' : 'Good');
  const statusEmoji = hasCritical ? '🔴 CRITICAL' : (hasAction ? '🟠 Action Required' : '✅ Healthy');

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
      text: '✅ **No Critical or Action Required issues detected.**',
      separator: true,
      wrap: true
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
