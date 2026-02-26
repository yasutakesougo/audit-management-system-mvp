import { TableDailyRecordForm } from '@/features/daily/TableDailyRecordForm';
import type { TableDailyRecordData } from '@/features/daily/hooks/useTableDailyRecordForm';
import { useTableDailyRecordSave } from '@/features/daily/useTableDailyRecordSave';
import { isDevMode, isE2E } from '@/lib/env';
import { Box } from '@mui/material';
import React from 'react';

/**
 * PR4 Step C:
 * Wrapper component to embed `TableDailyRecordForm` inside `QuickRecordDrawer`.
 * This isolates the dependency on Daily features from the Today layout.
 */
export interface QuickRecordFormEmbedProps {
  userId?: string;
  date?: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const QuickRecordFormEmbed: React.FC<QuickRecordFormEmbedProps> = ({
  userId,
  date,
  onClose,
  onSaveSuccess,
}) => {
  const { save } = useTableDailyRecordSave();

  // PR6 Step E:
  // - Save the data using shared daily save logic.
  // - On success, close the drawer.
  // - On failure, let the form's inner snackbar catch and display the error without closing.
  const handleSave = async (data: TableDailyRecordData) => {
    if (isDevMode() || isE2E()) {
      // eslint-disable-next-line no-console
      console.log('Intercepted Save in QuickRecordFormEmbed:', data);
    }

    await save(data); // 成功したらここを通る
    onSaveSuccess?.();
    onClose();        // 成功時のみ閉じる
  };

  return (
    <Box data-testid="today-quickrecord-form-embed" sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Box data-testid="today-quickrecord-target-userid" sx={{ display: 'none' }}>
        {userId ?? ''}
      </Box>
      <TableDailyRecordForm
        open={true}
        variant="content"
        onClose={onClose}
        onSave={handleSave}
        initialUserId={userId}
        initialDate={date}
      />
    </Box>
  );
};
