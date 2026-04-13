/**
 * useStrategyUsageTrend — 戦略実施のトレンド（前期間比較）を提供する hook
 *
 * today 基準で current / previous window を自動計算し、
 * compareStrategyUsage に渡してトレンドを返す。
 *
 * Phase C-3b Step 2
 *
 * @module features/planning-sheet/hooks/useStrategyUsageTrend
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ABCRecord } from '@/domain/behavior';
import {
  compareStrategyUsage,
  type StrategyUsageTrendResult,
} from '@/domain/isp/aggregateStrategyUsage';
import { getABCRecordsForUser } from '@/features/ibd/core/ibdStore';

// ─────────────────────────────────────────────
// 期間プリセット
// ─────────────────────────────────────────────

/** 選択可能な集計日数 */
export type TrendDays = 7 | 30 | 90;

export const TREND_DAYS_OPTIONS: TrendDays[] = [7, 30, 90];

export const TREND_DAYS_LABELS: Record<TrendDays, string> = {
  7: '7日',
  30: '30日',
  90: '90日',
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface UseStrategyUsageTrendResult {
  /** トレンド集計結果（ロード前は null） */
  result: StrategyUsageTrendResult | null;
  /** 現在の集計日数 */
  days: TrendDays;
  /** 日数を変更する */
  setDays: (days: TrendDays) => void;
  /** ロード中フラグ */
  loading: boolean;
  /** エラー */
  error: Error | null;
  /** 手動リフレッシュ */
  refresh: () => void;
}

// ─────────────────────────────────────────────
// 空結果
// ─────────────────────────────────────────────

const EMPTY_RESULT: StrategyUsageTrendResult = {
  items: [],
  totals: { currentCount: 0, previousCount: 0, delta: 0, trend: 'flat' },
};

// ─────────────────────────────────────────────
// 期間計算ヘルパー
// ─────────────────────────────────────────────

/**
 * today 基準で current / previous の ISO 文字列を算出する。
 *
 * - current: [today - days,  today]
 * - previous: [today - 2*days, today - days]
 */
function computeDateWindows(days: TrendDays, now: Date = new Date()) {
  const currentTo = new Date(now);
  const currentFrom = new Date(now);
  currentFrom.setDate(currentTo.getDate() - days);

  const previousTo = new Date(currentFrom);
  const previousFrom = new Date(currentFrom);
  previousFrom.setDate(previousTo.getDate() - days);

  return {
    currentFrom: currentFrom.toISOString(),
    currentTo: currentTo.toISOString(),
    previousFrom: previousFrom.toISOString(),
    previousTo: previousTo.toISOString(),
    // fetch 用: 全体の最早日（previous の開始）
    fetchFrom: previousFrom.toISOString(),
    fetchTo: currentTo.toISOString(),
  };
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * 指定ユーザーの日常記録から戦略実施トレンドを算出する。
 *
 * @param userId - 対象ユーザー ID（空の場合は何もしない）
 * @param initialDays - 初期の集計日数（デフォルト 30）
 */
export function useStrategyUsageTrend(
  userId: string | undefined,
  initialDays: TrendDays = 30,
): UseStrategyUsageTrendResult {
  const [days, setDays] = useState<TrendDays>(initialDays);
  const [records, setRecords] = useState<ABCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // days が変わると fetch 範囲が変わるので再取得が必要
  const windows = useMemo(() => computeDateWindows(days), [days]);

  const fetchRecords = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const fromMs = new Date(windows.fetchFrom).getTime();
      const toMs = new Date(windows.fetchTo).getTime();
      const result = getABCRecordsForUser(userId)
        .filter((record) => {
          const recordedAtMs = new Date(record.recordedAt).getTime();
          return Number.isFinite(recordedAtMs)
            && recordedAtMs >= fromMs
            && recordedAtMs <= toMs;
        })
        .slice(0, 1000); // 2期間分なので既存より多めに
      setRecords(result);
    } catch (err) {
      console.error('[useStrategyUsageTrend] fetch failed:', err);
      setError(
        err instanceof Error ? err : new Error('トレンドデータの取得に失敗しました'),
      );
    } finally {
      setLoading(false);
    }
  }, [userId, windows.fetchFrom, windows.fetchTo]);

  useEffect(() => {
    if (userId) {
      void fetchRecords();
    }
  }, [fetchRecords, userId]);

  const result = useMemo(() => {
    if (!userId || records.length === 0) return EMPTY_RESULT;

    return compareStrategyUsage(
      records,
      windows.currentFrom,
      windows.currentTo,
      windows.previousFrom,
      windows.previousTo,
    );
  }, [records, userId, windows]);

  return {
    result: userId ? result : null,
    days,
    setDays,
    loading,
    error,
    refresh: fetchRecords,
  };
}
