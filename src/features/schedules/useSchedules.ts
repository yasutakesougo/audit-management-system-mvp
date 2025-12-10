import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateScheduleEventInput } from './ScheduleCreateDialog';
import { type DateRange as DataDateRange, type SchedItem, type UpdateScheduleEventInput } from './data';
import { useSchedulesPort } from './data/context';
import { SCHEDULES_DEBUG } from './debug';

export type DateRange = DataDateRange;

type UseSchedulesResult = {
  items: SchedItem[];
  loading: boolean;
  create: (draft: InlineScheduleDraft) => Promise<SchedItem>;
  update: (input: UpdateScheduleEventInput) => Promise<SchedItem>;
};

export type InlineScheduleDraft = {
  title: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  sourceInput?: CreateScheduleEventInput;
};

const normalizeRange = (range: DateRange): DateRange => ({
  from: new Date(range.from).toISOString(),
  to: new Date(range.to).toISOString(),
});

const inferRangeMode = (range: DateRange): 'day' | 'week' | 'month' | 'custom' => {
  const fromTs = Date.parse(range.from);
  const toTs = Date.parse(range.to);
  if (Number.isNaN(fromTs) || Number.isNaN(toTs)) {
    return 'custom';
  }
  const diffDays = (toTs - fromTs) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1.1) return 'day';
  if (diffDays <= 7.1) return 'week';
  if (diffDays <= 35) return 'month';
  return 'custom';
};

export function useSchedules(range: DateRange): UseSchedulesResult {
  const [items, setItems] = useState<SchedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const port = useSchedulesPort();

  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to]);

  useEffect(() => {
    if (!SCHEDULES_DEBUG) {
      return;
    }
    const view = inferRangeMode(normalizedRange);
    // eslint-disable-next-line no-console -- dev/test diagnostics only
    console.log('[schedules] useSchedules', {
      view,
      range: {
        from: normalizedRange.from,
        to: normalizedRange.to,
      },
      items: items.length,
    });
  }, [items.length, normalizedRange.from, normalizedRange.to]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await port.list(normalizedRange);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [normalizedRange, port]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await port.list(normalizedRange);
        if (!alive) return;
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

  const create = useCallback(async (draft: InlineScheduleDraft) => {
    const startIso = toIsoFromParts(draft.dateIso, draft.startTime);
    const endIso = toIsoFromParts(draft.dateIso, draft.endTime);
    const optimisticId = `temp-${Date.now()}`;
    const optimistic: SchedItem = {
      id: optimisticId,
      title: draft.title.trim() || '新規予定',
      start: startIso,
      end: endIso,
      status: 'Planned',
      statusReason: draft.sourceInput?.statusReason ?? null,
    };

    setItems((prev) => sortByStart([...prev, optimistic]));

    const input = buildCreateInputFromDraft(draft);

    try {
      const normalizedTitle = draft.title.trim() || input.title;
      const saved = await port.create({ ...input, title: normalizedTitle });
      setItems((prev) =>
        sortByStart(
          prev.map((item) => (item.id === optimisticId ? saved : item)),
        ),
      );
      await refresh();
      return saved;
    } catch (error) {
      setItems((prev) => prev.filter((item) => item.id !== optimisticId));
      // eslint-disable-next-line no-console
      console.error('Failed to create schedule', error);
      throw error;
    }
  }, [port, refresh]);

  const update = useCallback(async (input: UpdateScheduleEventInput) => {
    if (!port.update) {
      throw new Error('Schedules update is not configured for this environment.');
    }

    const normalized: UpdateScheduleEventInput = {
      ...input,
      title: input.title?.trim() || '新規予定',
    };

    try {
      const saved = await port.update(normalized);
      setItems((prev) =>
        sortByStart(prev.map((item) => (item.id === saved.id ? saved : item))),
      );
      await refresh();
      return saved;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update schedule', error);
      throw error;
    }
  }, [port, refresh]);

  return { items, loading, create, update };
}

export const makeRange = (from: Date, to: Date): DateRange => ({
  from: from.toISOString(),
  to: to.toISOString(),
});

const sortByStart = (list: SchedItem[]): SchedItem[] =>
  [...list].sort((a, b) => a.start.localeCompare(b.start));

const toIsoFromParts = (dateIso: string, time: string): string => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const value = `${dateIso}T${normalizedTime}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const buildCreateInputFromDraft = (draft: InlineScheduleDraft): CreateScheduleEventInput => {
  if (draft.sourceInput) {
    return { ...draft.sourceInput, title: draft.title };
  }

  const startLocal = `${draft.dateIso}T${draft.startTime}`;
  const endLocal = `${draft.dateIso}T${draft.endTime}`;
  const input: CreateScheduleEventInput = {
    title: draft.title || '新規予定',
    category: 'Org',
    startLocal,
    endLocal,
    serviceType: 'other',
    status: 'Planned',
    statusReason: null,
  };
  return input;
};
