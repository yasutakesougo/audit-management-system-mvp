import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { useUser } from '@/features/users/useUsers';
import { 
  buildDailyProcedureFlowPreview, 
  type DailyProcedureFlowStep 
} from '../domain/buildDailyProcedureFlowPreview';

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
  const canonicalUserId = user?.UserID || userId;

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

  // Merge slots and actual execution records to build daily flow sequence
  const steps = useMemo(() => {
    return buildDailyProcedureFlowPreview(slots, rawRecords);
  }, [slots, rawRecords]);

  return {
    steps,
    isLoading,
    error,
    refresh: fetchDailyRecords,
  };
}

