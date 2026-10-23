// ---------------------------------------------------------------------------
// useExecutionRecord — B-Layer hook bridging executionStore → A-Layer
//
// Storeへのアクセスを抽象化し、UI側が日付とタイムスタンプを意識せずに済む。
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState, useRef } from 'react';
import { type RecordStatus, makeRecordId, type ExecutionRecord } from '../domain/executionRecordTypes';
import { ExecutionTargetMismatchError } from '../domain/ExecutionRecordRepository';
import type { ExecutionCandidateClassification, ExecutionRecordUpsertOptions } from '../domain/ExecutionRecordRepository';
import { useExecutionData } from './useExecutionData';
import { normalizeScheduleItemId } from '../utils/normalizeScheduleItemId';

const EMPTY_IDS: string[] = [];

export const EXECUTION_POST_SAVE_CHECK_FAILED = 'EXECUTION_POST_SAVE_CHECK_FAILED';

export class ExecutionPostSaveCheckError extends Error {
  readonly code = EXECUTION_POST_SAVE_CHECK_FAILED;

  constructor() {
    super(EXECUTION_POST_SAVE_CHECK_FAILED);
    this.name = 'ExecutionPostSaveCheckError';
  }
}

type OutcomeHoldReason = 'save-unknown' | 'post-save-check' | 'delete-unknown';

type OutcomeHold = {
  reason: OutcomeHoldReason;
  generation: number;
  identityKey: string;
};

const ambiguousExecutionError = (): Error => Object.assign(new Error('AMBIGUOUS_EXECUTION_RECORD'), {
  code: 'AMBIGUOUS_EXECUTION_RECORD',
  name: 'AmbiguousExecutionRecordError',
});

const buildCandidateUserIds = (userId: string, fallbackUserKey: string): string[] => {
  const fallbackUserIdsParsed = fallbackUserKey ? fallbackUserKey.split('\u0000') : EMPTY_IDS;
  return Array.from(
    new Set([userId, ...fallbackUserIdsParsed].map((value) => String(value ?? '').trim()).filter(Boolean)),
  );
};

const buildCandidateScheduleIds = (scheduleItemId: string, fallbackScheduleKey: string): string[] => {
  const fallbackScheduleIdsParsed = fallbackScheduleKey ? fallbackScheduleKey.split('\u0000') : EMPTY_IDS;
  return Array.from(
    new Set(
      [scheduleItemId, ...fallbackScheduleIdsParsed]
        .map((value) => normalizeScheduleItemId(value))
        .filter(Boolean),
    ),
  );
};

export function useExecutionRecord(
  date: string,
  userId: string,
  scheduleItemId: string,
  fallbackScheduleItemIds?: string[],
  fallbackUserIds?: string[],
) {
  const { getRecord, upsertRecord, deleteRecord, getRecordForCandidates, classifyExecutionCandidates } = useExecutionData();
  const [record, setRecord] = useState<ExecutionRecord | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedIdentityKey, setLoadedIdentityKey] = useState<string | null>(null);
  const [outcomeHold, setOutcomeHold] = useState<OutcomeHold | null>(null);

  const getRecordRef = useRef(getRecord);
  const getRecordForCandidatesRef = useRef(getRecordForCandidates);
  const classifyRef = useRef(classifyExecutionCandidates);
  const upsertRecordRef = useRef(upsertRecord);
  const deleteRecordRef = useRef(deleteRecord);
  const outcomeHoldRef = useRef<OutcomeHold | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    getRecordRef.current = getRecord;
    getRecordForCandidatesRef.current = getRecordForCandidates;
    classifyRef.current = classifyExecutionCandidates;
    upsertRecordRef.current = upsertRecord;
    deleteRecordRef.current = deleteRecord;
  }, [classifyExecutionCandidates, getRecord, getRecordForCandidates, upsertRecord, deleteRecord]);

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

    const userIds = buildCandidateUserIds(userId, fallbackUserKey);
    const scheduleItemIds = buildCandidateScheduleIds(scheduleItemId, fallbackScheduleKey);

    if (!date || userIds.length === 0 || scheduleItemIds.length === 0) {
      setRecord(undefined);
      setLoadedIdentityKey(identityKey);
      setIsLoading(false);
      return;
    }

    let resolved: ExecutionRecord | undefined;
    let lastError: Error | null = null;

    const classify = classifyRef.current;
    const batchedLookup = getRecordForCandidatesRef.current;
    if (classify) {
      try {
        const classification = await classify(date, userIds, scheduleItemIds);
        if (seq !== requestSeqRef.current) return;
        if (classification.kind === 'unique') {
          resolved = classification.record;
          lastError = null;
        } else if (classification.kind === 'absent') {
          resolved = undefined;
          lastError = null;
        } else if (classification.kind === 'duplicate') {
          resolved = undefined;
          lastError = ambiguousExecutionError();
        } else {
          resolved = undefined;
          lastError = new ExecutionTargetMismatchError();
        }
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        resolved = undefined;
        lastError = err instanceof Error ? err : new Error('Failed to fetch execution record');
      }
    } else if (batchedLookup) {
      // One shared lookup pages every parent and child row. A failure here is
      // not "no record": save and cancel stay blocked by the identity guard.
      try {
        const candidateRecord = await batchedLookup(date, userIds, scheduleItemIds);
        if (seq !== requestSeqRef.current) return;
        resolved = candidateRecord;
        lastError = null;
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        resolved = undefined;
        lastError = err instanceof Error ? err : new Error('Failed to fetch execution record');
      }
    } else {
      // Local adapters omit the batched lookup. Candidate failures must not
      // abort that loop; one transient miss should not freeze the form.
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
    }

    if (seq !== requestSeqRef.current) return;

    const hold = outcomeHoldRef.current;
    const holdMatches = Boolean(
      hold
      && hold.identityKey === identityKey
      && hold.generation === identityGeneration,
    );
    if (holdMatches && hold) {
      if (lastError) {
        setRecord(undefined);
        setError(lastError);
        setLoadedIdentityKey(identityKey);
        setIsLoading(false);
        return;
      }
      // A classified recheck for this same target is the only path that lifts the hold.
      // delete-unknown clears the row only when the recheck shows it is gone, and never deletes again.
      setRecord(resolved);
      setError(null);
      outcomeHoldRef.current = null;
      setOutcomeHold(null);
      setLoadedIdentityKey(identityKey);
      setIsLoading(false);
      return;
    }

    setRecord(resolved);
    setError(resolved ? null : lastError);
    setLoadedIdentityKey(identityKey);
    setIsLoading(false);
  }, [date, userId, scheduleItemId, fallbackScheduleKey, fallbackUserKey, identityGeneration, identityKey]);

  useEffect(() => {
    void fetchRecord();
  }, [fetchRecord]);

  const holdsCurrentTarget = useCallback((key: string, generation: number) => {
    const hold = outcomeHoldRef.current;
    return Boolean(hold && hold.identityKey === key && hold.generation === generation);
  }, []);

  const rememberUnknownOutcome = useCallback((
    reason: OutcomeHoldReason,
    key: string,
    generation: number,
    err: unknown,
  ) => {
    if (
      identityGenerationRef.current.key !== key
      || identityGenerationRef.current.generation !== generation
    ) {
      return;
    }
    const hold: OutcomeHold = { reason, generation, identityKey: key };
    outcomeHoldRef.current = hold;
    setOutcomeHold(hold);
    setError(err instanceof Error ? err : new Error('Failed to update execution record'));
  }, []);

  const assertMutationIdentityReady = useCallback(() => {
    const currentIdentity = identityGenerationRef.current;
    if (
      currentIdentity.key !== identityKey ||
      currentIdentity.generation !== identityGeneration ||
      loadedIdentityKey !== identityKey ||
      isLoading ||
      error
      || holdsCurrentTarget(identityKey, identityGeneration)
    ) {
      throw new Error('Execution record identity is not ready for mutation');
    }
  }, [error, holdsCurrentTarget, identityGeneration, identityKey, isLoading, loadedIdentityKey]);

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

  const confirmSavedRecord = useCallback(async (
    next: ExecutionRecord,
    keyAtStart: string,
    generationAtStart: number,
  ) => {
    const stillCurrent = () =>
      identityGenerationRef.current.key === keyAtStart
      && identityGenerationRef.current.generation === generationAtStart;
    const classify = classifyRef.current;
    if (!classify) {
      if (!stillCurrent()) throw new Error('Execution record identity is not ready for mutation');
      setRecord(next);
      return;
    }
    if (!stillCurrent()) throw new Error('Execution record identity is not ready for mutation');
    let classification: ExecutionCandidateClassification;
    try {
      classification = await classify(
        date,
        buildCandidateUserIds(userId, fallbackUserKey),
        buildCandidateScheduleIds(scheduleItemId, fallbackScheduleKey),
      );
    } catch {
      if (!stillCurrent()) throw new Error('Execution record identity is not ready for mutation');
      const checkError = new ExecutionPostSaveCheckError();
      rememberUnknownOutcome('post-save-check', keyAtStart, generationAtStart, checkError);
      throw checkError;
    }
    if (!stillCurrent()) throw new Error('Execution record identity is not ready for mutation');
    if (classification.kind !== 'unique') {
      const checkError = new ExecutionPostSaveCheckError();
      rememberUnknownOutcome('post-save-check', keyAtStart, generationAtStart, checkError);
      throw checkError;
    }
    setRecord(next);
    if (holdsCurrentTarget(keyAtStart, generationAtStart)) {
      outcomeHoldRef.current = null;
      setOutcomeHold(null);
    }
  }, [
    date,
    fallbackScheduleKey,
    fallbackUserKey,
    holdsCurrentTarget,
    rememberUnknownOutcome,
    scheduleItemId,
    userId,
  ]);

  const commitUpsert = useCallback(async (
    next: ExecutionRecord,
    options?: ExecutionRecordUpsertOptions,
  ) => {
    assertMutationIdentityReady();
    const keyAtStart = identityKey;
    const generationAtStart = identityGeneration;
    try {
      await upsertRecordRef.current(next, options);
    } catch (err) {
      rememberUnknownOutcome('save-unknown', keyAtStart, generationAtStart, err);
      throw err;
    }
    await confirmSavedRecord(next, keyAtStart, generationAtStart);
  }, [assertMutationIdentityReady, confirmSavedRecord, identityGeneration, identityKey, rememberUnknownOutcome]);

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
      await commitUpsert(next);
    },
    [commitUpsert, record, resolveMutationTarget],
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
      await commitUpsert(next, { memoMode: 'overwrite' });
    },
    [assertMutationIdentityReady, commitUpsert, record],
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
      await commitUpsert(next, { memoMode: 'overwrite' });
    },
    [commitUpsert, record, resolveMutationTarget],
  );

  const deleteRecordFn = useCallback(async () => {
    assertMutationIdentityReady();
    const keyAtStart = identityKey;
    const generationAtStart = identityGeneration;
    const target = resolveMutationTarget();
    try {
      await deleteRecordRef.current(target.date, target.userId, target.scheduleItemId);
    } catch (err) {
      rememberUnknownOutcome('delete-unknown', keyAtStart, generationAtStart, err);
      throw err;
    }
    if (
      identityGenerationRef.current.key !== keyAtStart
      || identityGenerationRef.current.generation !== generationAtStart
    ) {
      throw new Error('Execution record identity is not ready for mutation');
    }
    setRecord(undefined);
    if (holdsCurrentTarget(keyAtStart, generationAtStart)) {
      outcomeHoldRef.current = null;
      setOutcomeHold(null);
    }
  }, [
    assertMutationIdentityReady,
    holdsCurrentTarget,
    identityGeneration,
    identityKey,
    rememberUnknownOutcome,
    resolveMutationTarget,
  ]);

  // Effects run after render. On an identity transition the previous lookup may
  // already be idle; never expose that idle state as completion of the new one.
  // Otherwise kiosk form hydration can initialize with an empty/stale record.
  const isCurrentIdentityLoaded = loadedIdentityKey === identityKey;
  const mutationBlocked = Boolean(
    outcomeHold
    && outcomeHold.identityKey === identityKey
    && outcomeHold.generation === identityGeneration,
  );
  return {
    record: isCurrentIdentityLoaded ? record : undefined,
    setStatus, setMemo, saveRecord, deleteRecord: deleteRecordFn,
    isLoading: isLoading || !isCurrentIdentityLoaded,
    error: isCurrentIdentityLoaded ? error : null,
    mutationBlocked: isCurrentIdentityLoaded && mutationBlocked,
    refresh: fetchRecord,
  } as const;
}
