import React from 'react';
import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { HeaderInfoArea } from './components/HeaderInfoArea';
import { RecordGrid } from './components/RecordGrid';
import { useDailyCareStore } from './store';
import type { Contract, DailyRecord, UserMaster } from './types';

export interface RecordEntryPageProps {
  user: UserMaster;
  contract: Contract;
}

export function RecordEntryPage({ user, contract }: RecordEntryPageProps) {
  const initializeMonth = useDailyCareStore(state => state.initializeMonth);
  const reset = useDailyCareStore(state => state.reset);
  const records = useDailyCareStore(state => state.records);
  const summary = useDailyCareStore(state => state.monthlySummary);
  const updateRecord = useDailyCareStore(state => state.updateRecord);

  React.useEffect(() => {
    initializeMonth(user, contract);
    return () => reset();
  }, [user, contract, initializeMonth, reset]);

  const handleRecordChange = React.useCallback(
    (date: string, changes: Partial<DailyRecord>) => {
      updateRecord(date, changes);
    },
    [updateRecord],
  );

  return (
    <Container sx={{ py: 4 }} maxWidth="lg">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            サービス提供実績記録
          </Typography>
          <Typography variant="body2" color="text.secondary">
            標準時間をベースに日々の例外を入力すると、自動で月次集計が更新されます。
          </Typography>
        </Box>
        <HeaderInfoArea user={user} contract={contract} summary={summary} />
        <Divider />
        <RecordGrid
          records={records}
          mealAddonEnabled={user.isEligibleForMealAddon}
          onChange={handleRecordChange}
        />
      </Stack>
    </Container>
  );
}

