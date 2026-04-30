/**
 * useSchedulesCrud
 *
 * Sub-hook handling all CRUD event handlers for the schedules page:
 * - View/Edit/Delete operations
 * - Inline dialog submit/close/delete
 * - Schedule dialog submit
 * - Conflict resolution
 *
 * Extracted from useWeekPageOrchestrator to reduce orchestrator to composition-only.
 */

import type { CreateScheduleEventInput, InlineScheduleDraft, SchedItem } from '@/features/schedules/domain';
import type { ScheduleCategory, ScheduleServiceType } from '@/features/schedules/domain/types';
import { resolveOperationFailureFeedback } from '@/features/today/feedback/operationFeedback';
import { useCallback, useState } from 'react';
import { classifySchedulesError } from '../../errors';
import { useScheduleOrchestrator } from '../orchestrators/useScheduleOrchestrator';
import { useScheduleRepository } from '../../repositoryFactory';
import {
    DEFAULT_END_TIME,
    DEFAULT_START_TIME,
    type ScheduleEditDialogValues,
    buildCreateDialogIntent,
    buildLocalDateTimeInput,
    buildNextSlot,
    buildUpdateInput,
    extractDatePart,
    extractTimePart,
    formatScheduleLocalInput,
    toDateIso,
} from '../view-models/useSchedulesPageState';



export interface CrudDeps {
  // CRUD operations from pageState
  create: (draft: InlineScheduleDraft) => Promise<void>;
  update: (input: import('@/features/schedules/domain').UpdateScheduleEventInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => void;
  clearLastError: () => void;
  dialogMode: string | null;
  dialogEventId: string | null;

  // UI state
  showSnack: (severity: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  isInlineSaving: boolean;
  setIsInlineSaving: (v: boolean) => void;
  isInlineDeleting: boolean;
  setIsInlineDeleting: (v: boolean) => void;
  setConflictDetailOpen: (v: boolean) => void;
  conflictBusy: boolean;
  setConflictBusy: (v: boolean) => void;

  // Auth
  myUpn: string;
  canEditByRole: boolean;
  ready: boolean;
  canEdit: boolean;
  canWrite: boolean;
  schedulesTz: string;

  // Navigation helpers
  categoryFilter: ScheduleCategory | 'All';
  setActiveDateIso: (iso: string) => void;
  primeRouteReset: () => void;
  setPendingFabFocus: (v: boolean) => void;
  setDialogParams: (params: import('../view-models/useWeekPageRouteState').DialogIntentParams) => void;
  clearDialogParams: () => void;

  /** Phase 7-C: Called after successful create with the startLocal of the new schedule */
  onCreateSuccess?: (startLocal: string) => void;
  filteredItems: SchedItem[];
}

export interface CrudReturn {
  viewItem: SchedItem | null;
  setViewItem: (item: SchedItem | null) => void;
  dialogOpen: boolean;
  dialogInitialValues: ScheduleEditDialogValues | null;
  handleFabClick: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  handleTimeSlotClick: (dayIso: string, time: string) => void;
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
}

export function useSchedulesCrud(deps: CrudDeps): CrudReturn {
  const {
    create, update, remove, refetch, clearLastError,
    dialogMode, dialogEventId,
    showSnack,
    isInlineSaving, setIsInlineSaving,
    isInlineDeleting, setIsInlineDeleting,
    setConflictDetailOpen, conflictBusy, setConflictBusy,
    myUpn, canEditByRole, ready, canEdit, canWrite, schedulesTz,
    categoryFilter,    setActiveDateIso, primeRouteReset,
    setPendingFabFocus,
    setDialogParams, clearDialogParams,
    onCreateSuccess,
    filteredItems,
  } = deps;

  const repository = useScheduleRepository();

  const [viewItem, setViewItem] = useState<SchedItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialValues, setDialogInitialValues] = useState<ScheduleEditDialogValues | null>(null);
  const conflictFeedback = resolveOperationFailureFeedback('schedules:conflict-412');

  const clearInlineSelection = useCallback(() => {
    setDialogOpen(false);
    setDialogInitialValues(null);
  }, []);

  const handleFabClick = useCallback(
    (_event?: React.MouseEvent<HTMLButtonElement>) => {
      if (!canEdit) return;
      primeRouteReset();
      const { start, end } = buildNextSlot(toDateIso(new Date()));
      const createCategory = categoryFilter === 'All' ? 'User' : categoryFilter;
      setDialogParams(buildCreateDialogIntent(createCategory, start, end));
    },
    [canEdit, categoryFilter, primeRouteReset, setDialogParams],
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
        console.error('[useSchedulesCrud] time slot click failed', { dayIso, time, e });
      }
    },
    [canEdit, categoryFilter, setDialogParams],
  );

  const handleViewClick = useCallback((item: SchedItem) => {
    setViewItem(item);
  }, []);

  const handleViewEdit = useCallback(
    (item: SchedItem) => {
      setViewItem(null);
      clearDialogParams();

      if (ready) {
        const assignedNormalized = (item.assignedTo ?? '').trim().toLowerCase();
        const hasAssignee = Boolean(assignedNormalized);
        const myUpnNormalized = (myUpn ?? '').trim().toLowerCase();
        const isAssignee = Boolean(myUpnNormalized) && assignedNormalized === myUpnNormalized;
        const canEditItem = canEditByRole || isAssignee;
        if (!canEditItem) {
          if (hasAssignee && !isAssignee) {
            showSnack('info', 'この予定は担当者のみ編集できます');
          } else {
            showSnack('info', '受付/管理者のみ編集できます');
          }
          return;
        }
      }

      const category = (item.category as ScheduleCategory) ?? 'User';
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
        item.title?.trim() || (item.userName?.trim() ? `${item.userName.trim()}の予定` : '');

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
    [ready, canEditByRole, myUpn, showSnack, schedulesTz, clearDialogParams, setActiveDateIso],
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

  const handleInlineDialogClose = useCallback(() => {
    clearInlineSelection();
  }, [clearInlineSelection]);

  const inlineEditingEventId = dialogInitialValues?.id ?? null;

  // ── Orchestrator Integration ─────────────────────────────────────────────
  const orchestrator = useScheduleOrchestrator({
    repository: repository,
    showSnack,
    onSuccess: () => refetch()
  });

  const handleInlineDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (!inlineEditingEventId || isInlineSaving) return;
      setIsInlineSaving(true);
      try {
        const payload = buildUpdateInput(inlineEditingEventId, input);
        await update(payload);
        showSnack('success', '予定を更新しました');
        clearInlineSelection();
      } catch (e) {
        const info = classifySchedulesError(e);
        if (info.kind === 'CONFLICT') {
          showSnack(conflictFeedback.toastSeverity, conflictFeedback.toastMessage);
          clearInlineSelection();
          return;
        }
        showSnack('error', '更新に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      } finally {
        setIsInlineSaving(false);
      }
    },
    [clearInlineSelection, inlineEditingEventId, showSnack, update, isInlineSaving, setIsInlineSaving, conflictFeedback],
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
        const info = classifySchedulesError(e);
        if (info.kind === 'CONFLICT') {
          showSnack(conflictFeedback.toastSeverity, conflictFeedback.toastMessage);
          clearInlineSelection();
          return;
        }
        showSnack('error', '削除に失敗しました（権限・認証・ネットワークを確認）');
        throw e;
      } finally {
        setIsInlineDeleting(false);
      }
    },
    [clearInlineSelection, remove, showSnack, isInlineDeleting, setIsInlineDeleting, conflictFeedback],
  );

  const handleCreateDialogClose = useCallback(() => {
    setPendingFabFocus(true);
    primeRouteReset();
    clearDialogParams();
  }, [clearDialogParams, primeRouteReset, setPendingFabFocus]);

  const handleScheduleDialogSubmit = useCallback(
    async (input: CreateScheduleEventInput) => {
      if (!canEdit || !canWrite) {
        showSnack('info', '受付/管理者のみ予定を作成・編集できます');
        throw new Error('schedule submit blocked by authorization');
      }
      try {
        if (dialogMode === 'edit' && dialogEventId) {
          const payload = buildUpdateInput(dialogEventId, input);
          await update(payload);
        } else {
          // --- ORCHESTRATOR DELEGATION ---
          await orchestrator.handleCreateSchedule(input);
          onCreateSuccess?.(input.startLocal);
        }
        handleCreateDialogClose();
      } catch (error) {
        const info = classifySchedulesError(error);
        if (info.kind === 'CONFLICT') {
          showSnack(conflictFeedback.toastSeverity, conflictFeedback.toastMessage);
          handleCreateDialogClose();
          return;
        }
        throw error;
      }
    },
    [canEdit, canWrite, dialogEventId, dialogMode, showSnack, update, orchestrator, categoryFilter, setDialogParams, handleCreateDialogClose, conflictFeedback],
  );


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

  return {
    viewItem,
    setViewItem,
    dialogOpen,
    dialogInitialValues,
    handleFabClick,
    handleTimeSlotClick,
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
  };
}
