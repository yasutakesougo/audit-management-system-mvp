import React from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { HandoffPreviewItem } from '../../domain/userDetailHubLogic';

export const HandoffPreviewCard: React.FC<{ item: HandoffPreviewItem }> = ({ item }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.5,
      borderRadius: 2,
      borderLeft: 3,
      borderLeftColor: item.severity === '重要' ? 'error.main' : 'divider',
    }}
    data-testid={`handoff-preview-${item.id}`}
  >
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
      {item.severity === '重要' && <Chip label="重要" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />}
      <Chip label={item.status} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
      <Typography variant="caption" color="text.secondary">{item.createdAt}</Typography>
    </Stack>
    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{item.message}</Typography>
  </Paper>
);
