import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDailyRecordRepository } from '../repositoryFactory';
import { toLocalDateISO } from '@/utils/getNow';
import { useAutoRefreshOnRecovery } from '../../sp/health/useAutoRefreshOnRecovery';
import type { DailyRecordItem } from '../domain/DailyRecordRepository';

/**
 * useDaily Hook
 * 
 * Bridges the global daily records store with the feature-level DailyRecordRepository.
 * Defaults to fetching "today's" records for convenience in legacy views.
 * 
 * Migrated from @/stores/useDaily.
 */
export function useDaily() {
  const repository = useDailyRecordRepository();
  const [data, setData] = useState<DailyRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = toLocalDateISO();
      const records = await repository.list({
        range: { startDate: today, endDate: today }
      });

      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useAutoRefreshOnRecovery(reload);

  const byId = useMemo(
    () => new Map<number | string, DailyRecordItem>(data.map((item) => [String(item.id), item])),
    [data]
  );

  return {
    data,
    loading,
    error,
    reload,
    byId,
    records: data,
    isLoading: loading,
    load: reload,
  };
}
