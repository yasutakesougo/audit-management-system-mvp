import type { Staff } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStaffRepository } from './repositoryFactory';
import { useAutoRefreshOnRecovery } from '../sp/health/useAutoRefreshOnRecovery';

/**
 * useStaff Hook
 * 
 * Unified store/hook for staff data. 
 * Automatically switches between Demo and Real (SharePoint) repository.
 * 
 * Migrated from @/stores/useStaff.
 */
export function useStaff() {
  const repository = useStaffRepository();
  const [data, setData] = useState<Staff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await repository.getAll();
      setData(next);
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
    () => new Map<number, Staff>(data.map((item) => [item.id, item])),
    [data]
  );

  const createStaff = useCallback(async (input: Partial<Staff>): Promise<Staff> => {
    try {
      setLoading(true);
      const created = await repository.create(input);
      setData(prev => [...prev, created]);
      return created;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const updateStaff = useCallback(async (id: number | string, input: Partial<Staff>): Promise<Staff> => {
    try {
      setLoading(true);
      const updated = await repository.update(id, input);
      setData(prev => prev.map(item => String(item.id) === String(id) ? updated : item));
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [repository]);

  return {
    data,
    loading,
    error,
    reload,
    byId,
    staff: data,
    isLoading: loading,
    load: reload,
    createStaff,
    updateStaff,
  };
}
