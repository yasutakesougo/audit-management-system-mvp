/**
 * OpsLeaveSuggestionPanel — 年休おすすめ日パネル
 *
 * 責務:
 * - suggestBestLeaveDays() の結果を週間ビューに表示する
 * - ランク付きで休暇推奨日を提示する
 * - 「この日がおすすめ」を直感的に伝える
 * - UI にロジックは書かない（受け取った LeaveSuggestion[] をそのまま表示）
 *
 * Phase 3-B: 「年休とりたいな、予定どうなってる？」→「この日がおすすめ」まで一気通貫
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { LeaveSuggestion, LoadLevel } from '../../domain/scheduleOpsLoadScore';

// ─── Date Formatter ──────────────────────────────────────────────────────────

const DAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

function formatSuggestionDate(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  return DAY_FORMATTER.format(d);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const RANK_EMOJI = ['🥇', '🥈', '🥉'] as const;

const LEVEL_CONFIG: Record<LoadLevel, { label: string; color: string }> = {
  low: { label: '余裕あり', color: '#10b981' },
  moderate: { label: 'やや忙しい', color: '#f59e0b' },
  high: { label: '忙しい', color: '#ef4444' },
  critical: { label: '超過', color: '#dc2626' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsLeaveSuggestionPanelProps = {
  suggestions: readonly LeaveSuggestion[];
  onDayClick?: (dateIso: string) => void;
};

export const OpsLeaveSuggestionPanel: FC<OpsLeaveSuggestionPanelProps> = ({
  suggestions,
  onDayClick,
}) => {
  const theme = useTheme();

  if (suggestions.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderColor: alpha(theme.palette.error.main, 0.3),
          backgroundColor: alpha(theme.palette.error.main, 0.04),
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          😓 今週は休暇推奨日がありません
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
          全日が高負荷または定員超過です
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderColor: alpha(theme.palette.success.main, 0.3),
        backgroundColor: alpha(theme.palette.success.main, 0.04),
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
          ✨ 年休おすすめ日
        </Typography>
        <Chip
          label={`${suggestions.length}日`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: alpha(theme.palette.success.main, 0.12),
            color: theme.palette.success.dark,
          }}
        />
      </Box>

      {/* Suggestion List */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {suggestions.map((s) => {
          const config = LEVEL_CONFIG[s.level];
          const emoji = RANK_EMOJI[s.rank - 1] ?? `#${s.rank}`;

          return (
            <Paper
              key={s.dateIso}
              variant="outlined"
              onClick={() => onDayClick?.(s.dateIso)}
              role={onDayClick ? 'button' : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onDayClick) {
                  e.preventDefault();
                  onDayClick(s.dateIso);
                }
              }}
              sx={{
                p: 1.5,
                minWidth: 120,
                flex: '1 1 120px',
                maxWidth: 180,
                cursor: onDayClick ? 'pointer' : 'default',
                transition: 'all 0.15s ease-in-out',
                borderColor: alpha(config.color, 0.3),
                '&:hover': onDayClick
                  ? {
                      borderColor: config.color,
                      transform: 'translateY(-1px)',
                      boxShadow: `0 2px 8px ${alpha(config.color, 0.15)}`,
                    }
                  : undefined,
              }}
            >
              {/* Rank + Date */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontSize: '1.1rem', lineHeight: 1 }}>
                  {emoji}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {formatSuggestionDate(s.dateIso)}
                </Typography>
              </Box>

              {/* Level + Score */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip
                  label={config.label}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: alpha(config.color, 0.1),
                    color: config.color,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                    fontSize: '0.65rem',
                  }}
                >
                  負荷 {s.score}
                </Typography>
              </Box>

              {/* Reasons (Phase 3-C) */}
              {s.reasons.length > 0 && (
                <Box sx={{ mt: 0.75, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {s.reasons.map((r) => (
                    <Typography
                      key={r.key}
                      variant="caption"
                      sx={{
                        fontSize: '0.6rem',
                        color: 'text.disabled',
                        backgroundColor: 'action.hover',
                        borderRadius: 0.5,
                        px: 0.5,
                        py: 0.125,
                        lineHeight: 1.5,
                      }}
                    >
                      {r.label}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>
    </Paper>
  );
};
