/**
 * SevereAddonPanel — 重度障害者支援加算サマリーパネル
 */
import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AccessibilityNewRoundedIcon from '@mui/icons-material/AccessibilityNewRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';

import type { summarizeSevereAddonFindings } from '@/domain/regulatory/severeAddonFindings';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** 加算要件 → 遷移先マッピング */
const ADDON_REQUIREMENT_LINKS: Record<string, { path: string; label: string }> = {
  training:     { path: '/staff',               label: 'スタッフ管理を開く' },
  reassessment: { path: '/planning-sheet-list',  label: '支援計画シート一覧を開く' },
  observation:  { path: '/staff',               label: 'スタッフ管理を開く' },
  authoring:    { path: '/planning-sheet-list',  label: '支援計画シート一覧を開く' },
  assignment:   { path: '/staff',               label: 'スタッフ管理を開く' },
};

// ─────────────────────────────────────────────
// AddonRequirementRow (sub-component)
// ─────────────────────────────────────────────

const AddonRequirementRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  okText: string;
  ngText: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ icon, label, count, okText, ngText, onAction, actionLabel }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    <Typography variant="body2" sx={{ minWidth: 100 }} fontWeight={600}>
      {label}
    </Typography>
    <Chip
      label={count > 0 ? ngText : okText}
      size="small"
      color={count > 0 ? 'warning' : 'success'}
      variant={count > 0 ? 'filled' : 'outlined'}
      sx={{ fontWeight: 600, fontSize: '0.65rem' }}
    />
    {onAction && (
      <IconButton
        size="small"
        color="primary"
        onClick={onAction}
        title={actionLabel}
        data-testid={`addon-action-${label}`}
        sx={{ ml: 'auto', p: 0.5 }}
      >
        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    )}
  </Box>
);

// ─────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────

interface SevereAddonSummaryPanelProps {
  addonSummary: ReturnType<typeof summarizeSevereAddonFindings>;
  onNavigate: (url: string) => void;
  onFilterAddon: () => void;
}

export const SevereAddonSummaryPanel: React.FC<SevereAddonSummaryPanelProps> = ({ addonSummary, onNavigate, onFilterAddon }) => {
  const hasIssues =
    addonSummary.trainingRatioInsufficientCount > 0 ||
    addonSummary.reassessmentOverdueCount > 0 ||
    addonSummary.weeklyObservationShortageCount > 0 ||
    addonSummary.authoringRequirementUnmetCount > 0 ||
    addonSummary.assignmentWithoutQualificationCount > 0;

  return (
    <Card
      variant="outlined"
      data-testid="severe-addon-summary-panel"
      sx={{
        p: 2.5,
        borderLeft: `4px solid ${hasIssues ? '#ed6c02' : '#2e7d32'}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccessibilityNewRoundedIcon sx={{ color: hasIssues ? 'warning.main' : 'success.main' }} />
        <Typography variant="subtitle1" fontWeight={700}>
          重度障害者支援加算
        </Typography>
        <Chip
          label={hasIssues ? '要対応あり' : '充足'}
          size="small"
          color={hasIssues ? 'warning' : 'success'}
          variant="filled"
          sx={{ fontWeight: 700, fontSize: '0.7rem', ml: 'auto' }}
        />
      </Box>

      {/* 候補者カウント */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="primary.main">
            {addonSummary.tier2CandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            加算（Ⅱ）候補
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="primary.main">
            {addonSummary.tier3CandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            加算（Ⅲ）候補
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="secondary.main">
            {addonSummary.upperTierCandidateCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            上位区分候補
          </Typography>
        </Box>
      </Box>

      {/* 要件チェック状況 */}
      <Stack spacing={0.75}>
        <AddonRequirementRow icon={<SchoolRoundedIcon sx={{ fontSize: 16 }} />} label="基礎研修比率" count={addonSummary.trainingRatioInsufficientCount} okText="20%以上を充足" ngText={`${addonSummary.trainingRatioInsufficientCount}件の不足`} onAction={addonSummary.trainingRatioInsufficientCount > 0 ? () => onNavigate(ADDON_REQUIREMENT_LINKS.training.path) : undefined} actionLabel={ADDON_REQUIREMENT_LINKS.training.label} />
        <AddonRequirementRow icon={<EventRepeatRoundedIcon sx={{ fontSize: 16 }} />} label="3か月再評価" count={addonSummary.reassessmentOverdueCount} okText="全員期限内" ngText={`${addonSummary.reassessmentOverdueCount}件超過`} onAction={addonSummary.reassessmentOverdueCount > 0 ? () => onNavigate(ADDON_REQUIREMENT_LINKS.reassessment.path) : undefined} actionLabel={ADDON_REQUIREMENT_LINKS.reassessment.label} />
        <AddonRequirementRow icon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />} label="週次観察" count={addonSummary.weeklyObservationShortageCount} okText="全員実施済" ngText={`${addonSummary.weeklyObservationShortageCount}件不足`} onAction={addonSummary.weeklyObservationShortageCount > 0 ? () => onNavigate(ADDON_REQUIREMENT_LINKS.observation.path) : undefined} actionLabel={ADDON_REQUIREMENT_LINKS.observation.label} />
        <AddonRequirementRow icon={<EditNoteRoundedIcon sx={{ fontSize: 16 }} />} label="作成者要件" count={addonSummary.authoringRequirementUnmetCount} okText="全員実践研修修了" ngText={`${addonSummary.authoringRequirementUnmetCount}件不備`} onAction={addonSummary.authoringRequirementUnmetCount > 0 ? () => onNavigate(ADDON_REQUIREMENT_LINKS.authoring.path) : undefined} actionLabel={ADDON_REQUIREMENT_LINKS.authoring.label} />
        <AddonRequirementRow icon={<PersonOffRoundedIcon sx={{ fontSize: 16 }} />} label="配置資格" count={addonSummary.assignmentWithoutQualificationCount} okText="全員資格あり" ngText={`${addonSummary.assignmentWithoutQualificationCount}件不備`} onAction={addonSummary.assignmentWithoutQualificationCount > 0 ? () => onNavigate(ADDON_REQUIREMENT_LINKS.assignment.path) : undefined} actionLabel={ADDON_REQUIREMENT_LINKS.assignment.label} />
      </Stack>

      {/* 加算 finding 一覧へ導線 */}
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          variant="text"
          color="secondary"
          startIcon={<FilterListRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={onFilterAddon}
          data-testid="addon-filter-shortcut"
          sx={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 600 }}
        >
          加算チェック結果を一覧で見る
        </Button>
      </Box>
    </Card>
  );
};
