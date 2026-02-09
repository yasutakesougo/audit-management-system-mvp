import { TESTIDS } from '@/testids';
import { TableDailyRecordHeader } from './components/TableDailyRecordHeader';
import { TableDailyRecordTable } from './components/TableDailyRecordTable';
import { TableDailyRecordUserPicker } from './components/TableDailyRecordUserPicker';
import { useTableDailyRecordForm, type TableDailyRecordData } from './hooks/useTableDailyRecordForm';
import {
    Group as GroupIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography
} from '@mui/material';
import React from 'react';

interface TableDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
  variant?: 'dialog' | 'content';
}

export function TableDailyRecordForm({
  open,
  onClose,
  onSave,
  variant = 'dialog'
}: TableDailyRecordFormProps) {
  const {
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    filteredUsers,
    selectedUsers,
    selectedUserIds,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleClearRow,
    handleSave,
    saving,
  } = useTableDailyRecordForm({
    open,
    onClose,
    onSave,
  });

  const content = (
    <>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GroupIcon />
          一覧形式ケース記録入力
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

          {selectedUsers.length > 0 && (
            <TableDailyRecordTable
              rows={formData.userRows}
              onRowDataChange={handleRowDataChange}
              onProblemBehaviorChange={handleProblemBehaviorChange}
              onClearRow={handleClearRow}
            />
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
    return <Box>{content}</Box>;
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