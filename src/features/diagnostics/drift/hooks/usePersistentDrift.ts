import { useMemo, useEffect, useState, useCallback } from 'react';
import { useSP } from '@/lib/spClient';
import { SharePointDriftEventRepository } from '../infra/SharePointDriftEventRepository';
import type { DriftEvent } from '../domain/driftLogic';

export type PersistentDriftItem = DriftEvent & {
  agingDays: number;
};

/**
 * usePersistentDrift — 未解消かつ一定期間経過した「持続的ドリフト」を抽出する
 * 
 * @param thresholdDays アラート対象とする経過日数 (デフォルト 3日)
 */
export function usePersistentDrift(thresholdDays: number = 3) {
  const sp = useSP();
  const [events, setEvents] = useState<DriftEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sp) return;
    setIsLoading(true);
    setError(null);
    try {
      const repo = new SharePointDriftEventRepository(sp);
      const data = await repo.getEvents({ resolved: false });
      setEvents(data);
    } catch (err) {
      console.warn('[usePersistentDrift] Refetch failed:', err);
      setError('データの再取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [sp]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sp) return;
      setIsLoading(true);
      setError(null);
      try {
        const repo = new SharePointDriftEventRepository(sp);
        const data = await repo.getEvents({ resolved: false });
        if (!cancelled) setEvents(data);
      } catch (err) {
        console.warn('[usePersistentDrift] Failed to load drift events:', err);
        if (!cancelled) setError('ドリフト情報の読み込みに失敗しました');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sp]);

  const persistentDrifts = useMemo(() => {
    const now = new Date();
    return events
      .map(event => {
        const detectedAt = new Date(event.detectedAt);
        const diffMs = now.getTime() - detectedAt.getTime();
        const agingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        return {
          ...event,
          agingDays
        };
      })
      .filter(item => item.agingDays >= thresholdDays)
      .sort((a, b) => b.agingDays - a.agingDays);
  }, [events, thresholdDays]);

  return {
    items: persistentDrifts,
    isLoading,
    totalCount: persistentDrifts.length,
    error,
    refetch,
  };
}
