import React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type StatsSectionProps = {
  stats: {
    totalUsers: number;
    recordedUsers: number;
    completionRate: number;
    seizureCount: number;
  };
  intensiveSupportUsersCount: number;
};

export const StatsSection: React.FC<StatsSectionProps> = (props) => {
  const { stats, intensiveSupportUsersCount } = props;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }} data-testid="dashboard-section-stats">
      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
        <Typography variant="h4" color="primary">
          {stats.totalUsers}名
        </Typography>
        <Typography variant="body2" color="text.secondary">
          総利用者数
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
        <Typography variant="h4" color="success.main">
          {stats.recordedUsers}名
        </Typography>
        <Typography variant="body2" color="text.secondary">
          本日記録完了
        </Typography>
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={stats.completionRate}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary">
            {Math.round(stats.completionRate)}%
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
        <Typography variant="h4" color="secondary.main">
          {intensiveSupportUsersCount}名
        </Typography>
        <Typography variant="body2" color="text.secondary">
          強度行動障害対象者
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
        <Typography variant="h4" color={stats.seizureCount > 0 ? 'error.main' : 'success.main'}>
          {stats.seizureCount}件
        </Typography>
        <Typography variant="body2" color="text.secondary">
          本日発作記録
        </Typography>
      </Paper>
    </Stack>
  );
};
