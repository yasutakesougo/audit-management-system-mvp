/**
 * @fileoverview Phase F1: useTagAnalytics — 行動タグ分析の集約フック
 * @description
 * userId と期間指定に基づいて DailyTableRecord を取得し、
 * tagAnalytics の pure 関数群を通してタグ分析結果を提供する。
 *
 * 4状態契約: loading → ready | empty | error
 * DataSourceStatus と同じ思想で設計。
 *
 * @see features/tag-analytics/domain/tagAnalytics.ts
 */
import { useMemo, useState, useEffect } from 'react';

import {
  getDailyTableRecords,
  type DateRange,
} from '@/features/daily/repositories/sharepoint/dailyTableRepository';

import {
  computeTagCounts,
  computeTagTrend,
  computeTagTimeSlots,
  getTopTagsFromCounts,
  type TagCount,
  type TagTrend,
  type TagTimeSlotDistribution,
} from '../domain/tagAnalytics';

import {
  detectTagTrends,
  type TagTrendAlerts,
} from '../domain/tagTrendAlerts';

// ─── 型定義 ──────────────────────────────────────────────

export type TagAnalyticsStatus = 'loading' | 'ready' | 'empty' | 'error';

export type DateRangeInput = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type TagAnalytics = {
  /** 4状態契約 */
  status: TagAnalyticsStatus;
  /** 現在期間のタグ頻度 */
  counts: TagCount;
  /** 前期間との比較（前期間がない場合は空） */
  trend: TagTrend;
  /** 午前/午後別タグ分布 */
  timeSlots: TagTimeSlotDistribution;
  /** トップタグ（ラベル付き、最大5件） */
  topTags: Array<{
    key: string;
    label: string;
    category: string;
    categoryLabel: string;
    count: number;
  }>;
  /** F2: トレンドアラート（spike / drop / new） */
  trendAlerts: TagTrendAlerts;
  /** エラーメッセージ（error 時のみ） */
  error: string | null;
};

// ─── ヘルパー ────────────────────────────────────────────

/**
 * 前期間の DateRange を算出する。
 * 現在期間と同じ日数分だけ過去にずらす。
 */
function computePreviousRange(range: DateRangeInput): DateRange {
  const fromDate = new Date(range.from + 'T00:00:00');
  const toDate = new Date(range.to + 'T00:00:00');
  const durationMs = toDate.getTime() - fromDate.getTime();
  const days = Math.max(1, Math.round(durationMs / 86_400_000) + 1);

  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days + 1);

  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

/**
 * デフォルトの期間: 過去30日
 */
function defaultRange(): DateRangeInput {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * 利用者のタグ分析を提供する集約フック。
 *
 * @param userId 利用者ID（未指定時は empty）
 * @param range 集計期間（未指定時は過去30日）
 */
export function useTagAnalytics(
  userId?: string,
  range?: DateRangeInput,
): TagAnalytics {
  const effectiveRange = useMemo(() => range ?? defaultRange(), [range]);

  const [status, setStatus] = useState<TagAnalyticsStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // メモ化した結果
  const [counts, setCounts] = useState<TagCount>({});
  const [previousCounts, setPreviousCounts] = useState<TagCount>({});
  const [trend, setTrend] = useState<TagTrend>({});
  const [timeSlots, setTimeSlots] = useState<TagTimeSlotDistribution>({ am: {}, pm: {} });

  useEffect(() => {
    if (!userId) {
      setStatus('empty');
      setCounts({});
      setPreviousCounts({});
      setTrend({});
      setTimeSlots({ am: {}, pm: {} });
      setError(null);
      return;
    }

    setStatus('loading');

    try {
      // 現在期間のレコード取得
      const currentRecords = getDailyTableRecords(userId, effectiveRange);

      // 前期間のレコード取得（トレンド計算用）
      const prevRange = computePreviousRange(effectiveRange);
      const previousRecords = getDailyTableRecords(userId, prevRange);

      // 集計
      const currentCounts = computeTagCounts(currentRecords);
      const prevCounts = computeTagCounts(previousRecords);
      const computedTrend = computeTagTrend(currentCounts, prevCounts);
      const computedTimeSlots = computeTagTimeSlots(currentRecords);

      setCounts(currentCounts);
      setPreviousCounts(prevCounts);
      setTrend(computedTrend);
      setTimeSlots(computedTimeSlots);
      setError(null);

      // タグが1つも使われていなければ empty
      const hasAnyTag = Object.values(currentCounts).some((c) => c > 0);
      setStatus(hasAnyTag ? 'ready' : 'empty');
    } catch (err) {
      console.warn('[useTagAnalytics] failed:', err);
      setError(err instanceof Error ? err.message : 'タグ分析の取得に失敗');
      setStatus('error');
    }
  }, [userId, effectiveRange]);

  // トップタグ（ラベル付き）
  const topTags = useMemo(() => getTopTagsFromCounts(counts), [counts]);

  // F2: トレンドアラート検知
  const trendAlerts = useMemo(() => {
    if (status !== 'ready') {
      return { spikes: [], drops: [], newTags: [], all: [], hasAlerts: false, truncatedCount: 0 };
    }
    const fromDate = new Date(effectiveRange.from + 'T00:00:00');
    const toDate = new Date(effectiveRange.to + 'T00:00:00');
    const currentDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1);
    const prevRange = computePreviousRange(effectiveRange);
    const prevFromDate = new Date(prevRange.from + 'T00:00:00');
    const prevToDate = new Date(prevRange.to + 'T00:00:00');
    const baselineDays = Math.max(1, Math.round((prevToDate.getTime() - prevFromDate.getTime()) / 86_400_000) + 1);

    return detectTagTrends({
      currentCounts: counts,
      baselineCounts: previousCounts,
      currentDays,
      baselineDays,
    });
  }, [status, counts, previousCounts, effectiveRange]);

  return {
    status,
    counts,
    trend,
    timeSlots,
    topTags,
    trendAlerts,
    error,
  };
}

// テスト用にエクスポート
export { computePreviousRange as _computePreviousRange };
