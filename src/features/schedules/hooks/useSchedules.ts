import { useEffect, useMemo, useRef, useState } from 'react';
import { type DateRange, type SchedItem, type UpdateScheduleEventInput } from '../data';
import type { InlineScheduleDraft } from '../data/inlineScheduleDraft';
import type { ResultError } from '@/shared/result';
import { toSafeError } from '@/lib/errors';
import { isE2eForceSchedulesWrite, isWriteEnabled } from '@/env';
import { classifySchedulesError, shouldFallbackToReadOnly, type SchedulesErrorInfo } from '../errors';
import { useScheduleRepository } from '../repositoryFactory';
import { useAuth } from '@/auth/useAuth';
import { authDiagnostics } from '@/features/auth/diagnostics';

export type { InlineScheduleDraft } from '../data/inlineScheduleDraft';

export type UseSchedulesResult = {
  items: SchedItem[];
  loading: boolean;
  create: (draft: InlineScheduleDraft) => Promise<void>;
  update: (input: UpdateScheduleEventInput) => Promise<void>;
  remove: (eventId: string) => Promise<void>;
  lastError: ResultError | null;
  clearLastError: () => void;
  refetch: () => void;
  /** Read-only reason if mutations are disabled */
  readOnlyReason?: SchedulesErrorInfo;
  /** Whether writes are currently allowed */
  canWrite: boolean;
};

const normalizeRange = (range: DateRange): DateRange => ({
  from: new Date(range.from).toISOString(),
  to: new Date(range.to).toISOString(),
});

export function useSchedules(range: DateRange): UseSchedulesResult {
  const [items, setItems] = useState<SchedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastError, setLastError] = useState<ResultError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const lastMutationTsRef = useRef<number>(0);
  const listCheckDoneRef = useRef<boolean>(false);
  const repository = useScheduleRepository();
  const { getListReadyState, setListReadyState } = useAuth();

  const clearLastError = () => setLastError(null);
  const refetch = () => setReloadToken((v) => v + 1);

  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to]);

  // One-time check: verify ScheduleEvents list exists at app startup
  useEffect(() => {
    if (listCheckDoneRef.current) return;
    listCheckDoneRef.current = true;

    const checkListExistence = async () => {
      try {
        // Use repository's checkListExists if available (SharePoint mode)
        const exists =
          'checkListExists' in repository && typeof repository.checkListExists === 'function'
            ? await repository.checkListExists()
            : true; // Demo mode always returns true

        if (exists) {
          setListReadyState(true);
        } else {
          setListReadyState(false);
          authDiagnostics.collect({
            route: '/schedules',
            reason: 'list-not-found',
            outcome: 'blocked',
          });
        }
      } catch (error) {
        console.error('[useSchedules] List existence check failed:', error);
        setListReadyState(false);
        authDiagnostics.collect({
          route: '/schedules',
          reason: error instanceof Error && error.message.includes('auth') ? 'login-failure' : 'network-error',
          outcome: 'blocked',
          detail: {
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
      }
    };

    const currentState = getListReadyState();
    if (currentState === null) {
      void checkListExistence();
    }
  }, [repository, getListReadyState, setListReadyState]);

  useEffect(() => {
    let alive = true;
    const abortController = new AbortController();
    const startedAt = Date.now();
    (async () => {
      try {
        setLoading(true);
        setLastError(null); // Clear previous errors
        const data = await repository.list({
          range: normalizedRange,
          signal: abortController.signal,
        });
        if (!alive || abortController.signal.aborted) return;
        if (lastMutationTsRef.current > startedAt) {
          return;
        }
        setItems(data);
      } catch (err) {
        // Handle errors gracefully without throwing
        if (!alive || abortController.signal.aborted) return;
        const error = err instanceof Error ? err.message : 'Failed to fetch schedules';
        // eslint-disable-next-line no-console
        console.error('[useSchedules] Failed to load schedule items', {
          message: error,
          err,
          status: (err as { status?: number }).status,
          url: (err as { url?: string }).url,
          body: (err as { body?: string }).body,
        });
        setLastError({ message: error } as ResultError);
        setItems([]); // Clear items on error

        // Diagnose: Categorize error and collect event
        const errorStatus = (err as { status?: number }).status;
        let reason = 'unknown-error';
        if (errorStatus === 401 || errorStatus === 403) {
          reason = 'login-failure';
        } else if (errorStatus === 404) {
          reason = 'list-not-found';
        } else if (!navigator.onLine || error.includes('network')) {
          reason = 'network-error';
        }

        authDiagnostics.collect({
          route: '/schedules',
          reason,
          outcome: 'blocked',
          detail: {
            errorMessage: error,
            status: errorStatus,
          },
        });
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      abortController.abort();
    };
  }, [normalizedRange.from, normalizedRange.to, repository, reloadToken]);

  const create = async (draft: InlineScheduleDraft) => {
    if (!draft.sourceInput) {
      throw new Error('Schedule draft is missing sourceInput');
    }

    try {
      const input = draft.sourceInput;
      const created = await repository.create({
        title: input.title,
        category: input.category,
        startLocal: input.startLocal,
        endLocal: input.endLocal,
        serviceType: input.serviceType,
        userId: input.userId,
        userLookupId: input.userLookupId,
        userName: input.userName,
        assignedStaffId: input.assignedStaffId,
        locationName: input.locationName,
        notes: input.notes,
        vehicleId: input.vehicleId,
        status: input.status,
        statusReason: input.statusReason,
        acceptedOn: input.acceptedOn,
        acceptedBy: input.acceptedBy,
        acceptedNote: input.acceptedNote,
        ownerUserId: input.ownerUserId,
        visibility: input.visibility,
        currentOwnerUserId: input.currentOwnerUserId,
      });

      setLastError(null);
      lastMutationTsRef.current = Date.now();
      setItems((prev) => [...prev, created]);

      // E2E: Persist to localStorage for test fixtures
      if (isE2eForceSchedulesWrite && typeof window !== 'undefined') {
        try {
          const storageKey = 'e2e:schedules.v1';
          const raw = window.localStorage.getItem(storageKey);
          const parsed = raw ? JSON.parse(raw) : [];
          const next = Array.isArray(parsed) ? [...parsed, created] : [created];
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (error) {
          console.warn('[schedules] E2E localStorage write failed', error);
        }
      }
    } catch (error) {
      const safeError = toSafeError(error);
      const resultError: ResultError = {
        kind: 'unknown',
        message: safeError.message,
        cause: safeError,
      };
      setLastError(resultError);
      console.warn('[schedules] create failed', resultError);
      throw error; // Re-throw for caller to handle
    }
  };

  const update = async (input: UpdateScheduleEventInput) => {
    try {
      // Extract etag if available (for optimistic concurrency control)
      const etag = (input as { etag?: string }).etag;

      const updated = await repository.update({
        id: input.id,
        etag,
        title: input.title,
        category: input.category,
        startLocal: input.startLocal,
        endLocal: input.endLocal,
        serviceType: input.serviceType,
        userId: input.userId,
        userLookupId: input.userLookupId,
        userName: input.userName,
        assignedStaffId: input.assignedStaffId,
        locationName: input.locationName,
        notes: input.notes,
        vehicleId: input.vehicleId,
        status: input.status,
        statusReason: input.statusReason,
        acceptedOn: input.acceptedOn,
        acceptedBy: input.acceptedBy,
        acceptedNote: input.acceptedNote,
        ownerUserId: input.ownerUserId,
        visibility: input.visibility,
        currentOwnerUserId: input.currentOwnerUserId,
      });

      setLastError(null);
      lastMutationTsRef.current = Date.now();
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== updated.id) return item;
          const nextServiceType = (updated.serviceType ?? input.serviceType ?? item.serviceType) ?? undefined;
          return {
            ...item,
            ...updated,
            serviceType: nextServiceType,
          };
        }),
      );
    } catch (error) {
      const safeError = toSafeError(error);
      // Phase 2-2b: Detect 412 conflict errors
      const isConflict =
        (error as { status?: number }).status === 412 ||
        safeError.message.includes('412') ||
        safeError.message.includes('conflict');

      const resultError: ResultError = {
        kind: isConflict ? 'conflict' : 'unknown',
        message: safeError.message,
        cause: safeError,
        id: input.id, // Attach schedule id for post-refetch targeting
      };

      setLastError(resultError);
      console.warn('[schedules] update failed', resultError);
      throw error; // Re-throw for caller to handle
    }
  };

  const remove = async (eventId: string): Promise<void> => {
    try {
      await repository.remove(eventId);
      setLastError(null);
      lastMutationTsRef.current = Date.now();
      setItems((prev) => prev.filter((item) => item.id !== eventId));
    } catch (error) {
      const safeError = toSafeError(error);
      const resultError: ResultError = { kind: 'unknown', message: safeError.message, cause: safeError };
      setLastError(resultError);
      console.warn('[schedules] remove failed', resultError);
      throw error;
    }
  };

  // Determine read-only reason
  const readOnlyReason = useMemo((): SchedulesErrorInfo | undefined => {
    if (isE2eForceSchedulesWrite) {
      return undefined;
    }
    // If write is disabled via env flag
    if (!isWriteEnabled) {
      return {
        kind: 'WRITE_DISABLED',
        title: '閲覧専用モード',
        message: '現在、スケジュールの作成・編集・削除は無効になっています。',
        action: {
          label: '管理者に確認',
        },
        details: ['環境変数 VITE_WRITE_ENABLED が無効になっています。'],
      };
    }

    // If list check failed
    const listReady = getListReadyState();
    if (listReady === false) {
      return {
        kind: 'LIST_MISSING',
        title: 'リストが見つかりません',
        message: 'SharePoint に ScheduleEvents リストが見つかりませんでした。',
        action: {
          label: '管理者に確認',
        },
        details: ['リストが削除されているか、名前が変更されている可能性があります。'],
      };
    }

    // If mutation error suggests read-only fallback
    if (lastError && lastError.kind === 'unknown' && lastError.cause) {
      if (shouldFallbackToReadOnly(lastError.cause)) {
        return classifySchedulesError(lastError.cause);
      }
    }

    return undefined;
  }, [getListReadyState, isE2eForceSchedulesWrite, lastError]);

  const canWrite = isE2eForceSchedulesWrite ? true : !readOnlyReason;

  const returnValue = {
    items,
    loading,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
    readOnlyReason,
    canWrite,
  };

  if (typeof returnValue.remove !== 'function') {
    console.error('[CRITICAL] useSchedules returning remove that is NOT a function:', typeof returnValue.remove);
  }

  return returnValue as UseSchedulesResult;
}

export const makeRange = (from: Date, to: Date): DateRange => ({
  from: from.toISOString(),
  to: to.toISOString(),
});

// Re-export for consumers importing from useSchedules
export type { DateRange };
