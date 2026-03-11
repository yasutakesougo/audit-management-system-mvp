/**
 * 週次サマリータブ
 *
 * WeeklySummaryChart を lazy + Suspense で表示。
 * data-* 属性によるパラメータ橋渡しは現在の仕様を維持（将来 props 移行予定）。
 */

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { Suspense } from 'react';
import { WeeklySummaryChartLazy } from '../useBriefingPageState';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type WeeklyTabPanelProps = {
  weekStartYYYYMMDD: string;
  activeUserIds: string[];
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export const WeeklyTabPanel: React.FC<WeeklyTabPanelProps> = ({
  weekStartYYYYMMDD,
  activeUserIds,
}) => (
  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
    <Typography variant="h4" sx={{ fontWeight: 800 }}>
      週次サマリー
    </Typography>
    <Typography variant="body2" color="text.secondary">
      施設全体の記録状況（週次KPI）を俯瞰できます。
    </Typography>
    <Stack
      spacing={3}
      sx={{ mt: 2 }}
      data-week-start={weekStartYYYYMMDD}
      data-users={activeUserIds.join(',')}
    >
      {/* NOTE: 💡 パラメータ橋渡しの設計について
         現在は data-* 属性経由で WeeklySummaryChart が値を取得。
         将来は <WeeklySummaryChartLazy weekStart={weekStartYYYYMMDD} userIds={activeUserIds} />
         のように props 経由に差し替える想定。
         data-* は「レガシー対応期間」として使用中。
      */}
      <Suspense fallback={null}>
        <WeeklySummaryChartLazy />
      </Suspense>
    </Stack>
  </Paper>
);
