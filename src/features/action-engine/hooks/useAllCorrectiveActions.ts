// ---------------------------------------------------------------------------
// useAllCorrectiveActions — 全利用者分の是正提案を一括生成する hook
//
// ExceptionCenterPage が self-contained に動作するための最後の結線。
// AnalysisDashboard (1 ユーザー) ベースの useActionSuggestions と異なり、
// 全アクティブ利用者の行動データを一括フェッチし buildCorrectiveActions を回す。
//
// 設計意図:
// - ExceptionCenterPage の props 注入依存を解消する
// - useExceptionDataSources と同じ非同期パターンを踏襲
// - 将来的にバッチ結果キャッシュへの移行が可能
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUsers } from '@/features/users/useUsers';
import { getBehaviorRepository } from '@/features/daily/infra/behaviorRepositoryFactory';
import type { ABCRecord } from '@/domain/behavior';
import type { ActionSuggestion, CorrectiveActionInput, TrendSummary, HeatmapPeak } from '../domain/types';
import { buildCorrectiveActions } from '../domain/buildCorrectiveActions';
import {
  extractHighIntensityEvents,
  getLastRecordDate,
} from './useActionSuggestions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllCorrectiveActionsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseAllCorrectiveActionsReturn {
  /** 全利用者分の是正提案（フラット配列） */
  suggestions: ActionSuggestion[];
  /** ステータス（idle → loading → ready / error） */
  status: AllCorrectiveActionsStatus;
  /** エラーメッセージ */
  error: string | null;
  /** suggestions の件数 */
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANALYSIS_DAYS = 30;

/**
 * 行動観察データから CorrectiveActionInput を組み立てる。
 *
 * useActionSuggestions の内部ロジックと同等だが、
 * execution / heatmap は簡略化している（ExceptionCenter 向けは概要で十分）。
 */
function buildInputFromRecords(
  userId: string,
  records: ABCRecord[],
): CorrectiveActionInput {
  // 日別集計からトレンドサマリーを構築
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    const day = r.recordedAt.split('T')[0] ?? '';
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const dailyCounts = Array.from(dailyMap.values()).sort();

  const midpoint = Math.floor(dailyCounts.length / 2);
  const recentHalf = dailyCounts.slice(midpoint);
  const olderHalf = dailyCounts.slice(0, midpoint);
  const recentAvg = recentHalf.length > 0
    ? recentHalf.reduce((sum, c) => sum + c, 0) / recentHalf.length
    : 0;
  const previousAvg = olderHalf.length > 0
    ? olderHalf.reduce((sum, c) => sum + c, 0) / olderHalf.length
    : 0;
  const changeRate = previousAvg > 0 ? recentAvg / previousAvg : 1;

  const trend: TrendSummary = {
    recentAvg: Number(recentAvg.toFixed(2)),
    previousAvg: Number(previousAvg.toFixed(2)),
    changeRate: Number(changeRate.toFixed(2)),
  };

  // ヒートマップピーク情報を構築
  const hourCounts = new Array<number>(24).fill(0);
  for (const r of records) {
    const hour = new Date(r.recordedAt).getHours();
    hourCounts[hour]! += 1;
  }
  const totalEvents = hourCounts.reduce((sum, c) => sum + c, 0);
  let peakHour = 0;
  let peakCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h]! > peakCount) {
      peakHour = h;
      peakCount = hourCounts[h]!;
    }
  }
  const heatmapPeak: HeatmapPeak = {
    hour: peakHour,
    count: peakCount,
    totalEvents,
    concentration: totalEvents > 0 ? Number((peakCount / totalEvents).toFixed(2)) : 0,
  };

  return {
    targetUserId: userId,
    trend,
    execution: {
      completed: 0,
      triggered: 0,
      skipped: 0,
      total: 0,
      completionRate: 0,
    },
    highIntensityEvents: extractHighIntensityEvents(records),
    heatmapPeak,
    activeBipCount: 0, // ExceptionCenter バッチでは BIP 情報を簡略化
    totalIncidents: records.length,
    lastRecordDate: getLastRecordDate(records),
    analysisDays: ANALYSIS_DAYS,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 全アクティブ利用者の行動データを取得し、是正提案を一括生成する。
 *
 * @returns 全利用者分の是正提案フラット配列と loading/error 状態
 */
export function useAllCorrectiveActions(): UseAllCorrectiveActionsReturn {
  const { data: users } = useUsers();
  const [allSuggestions, setAllSuggestions] = useState<ActionSuggestion[]>([]);
  const [status, setStatus] = useState<AllCorrectiveActionsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const activeUserIds = useMemo(() => {
    return (users ?? [])
      .filter((u) => u.IsActive !== false)
      .map((u) => u.UserID ?? String(u.Id))
      .filter(Boolean);
  }, [users]);

  const fetchAll = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) {
      setAllSuggestions([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError(null);

    const repo = getBehaviorRepository();
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - ANALYSIS_DAYS);

    const results: ActionSuggestion[] = [];

    try {
      // 全ユーザーを並列で取得（Promise.allSettled で 1 件失敗しても止めない）
      const settled = await Promise.allSettled(
        userIds.map(async (userId) => {
          const records = await repo.listByUser(userId, {
            dateRange: {
              from: startDate.toISOString(),
              to: now.toISOString(),
            },
            order: 'asc',
            limit: 500,
          });
          return { userId, records };
        }),
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          const { userId, records } = result.value;
          if (records.length > 0) {
            const input = buildInputFromRecords(userId, records);
            const suggestions = buildCorrectiveActions(input, now);
            results.push(...suggestions);
          }
        }
        // rejected は warn して skip
        if (result.status === 'rejected') {
          console.warn(
            '[useAllCorrectiveActions] Failed to fetch for a user:',
            result.reason,
          );
        }
      }

      setAllSuggestions(results);
      setStatus('ready');
    } catch (err) {
      console.error('[useAllCorrectiveActions] Batch fetch failed:', err);
      setError(err instanceof Error ? err.message : '是正提案の生成に失敗しました');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (activeUserIds.length > 0) {
      fetchAll(activeUserIds);
    } else if (users !== undefined) {
      // users が取得済みだがアクティブユーザーがいない場合
      setAllSuggestions([]);
      setStatus('ready');
    }
    // users が undefined (まだ取得中) の場合は idle のまま待機
  }, [activeUserIds, fetchAll, users]);

  return {
    suggestions: allSuggestions,
    status,
    error,
    count: allSuggestions.length,
  };
}
