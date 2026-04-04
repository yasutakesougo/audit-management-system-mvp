import { Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import React from 'react';

export type TodayHeaderSummaryProps = {
  dateText: string;
  targetCount: number;
  attendancePending: number;
  recordPending: number;
  handoffPending: number;
};

export const TodayHeaderSummary: React.FC<TodayHeaderSummaryProps> = ({
  dateText,
  targetCount,
  attendancePending,
  recordPending,
  handoffPending,
}) => {
  return (
    <Card variant="outlined" data-testid="today-lite-header-summary">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {dateText}
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">本日対象</Typography>
              <Typography variant="h6" fontWeight={700}>{targetCount}名</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">出欠未確認</Typography>
              <Typography variant="h6" fontWeight={700}>{attendancePending}名</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">記録未完了</Typography>
              <Typography variant="h6" fontWeight={700}>{recordPending}件</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">申し送り未確認</Typography>
              <Typography variant="h6" fontWeight={700}>{handoffPending}件</Typography>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TodayHeaderSummary;
