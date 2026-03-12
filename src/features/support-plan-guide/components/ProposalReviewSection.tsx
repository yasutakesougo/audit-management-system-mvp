/**
 * ProposalReviewSection — 改善提案リスト（read-only 初期版）
 *
 * Iceberg PDCA の ACT フェーズから生成された SupportChangeProposal を
 * ステータス別に色分け表示する。
 *
 * Phase 6 S3: read-only 表示のみ（S4 で採否操作を追加予定）
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { SupportChangeProposal, ProposalStatus } from '@/features/support-plan-guide/domain/proposalTypes';

type Props = {
  proposals: SupportChangeProposal[];
};

const STATUS_CONFIG: Record<ProposalStatus, {
  label: string;
  color: 'warning' | 'success' | 'default' | 'error';
  icon: React.ReactElement;
}> = {
  proposed: { label: '提案中', color: 'warning', icon: <LightbulbIcon fontSize="small" /> },
  accepted: { label: '採用済', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  deferred: { label: '保留', color: 'default', icon: <HourglassEmptyIcon fontSize="small" /> },
  rejected: { label: '却下', color: 'error', icon: <RemoveCircleOutlineIcon fontSize="small" /> },
};

export const ProposalReviewSection: React.FC<Props> = ({ proposals }) => {
  if (proposals.length === 0) return null;

  const proposedCount = proposals.filter((p) => p.status === 'proposed').length;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, bgcolor: '#fff8e1', borderColor: '#ffe082', borderStyle: 'dashed' }}
      data-testid="proposal-review-section"
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LightbulbIcon sx={{ color: '#f9a825' }} />
          <Typography variant="subtitle2" fontWeight="bold">
            改善提案（Iceberg 分析起点）
          </Typography>
          {proposedCount > 0 && (
            <Chip label={`${proposedCount}件 未レビュー`} size="small" color="warning" />
          )}
        </Stack>

        <Divider />

        {proposals.map((proposal) => {
          const config = STATUS_CONFIG[proposal.status];
          return (
            <Box
              key={proposal.id}
              data-testid={`proposal-item-${proposal.id}`}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor: proposal.status === 'proposed' ? '#fff3e0' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ mt: 0.25 }}>{config.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight="bold">
                    {proposal.title}
                  </Typography>
                  <Chip
                    label={config.label}
                    size="small"
                    color={config.color}
                    variant={proposal.status === 'proposed' ? 'filled' : 'outlined'}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {proposal.rationale}
                </Typography>
                {proposal.reviewNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }}>
                    💬 {proposal.reviewNote}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};
