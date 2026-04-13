/**
 * usePlanningSheetData — PlanningSheet を本番 Repository から read-only で取得する hook
 *
 * ADR-006 準拠:
 *  - PlanningSheetRepository.getById() で読み取り
 *  - ISP は読まない（支援計画シート画面の責務外）
 *
 * @see src/domain/isp/port.ts — PlanningSheetRepository Port
 * @see src/data/isp/infra/DataProviderPlanningSheetRepository.ts
 */
import { useEffect, useState } from 'react';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UsePlanningSheetDataReturn {
  /** PlanningSheet データ（取得完了時）。未取得・エラー時は null */
  data: SupportPlanningSheet | null;
  /** 取得中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** データを再取得する */
  refetch: () => void;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * PlanningSheet を ID で取得する read-only hook。
 *
 * @param planningSheetId - 取得対象の ID。null/undefined の場合はスキップ。
 * @param repo - PlanningSheetRepository インスタンス。null の場合はスキップ。
 */
export function usePlanningSheetData(
  planningSheetId: string | undefined,
  repo: PlanningSheetRepository | null,
): UsePlanningSheetDataReturn {
  const [data, setData] = useState<SupportPlanningSheet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    // 'new' は新規作成ルート — fetch しない
    if (!planningSheetId || planningSheetId === 'new' || !repo) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    // 新しい ID の取得を開始する前に、以前のデータをクリアして stale 表示を防ぐ
    setData(null);
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await repo.getById(planningSheetId);

        if (cancelled) return;

        if (result) {
          setData(result);
          setError(null);
        } else {
          setData(null);
          setError(`支援計画シートが見つかりません (ID: ${planningSheetId})`);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setData(null);
        console.warn('[usePlanningSheetData] Repository fetch failed:', msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planningSheetId, repo, fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  return { data, isLoading, error, refetch };
}
