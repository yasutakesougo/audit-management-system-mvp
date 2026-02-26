import { TableDailyRecordForm } from '@/features/daily/TableDailyRecordForm';
import type { TableDailyRecordData } from '@/features/daily/hooks/useTableDailyRecordForm';
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
}

export const QuickRecordFormEmbed: React.FC<QuickRecordFormEmbedProps> = ({
  userId: _userId,
  date: _date,
  onClose,
}) => {
  // PR4 Minimum DoD: Ensure save just closes the form (we are not building save logic yet).
  // The goal is just to render the form safely.
  const handleSave = async (data: TableDailyRecordData) => {
    if (isDevMode() || isE2E()) {
      // eslint-disable-next-line no-console
      console.log('Intercepted Save in QuickRecordFormEmbed:', data);
    }
    onClose();
  };

  return (
    <Box data-testid="today-quickrecord-form-embed" sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <TableDailyRecordForm
        open={true}
        variant="content"
        onClose={onClose}
        onSave={handleSave}
      />
    </Box>
  );
};
