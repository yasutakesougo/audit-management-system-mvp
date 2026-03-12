/**
 * ProposalReviewSection — 改善提案リスト（採否操作付き）
 *
 * Iceberg PDCA の ACT フェーズから生成された SupportChangeProposal を
 * ステータス別に色分け表示し、採否操作を提供する。
 *
 * Phase 6 S4: 採否操作 UI
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import { canTransition } from '@/features/support-plan-guide/domain/proposalStateMachine';
import type { SupportChangeProposal, ProposalStatus } from '@/features/support-plan-guide/domain/proposalTypes';

type Props = {
  proposals: SupportChangeProposal[];
  onStatusChange?: (proposalId: string, newStatus: ProposalStatus) => void;
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

type ActionDef = {
  target: ProposalStatus;
  label: string;
  color: 'success' | 'inherit' | 'error';
  tooltip: string;
};

const ACTIONS: ActionDef[] = [
  { target: 'accepted', label: '採用', color: 'success', tooltip: '支援計画に反映する' },
  { target: 'deferred', label: '保留', color: 'inherit', tooltip: '次回モニタリングで再検討' },
  { target: 'rejected', label: '却下', color: 'error', tooltip: 'この提案を見送る' },
];

export const ProposalReviewSection: React.FC<Props> = ({ proposals, onStatusChange }) => {
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
          const isTerminal = proposal.status === 'accepted' || proposal.status === 'rejected';

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
                opacity: isTerminal ? 0.7 : 1,
              }}
            >
              <Box sx={{ mt: 0.25 }}>{config.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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

                {/* Action buttons */}
                {onStatusChange && !isTerminal && (
                  <ButtonGroup size="small" sx={{ mt: 1 }} data-testid={`proposal-actions-${proposal.id}`}>
                    {ACTIONS.map((action) => {
                      const allowed = canTransition(proposal.status, action.target);
                      if (!allowed) return null;
                      return (
                        <Tooltip key={action.target} title={action.tooltip}>
                          <Button
                            color={action.color}
                            onClick={() => onStatusChange(proposal.id, action.target)}
                            data-testid={`proposal-${action.target}-${proposal.id}`}
                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                          >
                            {action.label}
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </ButtonGroup>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};
