import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore, type ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { useUser } from '@/features/users/useUsers';
import { 
  buildDailyProcedureFlowPreview, 
  type DailyProcedureFlowStep 
} from '../domain/buildDailyProcedureFlowPreview';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { normalizeExecutionDate } from '@/features/daily/utils/normalizeExecutionLookup';

export interface UseDailyProcedureFlowPreviewResult {
  steps: DailyProcedureFlowStep[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const EMPTY_USER_CANDIDATES: string[] = [];
const EMPTY_STEPS: DailyProcedureFlowStep[] = [];
const EMPTY_RECORDS: ExecutionRecord[] = [];
const EMPTY_SLOTS: ProcedureItem[] = [];
const EMPTY_LOAD_STATE = { identityKey: '', loading: false, error: null as Error | null };

export function useDailyProcedureFlowPreview(
  userId: string,
  recordDate: string,
  seedRecords: ExecutionRecord[] = [],
): UseDailyProcedureFlowPreviewResult {
  const { getRecords } = useExecutionData();
  const getRecordsRef = useRef(getRecords);
  
  useEffect(() => {
    getRecordsRef.current = getRecords;
  }, [getRecords]);

  const { data: user, status: userStatus } = useUser(userId);
  const canonicalUserId = (
    typeof user?.UserID === 'string' && user.UserID.trim().length > 0
  ) ? user.UserID : '';

  const verifiedUserCandidates = useMemo(() => {
    if (!user) return EMPTY_USER_CANDIDATES;
    const candidates: string[] = [];
    if (typeof user.UserID === 'string' && user.UserID.trim().length > 0) {
      candidates.push(user.UserID);
    }
    if (typeof user.Id === 'number' && Number.isSafeInteger(user.Id) && user.Id > 0) {
      candidates.push(String(user.Id));
    }
    return candidates.length > 0 ? candidates : EMPTY_USER_CANDIDATES;
  }, [user?.Id, user?.UserID]);
  const rawRouteUserId = String(userId ?? '');
  const isMasterResolved = Boolean(
    userStatus === 'success'
    && user
    && canonicalUserId
    && rawRouteUserId.trim().length > 0
    && verifiedUserCandidates.includes(rawRouteUserId),
  );
  const identityKey = JSON.stringify([
    normalizeExecutionDate(recordDate),
    rawRouteUserId,
    isMasterResolved ? user?.Id ?? null : null,
    isMasterResolved ? user?.UserID ?? null : null,
    isMasterResolved ? verifiedUserCandidates : [],
  ]);
  const identityKeyRef = useRef(identityKey);
  identityKeyRef.current = identityKey;
  const requestGenerationRef = useRef(0);

  const procedureStore = useProcedureStore();
  
  const [recordSnapshot, setRecordSnapshot] = useState({
    identityKey: '',
    records: EMPTY_RECORDS,
  });
  const [loadState, setLoadState] = useState(EMPTY_LOAD_STATE);
  const rawRecords = recordSnapshot.identityKey === identityKey
    ? recordSnapshot.records
    : EMPTY_RECORDS;

  const fetchDailyRecords = useCallback(async () => {
    if (!isMasterResolved || !canonicalUserId || !recordDate) {
      setRecordSnapshot({ identityKey, records: EMPTY_RECORDS });
      setLoadState({ identityKey, loading: false, error: null });
      return;
    }

    const generation = ++requestGenerationRef.current;
    setLoadState({ identityKey, loading: true, error: null });
    try {
      const records = await getRecordsRef.current(recordDate, canonicalUserId, verifiedUserCandidates);
      if (requestGenerationRef.current !== generation || identityKeyRef.current !== identityKey) return;
      const candidateSet = new Set(verifiedUserCandidates);
      const currentDate = normalizeExecutionDate(recordDate);
      setRecordSnapshot({
        identityKey,
        records: records.filter((record) => (
          candidateSet.has(record.userId)
          && normalizeExecutionDate(record.date) === currentDate
        )),
      });
    } catch (err) {
      if (requestGenerationRef.current !== generation || identityKeyRef.current !== identityKey) return;
      console.error('[useDailyProcedureFlowPreview] Failed to fetch daily records:', err);
      setLoadState({
        identityKey,
        loading: false,
        error: err instanceof Error ? err : new Error('Failed to fetch daily records'),
      });
    } finally {
      if (requestGenerationRef.current === generation && identityKeyRef.current === identityKey) {
        setLoadState((current) => current.identityKey === identityKey
          ? { ...current, loading: false }
          : current);
      }
    }
  }, [canonicalUserId, identityKey, isMasterResolved, recordDate, verifiedUserCandidates]);

  useEffect(() => {
    void fetchDailyRecords();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [fetchDailyRecords]);

  // Load slot configuration from the store (reactive + fallback support)
  const slots = useMemo(() => {
    if (!isMasterResolved || !canonicalUserId) return EMPTY_SLOTS;
    return procedureStore.getByUser(canonicalUserId);
  }, [procedureStore, canonicalUserId, isMasterResolved]);

  // Reactively resolve user candidates and fetch from Zustand store
  const executionUserIdCandidates = isMasterResolved
    ? verifiedUserCandidates
    : EMPTY_USER_CANDIDATES;
  
  const { getRecords: getStoreRecords, hasInitializedRecords } = useExecutionStore();
  const storeRecords = useMemo(() => {
    if (!isMasterResolved || executionUserIdCandidates.length === 0) {
      return EMPTY_RECORDS;
    }
    const deduped = new Map<string, ExecutionRecord>();
    const candidateSet = new Set(executionUserIdCandidates);
    const currentDate = normalizeExecutionDate(recordDate);
    for (const candidateUserId of executionUserIdCandidates) {
      for (const record of getStoreRecords(recordDate || '', candidateUserId)) {
        if (!candidateSet.has(record.userId) || normalizeExecutionDate(record.date) !== currentDate) continue;
        const key = `${record.date}|${record.userId}|${record.scheduleItemId}|${record.id ?? ''}`;
        deduped.set(key, record);
      }
    }
    return Array.from(deduped.values());
  }, [executionUserIdCandidates, getStoreRecords, isMasterResolved, recordDate]);

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
    if (!isMasterResolved) {
      return EMPTY_RECORDS;
    }
    if (hasInitializedStoreRecords) {
      return storeRecords;
    }

    const deduped = new Map<string, ExecutionRecord>();
    const candidateSet = new Set(executionUserIdCandidates);
    const currentDate = normalizeExecutionDate(recordDate);
    const addRecord = (r: ExecutionRecord) => {
      if (!candidateSet.has(r.userId) || normalizeExecutionDate(r.date) !== currentDate) return;
      const key = `${r.date}|${r.userId}|${r.scheduleItemId}`;
      deduped.set(key, r);
    };
    rawRecords.forEach(addRecord);
    seedRecords.forEach(addRecord);
    storeRecords.forEach(addRecord);
    return Array.from(deduped.values());
  }, [hasInitializedStoreRecords, isMasterResolved, rawRecords, recordDate, seedRecords, storeRecords]);

  // Merge slots and actual execution records to build daily flow sequence
  const steps = useMemo(() => {
    if (!isMasterResolved) {
      return EMPTY_STEPS;
    }
    return buildDailyProcedureFlowPreview(slots, mergedRecords);
  }, [isMasterResolved, slots, mergedRecords]);

  const hasCurrentLoadState = loadState.identityKey === identityKey;
  const currentLoadState = hasCurrentLoadState ? loadState : EMPTY_LOAD_STATE;
  const isOverallLoading = currentLoadState.loading || !hasCurrentLoadState || !isMasterResolved;
  const visibleSteps = isOverallLoading || currentLoadState.error ? EMPTY_STEPS : steps;

  return {
    steps: visibleSteps,
    isLoading: isOverallLoading,
    error: currentLoadState.error,
    refresh: fetchDailyRecords,
  };
}
