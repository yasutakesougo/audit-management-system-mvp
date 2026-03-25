import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { SummaryStat } from '../../domain/userDetailHubLogic';

export type SummaryStatCardProps = {
  stat: SummaryStat;
};

export const SummaryStatCard: React.FC<SummaryStatCardProps> = ({ stat }) => {
  const borderColor = stat.severity === 'attention'
    ? 'warning.main'
    : stat.severity === 'good'
      ? 'success.main'
      : 'divider';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        borderLeft: 3,
        borderLeftColor: borderColor,
        textAlign: 'center',
      }}
      data-testid={`summary-stat-${stat.key}`}
    >
      <Box sx={{ fontSize: 20, mb: 0.5 }}>{stat.icon}</Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {stat.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {stat.value}
      </Typography>
    </Paper>
  );
};
