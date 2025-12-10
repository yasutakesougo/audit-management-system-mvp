import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { MonthlySummary } from './types';

interface UserProgressChartProps {
  /** ユーザーの月次サマリー */
  summary: MonthlySummary;
}

/**
 * ユーザーの作業進捗を視覚化するチャート
 *
 * 完了率、進行中、未記入の割合をプログレスバーで表示し
 * 特記事項とインシデントの比率も可視化する
 */
export const UserProgressChart: React.FC<UserProgressChartProps> = ({ summary }) => {
  const { kpi, completionRate } = summary;

  // 各項目の割合を計算
  const completedRatio = (kpi.completedRows / kpi.plannedRows) * 100;
  const inProgressRatio = (kpi.inProgressRows / kpi.plannedRows) * 100;
  const emptyRatio = (kpi.emptyRows / kpi.plannedRows) * 100;

  // 特記事項・インシデントの相対比率
  const specialNotesRatio = Math.min((kpi.specialNotes / kpi.plannedRows) * 100, 100);
  const incidentsRatio = Math.min((kpi.incidents / kpi.plannedRows) * 100, 100);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          作業進捗の詳細
        </Typography>

        <Stack spacing={3}>
          {/* 完了状況の内訳 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              作業完了状況
            </Typography>

            <Stack spacing={1}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">完了済み</Typography>
                  <Typography variant="caption" color="success.main">
                    {kpi.completedRows}行 ({completedRatio.toFixed(1)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={completedRatio}
                  color="success"
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">進行中</Typography>
                  <Typography variant="caption" color="warning.main">
                    {kpi.inProgressRows}行 ({inProgressRatio.toFixed(1)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={inProgressRatio}
                  color="warning"
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">未記入</Typography>
                  <Typography variant="caption" color="error.main">
                    {kpi.emptyRows}行 ({emptyRatio.toFixed(1)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={emptyRatio}
                  color="error"
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            </Stack>
          </Box>

          {/* 注意事項の発生状況 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              注意事項・イベント発生状況
            </Typography>

            <Stack spacing={1}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">特記事項</Typography>
                  <Typography variant="caption" color="info.main">
                    {kpi.specialNotes}件 ({specialNotesRatio.toFixed(1)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={specialNotesRatio}
                  color="info"
                  sx={{ height: 4, borderRadius: 1 }}
                />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">インシデント</Typography>
                  <Typography variant="caption" color="error.main">
                    {kpi.incidents}件 ({incidentsRatio.toFixed(1)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={incidentsRatio}
                  color="error"
                  sx={{ height: 4, borderRadius: 1 }}
                />
              </Box>
            </Stack>
          </Box>

          {/* 全体サマリー */}
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                総合完了率
              </Typography>
              <Typography variant="h6" color="primary.main">
                {completionRate}%
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {kpi.completedRows} / {kpi.plannedRows} 行完了
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};