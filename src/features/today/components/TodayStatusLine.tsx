/**
 * TodayStatusLine — 一行ステータスサマリー表示コンポーネント
 *
 * 「3秒で今日の状態がわかる」を実現する唯一のUI要素。
 * ZONE A (HeroActionCard) の直上に配置される。
 *
 * 表示例:
 *   ✅ 順調（記録 あと4件・出席10/10）
 *   ⚠️ 手順 残10件・当日欠席2名
 *   🔴 要注意（緊急対応1件・発熱2名）
 *
 * ⚠️ データ取得・計算ロジックを持たない。
 *    inferTodayStatusSummary の出力をそのまま表示する。
 *
 * @see features/today/domain/inferTodayStatusSummary.ts
 */
import { motionTokens } from '@/app/theme';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { TodayStatusSummary } from '../domain/inferTodayStatusSummary';

// ─── Types ───────────────────────────────────────────────────

export type TodayStatusLineProps = {
  summary: TodayStatusSummary;
};

// ─── Level → Visual Style ────────────────────────────────────

const LEVEL_STYLES = {
  good: { paletteKey: 'success' as const, bgAlpha: 0.08 },
  warning: { paletteKey: 'warning' as const, bgAlpha: 0.10 },
  critical: { paletteKey: 'error' as const, bgAlpha: 0.12 },
} as const;

// ─── Component ───────────────────────────────────────────────

export const TodayStatusLine: React.FC<TodayStatusLineProps> = ({ summary }) => {
  const theme = useTheme();
  const style = LEVEL_STYLES[summary.level];
  const mainColor = theme.palette[style.paletteKey].main;
  const bgColor = alpha(mainColor, style.bgAlpha);

  return (
    <Box
      data-testid="today-status-line"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1, sm: 1.25 },
        borderRadius: 2,
        bgcolor: bgColor,
        borderLeft: 4,
        borderColor: mainColor,
        transition: `background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
      }}
    >
      {/* Emoji */}
      <Typography
        component="span"
        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, lineHeight: 1 }}
        role="img"
        aria-hidden="true"
      >
        {summary.emoji}
      </Typography>

      {/* Message + Hint */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          component="span"
          sx={{
            fontWeight: 700,
            color: summary.level === 'good' ? 'text.primary' : mainColor,
            fontSize: { xs: '0.85rem', sm: '0.9rem' },
          }}
        >
          {summary.message}
        </Typography>

        {summary.hint && (
          <Typography
            variant="caption"
            component="span"
            sx={{
              ml: 1,
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          >
            {summary.hint}
          </Typography>
        )}

        {summary.deltaText && (
          <Typography
            variant="caption"
            component="span"
            data-testid="today-status-delta"
            sx={{
              ml: 1,
              fontWeight: 600,
              fontSize: '0.7rem',
              color: summary.deltaText.includes('+') ? 'error.main' : 'success.main',
              opacity: 0.85,
            }}
          >
            {summary.deltaText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
