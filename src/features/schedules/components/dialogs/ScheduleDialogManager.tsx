import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';
import { useCallback, useMemo } from 'react';

import { isE2E } from '@/env';
import { resolveOperationFailureFeedback } from '@/features/today/feedback/operationFeedback';

import type { ResultError } from '@/shared/result';
import type { CreateScheduleEventInput, SchedItem } from '../../data';
import type { ScheduleFormState, ScheduleUserOption } from '../../domain/scheduleFormState';
import type { ScheduleEditDialogValues } from '../../hooks/view-models/useSchedulesPageState';
import { computeAutofill } from '../../domain/validation/scheduleAutofillRules';
import { buildCopyLastTemplate, buildQuickTemplates, type ScheduleItemForTemplate } from '../../domain/builders/scheduleQuickTemplates';
import ScheduleCreateDialog from './ScheduleCreateDialog';
import ScheduleViewDialog from '../../routes/ScheduleViewDialog';

export type ScheduleDialogManagerProps = {
  // View Dialog (read-only detail view)
  viewItem: SchedItem | null;
  onViewClose: () => void;
  onViewEdit: (item: SchedItem) => void;
  onViewDelete: (id: string) => Promise<void>;

  // Inline Edit Dialog (when clicking schedule in calendar)
  dialogOpen: boolean;
  dialogInitialValues: ScheduleEditDialogValues | null;
  onInlineDialogClose: () => void;
  onInlineDialogSubmit: (input: CreateScheduleEventInput) => Promise<void>;
  onInlineDialogDelete: (eventId: string) => Promise<void>;
  isInlineSaving: boolean;
  isInlineDeleting: boolean;

  // Route-based Create/Edit Dialog (URL-driven)
  createDialogOpen: boolean;
  suppressRouteDialog: boolean;
  canEdit: boolean;
  canWrite: boolean;
  scheduleDialogModeProps: {
    mode: 'create' | 'edit';
    eventId?: string;
    initialOverride?: Partial<CreateScheduleEventInput>;
  };
  createDialogInitialDate?: string | Date;
  createDialogInitialStartTime?: string;
  createDialogInitialEndTime?: string;
  onCreateDialogClose: () => void;
  onScheduleDialogSubmit: (input: CreateScheduleEventInput) => Promise<void>;

  // User options for dropdowns
  scheduleUserOptions: ScheduleUserOption[];
  defaultScheduleUser?: ScheduleUserOption;

  // Snackbar notifications
  snack: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  };
  onSnackClose: () => void;

  // Conflict handling
  conflictOpen: boolean;
  conflictDetailOpen: boolean;
  onOpenConflictDetail: () => void;
  onConflictDetailClose: () => void;
  onConflictDiscard: () => void;
  onConflictReload: () => Promise<void>;
  conflictBusy: boolean;
  lastError: ResultError | null;
  lastErrorAt: number | null;
  onConflictRefetch: () => void;
  onClearLastError: () => void;
  onSetFocusScheduleId: (id: string | null) => void;
  networkOpen: boolean;

  /** Phase 7-A: All schedule items for template extraction */
  allItems?: ScheduleItemForTemplate[];
  /** Phase 7-A: Active date for template date projection */
  activeDateIso?: string;
  /** Phase 7-B: Navigation source for autofill context */
  navigationSource?: string;
};

export function ScheduleDialogManager(props: ScheduleDialogManagerProps) {
  const {
    viewItem,
    onViewClose,
    onViewEdit,
    onViewDelete,
    dialogOpen,
    dialogInitialValues,
    onInlineDialogClose,
    onInlineDialogSubmit,
    onInlineDialogDelete,
    isInlineSaving,
    isInlineDeleting,
    createDialogOpen,
    suppressRouteDialog,
    canEdit,
    canWrite,
    scheduleDialogModeProps,
    createDialogInitialDate,
    createDialogInitialStartTime,
    createDialogInitialEndTime,
    onCreateDialogClose,
    onScheduleDialogSubmit,
    scheduleUserOptions,
    defaultScheduleUser,
    snack,
    onSnackClose,
    conflictDetailOpen,
    onOpenConflictDetail,
    onConflictDetailClose,
    onConflictDiscard,
    onConflictReload,
    conflictBusy,
    lastError,
    lastErrorAt,
    onConflictRefetch,
    onClearLastError,
    onSetFocusScheduleId,
    networkOpen,
    allItems,
    activeDateIso,
    navigationSource,
  } = props;

  const handleConflictRefetchWithFocus = useCallback(() => {
    // Phase 2-2b: Set focus for post-refetch scroll + highlight
    if (lastError?.kind === 'conflict' && lastError.id) {
      onSetFocusScheduleId(lastError.id);
    }
    onConflictRefetch();
    onClearLastError();
  }, [lastError, onSetFocusScheduleId, onConflictRefetch, onClearLastError]);

  // Convert null to "" for compatibility with ScheduleFormState
  const normalizeInitialOverride = useCallback(
    (override?: Partial<CreateScheduleEventInput>): Partial<ScheduleFormState> | null => {
      if (!override) return null;
      const {
        userId,
        assignedStaffId,
        vehicleId,
        locationName,
        notes,
        serviceType,
        statusReason,
        acceptedOn: _acceptedOn,
        acceptedBy: _acceptedBy,
        acceptedNote: _acceptedNote,
        ...rest
      } = override;

      const normalized: Partial<ScheduleFormState> = {
        ...rest,
        userId: userId ?? '',
        assignedStaffId: assignedStaffId ?? '',
        vehicleId: vehicleId ?? '',
        locationName: locationName ?? '',
        notes: notes ?? '',
        serviceType: serviceType ?? '',
        statusReason: statusReason ?? '',
      };
      return normalized;
    },
    [],
  );

  const normalizedInitialOverride = useMemo(
    () => normalizeInitialOverride(scheduleDialogModeProps.initialOverride),
    [normalizeInitialOverride, scheduleDialogModeProps.initialOverride],
  );
  const conflictFeedback = useMemo(
    () => resolveOperationFailureFeedback('schedules:conflict-412'),
    [],
  );

  // Phase 7-A: Compute quick templates from existing schedule items
  const quickTemplates = useMemo(() => {
    if (!allItems || !activeDateIso || scheduleDialogModeProps.mode !== 'create') return undefined;
    const selectedUserId = defaultScheduleUser?.id;
    const copyLast = selectedUserId
      ? buildCopyLastTemplate(allItems, selectedUserId, activeDateIso)
      : null;
    const frequent = buildQuickTemplates(allItems, activeDateIso, {
      userId: selectedUserId,
      limit: 2,
    });
    const templates = copyLast ? [copyLast, ...frequent] : frequent;
    return templates.length > 0 ? templates : undefined;
  }, [allItems, activeDateIso, scheduleDialogModeProps.mode, defaultScheduleUser?.id]);

  // Phase 7-B: Compute autofill values
  const autofillResult = useMemo(() => {
    if (!allItems || !activeDateIso || scheduleDialogModeProps.mode !== 'create') return null;
    return computeAutofill({
      targetDate: activeDateIso,
      targetStartTime: createDialogInitialStartTime,
      targetEndTime: createDialogInitialEndTime,
      source: navigationSource,
      userId: defaultScheduleUser?.id,
      items: allItems,
    });
  }, [allItems, activeDateIso, scheduleDialogModeProps.mode, createDialogInitialStartTime, createDialogInitialEndTime, navigationSource, defaultScheduleUser?.id]);

  // Merge autofill with explicit override (explicit wins)
  const mergedInitialOverride = useMemo(() => {
    if (!autofillResult) return normalizedInitialOverride;
    // autofill provides base, explicit override wins
    return {
      ...autofillResult.override,
      ...normalizedInitialOverride,
    };
  }, [autofillResult, normalizedInitialOverride]);

  return (
    <>
      {/* Inline Edit Dialog (clicking schedule card) */}
      {dialogInitialValues ? (
        <ScheduleCreateDialog
          open={dialogOpen}
          mode="edit"
          eventId={dialogInitialValues.id}
          initialOverride={{
            ...dialogInitialValues,
            userId: dialogInitialValues.userId ?? '',
            assignedStaffId: dialogInitialValues.assignedStaffId ?? '',
            vehicleId: dialogInitialValues.vehicleId ?? '',
            locationName: dialogInitialValues.locationName ?? '',
            notes: dialogInitialValues.notes ?? '',
            serviceType: dialogInitialValues.serviceType ?? '',
            statusReason: dialogInitialValues.statusReason ?? '',
          }}
          onClose={onInlineDialogClose}
          onSubmit={onInlineDialogSubmit}
          onDelete={onInlineDialogDelete}
          users={scheduleUserOptions}
          defaultUser={defaultScheduleUser}
          isSubmitting={isInlineSaving}
          isDeleting={isInlineDeleting}
        />
      ) : scheduleDialogModeProps.mode === 'edit' && scheduleDialogModeProps.eventId ? (
        /* Route-based Edit Dialog */
        <ScheduleCreateDialog
          open={!suppressRouteDialog && createDialogOpen}
          mode="edit"
          eventId={scheduleDialogModeProps.eventId}
          initialOverride={normalizedInitialOverride ?? {}}
          onClose={onCreateDialogClose}
          onSubmit={onScheduleDialogSubmit}
          users={scheduleUserOptions}
          initialDate={typeof createDialogInitialDate === 'string' ? createDialogInitialDate : undefined}
          initialStartTime={createDialogInitialStartTime}
          initialEndTime={createDialogInitialEndTime}
          defaultUser={defaultScheduleUser}
        />
      ) : (
        /* Route-based Create Dialog */
        <ScheduleCreateDialog
          open={!suppressRouteDialog && createDialogOpen && canEdit && canWrite}
          mode="create"
          initialOverride={mergedInitialOverride}
          onClose={onCreateDialogClose}
          onSubmit={onScheduleDialogSubmit}
          users={scheduleUserOptions}
          initialDate={typeof createDialogInitialDate === 'string' ? createDialogInitialDate : undefined}
          initialStartTime={createDialogInitialStartTime}
          initialEndTime={createDialogInitialEndTime}
          defaultUser={defaultScheduleUser}
          quickTemplates={quickTemplates}
        />
      )}

      {/* View Dialog - read-only view with edit/delete buttons */}
      <ScheduleViewDialog
        open={Boolean(viewItem)}
        item={viewItem}
        onClose={onViewClose}
        onEdit={onViewEdit}
        onDelete={onViewDelete}
        isDeleting={isInlineDeleting}
      />

      {/* Unified Snackbar for Success, Conflict, and Network Errors */}
      <Snackbar
        open={snack.open || networkOpen}
        autoHideDuration={isE2E ? undefined : (lastError?.kind === 'network' ? 10000 : 3000)}
        onClose={(event, reason) => {
          if (isE2E && (reason === 'clickaway' || reason === 'timeout')) return;
          onSnackClose();
          if (lastError?.kind === 'network') onClearLastError();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          data-testid={lastError?.kind === 'network' ? 'schedules-network-snackbar' : 'schedules-general-snackbar'}
          onClose={lastError?.kind === 'network' ? onClearLastError : onSnackClose}
          severity={lastError?.kind === 'conflict' ? 'warning' : lastError?.kind === 'network' ? 'error' : snack.severity}
          variant="filled"
          sx={{ width: '100%' }}
          action={
            lastError?.kind === 'conflict' ? (
              <Stack direction="row" spacing={0.5}>
                <Button color="inherit" size="small" onClick={onOpenConflictDetail}>
                  競合の詳細を表示
                </Button>
                <Button color="inherit" size="small" onClick={handleConflictRefetchWithFocus}>
                  最新を表示
                </Button>
              </Stack>
            ) : lastError?.kind === 'network' ? (
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                再試行
              </Button>
            ) : undefined
          }
        >
          {snack.message || lastError?.message || (lastError?.kind === 'conflict' ? conflictFeedback.toastMessage : 'エラーが発生しました')}
        </Alert>
      </Snackbar>

      {/* Phase 2-2a: Conflict detail dialog */}
      <Dialog
        open={conflictDetailOpen}
        onClose={(_, reason) => {
          // backdrop / ESC も Close 扱い
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            onConflictDetailClose();
            return;
          }
          onConflictDetailClose();
        }}
        fullWidth
        maxWidth="sm"
        data-testid="conflict-detail-dialog"
      >
        <DialogTitle>{conflictFeedback.title}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {conflictFeedback.userMessage}
            </Typography>

            {lastError ? (
              <Typography variant="body2">
                <strong>メッセージ:</strong> {lastError.message}
              </Typography>
            ) : (
              <Typography variant="body2">詳細情報がありません。</Typography>
            )}

            <Typography variant="caption" color="text.secondary">
              発生時刻: {lastErrorAt ? new Date(lastErrorAt).toLocaleTimeString('ja-JP') : '-'}
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onConflictDiscard} disabled={conflictBusy}>
            破棄して閉じる
          </Button>
          <Button variant="contained" onClick={onConflictReload} disabled={conflictBusy}>
            {conflictFeedback.followUpActionText}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
