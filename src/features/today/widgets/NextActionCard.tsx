/**
 * NextActionCard — 次のアクション（Start/Done 実行可能）
 *
 * P0: 表示のみ
 * P1-A: Start/Done ボタン + 経過時間 + 完了状態
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import React from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';

export type NextActionCardProps = {
  nextAction: NextActionWithProgress;
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

export const NextActionCard: React.FC<NextActionCardProps> = ({ nextAction }) => {
  const { item, status, elapsedMinutes, actions } = nextAction;

  return (
    <Paper data-testid="today-next-action-card" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        ⏭️ 次のアクション
      </Typography>

      {item ? (
        <>
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
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', flex: 1 }}
                >
                  {formatMinutesUntil(item.minutesUntil)}
                </Typography>
                <Button
                  data-testid="next-action-start"
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={actions.start}
                  sx={{ minHeight: 36 }}
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
                  sx={{ minHeight: 36 }}
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
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          本日の予定はすべて完了しました 🎉
        </Typography>
      )}
    </Paper>
  );
};
