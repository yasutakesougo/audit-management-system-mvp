import { TESTIDS } from '@/testids';
import SaveIcon from '@mui/icons-material/Save';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { Button, Stack } from '@mui/material';
import React from 'react';

import { FullScreenDailyDialogPage } from '../components/FullScreenDailyDialogPage';
import { TableDailyRecordForm } from '../forms/TableDailyRecordForm';
import { useTableDailyRecordForm } from '../hooks/useTableDailyRecordForm';
import { useTableDailyRecordViewModel } from './useTableDailyRecordViewModel';

export const TableDailyRecordPage: React.FC = () => {
  const vm = useTableDailyRecordViewModel();

  // Lift form state to page level so we can render actions in the header
  const formState = useTableDailyRecordForm({
    open: vm.open,
    onClose: vm.onClose,
    onSave: vm.onSave,
  });

  const headerActions = (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Button
        onClick={formState.handleSaveDraft}
        disabled={formState.saving}
        variant="outlined"
        size="small"
        sx={{
          minHeight: 32,
          fontSize: '0.78rem',
          borderColor: 'divider',
          color: 'text.secondary',
        }}
        startIcon={<SaveAltIcon fontSize="small" />}
        data-testid={TESTIDS['daily-table-draft-save']}
      >
        下書き
      </Button>
      <Button
        variant="contained"
        size="small"
        sx={{ minHeight: 32, fontSize: '0.78rem', px: 2 }}
        onClick={formState.handleSave}
        disabled={formState.saving || formState.selectedUserIds.length === 0}
        startIcon={<SaveIcon fontSize="small" />}
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
