import { Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';

export type TodayAdminInsightsProps = {
  visible: boolean;
  exceptionCount: number;
  ispRenewSuggestCount?: number;
  onOpenExceptionCenter: () => void;
  onOpenIspRecommendations?: () => void;
};

export const TodayAdminInsights: React.FC<TodayAdminInsightsProps> = ({
  visible,
  exceptionCount,
  ispRenewSuggestCount = 0,
  onOpenExceptionCenter,
  onOpenIspRecommendations,
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
          <Typography variant="body2" color="text.secondary">
            ISP見直し推奨 {ispRenewSuggestCount}件
          </Typography>
        </Stack>
      </CardContent>
      <CardActions>
        <Button variant="text" onClick={onOpenExceptionCenter}>
          例外センターを開く
        </Button>
        <Button
          variant="text"
          onClick={onOpenIspRecommendations}
          disabled={ispRenewSuggestCount <= 0}
        >
          見直し提案を確認
        </Button>
      </CardActions>
    </Card>
  );
};

export default TodayAdminInsights;
