import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Schedule } from '@/lib/mappers';
import { useScheduleRepository } from '../repositoryFactory';
import { toLocalDateISO } from '@/utils/getNow';
import { useAutoRefreshOnRecovery } from '../../sp/health/useAutoRefreshOnRecovery';

/**
 * useSchedules Hook
 * 
 * Bridges the global schedules store with the feature-level ScheduleRepository.
 * Defaults to fetching "today's" schedules for convenience in legacy views.
 * 
 * Migrated from @/stores/useSchedules.
 */
export function useSchedules() {
  const repository = useScheduleRepository();
  const [data, setData] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = toLocalDateISO();
      const tomorrow = toLocalDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));
      
      const items = await repository.list({
        range: { from: today, to: tomorrow }
      });

      setData(items as unknown as Schedule[]);
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
    () => new Map<number | string, Schedule>(data.map((item) => [String(item.id), item])),
    [data]
  );

  return {
    data,
    loading,
    error,
    reload,
    byId,
    schedules: data,
    isLoading: loading,
    load: reload,
  };
}
