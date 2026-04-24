/**
 * useWeekPageOrchestrator
 *
 * Orchestrator hook for WeekPage — pure composition of sub-hooks.
 * All implementation is delegated to:
 * - useSchedulesNavigation: date tracking, week/month shift, view hrefs
 * - useSchedulesCrud: CRUD handlers, dialog management, conflict resolution
 *
 * This hook only wires sub-hooks together and manages cross-cutting effects.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { isE2E } from '@/env';
import type { CreateScheduleEventInput, SchedItem } from '@/features/schedules/domain';
import type { ScheduleCategory } from '@/features/schedules/domain/types';
import { useSchedulesCrud } from '../legacy/useSchedulesCrud';
import { useSchedulesNavigation } from '../legacy/useSchedulesNavigation';
import { findNextGap } from '../../domain/validation/scheduleNextGap';
import type { ScheduleEditDialogValues } from '../view-models/useSchedulesPageState';
import { buildCreateDialogIntent, useSchedulesPageState } from '../view-models/useSchedulesPageState';
import { useWeekPageUiState } from '../view-models/useWeekPageUiState';

// Type inference from hooks
type UseSchedulesPageStateReturn = ReturnType<typeof useSchedulesPageState>;
type UseWeekPageUiStateReturn = ReturnType<typeof useWeekPageUiState>;

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
  handleDayClick: (dayIso: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  handleFabClick: (event?: React.MouseEvent<HTMLButtonElement>) => void;
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
  networkOpen: boolean;

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
    create, update, remove,
    lastError, clearLastError, refetch,
    createDialogOpen,
    filteredItems,
    dialogMode, dialogEventId,
  } = pageState;

  const {
    showSnack,
    isInlineSaving, setIsInlineSaving,
    isInlineDeleting, setIsInlineDeleting,
    setConflictDetailOpen, setLastErrorAt,
    conflictBusy, setConflictBusy,
    setFocusScheduleId, setHighlightId, focusScheduleId,
  } = uiState;

  const announce = useAnnounce();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = searchParams.get('org') ?? 'all';
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const pendingFabFocusRef = useRef(false);

  // ─── Sub-hook: Navigation ─────────────────────────────────────────────────
  const nav = useSchedulesNavigation({
    focusDate,
    weekRange,
    categoryFilter,
    orgParam,
    dateIso: route.dateIso,
    setDateIso: route.setDateIso,
  });

  // ─── Sub-hook: CRUD ───────────────────────────────────────────────────────
  const crud = useSchedulesCrud({
    create, update, remove, refetch, clearLastError,
    dialogMode, dialogEventId,
    showSnack,
    isInlineSaving, setIsInlineSaving,
    isInlineDeleting, setIsInlineDeleting,
    setConflictDetailOpen, conflictBusy, setConflictBusy,
    myUpn, canEditByRole, ready, canEdit, canWrite, schedulesTz,
    categoryFilter,
    filteredItems,
    setActiveDateIso: nav.setActiveDateIso,
    primeRouteReset: nav.primeRouteReset,
    setPendingFabFocus: (v: boolean) => { pendingFabFocusRef.current = v; },
    setDialogParams: route.setDialogParams,
    clearDialogParams: route.clearDialogParams,
    // Phase 7-C: After successful create, auto-open next gap
    onCreateSuccess: useCallback((startLocal: string) => {
      // Extract date and end time from what was just created
      const createdDate = startLocal.split('T')[0];
      const createdEndTime = startLocal.split('T')[1]?.substring(0, 5);
      if (!createdDate) return;

      // Small delay to let the item list update (refetch triggered by create)
      setTimeout(() => {
        const nextGap = findNextGap(filteredItems, createdDate, createdEndTime);
        if (nextGap) {
          // Auto-open create dialog for next gap
          const startDate = new Date(`${nextGap.date}T${nextGap.startTime}:00`);
          const endDate = new Date(`${nextGap.date}T${nextGap.endTime}:00`);
          const createCategory = categoryFilter === 'All' ? 'User' : categoryFilter;
          route.setDialogParams(buildCreateDialogIntent(createCategory, startDate, endDate));
          showSnack('info', `次の未入力枠を開きました（${nextGap.startTime}〜${nextGap.endTime}）`);
        } else {
          showSnack('success', 'この日の予定入力が完了しました 🎉');
        }
      }, 500);
    }, [filteredItems, categoryFilter, route, showSnack]),
  });

  // ─── Cross-cutting effects (orchestration-only) ───────────────────────────

  const suppressRouteDialog = Boolean(crud.viewItem) || Boolean(crud.dialogInitialValues);
  const conflictOpen = !!lastError && lastError.kind === 'conflict';
  const networkOpen = !!lastError && lastError.kind === 'network';

  if (isE2E) {
    // eslint-disable-next-line no-console
    console.log('[orchestrator] state:', {
      hasLastError: !!lastError,
      lastErrorKind: lastError?.kind,
      networkOpen,
    });
  }

  // Reset day lane on mode change
  useEffect(() => {
    if (mode === 'day') {
      nav.setDayLane(null);
    }
  }, [mode, nav]);

  // FAB focus management after dialog close
  useEffect(() => {
    if (!createDialogOpen && pendingFabFocusRef.current && fabRef.current) {
      fabRef.current.focus();
      pendingFabFocusRef.current = false;
      return;
    }
  }, [createDialogOpen]);

  // Conflict timestamp tracking
  useEffect(() => {
    if (conflictOpen) {
      setLastErrorAt(Date.now());
    }
  }, [conflictOpen, setLastErrorAt]);

  // Non-conflict error → snack
  useEffect(() => {
    if (lastError && lastError.kind !== 'conflict') {
      const timer = setTimeout(() => {
        showSnack('error', lastError.message || 'エラーが発生しました');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [lastError, showSnack]);

  // Scroll to & highlight focused schedule after refetch
  useEffect(() => {
    if (!focusScheduleId) return;
    const element = document.querySelector<HTMLElement>(`[data-schedule-id="${focusScheduleId}"]`);
    if (!element) return;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(focusScheduleId);
    const timeoutId = setTimeout(() => setHighlightId(null), 2000);
    setFocusScheduleId(null);
    return () => clearTimeout(timeoutId);
  }, [focusScheduleId, filteredItems, setFocusScheduleId, setHighlightId]);

  // Announce week changes
  const weekAnnouncement = pageState.weekAnnouncement;
  useEffect(() => {
    if (!weekAnnouncement) return;
    announce(weekAnnouncement);
  }, [announce, weekAnnouncement]);

  // Org change handler (search params specific)
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

  return {
    // From navigation sub-hook
    activeDateIso: nav.activeDateIso,
    dayLane: nav.dayLane,
    resolvedActiveDateIso: nav.resolvedActiveDateIso,
    dayViewHref: nav.dayViewHref,
    weekViewHref: nav.weekViewHref,
    monthViewHref: nav.monthViewHref,
    activeDayRange: nav.activeDayRange,
    handleDayClick: nav.handleDayClick,
    handlePrevWeek: nav.handlePrevWeek,
    handleNextWeek: nav.handleNextWeek,
    handleTodayWeek: nav.handleTodayWeek,
    handlePrevMonth: nav.handlePrevMonth,
    handleNextMonth: nav.handleNextMonth,
    handleTodayMonth: nav.handleTodayMonth,

    // From CRUD sub-hook
    viewItem: crud.viewItem,
    setViewItem: crud.setViewItem,
    dialogOpen: crud.dialogOpen,
    dialogInitialValues: crud.dialogInitialValues,
    handleFabClick: crud.handleFabClick,
    handleTimeSlotClick: crud.handleTimeSlotClick,
    handleViewClick: crud.handleViewClick,
    handleViewEdit: crud.handleViewEdit,
    handleViewDelete: crud.handleViewDelete,
    handleInlineDialogClose: crud.handleInlineDialogClose,
    handleInlineDialogSubmit: crud.handleInlineDialogSubmit,
    handleInlineDialogDelete: crud.handleInlineDialogDelete,
    handleScheduleDialogSubmit: crud.handleScheduleDialogSubmit,
    handleCreateDialogClose: crud.handleCreateDialogClose,
    handleConflictDiscard: crud.handleConflictDiscard,
    handleConflictReload: crud.handleConflictReload,

    // Orchestrator-only
    fabRef,
    handleOrgChange,
    suppressRouteDialog,
    conflictOpen,
    networkOpen,
    orgParam,
  };
}
