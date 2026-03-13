/**
 * useCurrentPlanningSheet — 利用者の現行支援計画シートを取得する hook
 *
 * ISP 画面から PlanningSheet 画面への動的遷移に使用。
 * listCurrentByUser() で isCurrent: true のシートを取得し、
 * 最新のものを「現行シート」として返す。
 *
 * @see src/domain/isp/port.ts — PlanningSheetRepository.listCurrentByUser
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';

export interface UseCurrentPlanningSheetReturn {
  /** 現行シート（最新の isCurrent:true） */
  currentSheet: PlanningSheetListItem | null;
  /** isCurrent:true のシート一覧（複数シート対応） */
  allCurrentSheets: PlanningSheetListItem[];
  /** 読み込み中 */
  isLoading: boolean;
  /** エラー */
  error: string | null;
}

export function useCurrentPlanningSheet(
  userId: string | null,
  repo: PlanningSheetRepository | null,
): UseCurrentPlanningSheetReturn {
  const [currentSheet, setCurrentSheet] = useState<PlanningSheetListItem | null>(null);
  const [allCurrentSheets, setAllCurrentSheets] = useState<PlanningSheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 前回の userId を追跡（同じ userId で二重フェッチを防ぐ）
  const prevUserIdRef = useRef<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    if (!userId || !repo) {
      setCurrentSheet(null);
      setAllCurrentSheets([]);
      return;
    }

    // 同じ userId なら再フェッチしない
    if (prevUserIdRef.current === userId) return;
    prevUserIdRef.current = userId;

    setIsLoading(true);
    setError(null);

    try {
      const sheets = await repo.listCurrentByUser(userId);
      setAllCurrentSheets(sheets);
      // 最新のものを現行シートとする
      setCurrentSheet(sheets[0] ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.warn('[useCurrentPlanningSheet] Fetch failed:', msg);
    } finally {
      setIsLoading(false);
    }
  }, [userId, repo]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  return { currentSheet, allCurrentSheets, isLoading, error };
}
