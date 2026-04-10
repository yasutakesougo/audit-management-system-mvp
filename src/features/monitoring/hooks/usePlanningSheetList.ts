import { useState, useCallback, useEffect, useRef } from 'react';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import type { PlanningSheetListItem } from '@/domain/isp/schema';

export function usePlanningSheetList(userId: string) {
  const [records, setRecords] = useState<PlanningSheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const repo = usePlanningSheetRepositories();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const items = await repo.listCurrentByUser(userId);
      if (mountedRef.current) {
        setRecords(items);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, isLoading, error, refresh };
}
