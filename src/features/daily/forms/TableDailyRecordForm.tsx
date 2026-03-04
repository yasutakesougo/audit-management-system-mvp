import { TESTIDS } from '@/testids';
import { SaveAlt as SaveAltIcon, Save as SaveIcon } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    Stack,
    Typography
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { TableDailyRecordTable } from '../components/TableDailyRecordTable';
import { TableDailyRecordUserPicker } from '../components/TableDailyRecordUserPicker';
import {
    useTableDailyRecordForm,
    type TableDailyRecordData,
    type UseTableDailyRecordFormResult,
} from '../hooks/useTableDailyRecordForm';

interface TableDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
  variant?: 'dialog' | 'content';
  /**
   * Controlled mode: when provided, the form skips calling
   * useTableDailyRecordForm internally and uses this state instead.
   * Used by TableDailyRecordPage to lift state for header actions.
   */
  controlledState?: UseTableDailyRecordFormResult;
}

export function TableDailyRecordForm({
  open,
  onClose,
  onSave,
  variant = 'dialog',
  controlledState,
}: TableDailyRecordFormProps) {
  // Internal hook — only called when NOT in controlled mode
  const internalState = useTableDailyRecordFormConditional(
    controlledState ? null : { open, onClose, onSave },
  );

  const state = controlledState ?? internalState!;

  const {
    formData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    filteredUsers,
    selectedUserIds,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleClearRow,
    visibleRows,
    handleSaveDraft,
    handleSave,
    saving,
    validationErrors,
    clearValidationErrors,
  } = state;

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const content = (
    <>
      {/* ── Main content ── */}
      <DialogContent dividers sx={{ py: 1, px: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Stack spacing={1} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* User picker (accordion) */}
          <TableDailyRecordUserPicker
            formDate={formData.date}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            showTodayOnly={showTodayOnly}
            onToggleShowToday={() => setShowTodayOnly(!showTodayOnly)}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            filteredUsers={filteredUsers}
            selectedUserIds={selectedUserIds}
            onUserToggle={handleUserToggle}
          />

          {/* Validation errors */}
          <Collapse in={hasValidationErrors}>
            <Alert
              severity="error"
              onClose={clearValidationErrors}
              sx={{ py: 0.5 }}
              data-testid="daily-table-validation-errors"
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                入力内容を確認してください
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.75rem' }}>
                {validationErrors.date && <li>{validationErrors.date}</li>}
                {validationErrors.reporterName && <li>{validationErrors.reporterName}</li>}
                {validationErrors.selectedUsers && <li>{validationErrors.selectedUsers}</li>}
              </Box>
            </Alert>
          </Collapse>

          {/* Table area — takes remaining space */}
          {formData.userRows.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <TableDailyRecordTable
                rows={visibleRows}
                onRowDataChange={handleRowDataChange}
                onProblemBehaviorChange={handleProblemBehaviorChange}
                onClearRow={handleClearRow}
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
              onClick={handleSaveDraft}
              disabled={saving}
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
              disabled={saving}
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
              onClick={handleSave}
              disabled={saving || selectedUserIds.length === 0}
              startIcon={<SaveIcon fontSize="small" />}
            >
              {saving ? '保存中...' : `${selectedUserIds.length}人分保存`}
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
  params: { open: boolean; onClose: () => void; onSave: (data: TableDailyRecordData) => Promise<void> } | null,
): UseTableDailyRecordFormResult | null {
  // Always call the hook (React rules), but use no-op params when controlled
  const effectiveParams = params ?? {
    open: false,
    onClose: () => {},
    onSave: async () => {},
  };
  const result = useTableDailyRecordForm(effectiveParams);
  return params ? result : null;
}
