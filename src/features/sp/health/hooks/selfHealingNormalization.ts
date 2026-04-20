import { DiagnosticsReportItem } from '@/sharepoint/diagnosticsReports';
import { SelfHealingResult, NightlyEvent } from './useSelfHealingResults';

export interface SelfHealingHistoryEntry {
  runId: string;
  timestamp: string;
  events: SelfHealingResult[];
}

export interface SelfHealingAggregate {
  resourceKey: string;
  fieldKey?: string;
  successCount: number;
  skipCount: number;
  failCount: number;
  lastOutcome: SelfHealingResult['outcome'];
  repeatedSuccessCount: number; // 同じ対象が何度も再修復されている
  repeatedSkipCount: number;    // guard skip が定着している
  isFlappingCandidate: boolean; // anomaly の前段
}

/**
 * DiagnosticsReportItem から SelfHealingHistoryEntry へ変換する
 */
export function normalizeReportToHistoryEntry(report: DiagnosticsReportItem): SelfHealingHistoryEntry {
  const events: SelfHealingResult[] = [];
  
  if (report.SummaryText) {
    try {
      const summary = JSON.parse(report.SummaryText) as { events?: NightlyEvent[] };
      const remediationEvents = (summary.events || [])
        .filter((e) => e.eventType === 'remediation')
        .map((e) => {
          let outcome: SelfHealingResult['outcome'] = 'unknown';
          const msg = (e.sampleMessage || '').toLowerCase();
          if (msg.includes('成功') || msg.includes('success')) {
            outcome = 'added';
          } else if (msg.includes('失敗') || msg.includes('fail')) {
            outcome = 'failed';
          } else if (msg.includes('上限') || msg.includes('limit')) {
            outcome = 'skipped_limit';
          }

          return {
            resourceKey: e.resourceKey,
            fieldKey: e.fieldKey,
            outcome,
            message: e.sampleMessage,
            occurredAt: e.lastSeen || report.Modified || report.Created,
          };
        });
      events.push(...remediationEvents);
    } catch (e) {
      console.warn('[normalizeReportToHistoryEntry] Failed to parse SummaryText', e);
    }
  }

  return {
    runId: String(report.Id || report.Modified),
    timestamp: report.Modified || report.Created,
    events,
  };
}

/**
 * 履歴データからリソース単位の集計を行う
 */
export function aggregateHistory(history: SelfHealingHistoryEntry[]): SelfHealingAggregate[] {
  const map = new Map<string, SelfHealingAggregate>();

  // 降順（最新が先）でループ
  history.forEach((entry, runIdx) => {
    entry.events.forEach((event) => {
      const key = `${event.resourceKey}|${event.fieldKey || ''}`;
      const existing = map.get(key) || {
        resourceKey: event.resourceKey,
        fieldKey: event.fieldKey,
        successCount: 0,
        skipCount: 0,
        failCount: 0,
        lastOutcome: 'unknown',
        repeatedSuccessCount: 0,
        repeatedSkipCount: 0,
        isFlappingCandidate: false,
      };

      if (runIdx === 0) {
        existing.lastOutcome = event.outcome;
      }

      if (event.outcome === 'added') existing.successCount++;
      if (event.outcome === 'skipped_limit') existing.skipCount++;
      if (event.outcome === 'failed') existing.failCount++;

      // 直近 5 回（もしあれば）の連続性をチェック
      // 簡単のため、全履歴中での success/skip 回数をカウント
      if (event.outcome === 'added') existing.repeatedSuccessCount++;
      if (event.outcome === 'skipped_limit') existing.repeatedSkipCount++;

      map.set(key, existing);
    });
  });

  // Anomaly 判定ロジック
  const aggregates = Array.from(map.values()).map((agg) => {
    // 同じリソースが複数回（例: 3回以上）成功している、またはスキップされている場合は候補
    const isFlappingCandidate = 
      (agg.repeatedSuccessCount >= 3 && agg.lastOutcome === 'added') ||
      (agg.repeatedSkipCount >= 3 && agg.lastOutcome === 'skipped_limit');
    
    return { ...agg, isFlappingCandidate };
  });

  return aggregates;
}
