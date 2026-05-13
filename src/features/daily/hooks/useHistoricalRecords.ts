import { useState, useEffect, useCallback, useRef } from 'react';
import { useExecutionData } from './useExecutionData';
import type { ExecutionRecord } from '../domain/legacy/executionRecordTypes';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';
import { buildExecutionUserIdCandidates } from '../utils/normalizeExecutionLookup';

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
      const userCandidates = buildExecutionUserIdCandidates(userId, ...fallbackUserIds);

      const primaryId = normalizeScheduleItemId(scheduleItemId);
      const fallbackIds = fallbackScheduleItemIds
        .map((id) => normalizeScheduleItemId(id))
        .filter((id) => Boolean(id) && id !== primaryId);
      const scheduleCandidates = [primaryId, ...fallbackIds];

      const byId = new Map<string, ExecutionRecord>();
      const buildStableKey = (item: ExecutionRecord): string => {
        const explicitId = String(item.id ?? '').trim();
        if (explicitId) return explicitId;
        const date = String(item.date ?? '').trim();
        const uid = String(item.userId ?? '').trim();
        const sid = String(item.scheduleItemId ?? '').trim();
        const recordedAt = String(item.recordedAt ?? '').trim();
        return `${date}::${uid}::${sid}::${recordedAt}`;
      };
      const merge = (items: ExecutionRecord[]) => {
        for (const item of items) {
          const key = buildStableKey(item);
          if (!key || key === '::::') continue;
          const existing = byId.get(key);
          if (!existing) {
            byId.set(key, item);
            continue;
          }
          const existingKey = existing.recordedAt || existing.id;
          const nextKey = item.recordedAt || item.id;
          if (nextKey > existingKey) {
            byId.set(key, item);
          }
        }
      };

      let history: ExecutionRecord[] = [];
      for (const candidateUserId of userCandidates) {
        for (const candidateScheduleId of scheduleCandidates) {
          const result = await getHistoricalRecordsRef.current(candidateUserId, candidateScheduleId, 150);
          merge(result);
        }
      }
      history = Array.from(byId.values())
        .sort((a, b) => (b.recordedAt || b.id).localeCompare(a.recordedAt || a.id))
        .slice(0, 150);

      // Range backfill: pull recent records and merge in-app matches.
      // Do this even when primary has hits, because legacy/migrated rows can be missed by direct query.
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
          .sort((a, b) => (b.recordedAt || b.id).localeCompare(a.recordedAt || a.id));
        if (matched.length > 0) {
          merge(matched);
        }
      }
      history = Array.from(byId.values())
        .sort((a, b) => (b.recordedAt || b.id).localeCompare(a.recordedAt || a.id))
        .slice(0, 150);
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
