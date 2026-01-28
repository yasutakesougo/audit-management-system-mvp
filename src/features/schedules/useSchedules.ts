import { useEffect, useMemo, useRef, useState } from 'react';
import { type DateRange, type SchedItem, type UpdateScheduleEventInput } from './data';
import { useSchedulesPort } from './data/context';
import type { InlineScheduleDraft } from './data/inlineScheduleDraft';
import type { ResultError } from '@/shared/result';

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
  const port = useSchedulesPort();

  const clearLastError = () => setLastError(null);
  const refetch = () => setReloadToken((v) => v + 1);

  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to]);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    (async () => {
      try {
        setLoading(true);
        const data = await port.list(normalizedRange);
        if (!alive) return;
        if (lastMutationTsRef.current > startedAt) {
          return;
        }
        setItems(data);
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
    if (!port.create) throw new Error('Schedule port does not support create');
    if (!draft.sourceInput) throw new Error('Schedule draft is missing sourceInput');

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
    if (!port.update) throw new Error('Schedule port does not support update');

    const res = await port.update(input);
    if (!res.isOk) {
      setLastError(res.error);
      console.warn('[schedules] update failed', res.error);
      return;
    }

    setLastError(null);
    const updated = res.value;
    lastMutationTsRef.current = Date.now();
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== updated.id) return item;
        const nextServiceType = (updated.serviceType ?? input.serviceType ?? item.serviceType) ?? undefined;
        return { ...item, ...updated, serviceType: nextServiceType };
      }),
    );
  };

  const remove = async (id: string) => {
    const removeFn = port.remove;
    if (!removeFn) throw new Error('Schedule port does not support remove');

    await removeFn(id);
    lastMutationTsRef.current = Date.now();
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return {
    items,
    loading,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
  };
}

export const makeRange = (from: Date, to: Date): DateRange => ({
  from: from.toISOString(),
  to: to.toISOString(),
});

export type { DateRange };
