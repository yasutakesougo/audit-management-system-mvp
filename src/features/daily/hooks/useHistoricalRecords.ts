import { useState, useEffect, useCallback, useRef } from 'react';
import { useExecutionData } from './useExecutionData';
import type { ExecutionRecord } from '../domain/legacy/executionRecordTypes';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';
import { normalizeExecutionUserId } from '../utils/normalizeExecutionLookup';

export function useHistoricalRecords(
  userId: string,
  scheduleItemId: string,
  fallbackScheduleItemIds: string[] = [],
  fallbackUserIds: string[] = [],
) {
  const { getHistoricalRecords, getRecordsInRange } = useExecutionData();
  const getHistoricalRecordsRef = useRef(getHistoricalRecords);
  const getRecordsInRangeRef = useRef(getRecordsInRange);

  useEffect(() => {
    getHistoricalRecordsRef.current = getHistoricalRecords;
    getRecordsInRangeRef.current = getRecordsInRange;
  }, [getHistoricalRecords, getRecordsInRange]);

  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId || !scheduleItemId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const primaryUserId = normalizeExecutionUserId(userId);
      const normalizedFallbackUserIds = fallbackUserIds
        .map((id) => normalizeExecutionUserId(id))
        .filter((id) => Boolean(id) && id !== primaryUserId);
      const userCandidates = [primaryUserId, ...normalizedFallbackUserIds];

      const primaryId = normalizeScheduleItemId(scheduleItemId);
      const fallbackIds = fallbackScheduleItemIds
        .map((id) => normalizeScheduleItemId(id))
        .filter((id) => Boolean(id) && id !== primaryId);
      const scheduleCandidates = [primaryId, ...fallbackIds];

      let history: ExecutionRecord[] = [];
      for (const candidateUserId of userCandidates) {
        for (const candidateScheduleId of scheduleCandidates) {
          history = await getHistoricalRecordsRef.current(candidateUserId, candidateScheduleId, 150);
          if (history.length > 0) break;
        }
        if (history.length > 0) break;
      }

      // Second fallback: pull recent range and filter in-app.
      if (history.length === 0) {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 95);
        const toStr = to.toISOString().slice(0, 10);
        const fromStr = from.toISOString().slice(0, 10);
        const scheduleSet = new Set(scheduleCandidates.map((id) => normalizeScheduleItemId(id)));

        const isScheduleMatch = (value: unknown): boolean => {
          const normalized = normalizeScheduleItemId(value);
          if (!normalized) return false;
          if (scheduleSet.has(normalized)) return true;
          const trailing = normalized.match(/\d+$/)?.[0];
          return Boolean(trailing && scheduleSet.has(trailing));
        };

        for (const candidateUserId of userCandidates) {
          const rangeRecords = await getRecordsInRangeRef.current(candidateUserId, fromStr, toStr);
          const matched = rangeRecords
            .filter((record) => isScheduleMatch(record.scheduleItemId))
            .sort((a, b) => (b.recordedAt || b.id).localeCompare(a.recordedAt || a.id))
            .slice(0, 150);
          if (matched.length > 0) {
            history = matched;
            break;
          }
        }
      }
      setRecords(history);
    } catch (err) {
      console.error('[useHistoricalRecords] Failed to fetch history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch history'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, scheduleItemId, fallbackScheduleItemIds, fallbackUserIds]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { records, isLoading, error, refresh: fetchHistory };
}
