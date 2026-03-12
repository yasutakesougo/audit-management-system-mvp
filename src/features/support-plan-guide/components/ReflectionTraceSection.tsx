/**
 * ReflectionTraceSection — 反映履歴表示（read-only）
 *
 * accepted 提案が支援計画に反映された監査証跡を時系列で表示する。
 *
 * Phase 6 S5: Evidence → Proposal → Plan Update のチェーンを可視化
 */
import HistoryIcon from '@mui/icons-material/History';
import TimelineIcon from '@mui/icons-material/Timeline';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { PlanReflectionTrace } from '@/features/support-plan-guide/domain/proposalTypes';

type Props = {
  traces: PlanReflectionTrace[];
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const ReflectionTraceSection: React.FC<Props> = ({ traces }) => {
  if (traces.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, bgcolor: '#e8f5e9', borderColor: '#a5d6a7', borderStyle: 'dashed' }}
      data-testid="reflection-trace-section"
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon sx={{ color: '#2e7d32' }} />
          <Typography variant="subtitle2" fontWeight="bold" color="success.dark">
            改善反映履歴
          </Typography>
          <Chip label={`${traces.length}件 反映済`} size="small" color="success" variant="outlined" />
        </Stack>

        <Divider />

        {traces.map((trace) => (
          <Box
            key={trace.id}
            data-testid={`trace-item-${trace.id}`}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <TimelineIcon fontSize="small" sx={{ color: 'success.main', mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="bold">
                {trace.proposalTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                📋 PDCA Item #{trace.evidenceChain.pdcaItemId} → 提案 → 採用 → monitoringPlan に反映
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                🕐 反映日: {formatDate(trace.reflectedAt)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};
