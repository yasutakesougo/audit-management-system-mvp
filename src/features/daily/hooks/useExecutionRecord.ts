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
  fallbackUserIds?: string[],
) {
  const { getRecord, upsertRecord, deleteRecord } = useExecutionData();
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
    const userIds = Array.from(
      new Set([userId, ...(fallbackUserIds ?? [])].map((value) => String(value ?? '').trim()).filter(Boolean)),
    );
    const scheduleItemIds = Array.from(
      new Set(
        [scheduleItemId, ...(fallbackScheduleItemIds ?? [])]
          .map((value) => normalizeScheduleItemId(value))
          .filter(Boolean),
      ),
    );

    if (!date || userIds.length === 0 || scheduleItemIds.length === 0) {
      setRecord(undefined);
      setIsLoading(false);
      return;
    }

    let resolved: ExecutionRecord | undefined;
    for (const candidateUserId of userIds) {
      for (const candidateScheduleItemId of scheduleItemIds) {
        const candidateRecord = await getRecordRef.current(date, candidateUserId, candidateScheduleItemId);
        if (candidateRecord) {
          resolved = candidateRecord;
          break;
        }
      }
      if (resolved) break;
    }

    setRecord(resolved);
    setIsLoading(false);
  }, [date, userId, scheduleItemId, fallbackScheduleItemIds, fallbackUserIds]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  const resolveMutationTarget = useCallback(() => {
    const targetDate = record?.date || date;
    const targetUserId = record?.userId || userId;
    const targetScheduleItemId = record?.scheduleItemId || scheduleItemId;
    return {
      date: targetDate,
      userId: targetUserId,
      scheduleItemId: targetScheduleItemId,
      id: record?.id || makeRecordId(targetDate, targetUserId, targetScheduleItemId),
    };
  }, [date, record, scheduleItemId, userId]);

  const setStatus = useCallback(
    async (status: RecordStatus) => {
      const target = resolveMutationTarget();
      const next: ExecutionRecord = {
        id: target.id,
        date: target.date,
        userId: target.userId,
        scheduleItemId: target.scheduleItemId,
        status,
        memo: record?.memo ?? '',
        triggeredBipIds: record?.triggeredBipIds ?? [],
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next);
    },
    [record, resolveMutationTarget],
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
      await upsertRecordRef.current(next, { memoMode: 'overwrite' });
    },
    [record],
  );

  const saveRecord = useCallback(
    async (status: RecordStatus, memo?: string, triggeredBipIds?: string[]) => {
      const target = resolveMutationTarget();
      const next: ExecutionRecord = {
        id: target.id,
        date: target.date,
        userId: target.userId,
        scheduleItemId: target.scheduleItemId,
        status,
        memo: memo !== undefined ? memo : (record?.memo ?? ''),
        triggeredBipIds: triggeredBipIds !== undefined ? triggeredBipIds : (record?.triggeredBipIds ?? []),
        recordedBy: record?.recordedBy ?? '',
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next, { memoMode: 'overwrite' });
    },
    [record, resolveMutationTarget],
  );

  const deleteRecordFn = useCallback(async () => {
    const target = resolveMutationTarget();
    await deleteRecord(target.date, target.userId, target.scheduleItemId);
    setRecord(undefined);
  }, [deleteRecord, resolveMutationTarget]);

  return { record, setStatus, setMemo, saveRecord, deleteRecord: deleteRecordFn, isLoading, refresh: fetchRecord } as const;
}
