/**
 * SummaryPanel — 集計カードと種別内訳
 */
import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import type {
  AuditFindingType,
  AuditSummary,
} from '@/domain/regulatory';
import { AUDIT_FINDING_TYPE_LABELS } from '@/domain/regulatory';
import type { SevereAddonSummary } from '@/domain/regulatory/severeAddonFindings';

// ─────────────────────────────────────────────
// SummaryCard
// ─────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, count, color, icon }) => (
  <Card
    variant="outlined"
    sx={{
      p: 2.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      borderLeft: `4px solid ${color}`,
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': { boxShadow: 3 },
    }}
  >
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box>
      <Typography variant="h4" fontWeight={800} color={color}>
        {count}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Box>
  </Card>
);

// ─────────────────────────────────────────────
// TypeBreakdown
// ─────────────────────────────────────────────

/** 加算系の種別カウントエントリ */
const ADDON_BREAKDOWN_ENTRIES: { key: keyof SevereAddonSummary; label: string }[] = [
  { key: 'trainingRatioInsufficientCount', label: '基礎研修比率不足' },
  { key: 'reassessmentOverdueCount', label: '再評価超過' },
  { key: 'weeklyObservationShortageCount', label: '週次観察不足' },
  { key: 'authoringRequirementUnmetCount', label: '作成者要件不備' },
  { key: 'assignmentWithoutQualificationCount', label: '資格なし配置' },
];

interface TypeBreakdownProps {
  summary: AuditSummary;
  addonSummary?: SevereAddonSummary;
}

export const TypeBreakdown: React.FC<TypeBreakdownProps> = ({ summary, addonSummary }) => (
  <Card variant="outlined" sx={{ p: 2.5 }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      検出種別
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {(Object.entries(summary.byType) as [AuditFindingType, number][]).map(([type, count]) => (
        <Chip
          key={type}
          label={`${AUDIT_FINDING_TYPE_LABELS[type]}: ${count}`}
          size="small"
          variant={count > 0 ? 'filled' : 'outlined'}
          color={count > 0 ? 'warning' : 'default'}
          sx={{ fontWeight: count > 0 ? 700 : 400 }}
        />
      ))}
    </Box>
    {addonSummary && (
      <>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          加算系
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {ADDON_BREAKDOWN_ENTRIES.map(({ key, label }) => {
            const count = addonSummary[key] as number;
            return (
              <Chip
                key={String(key)}
                label={`${label}: ${count}`}
                size="small"
                variant={count > 0 ? 'filled' : 'outlined'}
                color={count > 0 ? 'error' : 'default'}
                sx={{ fontWeight: count > 0 ? 700 : 400, fontSize: '0.65rem' }}
              />
            );
          })}
        </Box>
      </>
    )}
  </Card>
);
// ─────────────────────────────────────────────
// DomainSummary
// ─────────────────────────────────────────────

interface DomainSummaryProps {
  ispCount: number;
  sheetCount: number;
}

export const DomainSummary: React.FC<DomainSummaryProps> = ({ ispCount, sheetCount }) => (
  <Card
    variant="outlined"
    sx={{
      p: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <Typography variant="subtitle2" fontWeight={800} sx={{ mr: 1 }}>
      領域別集計:
    </Typography>
    <Chip
      label={`個別支援計画: ${ispCount} 件`}
      size="small"
      color="info"
      variant={ispCount > 0 ? 'filled' : 'outlined'}
      sx={{ fontWeight: 700 }}
    />
    <Chip
      label={`支援計画シート: ${sheetCount} 件`}
      size="small"
      color="secondary"
      variant={sheetCount > 0 ? 'filled' : 'outlined'}
      sx={{ fontWeight: 700 }}
    />
  </Card>
);
