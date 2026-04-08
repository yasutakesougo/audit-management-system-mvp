import WarningIcon from '@mui/icons-material/Warning';
import { TESTIDS } from '@/testids';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import GroupIcon from '@mui/icons-material/Group';
import SaveIcon from '@mui/icons-material/Save';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {
    Badge,
    Box,
    Button,
    Chip,
    Stack,
    TextField,
    Tooltip
} from '@mui/material';
import React from 'react';

import { FullScreenDailyDialogPage } from '../pages/FullScreenDailyDialogPage';
import { TableDailyRecordForm } from '../forms/TableDailyRecordForm';
import { useTableDailyRecordForm } from '../../hooks/view-models/useTableDailyRecordForm';
import { useTableDailyRecordViewModel } from './useTableDailyRecordViewModel';



export const TableDailyRecordPage: React.FC = () => {
  const vm = useTableDailyRecordViewModel();

  const formState = useTableDailyRecordForm({
    open: vm.open,
    onClose: vm.onClose,
    onSuccess: vm.onSuccess,
    repository: vm.repository,
  });

  const { header, picker, table, draft, actions } = formState;

  const displayedUnsentCount = Math.max(table.unsentRowCount, picker.selectedUserIds.length);

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      {/* ── Record metadata (date / reporter / role) ── */}
      <TextField
        type="date"
        size="small"
        value={header.formData.date}
        onChange={(e) => header.setFormData((prev) => ({ ...prev, date: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        sx={{
          width: 130,
          '& .MuiInputBase-root': { height: 30, fontSize: '0.75rem' },
          '& .MuiInputBase-input': { py: 0.5, px: 1 },
        }}
      />
      <TextField
        size="small"
        value={header.formData.reporter.name}
        onChange={(e) => header.setFormData((prev) => ({
          ...prev,
          reporter: { ...prev.reporter, name: e.target.value },
        }))}
        placeholder="記録者"
        sx={{
          width: 90,
          '& .MuiInputBase-root': { height: 30, fontSize: '0.75rem' },
          '& .MuiInputBase-input': { py: 0.5, px: 1 },
        }}
      />


      {/* ── Divider ── */}
      <Box sx={{ borderLeft: 2, borderColor: 'grey.300', height: 28, mx: 0.5 }} />

      {/* ── User count badge ── */}
      <Tooltip title="利用者の選択は下のリストで変更できます">
        <Badge
          badgeContent={picker.selectedUserIds.length}
          color="primary"
          max={99}
        >
          <GroupIcon fontSize="small" color="action" />
        </Badge>
      </Tooltip>

      {/* ── Unsent filter toggle ── */}
      {displayedUnsentCount > 0 && (
        <Tooltip title={table.showUnsentOnly ? '全件表示に戻す' : '未送信のみ表示'}>
          <Chip
            icon={table.showUnsentOnly ? <FilterListOffIcon sx={{ fontSize: 14 }} /> : <FilterListIcon sx={{ fontSize: 14 }} />}
            label={`未送信${displayedUnsentCount}`}
            size="small"
            color={table.showUnsentOnly ? 'primary' : 'default'}
            variant={table.showUnsentOnly ? 'filled' : 'outlined'}
            onClick={() => table.setShowUnsentOnly((prev) => !prev)}
            sx={{ height: 24, fontSize: '0.7rem', cursor: 'pointer' }}
            data-testid={TESTIDS['daily-table-unsent-count-chip']}
          />
        </Tooltip>
      )}

      {/* ── Missing filter status ── */}
      {table.showMissingOnly && (
        <Tooltip title="全件表示に戻す（未入力フィルタ解除）">
          <Chip
            icon={<WarningIcon sx={{ fontSize: 14 }} />}
            label="未入力のみ"
            size="small"
            color="error"
            variant="filled"
            onDelete={() => table.setShowMissingOnly(false)}
            sx={{ height: 24, fontSize: '0.7rem', cursor: 'pointer' }}
          />
        </Tooltip>
      )}

      {/* ── Draft status ── */}
      {draft.hasDraft && (
        <Chip
          label={`下書き${draft.draftSavedAt ? ` ${new Date(draft.draftSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          color="warning"
          variant="outlined"
          size="small"
          sx={{ height: 24, fontSize: '0.7rem' }}
          data-testid={TESTIDS['daily-table-draft-status']}
        />
      )}

      {/* ── Divider ── */}
      <Box sx={{ borderLeft: 2, borderColor: 'grey.300', height: 28, mx: 0.5 }} />

      {/* ── Save actions ── */}
      <Button
        onClick={draft.handleSaveDraft}
        disabled={actions.saving}
        variant="outlined"
        size="small"
        sx={{
          minHeight: 30,
          fontSize: '0.75rem',
          borderColor: 'divider',
          color: 'text.secondary',
          px: 1.5,
        }}
        startIcon={<SaveAltIcon sx={{ fontSize: 16 }} />}
        data-testid={TESTIDS['daily-table-draft-save']}
      >
        下書き
      </Button>
      <Button
        variant="contained"
        size="small"
        sx={{ minHeight: 30, fontSize: '0.75rem', px: 1.5 }}
        onClick={actions.handleSave}
        disabled={actions.saving || picker.selectedUserIds.length === 0}
        startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
      >
        {actions.saving
          ? '保存中...'
          : `${picker.selectedUserIds.length}人分保存`}
      </Button>
    </Stack>
  );

  return (
    <FullScreenDailyDialogPage
      open={vm.open}
      title={vm.title}
      backTo={vm.backTo}
      testId={vm.testId}
      onClose={vm.onClose}
      busy={actions.saving}
      headerActions={headerActions}
    >
      <TableDailyRecordForm
        onClose={vm.onClose}
        onSuccess={vm.onSuccess}
        repository={vm.repository}
        variant="content"
        controlledState={formState}
      />
    </FullScreenDailyDialogPage>
  );
};

export default TableDailyRecordPage;
