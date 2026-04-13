/**
 * useStrategyUsageCounts — 戦略の実施回数を集計する hook
 *
 * ABCRecord から referencedStrategies を読み取り、
 * StrategyUsageSummary を返す。
 *
 * Phase C-3a: 支援計画シートで戦略ごとの実施カウントを表示するため。
 *
 * @module features/planning-sheet/hooks/useStrategyUsageCounts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ABCRecord } from '@/domain/behavior';
import {
  aggregateStrategyUsage,
  type StrategyUsageSummary,
} from '@/domain/isp/aggregateStrategyUsage';
import { getABCRecordsForUser } from '@/features/ibd/core/ibdStore';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface UseStrategyUsageCountsResult {
  /** 集計結果（ロード前は null） */
  summary: StrategyUsageSummary | null;
  /** ロード中フラグ */
  loading: boolean;
  /** エラー */
  error: Error | null;
  /** 手動リフレッシュ */
  refresh: () => void;
}

interface UseStrategyUsageCountsOptions {
  /** 集計期間（日数）。デフォルト 30 */
  days?: number;
}

// ─────────────────────────────────────────────
// Empty summary（初期 / 非該当用）
// ─────────────────────────────────────────────

const EMPTY_SUMMARY: StrategyUsageSummary = {
  antecedent: new Map(),
  teaching: new Map(),
  consequence: new Map(),
  totalApplications: 0,
  recordsWithStrategies: 0,
};

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * 指定ユーザーの日常記録から戦略実施回数を集計する。
 *
 * @param userId - 対象ユーザー ID（空の場合は何もしない）
 * @param options - 集計オプション
 */
export function useStrategyUsageCounts(
  userId: string | undefined,
  options: UseStrategyUsageCountsOptions = {},
): UseStrategyUsageCountsResult {
  const { days = 30 } = options;
  const [records, setRecords] = useState<ABCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      const result = getABCRecordsForUser(userId)
        .filter((record) => {
          const recordedAtMs = new Date(record.recordedAt).getTime();
          return Number.isFinite(recordedAtMs)
            && recordedAtMs >= startMs
            && recordedAtMs <= endMs;
        })
        .slice(0, 500);
      setRecords(result);
    } catch (err) {
      console.error('[useStrategyUsageCounts] fetch failed:', err);
      setError(err instanceof Error ? err : new Error('戦略実施データの取得に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [userId, days]);

  useEffect(() => {
    if (userId) {
      void fetchRecords();
    }
  }, [fetchRecords, userId]);

  const summary = useMemo(() => {
    if (!userId || records.length === 0) return EMPTY_SUMMARY;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return aggregateStrategyUsage(records, {
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
    });
  }, [records, userId, days]);

  return {
    summary: userId ? summary : null,
    loading,
    error,
    refresh: fetchRecords,
  };
}
