/**
 * OpsStaffingShortageList — 人員逼迫日の一覧テーブル
 *
 * 責務:
 * - computeHighLoadWarnings() の結果をテーブル形式で表示
 * - 管理者がシフト調整に必要な情報を一覧で把握できるようにする
 * - 新しいロジックは追加しない（並べるだけ）
 *
 * Phase 4-A-2: 警告バナーの詳細版。管理者がここを見るだけでいい状態にする。
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
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

function formatDate(dateIso: string): string {
  return DAY_FORMATTER.format(new Date(dateIso + 'T00:00:00'));
}

// ─── Config ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  high: { emoji: '🟠', label: '高負荷', color: '#f97316' },
  critical: { emoji: '🔴', label: '超過・危険', color: '#dc2626' },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsStaffingShortageListProps = {
  warnings: readonly HighLoadWarning[];
  onDayClick?: (dateIso: string) => void;
};

export const OpsStaffingShortageList: FC<OpsStaffingShortageListProps> = ({
  warnings,
  onDayClick,
}) => {
  const theme = useTheme();

  if (warnings.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: alpha(theme.palette.warning.main, 0.3),
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          backgroundColor: alpha(theme.palette.warning.main, 0.06),
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
          📋 人員逼迫日一覧
        </Typography>
        <Chip
          label={`${warnings.length}日`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: alpha(theme.palette.warning.main, 0.12),
            color: theme.palette.warning.dark,
          }}
        />
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', width: 32, py: 1 }}>
                #
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1 }}>
                日付
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1 }}>
                レベル
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1, textAlign: 'right' }}>
                負荷
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1 }}>
                理由
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warnings.map((w, i) => {
              const config = LEVEL_CONFIG[w.level];
              return (
                <TableRow
                  key={w.dateIso}
                  hover={!!onDayClick}
                  onClick={() => onDayClick?.(w.dateIso)}
                  sx={{
                    cursor: onDayClick ? 'pointer' : 'default',
                    '&:last-child td': { borderBottom: 0 },
                  }}
                >
                  {/* Rank */}
                  <TableCell sx={{ py: 1, fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary' }}>
                    {i + 1}
                  </TableCell>

                  {/* Date */}
                  <TableCell sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                        {config.emoji}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {formatDate(w.dateIso)}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Level */}
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={config.label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        backgroundColor: alpha(config.color, 0.12),
                        color: config.color,
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </TableCell>

                  {/* Score */}
                  <TableCell sx={{ py: 1, textAlign: 'right' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '0.85rem',
                        color: config.color,
                      }}
                    >
                      {w.score}
                    </Typography>
                  </TableCell>

                  {/* Reasons */}
                  <TableCell sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {w.reasons.map((r) => (
                        <Typography
                          key={r.key}
                          variant="caption"
                          sx={{
                            fontSize: '0.6rem',
                            color: alpha(config.color, 0.85),
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
