/**
 * @fileoverview モニタリング集計 React Hook
 * @description
 * MonitoringTab から呼ばれ、指定ユーザーの日次記録を期間指定で集計する。
 * pure function (monitoringDailyAnalytics) をラップし、
 * useMemo で再計算を最小限にする。
 */

import { useMemo } from 'react';

import { getDailyTableRecords } from '@/features/daily/repositories/sharepoint/dailyTableRepository';
import {
  buildMonitoringDailySummary,
  buildMonitoringInsightText,
  type DailyMonitoringSummary,
} from '../domain/monitoringDailyAnalytics';
import type { GoalLike } from '../domain/goalProgressTypes';

const DEFAULT_LOOKBACK_DAYS = 60;

function computeDateRange(lookbackDays: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - lookbackDays);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export interface UseMonitoringDailyAnalyticsResult {
  summary: DailyMonitoringSummary | null;
  insightLines: string[];
  /** 所見全文（改行区切り） */
  insightText: string;
  /** 元データの件数 */
  recordCount: number;
}

/**
 * モニタリング集計 Hook
 * @param userId 対象ユーザーID
 * @param lookbackDays 遡り日数 (default: 60)
 * @param goals ISP 目標（省略時は goalProgress を算出しない）
 * @param goalNames 目標名のマッピング（ISP提案の reason / 所見ドラフトに使用）
 */
export function useMonitoringDailyAnalytics(
  userId: string,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  goals?: GoalLike[],
  goalNames?: Record<string, string>,
): UseMonitoringDailyAnalyticsResult {
  return useMemo(() => {
    if (!userId) {
      return { summary: null, insightLines: [], insightText: '', recordCount: 0 };
    }

    const range = computeDateRange(lookbackDays);
    const records = getDailyTableRecords(userId, range);
    const summary = buildMonitoringDailySummary(records, goals, { goalNames });
    const insightLines = summary ? buildMonitoringInsightText(summary, { goalNames }) : [];
    const insightText = insightLines.join('\n');

    return { summary, insightLines, insightText, recordCount: records.length };
  }, [userId, lookbackDays, goals, goalNames]);
}
