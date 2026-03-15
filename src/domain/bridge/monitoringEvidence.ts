/**
 * monitoringEvidence — D→C 逆流の集計ロジック
 *
 * Daily の実行記録（ExecutionRecord）と手順マスタ（ProcedureStep）を突き合わせ、
 * モニタリング・見直し記録に使える集約データを生成する。
 *
 * ── 設計方針 ──
 *
 * 1. 純関数 — UI・Repository に依存しない
 * 2. 期間指定 — from/to で集計範囲を絞る
 * 3. planningSheetId 絞り込み — 特定計画シート由来の手順だけの集計が可能
 * 4. 「実施」の定義 — レコードが存在し status !== 'unrecorded' なら実施とみなす
 *
 * @module domain/bridge/monitoringEvidence
 */

import type { ProcedureStep } from '@/features/daily/domain/ProcedureRepository';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 手順単位の集計 */
export type ProcedureMonitoringSummary = {
  /** scheduleKey (time|activity) */
  procedureId: string;
  /** 手順名 */
  activity: string;
  /** 手順内容 */
  instruction: string;
  /** 時間帯 */
  time: string;
  /** データの由来 */
  source: ProcedureStep['source'];
  /** 予定日数（期間中の営業日 or 全日数） */
  plannedCount: number;
  /** 記録された日数（status !== 'unrecorded'） */
  recordedCount: number;
  /** completed の日数 */
  completedCount: number;
  /** skipped の日数 */
  skippedCount: number;
  /** triggered (行動発生)の日数 */
  triggeredCount: number;
  /** 実施率 (0–1) */
  completionRate: number;
  /** memo 件数（特記事項） */
  noteCount: number;
  /** 直近の記録日 */
  lastRecordedAt: string | null;
  /** 導出元の手順番号 */
  sourceStepOrder?: number;
  /** 導出元の計画シートID */
  planningSheetId?: string;
};

/** 全体の集約 */
export type MonitoringEvidenceSummary = {
  userId: string;
  from: string;
  to: string;
  /** 集計対象日数 */
  totalDays: number;
  /** 手順マスタの件数 */
  totalProcedures: number;
  /** 全体実施率 (0–1) */
  overallCompletionRate: number;
  /** 手順別サマリー */
  procedureSummaries: ProcedureMonitoringSummary[];
  /** 低実施率手順 (completionRate < 0.6) */
  lowExecutionProcedures: ProcedureMonitoringSummary[];
  /** 特記事項が多い手順 (noteCount > 0, 降順 top5) */
  frequentNoteProcedures: ProcedureMonitoringSummary[];
  /** 行動発生が多い手順 (triggeredCount > 0, 降順) */
  frequentTriggeredProcedures: ProcedureMonitoringSummary[];
  /** 未記録集中時間帯 (time) */
  unrecordedTimeSlots: Array<{ time: string; unrecordedRate: number }>;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * 指定期間内の日付一覧を生成する (YYYY-MM-DD)
 */
export function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * ExecutionRecord[] を scheduleItemId ごとにグループ化する。
 */
function groupByScheduleItem(records: ExecutionRecord[]): Map<string, ExecutionRecord[]> {
  const map = new Map<string, ExecutionRecord[]>();
  for (const rec of records) {
    const existing = map.get(rec.scheduleItemId) ?? [];
    existing.push(rec);
    map.set(rec.scheduleItemId, existing);
  }
  return map;
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export interface SummarizeInput {
  /** 対象利用者 */
  userId: string;
  /** 集計開始日 (YYYY-MM-DD) */
  from: string;
  /** 集計終了日 (YYYY-MM-DD) */
  to: string;
  /** 利用者の手順マスタ */
  procedures: ProcedureStep[];
  /** 期間中の全 ExecutionRecord */
  executionRecords: ExecutionRecord[];
  /** planningSheetId で絞り込む場合 */
  filterByPlanningSheetId?: string;
}

/**
 * Daily の実行記録を手順マスタと突き合わせ、モニタリング集約を生成する。
 *
 * @param input - 集計対象データ
 * @returns MonitoringEvidenceSummary
 */
export function summarizeProcedureExecution(
  input: SummarizeInput,
): MonitoringEvidenceSummary {
  const { userId, from, to, executionRecords, filterByPlanningSheetId } = input;

  // 1. 手順フィルタ
  let procedures = input.procedures;
  if (filterByPlanningSheetId) {
    procedures = procedures.filter(
      (p) => p.source === 'planning_sheet' && p.planningSheetId === filterByPlanningSheetId,
    );
  }

  // 2. 期間の日数
  const dateRange = generateDateRange(from, to);
  const totalDays = dateRange.length;

  // 3. ExecutionRecord を scheduleItemId 単位でグルーピング
  const recordMap = groupByScheduleItem(executionRecords);

  // 4. 手順ごとの集計
  const procedureSummaries: ProcedureMonitoringSummary[] = procedures.map((proc) => {
    const scheduleKey = getScheduleKey(proc.time, proc.activity);
    const records = recordMap.get(scheduleKey) ?? [];

    // 期間内のみフィルタ
    const dateSet = new Set(dateRange);
    const periodRecords = records.filter((r) => dateSet.has(r.date));

    // ステータス別カウント
    let completedCount = 0;
    let skippedCount = 0;
    let triggeredCount = 0;
    let noteCount = 0;
    let lastRecordedAt: string | null = null;

    for (const rec of periodRecords) {
      if (rec.status === 'completed') completedCount++;
      if (rec.status === 'skipped') skippedCount++;
      if (rec.status === 'triggered') triggeredCount++;
      if (rec.memo && rec.memo.trim().length > 0) noteCount++;
      if (rec.status !== 'unrecorded') {
        if (!lastRecordedAt || rec.date > lastRecordedAt) {
          lastRecordedAt = rec.date;
        }
      }
    }

    const recordedCount = completedCount + triggeredCount + skippedCount;
    const completionRate = totalDays > 0 ? recordedCount / totalDays : 0;

    return {
      procedureId: scheduleKey,
      activity: proc.activity,
      instruction: proc.instruction,
      time: proc.time,
      source: proc.source,
      plannedCount: totalDays,
      recordedCount,
      completedCount,
      skippedCount,
      triggeredCount,
      completionRate: Math.round(completionRate * 1000) / 1000,
      noteCount,
      lastRecordedAt,
      sourceStepOrder: proc.sourceStepOrder,
      planningSheetId: proc.planningSheetId,
    };
  });

  // 5. 全体実施率
  const totalRecorded = procedureSummaries.reduce((sum, s) => sum + s.recordedCount, 0);
  const totalPlanned = procedureSummaries.reduce((sum, s) => sum + s.plannedCount, 0);
  const overallCompletionRate = totalPlanned > 0
    ? Math.round((totalRecorded / totalPlanned) * 1000) / 1000
    : 0;

  // 6. 低実施率手順 (< 60%)
  const lowExecutionProcedures = procedureSummaries
    .filter((s) => s.completionRate < 0.6)
    .sort((a, b) => a.completionRate - b.completionRate);

  // 7. 特記事項が多い手順 (top 5)
  const frequentNoteProcedures = procedureSummaries
    .filter((s) => s.noteCount > 0)
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 5);

  // 8. 行動発生が多い手順
  const frequentTriggeredProcedures = procedureSummaries
    .filter((s) => s.triggeredCount > 0)
    .sort((a, b) => b.triggeredCount - a.triggeredCount);

  // 9. 未記録集中時間帯
  const timeSlotMap = new Map<string, { total: number; unrecorded: number }>();
  for (const s of procedureSummaries) {
    const existing = timeSlotMap.get(s.time) ?? { total: 0, unrecorded: 0 };
    existing.total += s.plannedCount;
    existing.unrecorded += s.plannedCount - s.recordedCount;
    timeSlotMap.set(s.time, existing);
  }
  const unrecordedTimeSlots = Array.from(timeSlotMap.entries())
    .map(([time, { total, unrecorded }]) => ({
      time,
      unrecordedRate: total > 0 ? Math.round((unrecorded / total) * 1000) / 1000 : 0,
    }))
    .filter((s) => s.unrecordedRate > 0.3)
    .sort((a, b) => b.unrecordedRate - a.unrecordedRate);

  return {
    userId,
    from,
    to,
    totalDays,
    totalProcedures: procedures.length,
    overallCompletionRate,
    procedureSummaries,
    lowExecutionProcedures,
    frequentNoteProcedures,
    frequentTriggeredProcedures,
    unrecordedTimeSlots,
  };
}

// ─────────────────────────────────────────────
// 要約テキスト生成
// ─────────────────────────────────────────────

/**
 * MonitoringEvidenceSummary から見直し記録用の日本語テキストを生成する。
 */
export function generateMonitoringNarrative(
  summary: MonitoringEvidenceSummary,
): string {
  const lines: string[] = [];

  lines.push(`■ モニタリング集計 (${summary.from} 〜 ${summary.to})`);
  lines.push(`対象期間: ${summary.totalDays}日間`);
  lines.push(`対象手順: ${summary.totalProcedures}件`);
  lines.push(`全体実施率: ${Math.round(summary.overallCompletionRate * 100)}%`);
  lines.push('');

  // 低実施率
  if (summary.lowExecutionProcedures.length > 0) {
    lines.push('■ 実施率が低い手順:');
    for (const proc of summary.lowExecutionProcedures) {
      lines.push(
        `  - ${proc.time} ${proc.activity}: ${Math.round(proc.completionRate * 100)}%` +
        ` (${proc.recordedCount}/${proc.plannedCount}日)`,
      );
    }
    lines.push('');
  }

  // 行動発生
  if (summary.frequentTriggeredProcedures.length > 0) {
    lines.push('■ 行動発生が多い手順:');
    for (const proc of summary.frequentTriggeredProcedures) {
      lines.push(
        `  - ${proc.time} ${proc.activity}: ${proc.triggeredCount}回`,
      );
    }
    lines.push('');
  }

  // 特記事項
  if (summary.frequentNoteProcedures.length > 0) {
    lines.push('■ 特記事項が多い手順:');
    for (const proc of summary.frequentNoteProcedures) {
      lines.push(
        `  - ${proc.time} ${proc.activity}: ${proc.noteCount}件`,
      );
    }
    lines.push('');
  }

  // 未記録時間帯
  if (summary.unrecordedTimeSlots.length > 0) {
    lines.push('■ 未記録が集中している時間帯:');
    for (const slot of summary.unrecordedTimeSlots) {
      lines.push(
        `  - ${slot.time}: 未記録率 ${Math.round(slot.unrecordedRate * 100)}%`,
      );
    }
  }

  return lines.join('\n');
}
