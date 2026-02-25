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
import { useCallback } from 'react';

import type { ResultError } from '@/shared/result';
import type { CreateScheduleEventInput, SchedItem } from '../data';
import type { ScheduleFormState, ScheduleUserOption } from '../domain/scheduleFormState';
import type { ScheduleEditDialogValues } from '../hooks/useSchedulesPageState';
import ScheduleCreateDialog from '../routes/ScheduleCreateDialog';
import ScheduleViewDialog from '../routes/ScheduleViewDialog';

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
  onConflictDetailClose: () => void;
  onConflictDiscard: () => void;
  onConflictReload: () => Promise<void>;
  conflictBusy: boolean;
  lastError: ResultError | null;
  lastErrorAt: number | null;
  onConflictRefetch: () => void;
  onConflictClearError: () => void;
  onSetFocusScheduleId: (id: string | null) => void;
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
    conflictOpen,
    conflictDetailOpen,
    onConflictDetailClose,
    onConflictDiscard,
    onConflictReload,
    conflictBusy,
    lastError,
    lastErrorAt,
    onConflictRefetch,
    onConflictClearError,
    onSetFocusScheduleId,
  } = props;

  const handleConflictRefetchWithFocus = useCallback(() => {
    // Phase 2-2b: Set focus for post-refetch scroll + highlight
    if (lastError?.kind === 'conflict' && lastError.id) {
      onSetFocusScheduleId(lastError.id);
    }
    onConflictRefetch();
    onConflictClearError();
  }, [lastError, onSetFocusScheduleId, onConflictRefetch, onConflictClearError]);

  // Convert null to undefined for compatibility with ScheduleFormState
  const normalizeInitialOverride = useCallback(
    (override?: Partial<CreateScheduleEventInput>): Partial<ScheduleFormState> | null => {
      if (!override) return null;
      const { statusReason, acceptedOn: _acceptedOn, acceptedBy: _acceptedBy, acceptedNote: _acceptedNote, ...rest } = override;
      const normalized: Partial<ScheduleFormState> = {
        ...rest,
        statusReason: statusReason === null ? undefined : statusReason,
      };
      return normalized;
    },
    [],
  );

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
            serviceType:
              dialogInitialValues.serviceType === null || dialogInitialValues.serviceType === undefined
                ? ''
                : dialogInitialValues.serviceType,
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
          initialOverride={normalizeInitialOverride(scheduleDialogModeProps.initialOverride) ?? {}}
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
          initialOverride={normalizeInitialOverride(scheduleDialogModeProps.initialOverride)}
          onClose={onCreateDialogClose}
          onSubmit={onScheduleDialogSubmit}
          users={scheduleUserOptions}
          initialDate={typeof createDialogInitialDate === 'string' ? createDialogInitialDate : undefined}
          initialStartTime={createDialogInitialStartTime}
          initialEndTime={createDialogInitialEndTime}
          defaultUser={defaultScheduleUser}
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

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={onSnackClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={onSnackClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      {/* Phase 2-1c: Conflict snackbar for etag mismatch */}
      <Snackbar
        open={conflictOpen}
        autoHideDuration={8000}
        onClose={onConflictClearError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={onConflictClearError}
          action={
            <Stack direction="row" spacing={0.5}>
              <Button color="inherit" size="small" onClick={() => onConflictDetailClose()}>
                詳細を見る
              </Button>
              <Button color="inherit" size="small" onClick={handleConflictRefetchWithFocus}>
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
            onConflictDiscard();
            return;
          }
          onConflictDiscard();
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
              発生時刻: {lastErrorAt ? new Date(lastErrorAt).toLocaleTimeString('ja-JP') : '-'}
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onConflictDiscard} disabled={conflictBusy}>
            破棄して閉じる
          </Button>
          <Button variant="contained" onClick={onConflictReload} disabled={conflictBusy}>
            最新を読み込む
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
