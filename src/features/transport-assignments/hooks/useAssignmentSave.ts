import { useCallback, useEffect, useRef, useState } from 'react';
import { AssignmentRepository, TransportAssignment } from '@/features/schedules/domain/assignment';
import {
  ASSIGNMENT_SAVE_CONTRACT_VERSION,
  ASSIGNMENT_WRITE_LOCK_NAME,
  assignmentRecoveryEligibility,
  assignmentSaveTargetsFrom,
  isAssignmentLedgerClosed,
  isAssignmentSaveBlocked,
  nextUnresolvedAssignmentSave,
  provenRecoveryRequestIds,
  readAssignmentLedger,
  readAssignmentSaveReport,
  removeUnresolvedAssignmentSaves,
  replaceUnresolvedAssignmentSave,
  sealAssignmentFields,
  type AssignmentFieldSnapshot,
  type AssignmentLedgerState,
  type AssignmentRecoveryMerge,
  type AssignmentSavePhase,
  type AssignmentSaveRequestTarget,
  type UnresolvedAssignmentSave,
} from '@/features/schedules';
import { TransportAssignmentDraft } from '../domain/transportAssignmentDraft';
import { listTransportAssignmentsForSave, orchestrateAssignmentSave } from '../application/transportAssignmentApplication';
import type { TransportAssignmentSaveStatus } from './useTransportAssignmentSave';

export type AssignmentSaveStatus = TransportAssignmentSaveStatus;

export type AssignmentSaveResult = {
  success: boolean;
  error?: unknown;
};

export class AssignmentSaveBlockedError extends Error {
  readonly code = 'ASSIGNMENT_SAVE_BLOCKED';

  constructor() {
    super('未解決の配車保存が残っているため、重なる対象は再保存できません。');
    this.name = 'AssignmentSaveBlockedError';
  }
}

/**
 * Modern hook for saving assignments via the repository.
 * Display feedback and the unresolved-save lock are separate.
 * clearError and resetSaveFeedback do not release the lock.
 */
type PlannedTransportTarget = {
  dateKey: string;
  direction: 'to' | 'from';
  userId: string;
  scheduleRowId: string;
  before: AssignmentFieldSnapshot;
  intent: AssignmentFieldSnapshot;
};

type RecoverableRepository = AssignmentRepository & {
  previewTransportSave?: (assignments: TransportAssignment[]) => Promise<PlannedTransportTarget[]>;
  rereadUnresolvedSave?: (record: UnresolvedAssignmentSave) => Promise<UnresolvedAssignmentSave | null>;
  consumeRecoveryMerges?: () => AssignmentRecoveryMerge[];
};

export function useAssignmentSave(repository: AssignmentRepository) {
  const [status, setStatus] = useState<AssignmentSaveStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const [ledgerState, setLedgerState] = useState<AssignmentLedgerState>(() => readAssignmentLedger());
  const unresolvedSaves = ledgerState.kind === 'records' ? ledgerState.records : [];
  const statusRef = useRef(status);
  const unresolvedRef = useRef(unresolvedSaves);
  const ledgerRef = useRef(ledgerState);
  const abortRef = useRef<AbortController | null>(null);
  statusRef.current = status;
  unresolvedRef.current = unresolvedSaves;
  ledgerRef.current = ledgerState;

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const commitRequest = useCallback((requestId: string, next: UnresolvedAssignmentSave | null) => {
    const stored = replaceUnresolvedAssignmentSave(requestId, next);
    unresolvedRef.current = stored.kind === 'records' ? stored.records : [];
    ledgerRef.current = stored;
    setLedgerState(stored);
    return stored;
  }, []);

  const releaseCompletedSave = useCallback((requestId: string, supersedeIds: readonly string[]) => {
    const latest = readAssignmentLedger();
    if (latest.kind === 'corrupt') {
      ledgerRef.current = latest;
      setLedgerState(latest);
      return latest;
    }
    const ids = [requestId];
    if (latest.kind === 'records') {
      for (const id of supersedeIds) {
        const record = latest.records.find((entry) => entry.requestId === id);
        if (record?.saveContractVersion === ASSIGNMENT_SAVE_CONTRACT_VERSION) ids.push(id);
      }
    }
    const stored = removeUnresolvedAssignmentSaves(ids);
    unresolvedRef.current = stored.kind === 'records' ? stored.records : [];
    ledgerRef.current = stored;
    setLedgerState(stored);
    return stored;
  }, []);

  const bindSavePhase = useCallback(() => {
    const phaseAware = repository as AssignmentRepository & {
      onSavePhase?: (phase: AssignmentSavePhase) => void;
    };
    phaseAware.onSavePhase = (phase) => {
      setStatus(phase === 'reconciling' ? 'reconciling' : 'saving');
    };
    return () => {
      phaseAware.onSavePhase = undefined;
    };
  }, [repository]);

  const applyFailure = useCallback((err: unknown) => {
    setError(err);
    const report = readAssignmentSaveReport(err);
    if (isAssignmentConflictError(err)) {
      setStatus('conflict');
      return;
    }
    if (report?.reconciliation === 'incomplete') {
      setStatus('reconcile_failed');
      return;
    }
    if (report?.targets.some((target) => target.writeStarted)) {
      setStatus('partial');
      return;
    }
    setStatus('error');
  }, []);

  const refuseSave = useCallback((blocked = new AssignmentSaveBlockedError()): AssignmentSaveResult => {
    setError(blocked);
    setStatus('reconcile_failed');
    return { success: false, error: blocked };
  }, []);

  const prepareRequest = useCallback(async (assignments: TransportAssignment[]): Promise<AssignmentSaveRequestTarget[]> => {
    const preview = (repository as RecoverableRepository).previewTransportSave;
    if (!preview) return assignmentSaveTargetsFrom(assignments);
    const planned = await preview.call(repository, assignments);
    return planned.map((target) => ({
      dateKey: target.dateKey,
      direction: target.direction,
      userId: target.userId,
      scheduleRowId: target.scheduleRowId,
      before: sealAssignmentFields(target.before),
      intent: sealAssignmentFields(target.intent),
    }));
  }, [repository]);

  const runGuardedSave = useCallback(
    async (
      assignments: TransportAssignment[],
      execute: (signal: AbortSignal) => Promise<void>,
      options?: { supersedeRequestIds?: readonly string[] },
    ): Promise<AssignmentSaveResult> => {
      const controller = new AbortController();
      abortRef.current = controller;
      if (isAssignmentLedgerClosed(ledgerRef.current)) return refuseSave();
      const supersededNow = new Set(options?.supersedeRequestIds ?? []);
      const screening = assignmentSaveTargetsFrom(assignments);
      if (isAssignmentSaveBlocked(
        unresolvedRef.current.filter((record) => !supersededNow.has(record.requestId)),
        screening,
      )) return refuseSave();

      let request: AssignmentSaveRequestTarget[];
      try {
        request = await prepareRequest(assignments);
      } catch (err) {
        applyFailure(err);
        return { success: false, error: err };
      }
      if (isAssignmentSaveBlocked(
        unresolvedRef.current.filter((record) => !supersededNow.has(record.requestId)),
        request,
      )) return refuseSave();
      const previewReady = Boolean((repository as RecoverableRepository).previewTransportSave);
      if (previewReady && request.some((target) => !target.scheduleRowId || !target.before || !target.intent)) {
        const requestId = globalThis.crypto?.randomUUID?.() ?? `assignment-save-${Date.now()}`;
        const retained = nextUnresolvedAssignmentSave(requestId, request, null);
        if (!retained) return refuseSave();
        try {
          const stored = commitRequest(requestId, retained);
          if (stored.kind === 'corrupt') return refuseSave();
        } catch (err) {
          ledgerRef.current = { kind: 'write-failed' };
          setLedgerState({ kind: 'write-failed' });
          setError(err);
          setStatus('error');
          return { success: false, error: err };
        }
        return refuseSave();
      }

      const requestId = globalThis.crypto?.randomUUID?.() ?? `assignment-save-${Date.now()}`;
      const inFlight = nextUnresolvedAssignmentSave(requestId, request, null);
      if (inFlight) {
        try {
          const stored = commitRequest(requestId, inFlight);
          if (stored.kind === 'corrupt') return refuseSave();
        } catch (err) {
          ledgerRef.current = { kind: 'write-failed' };
          setLedgerState({ kind: 'write-failed' });
          setError(err);
          setStatus('error');
          return { success: false, error: err };
        }
      }
      const latest = readAssignmentLedger();
      if (latest.kind === 'corrupt') {
        ledgerRef.current = latest;
        setLedgerState(latest);
        return refuseSave();
      }
      const supersedeIds = options?.supersedeRequestIds ?? [];
      const records = latest.kind === 'records' ? latest.records : [];
      if (supersedeIds.some((id) => records.find((record) => record.requestId === id)?.saveContractVersion !== ASSIGNMENT_SAVE_CONTRACT_VERSION)) {
        try {
          const stored = commitRequest(requestId, null);
          if (stored.kind === 'corrupt') return refuseSave();
        } catch (err) {
          ledgerRef.current = { kind: 'write-failed' };
          setLedgerState({ kind: 'write-failed' });
          setError(err);
          setStatus('error');
          return { success: false, error: err };
        }
        setStatus('recovery_unavailable');
        return refuseSave();
      }
      const superseded = new Set(supersedeIds);
      const others = records.filter((record) => record.requestId !== requestId && !superseded.has(record.requestId));
      if (isAssignmentSaveBlocked(others, request)) {
        try {
          const stored = commitRequest(requestId, null);
          if (stored.kind === 'corrupt') return refuseSave();
        } catch (err) {
          ledgerRef.current = { kind: 'write-failed' };
          setLedgerState({ kind: 'write-failed' });
          setError(err);
          setStatus('error');
          return { success: false, error: err };
        }
        return refuseSave();
      }
      if (controller.signal.aborted) {
        setError(abortedAssignmentSave(controller.signal));
        setStatus('reconcile_failed');
        return { success: false, error: abortedAssignmentSave(controller.signal) };
      }
      setStatus('saving');
      setError(null);
      const unbind = bindSavePhase();

      try {
        await execute(controller.signal);
        const merges = supersedeIds.length > 0
          ? ((repository as RecoverableRepository).consumeRecoveryMerges?.() ?? [])
          : [];
        const latest = readAssignmentLedger();
        const records = latest.kind === 'records' ? latest.records : [];
        const provenIds = provenRecoveryRequestIds(records, supersedeIds, merges);
        const stored = releaseCompletedSave(requestId, provenIds);
        if (stored.kind === 'corrupt') return refuseSave();
        if (supersedeIds.length > 0 && provenIds.length !== supersedeIds.length) {
          setStatus('reconcile_failed');
          return { success: false };
        }
        setStatus('success');
        return { success: true };
      } catch (err) {
        if (controller.signal.aborted || isAssignmentAbortError(err)) {
          setError(err);
          setStatus('reconcile_failed');
          return { success: false, error: err };
        }
        const retained = nextUnresolvedAssignmentSave(requestId, request, readAssignmentSaveReport(err));
        try {
          const stored = commitRequest(requestId, retained);
          if (stored.kind === 'corrupt') return refuseSave();
        } catch (persistError) {
          ledgerRef.current = { kind: 'write-failed' };
          setLedgerState({ kind: 'write-failed' });
          setError(persistError);
          setStatus('error');
          return { success: false, error: persistError };
        }
        applyFailure(err);
        return { success: false, error: err };
      } finally {
        unbind();
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [applyFailure, bindSavePhase, commitRequest, prepareRequest, refuseSave, releaseCompletedSave, repository],
  );

  const withAssignmentWriteLock = useCallback(async (
    mode: 'save' | 'recover',
    work: () => Promise<AssignmentSaveResult>,
  ): Promise<AssignmentSaveResult> => {
    const locks = globalThis.navigator?.locks;
    if (!locks?.request) {
      if (mode === 'recover') {
        setStatus('recovery_unavailable');
        return refuseSave();
      }
      return work();
    }
    let busy = false;
    const result = await locks.request(ASSIGNMENT_WRITE_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        busy = true;
        return undefined;
      }
      return work();
    });
    if (busy) {
      setStatus(mode === 'recover' ? 'recovery_unavailable' : 'error');
      return refuseSave();
    }
    return result ?? refuseSave();
  }, [refuseSave]);

  const saveAssignments = useCallback(
    async (draft: TransportAssignmentDraft): Promise<AssignmentSaveResult> => {
      const assignments = listTransportAssignmentsForSave(draft);
      return withAssignmentWriteLock('save', () => runGuardedSave(
        assignments,
        (signal) => orchestrateAssignmentSave(repository, draft, signal),
      ));
    },
    [repository, runGuardedSave, withAssignmentWriteLock],
  );

  const saveBulkAssignments = useCallback(
    async (assignments: TransportAssignment[]): Promise<AssignmentSaveResult> => {
      const saveBulk = repository.saveBulk as (
        this: AssignmentRepository,
        items: TransportAssignment[],
        options?: { signal?: AbortSignal },
      ) => Promise<void>;
      return withAssignmentWriteLock('save', () => runGuardedSave(
        assignments,
        (signal) => saveBulk.call(repository, assignments, { signal }),
      ));
    },
    [repository, runGuardedSave, withAssignmentWriteLock],
  );

  const recoverAssignments = useCallback(
    async (draft: TransportAssignmentDraft): Promise<AssignmentSaveResult> => {
      return withAssignmentWriteLock('recover', async () => {
        setStatus('recovering');
        const assignments = listTransportAssignmentsForSave(draft);
        const request = assignmentSaveTargetsFrom(assignments);
        const eligibility = assignmentRecoveryEligibility(readAssignmentLedger(), request);
        if (eligibility !== 'available') {
          setStatus('recovery_unavailable');
          return refuseSave();
        }
        const latest = readAssignmentLedger();
        const overlapping = latest.kind === 'records'
          ? latest.records.filter((record) => isAssignmentSaveBlocked([record], request))
          : [];
        const supersedeRequestIds = overlapping.map((record) => record.requestId);
        const recoveryTouchRowIds = overlapping.flatMap((record) => record.targets.map((target) => target.scheduleRowId ?? ''));
        return runGuardedSave(
          assignments,
          (signal) => orchestrateAssignmentSave(repository, draft, signal, {
            recoveryTouchRowIds: recoveryTouchRowIds.filter((rowId) => rowId !== ''),
          }),
          { supersedeRequestIds },
        );
      });
    },
    [refuseSave, repository, runGuardedSave, withAssignmentWriteLock],
  );

  const reconcileUnresolved = useCallback(async (): Promise<void> => {
    if (isAssignmentLedgerClosed(ledgerRef.current) && ledgerRef.current.kind !== 'records') return;
    const reread = (repository as RecoverableRepository).rereadUnresolvedSave;
    if (!reread) return;
    const pending = [...unresolvedRef.current];
    for (const record of pending) {
      const latest = readAssignmentLedger();
      if (latest.kind === 'corrupt') {
        ledgerRef.current = latest;
        setLedgerState(latest);
        return;
      }
      const judged = await reread.call(repository, record);
      try {
        const stored = commitRequest(record.requestId, judged);
        if (stored.kind === 'corrupt') return;
      } catch (err) {
        ledgerRef.current = { kind: 'write-failed' };
        setLedgerState({ kind: 'write-failed' });
        setError(err);
        return;
      }
    }
  }, [commitRequest, repository]);

  const clearError = useCallback(() => {
    const current = statusRef.current;
    if (current === 'saving' || current === 'reconciling' || current === 'recovering' || current === 'partial' || current === 'reconcile_failed' || current === 'conflict') return;
    setError(null);
    setStatus('idle');
  }, []);

  const resetSaveFeedback = useCallback(() => {
    setError(null);
    setStatus((current) => (current === 'saving' || current === 'reconciling' || current === 'recovering' ? current : 'idle'));
  }, []);

  return {
    status,
    error,
    unresolvedSaves,
    ledgerState,
    saveAssignments,
    saveBulkAssignments,
    recoverAssignments,
    reconcileUnresolved,
    clearError,
    resetSaveFeedback,
  };
}

function isAssignmentConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('status' in error && (error as { status?: unknown }).status === 412) return true;
  return 'name' in error && (error as { name?: unknown }).name === 'ScheduleConflictError';
}

function isAssignmentAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name?: unknown }).name === 'AbortError';
}

function abortedAssignmentSave(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}
