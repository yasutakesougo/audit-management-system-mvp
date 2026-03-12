/**
 * PlanningSheetStatsGrid — シートごとの統計カードグリッド
 *
 * SupportPlanGuidePage で RegulatorySummaryBand の下に配置される。
 * 各シートの Iceberg 分析件数・実施記録件数・ステータス・次回見直し
 * を一覧表示し、「この時間割を開く」ボタンで Daily へ遷移する。
 */
import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { PlanningSheetListItem, SupportPlanBundle } from '@/domain/isp/schema';
import { PLANNING_SHEET_STATUS_DISPLAY } from '@/domain/isp/schema';
import type { PlanningSheetStatus } from '@/domain/isp/schema';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';

// ─────────────────────────────────────────────
// ステータスカラー解決
// ─────────────────────────────────────────────

const STATUS_COLOR: Record<PlanningSheetStatus, 'success' | 'info' | 'warning' | 'default' | 'error'> = {
  active: 'success',
  review: 'info',
  draft: 'default',
  revision_pending: 'warning',
  archived: 'default',
};

// ─────────────────────────────────────────────
// 次回見直し警告判定
// ─────────────────────────────────────────────

/**
 * 次回見直しまでの残日数を計算する。null なら未設定。
 */
export function daysUntilReview(nextReviewAt: string | null): number | null {
  if (!nextReviewAt) return null;
  const due = new Date(nextReviewAt);
  const now = new Date();
  return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

type PlanningSheetStatsGridProps = {
  bundle: SupportPlanBundle;
  onNavigate: (url: string) => void;
};

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export const PlanningSheetStatsGrid: React.FC<PlanningSheetStatsGridProps> = ({
  bundle,
  onNavigate,
}) => {
  const sheets = bundle.planningSheetItems ?? [];

  if (sheets.length === 0) return null;

  return (
    <Box data-testid="planning-sheet-stats-grid">
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <DescriptionRoundedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          支援計画シート一覧
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
        }}
      >
        {sheets.map((sheet) => (
          <SheetCard
            key={sheet.id}
            sheet={sheet}
            icebergCount={bundle.icebergCountBySheet?.[sheet.id] ?? 0}
            recordCount={bundle.procedureRecordCountBySheet?.[sheet.id] ?? 0}
            userId={bundle.isp.userId}
            onNavigate={onNavigate}
          />
        ))}
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────
// 個別シートカード
// ─────────────────────────────────────────────

type SheetCardProps = {
  sheet: PlanningSheetListItem;
  icebergCount: number;
  recordCount: number;
  userId: string;
  onNavigate: (url: string) => void;
};

const SheetCard: React.FC<SheetCardProps> = ({
  sheet,
  icebergCount,
  recordCount,
  userId,
  onNavigate,
}) => {
  const days = daysUntilReview(sheet.nextReviewAt);
  const isOverdue = days != null && days < 0;
  const isNearDue = days != null && days >= 0 && days <= 30;

  return (
    <Card
      variant="outlined"
      data-testid={`sheet-card-${sheet.id}`}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s',
        borderLeft: (theme) => `3px solid ${
          isOverdue
            ? theme.palette.error.main
            : isNearDue
              ? theme.palette.warning.main
              : theme.palette.primary.main
        }`,
        '&:hover': { boxShadow: 3 },
      }}
    >
      {/* ── タイトル + ステータス ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {sheet.title || '（無題）'}
        </Typography>
        <Chip
          size="small"
          label={PLANNING_SHEET_STATUS_DISPLAY[sheet.status]}
          color={STATUS_COLOR[sheet.status]}
          variant={sheet.status === 'active' ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0, fontWeight: 600 }}
        />
      </Stack>

      {/* ── 対象場面 ── */}
      {sheet.targetScene && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
          {sheet.targetScene}
        </Typography>
      )}

      {/* ── 統計チップ行 ── */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          variant="outlined"
          icon={<PsychologyRoundedIcon />}
          label={`分析: ${icebergCount}`}
          sx={{ fontSize: '0.7rem' }}
        />
        <Chip
          size="small"
          variant={recordCount === 0 ? 'filled' : 'outlined'}
          icon={<EditNoteRoundedIcon />}
          label={`記録: ${recordCount}`}
          color={recordCount === 0 ? 'warning' : 'default'}
          sx={{ fontSize: '0.7rem' }}
        />
        {sheet.nextReviewAt && (
          <Chip
            size="small"
            variant="outlined"
            icon={<EventNoteRoundedIcon />}
            label={`見直し: ${sheet.nextReviewAt}${days != null ? ` (${days}日)` : ''}`}
            color={isOverdue ? 'error' : isNearDue ? 'warning' : 'default'}
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        {isOverdue && (
          <Chip
            size="small"
            variant="filled"
            icon={<WarningAmberRoundedIcon />}
            label="期限超過"
            color="error"
            sx={{ fontSize: '0.7rem' }}
          />
        )}
      </Stack>

      {/* ── アクションボタン ── */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<PlayArrowRoundedIcon />}
        onClick={() => onNavigate(buildDailySupportUrl(userId, sheet.id))}
        data-testid={`open-daily-btn-${sheet.id}`}
        sx={{
          mt: 'auto',
          textTransform: 'none',
          fontSize: '0.75rem',
          alignSelf: 'flex-start',
        }}
      >
        この時間割を開く
      </Button>
    </Card>
  );
};
