import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { TodayUserSnapshot } from '../../domain/userDetailHubLogic';
import { URGENCY_COLORS } from './constants';

export const TodaySnapshotSection: React.FC<{ snapshot: TodayUserSnapshot; onAction: (path: string) => void }> = ({ snapshot, onAction }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderRadius: 2,
      borderLeft: 4,
      borderLeftColor: URGENCY_COLORS[snapshot.urgency],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
    }}
    data-testid="user-detail-today-snapshot"
  >
    <Box flex={1}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        今日の次アクション
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.25, color: URGENCY_COLORS[snapshot.urgency] }}>
        {snapshot.nextAction}
      </Typography>
    </Box>
    <Button
      variant="contained"
      size="small"
      onClick={() => onAction(snapshot.nextActionPath)}
      sx={{ bgcolor: URGENCY_COLORS[snapshot.urgency], '&:hover': { bgcolor: URGENCY_COLORS[snapshot.urgency], filter: 'brightness(0.9)' }, whiteSpace: 'nowrap', flexShrink: 0 }}
      data-testid="user-detail-snapshot-action"
    >
      移動する
    </Button>
  </Paper>
);
