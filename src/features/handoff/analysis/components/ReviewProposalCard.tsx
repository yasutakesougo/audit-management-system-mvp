/**
 * ReviewProposalCard — 見直し提案カード（支援計画シート内に表示）
 *
 * 見直し提案の具体的アクションをカード形式で表示し、
 * 「この提案を確認しました」のチェック操作を提供する。
 */
import React from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AssignmentReturnRoundedIcon from '@mui/icons-material/AssignmentReturnRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import type { ReviewProposal, ProposalAction } from '../buildReviewProposal';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface Props {
  /** 見直し提案 */
  proposal: ReviewProposal;
  /** 確認済みフィールドの Set */
  reviewedFields?: Set<string>;
  /** フィールド確認時のコールバック */
  onFieldReviewed?: (fieldKey: string, reviewed: boolean) => void;
  /** ダッシュボード遷移 */
  onNavigateToDashboard?: () => void;
}

// ────────────────────────────────────────────────────────────
// Urgency → Card style
// ────────────────────────────────────────────────────────────

const URGENCY_STYLES = {
  urgent: {
    borderColor: '#d32f2f',
    bgColor: '#fff5f5',
    label: '🔴 緊急',
    chipColor: 'error' as const,
  },
  recommended: {
    borderColor: '#ed6c02',
    bgColor: '#fff8f0',
    label: '🟠 推奨',
    chipColor: 'warning' as const,
  },
  suggested: {
    borderColor: '#0288d1',
    bgColor: '#f0f7ff',
    label: '🔵 検討',
    chipColor: 'info' as const,
  },
  none: {
    borderColor: '#ccc',
    bgColor: '#fff',
    label: '',
    chipColor: 'default' as const,
  },
};

// ────────────────────────────────────────────────────────────
// Sub: 個別アクション行
// ────────────────────────────────────────────────────────────

const ActionRow: React.FC<{
  action: ProposalAction;
  reviewed: boolean;
  onToggle: (fieldKey: string, reviewed: boolean) => void;
}> = ({ action, reviewed, onToggle }) => (
  <Box
    sx={{
      px: 1.5,
      py: 1,
      borderRadius: 1,
      bgcolor: reviewed ? 'action.selected' : 'background.paper',
      border: '1px solid',
      borderColor: reviewed ? 'success.200' : 'divider',
      opacity: reviewed ? 0.7 : 1,
      transition: 'all 0.2s',
    }}
  >
    <FormControlLabel
      sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
      control={
        <Checkbox
          size="small"
          checked={reviewed}
          onChange={(_, checked) => onToggle(action.fieldKey, checked)}
          sx={{ pt: 0.25 }}
        />
      }
      label={
        <Stack spacing={0.25} sx={{ ml: 0.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" fontWeight={600} sx={{ textDecoration: reviewed ? 'line-through' : 'none' }}>
              {action.fieldLabel}
            </Typography>
            <Chip
              size="small"
              label={action.section}
              variant="outlined"
              sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.6rem' } }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {action.suggestion}
          </Typography>
          {action.evidenceSummary && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              根拠: {action.evidenceSummary.length > 60 ? `${action.evidenceSummary.slice(0, 60)}…` : action.evidenceSummary}
            </Typography>
          )}
        </Stack>
      }
    />
  </Box>
);

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

export const ReviewProposalCard: React.FC<Props> = ({
  proposal,
  reviewedFields = new Set(),
  onFieldReviewed,
  onNavigateToDashboard,
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const style = URGENCY_STYLES[proposal.urgency];
  
  const reviewedCount = proposal.actions.filter(a => reviewedFields.has(a.fieldKey)).length;
  const totalCount = proposal.actions.length;
  const allReviewed = reviewedCount === totalCount && totalCount > 0;

  const handleToggle = (fieldKey: string, reviewed: boolean) => {
    onFieldReviewed?.(fieldKey, reviewed);
  };

  if (proposal.urgency === 'none' || totalCount === 0) return null;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: style.borderColor,
        borderWidth: proposal.urgency === 'urgent' ? 2 : 1,
        bgcolor: allReviewed ? 'action.hover' : style.bgColor,
        transition: 'all 0.3s',
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack spacing={1.5}>
          {/* ── ヘッダー ── */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AssignmentReturnRoundedIcon color={style.chipColor === 'default' ? 'inherit' : style.chipColor} fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>
                支援計画 見直し提案
              </Typography>
              <Chip
                size="small"
                label={style.label}
                color={style.chipColor}
                variant="outlined"
                sx={{ height: 20 }}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={`${reviewedCount}/${totalCount} 確認済`}
                color={allReviewed ? 'success' : 'default'}
                variant={allReviewed ? 'filled' : 'outlined'}
                sx={{ height: 20 }}
              />
              <Button
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{ minWidth: 0, p: 0.5 }}
              >
                <ExpandMoreRoundedIcon
                  fontSize="small"
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </Button>
            </Stack>
          </Stack>

          {/* ── サマリー ── */}
          <Typography variant="body2">
            {proposal.summary}
          </Typography>

          {/* ── アクション一覧 ── */}
          <Collapse in={expanded}>
            <Stack spacing={1}>
              {proposal.actions.map(action => (
                <ActionRow
                  key={action.fieldKey}
                  action={action}
                  reviewed={reviewedFields.has(action.fieldKey)}
                  onToggle={handleToggle}
                />
              ))}
            </Stack>
          </Collapse>

          {/* ── フッター ── */}
          {onNavigateToDashboard && (
            <Button
              size="small"
              variant="text"
              onClick={onNavigateToDashboard}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', mt: 0.5 }}
            >
              申し送り分析ダッシュボードで詳細を確認 →
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
