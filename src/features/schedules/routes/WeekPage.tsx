import { Alert, AlertTitle, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Stack, Typography } from '@mui/material';
import { type CSSProperties, type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { useBreakpointFlags, useOrientation } from '@/app/LayoutContext';
import { canAccess } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { isDev } from '@/env';
import { type SpSyncStatus } from '@/features/dashboard/types/hub';
import { buildSpLaneModel } from '@/features/dashboard/useDashboardSummary';
import SchedulesFilterResponsive from '@/features/schedules/components/SchedulesFilterResponsive';
import SchedulesHeader from '@/features/schedules/components/SchedulesHeader';
import { SchedulesSpLane } from '@/features/schedules/components/SchedulesSpLane';
import { MASTER_SCHEDULE_TITLE_JA } from '@/features/schedules/constants';
import type { CreateScheduleEventInput, SchedItem, ScheduleServiceType } from '@/features/schedules/data';
import type { InlineScheduleDraft } from '@/features/schedules/data/inlineScheduleDraft';
import { scheduleCategoryLabels } from '@/features/schedules/domain/categoryLabels';
import type { ScheduleCategory } from '@/features/schedules/domain/types';
import { isSchedulesSpEnabled } from '@/lib/env';
import { TESTIDS } from '@/testids';
import Loading from '@/ui/components/Loading';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import { useScheduleUserOptions } from '../hooks/useScheduleUserOptions';
import { makeRange } from '../hooks/useSchedules';
import { buildCreateDialogIntent, buildLocalDateTimeInput, buildNextSlot, buildUpdateInput, DEFAULT_END_TIME, DEFAULT_START_TIME, extractDatePart, extractTimePart, formatScheduleLocalInput, type ScheduleEditDialogValues, toDateIso, useSchedulesPageState } from '../hooks/useSchedulesPageState';
import { useSchedulesToday } from '../hooks/useSchedulesToday';
import { useWeekPageUiState } from '../hooks/useWeekPageUiState';
import ScheduleCreateDialog from './ScheduleCreateDialog';
import ScheduleViewDialog from './ScheduleViewDialog';

import DayView from './DayView';
import MonthPage from './MonthPage';
import WeekView from './WeekView';


// Tracks whether the FAB should reclaim focus after the dialog closes across route remounts.
let pendingFabFocus = false;


export default function WeekPage() {
  const { isDesktopSize, isTabletSize } = useBreakpointFlags();
  const { isLandscape } = useOrientation();
  const { account } = useAuth();
  const { role, ready } = useUserAuthz();
  const myUpn = useMemo(() => (account?.username ?? '').trim().toLowerCase(), [account?.username]);
  const canEditByRole = ready && canAccess(role, 'reception');
  const schedulesTz = useMemo(() => resolveSchedulesTz(), []);
  const {
    route,
    mode,
    categoryFilter,
    query,
    canEdit,
    focusDate,
    weekRange,
    isLoading,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
    filteredItems,
    dialogMode,
    dialogEventId,
    createDialogOpen,
    createDialogInitialDate,
    createDialogInitialStartTime,
    createDialogInitialEndTime,
    scheduleDialogModeProps,
    weekLabel,
    weekAnnouncement,
    readOnlyReason,
    canWrite,
  } = useSchedulesPageState({ myUpn, canEditByRole, ready });

  // Sync status for SharePoint Lane
  const {
    loading: spLoading,
    error: spError,
    fallbackError: spFallbackError,
    data: spItems,
    source: spSource,
    refetch: spRefetch,
    isFetching: spIsFetching,
    failureCount: spFailureCount,
    retryAfter: spRetryAfter,
    cooldownUntil: spCooldownUntil,
  } = useSchedulesToday(10);

  const spSyncStatus: SpSyncStatus = useMemo(() => ({
    loading: spLoading,
    error: spError || spFallbackError,
    itemCount: spItems.length,
    source: spSource,
    onRetry: spRefetch,
    isFetching: spIsFetching,
    failureCount: spFailureCount,
    retryAfter: spRetryAfter,
    cooldownUntil: spCooldownUntil,
  }), [spLoading, spError, spFallbackError, spItems.length, spSource, spRefetch, spIsFetching, spFailureCount, spRetryAfter, spCooldownUntil]);
  const {
    snack,
    setSnack,
    showSnack,
    isInlineSaving,
    setIsInlineSaving,
    isInlineDeleting,
    setIsInlineDeleting,
    conflictDetailOpen,
    setConflictDetailOpen,
    lastErrorAt,
    setLastErrorAt,
    conflictBusy,
    setConflictBusy,
    focusScheduleId,
    setFocusScheduleId,
    highlightId,
    setHighlightId,
  } = useWeekPageUiState();
  const announce = useAnnounce();

  // View Dialog state (for viewing/editing schedule details)
  const [viewItem, setViewItem] = useState<SchedItem | null>(null);

  // Legacy ?tab= redirect (互換性のため) - DISABLED to prevent infinite redirect loop
  // The tab param is now handled directly in the mode calculation below
  // No need to redirect between routes; WeekPage handles all tabs internally
  // useEffect(() => {
  //   const legacyTab = searchParams.get('tab');
  //   if (!legacyTab) return;
  //
  //   if (location.pathname === '/schedules/week' && LEGACY_TABS.includes(legacyTab as LegacyTab)) {
  //     return;
  //   }
  //
  //   const map: Record<LegacyTab, string> = {
  //     day: '/schedules/day',
  //     week: '/schedules/week',
  //     timeline: '/schedules/timeline',
  //     month: '/schedules/month',
  //   };
  //   const target = map[legacyTab as LegacyTab];
  //   if (target) navigate(target, { replace: true });
  // }, [searchParams, navigate, location.pathname]);

  // FAB (create) = reception/admin only
  const [activeDateIso, setActiveDateIso] = useState<string | null>(() => toDateIso(focusDate));
  const scheduleUserOptions = useScheduleUserOptions();
  const defaultScheduleUser = scheduleUserOptions.length ? scheduleUserOptions[0] : null;
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = searchParams.get('org') ?? 'all';
  const isSchedulesView = location.pathname === '/schedules' || location.pathname.startsWith('/schedules/');
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialValues, setDialogInitialValues] = useState<ScheduleEditDialogValues | null>(null);

  // Suppress route-dialog when view/inline edit is active (防波堤: 詳細/編集中はURL-dialogを開かせない)
  const suppressRouteDialog = Boolean(viewItem) || Boolean(dialogInitialValues);
  const [dayLane, setDayLane] = useState<ScheduleCategory | null>(null);
  const showFab = !isDesktopSize && !isSchedulesView; // Hide FAB in /schedules views
  const compact = isTabletSize && isLandscape;
  const fabInset = `max(24px, calc(env(safe-area-inset-bottom, 0px) + 8px))`;
  const fabInsetRight = `max(24px, calc(env(safe-area-inset-right, 0px) + 8px))`;

  useEffect(() => {
    if (mode === 'day') {
      setDayLane(null);
    }
  }, [mode]);

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
  const setDialogParams = route.setDialogParams;
  const clearDialogParams = route.clearDialogParams;

  const primeRouteReset = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const scope = window as typeof window & { __suppressRouteReset__?: boolean };
    scope.__suppressRouteReset__ = true;
  }, []);

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
      route.setDateIso(dateIso);
    },
    [route.setDateIso],
  );

  const handleDayClick = useCallback(
    (dayIso: string, _event?: MouseEvent<HTMLButtonElement>) => {
      setActiveDateIso(dayIso);
      setDayLane(null);
      primeRouteReset();
      syncDateParam(dayIso);
    },
    [primeRouteReset, syncDateParam],
  );

  const defaultDateIso = weekRange.from.slice(0, 10);
  const resolvedActiveDateIso = activeDateIso ?? defaultDateIso;
  const dayViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (dayLane) {
      params.set('lane', dayLane);
    }
    if (categoryFilter !== 'All') {
      params.set('cat', categoryFilter);
    }
    if (orgParam !== 'all') {
      params.set('org', orgParam);
    }
    return `/schedules/day?${params.toString()}`;
  }, [categoryFilter, dayLane, orgParam, resolvedActiveDateIso]);
  const weekViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') {
      params.set('cat', categoryFilter);
    }
    if (orgParam !== 'all') {
      params.set('org', orgParam);
    }
    return `/schedules/week?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);
  const monthViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') {
      params.set('cat', categoryFilter);
    }
    if (orgParam !== 'all') {
      params.set('org', orgParam);
    }
    return `/schedules/month?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);
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
      const { start, end } = buildNextSlot(iso);
      const createCategory = categoryFilter === 'All' ? 'User' : categoryFilter;
      setDialogParams(buildCreateDialogIntent(createCategory, start, end));
    },
    [canEdit, activeDateIso, categoryFilter, defaultDateIso, primeRouteReset, setDialogParams],
  );

  // Week Grid: Time slot click handler (PR #515) - IMPROVED: Safe category handling + error handling
  const handleTimeSlotClick = useCallback(
    (dayIso: string, time: string) => {
      if (!canEdit) return;

      try {
        // Compute end time: start + 30 minutes
        const [year, month, day] = dayIso.split('-').map(Number);
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(year, month - 1, day, h, m);
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + 30);

        // Category safety: 'All' -> use 'User' default
        const createCategory =
          categoryFilter && categoryFilter !== 'All' ? categoryFilter : 'User';

        // Call with Date objects directly (type-safe)
        const intent = buildCreateDialogIntent(createCategory, startDate, endDate);
        setDialogParams(intent);
      } catch (e) {
        console.error('[WeekPage] time slot click failed', { dayIso, time, e });
      }
    },
    [canEdit, categoryFilter, setDialogParams],
  );

  const handleOrgChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      const next = new URLSearchParams(searchParams);
      if (nextValue === 'all') {
        next.delete('org');
      } else {
        next.set('org', nextValue);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // View dialog - open when clicking a schedule (for viewing details)
  const handleViewClick = useCallback((item: SchedItem) => {
    setViewItem(item);
  }, []);

  // View dialog edit - transition to edit dialog
  const handleViewEdit = useCallback((item: SchedItem) => {
    // 1. Close other dialogs first
    setViewItem(null);
    clearDialogParams();

    // 2. Authorization check (day/week共通)
    if (ready) {
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

    // 3. Prepare dialog values (JST基準で統一)
    const category = (item.category as ScheduleCategory) ?? 'User';
    setDayLane(category);
    const serviceType = (item.serviceType as ScheduleServiceType) ?? 'normal';
    const startLocal = formatScheduleLocalInput(item.start, DEFAULT_START_TIME, schedulesTz);
    const endLocal = formatScheduleLocalInput(item.end, DEFAULT_END_TIME, schedulesTz);
    const dateIso = extractDatePart(startLocal) || toDateIso(new Date());
    setActiveDateIso(dateIso);

    // 4. Set values first, then open
    const resolvedUserId =
      item.userId?.trim() ||
      (typeof item.userLookupId === 'string' ? item.userLookupId.trim() : String(item.userLookupId ?? '')).trim();
    const resolvedTitle = item.title?.trim() || (item.personName?.trim() ? `${item.personName.trim()}の予定` : '');

    setDialogInitialValues({
      id: item.id,
      title: resolvedTitle,
      category,
      startLocal,
      endLocal,
      serviceType,
      userId: resolvedUserId,
      assignedStaffId: item.assignedStaffId ?? '',
      locationName: item.locationName ?? item.location ?? '',
      notes: item.notes ?? '',
      vehicleId: item.vehicleId ?? '',
      status: item.status ?? 'Planned',
      statusReason: item.statusReason ?? '',
    });
    setDialogOpen(true);
  }, [mode, ready, canEditByRole, myUpn, showSnack, schedulesTz, clearDialogParams]);

  // View dialog delete - remove schedule
  const handleViewDelete = useCallback(
    async (id: string) => {
      if (isInlineDeleting) return;
      setIsInlineDeleting(true);
      try {
        await remove(id);
        showSnack('success', '予定を削除しました');
        setViewItem(null);
      } catch (e) {
        showSnack('error', '削除に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      } finally {
        setIsInlineDeleting(false);
      }
    },
    [remove, showSnack, isInlineDeleting],
  );

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
      if (!inlineEditingEventId || isInlineSaving) {
        return;
      }
      setIsInlineSaving(true);
      const payload = buildUpdateInput(inlineEditingEventId, input);
      try {
        await update(payload);
        showSnack('success', '予定を更新しました');
        clearInlineSelection();
      } catch (e) {
        showSnack('error', '更新に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      } finally {
        setIsInlineSaving(false);
      }
    },
    [clearInlineSelection, inlineEditingEventId, showSnack, update, isInlineSaving],
  );

  const handleInlineDialogDelete = useCallback(
    async (eventId: string) => {
      if (isInlineDeleting) {
        return;
      }
      setIsInlineDeleting(true);
      try {
        await remove(eventId);
        showSnack('success', '予定を削除しました');
        clearInlineSelection();
      } catch (e) {
        showSnack('error', '削除に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      } finally {
        setIsInlineDeleting(false);
      }
    },
    [clearInlineSelection, remove, showSnack, isInlineDeleting],
  );


  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      const baseIso = route.dateIso ?? toDateIso(focusDate);
      const base = new Date(`${baseIso}T00:00:00Z`);
      base.setDate(base.getDate() + deltaWeeks * 7);
      const iso = toDateIso(base);
      setActiveDateIso(iso);
      primeRouteReset();
      syncDateParam(iso);
    },
    [focusDate, primeRouteReset, route.dateIso, syncDateParam],
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

  // Month-specific navigation handlers
  const handlePrevMonth = useCallback(() => {
    const prevMonthDate = new Date(focusDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const iso = toDateIso(prevMonthDate);
    setActiveDateIso(iso);
    primeRouteReset();
    syncDateParam(iso);
  }, [focusDate, primeRouteReset, syncDateParam]);

  const handleNextMonth = useCallback(() => {
    const nextMonthDate = new Date(focusDate);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const iso = toDateIso(nextMonthDate);
    setActiveDateIso(iso);
    primeRouteReset();
    syncDateParam(iso);
  }, [focusDate, primeRouteReset, syncDateParam]);

  const handleTodayMonth = useCallback(() => {
    const todayIso = toDateIso(new Date());
    setActiveDateIso(todayIso);
    primeRouteReset();
    syncDateParam(todayIso);
  }, [primeRouteReset, syncDateParam]);

  const handleScheduleDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (!canEdit || !canWrite) {
        showSnack('info', '受付/管理者のみ予定を作成・編集できます');
        throw new Error('schedule submit blocked by authorization');
      }

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
        title: input.title.trim() || '予定',
        dateIso,
        startTime,
        endTime,
        start,
        end,
        sourceInput: input,
      };

      await create(draft);
    },
    [canEdit, canWrite, create, dialogEventId, dialogMode, showSnack, update],
  );

  const handleCreateDialogClose = useCallback(() => {
    pendingFabFocus = true;
    primeRouteReset();
    clearDialogParams();
  }, [clearDialogParams, primeRouteReset]);

  // Phase 2-1c: Show conflict snackbar when update/create fails with conflict
  const conflictOpen = !!lastError && lastError.kind === 'conflict';

  // Conflict dialog handlers
  const handleConflictDiscard = useCallback(() => {
    clearLastError();
    setConflictDetailOpen(false);
  }, [clearLastError]);

  const handleConflictReload = useCallback(async () => {
    if (conflictBusy) return;

    try {
      setConflictBusy(true);
      await refetch();
      clearLastError();
      setConflictDetailOpen(false);
    } finally {
      setConflictBusy(false);
    }
  }, [conflictBusy, refetch, clearLastError]);

  // Phase 2-2b: Scroll & highlight conflicted schedule after refetch

  // Set timestamp when conflict appears
  useEffect(() => {
    if (conflictOpen) {
      setLastErrorAt(Date.now());
    }
  }, [conflictOpen]);

  // Phase 2-2b: Scroll to & highlight focused schedule after refetch completes
  useEffect(() => {
    if (!focusScheduleId) return;

    const element = document.querySelector<HTMLElement>(`[data-schedule-id="${focusScheduleId}"]`);
    if (!element) return;

    // Smooth scroll to center
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Set highlight
    setHighlightId(focusScheduleId);

    // Clear highlight after 2 seconds
    const timeoutId = setTimeout(() => {
      setHighlightId(null);
    }, 2000);

    // Clear focus state (one-time operation)
    setFocusScheduleId(null);

    return () => clearTimeout(timeoutId);
  }, [focusScheduleId, filteredItems]);

  const spLane = useMemo(() => {
    const enabled = isSchedulesSpEnabled();
    return buildSpLaneModel(enabled, spSyncStatus);
  }, [spSyncStatus]);


  return (
    <section
      aria-label="週間スケジュール"
      aria-describedby={rangeDescriptionId}
      aria-labelledby={headingId}
      data-testid="schedules-week-page"
      tabIndex={-1}
      style={{ paddingBottom: 24 }}
    >
      <div data-testid="schedules-week-root" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="schedule-sticky"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(6px)',
          paddingTop: 0,
          paddingBottom: 4,
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
                : '週表示（週間の予定一覧）';

          const headerPeriodLabel =
            mode === 'month'
              ? `表示月: ${monthLabel}`
              : mode === 'day'
                ? `表示期間: ${new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(monthDate)}`
                : `表示期間: ${weekLabel}`;

          // Mode-aware navigation handlers
          const navPrev = mode === 'month' ? handlePrevMonth : handlePrevWeek;
          const navNext = mode === 'month' ? handleNextMonth : handleNextWeek;
          const navToday = mode === 'month' ? handleTodayMonth : handleTodayWeek;

          return (
            <>
                  <SchedulesHeader
                mode={mode}
                title={MASTER_SCHEDULE_TITLE_JA}
                subLabel={headerSubLabel}
                periodLabel={headerPeriodLabel}
                compact={compact}
          onPrev={navPrev}
          onNext={navNext}
          onToday={navToday}
          onPrimaryCreate={canEdit && canWrite ? handleFabClick : undefined}
                  showPrimaryAction={isDesktopSize}
                  primaryActionLabel="予定を追加"
          primaryActionAriaLabel="この週に予定を追加"
          headingId={headingId}
          titleTestId={
            mode === 'month'
              ? TESTIDS.SCHEDULES_MONTH_HEADING_ID
              : mode === 'day'
                ? TESTIDS['schedules-day-heading']
                : TESTIDS['schedules-week-heading']
          }
          rangeLabelId={rangeDescriptionId}
          dayHref={dayViewHref}
          weekHref={weekViewHref}
          monthHref={monthViewHref}
          modes={['day', 'week', 'month', 'org']}
          prevTestId={TESTIDS.SCHEDULES_PREV_WEEK}
          nextTestId={TESTIDS.SCHEDULES_NEXT_WEEK}
        >
          <SchedulesFilterResponsive
            compact={compact && mode !== 'org'}
            inlineStackProps={{
              sx: { mt: { xs: 0.5, sm: 0 }, minWidth: 260 },
              spacing: 0.5,
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>絞り込み</span>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
              sx={{ width: '100%' }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, width: '100%' }}>
                カテゴリ:
                <select
                  value={categoryFilter}
                  onChange={(e) => route.setFilter({ category: e.target.value as 'All' | ScheduleCategory })}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
                  data-testid={TESTIDS['schedules-filter-category']}
                >
                  <option value="All">すべて</option>
                  <option value="User">{scheduleCategoryLabels.User}</option>
                  <option value="Staff">{scheduleCategoryLabels.Staff}</option>
                  <option value="Org">{scheduleCategoryLabels.Org}</option>
                </select>
              </label>
              {mode === 'org' && (
                <Stack direction="column" spacing={1} style={{ width: '100%' }} data-testid="schedule-org-tabpanel">
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>組織別スケジュール</h3>
                  <Stack direction="row" spacing={1} style={{ alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      事業所:
                      <select
                        value={orgParam}
                        onChange={handleOrgChange}
                        style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
                        data-testid="schedule-org-select"
                      >
                        <option value="all">全事業所（統合ビュー）</option>
                        <option value="main">生活介護（本体）</option>
                        <option value="shortstay">短期入所</option>
                        <option value="respite">レスパイト</option>
                        <option value="other">その他</option>
                      </select>
                    </label>
                    <span data-testid="schedule-org-summary" style={{ fontSize: 13, color: '#666' }}>
                      {orgParam === 'all' && '全事業所（統合ビュー）'}
                      {orgParam === 'main' && '生活介護（本体）'}
                      {orgParam === 'shortstay' && '短期入所'}
                      {orgParam === 'respite' && 'レスパイト'}
                      {orgParam === 'other' && 'その他'}
                    </span>
                  </Stack>
                </Stack>
              )}
              <input
                type="search"
                value={query}
                onChange={(e) => route.setFilter({ query: e.target.value })}
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
            </Stack>
          </SchedulesFilterResponsive>
        </SchedulesHeader>
            </>
          );
        })()}
      </div>

      <div style={{ display: 'flex', gap: 24, padding: isDesktopSize ? '0 24px' : '0 12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {readOnlyReason && (
            <Alert
              severity={readOnlyReason.kind === 'WRITE_DISABLED' ? 'info' : 'warning'}
              sx={{ mb: 2 }}
              action={
                readOnlyReason.action ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={readOnlyReason.action.onClick}
                    href={readOnlyReason.action.href}
                  >
                    {readOnlyReason.action.label}
                  </Button>
                ) : undefined
              }
            >
              <AlertTitle>{readOnlyReason.title}</AlertTitle>
              {readOnlyReason.message}
              {readOnlyReason.details && readOnlyReason.details.length > 0 && (
                <Typography variant="caption" component="div" sx={{ mt: 1, opacity: 0.8 }}>
                  {readOnlyReason.details.join(' / ')}
                </Typography>
              )}
            </Alert>
          )}

          <div>
            {isLoading ? (
              <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 16 }}>
                <Loading />
                <div style={skeletonStyle} />
                <div style={skeletonStyle} />
                <div style={skeletonStyle} />
              </div>
            ) : (
              <>
                {(mode === 'week' || mode === 'org') && (
                  <WeekView
                    items={filteredItems}
                    loading={isLoading}
                    range={weekRange}
                    onDayClick={handleDayClick}
                    onTimeSlotClick={handleTimeSlotClick}
                    activeDateIso={resolvedActiveDateIso}
                    onItemSelect={handleViewClick}
                    highlightId={highlightId}
                    compact={compact}
                  />
                )}
                {mode === 'day' && (
                  <DayView
                    items={filteredItems}
                    loading={isLoading}
                    range={activeDayRange}
                    categoryFilter={categoryFilter}
                    emptyCtaLabel={categoryFilter === 'Org' ? '施設予定を追加' : '予定を追加'}
                    compact={compact}
                  />
                )}
                {mode === 'month' && (
                  <MonthPage
                    items={filteredItems}
                    loading={isLoading}
                    activeCategory={categoryFilter}
                    compact={compact}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {isDesktopSize && (
          <aside style={{ width: 280, flexShrink: 0, paddingTop: 16 }}>
             <SchedulesSpLane model={spLane} />
          </aside>
        )}
      </div>

      {showFab ? (
        <button
          type="button"
          onClick={handleFabClick}
          data-testid={TESTIDS.SCHEDULES_FAB_CREATE}
          ref={fabRef}
          disabled={!canWrite}
          style={{
            position: 'fixed',
            right: fabInsetRight,
            bottom: fabInset,
            width: 64,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: canWrite ? '#1976d2' : '#ccc',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            cursor: canWrite ? 'pointer' : 'not-allowed',
            zIndex: 1300,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canWrite ? 1 : 0.6,
          }}
          aria-label={
            !canWrite
              ? readOnlyReason?.message ?? '現在は閲覧のみです'
              : resolvedActiveDateIso
              ? `選択中の日に予定を追加 (${resolvedActiveDateIso})`
              : '予定を追加'
          }
          title={!canWrite ? readOnlyReason?.message ?? '現在は閲覧のみです' : undefined}
        >
          <span aria-hidden="true">＋</span>
        </button>
      ) : null}
      {dialogInitialValues ? (
        <ScheduleCreateDialog
          open={dialogOpen}
          mode="edit"
          eventId={dialogInitialValues!.id}
          initialOverride={{
            ...dialogInitialValues!,
            serviceType:
              dialogInitialValues!.serviceType === null || dialogInitialValues!.serviceType === undefined
                ? ""
                : dialogInitialValues!.serviceType,
          }}
          onClose={handleInlineDialogClose}
          onSubmit={handleInlineDialogSubmit}
          onDelete={handleInlineDialogDelete}
          users={scheduleUserOptions}
          defaultUser={defaultScheduleUser ?? undefined}
          isSubmitting={isInlineSaving}
          isDeleting={isInlineDeleting}
        />
      ) : scheduleDialogModeProps.mode === 'edit' ? (
        <ScheduleCreateDialog
          open={!suppressRouteDialog && createDialogOpen}
          mode="edit"
          eventId={scheduleDialogModeProps.eventId}
          initialOverride={scheduleDialogModeProps.initialOverride}
          onClose={handleCreateDialogClose}
          onSubmit={handleScheduleDialogSubmit}
          users={scheduleUserOptions}
          initialDate={createDialogInitialDate}
          initialStartTime={createDialogInitialStartTime}
          initialEndTime={createDialogInitialEndTime}
          defaultUser={defaultScheduleUser ?? undefined}
        />
      ) : (
        <ScheduleCreateDialog
          open={!suppressRouteDialog && createDialogOpen && canEdit && canWrite}
          mode="create"
          initialOverride={scheduleDialogModeProps.initialOverride}
          onClose={handleCreateDialogClose}
          onSubmit={handleScheduleDialogSubmit}
          users={scheduleUserOptions}
          initialDate={createDialogInitialDate}
          initialStartTime={createDialogInitialStartTime}
          initialEndTime={createDialogInitialEndTime}
          defaultUser={defaultScheduleUser ?? undefined}
        />
      )}

      {/* View Dialog - read-only view with edit/delete buttons */}
      <ScheduleViewDialog
        open={Boolean(viewItem)}
        item={viewItem}
        onClose={() => setViewItem(null)}
        onEdit={handleViewEdit}
        onDelete={handleViewDelete}
        isDeleting={isInlineDeleting}
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

      {/* Phase 2-1c: Conflict snackbar for etag mismatch */}
      <Snackbar
        open={conflictOpen}
        autoHideDuration={8000}
        onClose={() => clearLastError()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={() => clearLastError()}
          action={
            <Stack direction="row" spacing={0.5}>
              <Button
                color="inherit"
                size="small"
                onClick={() => setConflictDetailOpen(true)}
              >
                詳細を見る
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  // Phase 2-2b: Set focus for post-refetch scroll + highlight
                  if (lastError?.kind === 'conflict' && lastError.id) {
                    setFocusScheduleId(lastError.id);
                  }
                  refetch();
                  clearLastError();
                }}
              >
                最新を表示
              </Button>
            </Stack>
          }
        >
          {lastError?.message ?? '更新が競合しました（最新を読み込み直してください）'}
        </Alert>
      </Snackbar>

      {/* Phase 2-2a: Conflict detail dialog */}
      <Dialog
        open={conflictDetailOpen}
        onClose={(_, reason) => {
          // backdrop / ESC も Discard 扱い
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleConflictDiscard();
            return;
          }
          handleConflictDiscard();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>スケジュール更新が競合しました</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              他のユーザーが先に更新しました。「最新を読み込む」で最新状態を取得できます。
            </Typography>

            {lastError ? (
              <Typography variant="body2">
                <strong>メッセージ:</strong> {lastError.message}
              </Typography>
            ) : (
              <Typography variant="body2">詳細情報がありません。</Typography>
            )}

            <Typography variant="caption" color="text.secondary">
              発生時刻: {lastErrorAt ? new Date(lastErrorAt as number).toLocaleTimeString('ja-JP') : '-'}
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleConflictDiscard} disabled={conflictBusy}>
            破棄して閉じる
          </Button>
          <Button variant="contained" onClick={handleConflictReload} disabled={conflictBusy}>
            最新を読み込む
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    </section>
  );
}

const skeletonStyle: CSSProperties = {
  height: 16,
  borderRadius: 8,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.06) 63%)',
  animation: 'shine 1.4s ease infinite',
};
