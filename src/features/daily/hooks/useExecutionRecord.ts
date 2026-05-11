// ---------------------------------------------------------------------------
// useExecutionRecord — B-Layer hook bridging executionStore → A-Layer
//
// Storeへのアクセスを抽象化し、UI側が日付とタイムスタンプを意識せずに済む。
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState, useRef } from 'react';
import { type RecordStatus, makeRecordId, type ExecutionRecord } from '../domain/executionRecordTypes';
import { useExecutionData } from './useExecutionData';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';

export function useExecutionRecord(
  date: string,
  userId: string,
  scheduleItemId: string,
  fallbackScheduleItemIds?: string[],
) {
  const { getRecord, upsertRecord } = useExecutionData();
  const [record, setRecord] = useState<ExecutionRecord | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const getRecordRef = useRef(getRecord);
  const upsertRecordRef = useRef(upsertRecord);

  useEffect(() => {
    getRecordRef.current = getRecord;
    upsertRecordRef.current = upsertRecord;
  }, [getRecord, upsertRecord]);

  const fetchRecord = useCallback(async () => {
    setIsLoading(true);
    let resolved = await getRecordRef.current(date, userId, scheduleItemId);

    if (!resolved && fallbackScheduleItemIds && fallbackScheduleItemIds.length > 0) {
      for (const fallbackId of fallbackScheduleItemIds) {
        const normalizedFallbackId = normalizeScheduleItemId(fallbackId);
        if (!normalizedFallbackId || normalizedFallbackId === scheduleItemId) continue;
        const fallbackRecord = await getRecordRef.current(date, userId, normalizedFallbackId);
        if (fallbackRecord) {
          resolved = fallbackRecord;
          break;
        }
      }
    }

    setRecord(resolved);
    setIsLoading(false);
  }, [date, userId, scheduleItemId, fallbackScheduleItemIds]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  const setStatus = useCallback(
    async (status: RecordStatus) => {
      const next: ExecutionRecord = {
        id: makeRecordId(date, userId, scheduleItemId),
        date,
        userId,
        scheduleItemId,
        status,
        memo: record?.memo ?? '',
        triggeredBipIds: record?.triggeredBipIds ?? [],
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next);
    },
    [date, userId, scheduleItemId, record],
  );

  const setMemo = useCallback(
    async (memo: string) => {
      if (!record) return;
      const next = {
        ...record,
        memo,
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next);
    },
    [record],
  );

  const saveRecord = useCallback(
    async (status: RecordStatus, memo?: string, triggeredBipIds?: string[]) => {
      const next: ExecutionRecord = {
        id: makeRecordId(date, userId, scheduleItemId),
        date,
        userId,
        scheduleItemId,
        status,
        memo: memo !== undefined ? memo : (record?.memo ?? ''),
        triggeredBipIds: triggeredBipIds !== undefined ? triggeredBipIds : (record?.triggeredBipIds ?? []),
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next);
    },
    [date, userId, scheduleItemId, record],
  );

  return { record, setStatus, setMemo, saveRecord, isLoading, refresh: fetchRecord } as const;
}

