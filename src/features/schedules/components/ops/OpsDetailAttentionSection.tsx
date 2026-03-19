/**
 * OpsDetailAttentionSection — 詳細パネル: 配慮事項セクション
 */

import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';

export type OpsDetailAttentionSectionProps = {
  item: ScheduleOpsItem;
};

export const OpsDetailAttentionSection: FC<OpsDetailAttentionSectionProps> = ({ item }) => {
  const theme = useTheme();

  if (!item.hasAttention && !item.attentionSummary && !item.medicalNote && !item.behavioralNote) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: alpha(theme.palette.error.main, 0.04),
        border: 1,
        borderColor: alpha(theme.palette.error.main, 0.2),
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theme.palette.error.main, mb: 1.5 }}>
        <ReportProblemIcon fontSize="small" />
        <Typography variant="subtitle2" fontWeight="bold">
          配慮・注意事項
        </Typography>
      </Box>

      {item.attentionSummary && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2">{item.attentionSummary}</Typography>
        </Box>
      )}

      {item.medicalNote && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            医療配慮
          </Typography>
          <Typography variant="body2">{item.medicalNote}</Typography>
        </Box>
      )}

      {item.behavioralNote && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            行動配慮
          </Typography>
          <Typography variant="body2">{item.behavioralNote}</Typography>
        </Box>
      )}
    </Paper>
  );
};
