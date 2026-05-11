/**
 * @fileoverview キオスク記録モニタリング集計（pure function）
 * @description
 * ExecutionRecord[] を入力に、90日モニタリング等の資料作成を補助する統計値を算出する。
 */

import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

export interface KioskProcedureSummary {
  scheduleItemId: string;
  activityName: string;
  totalCount: number;
  completedCount: number;
  triggeredCount: number;
  skippedCount: number;
  memoCount: number;
  representativeMemos: string[];
}

export interface KioskMonitoringSummary {
  userId: string;
  period: { from: string; to: string };
  recordedDays: number;
  totalRecords: number;
  procedures: KioskProcedureSummary[];
}

/**
 * 実施記録を手順単位で集計する
 */
export function aggregateKioskRecords(
  records: ExecutionRecord[],
  options: {
    userId: string;
    from: string;
    to: string;
    procedureNames?: Record<string, string>;
  }
): KioskMonitoringSummary {
  const { userId, from, to, procedureNames = {} } = options;
  
  const procedureMap = new Map<string, KioskProcedureSummary>();
  const recordedDates = new Set<string>();

  for (const record of records) {
    if (record.status === 'unrecorded') continue;
    
    recordedDates.add(record.date);
    
    const sid = record.scheduleItemId;
    let summary = procedureMap.get(sid);
    if (!summary) {
      summary = {
        scheduleItemId: sid,
        activityName: procedureNames[sid] || `手順 ${sid}`,
        totalCount: 0,
        completedCount: 0,
        triggeredCount: 0,
        skippedCount: 0,
        memoCount: 0,
        representativeMemos: [],
      };
      procedureMap.set(sid, summary);
    }

    summary.totalCount++;
    if (record.status === 'completed') summary.completedCount++;
    else if (record.status === 'triggered') summary.triggeredCount++;
    else if (record.status === 'skipped') summary.skippedCount++;

    if (record.memo && record.memo.trim()) {
      summary.memoCount++;
      if (summary.representativeMemos.length < 5) {
        summary.representativeMemos.push(record.memo);
      }
    }
  }

  // 手順IDの末尾数字でソート
  const sortedProcedures = Array.from(procedureMap.values()).sort((a, b) => {
    const na = parseInt(a.scheduleItemId.split('-').pop() || '', 10) || 0;
    const nb = parseInt(b.scheduleItemId.split('-').pop() || '', 10) || 0;
    return na - nb;
  });

  return {
    userId,
    period: { from, to },
    recordedDays: recordedDates.size,
    totalRecords: records.length,
    procedures: sortedProcedures,
  };
}

/**
 * 集計結果から傾向のテキスト（ドラフト）を生成する
 */
export function buildKioskInsightText(summary: KioskMonitoringSummary): string[] {
  const lines: string[] = [];
  
  if (summary.totalRecords === 0) {
    return ['【キオスク記録】対象期間の実施記録はありません。'];
  }

  lines.push(`【キオスク記録統計】期間中 ${summary.recordedDays}日の記録あり（計 ${summary.totalRecords}件）。`);
  
  // 行動発生（triggered）が多い手順を抽出
  const triggeredProcedures = summary.procedures
    .filter(p => p.triggeredCount > 0)
    .sort((a, b) => b.triggeredCount - a.triggeredCount);
    
  if (triggeredProcedures.length > 0) {
    const pText = triggeredProcedures.slice(0, 3).map(p => `${p.activityName}(発生 ${p.triggeredCount}回)`).join('・');
    lines.push(`【行動発生傾向】${pText}などで行動発生が記録されています。`);
  } else {
    lines.push('【行動発生傾向】期間中、キオスク記録上の行動発生はありませんでした。');
  }
  
  // メモが多い手順
  const memoProcedures = summary.procedures
    .filter(p => p.memoCount > 0)
    .sort((a, b) => b.memoCount - a.memoCount);
    
  if (memoProcedures.length > 0) {
     lines.push(`【記録から見える傾向】${memoProcedures[0].activityName}を中心に${memoProcedures.length}の手順でメモが残されています。活動の変化や本人の状態について詳細な確認を推奨します。`);
  }
  
  // スキップが多い手順
  const skippedProcedures = summary.procedures
    .filter(p => p.skippedCount > 0)
    .sort((a, b) => b.skippedCount - a.skippedCount);
    
  if (skippedProcedures.length > 0) {
    const sText = skippedProcedures.slice(0, 3).map(p => `${p.activityName}(スキップ ${p.skippedCount}回)`).join('・');
    lines.push(`【スキップ傾向】${sText}などがスキップされています。手順の妥当性や本人の拒否・状況の変化を検討してください。`);
  }
  
  return lines;
}
