import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { useUser } from '@/features/users/useUsers';
import { resolveProcedureUserQueryCandidates } from '../utils/resolveProcedureUserQuery';
import { 
  buildDailyProcedureFlowPreview, 
  type DailyProcedureFlowStep 
} from '../domain/buildDailyProcedureFlowPreview';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { buildExecutionUserIdCandidates } from '@/features/daily/utils/normalizeExecutionLookup';

export interface UseDailyProcedureFlowPreviewResult {
  steps: DailyProcedureFlowStep[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useDailyProcedureFlowPreview(
  userId: string,
  recordDate: string
): UseDailyProcedureFlowPreviewResult {
  const { getRecords } = useExecutionData();
  const getRecordsRef = useRef(getRecords);
  
  useEffect(() => {
    getRecordsRef.current = getRecords;
  }, [getRecords]);

  const { data: user } = useUser(userId);
  const canonicalUserId = resolveProcedureUserQueryCandidates(user, userId);

  const procedureStore = useProcedureStore();
  
  const [rawRecords, setRawRecords] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDailyRecords = useCallback(async () => {
    if (!canonicalUserId || !recordDate) {
      setRawRecords([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const records = await getRecordsRef.current(recordDate, canonicalUserId);
      setRawRecords(records);
    } catch (err) {
      console.error('[useDailyProcedureFlowPreview] Failed to fetch daily records:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch daily records'));
    } finally {
      setIsLoading(false);
    }
  }, [canonicalUserId, recordDate]);

  useEffect(() => {
    void fetchDailyRecords();
  }, [fetchDailyRecords]);

  // Load slot configuration from the store (reactive + fallback support)
  const slots = useMemo(() => {
    return procedureStore.getByUser(canonicalUserId);
  }, [procedureStore, canonicalUserId]);

  // Reactively resolve user candidates and fetch from Zustand store
  const executionUserIdCandidates = useMemo(
    () => buildExecutionUserIdCandidates(userId),
    [userId]
  );
  
  const { getRecords: getStoreRecords, hasInitializedRecords } = useExecutionStore();
  const storeRecords = useMemo(() => {
    const deduped = new Map<string, ExecutionRecord>();
    for (const candidateUserId of executionUserIdCandidates) {
      for (const record of getStoreRecords(recordDate || '', candidateUserId)) {
        const key = `${record.date}|${record.userId}|${record.scheduleItemId}|${record.id ?? ''}`;
        deduped.set(key, record);
      }
    }
    return Array.from(deduped.values());
  }, [executionUserIdCandidates, getStoreRecords, recordDate]);

  const hasInitializedStoreRecords = useMemo(
    () => executionUserIdCandidates.some((candidateUserId) => (
      hasInitializedRecords(recordDate || '', candidateUserId)
    )),
    [executionUserIdCandidates, hasInitializedRecords, recordDate],
  );

  // Once the local store has initialized a user/date, it is authoritative for
  // reactive changes including deletes. Otherwise stale raw records can revive
  // a preview item immediately after deletion.
  const mergedRecords = useMemo(() => {
    if (hasInitializedStoreRecords) {
      return storeRecords;
    }

    const deduped = new Map<string, ExecutionRecord>();
    const addRecord = (r: ExecutionRecord) => {
      const key = `${r.date}|${r.userId}|${r.scheduleItemId}`;
      deduped.set(key, r);
    };
    rawRecords.forEach(addRecord);
    storeRecords.forEach(addRecord);
    return Array.from(deduped.values());
  }, [hasInitializedStoreRecords, rawRecords, storeRecords]);

  // Merge slots and actual execution records to build daily flow sequence
  const steps = useMemo(() => {
    return buildDailyProcedureFlowPreview(slots, mergedRecords);
  }, [slots, mergedRecords]);

  return {
    steps,
    isLoading,
    error,
    refresh: fetchDailyRecords,
  };
}
