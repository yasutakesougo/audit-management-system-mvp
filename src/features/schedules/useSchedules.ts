import { useEffect, useMemo, useRef, useState } from 'react';
import { type DateRange, type SchedItem, type UpdateScheduleEventInput } from './data';
import { useSchedulesPort } from './data/context';
import type { InlineScheduleDraft } from './data/inlineScheduleDraft';

export type { InlineScheduleDraft } from './data/inlineScheduleDraft';

type UseSchedulesResult = {
  items: SchedItem[];
  loading: boolean;
  create: (draft: InlineScheduleDraft) => Promise<void>;
  update: (input: UpdateScheduleEventInput) => Promise<void>;
  remove: (eventId: string) => Promise<void>;
};

const normalizeRange = (range: DateRange): DateRange => ({
  from: new Date(range.from).toISOString(),
  to: new Date(range.to).toISOString(),
});

export function useSchedules(range: DateRange): UseSchedulesResult {
  const [items, setItems] = useState<SchedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const lastMutationTsRef = useRef<number>(0);
  const port = useSchedulesPort();

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
  }, [normalizedRange.from, normalizedRange.to, port]);

  const create = async (draft: InlineScheduleDraft) => {
    if (!port.create) {
      throw new Error('Schedule port does not support create');
    }
    if (!draft.sourceInput) {
      throw new Error('Schedule draft is missing sourceInput');
    }
    const created = await port.create(draft.sourceInput);
    lastMutationTsRef.current = Date.now();
    setItems((prev) => [...prev, created]);
  };

  const update = async (input: UpdateScheduleEventInput) => {
    if (!port.update) {
      throw new Error('Schedule port does not support update');
    }
    const updated = await port.update(input);
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

  const remove = async (eventId: string) => {
    if (!port.remove) {
      throw new Error('Schedule port does not support remove');
    }
    await port.remove(eventId);
    lastMutationTsRef.current = Date.now();
    setItems((prev) => prev.filter((item) => item.id !== eventId));
  };

  return { items, loading, create, update, remove };
}

export const makeRange = (from: Date, to: Date): DateRange => ({
  from: from.toISOString(),
  to: to.toISOString(),
});

export type { DateRange };
