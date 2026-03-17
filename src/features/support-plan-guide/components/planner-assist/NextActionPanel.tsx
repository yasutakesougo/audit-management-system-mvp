/**
 * NextActionPanel — Planner Assist の Next Action Panel (P5-A)
 *
 * computePlannerInsights() の出力を受けて描画する Thin Component。
 * 新しいロジックは持たず、既存レイヤーの集約結果を可視化する。
 *
 * 配置: SupportPlanGuidePage の RegulatorySection と HUD の間。
 * 権限: plannerAssist.view が true のときのみ表示。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import type { PlannerInsightItem, PlannerInsights } from '../../domain/plannerInsights';
import { formatRate } from '../../domain/suggestionDecisionMetrics';

// ────────────────────────────────────────────
// severity → color mapping
// ────────────────────────────────────────────

const SEVERITY_COLOR: Record<PlannerInsightItem['severity'], 'error' | 'warning' | 'info'> = {
  danger: 'error',
  warning: 'warning',
  info: 'info',
};

const SEVERITY_BG: Record<PlannerInsightItem['severity'], string> = {
  danger: 'rgba(211, 47, 47, 0.08)',
  warning: 'rgba(237, 108, 2, 0.08)',
  info: 'rgba(2, 136, 209, 0.08)',
};

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type NextActionPanelProps = {
  actions: PlannerInsightItem[];
  summary: PlannerInsights['summary'];
  onNavigate: (tab: string) => void;
};

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const NextActionPanel: React.FC<NextActionPanelProps> = ({
  actions,
  summary,
  onNavigate,
}) => {
  // 全アクション 0件なら非表示
  if (actions.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      data-testid="next-action-panel"
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.5 },
        borderLeft: (theme) => `3px solid ${theme.palette.primary.main}`,
        transition: 'box-shadow 0.2s ease-in-out',
      }}
    >
      <Stack spacing={1.25}>
        {/* ── ヘッダー ── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <AssignmentTurnedInRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              Planner Assist
            </Typography>
            <Chip
              size="small"
              label={`${summary.totalOpenActions}件`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
            />
          </Stack>
          {summary.weeklyAcceptanceRate !== undefined && (
            <Chip
              size="small"
              variant="outlined"
              label={`採用率: ${formatRate(summary.weeklyAcceptanceRate)}`}
              data-testid="acceptance-rate-chip"
              sx={{ fontSize: '0.7rem', height: 20, fontWeight: 500 }}
            />
          )}
        </Stack>

        {/* ── アクション行 ── */}
        <Stack spacing={0.5}>
          {actions.map((item) => (
            <NextActionRow
              key={item.key}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};

// ────────────────────────────────────────────
// 個別アクション行
// ────────────────────────────────────────────

const NextActionRow: React.FC<{
  item: PlannerInsightItem;
  onNavigate: (tab: string) => void;
}> = ({ item, onNavigate }) => {
  const handleClick = React.useCallback(() => {
    onNavigate(item.tab);
  }, [item.tab, onNavigate]);

  return (
    <Box
      data-testid={`next-action-row-${item.key}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        py: 0.75,
        borderRadius: 1,
        bgcolor: SEVERITY_BG[item.severity],
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.04)',
          transform: 'translateX(2px)',
        },
        '&:focus-visible': {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 1,
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
        <Chip
          size="small"
          label={item.count}
          color={SEVERITY_COLOR[item.severity]}
          variant="filled"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            minWidth: 28,
            height: 22,
            flexShrink: 0,
          }}
        />
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </Typography>
        {item.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {item.description}
          </Typography>
        )}
      </Stack>
      <IconButton
        size="small"
        color={SEVERITY_COLOR[item.severity]}
        aria-label={`${item.label}を開く`}
        sx={{ flexShrink: 0 }}
      >
        <OpenInNewRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default NextActionPanel;
