import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMsalContext } from '@/auth/MsalProvider';
import { type CSSProperties, type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
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

import DayView from './DayView';
import WeekView from './WeekView';
import WeekTimeline, { type WeekTimelineCreateHint } from './views/WeekTimeline';

type ScheduleTab = 'week' | 'day' | 'timeline';

const TAB_LABELS: Record<ScheduleTab, string> = {
  week: '週',
  day: '日',
  timeline: 'タイムライン',
};

const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '11:00';

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


export default function WeekPage() {
  const announce = useAnnounce();
  const { instance, accounts } = useMsalContext();
  const currentUserLabel = useMemo(() => {
    const account =
      (instance.getActiveAccount() as { name?: string; username?: string } | null) ??
      (accounts[0] as { name?: string; username?: string } | undefined) ??
      null;
    return account?.name || account?.username || '';
  }, [accounts, instance]);
  const [tab, setTab] = useState<ScheduleTab>('week');
  const [categoryFilter, setCategoryFilter] = useState<'All' | Category>('All');
  const [query, setQuery] = useState('');
  const [showAcceptedOnly, setShowAcceptedOnly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<SchedItem | null>(null);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [acceptForm, setAcceptForm] = useState<{ acceptedOn: string; acceptedBy: string; acceptedNote: string }>(
    () => ({ acceptedOn: '', acceptedBy: '', acceptedNote: '' }),
  );

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
  const tablistId = useId();
  const rangeDescriptionId = 'schedules-week-range';
  const weekRange = useMemo(() => {
    const start = startOfWeek(focusDate);
    return makeRange(start, endOfWeek(start));
  }, [focusDate]);
  const { items, loading: isLoading, create, update } = useSchedules(weekRange);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (showAcceptedOnly && !(item.acceptedOn || item.acceptedBy || item.acceptedNote)) {
        return false;
      }
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
  }, [items, categoryFilter, query, showAcceptedOnly]);
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

  const tabButtonIds: Record<ScheduleTab, string> = {
    week: `${tablistId}-tab-week`,
    day: `${tablistId}-tab-day`,
    timeline: `${tablistId}-tab-timeline`,
  };

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
      const iso = activeDateIso ?? defaultDateIso;
      if (!activeDateIso) {
        setActiveDateIso(iso);
      }
      primeRouteReset();
      const start = new Date(`${iso}T${DEFAULT_START_TIME}`);
      const end = new Date(`${iso}T${DEFAULT_END_TIME}`);
      setDialogParams(buildCreateDialogIntent('User', start, end));
    },
    [activeDateIso, defaultDateIso, primeRouteReset, setDialogParams],
  );

  const handleWeekEventClick = useCallback((item: SchedItem) => {
    console.info('[WeekPage] row click', item.id);
    const category = (item.category as Category) ?? 'User';
    const serviceType = (item.serviceType as ScheduleServiceType) ?? 'other';
    const startLocal = buildLocalDateTimeInput(item.start, DEFAULT_START_TIME);
    const endLocal = buildLocalDateTimeInput(item.end, DEFAULT_END_TIME);
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
      notes: item.notes ?? '',
      vehicleId: item.vehicleId ?? '',
      status: item.status ?? 'Planned',
      statusReason: item.statusReason ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleOpenAcceptDialog = useCallback((item: SchedItem) => {
    const fallbackTime = formatTimePart(new Date());
    setAcceptTarget(item);
    setAcceptForm({
      acceptedOn: buildLocalDateTimeInput(item.acceptedOn, fallbackTime),
      acceptedBy: item.acceptedBy ?? currentUserLabel,
      acceptedNote: item.acceptedNote ?? '',
    });
    setAcceptDialogOpen(true);
  }, [currentUserLabel]);

  const handleCloseAcceptDialog = useCallback(() => {
    setAcceptDialogOpen(false);
    setAcceptTarget(null);
  }, []);

  const handleAcceptFieldChange = useCallback(
    (field: 'acceptedOn' | 'acceptedBy' | 'acceptedNote', value: string) => {
      setAcceptForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmitAccept = useCallback(async () => {
    if (!acceptTarget) return;

    const acceptedOn = acceptForm.acceptedOn?.trim();
    const acceptedBy = acceptForm.acceptedBy?.trim();
    const acceptedNote = acceptForm.acceptedNote?.trim();
    const startLocal = acceptTarget.start || buildLocalDateTimeInput(undefined, DEFAULT_START_TIME);
    const endLocal = acceptTarget.end || startLocal;

    const payload: UpdateScheduleEventInput = {
      id: acceptTarget.id,
      title: acceptTarget.title ?? '新規予定',
      category: (acceptTarget.category as Category) ?? 'User',
      startLocal,
      endLocal,
      serviceType: (acceptTarget.serviceType as ScheduleServiceType) ?? 'other',
      userId: acceptTarget.userId ?? undefined,
      userLookupId: acceptTarget.userLookupId,
      userName: acceptTarget.personName ?? undefined,
      locationName: acceptTarget.locationName ?? acceptTarget.location ?? undefined,
      notes: acceptTarget.notes ?? acceptTarget.note ?? undefined,
      assignedStaffId: acceptTarget.assignedStaffId ?? undefined,
      vehicleId: acceptTarget.vehicleId ?? undefined,
      status: acceptTarget.status ?? 'Planned',
      statusReason: acceptTarget.statusReason ?? null,
      acceptedOn: acceptedOn || undefined,
      acceptedBy: acceptedBy || undefined,
      acceptedNote: acceptedNote || null,
    };

    setAcceptSubmitting(true);
    try {
      await update(payload);
      setAcceptDialogOpen(false);
      setAcceptTarget(null);
    } finally {
      setAcceptSubmitting(false);
    }
  }, [acceptForm.acceptedBy, acceptForm.acceptedNote, acceptForm.acceptedOn, acceptTarget, update]);

  const handleInlineDialogClose = useCallback(() => {
    setDialogOpen(false);
    setDialogInitialValues(null);
  }, []);

  const inlineEditingEventId = dialogInitialValues?.id ?? null;

  const handleInlineDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (!inlineEditingEventId) {
        return;
      }
      const payload = buildUpdateInput(inlineEditingEventId, input);
      await update(payload);
      setDialogOpen(false);
      setDialogInitialValues(null);
    },
    [inlineEditingEventId, update],
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

      const draft: InlineScheduleDraft = {
        title: input.title.trim() || '新規予定',
        start: input.startLocal,
        end: input.endLocal,
        serviceType: input.serviceType,
        notes: input.notes,
        dateIso,
        startTime,
        endTime,
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
      data-testid={TESTIDS['schedules-week-page']}
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
        <SchedulesHeader
          mode="week"
          title={MASTER_SCHEDULE_TITLE_JA}
          subLabel="週表示（週間の予定一覧）"
          periodLabel={`表示期間: ${weekLabel}`}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
          onToday={handleTodayWeek}
          onPrimaryCreate={handleFabClick}
          primaryActionAriaLabel="この週に新規予定を作成"
          headingId={headingId}
          titleTestId={TESTIDS['schedules-week-heading']}
          rangeLabelId={rangeDescriptionId}
          dayHref={dayViewHref}
          weekHref={weekViewHref}
          monthHref={monthViewHref}
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
                placeholder="タイトル／場所／担当／利用者で検索"
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
              <Chip
                label="受け入れ済のみ"
                variant={showAcceptedOnly ? 'filled' : 'outlined'}
                color={showAcceptedOnly ? 'success' : 'default'}
                size="small"
                onClick={() => setShowAcceptedOnly((prev) => !prev)}
                aria-pressed={showAcceptedOnly}
                data-testid="schedules-filter-accepted"
              />
            </div>
          </SchedulesFilterResponsive>
        </SchedulesHeader>

        <div
          id={tablistId}
          role="tablist"
          aria-label="スケジュールビュー切り替え"
          style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}
          data-testid={TESTIDS.SCHEDULES_WEEK_TABLIST}
        >
          {(Object.keys(TAB_LABELS) as ScheduleTab[]).map((key) => {
            const isActive = tab === key;
            const tabTestId =
              key === 'week'
                ? TESTIDS.SCHEDULES_WEEK_TAB_WEEK
                : key === 'day'
                  ? TESTIDS.SCHEDULES_WEEK_TAB_DAY
                  : TESTIDS.SCHEDULES_WEEK_TAB_TIMELINE;
            return (
              <button
                key={key}
                id={tabButtonIds[key]}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${key}`}
                data-testid={tabTestId}
                onClick={() => setTab(key)}
                style={tabButtonStyle(isActive)}
              >
                {TAB_LABELS[key]}
              </button>
            );
          })}
        </div>
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
            <div
              id="panel-week"
              role="tabpanel"
              aria-labelledby={tabButtonIds.week}
              hidden={tab !== 'week'}
            >
              <WeekView
                items={filteredItems}
                loading={isLoading}
                range={weekRange}
                onDayClick={handleDayClick}
                activeDateIso={resolvedActiveDateIso}
                onItemSelect={handleWeekEventClick}
                onItemAccept={handleOpenAcceptDialog}
              />
            </div>
            <div
              id="panel-day"
              role="tabpanel"
              aria-labelledby={tabButtonIds.day}
              hidden={tab !== 'day'}
            >
              <DayView items={filteredItems} loading={isLoading} range={activeDayRange} />
            </div>
            <div
              id="panel-timeline"
              role="tabpanel"
              aria-labelledby={tabButtonIds.timeline}
              hidden={tab !== 'timeline'}
              data-testid={TESTIDS.SCHEDULES_WEEK_TIMELINE_PANEL}
            >
              <WeekTimeline range={weekRange} items={filteredItems} onCreateHint={handleTimelineCreateHint} />
            </div>
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
      <Dialog open={acceptDialogOpen} onClose={handleCloseAcceptDialog} fullWidth maxWidth="sm">
        <DialogTitle>受け入れ登録</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="受け入れ日時"
              type="datetime-local"
              value={acceptForm.acceptedOn}
              onChange={(event) => handleAcceptFieldChange('acceptedOn', event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="受け入れ担当者"
              value={acceptForm.acceptedBy}
              onChange={(event) => handleAcceptFieldChange('acceptedBy', event.target.value)}
              placeholder="氏名や所属"
              fullWidth
            />
            <TextField
              label="メモ"
              value={acceptForm.acceptedNote}
              onChange={(event) => handleAcceptFieldChange('acceptedNote', event.target.value)}
              placeholder="申し送りや注意点"
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAcceptDialog} disabled={acceptSubmitting}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmitAccept}
            variant="contained"
            disabled={!acceptTarget || acceptSubmitting}
            data-testid="schedules-accept-submit"
          >
            {acceptSubmitting ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
      {dialogInitialValues ? (
        <ScheduleCreateDialog
          open={dialogOpen}
          mode="edit"
          eventId={dialogInitialValues.id}
          initialOverride={dialogInitialValues}
          onClose={handleInlineDialogClose}
          onSubmit={handleInlineDialogSubmit}
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
    </section>
  );
}

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 999,
  border: active ? '1px solid rgba(25,118,210,0.7)' : '1px solid rgba(0,0,0,0.18)',
  background: active ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.8)',
  fontWeight: active ? 700 : 500,
  fontSize: 13,
  color: active ? 'rgba(25,118,210,0.95)' : 'rgba(0,0,0,0.7)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
});

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
