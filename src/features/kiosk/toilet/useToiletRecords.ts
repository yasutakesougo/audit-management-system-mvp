import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { getToiletRepository } from './toiletRepositoryFactory';
import type { ToiletRecord, ToiletRecordCorrectionPatch, ToiletRecordInput } from './types';
import { useSP } from '@/lib/spClient';
import type { SpFetchFn } from '@/lib/sp/spLists';

export function useToiletRecords(dateIso: string) {
  const [records, setRecords] = useState<ToiletRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { spFetch, getListFieldInternalNames } = useSP();

  const spFetchRef = useRef(spFetch);
  const getListFieldInternalNamesRef = useRef(getListFieldInternalNames);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    spFetchRef.current = spFetch;
    getListFieldInternalNamesRef.current = getListFieldInternalNames;
  }, [spFetch, getListFieldInternalNames]);

  const repository = useMemo(() => {
    const stableSpFetch: SpFetchFn = (path, init) => spFetchRef.current(path, init);
    const stableGetListFieldInternalNames = (listTitle: string) => {
      if (getListFieldInternalNamesRef.current) {
        return getListFieldInternalNamesRef.current(listTitle);
      }
      return Promise.resolve(new Set<string>());
    };
    return getToiletRepository(stableSpFetch, stableGetListFieldInternalNames);
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (!dateIso) {
        if (seq === requestSeqRef.current) {
          setRecords([]);
          setIsLoading(false);
        }
        return;
      }
      const data = await repository.listByDate(dateIso);
      if (seq === requestSeqRef.current) {
        setRecords(data);
        setIsLoading(false);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to load toilet records'));
        setIsLoading(false);
      }
    }
  }, [dateIso, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (input: ToiletRecordInput) => {
    try {
      const record = await repository.create(input);
      await refresh();
      return record;
    } catch (err) {
      console.error('[useToiletRecords] Failed to create toilet record:', err);
      throw err;
    }
  }, [refresh, repository]);

  const correct = useCallback(async (recordId: string, patch: ToiletRecordCorrectionPatch) => {
    try {
      setError(null);
      const record = await repository.update(recordId, patch);
      await refresh();
      return record;
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to correct toilet record');
      setError(nextError);
      console.error('[useToiletRecords] Failed to correct toilet record:', err);
      throw nextError;
    }
  }, [refresh, repository]);

  return { records, create, correct, refresh, isLoading, error };
}
