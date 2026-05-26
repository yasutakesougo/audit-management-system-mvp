import { useCallback, useEffect, useState, useMemo } from 'react';
import { getToiletRepository } from './toiletRepositoryFactory';
import type { ToiletRecord, ToiletRecordInput } from './types';
import { useSP } from '@/lib/spClient';

export function useToiletRecords(dateIso: string) {
  const [records, setRecords] = useState<ToiletRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { spFetch, getListFieldInternalNames } = useSP();

  const repository = useMemo(() => {
    return getToiletRepository(spFetch, getListFieldInternalNames);
  }, [spFetch, getListFieldInternalNames]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await repository.listByDate(dateIso);
      setRecords(data);
    } catch (error) {
      console.error('[useToiletRecords] Failed to load toilet records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateIso, repository]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (input: ToiletRecordInput) => {
    try {
      const record = await repository.create(input);
      await refresh();
      return record;
    } catch (error) {
      console.error('[useToiletRecords] Failed to create toilet record:', error);
      throw error;
    }
  }, [refresh, repository]);

  return { records, create, refresh, isLoading };
}
