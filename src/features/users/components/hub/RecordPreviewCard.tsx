import React from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { RecordPreviewItem } from '../../domain/userDetailHubLogic';

export const RecordPreviewCard: React.FC<{ item: RecordPreviewItem }> = ({ item }) => (
  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }} data-testid={`record-preview-${item.date}`}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 85 }}>{item.date}</Typography>
      <Chip
        label={item.status}
        size="small"
        color={item.status === '完了' ? 'success' : 'default'}
        sx={{ height: 20, fontSize: '0.65rem' }}
      />
      {item.hasSpecialNote && (
        <Chip label="特記あり" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
      )}
    </Stack>
    {item.noteExcerpt && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: '0.78rem' }}>
        📝 {item.noteExcerpt}
      </Typography>
    )}
  </Paper>
);
