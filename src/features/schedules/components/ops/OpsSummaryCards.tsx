/**
 * OpsSummaryCards — 当日サマリーカード群
 *
 * onCardClick は OpsSummaryCardKey union で型安全にする。
 * 警告条件: 空き枠≤2 → warning、注意>0 → error、配置不足 → warning
 */

import PeopleIcon from '@mui/icons-material/People';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC, ReactNode } from 'react';

import type { OpsSummary, OpsSummaryCardKey } from '../../domain/scheduleOps';

// ─── Card Config ─────────────────────────────────────────────────────────────

type CardConfig = {
  key: OpsSummaryCardKey;
  label: string;
  getValue: (s: OpsSummary) => number;
  getColor: (s: OpsSummary) => 'default' | 'info' | 'success' | 'warning' | 'error';
  icon?: ReactNode;
};

const CARD_CONFIGS: readonly CardConfig[] = [
  {
    key: 'total',
    label: '合計',
    getValue: (s) => s.totalCount,
    getColor: () => 'default',
  },
  {
    key: 'normal',
    label: '生活介護',
    getValue: (s) => s.normalCount,
    getColor: () => 'info',
  },
  {
    key: 'respite',
    label: '一時ケア',
    getValue: (s) => s.respiteCount,
    getColor: () => 'success',
  },
  {
    key: 'shortStay',
    label: 'SS',
    getValue: (s) => s.shortStayCount,
    getColor: () => 'warning',
  },
  {
    key: 'cancelled',
    label: 'キャンセル',
    getValue: (s) => s.cancelledCount,
    getColor: (s) => (s.cancelledCount > 0 ? 'default' : 'default'),
  },
  {
    key: 'attention',
    label: '注意',
    getValue: (s) => s.attentionCount,
    getColor: (s) => (s.attentionCount > 0 ? 'error' : 'default'),
    icon: <ReportProblemIcon fontSize="small" />,
  },
  {
    key: 'capacity',
    label: '空き枠',
    getValue: (s) => s.availableSlots,
    getColor: (s) => (s.availableSlots <= 2 ? 'warning' : 'default'),
  },
  {
    key: 'staffing',
    label: '職員配置',
    getValue: (s) => s.assignedStaff,
    getColor: (s) =>
      s.requiredStaff > s.assignedStaff ? 'warning' : 'default',
    icon: <PeopleIcon fontSize="small" />,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsSummaryCardsProps = {
  summary: OpsSummary;
  isLoading?: boolean;
  onCardClick?: (key: OpsSummaryCardKey) => void;
};

export const OpsSummaryCards: FC<OpsSummaryCardsProps> = ({
  summary,
  isLoading,
  onCardClick,
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: 1,
          overflowX: 'auto',
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width={90}
            height={64}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        px: { xs: 2, sm: 3 },
        py: 1,
        overflowX: 'auto',
        '&::-webkit-scrollbar': { height: 4 },
      }}
    >
      {CARD_CONFIGS.map((cfg) => {
        const value = cfg.getValue(summary);
        const colorKey = cfg.getColor(summary);
        const isHighlighted = colorKey !== 'default';

        const bgColor = isHighlighted
          ? alpha(theme.palette[colorKey].main, 0.08)
          : alpha(theme.palette.text.primary, 0.03);
        const borderColor = isHighlighted
          ? alpha(theme.palette[colorKey].main, 0.3)
          : 'transparent';
        const valueColor = isHighlighted
          ? theme.palette[colorKey].dark
          : theme.palette.text.primary;

        // Staffing card shows "assigned / required"
        const displayValue =
          cfg.key === 'staffing'
            ? `${summary.assignedStaff}/${summary.requiredStaff}`
            : String(value);

        return (
          <Card
            key={cfg.key}
            variant="outlined"
            sx={{
              flexShrink: 0,
              minWidth: 80,
              border: `1px solid ${borderColor}`,
              backgroundColor: bgColor,
              transition: 'box-shadow 0.15s',
              '&:hover': { boxShadow: theme.shadows[2] },
            }}
          >
            <CardActionArea
              onClick={() => onCardClick?.(cfg.key)}
              sx={{ px: 1.5, py: 1, textAlign: 'center' }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                {cfg.icon}
                {cfg.label}
              </Typography>
              <Typography
                variant="h6"
                component="span"
                sx={{ fontWeight: 800, color: valueColor }}
              >
                {displayValue}
              </Typography>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
};
