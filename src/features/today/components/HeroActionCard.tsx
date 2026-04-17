/**
 * HeroActionCard — 「今やること」を1つの CTA に絞るヒーローカード
 *
 * Step 2: 主導線一本化
 * Step 3: 優先度別視覚強化
 *
 * NextActionCard は sceneAction + scheduleItem の二重 CTA を持っていた。
 * HeroActionCard はこれを「1つの CTA」に統合する。
 *
 * 優先順位:
 * 1. sceneAction が有効 → scene ベースのヒーロー表示
 * 2. sceneAction 無効 + scheduleItem あり → スケジュールベースの CTA
 * 3. どちらもなし → 完了状態
 *
 * フォールバック条件（明文化）:
 * - sceneAction == null → フォールバック
 * - sceneAction.ctaLabel が空文字 → フォールバック
 * - sceneAction.description が空文字 → フォールバック
 *
 * ⚠️ buildSceneNextAction / inferTodayScene は変更しない。
 * ⚠️ NextActionCard.tsx は削除しない（フォールバックで利用）。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { motionTokens } from '@/app/theme';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import type { SceneNextActionViewModel } from '../hooks/useSceneNextAction';
import type { NextActionCardProps } from '../widgets/NextActionCard';
import { NextActionCard } from '../widgets/NextActionCard';

// ─── Types ───────────────────────────────────────────────────

export type HeroActionCardProps = {
  /** sceneAction (primary source) */
  sceneAction?: SceneNextActionViewModel;
  /** sceneAction CTA handler */
  onSceneAction?: (target: string, userId?: string) => void;
  /** nextAction (fallback when sceneAction is invalid) */
  nextAction: NextActionWithProgress;
  /** Empty state handler for fallback NextActionCard */
  onEmptyAction?: NextActionCardProps['onEmptyAction'];
  /** Menu action for fallback NextActionCard */
  onMenuAction?: NextActionCardProps['onMenuAction'];
  /** Schedule detail deep link for fallback */
  scheduleDetailHref?: string;
  /** Navigation handler for fallback */
  onNavigate?: (href: string) => void;
};

// ─── Priority → Visual Style ─────────────────────────────────

type PriorityStyle = {
  borderColor: string;
  borderWidth: number;
  bgAlphaColor: string;
  ctaColor: 'error' | 'warning' | 'primary' | 'success';
  ctaVariant: 'contained' | 'outlined';
  pulse: boolean;
};

const PRIORITY_STYLES: Record<string, PriorityStyle> = {
  critical: {
    borderColor: 'error.main',
    borderWidth: 5,
    bgAlphaColor: 'error',
    ctaColor: 'error',
    ctaVariant: 'contained',
    pulse: true,
  },
  high: {
    borderColor: 'warning.main',
    borderWidth: 4,
    bgAlphaColor: 'warning',
    ctaColor: 'warning',
    ctaVariant: 'contained',
    pulse: false,
  },
  medium: {
    borderColor: 'primary.main',
    borderWidth: 4,
    bgAlphaColor: 'primary',
    ctaColor: 'primary',
    ctaVariant: 'contained',
    pulse: false,
  },
  low: {
    borderColor: 'success.main',
    borderWidth: 3,
    bgAlphaColor: 'success',
    ctaColor: 'success',
    ctaVariant: 'outlined',
    pulse: false,
  },
};

// ─── Validation ──────────────────────────────────────────────

function isSceneActionValid(
  sceneAction: SceneNextActionViewModel | undefined,
): sceneAction is SceneNextActionViewModel {
  if (sceneAction == null) return false;
  if (typeof sceneAction.ctaLabel !== 'string' || sceneAction.ctaLabel.length === 0) return false;
  if (typeof sceneAction.description !== 'string' || sceneAction.description.length === 0) return false;
  return true;
}

// ─── Component ───────────────────────────────────────────────

export const HeroActionCard: React.FC<HeroActionCardProps> = ({
  sceneAction,
  onSceneAction,
  nextAction,
  onEmptyAction,
  onMenuAction,
  scheduleDetailHref,
  onNavigate,
}) => {
  const theme = useTheme();

  // ── No work left: Peace-of-Mind Hero state ──
  if ((!sceneAction || sceneAction.priority === 'low') && !nextAction.item) {
    return (
      <Paper
        data-testid="hero-all-done-card"
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          textAlign: 'center',
          bgcolor: alpha(theme.palette.success.main, 0.04),
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.15),
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h5"
          fontWeight="bold"
          sx={{ mb: 1.5, color: 'success.dark' }}
        >
          ✨ お疲れ様です
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          本日の記録はすべて完了しています。<br />
          現在、未入力の項目はありません。
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Chip label="記録完了" color="success" size="small" variant="filled" />
          <Chip label="この内容でOKです" color="success" size="small" variant="outlined" />
        </Box>
      </Paper>
    );
  }

  // ── Fallback: sceneAction が無効なら既存 NextActionCard を表示 ──
  if (!isSceneActionValid(sceneAction)) {
    return (
      <NextActionCard
        nextAction={nextAction}
        sceneAction={sceneAction}
        onSceneAction={onSceneAction}
        onEmptyAction={onEmptyAction}
        onMenuAction={onMenuAction}
        scheduleDetailHref={scheduleDetailHref}
        onNavigate={onNavigate}
      />
    );
  }

  // ── Primary: sceneAction ベースのヒーロー表示 ──
  const style = PRIORITY_STYLES[sceneAction.priority] ?? PRIORITY_STYLES.medium;
  // Safely resolve palette color for alpha background
  const bgColor = (() => {
    const key = style.bgAlphaColor;
    const palette = theme.palette;
    if (key === 'error') return alpha(palette.error.main, 0.06);
    if (key === 'warning') return alpha(palette.warning.main, 0.06);
    if (key === 'primary') return alpha(palette.primary.main, 0.06);
    if (key === 'success') return alpha(palette.success.main, 0.06);
    return palette.background.paper;
  })();

  return (
    <Paper
      data-testid="hero-action-card"
      elevation={style.pulse ? 2 : 0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderLeft: style.borderWidth,
        borderColor: style.borderColor,
        bgcolor: bgColor,
        borderRadius: 2,
        transition: `border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, box-shadow ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
      }}
    >
      {/* ── 場面ラベル ── */}
      <Typography
        variant="caption"
        data-testid="hero-scene-label"
        sx={{
          display: 'block',
          mb: 0.5,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'text.secondary',
          fontSize: '0.75rem',
        }}
      >
        📍 {sceneAction.sceneLabel}
      </Typography>

      {/* ── メインメッセージ ── */}
      <Typography
        variant="h6"
        fontWeight="bold"
        data-testid="hero-title"
        sx={{ mb: 0.5 }}
      >
        {sceneAction.title}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="hero-description"
        sx={{ mb: 1 }}
      >
        {sceneAction.description}
      </Typography>

      {/* ── 理由チップ ── */}
      {sceneAction.reasons.length > 0 && (
        <Box sx={{ mb: 1.5 }} data-testid="hero-reasons">
          {sceneAction.reasons.map((reason, i) => (
            <Chip
              key={i}
              label={reason}
              size="small"
              color={style.ctaColor === 'success' ? 'default' : style.ctaColor}
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          ))}
        </Box>
      )}

      {/* ── 主導線 CTA（1つだけ） ── */}
      <Button
        data-testid="hero-cta"
        variant={style.ctaVariant}
        color={style.ctaColor}
        endIcon={<NavigateNextIcon />}
        onClick={() => onSceneAction?.(sceneAction.ctaTarget, sceneAction.userId)}
        fullWidth
        sx={{
          minHeight: 52,
          fontSize: '1.05rem',
          fontWeight: 700,
          borderRadius: 2,
          px: 3,
          mt: 0.5,
          ...(theme.palette.mode === 'light' &&
            style.ctaVariant === 'outlined' &&
            style.ctaColor === 'success' && {
              color: theme.palette.success.dark,
              borderColor: alpha(theme.palette.success.dark, 0.6),
              '&:hover': {
                borderColor: theme.palette.success.dark,
                backgroundColor: alpha(theme.palette.success.dark, 0.04),
              },
            }),
          ...(style.pulse && {
            animation: 'hero-pulse 2s infinite',
            '@keyframes hero-pulse': {
              '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.4)}` },
              '70%': { boxShadow: `0 0 0 10px ${alpha(theme.palette.error.main, 0)}` },
              '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0)}` },
            },
          }),
        }}
      >
        {sceneAction.ctaLabel}
      </Button>
    </Paper>
  );
};
