import { TESTIDS } from '@/testids';
import { SaveAlt as SaveAltIcon, Save as SaveIcon } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    Stack,
    Typography
} from '@mui/material';
import { useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { BehaviorPatternSuggestionPanel } from '../sections/BehaviorPatternSuggestionPanel';
import { BehaviorTagCrossInsightPanel } from '../sections/BehaviorTagCrossInsightPanel';
import { BehaviorTagInsightBar } from '../sections/BehaviorTagInsightBar';
import { QuickTagArea } from '../sections/QuickTagArea';
import { TableDailyRecordTable } from '../sections/TableDailyRecordTable';
import { TableDailyRecordUserPicker } from '../sections/TableDailyRecordUserPicker';
import { computeBehaviorTagCrossInsights, type CrossInsightInput } from '../../domain/behavior/behaviorTagCrossInsights';
// removed unused suggestionAction imports
import type { PatternSuggestion } from '../../domain/behavior/behaviorPatternSuggestions';
import type { DailyRecordRepository } from '../../domain/legacy/DailyRecordRepository';
import {
    useTableDailyRecordForm,
    type UseTableDailyRecordFormResult,
} from '../../hooks/view-models/useTableDailyRecordForm';

interface TableDailyRecordFormProps {
  open?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  repository: DailyRecordRepository;
  variant?: 'dialog' | 'content';
  /**
   * Controlled mode: when provided, the form skips calling
   * useTableDailyRecordForm internally and uses this state instead.
   * Used by TableDailyRecordPage to lift state for header actions.
   */
  controlledState?: UseTableDailyRecordFormResult;
}

export function TableDailyRecordForm({
  open = false,
  onClose,
  onSuccess,
  repository,
  variant = 'dialog',
  controlledState,
}: TableDailyRecordFormProps) {
  // Internal hook — only called when NOT in controlled mode
  const internalState = useTableDailyRecordFormConditional(
    controlledState ? null : { open, onClose, onSuccess, repository },
  );

  const state = controlledState ?? internalState!;

  // ── ViewModel Access (PR 3-C) ─────────────────────
  const { vm } = state;
  const { state: vmState, flags: vmFlags, actions: vmActions } = vm;

  // ── Legacy Structured access ────────────────────────
  // To be progressively deprecated in PR 3-C-2 and 3-C-3
  // All handlers and state successfully migrated to ViewModel.

  const content = (
    <>
      {/* ── Main content ── */}
      <DialogContent dividers sx={{ py: 1, px: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Stack spacing={1} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* User picker (accordion) + Handoff indicator */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ flex: 1 }}>
              <TableDailyRecordUserPicker
                formDate={vmState.formData.date}
                searchQuery={vmState.searchQuery}
                onSearchQueryChange={vmActions.setSearchQuery}
                showTodayOnly={vmState.showTodayOnly}
                onToggleShowToday={() => vmActions.setShowTodayOnly(!vmState.showTodayOnly)}
                onSelectAll={vmActions.selectAllUsers}
                onClearAll={vmActions.clearAllUsers}
                filteredUsers={vmState.filteredUsers}
                selectedUserIds={vmState.selectedUserIds}
                onUserToggle={vmActions.toggleUser}
                defaultExpanded={variant === 'content'}
                autoFocusSearch={variant === 'content'}
              />
            </Box>
            {!vmState.handoff.loading && vmState.handoff.totalCount > 0 && (
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={`申送${vmState.handoff.totalCount}件→${vmState.handoff.affectedUserCount}名`}
                sx={{ fontSize: '0.65rem', height: 22, flexShrink: 0 }}
              />
            )}
          </Stack>

          {/* Validation errors */}
          <Collapse in={vmFlags.hasValidationErrors}>
            <Alert
              severity="error"
              onClose={vmActions.clearValidationErrors}
              sx={{ py: 0.5 }}
              data-testid="daily-table-validation-errors"
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                入力内容を確認してください
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.75rem' }}>
                {vmState.validationErrors.date && <li>{vmState.validationErrors.date}</li>}
                {vmState.validationErrors.reporterName && <li>{vmState.validationErrors.reporterName}</li>}
                {vmState.validationErrors.selectedUsers && <li>{vmState.validationErrors.selectedUsers}</li>}
              </Box>
            </Alert>
          </Collapse>

          {/* Quick Tag Area — QuickRecord 1名記録時のみ */}
          {variant === 'content' && vmState.visibleRows.length === 1 && (
            <QuickTagArea
              rows={vmState.visibleRows}
              selectedTags={vmState.visibleRows[0].behaviorTags ?? []}
              onToggleTag={(tagKey) => vmActions.toggleBehaviorTag(vmState.visibleRows[0].userId, tagKey)}
            />
          )}

          {/* Behavior Tag Insight — 3行以上で行動タグ使用時のみ */}
          {vmState.visibleRows.length >= 3 && vmState.visibleRows.some(r => (r.behaviorTags ?? []).length > 0) && (
            <BehaviorTagInsightBar rows={vmState.visibleRows} />
          )}

          {/* Cross Insight — 行動タグ使用が3行以上時 */}
          {vmState.visibleRows.length >= 3 && vmState.visibleRows.some(r => (r.behaviorTags ?? []).length > 0) && (
            <BehaviorTagCrossInsightPanel rows={vmState.visibleRows} />
          )}

          {/* Pattern Suggestion — 行動タグ使用時のみ */}
          {vmState.visibleRows.length > 0 && vmState.visibleRows.some(r => (r.behaviorTags ?? []).length > 0) && (
            <SuggestionPanelMemo
              visibleRows={vmState.visibleRows}
              acceptSuggestion={vmActions.acceptSuggestion}
              dismissSuggestion={vmActions.dismissSuggestion}
            />
          )}

          {/* Table area — takes remaining space */}
          {vmState.formData.userRows.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <TableDailyRecordTable
                rows={vmState.visibleRows}
                onRowDataChange={vmActions.updateRowData}
                onProblemBehaviorChange={vmActions.changeProblemBehavior}
                onBehaviorTagToggle={vmActions.toggleBehaviorTag}
                onClearRow={vmActions.clearRowData}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      {/* ── Footer — only for dialog variant ── */}
      {variant === 'dialog' && (
        <DialogActions
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            px: 1.5,
            py: 0.5,
            zIndex: 1,
          }}
        >
          <Stack direction="row" spacing={0.75} sx={{ width: '100%' }}>
            <Button
              onClick={vmActions.saveDraft}
              disabled={vmState.saving}
              variant="outlined"
              size="small"
              sx={{ minHeight: 34, minWidth: 100, fontSize: '0.8rem' }}
              startIcon={<SaveAltIcon fontSize="small" />}
              data-testid={TESTIDS['daily-table-draft-save']}
            >
              下書き保存
            </Button>
            <Button
              onClick={onClose}
              disabled={vmState.saving}
              variant="outlined"
              size="small"
              fullWidth
              sx={{ minHeight: 34, fontSize: '0.8rem' }}
            >
              キャンセル
            </Button>
            <Button
              variant="contained"
              size="small"
              fullWidth
              sx={{ minHeight: 34, fontSize: '0.8rem' }}
              onClick={vmActions.save}
              disabled={!vmFlags.canSave}
              startIcon={<SaveIcon fontSize="small" />}
            >
              {vmState.saving ? '保存中...' : `${vmState.selectedUserIds.length}人分保存`}
            </Button>
          </Stack>
        </DialogActions>
      )}
    </>
  );

  if (variant === 'content') {
    return (
      <Box data-testid={TESTIDS['daily-table-record-form']} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Toaster position="top-center" />
        {content}
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      data-testid={TESTIDS['daily-table-record-form']}
    >
      <Toaster position="top-center" />
      {content}
    </Dialog>
  );
}

/**
 * Conditional wrapper: calls useTableDailyRecordForm only when params is non-null.
 * This avoids breaking React's hooks rules — the hook is always called,
 * but with dummy params when in controlled mode.
 */
function useTableDailyRecordFormConditional(
  params: { open: boolean; onClose: () => void; onSuccess: () => void; repository: DailyRecordRepository } | null,
): UseTableDailyRecordFormResult | null {
  // Always call the hook (React rules), but use no-op params when controlled
  const effectiveParams = params ?? {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    repository: {} as DailyRecordRepository,
  };
  const result = useTableDailyRecordForm(effectiveParams);
  return params ? result : null;
}

/**
 * Suggestion パネルのメモ化ラッパー。
 * visibleRows から crossInsights を計算し BehaviorPatternSuggestionPanel に渡す。
 * Issue #9: accept/dismiss ハンドラを結線。
 */
function SuggestionPanelMemo({
  visibleRows,
  acceptSuggestion,
  dismissSuggestion,
}: {
  visibleRows: CrossInsightInput[];
  acceptSuggestion: (userId: string, suggestion: PatternSuggestion) => void;
  dismissSuggestion: (userId: string, suggestion: PatternSuggestion) => void;
}) {
  const crossInsights = useMemo(
    () => computeBehaviorTagCrossInsights(visibleRows),
    [visibleRows],
  );

  // 最初の visibleRow の acceptedSuggestions を取得（1名 QuickRecord 時に主に使用）
  const firstRow = visibleRows[0] as import('../../hooks/view-models/useTableDailyRecordForm').UserRowData | undefined;
  const acceptedSuggestions = firstRow?.acceptedSuggestions;

  const handleAccept = useCallback((suggestion: PatternSuggestion) => {
    if (!firstRow) return;
    acceptSuggestion(firstRow.userId, suggestion);
  }, [firstRow, acceptSuggestion]);

  const handleDismiss = useCallback((suggestion: PatternSuggestion) => {
    if (!firstRow) return;
    dismissSuggestion(firstRow.userId, suggestion);
  }, [firstRow, dismissSuggestion]);

  return (
    <BehaviorPatternSuggestionPanel
      insights={crossInsights}
      acceptedSuggestions={acceptedSuggestions}
      onAcceptSuggestion={handleAccept}
      onDismissSuggestion={handleDismiss}
    />
  );
}
