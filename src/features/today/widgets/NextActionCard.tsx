/**
 * NextActionCard — 次のアクション（Start/Done 実行可能）
 *
 * P0: 表示のみ
 * P1-A: Start/Done ボタン + 経過時間 + 完了状態
 * PR-3: sticky 化 + urgency に応じた左ボーダー/背景色
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { NextActionWithProgress, Urgency } from '../hooks/useNextAction';
import { EmptyStateBlock } from './EmptyStateBlock';

export type NextActionCardProps = {
  nextAction: NextActionWithProgress;
  /** 空状態CTAクリック時の導線（スケジュール確認等） */
  onEmptyAction?: () => void;
};

function formatMinutesUntil(minutes: number): string {
  if (minutes < 60) return `あと ${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `あと ${h}時間${m}分` : `あと ${h}時間`;
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}分経過`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分経過` : `${h}時間経過`;
}

const URGENCY_COLOR: Record<Urgency, string> = {
  low: 'text.secondary',
  medium: 'warning.main',
  high: 'error.main',
};

const URGENCY_BORDER_COLOR: Record<Urgency, string> = {
  low: 'grey.300',
  medium: 'warning.main',
  high: 'error.main',
};

export const NextActionCard: React.FC<NextActionCardProps> = ({ nextAction, onEmptyAction }) => {
  const { item, status, urgency, elapsedMinutes, actions } = nextAction;
  const theme = useTheme();

  // Empty state: early return — no sticky Paper wrapper
  if (!item) {
    return (
      <Paper data-testid="today-next-action-card" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          ⏭️ 次のアクション
        </Typography>
        <EmptyStateBlock
          icon={<EventAvailableIcon />}
          title="次の予定はありません"
          description="本日の予定はすべて完了しています。"
          primaryAction={
            onEmptyAction
              ? { label: 'スケジュールを見る', onClick: onEmptyAction, testId: 'today-empty-next-action-cta' }
              : undefined
          }
          testId="today-empty-next-action"
        />
      </Paper>
    );
  }

  // urgency-based background using alpha() — theme-agnostic
  const urgencyBg =
    urgency === 'high'
      ? alpha(theme.palette.error.main, 0.06)
      : urgency === 'medium'
        ? alpha(theme.palette.warning.main, 0.06)
        : theme.palette.background.paper;

  return (
    <Paper
      data-testid="today-next-action-card"
      sx={{
        p: 2,
        position: 'sticky',
        top: theme.spacing(1),
        zIndex: 10,
        borderLeft: 4,
        borderColor: URGENCY_BORDER_COLOR[urgency],
        bgcolor: urgencyBg,
        transition: 'border-color 0.3s, background-color 0.3s',
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        ⏭️ 次のアクション
      </Typography>

      {/* Time + Title */}
      <Typography variant="h5" fontWeight="bold" color="primary.main">
        {item.time}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {item.title}
      </Typography>
      {item.owner && (
        <Typography variant="caption" color="text.secondary">
          {item.owner}
        </Typography>
      )}

      {/* Status line */}
      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        {status === 'idle' && (
          <>
            <Typography
              variant="caption"
              color={URGENCY_COLOR[urgency]}
              sx={{ fontStyle: 'italic', flex: 1, fontWeight: urgency !== 'low' ? 'bold' : undefined }}
            >
              {formatMinutesUntil(item.minutesUntil)}
            </Typography>
            <Button
              data-testid="next-action-start"
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={actions.start}
              sx={{ minHeight: 44 }}
            >
              開始
            </Button>
          </>
        )}

        {status === 'started' && (
          <>
            <Chip
              label={elapsedMinutes !== null ? formatElapsed(elapsedMinutes) : '実行中'}
              color="info"
              size="small"
              variant="outlined"
              sx={{ flex: '0 0 auto' }}
            />
            <Box sx={{ flex: 1 }} />
            <Button
              data-testid="next-action-done"
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={actions.done}
              sx={{ minHeight: 44 }}
            >
              完了
            </Button>
          </>
        )}

        {status === 'done' && (
          <Chip
            data-testid="next-action-done-chip"
            icon={<CheckCircleIcon />}
            label="完了"
            color="success"
            size="small"
            variant="filled"
          />
        )}
      </Box>
    </Paper>
  );
};
