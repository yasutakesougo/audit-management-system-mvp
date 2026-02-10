import { useCallback, useEffect, useMemo } from 'react';
import { useMatch, useSearchParams } from 'react-router-dom';

import type { ScheduleCategory } from '@/features/schedules/domain/types';
import { ensureDateParam, normalizeToDayStart, pickDateParam } from '@/features/schedules/utils/dateQuery';

export type ScheduleTab = 'week' | 'day' | 'month';
export type WeekDialogMode = 'create' | 'edit';

export type DialogIntentParams = {
  mode: WeekDialogMode;
  category: ScheduleCategory;
  dateIso: string;
  startTime: string;
  endTime: string;
  eventId?: string | null;
};

export type WeekPageFilterState = {
  category: 'All' | ScheduleCategory;
  query: string;
};

type RouteState = {
  mode: ScheduleTab;
  focusDate: Date;
  dateIso: string;
  filter: WeekPageFilterState;
  setFilter: (next: Partial<WeekPageFilterState>) => void;
  dialogIntent: DialogIntentParams | null;
  createDialogOpen: boolean;
  setDialogParams: (intent: DialogIntentParams) => void;
  clearDialogParams: () => void;
  setDateIso: (dateIso: string) => void;
};

const LEGACY_TABS = ['day', 'week', 'timeline', 'month'] as const;
type LegacyTab = typeof LEGACY_TABS[number];

const DEFAULT_DIALOG_START = '10:00';
const DEFAULT_DIALOG_END = '11:00';

const CATEGORY_VALUES = new Set<ScheduleCategory>(['User', 'Staff', 'Org']);

const parseCategoryParam = (value?: string | null): 'All' | ScheduleCategory => {
  if (!value) return 'All';
  const trimmed = value.trim();
  if (!trimmed) return 'All';
  if (trimmed.toLowerCase() === 'all') return 'All';
  return CATEGORY_VALUES.has(trimmed as ScheduleCategory) ? (trimmed as ScheduleCategory) : 'All';
};

const toDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveDialogIntent = (params: URLSearchParams): DialogIntentParams | null => {
  const mode = params.get('dialog') as WeekDialogMode | null;
  if (mode !== 'create' && mode !== 'edit') {
    return null;
  }
  const dateIso = params.get('dialogDate');
  if (!dateIso) {
    return null;
  }
  const startTime = params.get('dialogStart') ?? DEFAULT_DIALOG_START;
  const endTime = params.get('dialogEnd') ?? DEFAULT_DIALOG_END;
  const category = (params.get('dialogCategory') as ScheduleCategory) ?? 'User';
  const eventId = mode === 'edit' ? params.get('eventId') : null;
  return {
    mode,
    category,
    dateIso,
    startTime,
    endTime,
    eventId,
  };
};

export const useWeekPageRouteState = (): RouteState => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dayMatch = useMatch('/schedules/day/*');
  const monthMatch = useMatch('/schedules/month/*');
  const tabParam = searchParams.get('tab');

  const mode: ScheduleTab = dayMatch
    ? 'day'
    : monthMatch
      ? 'month'
      : tabParam && LEGACY_TABS.includes(tabParam as LegacyTab)
        ? (tabParam === 'timeline' ? 'week' : (tabParam as ScheduleTab))
        : 'week';

  useEffect(() => {
    if (tabParam !== 'timeline') {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'week');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tabParam]);

  const rawDateParam = useMemo(() => pickDateParam(searchParams), [searchParams]);
  const focusDate = useMemo(() => normalizeToDayStart(rawDateParam), [rawDateParam]);
  const dateIso = useMemo(() => toDateIso(focusDate), [focusDate]);
  const laneParam = searchParams.get('lane');

  const filter = useMemo<WeekPageFilterState>(() => {
    const query = searchParams.get('q')?.trim() ?? '';
    const category = parseCategoryParam(laneParam ?? searchParams.get('cat'));
    return { category, query };
  }, [searchParams]);

  const setFilter = useCallback(
    (next: Partial<WeekPageFilterState>) => {
      const merged: WeekPageFilterState = {
        category: next.category ?? filter.category,
        query: next.query ?? filter.query,
      };
      if (merged.category === filter.category && merged.query === filter.query) {
        return;
      }
      const params = new URLSearchParams(searchParams);
      const trimmedQuery = merged.query.trim();
      if (trimmedQuery) {
        params.set('q', trimmedQuery);
      } else {
        params.delete('q');
      }
      params.delete('lane');
      if (merged.category !== 'All') {
        params.set('cat', merged.category);
      } else {
        params.delete('cat');
      }
      setSearchParams(params, { replace: true });
    },
    [filter.category, filter.query, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (mode !== 'day' || !laneParam) {
      return;
    }
    const laneCategory = parseCategoryParam(laneParam);
    const params = new URLSearchParams(searchParams);
    params.delete('lane');
    if (laneCategory !== 'All') {
      params.set('cat', laneCategory);
    } else {
      params.delete('cat');
    }
    setSearchParams(params, { replace: true });
  }, [laneParam, mode, searchParams, setSearchParams]);

  const dialogIntent = useMemo(() => resolveDialogIntent(searchParams), [searchParams]);
  const createDialogOpen = Boolean(dialogIntent);

  const setDialogParams = useCallback(
    (intent: DialogIntentParams) => {
      const normalizedDate = normalizeToDayStart(intent.dateIso);
      const next = ensureDateParam(searchParams, normalizedDate);
      next.set('dialog', intent.mode);
      next.set('dialogDate', intent.dateIso);
      next.set('dialogStart', intent.startTime);
      next.set('dialogEnd', intent.endTime);
      next.set('dialogCategory', intent.category);
      if (intent.eventId) {
        next.set('eventId', intent.eventId);
      } else {
        next.delete('eventId');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearDialogParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('dialog');
    next.delete('dialogDate');
    next.delete('dialogStart');
    next.delete('dialogEnd');
    next.delete('dialogCategory');
    next.delete('eventId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setDateIso = useCallback(
    (nextIso: string) => {
      const normalized = normalizeToDayStart(nextIso);
      const next = ensureDateParam(searchParams, normalized);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const hasDay = searchParams.has('day');
    const hasWeek = searchParams.has('week');
    const source = dateParam ?? rawDateParam;
    const normalized = source ? normalizeToDayStart(source) : focusDate;
    const normalizedIso = toDateIso(normalized);
    const needsNormalization = !dateParam || hasDay || hasWeek || dateParam !== normalizedIso;

    if (!needsNormalization) {
      return;
    }

    const next = ensureDateParam(searchParams, normalized);
    setSearchParams(next, { replace: true });
  }, [focusDate, rawDateParam, searchParams, setSearchParams]);

  return {
    mode,
    focusDate,
    dateIso,
    filter,
    setFilter,
    dialogIntent,
    createDialogOpen,
    setDialogParams,
    clearDialogParams,
    setDateIso,
  };
};
