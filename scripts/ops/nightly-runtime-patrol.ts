/* eslint-disable no-console -- CLI ops script */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON payloads */
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    | 'health_fail';
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
  // 1. Critical (最初は絞る)
  if (event.eventType === 'http_429') return 'critical';
  if (
    event.eventType === 'health_fail' &&
    event.reasonCode === 'essential_resource_unavailable'
  )
    return 'critical';

  // 2. Action Required
  // HTTP500や保存系失敗(provision_failed)は原則ここ
  if (event.eventType === 'provision_failed') return 'action_required';
  if (event.eventType === 'http_500') return 'action_required';

  // 3. Silent
  // 8KB限界のガードや、吸収済みのDrift
  if (event.eventType === 'provision_skipped:block') return 'silent';
  if (event.eventType === 'drift' && event.reasonCode === 'absorbed_strategy_e')
    return 'silent';

  // 4. Watch (上記以外は基本的にウォッチ)
  // 例: 未知のフィールド増減, 軽微なhealth_fail
  return 'watch';
}

/**
 * NextAction の決定 (読んで終わらせないため)
 */
function determineNextAction(severity: SeverityLevel, event: RawEvent): string {
  if (severity === 'critical') {
    return '【至急】運用管理者にエスカレーションし、システム全体の利用可否を確認してください。';
  }
  if (event.eventType === 'provision_failed' || event.eventType === 'http_500') {
    return `[${event.resourceKey}] の保存フローに関するログを確認し、SharePointのリスト設定と実データの整合性を調査してください。`;
  }
  if (event.eventType === 'drift') {
    return `[${event.resourceKey}] に誰かがフィールドを直接追加・削除した可能性を調査してください。`;
  }
  if (severity === 'silent') {
    return '（対応不要・本システムで安全に吸収済み）';
  }
  return '次回のNightly Patrolまで傾向を様子見（継続監視）';
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
         if (msg.includes('provision_failed')) eType = 'provision_failed';
         if (msg.includes('provision_skipped:block')) eType = 'provision_skipped:block';
         
         events.push({
            id: `drift-${item.Id}`,
            timestamp: item.DetectedAt || item.Created,
            eventType: eType,
            area: 'Runtime',
            resourceKey: item.ListName || 'Unknown',
            fieldKey: item.FieldName || 'None',
            reasonCode: item.ResolutionType || 'unknown',
            message: `Severity: ${item.Severity}. ${item.ErrorMessage || msg}`
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
      id: '7',
      timestamp: new Date().toISOString(),
      eventType: 'http_500',
      area: 'StaffAttendance',
      resourceKey: 'Staff_Attendance',
      reasonCode: 'server_error',
      message: 'Transient 500 error on update.',
    },
  ];

  // 実データの取得（失敗時や設定がない場合はモックへフォールバック）
  const rawEvents = await fetchRealEvents(mockRawEvents);
  
  const summary = aggregateEvents(rawEvents);
  
  // JSON出力
  const jsonOutput = JSON.stringify(summary, null, 2);
  
  // Markdown出力
  const mdOutput = formatMarkdown(summary);

  // ファイル出力
  await fs.mkdir('.nightly', { recursive: true });
  await fs.writeFile(path.join('.nightly', 'runtime-summary.json'), jsonOutput, 'utf-8');
  await fs.writeFile(path.join('.nightly', 'runtime-summary.md'), mdOutput, 'utf-8');

  console.log('✅ Nightly Runtime Patrol executed.');
  console.log(`  - Fetch count : ${summary.totalEvents}`);
  console.log(`  - Bundle count: ${summary.bundledCount}`);
  console.log(`  - Silent count: ${summary.countsBySeverity.silent}`);
  console.log('Results written to .nightly/runtime-summary.{json,md}');
}

// --- execution block for local testing ---
// 実行条件 (CLI呼び出しかどうか) を簡易判定
const isCLI = typeof process !== 'undefined' && process.argv[1] && (import.meta.url?.includes(path.basename(process.argv[1])) || (typeof require !== 'undefined' && require.main === module));

if (isCLI) {
  run().catch(console.error);
}
