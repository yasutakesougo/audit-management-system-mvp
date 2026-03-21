/**
 * ScheduleOpsHighLoadTile — Today用 高負荷日1行サマリータイル
 *
 * Schedule Ops の高負荷警告を Today ページで1行サマリーとして表示する。
 * クリックで /schedule-ops?focusDate=<dateIso> に遷移。
 *
 * デザイン: OpsHighLoadWarningBanner のスタイルを踏襲し、1行に圧縮。
 *
 * @see OpsHighLoadWarningBanner — Schedule Ops 内のフル表示版
 * @see buildHighLoadTileViewModel — ViewModel 生成元
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { HighLoadTileViewModel } from '../domain/buildHighLoadTileViewModel';

// ─── Config ──────────────────────────────────────────────────

const LEVEL_CONFIG = {
  high: { emoji: '🟠', color: '#f97316' },
  critical: { emoji: '🔴', color: '#dc2626' },
} as const;

// ─── Props ───────────────────────────────────────────────────

export type ScheduleOpsHighLoadTileProps = {
  viewModel: HighLoadTileViewModel & { visible: true };
  onClick: () => void;
};

// ─── Component ───────────────────────────────────────────────

export const ScheduleOpsHighLoadTile: FC<ScheduleOpsHighLoadTileProps> = ({
  viewModel,
  onClick,
}) => {
  const theme = useTheme();
  const { topWarning, dayCount, hasCritical } = viewModel;
  const config = LEVEL_CONFIG[topWarning.level];
  const borderColor = hasCritical
    ? theme.palette.error.main
    : theme.palette.warning.main;

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={
        hasCritical
          ? '重大な高負荷日の詳細を確認'
          : '高負荷日の詳細を確認'
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 2,
        borderColor: alpha(borderColor, 0.4),
        backgroundColor: alpha(borderColor, 0.04),
        cursor: 'pointer',
        transition: 'background-color 0.15s ease-in-out',
        '&:hover': {
          backgroundColor: alpha(borderColor, 0.08),
        },
        '&:focus-visible': {
          outline: `2px solid ${borderColor}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* ── Header: "⚠️ 高負荷日あり [N日]" ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          ⚠️ 高負荷日あり
        </Typography>
        <Chip
          label={`${dayCount}日`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: alpha(borderColor, 0.12),
            color: hasCritical
              ? theme.palette.error.dark
              : theme.palette.warning.dark,
          }}
        />
      </Box>

      {/* ── Body: 最重要日のサマリー行 ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 0.75,
        }}
      >
        {/* Level emoji */}
        <Typography
          variant="body2"
          sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
        >
          {config.emoji}
        </Typography>

        {/* Date */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'text.primary', flexShrink: 0 }}
        >
          {topWarning.dateLabel}
        </Typography>

        {/* Reason */}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            color: alpha(config.color, 0.9),
            backgroundColor: alpha(config.color, 0.08),
            borderRadius: 0.5,
            px: 0.75,
            py: 0.25,
            fontWeight: 500,
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          {topWarning.topReasonLabel}
        </Typography>

        {/* Score */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'text.secondary',
            fontSize: '0.65rem',
            ml: 'auto',
            flexShrink: 0,
          }}
        >
          負荷 {topWarning.score}
        </Typography>
      </Box>

      {/* ── Footer: CTA ── */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'right',
          color: 'primary.main',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}
      >
        Schedule Ops で確認 →
      </Typography>
    </Paper>
  );
};
