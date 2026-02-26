import { useAuth } from '@/auth/useAuth';
import { isE2eForceSchedulesWrite, isWriteEnabled } from '@/env';
import { authDiagnostics } from '@/features/auth/diagnostics';
import { toSafeError } from '@/lib/errors';
import type { ResultError } from '@/shared/result';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DateRange, type SchedItem, type UpdateScheduleEventInput } from '../data';
import type { InlineScheduleDraft } from '../data/inlineScheduleDraft';
import { classifySchedulesError, shouldFallbackToReadOnly, type SchedulesErrorInfo } from '../errors';
import { useScheduleRepository } from '../repositoryFactory';

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

  const clearLastError = useCallback(() => setLastError(null), []);
  const refetch = useCallback(() => setReloadToken((v) => v + 1), []);

  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to]);

  // One-time check: verify ScheduleEvents list exists at app startup
  useEffect(() => {
    if (listCheckDoneRef.current) return;
    listCheckDoneRef.current = true;

    const checkListExistence = async () => {
      try {
        // Use repository's checkListExists if available (SharePoint mode)
        const exists =
          'checkListExists' in repository && typeof (repository as { checkListExists?: unknown }).checkListExists === 'function'
            ? await (repository as { checkListExists: () => Promise<boolean> }).checkListExists()
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
        const message = error instanceof Error ? error.message : String(error);
        const is404 = /\b404\b/.test(message) || /Not Found/i.test(message) || /does not exist/i.test(message);

        if (is404) {
          setListReadyState(false);
        }

        authDiagnostics.collect({
          route: '/schedules',
          reason: error instanceof Error && error.message.includes('auth') ? 'login-failure' : 'network-error',
          outcome: 'blocked',
          detail: {
            errorMessage: message,
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
        if (alive && !abortController.signal.aborted) {
          const info = classifySchedulesError(err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch schedules';
          const resultError: ResultError = {
            kind: info.kind === 'NETWORK_ERROR' ? 'network' : 'unknown',
            message: info.message || errorMessage,
            cause: err instanceof Error ? err : new Error(errorMessage),
          };

          setLastError(resultError);
          setItems([]); // Clear items on error

          // Diagnose: Use classified reason
          let reason = 'unknown-error';
          const errorStatus = (err as { status?: number }).status;
          if (errorStatus === 401 || errorStatus === 403) {
            reason = 'login-failure';
          } else if (errorStatus === 404) {
            reason = 'list-not-found';
          } else if (info.kind === 'NETWORK_ERROR') {
            reason = 'network-error';
          }

          authDiagnostics.collect({
            route: '/schedules',
            reason,
            outcome: 'blocked',
            detail: {
              errorMessage,
              status: errorStatus,
            },
          });
        }
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
  }, [normalizedRange, repository, reloadToken]);

  const create = useCallback(async (draft: InlineScheduleDraft) => {
    if (!draft.sourceInput) {
      throw new Error('Schedule draft is missing sourceInput');
    }

    try {
      setLoading(true);
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
      // return created; // Removed to match UseSchedulesResult interface
    } catch (error) {
      const safeError = toSafeError(error);
      const info = classifySchedulesError(error);

      const resultError: ResultError = {
        kind: info.kind === 'CONFLICT' ? 'conflict' : info.kind === 'NETWORK_ERROR' ? 'network' : 'unknown',
        message: info.message || safeError.message,
        cause: safeError,
      };
      setLastError(resultError);
      throw error; // Re-throw for caller to handle
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const update = useCallback(async (input: UpdateScheduleEventInput) => {
    try {
      setLoading(true);
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
      const info = classifySchedulesError(error);

      const resultError: ResultError = {
        kind: info.kind === 'CONFLICT' ? 'conflict' : info.kind === 'NETWORK_ERROR' ? 'network' : 'unknown',
        message: info.message || safeError.message,
        cause: safeError,
        id: input.id, // Attach schedule id for post-refetch targeting
      };

      setLastError(resultError);
      throw error; // Re-throw for caller to handle
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const remove = useCallback(async (eventId: string): Promise<void> => {
    try {
      setLoading(true);
      await repository.remove(eventId);
      setLastError(null);
      lastMutationTsRef.current = Date.now();
      setItems((prev) => prev.filter((item) => item.id !== eventId));
    } catch (error) {
      const safeError = toSafeError(error);
      const info = classifySchedulesError(error);
      const resultError: ResultError = {
        kind: info.kind === 'CONFLICT' ? 'conflict' : info.kind === 'NETWORK_ERROR' ? 'network' : 'unknown',
        message: info.message || safeError.message,
        cause: safeError,
        id: eventId,
      };
      setLastError(resultError);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [repository]);

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

  return useMemo(() => ({
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
  }), [
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
  ]);
}

export const makeRange = (from: Date, to: Date): DateRange => ({
  from: from.toISOString(),
  to: to.toISOString(),
});

// Re-export for consumers importing from useSchedules
export type { DateRange };
