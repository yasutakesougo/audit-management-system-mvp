import { TableDailyRecordForm } from '@/features/daily/components/forms/TableDailyRecordForm';
import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  date,
  onClose,
  onSaveSuccess,
}) => {
  const repository = useDailyRecordRepository();

  const handleSuccess = () => {
    if (isDevMode() || isE2E()) {
      // eslint-disable-next-line no-console
      console.log('Intercepted Save Success in QuickRecordFormEmbed');
    }
    onSaveSuccess?.();
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
        onSuccess={handleSuccess}
        repository={repository}
      />
    </Box>
  );
};
