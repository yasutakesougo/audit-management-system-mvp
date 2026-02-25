/**
 * useWeekPageOrchestrator
 * 
 * Orchestrator hook for WeekPage - consolidates all local state, event handlers,
 * navigation logic, and side effects to keep WeekPage.tsx as a thin presentation layer.
 */

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { isDev } from '@/env';
import type { ScheduleCategory } from '@/features/schedules/domain/types';
import type { CreateScheduleEventInput, SchedItem, ScheduleServiceType } from '@/features/schedules/data';
import type { InlineScheduleDraft } from '@/features/schedules/data/inlineScheduleDraft';
import { makeRange } from './useSchedules';
import {
  type ScheduleEditDialogValues,
  buildCreateDialogIntent,
  buildLocalDateTimeInput,
  buildNextSlot,
  buildUpdateInput,
  extractDatePart,
  extractTimePart,
  formatScheduleLocalInput,
  toDateIso,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  useSchedulesPageState,
} from './useSchedulesPageState';
import { useWeekPageUiState } from './useWeekPageUiState';

// Type inference from hooks
type UseSchedulesPageStateReturn = ReturnType<typeof useSchedulesPageState>;
type UseWeekPageUiStateReturn = ReturnType<typeof useWeekPageUiState>;

// Tracks whether the FAB should reclaim focus after the dialog closes across route remounts.
let pendingFabFocus = false;

export interface OrchestratorDependencies {
  // Page state
  pageState: UseSchedulesPageStateReturn;
  // UI state
  uiState: UseWeekPageUiStateReturn;
  // Auth
  myUpn: string;
  canEditByRole: boolean;
  ready: boolean;
  canEdit: boolean;
  canWrite: boolean;
  // Layout
  schedulesTz: string;
}

export interface OrchestratorReturn {
  // Local state
  viewItem: SchedItem | null;
  setViewItem: (item: SchedItem | null) => void;
  activeDateIso: string | null;
  dialogOpen: boolean;
  dialogInitialValues: ScheduleEditDialogValues | null;
  dayLane: ScheduleCategory | null;
  
  // Computed values
  resolvedActiveDateIso: string;
  dayViewHref: string;
  weekViewHref: string;
  monthViewHref: string;
  activeDayRange: { from: string; to: string };
  
  // Refs
  fabRef: React.RefObject<HTMLButtonElement>;
  
  // Event handlers
  handleDayClick: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  handleFabClick: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleTimeSlotClick: (dayIso: string, time: string) => void;
  handleOrgChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleViewClick: (item: SchedItem) => void;
  handleViewEdit: (item: SchedItem) => void;
  handleViewDelete: (id: string) => Promise<void>;
  handleInlineDialogClose: () => void;
  handleInlineDialogSubmit: (input: CreateScheduleEventInput) => Promise<void>;
  handleInlineDialogDelete: (eventId: string) => Promise<void>;
  handleScheduleDialogSubmit: (input: CreateScheduleEventInput) => Promise<void>;
  handleCreateDialogClose: () => void;
  handleConflictDiscard: () => void;
  handleConflictReload: () => Promise<void>;
  
  // Navigation handlers
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handleTodayWeek: () => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleTodayMonth: () => void;
  
  // Computed flags
  suppressRouteDialog: boolean;
  conflictOpen: boolean;
  
  // Search params
  orgParam: string;
}

export function useWeekPageOrchestrator(deps: OrchestratorDependencies): OrchestratorReturn {
  const { pageState, uiState, myUpn, canEditByRole, ready, canEdit, canWrite, schedulesTz } = deps;
  const {
    route,
    mode,
    categoryFilter,
    focusDate,
    weekRange,
    create,
    update,
    remove,
    lastError,
    clearLastError,
    refetch,
    createDialogOpen,
    filteredItems,
    dialogMode,
    dialogEventId,
  } = pageState;
  
  const {
    showSnack,
    isInlineSaving,
    setIsInlineSaving,
    isInlineDeleting,
    setIsInlineDeleting,
    setConflictDetailOpen,
    setLastErrorAt,
    conflictBusy,
    setConflictBusy,
    setFocusScheduleId,
    setHighlightId,
    focusScheduleId,
  } = uiState;
  
  const announce = useAnnounce();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = searchParams.get('org') ?? 'all';
  
  // Local state
  const [viewItem, setViewItem] = useState<SchedItem | null>(null);
  const [activeDateIso, setActiveDateIso] = useState<string | null>(() => toDateIso(focusDate));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialValues, setDialogInitialValues] = useState<ScheduleEditDialogValues | null>(null);
  const [dayLane, setDayLane] = useState<ScheduleCategory | null>(null);
  
  // Refs
  const fabRef = useRef<HTMLButtonElement | null>(null);
  
  // Route helpers
  const setDialogParams = route.setDialogParams;
  const clearDialogParams = route.clearDialogParams;
  
  const primeRouteReset = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scope = window as typeof window & { __suppressRouteReset__?: boolean };
    scope.__suppressRouteReset__ = true;
  }, []);
  
  // Computed values
  const defaultDateIso = weekRange.from.slice(0, 10);
  const resolvedActiveDateIso = activeDateIso ?? defaultDateIso;
  
  const dayViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (dayLane) params.set('lane', dayLane);
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/day?${params.toString()}`;
  }, [categoryFilter, dayLane, orgParam, resolvedActiveDateIso]);
  
  const weekViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/week?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);
  
  const monthViewHref = useMemo(() => {
    const params = new URLSearchParams({ date: resolvedActiveDateIso });
    if (categoryFilter !== 'All') params.set('cat', categoryFilter);
    if (orgParam !== 'all') params.set('org', orgParam);
    return `/schedules/month?${params.toString()}`;
  }, [categoryFilter, orgParam, resolvedActiveDateIso]);
  
  const activeDayRange = useMemo(() => {
    const start = new Date(`${resolvedActiveDateIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return makeRange(start, end);
  }, [resolvedActiveDateIso]);
  
  const suppressRouteDialog = Boolean(viewItem) || Boolean(dialogInitialValues);
  const conflictOpen = !!lastError && lastError.kind === 'conflict';
  
  // Effects
  useEffect(() => {
    const nextIso = toDateIso(focusDate);
    setActiveDateIso((prev) => (prev === nextIso ? prev : nextIso));
  }, [focusDate]);
  
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
  
  useEffect(() => {
    if (conflictOpen) {
      setLastErrorAt(Date.now());
    }
  }, [conflictOpen, setLastErrorAt]);
  
  // Phase 2-2b: Scroll to & highlight focused schedule after refetch completes
  useEffect(() => {
    if (!focusScheduleId) return;
    
    const element = document.querySelector<HTMLElement>(`[data-schedule-id="${focusScheduleId}"]`);
    if (!element) return;
    
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(focusScheduleId);
    
    const timeoutId = setTimeout(() => {
      setHighlightId(null);
    }, 2000);
    
    setFocusScheduleId(null);
    
    return () => clearTimeout(timeoutId);
  }, [focusScheduleId, filteredItems, setFocusScheduleId, setHighlightId]);
  
  // Announce week changes
  const weekAnnouncement = pageState.weekAnnouncement;
  useEffect(() => {
    if (!weekAnnouncement) return;
    announce(weekAnnouncement);
  }, [announce, weekAnnouncement]);
  
  // Event handlers
  const syncDateParam = useCallback(
    (dateIso: string) => {
      route.setDateIso(dateIso);
    },
    [route],
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
  
  const handleFabClick = useCallback(
    (_event?: MouseEvent<HTMLButtonElement>) => {
      if (!canEdit) return;
      
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
  
  const handleTimeSlotClick = useCallback(
    (dayIso: string, time: string) => {
      if (!canEdit) return;
      
      try {
        const [year, month, day] = dayIso.split('-').map(Number);
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(year, month - 1, day, h, m);
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + 30);
        
        const createCategory = categoryFilter && categoryFilter !== 'All' ? categoryFilter : 'User';
        const intent = buildCreateDialogIntent(createCategory, startDate, endDate);
        setDialogParams(intent);
      } catch (e) {
        console.error('[useWeekPageOrchestrator] time slot click failed', { dayIso, time, e });
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
  
  const handleViewClick = useCallback((item: SchedItem) => {
    setViewItem(item);
  }, []);
  
  const handleViewEdit = useCallback(
    (item: SchedItem) => {
      // 1. Close other dialogs first
      setViewItem(null);
      clearDialogParams();
      
      // 2. Authorization check
      if (ready) {
        const assignedNormalized = (item.assignedTo ?? '').trim().toLowerCase();
        const hasAssignee = Boolean(assignedNormalized);
        const myUpnNormalized = (myUpn ?? '').trim().toLowerCase();
        const isAssignee = Boolean(myUpnNormalized) && assignedNormalized === myUpnNormalized;
        const canEditItem = canEditByRole || isAssignee;
        if (!canEditItem) {
          if (isDev) {
            console.warn('[useWeekPageOrchestrator] Edit blocked: not authorized', {
              myUpn,
              assignedTo: item.assignedTo,
            });
          }
          if (hasAssignee && !isAssignee) {
            showSnack('info', 'この予定は担当者のみ編集できます');
          } else {
            showSnack('info', '受付/管理者のみ編集できます');
          }
          return;
        }
      }
      
      // 3. Prepare dialog values
      const category = (item.category as ScheduleCategory) ?? 'User';
      setDayLane(category);
      const serviceType = (item.serviceType as ScheduleServiceType) ?? 'normal';
      const startLocal = formatScheduleLocalInput(item.start, DEFAULT_START_TIME, schedulesTz);
      const endLocal = formatScheduleLocalInput(item.end, DEFAULT_END_TIME, schedulesTz);
      const dateIso = extractDatePart(startLocal) || toDateIso(new Date());
      setActiveDateIso(dateIso);
      
      const resolvedUserId =
        item.userId?.trim() ||
        (typeof item.userLookupId === 'string'
          ? item.userLookupId.trim()
          : String(item.userLookupId ?? '')).trim();
      const resolvedTitle =
        item.title?.trim() || (item.personName?.trim() ? `${item.personName.trim()}の予定` : '');
      
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
    },
    [
      ready,
      canEditByRole,
      myUpn,
      showSnack,
      schedulesTz,
      clearDialogParams,
    ],
  );
  
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
    [remove, showSnack, isInlineDeleting, setIsInlineDeleting],
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
      if (!inlineEditingEventId || isInlineSaving) return;
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
    [clearInlineSelection, inlineEditingEventId, showSnack, update, isInlineSaving, setIsInlineSaving],
  );
  
  const handleInlineDialogDelete = useCallback(
    async (eventId: string) => {
      if (isInlineDeleting) return;
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
    [clearInlineSelection, remove, showSnack, isInlineDeleting, setIsInlineDeleting],
  );
  
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
  
  const handleConflictDiscard = useCallback(() => {
    clearLastError();
    setConflictDetailOpen(false);
  }, [clearLastError, setConflictDetailOpen]);
  
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
  }, [conflictBusy, refetch, clearLastError, setConflictBusy, setConflictDetailOpen]);
  
  // Navigation handlers
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
  
  return {
    // Local state
    viewItem,
    setViewItem,
    activeDateIso,
    dialogOpen,
    dialogInitialValues,
    dayLane,
    
    // Computed values
    resolvedActiveDateIso,
    dayViewHref,
    weekViewHref,
    monthViewHref,
    activeDayRange,
    
    // Refs
    fabRef,
    
    // Event handlers
    handleDayClick,
    handleFabClick,
    handleTimeSlotClick,
    handleOrgChange,
    handleViewClick,
    handleViewEdit,
    handleViewDelete,
    handleInlineDialogClose,
    handleInlineDialogSubmit,
    handleInlineDialogDelete,
    handleScheduleDialogSubmit,
    handleCreateDialogClose,
    handleConflictDiscard,
    handleConflictReload,
    
    // Navigation handlers
    handlePrevWeek,
    handleNextWeek,
    handleTodayWeek,
    handlePrevMonth,
    handleNextMonth,
    handleTodayMonth,
    
    // Computed flags
    suppressRouteDialog,
    conflictOpen,
    
    // Search params
    orgParam,
  };
}
