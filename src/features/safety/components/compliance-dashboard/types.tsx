/**
 * ComplianceDashboard — 型定義・定数・ヘルパー
 */
import React from 'react';

// ─────────────────────────────────────────────
// Compliance Level
// ─────────────────────────────────────────────

export type ComplianceLevel = 'good' | 'warning' | 'critical';

export function getComplianceLevel(met: boolean, deadline?: string | null): ComplianceLevel {
  if (met) return 'good';
  if (deadline) {
    const daysUntil = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntil < 30) return 'critical';
  }
  return 'warning';
}

export const LEVEL_COLORS: Record<ComplianceLevel, string> = {
  good: '#2e7d32',
  warning: '#ed6c02',
  critical: '#d32f2f',
};

export const LEVEL_LABELS: Record<ComplianceLevel, string> = {
  good: '基準充足',
  warning: '要注意',
  critical: '要対応',
};

// ─────────────────────────────────────────────
// OverviewCard (shared sub-component)
// ─────────────────────────────────────────────

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface OverviewCardProps {
  icon: React.ReactNode;
  title: string;
  level: ComplianceLevel;
  mainValue: string;
  subText: string;
  testId: string;
}

export const OverviewCard: React.FC<OverviewCardProps> = ({
  icon,
  title,
  level,
  mainValue,
  subText,
  testId,
}) => (
  <Card
    variant="outlined"
    data-testid={testId}
    sx={{
      borderLeft: `4px solid ${LEVEL_COLORS[level]}`,
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': { boxShadow: 3 },
    }}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Box sx={{ color: LEVEL_COLORS[level], display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Chip
          label={LEVEL_LABELS[level]}
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: `${LEVEL_COLORS[level]}15`,
            color: LEVEL_COLORS[level],
            fontWeight: 700,
            fontSize: '0.7rem',
          }}
        />
      </Stack>
      <Typography variant="h4" fontWeight={800} color={LEVEL_COLORS[level]}>
        {mainValue}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subText}
      </Typography>
    </CardContent>
  </Card>
);
