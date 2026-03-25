import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { UnifiedRecommendation } from '@/features/recommendation/domain/unifiedRecommendation';
import { URGENCY_PALETTE } from './constants';

export const RecommendationBanner: React.FC<{
  rec: UnifiedRecommendation;
  onAction: (route: string) => void;
}> = ({ rec, onAction }) => {
  const p = URGENCY_PALETTE[rec.urgency];
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderLeft: 4,
        borderColor: p.border,
        bgcolor: p.bg,
      }}
      data-testid="user-detail-recommendation-banner"
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box flex={1}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: p.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {p.icon} 今日の推奨
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: p.text, mt: 0.25 }}>
            {rec.headline}
          </Typography>
          {rec.secondaryNotes.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
              {rec.secondaryNotes.map((note, i) => (
                <Chip key={i} label={note} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, borderColor: p.border, color: p.text }} />
              ))}
            </Stack>
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={() => onAction(rec.actionRoute)}
          sx={{ bgcolor: p.border, '&:hover': { bgcolor: p.border, filter: 'brightness(0.9)' }, whiteSpace: 'nowrap', flexShrink: 0 }}
          data-testid="user-detail-recommendation-action"
        >
          {rec.suggestedAction}
        </Button>
      </Stack>
    </Paper>
  );
};
