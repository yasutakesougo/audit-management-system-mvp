/**
 * OpsDetailHandoffSection — 詳細パネル: 申し送りセクション
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';

export type OpsDetailHandoffSectionProps = {
  item: ScheduleOpsItem;
};

export const OpsDetailHandoffSection: FC<OpsDetailHandoffSectionProps> = ({ item }) => {
  if (!item.handoffSummary) return null;

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        申し送り・連絡事項
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', backgroundColor: 'action.hover', p: 1.5, borderRadius: 1 }}>
        {item.handoffSummary}
      </Typography>
    </Box>
  );
};
