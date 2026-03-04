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
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip
} from '@mui/material';
import React from 'react';

import { FullScreenDailyDialogPage } from '../components/FullScreenDailyDialogPage';
import { TableDailyRecordForm } from '../forms/TableDailyRecordForm';
import { useTableDailyRecordForm } from '../hooks/useTableDailyRecordForm';
import { useTableDailyRecordViewModel } from './useTableDailyRecordViewModel';

const ROLE_OPTIONS = ['生活支援員', '管理者', '看護師', '其他'];

export const TableDailyRecordPage: React.FC = () => {
  const vm = useTableDailyRecordViewModel();

  const formState = useTableDailyRecordForm({
    open: vm.open,
    onClose: vm.onClose,
    onSave: vm.onSave,
  });

  const displayedUnsentCount = Math.max(formState.unsentRowCount, formState.selectedUserIds.length);

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      {/* ── Record metadata (date / reporter / role) ── */}
      <TextField
        type="date"
        size="small"
        value={formState.formData.date}
        onChange={(e) => formState.setFormData((prev) => ({ ...prev, date: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        sx={{
          width: 130,
          '& .MuiInputBase-root': { height: 30, fontSize: '0.75rem' },
          '& .MuiInputBase-input': { py: 0.5, px: 1 },
        }}
      />
      <TextField
        size="small"
        value={formState.formData.reporter.name}
        onChange={(e) => formState.setFormData((prev) => ({
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
      <FormControl size="small" sx={{ minWidth: 80 }}>
        <InputLabel sx={{ fontSize: '0.7rem', top: -4 }}>役職</InputLabel>
        <Select
          value={formState.formData.reporter.role}
          onChange={(e) => formState.setFormData((prev) => ({
            ...prev,
            reporter: { ...prev.reporter, role: e.target.value },
          }))}
          label="役職"
          sx={{ height: 30, fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
        >
          {ROLE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: '0.8rem' }}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ── Divider ── */}
      <Box sx={{ borderLeft: 2, borderColor: 'grey.300', height: 28, mx: 0.5 }} />

      {/* ── User count badge ── */}
      <Tooltip title="利用者の選択は下のリストで変更できます">
        <Badge
          badgeContent={formState.selectedUserIds.length}
          color="primary"
          max={99}
        >
          <GroupIcon fontSize="small" color="action" />
        </Badge>
      </Tooltip>

      {/* ── Unsent filter toggle ── */}
      {displayedUnsentCount > 0 && (
        <Tooltip title={formState.showUnsentOnly ? '全件表示に戻す' : '未送信のみ表示'}>
          <Chip
            icon={formState.showUnsentOnly ? <FilterListOffIcon sx={{ fontSize: 14 }} /> : <FilterListIcon sx={{ fontSize: 14 }} />}
            label={`未送信${displayedUnsentCount}`}
            size="small"
            color={formState.showUnsentOnly ? 'primary' : 'default'}
            variant={formState.showUnsentOnly ? 'filled' : 'outlined'}
            onClick={() => formState.setShowUnsentOnly((prev) => !prev)}
            sx={{ height: 24, fontSize: '0.7rem', cursor: 'pointer' }}
            data-testid={TESTIDS['daily-table-unsent-count-chip']}
          />
        </Tooltip>
      )}

      {/* ── Draft status ── */}
      {formState.hasDraft && (
        <Chip
          label={`下書き${formState.draftSavedAt ? ` ${new Date(formState.draftSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
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
        onClick={formState.handleSaveDraft}
        disabled={formState.saving}
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
        onClick={formState.handleSave}
        disabled={formState.saving || formState.selectedUserIds.length === 0}
        startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
      >
        {formState.saving
          ? '保存中...'
          : `${formState.selectedUserIds.length}人分保存`}
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
      busy={formState.saving}
      headerActions={headerActions}
    >
      <TableDailyRecordForm
        open={vm.open}
        onClose={vm.onClose}
        onSave={vm.onSave}
        variant="content"
        controlledState={formState}
      />
    </FullScreenDailyDialogPage>
  );
};

export default TableDailyRecordPage;
