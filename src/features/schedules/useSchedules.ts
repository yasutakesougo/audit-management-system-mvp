import { useEffect, useMemo, useRef, useState } from 'react';
import { type DateRange, type SchedItem, type UpdateScheduleEventInput } from './data';
import { useSchedulesPort } from './data/context';
import { useAuth } from '@/auth/useAuth';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { InlineScheduleDraft } from './data/inlineScheduleDraft';
import type { ResultError } from '@/shared/result';
import { toSafeError } from '@/lib/errors';

export type { InlineScheduleDraft } from './data/inlineScheduleDraft';

export type UseSchedulesResult = {
  items: SchedItem[];
  loading: boolean;
  create: (draft: InlineScheduleDraft) => Promise<void>;
  update: (input: UpdateScheduleEventInput) => Promise<void>;
  remove: (eventId: string) => Promise<void>;
  lastError: ResultError | null;
  clearLastError: () => void;
  refetch: () => void;
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
  const port = useSchedulesPort();
  const { acquireToken, getListReadyState, setListReadyState } = useAuth();

  const clearLastError = () => setLastError(null);
  const refetch = () => setReloadToken((v) => v + 1);

  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to]);

  // One-time check: verify ScheduleEvents list exists at app startup
  useEffect(() => {
    if (listCheckDoneRef.current) return;
    listCheckDoneRef.current = true;

    const checkListExistence = async () => {
      try {
        const spConfig = ensureConfig();
        const baseUrl = spConfig.baseUrl;
        if (!baseUrl) return; // E2E/demo mode

        const listName = String(import.meta.env.VITE_SP_LIST_SCHEDULES || 'ScheduleEvents');
        const client = createSpClient(acquireToken, baseUrl);
        const metadata = await client.tryGetListMetadata(listName);

        if (metadata) {
          setListReadyState(true);
        } else {
          setListReadyState(false);
        }
      } catch (error) {
        console.error('[useSchedules] List existence check failed:', error);
        setListReadyState(false);
      }
    };

    const currentState = getListReadyState();
    if (currentState === null) {
      void checkListExistence();
    }
  }, [acquireToken, getListReadyState, setListReadyState]);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    (async () => {
      try {
        setLoading(true);
        setLastError(null); // Clear previous errors
        const data = await port.list(normalizedRange);
        if (!alive) return;
        if (lastMutationTsRef.current > startedAt) {
          return;
        }
        setItems(data);
      } catch (err) {
        // Handle errors gracefully without throwing
        if (!alive) return;
        const error = err instanceof Error ? err.message : 'Failed to fetch schedules';
        console.error('[useSchedules] Failed to load schedule items:', err);
        setLastError({ message: error } as ResultError);
        setItems([]); // Clear items on error
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [normalizedRange.from, normalizedRange.to, port, reloadToken]);

  const create = async (draft: InlineScheduleDraft) => {
    if (!port.create) {
      throw new Error('Schedule port does not support create');
    }
    if (!draft.sourceInput) {
      throw new Error('Schedule draft is missing sourceInput');
    }
    const res = await port.create(draft.sourceInput);
    if (!res.isOk) {
      setLastError(res.error);
      console.warn('[schedules] create failed', res.error);
      return;
    }
    setLastError(null);
    lastMutationTsRef.current = Date.now();
    setItems((prev) => [...prev, res.value]);
  };

  const update = async (input: UpdateScheduleEventInput) => {
    if (!port.update) {
      throw new Error('Schedule port does not support update');
    }
    const res = await port.update(input);
    if (!res.isOk) {
      // Phase 2-2b: Attach schedule id to conflict errors for post-refetch targeting
      const errorToSet = res.error.kind === 'conflict' ? { ...res.error, id: input.id } : res.error;
      setLastError(errorToSet);
      console.warn('[schedules] update failed', errorToSet);
      return;
    }
    setLastError(null);
    const updated = res.value;
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
  };

  const remove = async (eventId: string): Promise<void> => {
    const removeFn = port.remove;
    if (!removeFn) {
      throw new Error('Schedule port does not support remove');
    }
    try {
      await removeFn(eventId);
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

  const returnValue = {
    items,
    loading,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
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
