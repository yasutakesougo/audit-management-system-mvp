import { TESTIDS } from '@/testids';
import { SaveAlt as SaveAltIcon, Save as SaveIcon } from '@mui/icons-material';
import { Button, DialogActions, Stack } from '@mui/material';
import React from 'react';
import type { TableDailyRecordViewModel } from '../../hooks/view-models/tableDailyRecordFormTypes';

type TableDailyRecordFooterProps = TableDailyRecordViewModel['sections']['footer'] & {
  onCancel: () => void;
};

export const TableDailyRecordFooter: React.FC<TableDailyRecordFooterProps> = ({
  saving,
  canSave,
  selectedUserCount,
  onSave,
  onSaveDraft,
  onCancel,
}) => {

  return (
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
          onClick={onSaveDraft}
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
          onClick={onCancel}
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
          onClick={onSave}
          disabled={!canSave}
          startIcon={<SaveIcon fontSize="small" />}
        >
          {saving ? '保存中...' : `${selectedUserCount}人分保存`}
        </Button>
      </Stack>
    </DialogActions>
  );
};
