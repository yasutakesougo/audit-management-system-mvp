import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { MonthlySummary } from './types';

interface UserKpiCardsProps {
  /** ユーザーの月次サマリー */
  summary: MonthlySummary;
  /** 全体平均完了率（比較用） */
  avgCompletionRate?: number;
}

/**
 * ユーザー個人のKPI指標を表示するカード群
 *
 * 完了率、進捗状況、特記事項、インシデント情報を
 * 視覚的に分かりやすく表示する
 */
export const UserKpiCards: React.FC<UserKpiCardsProps> = ({
  summary,
  avgCompletionRate = 0
}) => {
  const { kpi, completionRate, displayName, userId } = summary;

  // 完了率ステータス
  const getCompletionStatus = (rate: number) => {
    if (rate >= 90) return { label: '優秀', color: 'success' as const, icon: <CheckCircleIcon /> };
    if (rate >= 70) return { label: '良好', color: 'info' as const, icon: <TrendingUpIcon /> };
    return { label: '要注意', color: 'error' as const, icon: <WarningIcon /> };
  };

  // インシデント警告レベル
  const getIncidentSeverity = (count: number) => {
    if (count === 0) return { label: '問題なし', color: 'success' as const };
    if (count <= 2) return { label: '軽微', color: 'warning' as const };
    return { label: '重要', color: 'error' as const };
  };

  const completionStatus = getCompletionStatus(completionRate);
  const incidentSeverity = getIncidentSeverity(kpi.incidents);

  return (
    <Box>
      {/* ユーザー情報ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box>
            <Typography variant="h5" component="h2">
              {displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {userId} • {summary.yearMonth}
            </Typography>
          </Box>
          <Chip
            icon={completionStatus.icon}
            label={completionStatus.label}
            color={completionStatus.color}
            variant="outlined"
          />
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* 完了率カード */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" color="text.secondary">
                    完了率
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {completionRate}%
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={completionRate}
                  sx={{ height: 8, borderRadius: 1 }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', typography: 'caption' }}>
                  <span>目標: 80%</span>
                  {avgCompletionRate > 0 && (
                    <span>
                      平均: {avgCompletionRate}%
                      {completionRate > avgCompletionRate ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* 作業進捗カード */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                作業進捗
              </Typography>

              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">完了</Typography>
                  <Typography variant="body1" color="success.main">
                    {kpi.completedRows} / {kpi.plannedRows}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">進行中</Typography>
                  <Typography variant="body1" color="warning.main">
                    {kpi.inProgressRows}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">未記入</Typography>
                  <Typography variant="body1" color="error.main">
                    {kpi.emptyRows}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* 特記事項カード */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <ScheduleIcon color="info" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" color="text.secondary">
                    特記事項
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {kpi.specialNotes}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* インシデントカード */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <ErrorIcon color={incidentSeverity.color} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" color="text.secondary">
                    インシデント
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="h4" color={`${incidentSeverity.color}.main`}>
                      {kpi.incidents}
                    </Typography>
                    <Chip
                      label={incidentSeverity.label}
                      color={incidentSeverity.color}
                      size="small"
                    />
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* 記録期間カード */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                記録期間
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    初回記入日
                  </Typography>
                  <Typography variant="body1">
                    {summary.firstEntryDate}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    最終記入日
                  </Typography>
                  <Typography variant="body1">
                    {summary.lastEntryDate}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    対象日数
                  </Typography>
                  <Typography variant="body1">
                    {kpi.totalDays}日
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    最終更新
                  </Typography>
                  <Typography variant="body1">
                    {new Date(summary.lastUpdatedUtc).toLocaleString('ja-JP')}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};