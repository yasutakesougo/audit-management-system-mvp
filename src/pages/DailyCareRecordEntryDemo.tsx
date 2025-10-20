import React from 'react';
import { Alert, Box } from '@mui/material';
import { RecordEntryPage } from '@/features/dailycare/RecordEntryPage';
import { sampleContract, sampleUser } from '@/features/dailycare/sampleData';

const DailyCareRecordEntryDemo: React.FC = () => (
  <Box sx={{ bgcolor: theme => theme.palette.background.default, minHeight: '100vh', py: 4 }}>
    <Box sx={{ mb: 2 }}>
      <Alert severity="info">
        デモデータで表示しています。ルーティング統合前の検証専用画面です。
      </Alert>
    </Box>
    <RecordEntryPage user={sampleUser} contract={sampleContract} />
  </Box>
);

export default DailyCareRecordEntryDemo;

