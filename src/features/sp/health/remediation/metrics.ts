/**
 * Remediation Metrics — 監査ログから運用 KPI を算出するロジック
 */

import type { RemediationAuditEntry } from './audit';

export interface RemediationKPIs {
  /** 総計画数（有効なユニークな CorrelationId 数） */
  totalPlanned: number;
  /** 総実行数 */
  totalExecuted: number;
  /** 成功数 */
  totalSuccess: number;
  /** 失敗数 */
  totalFailed: number;
  /** スキップ数 */
  totalSkipped: number;
  /** ポリシーによりスキップされた数 */
  skippedByPolicy: number;
  /** クォータによりスキップされた数 */
  skippedByQuota: number;
  /** 成功率 (0-1) */
  successRate: number;
  /** 実行率 (0-1) — 計画されたもののうち何割が実行されたか */
  executionRate: number;
  /** 平均修復時間 (ms) — planned から executed:success までの時間 */
  meanTimeToRemediateMs: number | null;
  /** 現在のバックログ（計画済みだが未実行かつスキップもされていない数） */
  backlogCount: number;
}

/**
 * 監査ログのエントリ配列から運用 KPI を算出する
 * 
 * 【設計仕様】
 * - 指標はすべて Task (correlationId) ベースのライフサイクルで集計されます（ログ件数ベースではありません）。
 * - 妥当な correlationId を持たない「孤立ログ」は、信頼性担保のため集計対象から除外されます。
 * - 重複した計画/実行ログがある場合、タイムスタンプに基づき適切なライフサイクルエントリが選択されます。
 * - MTTR は planned と executed:success のペアが揃っており、かつ日付が妥当な場合のみ算出されます。
 */
export function calculateRemediationMetrics(entries: RemediationAuditEntry[]): RemediationKPIs {
  const lifecycles = new Map<
    string,
    {
      planned?: RemediationAuditEntry;
      executed?: RemediationAuditEntry;
      skipped?: RemediationAuditEntry;
    }
  >();

  // 1. 全エントリを CorrelationId ごとにグルーピングしてライフサイクルを構築
  for (const entry of entries) {
    if (!entry.correlationId) continue;
    
    const existing = lifecycles.get(entry.correlationId) ?? {};
    if (entry.phase === 'planned') {
      // 最初に見つかった計画を優先（タイムスタンプが古い方）
      if (!existing.planned || entry.timestamp < existing.planned.timestamp) {
        existing.planned = entry;
      }
    } else if (entry.phase === 'executed') {
      // 最新の実行記録を優先
      if (!existing.executed || entry.timestamp > existing.executed.timestamp) {
        existing.executed = entry;
      }
    } else if (entry.phase === 'skipped') {
      existing.skipped = entry;
    }
    lifecycles.set(entry.correlationId, existing);
  }

  // 2. ユニークなライフサイクルベースで KPI を算出（ログ件数ではなく「タスク数」）
  const kpis: RemediationKPIs = {
    totalPlanned: lifecycles.size,
    totalExecuted: 0,
    totalSuccess: 0,
    totalFailed: 0,
    totalSkipped: 0,
    skippedByPolicy: 0,
    skippedByQuota: 0,
    successRate: 0,
    executionRate: 0,
    meanTimeToRemediateMs: null,
    backlogCount: 0,
  };

  let totalDurationMs = 0;
  let durationCount = 0;

  for (const { planned, executed, skipped } of lifecycles.values()) {
    if (executed) {
      kpis.totalExecuted++;
      if (executed.executionStatus === 'success') {
        kpis.totalSuccess++;
        // MTTR 計算
        if (planned) {
          const start = new Date(planned.timestamp).getTime();
          const end = new Date(executed.timestamp).getTime();
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            totalDurationMs += end - start;
            durationCount++;
          }
        }
      } else {
        kpis.totalFailed++;
      }
    }

    if (skipped) {
      kpis.totalSkipped++;
      // 大文字小文字や揺らぎを許容した判定
      const reason = skipped.reason?.toLowerCase() ?? '';
      if (reason.includes('policy')) kpis.skippedByPolicy++;
      if (reason.includes('quota')) kpis.skippedByQuota++;
    }

    // バックログ判定: 計画されているが、最終的に「完了」も「スキップ」もされていないもの
    if (planned && !executed && !skipped) {
      kpis.backlogCount++;
    }
  }

  // 3. 最終計算
  return {
    ...kpis,
    successRate: kpis.totalExecuted > 0 ? kpis.totalSuccess / kpis.totalExecuted : 1,
    executionRate: kpis.totalPlanned > 0 ? kpis.totalExecuted / kpis.totalPlanned : 0,
    meanTimeToRemediateMs: durationCount > 0 ? totalDurationMs / durationCount : null,
  };
}

/**
 * ミリ秒を人間が読みやすい形式（分/時間）に変換する
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return 'n/a';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

