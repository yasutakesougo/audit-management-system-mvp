import { Box, Button, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

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
type UserRow = { userId: string; name: string; status: 'present' | 'absent' | 'unknown' };
type AlertItem = { id: string; message: string };

export type TodayOpsProps = {
  hero: HeroProps;
  nextAction?: NextAction;
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void };
  alerts: { items: AlertItem[]; onOpenDetail?: () => void };
};

export const TodayOpsLayout: React.FC<TodayOpsProps> = ({ hero, nextAction, users, alerts }) => {
  const isComplete = hero.unfilledCount === 0 && hero.approvalPendingCount === 0;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 8 }}>
      {/* PR1: Heroはここに仮置き（PR2でHeroUnfinishedBannerへ分離） */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          px: 2,
          py: 1.5,
          bgcolor: isComplete ? 'success.main' : 'error.main',
          color: 'common.white',
          display: 'flex',
          gap: 2,
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 2,
        }}
      >
        {isComplete ? (
          <Typography variant="subtitle1" fontWeight="bold">
            ✅ 本日完了
          </Typography>
        ) : (
          <Typography variant="subtitle1" fontWeight="bold">
            🔴 未記録 {hero.unfilledCount}件 / 🟡 承認待ち {hero.approvalPendingCount}件
          </Typography>
        )}

        {!isComplete && (
          <Button
            variant="contained"
            color="inherit"
            onClick={hero.onOpenUnfilled}
            sx={{
              color: 'error.main',
              fontWeight: 'bold',
              minHeight: 44, // タップ領域
              px: 2,
            }}
          >
            今すぐ入力
          </Button>
        )}
      </Box>

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

            <Stack spacing={1.25}>
              {users.items.length === 0 ? (
                <Typography color="text.secondary">利用予定はありません</Typography>
              ) : (
                users.items.map((u) => (
                  <Paper
                    key={u.userId}
                    role="button"
                    tabIndex={0}
                    onClick={() => users.onOpenQuickRecord(u.userId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') users.onOpenQuickRecord(u.userId);
                    }}
                    sx={{
                      p: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      minHeight: 44, // タップ領域
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="body1" fontWeight={500}>
                      {u.name}
                    </Typography>
                    <Button size="small" variant="outlined" sx={{ minHeight: 36 }}>
                      記録
                    </Button>
                  </Paper>
                ))
              )}
            </Stack>
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
