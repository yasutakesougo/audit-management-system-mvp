import { useState, useEffect, useCallback, useRef } from 'react';
import { useExecutionData } from './useExecutionData';
import type { ExecutionRecord } from '../domain/legacy/executionRecordTypes';

export function useHistoricalRecords(userId: string, scheduleItemId: string) {
  const { getHistoricalRecords } = useExecutionData();
  const getHistoricalRecordsRef = useRef(getHistoricalRecords);

  useEffect(() => {
    getHistoricalRecordsRef.current = getHistoricalRecords;
  }, [getHistoricalRecords]);

  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId || !scheduleItemId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const history = await getHistoricalRecordsRef.current(userId, scheduleItemId, 150);
      setRecords(history);
    } catch (err) {
      console.error('[useHistoricalRecords] Failed to fetch history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch history'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, scheduleItemId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { records, isLoading, error, refresh: fetchHistory };
}

