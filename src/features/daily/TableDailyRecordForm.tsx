import { TESTIDS } from '@/testids';
import {
    FilterList as FilterListIcon,
    Group as GroupIcon,
    SaveAlt as SaveAltIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography
} from '@mui/material';
import { useEffect, useRef } from 'react';
import { TableDailyRecordHeader } from './components/TableDailyRecordHeader';
import { TableDailyRecordTable } from './components/TableDailyRecordTable';
import { TableDailyRecordUserPicker } from './components/TableDailyRecordUserPicker';
import { useTableDailyRecordForm, type TableDailyRecordData } from './hooks/useTableDailyRecordForm';

interface TableDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
  variant?: 'dialog' | 'content';
  initialUserId?: string;
  initialDate?: string;
}

export function TableDailyRecordForm({
  open,
  onClose,
  onSave,
  variant = 'dialog',
  initialUserId,
  initialDate,
}: TableDailyRecordFormProps) {
  const form = useTableDailyRecordForm({
    open,
    onClose,
    onSave,
  });

  const {
    formData,
    setFormData,
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
    showUnsentOnly,
    setShowUnsentOnly,
    visibleRows,
    unsentRowCount,
    hasDraft,
    draftSavedAt,
    handleSaveDraft,
    handleSave,
    saving,
  } = form;

  const didInitDateRef = useRef(false);

  // 1. Initialize date once
  useEffect(() => {
    if (didInitDateRef.current) return;
    didInitDateRef.current = true;
    if (initialDate) {
      setFormData((prev) => ({ ...prev, date: initialDate }));
    }
  }, [initialDate, setFormData]);

  const lastInitUserIdRef = useRef<string | null>(null);

  // 2. Initialize user once when available
  useEffect(() => {
    if (!initialUserId) return;
    if (lastInitUserIdRef.current === initialUserId) return;

    // Use a short delay so that useTableDailyRecordSelection's internal attendance-based
    // auto-selection finishes first, and then we forcefully overwrite it.
    const t = setTimeout(() => {
      handleClearAll();
      handleUserToggle(initialUserId);
      lastInitUserIdRef.current = initialUserId;
    }, 50);

    return () => clearTimeout(t);
  }, [
    initialUserId,
    handleUserToggle,
    handleClearAll,
  ]);

  const displayedUnsentCount = Math.max(unsentRowCount, selectedUserIds.length);

  const content = (
    <>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <GroupIcon />
            一覧形式ケース記録入力
          </Box>
          <Stack direction="row" spacing={1}>
            {displayedUnsentCount > 0 && (
              <Chip
                label={`未送信 ${displayedUnsentCount}件`}
                color={showUnsentOnly ? 'primary' : 'default'}
                variant={showUnsentOnly ? 'filled' : 'outlined'}
                size="small"
                clickable
                onClick={() => setShowUnsentOnly(true)}
                data-testid={TESTIDS['daily-table-unsent-count-chip']}
              />
            )}
            {hasDraft && (
              <Chip
                label={`下書き保存済み${draftSavedAt ? ` (${new Date(draftSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})` : ''}`}
                color="warning"
                variant="outlined"
                size="small"
                data-testid={TESTIDS['daily-table-draft-status']}
              />
            )}
          </Stack>
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          利用者を行として並べて、各項目を効率的に一覧入力できます
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <TableDailyRecordHeader
            date={formData.date}
            reporterName={formData.reporter.name}
            reporterRole={formData.reporter.role}
            onDateChange={(value) => setFormData((prev) => ({ ...prev, date: value }))}
            onReporterNameChange={(value) => setFormData((prev) => ({
              ...prev,
              reporter: { ...prev.reporter, name: value },
            }))}
            onReporterRoleChange={(value) => setFormData((prev) => ({
              ...prev,
              reporter: { ...prev.reporter, role: value },
            }))}
          />

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

          {formData.userRows.length > 0 && (
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant={showUnsentOnly ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowUnsentOnly((prev) => !prev)}
                  data-testid={TESTIDS['daily-table-unsent-filter']}
                >
                  {showUnsentOnly ? '未送信のみ表示中' : '未送信のみ'}
                </Button>
              </Stack>
              <TableDailyRecordTable
                rows={visibleRows}
                onRowDataChange={handleRowDataChange}
                onProblemBehaviorChange={handleProblemBehaviorChange}
                onClearRow={handleClearRow}
              />
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          zIndex: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          <Button
            onClick={handleSaveDraft}
            disabled={saving}
            variant="outlined"
            size="large"
            sx={{ minHeight: 48, minWidth: 132 }}
            startIcon={<SaveAltIcon />}
            data-testid={TESTIDS['daily-table-draft-save']}
          >
            下書き保存
          </Button>
          <Button
            onClick={onClose}
            disabled={saving}
            variant="outlined"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
            onClick={handleSave}
            disabled={saving || selectedUserIds.length === 0}
            startIcon={<SaveIcon />}
          >
            {saving ? '保存中...' : `${selectedUserIds.length}人分保存`}
          </Button>
        </Stack>
      </DialogActions>
    </>
  );

  if (variant === 'content') {
    return <Box data-testid={TESTIDS['daily-table-record-form']}>{content}</Box>;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      data-testid={TESTIDS['daily-table-record-form']}
    >
      {content}
    </Dialog>
  );
}
