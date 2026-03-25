import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ActivityRank } from '../../domain/monitoringDailyAnalytics';

export const ActivityList: React.FC<{ label: string; items: ActivityRank[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.5 }}>
        {items.map((a) => (
          <Chip
            key={a.label}
            label={`${a.label} (${a.count}回)`}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
    </Box>
  );
};
