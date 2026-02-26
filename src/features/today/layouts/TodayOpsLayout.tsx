import { Box, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { HeroUnfinishedBanner } from '../widgets/HeroUnfinishedBanner';
import { UserCompactList, type UserRow } from '../widgets/UserCompactList';

type HeroProps = {
  unfilledCount: number;
  approvalPendingCount: number;
  onOpenUnfilled: () => void;
  onOpenApproval: () => void;
};

type NextAction = {
  title: string;
  timeText: string;
  onStart?: () => void;
  onDone?: () => void;
};

type TransportUser = { userId: string; name: string };
type AlertItem = { id: string; message: string };

export type TodayOpsProps = {
  hero: HeroProps;
  nextAction?: NextAction;
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void };
  alerts: { items: AlertItem[]; onOpenDetail?: () => void };
};

export const TodayOpsLayout: React.FC<TodayOpsProps> = ({ hero, nextAction, users, alerts }) => {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 8 }}>
      <HeroUnfinishedBanner
        unfilledCount={hero.unfilledCount}
        approvalPendingCount={hero.approvalPendingCount}
        onClickPrimary={hero.onOpenUnfilled}
        sticky={true}
      />

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* 左：主動線 */}
          <Grid size={{ xs: 12, md: 8 }}>
            {alerts.items.length > 0 && (
              <Paper sx={{ p: 2, mb: 3, borderLeft: 4, borderColor: 'warning.main' }}>
                <Typography variant="subtitle2" color="warning.main" fontWeight="bold" gutterBottom>
                  ⚠️ 重要アラート
                </Typography>
                <Stack spacing={1}>
                  {alerts.items.map((a) => (
                    <Typography key={a.id} variant="body2">
                      {a.message}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            )}

            <Typography variant="h6" gutterBottom fontWeight="bold">
              👥 今日の利用者
            </Typography>

            <UserCompactList
              items={users.items}
              onOpenQuickRecord={users.onOpenQuickRecord}
            />
          </Grid>

          {/* 右：補助線 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  次のアクション
                </Typography>
                {nextAction ? (
                  <>
                    <Typography variant="h6">{nextAction.timeText}</Typography>
                    <Typography variant="body1">{nextAction.title}</Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    予定はありません
                  </Typography>
                )}
              </Paper>

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  🚚 送迎状況
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  PR1では仮表示（PR2で実データ接続）
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
