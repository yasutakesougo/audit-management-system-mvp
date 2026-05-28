import { useState, useEffect, useCallback, useRef } from 'react';
import { useExecutionData } from './useExecutionData';
import type { ExecutionRecord } from '../domain/legacy/executionRecordTypes';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';
import { buildExecutionUserIdCandidates } from '../utils/normalizeExecutionLookup';

const EMPTY_IDS: readonly string[] = [];

export function useHistoricalRecords(
  userId: string,
  scheduleItemId: string,
  fallbackScheduleItemIds: readonly string[] = EMPTY_IDS,
  fallbackUserIds: readonly string[] = EMPTY_IDS,
) {
  const { getHistoricalRecords, getRecordsInRange } = useExecutionData();

  // 最新の関数の参照を useRef に格納
  const getHistoricalRecordsRef = useRef(getHistoricalRecords);
  const getRecordsInRangeRef = useRef(getRecordsInRange);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    getHistoricalRecordsRef.current = getHistoricalRecords;
    getRecordsInRangeRef.current = getRecordsInRange;
  }, [getHistoricalRecords, getRecordsInRange]);

  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 配列の参照揺れを防ぐため文字列キー化
  const fallbackScheduleKey = fallbackScheduleItemIds.join('\u0000');
  const fallbackUserKey = fallbackUserIds.join('\u0000');

  const fetchHistory = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;

    if (!userId || !scheduleItemId) {
      setRecords([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fallbackScheduleIds = fallbackScheduleKey
        ? fallbackScheduleKey.split('\u0000')
        : [];

      const fallbackUsers = fallbackUserKey
        ? fallbackUserKey.split('\u0000')
        : [];

      const userCandidates = buildExecutionUserIdCandidates(userId, ...fallbackUsers);

      const primaryId = normalizeScheduleItemId(scheduleItemId);
      const fallbackIds = fallbackScheduleIds
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
      const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
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

      if (requestSeq !== requestSeqRef.current) return;
      setRecords(history);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      console.error('[useHistoricalRecords] Failed to fetch history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch history'));
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, scheduleItemId, fallbackScheduleKey, fallbackUserKey]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { records, isLoading, error, refresh: fetchHistory };
}
