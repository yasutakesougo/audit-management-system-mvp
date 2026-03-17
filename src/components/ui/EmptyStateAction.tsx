/**
 * EmptyStateAction — 行動指向のエンプティステート共通コンポーネント
 *
 * データがない状態でも「次に何をすべきか」を示し、
 * ユーザーを迷子にしないUIを全画面に統一適用する。
 *
 * 3バリアント:
 *  - success: 全完了（✅ 緑）
 *  - info:    データなし（ℹ️ デフォルト）
 *  - warning: 要対応（⚠️ 橙）
 *
 * 設計方針:
 *  - ErrorState / LoadingState と同一のレイアウトパターン
 *  - MUI の Box + Stack + Typography + Button で構成
 *  - フェードインアニメーション + アイコンパルスで視覚的誘導
 *
 * @see docs/product/welfare-operations-os-requirements-v1.md §3 情報設計原則 #8
 * @see docs/product/screen-catalog.md 付録: コンポーネント依存マトリクス
 * @module components/ui/EmptyStateAction
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import React from 'react';

// ─── Pulse Animation ─────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50%      { transform: scale(1.08); opacity: 1; }
`;

// ─── Types ───────────────────────────────────────────────────

/** Visual variant controlling color scheme and default icon */
export type EmptyStateVariant = 'success' | 'info' | 'warning';

export type EmptyStateActionProps = {
  /** Emoji or icon string displayed at the top */
  icon?: string;
  /** Main heading */
  title: string;
  /** Descriptive text explaining the state */
  description?: string;
  /** CTA button label — if provided, the action button is shown */
  actionLabel?: string;
  /** Callback when the CTA button is clicked */
  onAction?: () => void;
  /** Visual variant: success (green), info (default), warning (amber) */
  variant?: EmptyStateVariant;
  /** Minimum height for the container */
  minHeight?: number | string;
  /** Test ID for automated testing */
  testId?: string;
};

// ─── Variant Config ──────────────────────────────────────────

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  { defaultIcon: string; color: string; bgColor: string; buttonColor: 'success' | 'primary' | 'warning' }
> = {
  success: {
    defaultIcon: '🎉',
    color: 'success.main',
    bgColor: 'rgba(46, 125, 50, 0.04)',
    buttonColor: 'success',
  },
  info: {
    defaultIcon: '📋',
    color: 'text.secondary',
    bgColor: 'rgba(25, 118, 210, 0.04)',
    buttonColor: 'primary',
  },
  warning: {
    defaultIcon: '⚠️',
    color: 'warning.main',
    bgColor: 'rgba(237, 108, 2, 0.04)',
    buttonColor: 'warning',
  },
};

// ─── Component ───────────────────────────────────────────────

export const EmptyStateAction: React.FC<EmptyStateActionProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'info',
  minHeight = '10vh',
  testId = 'empty-state-action',
}) => {
  const config = VARIANT_CONFIG[variant];
  const displayIcon = icon ?? config.defaultIcon;

  return (
    <Fade in timeout={400}>
      <Box
        data-testid={testId}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight,
          p: 4,
          borderRadius: 2,
          bgcolor: config.bgColor,
        }}
      >
        <Stack spacing={2} alignItems="center" textAlign="center">
          {/* Icon with subtle pulse animation */}
          <Box
            sx={{
              fontSize: 40,
              lineHeight: 1,
              animation: `${pulse} 2.5s ease-in-out infinite`,
            }}
            role="img"
            aria-label={title}
          >
            {displayIcon}
          </Box>

          {/* Title */}
          <Typography
            variant="h6"
            sx={{
              color: config.color,
              fontWeight: 600,
            }}
          >
            {title}
          </Typography>

          {/* Description */}
          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 400 }}
            >
              {description}
            </Typography>
          )}

          {/* CTA Button */}
          {actionLabel && onAction && (
            <Button
              variant="outlined"
              color={config.buttonColor}
              onClick={onAction}
              sx={{ mt: 1 }}
            >
              {actionLabel}
            </Button>
          )}
        </Stack>
      </Box>
    </Fade>
  );
};
