/**
 * OpsHighLoadWarningBanner — 高負荷日の警告バナー
 *
 * 責務:
 * - computeHighLoadWarnings() の結果を weekly view に表示する
 * - 管理者に「この日は人手が足りない」を伝える
 * - 推奨パネルの"逆側"として、判断支援を両輪にする
 *
 * Phase 4-A-1: 「おすすめ日 ↔ 危険日」の両輪完成
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { HighLoadWarning } from '../../domain/scheduleOpsLoadScore';

// ─── Date Formatter ──────────────────────────────────────────────────────────

const DAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

function formatWarningDate(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  return DAY_FORMATTER.format(d);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  high: { emoji: '🟠', label: '高負荷', color: '#f97316' },
  critical: { emoji: '🔴', label: '超過・危険', color: '#dc2626' },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsHighLoadWarningBannerProps = {
  warnings: readonly HighLoadWarning[];
  onDayClick?: (dateIso: string) => void;
};

export const OpsHighLoadWarningBanner: FC<OpsHighLoadWarningBannerProps> = ({
  warnings,
  onDayClick,
}) => {
  const theme = useTheme();

  if (warnings.length === 0) return null;

  const hasCritical = warnings.some((w) => w.level === 'critical');
  const borderColor = hasCritical ? theme.palette.error.main : theme.palette.warning.main;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderColor: alpha(borderColor, 0.4),
        backgroundColor: alpha(borderColor, 0.04),
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
          ⚠️ 高負荷日
        </Typography>
        <Chip
          label={`${warnings.length}日`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: alpha(borderColor, 0.12),
            color: hasCritical ? theme.palette.error.dark : theme.palette.warning.dark,
          }}
        />
      </Box>

      {/* Warning List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {warnings.map((w) => {
          const config = LEVEL_CONFIG[w.level];

          return (
            <Box
              key={w.dateIso}
              onClick={() => onDayClick?.(w.dateIso)}
              role={onDayClick ? 'button' : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onDayClick) {
                  e.preventDefault();
                  onDayClick(w.dateIso);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                cursor: onDayClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease-in-out',
                '&:hover': onDayClick
                  ? { backgroundColor: alpha(config.color, 0.06) }
                  : undefined,
              }}
            >
              {/* Emoji */}
              <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>
                {config.emoji}
              </Typography>

              {/* Date */}
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', minWidth: 80, flexShrink: 0 }}>
                {formatWarningDate(w.dateIso)}
              </Typography>

              {/* Level chip */}
              <Chip
                label={config.label}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  backgroundColor: alpha(config.color, 0.12),
                  color: config.color,
                  '& .MuiChip-label': { px: 0.75 },
                  flexShrink: 0,
                }}
              />

              {/* Score */}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'text.secondary',
                  fontSize: '0.65rem',
                  flexShrink: 0,
                }}
              >
                負荷 {w.score}
              </Typography>

              {/* Reasons */}
              {w.reasons.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 'auto' }}>
                  {w.reasons.map((r) => (
                    <Typography
                      key={r.key}
                      variant="caption"
                      sx={{
                        fontSize: '0.6rem',
                        color: alpha(config.color, 0.8),
                        backgroundColor: alpha(config.color, 0.08),
                        borderRadius: 0.5,
                        px: 0.5,
                        py: 0.125,
                        lineHeight: 1.5,
                        fontWeight: 500,
                      }}
                    >
                      {r.label}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
