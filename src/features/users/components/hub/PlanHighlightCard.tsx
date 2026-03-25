import React from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { PlanHighlight } from '../../domain/userDetailHubLogic';
import { PLAN_TYPE_COLORS, PLAN_TYPE_LABELS } from './constants';

export const PlanHighlightCard: React.FC<{ item: PlanHighlight }> = ({ item }) => (
  <Paper
    variant="outlined"
    sx={{ p: 1.5, borderRadius: 2, borderLeft: 3, borderLeftColor: PLAN_TYPE_COLORS[item.type] ?? '#757575' }}
    data-testid={`plan-highlight-${item.type}`}
  >
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
      <Chip
        label={PLAN_TYPE_LABELS[item.type] ?? item.type}
        size="small"
        sx={{ bgcolor: PLAN_TYPE_COLORS[item.type] ?? '#757575', color: '#fff', height: 20, fontSize: '0.65rem' }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.label}</Typography>
    </Stack>
    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{item.excerpt}</Typography>
  </Paper>
);
