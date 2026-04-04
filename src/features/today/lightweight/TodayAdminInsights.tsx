import { Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';

export type TodayAdminInsightsProps = {
  visible: boolean;
  exceptionCount: number;
  onOpenExceptionCenter: () => void;
};

export const TodayAdminInsights: React.FC<TodayAdminInsightsProps> = ({
  visible,
  exceptionCount,
  onOpenExceptionCenter,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <Card variant="outlined" data-testid="today-lite-admin-insights">
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" fontWeight={700}>管理サマリー</Typography>
          <Typography variant="body2" color="text.secondary">
            要確認例外 {exceptionCount}件
          </Typography>
        </Stack>
      </CardContent>
      <CardActions>
        <Button variant="text" onClick={onOpenExceptionCenter}>
          例外センターを開く
        </Button>
      </CardActions>
    </Card>
  );
};

export default TodayAdminInsights;
