/**
 * useAdoptionMetrics — 提案採用率 metrics を取得する hook
 *
 * Issue #11: Adoption Metrics
 *
 * DailyRecordRepository.list() から直近30日の全アクション（accept + dismiss）
 * を取得し、computeAdoptionMetrics() で集計して返す。
 *
 * useAcceptedSuggestionsForUser とはデータ取得範囲が異なる:
 * - useAcceptedSuggestionsForUser: accept のみ / 特定 userId
 * - useAdoptionMetrics: accept + dismiss / 特定 userId
 *
 * @see src/features/daily/domain/adoptionMetrics.ts — 集計 pure function
 */

import { useState, useEffect, useRef } from 'react';
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';
import {
  computeAdoptionMetrics,
  type AdoptionMetrics,
} from '@/features/daily/domain/adoptionMetrics';
import { computeDateRange, LOOKBACK_DAYS } from './useAcceptedSuggestionsForUser';

// ─── 型定義 ──────────────────────────────────────────────

export type UseAdoptionMetricsReturn = {
  /** 集計結果（データなしの場合 null） */
  metrics: AdoptionMetrics | null;
  /** 取得中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
};

// ─── Hook ────────────────────────────────────────────────

/**
 * 指定ユーザーの提案採用率 metrics を取得する。
 *
 * @param userId - 対象利用者の ID
 * @param improvementIdeas - ISP反映判定用テキスト（省略可）
 */
export function useAdoptionMetrics(
  userId: string,
  improvementIdeas: string = '',
): UseAdoptionMetricsReturn {
  const repository = useDailyRecordRepository();
  const [metrics, setMetrics] = useState<AdoptionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  useEffect(() => {
    if (!userId) {
      setMetrics(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchMetrics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const range = computeDateRange(LOOKBACK_DAYS);

        const records = await repositoryRef.current.list({
          range,
          signal: controller.signal,
        });

        // 対象ユーザーの全アクション（accept + dismiss）を集約
        const allActions = records
          .flatMap(r => r.userRows)
          .filter(row => String(row.userId) === String(userId))
          .flatMap(row => row.acceptedSuggestions ?? []) as SuggestionAction[];

        if (!controller.signal.aborted) {
          const result = computeAdoptionMetrics(allActions, range, improvementIdeas);
          setMetrics(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : '取得に失敗しました');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchMetrics();
    return () => controller.abort();
  }, [userId, improvementIdeas]);

  return { metrics, isLoading, error };
}
