import { type CSSProperties, type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Snackbar } from '@mui/material';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { isDev } from '@/env';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { MASTER_SCHEDULE_TITLE_JA } from '@/features/schedule/constants';
import { ensureDateParam, normalizeToDayStart, pickDateParam } from '@/features/schedule/dateQuery';
import type { Category } from '@/features/schedule/types';
import ScheduleCreateDialog, { type CreateScheduleEventInput, type ScheduleFormState } from '@/features/schedules/ScheduleCreateDialog';
import ScheduleEmptyHint from '@/features/schedules/components/ScheduleEmptyHint';
import SchedulesFilterResponsive from '@/features/schedules/components/SchedulesFilterResponsive';
import SchedulesHeader from '@/features/schedules/components/SchedulesHeader';
import type { SchedItem, ScheduleServiceType, UpdateScheduleEventInput } from '@/features/schedules/data';
import type { InlineScheduleDraft } from '@/features/schedules/data/inlineScheduleDraft';
import { useScheduleUserOptions } from '@/features/schedules/useScheduleUserOptions';
import { makeRange, useSchedules } from '@/features/schedules/useSchedules';
import { TESTIDS } from '@/testids';
import EmptyState from '@/ui/components/EmptyState';
import Loading from '@/ui/components/Loading';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveSchedulesTz } from '@/utils/scheduleTz';

import DayView from './DayView';
import WeekView from './WeekView';
import MonthPage from './MonthPage';
import WeekTimeline, { type WeekTimelineCreateHint } from './views/WeekTimeline';

type ScheduleTab = 'week' | 'day' | 'timeline' | 'month';
const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '11:00';
const SCHEDULES_TZ = resolveSchedulesTz();

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

const extractDatePart = (value?: string | null): string => {
  if (!value) return '';
  return value.slice(0, 10);
};

const extractTimePart = (value?: string | null): string => {
  if (!value || value.length < 16) return '';
  return value.slice(11, 16);
};

const buildLocalDateTimeInput = (value?: string | null, fallbackTime?: string): string => {
  const dateIso = extractDatePart(value) || toDateIso(new Date());
  const time = extractTimePart(value) || fallbackTime || DEFAULT_START_TIME;
  return `${dateIso}T${time}`;
};

const formatScheduleLocalInput = (value?: string | null, fallbackTime?: string): string => {
  if (!value) {
    return buildLocalDateTimeInput(value, fallbackTime);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return buildLocalDateTimeInput(value, fallbackTime);
  }
  return formatInTimeZone(parsed, SCHEDULES_TZ, "yyyy-MM-dd'T'HH:mm");
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

type DialogMode = 'create' | 'edit';

type DialogIntentParams = {
  mode: DialogMode;
  category: Category;
  dateIso: string;
  startTime: string;
  endTime: string;
  eventId?: string | null;
};

type ScheduleEditDialogValues = (Omit<CreateScheduleEventInput, 'statusReason'> & { statusReason: string }) & {
  id: string;
};

const buildCreateDialogIntent = (category: Category, start: Date, end: Date): DialogIntentParams => ({
  mode: 'create',
  category,
  dateIso: toDateIso(start),
  startTime: formatTimePart(start),
  endTime: formatTimePart(end),
  eventId: null,
});

const buildUpdateInput = (eventId: string, input: CreateScheduleEventInput): UpdateScheduleEventInput => ({
  ...input,
  id: eventId,
  title: input.title.trim() || '新規予定',
});

const resolveDialogIntent = (params: URLSearchParams): DialogIntentParams | null => {
  const mode = params.get('dialog') as DialogMode | null;
  if (mode !== 'create' && mode !== 'edit') {
    return null;
  }
  const dateIso = params.get('dialogDate');
  if (!dateIso) {
    return null;
  }
  const startTime = params.get('dialogStart') ?? DEFAULT_START_TIME;
  const endTime = params.get('dialogEnd') ?? DEFAULT_END_TIME;
  const category = (params.get('dialogCategory') as Category) ?? 'User';
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

// Tracks whether the FAB should reclaim focus after the dialog closes across route remounts.
let pendingFabFocus = false;


const LEGACY_TABS = ['day', 'week', 'timeline', 'month'] as const;
type LegacyTab = typeof LEGACY_TABS[number];

export default function WeekPage() {
  const announce = useAnnounce();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Legacy ?tab= redirect (互換性のため)
  // Only redirect if this came from external navigation (e.g., bookmarks)
  // Don't redirect if we're already properly handling it via query param fallback
  useEffect(() => {
    const legacyTab = searchParams.get('tab');
    if (!legacyTab) return;
    
    // Skip redirect if we're already on /schedules/week with a valid tab param
    // This prevents redirect loops during tab switching
    if (location.pathname === '/schedules/week' && LEGACY_TABS.includes(legacyTab as LegacyTab)) {
      // Query param is already set, no need to redirect
      return;
    }
    
    const map: Record<LegacyTab, string> = {
      day: '/schedules/day',
      week: '/schedules/week',
      timeline: '/schedules/timeline',
      month: '/schedules/month',
    };
    const target = map[legacyTab as LegacyTab];
    if (target) navigate(target, { replace: true });
  }, [searchParams, navigate, location.pathname]);
  
  const [snack, setSnack] = useState<{
    open: boolean;
    severity: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>({ open: false, severity: 'info', message: '' });

  const showSnack = useCallback(
    (severity: 'success' | 'error' | 'info' | 'warning', message: string) =>
      setSnack({ open: true, severity, message }),
    []
  );
  
  // Route から mode を決定（useMatch で堅牢化）
  // First check URL path (when navigation completes), then fall back to query param (during redirect)
  const dayMatch = useMatch('/schedules/day/*');
  const timelineMatch = useMatch('/schedules/timeline/*');
  const monthMatch = useMatch('/schedules/month/*');
  
  // Fallback to query parameter for backward compatibility with redirects
  const tabParam = searchParams.get('tab') as ScheduleTab | null;
  
  const mode: ScheduleTab = dayMatch
    ? 'day'
    : timelineMatch
      ? 'timeline'
      : monthMatch
        ? 'month'
        : tabParam && LEGACY_TABS.includes(tabParam as LegacyTab)
          ? (tabParam as ScheduleTab)
          : 'week';
  const [categoryFilter, setCategoryFilter] = useState<'All' | Category>('All');
  const [query, setQuery] = useState('');
  
  // Authorization check for Day view editing
  const { account } = useAuth();
  const myUpn = (account?.username ?? '').trim().toLowerCase();
  const { isReception, isAdmin, ready } = useUserAuthz();
  const canEditByRole = ready && (isReception || isAdmin);
  const canEdit = mode === 'day' && canEditByRole; // FAB (create) = reception/admin only
  
  const rawDateParam = useMemo(() => pickDateParam(searchParams), [searchParams]);
  const focusDate = useMemo(() => normalizeToDayStart(rawDateParam), [rawDateParam]);
  const [activeDateIso, setActiveDateIso] = useState<string | null>(() => toDateIso(focusDate));
  const scheduleUserOptions = useScheduleUserOptions();
  const defaultScheduleUser = scheduleUserOptions.length ? scheduleUserOptions[0] : null;
  const dialogIntent = useMemo(() => resolveDialogIntent(searchParams), [searchParams]);
  const createDialogOpen = Boolean(dialogIntent);
  const createDialogInitialDate: Date | string | undefined = dialogIntent?.dateIso;
  const createDialogInitialStartTime = dialogIntent?.startTime;
  const createDialogInitialEndTime = dialogIntent?.endTime;
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialValues, setDialogInitialValues] = useState<ScheduleEditDialogValues | null>(null);

  useEffect(() => {
    if (!createDialogOpen && pendingFabFocus && fabRef.current) {
      fabRef.current.focus();
      pendingFabFocus = false;
      return;
    }
    if (createDialogOpen) {
      pendingFabFocus = false;
    }
  }, [createDialogOpen]);
  const headingId = useId();
  const rangeDescriptionId = 'schedules-week-range';
  const weekRange = useMemo(() => {
    const start = startOfWeek(focusDate);
    return makeRange(start, endOfWeek(start));
  }, [focusDate]);
  const { items, loading: isLoading, create, update, remove } = useSchedules(weekRange);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!needle) return true;
      const haystack = [
        item.title,
        item.note ?? item.notes,
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
  const dialogMode: DialogMode = dialogIntent?.mode ?? 'create';
  const isEditMode = dialogMode === 'edit';
  const dialogEventId = dialogIntent?.eventId ?? null;
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
        category: (editingItem.category as Category) ?? dialogIntent.category,
        title: editingItem.title,
        userId: editingItem.userId ?? '',
        serviceType: (editingItem.serviceType as ScheduleFormState['serviceType']) ?? '',
        locationName: editingItem.locationName ?? editingItem.location ?? '',
        notes: editingItem.notes ?? editingItem.note ?? '',
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

  const primeRouteReset = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const scope = window as typeof window & { __suppressRouteReset__?: boolean };
    scope.__suppressRouteReset__ = true;
  }, []);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const hasDay = searchParams.has('day');
    const hasWeek = searchParams.has('week');
    const needsNormalization = !dateParam || hasDay || hasWeek;

    if (!needsNormalization) {
      return;
    }

    const source = dateParam ?? rawDateParam;
    const normalized = source ? normalizeToDayStart(source) : focusDate;
    const next = ensureDateParam(searchParams, normalized);
    setSearchParams(next, { replace: true });
  }, [focusDate, rawDateParam, searchParams, setSearchParams]);

  useEffect(() => {
    const nextIso = toDateIso(focusDate);
    setActiveDateIso((prev) => (prev === nextIso ? prev : nextIso));
  }, [focusDate]);

  useEffect(() => {
    if (!weekAnnouncement) {
      return;
    }
    announce(weekAnnouncement);
  }, [announce, weekAnnouncement]);

  const syncDateParam = useCallback(
    (dateIso: string) => {
      const normalizedDate = normalizeToDayStart(dateIso);
      const next = ensureDateParam(searchParams, normalizedDate);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleDayClick = useCallback(
    (dayIso: string, _event?: MouseEvent<HTMLButtonElement>) => {
      setActiveDateIso(dayIso);
      primeRouteReset();
      syncDateParam(dayIso);
    },
    [primeRouteReset, syncDateParam],
  );

  const defaultDateIso = weekRange.from.slice(0, 10);
  const resolvedActiveDateIso = activeDateIso ?? defaultDateIso;
  const dayViewHref = useMemo(
    () => `/schedules/day?date=${resolvedActiveDateIso}`,
    [resolvedActiveDateIso],
  );
  const weekViewHref = useMemo(
    () => `/schedules/week?date=${resolvedActiveDateIso}`,
    [resolvedActiveDateIso],
  );
  const monthViewHref = useMemo(
    () => `/schedules/month?date=${resolvedActiveDateIso}`,
    [resolvedActiveDateIso],
  );
  const activeDayRange = useMemo(() => {
    const start = new Date(`${resolvedActiveDateIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return makeRange(start, end);
  }, [resolvedActiveDateIso]);

  const handleFabClick = useCallback(
    (_event?: MouseEvent<HTMLButtonElement>) => {
      if (!canEdit) return; // Guard: Day tab + authorized users only
      
      const iso = activeDateIso ?? defaultDateIso;
      if (!activeDateIso) {
        setActiveDateIso(iso);
      }
      primeRouteReset();
      const start = new Date(`${iso}T${DEFAULT_START_TIME}`);
      const end = new Date(`${iso}T${DEFAULT_END_TIME}`);
      setDialogParams(buildCreateDialogIntent('User', start, end));
    },
    [canEdit, activeDateIso, defaultDateIso, primeRouteReset, setDialogParams],
  );

  const handleWeekEventClick = useCallback((item: SchedItem) => {
    console.info('[WeekPage] row click', item.id);

    // Authorization check: reception/admin OR assignee (Day view only)
    if (mode === 'day' && ready) {
      const assignedNormalized = (item.assignedTo ?? '').trim().toLowerCase();
      const hasAssignee = Boolean(assignedNormalized);
      const myUpnNormalized = (myUpn ?? '').trim().toLowerCase();
      const isAssignee = Boolean(myUpnNormalized) && assignedNormalized === myUpnNormalized;
      const canEditItem = canEditByRole || isAssignee;
      if (!canEditItem) {
        if (isDev) {
          console.warn('[WeekPage] Edit blocked: not authorized', { myUpn, assignedTo: item.assignedTo });
        }
        if (hasAssignee && !isAssignee) {
          showSnack('info', 'この予定は担当者のみ編集できます');
        } else {
          showSnack('info', '受付/管理者のみ編集できます');
        }
        return;
      }
    }

    const category = (item.category as Category) ?? 'User';
    const serviceType = (item.serviceType as ScheduleServiceType) ?? 'normal';
    const startLocal = formatScheduleLocalInput(item.start, DEFAULT_START_TIME);
    const endLocal = formatScheduleLocalInput(item.end, DEFAULT_END_TIME);
    const dateIso = extractDatePart(item.start) || toDateIso(new Date());
    setActiveDateIso(dateIso);
    setDialogInitialValues({
      id: item.id,
      title: item.title ?? '',
      category,
      startLocal,
      endLocal,
      serviceType,
      userId: item.userId ?? '',
      assignedStaffId: item.assignedStaffId ?? '',
      locationName: item.locationName ?? item.location ?? '',
      notes: item.notes ?? item.note ?? '',
      vehicleId: item.vehicleId ?? '',
      status: item.status ?? 'Planned',
      statusReason: item.statusReason ?? '',
    });
    setDialogOpen(true);
  }, [mode, ready, canEditByRole, myUpn, showSnack]);

  const clearInlineSelection = useCallback(() => {
    setDialogOpen(false);
    setDialogInitialValues(null);
  }, []);

  const handleInlineDialogClose = useCallback(() => {
    clearInlineSelection();
  }, [clearInlineSelection]);

  const inlineEditingEventId = dialogInitialValues?.id ?? null;

  const handleInlineDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (!inlineEditingEventId) {
        return;
      }
      const payload = buildUpdateInput(inlineEditingEventId, input);
      try {
        await update(payload);
        showSnack('success', '予定を更新しました');
        clearInlineSelection();
      } catch (e) {
        showSnack('error', '更新に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      }
    },
    [clearInlineSelection, inlineEditingEventId, showSnack, update],
  );

  const handleInlineDialogDelete = useCallback(
    async (eventId: string) => {
      try {
        await remove(eventId);
        showSnack('success', '予定を削除しました');
        clearInlineSelection();
      } catch (e) {
        showSnack('error', '削除に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      }
    },
    [clearInlineSelection, remove, showSnack],
  );

  const handleTimelineCreateHint = useCallback(
    (hint: WeekTimelineCreateHint) => {
      const baseDay = new Date(hint.day);
      const start = new Date(baseDay);
      start.setHours(hint.hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1, 0, 0, 0);
      const dayIso = toDateIso(start);
      setActiveDateIso(dayIso);
      primeRouteReset();
      setDialogParams(buildCreateDialogIntent(hint.category as Category, start, end));
    },
    [primeRouteReset, setDialogParams],
  );

  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      const baseIso = searchParams.get('date') ?? toDateIso(focusDate);
      const base = new Date(`${baseIso}T00:00:00Z`);
      base.setDate(base.getDate() + deltaWeeks * 7);
      const iso = toDateIso(base);
      setActiveDateIso(iso);
      primeRouteReset();
      syncDateParam(iso);
    },
    [focusDate, primeRouteReset, searchParams, syncDateParam],
  );

  const handlePrevWeek = useCallback(() => {
    shiftWeek(-1);
  }, [shiftWeek]);

  const handleNextWeek = useCallback(() => {
    shiftWeek(1);
  }, [shiftWeek]);

  const handleTodayWeek = useCallback(() => {
    const todayIso = toDateIso(new Date());
    setActiveDateIso(todayIso);
    primeRouteReset();
    syncDateParam(todayIso);
  }, [primeRouteReset, syncDateParam]);

  const handleScheduleDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (dialogMode === 'edit' && dialogEventId) {
        const payload = buildUpdateInput(dialogEventId, input);
        await update(payload);
        return;
      }

      const dateIso = extractDatePart(input.startLocal) || toDateIso(new Date());
      const startTime = extractTimePart(input.startLocal) || DEFAULT_START_TIME;
      const endTime = extractTimePart(input.endLocal) || DEFAULT_END_TIME;


      const start = new Date(buildLocalDateTimeInput(input.startLocal, startTime)).toISOString();
      const end = new Date(buildLocalDateTimeInput(input.endLocal, endTime)).toISOString();
      const draft: InlineScheduleDraft = {
        title: input.title.trim() || '新規予定',
        dateIso,
        startTime,
        endTime,
        start,
        end,
        sourceInput: input,
      };

      await create(draft);
    },
    [create, dialogEventId, dialogMode, update],
  );

  const handleCreateDialogClose = useCallback(() => {
    pendingFabFocus = true;
    primeRouteReset();
    clearDialogParams();
  }, [clearDialogParams, primeRouteReset]);

  const showEmptyHint = !isLoading && filteredItems.length === 0;


  return (
    <section
      aria-label="週間スケジュール"
      aria-describedby={rangeDescriptionId}
      aria-labelledby={headingId}
      data-testid="schedules-week-page"
      tabIndex={-1}
      style={{ paddingBottom: 16 }}
    >
      <div
        className="schedule-sticky"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(6px)',
          paddingTop: 8,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <span hidden>週間スケジュール</span>
        {/* Tab-aware header content */}
        {(() => {
          // Compute monthLabel for month view
          const monthDate = new Date(`${resolvedActiveDateIso}T00:00:00`);
          const monthLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(monthDate);

          // Determine subLabel and periodLabel based on current view mode
          const headerSubLabel =
            mode === 'day'
              ? '日表示（本日の予定）'
              : mode === 'month'
                ? '月表示（全体カレンダー）'
                : mode === 'timeline'
                  ? 'タイムライン（週間）'
                  : '週表示（週間の予定一覧）';

          const headerPeriodLabel =
            mode === 'month'
              ? `表示月: ${monthLabel}`
              : mode === 'day'
                ? `表示期間: ${new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(monthDate)}`
                : `表示期間: ${weekLabel}`;

          return (
            <>
              <SchedulesHeader
                mode={mode}
                title={MASTER_SCHEDULE_TITLE_JA}
                subLabel={headerSubLabel}
                periodLabel={headerPeriodLabel}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
          onToday={handleTodayWeek}
          onPrimaryCreate={canEdit ? handleFabClick : undefined}
          primaryActionAriaLabel="この週に新規予定を作成"
          headingId={headingId}
          titleTestId={TESTIDS['schedules-week-heading']}
          rangeLabelId={rangeDescriptionId}
          dayHref={dayViewHref}
          weekHref={weekViewHref}
          timelineHref={`/schedules/timeline?date=${resolvedActiveDateIso}`}
          monthHref={monthViewHref}
          modes={[ 'day', 'week', 'timeline', 'month' ]}
          prevTestId={TESTIDS.SCHEDULES_PREV_WEEK}
          nextTestId={TESTIDS.SCHEDULES_NEXT_WEEK}
        >
          <SchedulesFilterResponsive
            inlineStackProps={{
              sx: { mt: { xs: 0.5, sm: 0 }, minWidth: 260 },
              spacing: 0.5,
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>絞り込み</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                カテゴリ:
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'All' | Category)}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
                  data-testid={TESTIDS['schedules-filter-category']}
                >
                  <option value="All">すべて</option>
                  <option value="User">利用者</option>
                  <option value="Staff">職員</option>
                  <option value="Org">事業所</option>
                </select>
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="タイトル/場所/担当/利用者で検索"
                style={{
                  flex: '1 1 280px',
                  minWidth: 240,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.2)',
                }}
                aria-label="スケジュール検索"
                data-testid={TESTIDS['schedules-filter-query']}
              />
            </div>
          </SchedulesFilterResponsive>
        </SchedulesHeader>
            </>
          );
        })()}
      </div>

      <div>
        {showEmptyHint ? (
          <ScheduleEmptyHint view="week" periodLabel={weekLabel} sx={{ mb: 2 }} />
        ) : null}
        {isLoading ? (
          <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 12 }}>
            <Loading />
            <div style={skeletonStyle} />
            <div style={skeletonStyle} />
            <div style={skeletonStyle} />
          </div>
        ) : (
          <>
            {mode === 'week' && (
              <WeekView
                items={filteredItems}
                loading={isLoading}
                range={weekRange}
                onDayClick={handleDayClick}
                activeDateIso={resolvedActiveDateIso}
                onItemSelect={handleWeekEventClick}
              />
            )}
            {mode === 'day' && (
              <DayView items={filteredItems} loading={isLoading} range={activeDayRange} />
            )}
            {mode === 'timeline' && (
              <WeekTimeline range={weekRange} items={filteredItems} onCreateHint={handleTimelineCreateHint} />
            )}
            {mode === 'month' && (
              <MonthPage />
            )}
            {filteredItems.length === 0 && (
              <EmptyState
                title="今週の予定はありません"
                description="別の日付や条件で再度お試しください。"
                data-testid="schedule-empty"
              />
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleFabClick}
        data-testid={TESTIDS.SCHEDULES_FAB_CREATE}
        ref={fabRef}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: '#1976d2',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          fontSize: 32,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 1300,
        }}
        aria-label={
          resolvedActiveDateIso
            ? `選択中の日に予定を追加 (${resolvedActiveDateIso})`
            : 'この週に新しい予定を追加'
        }
      >
        +
      </button>
      {dialogInitialValues ? (
        <ScheduleCreateDialog
          open={dialogOpen}
          mode="edit"
          eventId={dialogInitialValues.id}
          initialOverride={{
            ...dialogInitialValues,
            serviceType:
              dialogInitialValues.serviceType === null || dialogInitialValues.serviceType === undefined
                ? ""
                : dialogInitialValues.serviceType,
          }}
          onClose={handleInlineDialogClose}
          onSubmit={handleInlineDialogSubmit}
          onDelete={handleInlineDialogDelete}
          users={scheduleUserOptions}
          defaultUser={defaultScheduleUser ?? undefined}
        />
      ) : null}
      <ScheduleCreateDialog
        open={createDialogOpen}
        onClose={handleCreateDialogClose}
        onSubmit={handleScheduleDialogSubmit}
        users={scheduleUserOptions}
        initialDate={createDialogInitialDate}
        initialStartTime={createDialogInitialStartTime}
        initialEndTime={createDialogInitialEndTime}
        defaultUser={defaultScheduleUser ?? undefined}
        {...scheduleDialogModeProps}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </section>
  );
}

const skeletonStyle: CSSProperties = {
  height: 16,
  borderRadius: 8,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.06) 63%)',
  animation: 'shine 1.4s ease infinite',
};

const toDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
