import { useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

import type { ScheduleCategory } from '@/features/schedules/domain/types';
import type { CreateScheduleEventInput, SchedItem, UpdateScheduleEventInput } from '@/features/schedules/data';
import type { ScheduleFormState } from '@/features/schedules/domain/scheduleFormState';
import { makeRange, useSchedules } from './useSchedules';
import { type DialogIntentParams, type WeekDialogMode, useWeekPageRouteState } from './useWeekPageRouteState';
import type { SchedulesErrorInfo } from '../errors';

export const DEFAULT_START_TIME = '10:00';
export const DEFAULT_END_TIME = '11:00';

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
};

const endOfWeek = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
};

const startOfMonth = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfCalendar = (anchor: Date): Date => startOfWeek(startOfMonth(anchor));

const endOfCalendar = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6 * 7);
  return end;
};

const formatRangeLabel = (fromIso: string, toIso: string): string => {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  end.setDate(end.getDate() - 1);
  const fmt = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });
  return `${fmt.format(start)} 〜 ${fmt.format(end)}`;
};

const formatTimePart = (date: Date): string => {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildDefaultSlot = (iso: string): { start: Date; end: Date } => {
  const start = new Date(`${iso}T${DEFAULT_START_TIME}`);
  const end = new Date(`${iso}T${DEFAULT_END_TIME}`);
  return { start, end };
};

export const buildNextSlot = (iso: string): { start: Date; end: Date } => {
  const todayIso = toDateIso(new Date());
  if (iso !== todayIso) {
    return buildDefaultSlot(iso);
  }

  const now = new Date();
  const base = new Date(`${iso}T00:00:00`);
  const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
  let hours = now.getHours();
  let minutes = roundedMinutes;
  if (roundedMinutes >= 60) {
    hours += 1;
    minutes = 0;
  }
  if (hours >= 24) {
    return buildDefaultSlot(iso);
  }
  const start = new Date(base);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return { start, end };
};

export const extractDatePart = (value?: string | null): string => {
  if (!value) return '';
  return value.slice(0, 10);
};

export const extractTimePart = (value?: string | null): string => {
  if (!value || value.length < 16) return '';
  return value.slice(11, 16);
};

export const buildLocalDateTimeInput = (value?: string | null, fallbackTime?: string): string => {
  const dateIso = extractDatePart(value) || toDateIso(new Date());
  const time = extractTimePart(value) || fallbackTime || DEFAULT_START_TIME;
  return `${dateIso}T${time}`;
};

export const formatScheduleLocalInput = (
  value: string | null | undefined,
  fallbackTime: string | undefined,
  schedulesTz: string,
): string => {
  if (!value) {
    return buildLocalDateTimeInput(value, fallbackTime);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return buildLocalDateTimeInput(value, fallbackTime);
  }
  return formatInTimeZone(parsed, schedulesTz, "yyyy-MM-dd'T'HH:mm");
};

const ANNOUNCE_START_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const ANNOUNCE_END_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
});

const formatWeekAnnouncement = (fromIso: string, toIso: string): string => {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  end.setDate(end.getDate() - 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '';
  }
  const startLabel = ANNOUNCE_START_FORMATTER.format(start);
  const endLabel = ANNOUNCE_END_FORMATTER.format(end);
  return `${startLabel}〜${endLabel}の週を表示`;
};

export type ScheduleEditDialogValues = (Omit<CreateScheduleEventInput, 'statusReason'> & { statusReason: string }) & {
  id: string;
};

export const buildCreateDialogIntent = (category: ScheduleCategory, start: Date, end: Date): DialogIntentParams => ({
  mode: 'create',
  category,
  dateIso: toDateIso(start),
  startTime: formatTimePart(start),
  endTime: formatTimePart(end),
  eventId: null,
});

export const buildUpdateInput = (eventId: string, input: CreateScheduleEventInput): UpdateScheduleEventInput => ({
  ...input,
  id: eventId,
  title: input.title.trim() || '予定',
});

export const toDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type SchedulesPageState = {
  route: ReturnType<typeof useWeekPageRouteState>;
  mode: ReturnType<typeof useWeekPageRouteState>['mode'];
  categoryFilter: ReturnType<typeof useWeekPageRouteState>['filter']['category'];
  query: ReturnType<typeof useWeekPageRouteState>['filter']['query'];
  canEdit: boolean;
  canEditByRole: boolean;
  myUpn: string;
  ready: boolean;
  focusDate: Date;
  weekRange: ReturnType<typeof makeRange>;
  monthRange: ReturnType<typeof makeRange>;
  items: SchedItem[];
  isLoading: boolean;
  create: ReturnType<typeof useSchedules>['create'];
  update: ReturnType<typeof useSchedules>['update'];
  remove: ReturnType<typeof useSchedules>['remove'];
  lastError: ReturnType<typeof useSchedules>['lastError'];
  clearLastError: ReturnType<typeof useSchedules>['clearLastError'];
  refetch: ReturnType<typeof useSchedules>['refetch'];
  readOnlyReason?: SchedulesErrorInfo;
  canWrite: boolean;
  filteredItems: SchedItem[];
  dialogIntent: DialogIntentParams | null;
  dialogMode: WeekDialogMode;
  dialogEventId: string | null;
  createDialogOpen: boolean;
  createDialogInitialDate: Date | string | undefined;
  createDialogInitialStartTime: string | undefined;
  createDialogInitialEndTime: string | undefined;
  scheduleDialogModeProps:
    | { mode: 'edit'; eventId: string; initialOverride: Partial<ScheduleFormState> }
    | { mode: 'create'; initialOverride: Partial<ScheduleFormState> | undefined };
  weekLabel: string;
  weekAnnouncement: string;
};

type SchedulesPageStateOptions = {
  myUpn: string;
  canEditByRole: boolean;
  ready: boolean;
};

export const useSchedulesPageState = ({ myUpn, canEditByRole, ready }: SchedulesPageStateOptions): SchedulesPageState => {
  const route = useWeekPageRouteState();
  const mode = route.mode;
  const categoryFilter = route.filter.category;
  const query = route.filter.query;
  const canEdit = (mode === 'day' || mode === 'week') && canEditByRole;

  const focusDate = route.focusDate;
  const weekRange = useMemo(() => {
    const start = startOfWeek(focusDate);
    return makeRange(start, endOfWeek(start));
  }, [focusDate]);

  const monthRange = useMemo(() => {
    const anchor = startOfMonth(focusDate);
    const from = startOfCalendar(anchor);
    const to = endOfCalendar(from);
    return makeRange(from, to);
  }, [focusDate]);

  const dataRange = mode === 'month' ? monthRange : weekRange;
  const { items, loading: isLoading, create, update, remove, lastError, clearLastError, refetch, readOnlyReason, canWrite } = useSchedules(dataRange);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!needle) return true;
      const haystack = [
        item.title,
        item.notes,
        item.location,
        item.subType,
        item.serviceType,
        Array.isArray(item.staffNames) ? item.staffNames.join(' ') : '',
        item.personName ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, categoryFilter, query]);

  const dialogIntent = route.dialogIntent;
  const dialogMode = (dialogIntent?.mode ?? 'create') as WeekDialogMode;
  const dialogEventId = dialogIntent?.eventId ?? null;
  const isEditMode = dialogMode === 'edit';
  const editingItem: SchedItem | null = useMemo(() => {
    if (!isEditMode || !dialogEventId) {
      return null;
    }
    return items.find((candidate) => candidate.id === dialogEventId) ?? null;
  }, [dialogEventId, isEditMode, items]);

  const createDialogOverride: Partial<ScheduleFormState> | null = useMemo(() => {
    if (!dialogIntent) {
      return null;
    }

    if (isEditMode && editingItem) {
      return {
        category: (editingItem.category as ScheduleCategory) ?? dialogIntent.category,
        title: editingItem.title,
        userId: editingItem.userId ?? '',
        serviceType: (editingItem.serviceType as ScheduleFormState['serviceType']) ?? '',
        locationName: editingItem.locationName ?? editingItem.location ?? '',
        notes: editingItem.notes ?? '',
        assignedStaffId: editingItem.assignedStaffId ?? '',
        vehicleId: editingItem.vehicleId ?? '',
        status: (editingItem.status as ScheduleFormState['status']) ?? 'Planned',
        statusReason: editingItem.statusReason ?? '',
      } satisfies Partial<ScheduleFormState>;
    }

    return { category: dialogIntent.category } satisfies Partial<ScheduleFormState>;
  }, [dialogIntent, editingItem, isEditMode]);

  const scheduleDialogModeProps = useMemo(() => {
    if (isEditMode && dialogEventId) {
      return {
        mode: 'edit' as const,
        eventId: dialogEventId,
        initialOverride:
          createDialogOverride ??
          ({
            category: dialogIntent?.category ?? 'User',
          } satisfies Partial<ScheduleFormState>),
      };
    }
    return {
      mode: 'create' as const,
      initialOverride: createDialogOverride ?? undefined,
    };
  }, [createDialogOverride, dialogEventId, dialogIntent?.category, isEditMode]);

  const weekLabel = useMemo(
    () => formatRangeLabel(weekRange.from, weekRange.to),
    [weekRange.from, weekRange.to],
  );

  const weekAnnouncement = useMemo(
    () => formatWeekAnnouncement(weekRange.from, weekRange.to),
    [weekRange.from, weekRange.to],
  );

  return {
    route,
    mode,
    categoryFilter,
    query,
    canEdit,
    canEditByRole,
    myUpn,
    ready,
    focusDate,
    weekRange,
    monthRange,
    items,
    isLoading,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
    filteredItems,
    dialogIntent,
    dialogMode,
    dialogEventId,
    createDialogOpen: Boolean(dialogIntent),
    createDialogInitialDate: dialogIntent?.dateIso,
    createDialogInitialStartTime: dialogIntent?.startTime,
    createDialogInitialEndTime: dialogIntent?.endTime,
    scheduleDialogModeProps,
    weekLabel,
    weekAnnouncement,
    readOnlyReason,
    canWrite,
  };
};
