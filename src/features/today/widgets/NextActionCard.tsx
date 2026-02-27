/**
 * NextActionCard — 次のアクション
 *
 * スケジュールから算出した次の予定を表示。
 * 残り時間つき。予定なし時はプレースホルダ表示。
 */
import { Paper, Typography } from '@mui/material';
import React from 'react';
import type { NextActionItem } from '../hooks/useNextAction';

export type NextActionCardProps = {
  nextAction: NextActionItem | null;
};

function formatMinutesUntil(minutes: number): string {
  if (minutes < 60) return `あと ${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `あと ${h}時間${m}分` : `あと ${h}時間`;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({ nextAction }) => {
  return (
    <Paper data-testid="today-next-action-card" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        ⏭️ 次のアクション
      </Typography>
      {nextAction ? (
        <>
          <Typography variant="h5" fontWeight="bold" color="primary.main">
            {nextAction.time}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            {nextAction.title}
          </Typography>
          {nextAction.owner && (
            <Typography variant="caption" color="text.secondary">
              {nextAction.owner}
            </Typography>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}
          >
            {formatMinutesUntil(nextAction.minutesUntil)}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          本日の予定はすべて完了しました 🎉
        </Typography>
      )}
    </Paper>
  );
};
