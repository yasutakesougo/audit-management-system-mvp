/**
 * NextRecordHero — 「次に書く1件」をヒーロー表示するカード
 *
 * DailyRecord 画面のファーストビューに配置し、
 * 未完了レコードへの即入力を促す CTA を1つだけ提示する。
 *
 * 状態:
 * - next: 次のレコードが存在 → 「記録を開始する」/「記録を続ける」
 * - allCompleted: 全件完了 → 完了メッセージ
 * - noRecords: 対象0件 → データ未生成の案内
 *
 * @see resolveHeroRecord.ts — 表示対象決定の純粋関数
 */

import { motionTokens } from '@/app/theme';
import type { PersonDaily } from '@/domain/daily/types';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo } from 'react';
import { type HeroRecordState, resolveHeroRecord } from '../../domain/legacy/resolveHeroRecord';

// ─── Props ──────────────────────────────────────────────────────

export type NextRecordHeroProps = {
  /** 今日の全レコード（日付フィルタ済み） */
  todayRecords: readonly PersonDaily[];
  /** CTA クリック時のコールバック（対象レコードを渡す） */
  onStartRecord: (record: PersonDaily) => void;
  /** 全件完了時のオプション CTA */
  onAllCompletedAction?: () => void;
};

// ─── Component ──────────────────────────────────────────────────

export const NextRecordHero: React.FC<NextRecordHeroProps> = ({
  todayRecords,
  onStartRecord,
  onAllCompletedAction,
}) => {
  const theme = useTheme();

  const heroState: HeroRecordState = useMemo(
    () => resolveHeroRecord(todayRecords),
    [todayRecords],
  );

  // ── noRecords: 対象0件 ──
  if (heroState.kind === 'noRecords') {
    return (
      <Paper
        data-testid="next-record-hero"
        data-hero-state="noRecords"
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderLeft: 4,
          borderColor: 'grey.400',
          bgcolor: alpha(theme.palette.grey[500], 0.04),
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
          📋 本日の記録対象がまだ作成されていません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          「本日分全員作成」で記録を生成してください
        </Typography>
      </Paper>
    );
  }

  // ── allCompleted: 全件完了 ──
  if (heroState.kind === 'allCompleted') {
    return (
      <Paper
        data-testid="next-record-hero"
        data-hero-state="allCompleted"
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderLeft: 4,
          borderColor: 'success.main',
          bgcolor: alpha(theme.palette.success.main, 0.06),
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
            本日の記録 すべて完了 🎉
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {heroState.total}件の記録が完了しました
        </Typography>
        {onAllCompletedAction && (
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={onAllCompletedAction}
            sx={{ mt: 1.5 }}
            data-testid="hero-all-completed-cta"
          >
            申し送りを確認する
          </Button>
        )}
      </Paper>
    );
  }

  // ── next: 次のレコード ──
  const { record, remaining, total } = heroState;
  const isResume = record.status === '作成中';
  const completedCount = total - remaining;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <Paper
      data-testid="next-record-hero"
      data-hero-state="next"
      elevation={isResume ? 1 : 0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        mb: 3,
        borderLeft: 5,
        borderColor: isResume ? 'warning.main' : 'primary.main',
        bgcolor: isResume
          ? alpha(theme.palette.warning.main, 0.06)
          : alpha(theme.palette.primary.main, 0.04),
        borderRadius: 2,
        transition: `border-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}, background-color ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
      }}
    >
      {/* ── 場面ラベル ── */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 0.5,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'text.secondary',
          fontSize: '0.75rem',
        }}
      >
        {isResume ? '✏️ 続きを書く' : '📝 次の記録'}
      </Typography>

      {/* ── メインメッセージ ── */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} data-testid="hero-user-name">
          {record.userName}
        </Typography>
        <Chip
          label={record.status}
          size="small"
          color={isResume ? 'warning' : 'default'}
          variant={isResume ? 'filled' : 'outlined'}
          sx={{ fontSize: '0.7rem' }}
        />
      </Stack>

      {/* ── 進捗バー ── */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            進捗: {completedCount} / {total} 件完了
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            残り {remaining} 件
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress >= 80 ? 'success' : progress >= 50 ? 'primary' : 'warning'}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          }}
          data-testid="hero-progress-bar"
        />
      </Box>

      {/* ── 主導線 CTA（1つだけ） ── */}
      <Button
        data-testid="hero-cta"
        variant="contained"
        color={isResume ? 'warning' : 'primary'}
        endIcon={isResume ? <EditNoteIcon /> : <NavigateNextIcon />}
        startIcon={isResume ? undefined : <PlayArrowIcon />}
        onClick={() => onStartRecord(record)}
        fullWidth
        sx={{
          minHeight: 48,
          fontSize: '1rem',
          fontWeight: 700,
          borderRadius: 2,
          px: 3,
        }}
      >
        {isResume ? `${record.userName} さんの記録を続ける` : `${record.userName} さんの記録を開始`}
      </Button>
    </Paper>
  );
};
