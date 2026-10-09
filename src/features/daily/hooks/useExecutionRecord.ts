// ---------------------------------------------------------------------------
// useExecutionRecord — B-Layer hook bridging executionStore → A-Layer
//
// Storeへのアクセスを抽象化し、UI側が日付とタイムスタンプを意識せずに済む。
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState, useRef } from 'react';
import { type RecordStatus, makeRecordId, type ExecutionRecord } from '../domain/executionRecordTypes';
import { useExecutionData } from './useExecutionData';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';

const EMPTY_IDS: string[] = [];

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
  const [error, setError] = useState<Error | null>(null);
  const [loadedIdentityKey, setLoadedIdentityKey] = useState<string | null>(null);

  const getRecordRef = useRef(getRecord);
  const upsertRecordRef = useRef(upsertRecord);
  const deleteRecordRef = useRef(deleteRecord);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    getRecordRef.current = getRecord;
    upsertRecordRef.current = upsertRecord;
    deleteRecordRef.current = deleteRecord;
  }, [getRecord, upsertRecord, deleteRecord]);

  const fallbackScheduleKey = (fallbackScheduleItemIds ?? EMPTY_IDS).join('\u0000');
  const fallbackUserKey = (fallbackUserIds ?? EMPTY_IDS).join('\u0000');
  const identityKey = JSON.stringify([date, userId, scheduleItemId, fallbackScheduleKey, fallbackUserKey]);
  const identityGenerationRef = useRef({ key: identityKey, generation: 0 });
  if (identityGenerationRef.current.key !== identityKey) {
    identityGenerationRef.current = {
      key: identityKey,
      generation: identityGenerationRef.current.generation + 1,
    };
  }
  const identityGeneration = identityGenerationRef.current.generation;

  const fetchRecord = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);

    const fallbackUserIdsParsed = fallbackUserKey ? fallbackUserKey.split('\u0000') : EMPTY_IDS;
    const userIds = Array.from(
      new Set([userId, ...fallbackUserIdsParsed].map((value) => String(value ?? '').trim()).filter(Boolean)),
    );

    const fallbackScheduleIdsParsed = fallbackScheduleKey ? fallbackScheduleKey.split('\u0000') : EMPTY_IDS;
    const scheduleItemIds = Array.from(
      new Set(
        [scheduleItemId, ...fallbackScheduleIdsParsed]
          .map((value) => normalizeScheduleItemId(value))
          .filter(Boolean),
      ),
    );

    if (!date || userIds.length === 0 || scheduleItemIds.length === 0) {
      setRecord(undefined);
      setLoadedIdentityKey(identityKey);
      setIsLoading(false);
      return;
    }

    let resolved: ExecutionRecord | undefined;
    let lastError: Error | null = null;

    // Candidate failures must not abort the whole lookup. Kiosk detail builds a
    // fan-out of userId/scheduleItemId aliases; one transient SharePoint miss
    // should not freeze the observation form behind "保存状態未確認".
    for (const candidateUserId of userIds) {
      for (const candidateScheduleItemId of scheduleItemIds) {
        try {
          const candidateRecord = await getRecordRef.current(date, candidateUserId, candidateScheduleItemId);
          if (seq !== requestSeqRef.current) return;
          if (candidateRecord) {
            resolved = candidateRecord;
            lastError = null;
            break;
          }
        } catch (err) {
          if (seq !== requestSeqRef.current) return;
          lastError = err instanceof Error ? err : new Error('Failed to fetch execution record');
        }
      }
      if (resolved) break;
    }

    if (seq === requestSeqRef.current) {
      setRecord(resolved);
      setError(resolved ? null : lastError);
      setLoadedIdentityKey(identityKey);
      setIsLoading(false);
    }
  }, [date, userId, scheduleItemId, fallbackScheduleKey, fallbackUserKey, identityKey]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  const assertMutationIdentityReady = useCallback(() => {
    const currentIdentity = identityGenerationRef.current;
    if (
      currentIdentity.key !== identityKey ||
      currentIdentity.generation !== identityGeneration ||
      loadedIdentityKey !== identityKey ||
      isLoading ||
      error
    ) {
      throw new Error('Execution record identity is not ready for mutation');
    }
  }, [error, identityGeneration, identityKey, isLoading, loadedIdentityKey]);

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
      assertMutationIdentityReady();
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
    [assertMutationIdentityReady, record, resolveMutationTarget],
  );

  const setMemo = useCallback(
    async (memo: string) => {
      assertMutationIdentityReady();
      if (!record) return;
      const next = {
        ...record,
        memo,
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      await upsertRecordRef.current(next, { memoMode: 'overwrite' });
    },
    [assertMutationIdentityReady, record],
  );

  const saveRecord = useCallback(
    async (status: RecordStatus, memo?: string, triggeredBipIds?: string[]) => {
      assertMutationIdentityReady();
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
    [assertMutationIdentityReady, record, resolveMutationTarget],
  );

  const deleteRecordFn = useCallback(async () => {
    assertMutationIdentityReady();
    const target = resolveMutationTarget();
    await deleteRecordRef.current(target.date, target.userId, target.scheduleItemId);
    setRecord(undefined);
  }, [assertMutationIdentityReady, resolveMutationTarget]);

  // Effects run after render. On an identity transition the previous lookup may
  // already be idle; never expose that idle state as completion of the new one.
  // Otherwise kiosk form hydration can initialize with an empty/stale record.
  const isCurrentIdentityLoaded = loadedIdentityKey === identityKey;
  return {
    record: isCurrentIdentityLoaded ? record : undefined,
    setStatus, setMemo, saveRecord, deleteRecord: deleteRecordFn,
    isLoading: isLoading || !isCurrentIdentityLoaded,
    error: isCurrentIdentityLoaded ? error : null,
    refresh: fetchRecord,
  } as const;
}
