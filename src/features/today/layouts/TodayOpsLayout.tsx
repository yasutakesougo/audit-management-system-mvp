/**
 * TodayOpsLayout — 「今日の業務」画面レイアウト
 *
 * 左カラム: Hero → 出席サマリー → ブリーフィングアラート → 利用者一覧
 * 右カラム: 次のアクション → 送迎状況(P1)
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { Box, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import type { AttendanceSummaryCardProps } from '../widgets/AttendanceSummaryCard';
import { AttendanceSummaryCard } from '../widgets/AttendanceSummaryCard';
import { BriefingActionList } from '../widgets/BriefingActionList';
import { HeroUnfinishedBanner } from '../widgets/HeroUnfinishedBanner';
import { NextActionCard } from '../widgets/NextActionCard';
import { UserCompactList, type UserRow } from '../widgets/UserCompactList';

type HeroProps = {
  unfilledCount: number;
  approvalPendingCount: number;
  onOpenUnfilled: () => void;
  onOpenApproval: () => void;
  onOpenMenu?: () => void;
};

type TransportUser = { userId: string; name: string };

export type TodayOpsProps = {
  hero: HeroProps;
  attendance: AttendanceSummaryCardProps;
  briefingAlerts: BriefingAlert[];
  nextAction: NextActionWithProgress;
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void };
};

export const TodayOpsLayout: React.FC<TodayOpsProps> = ({
  hero,
  attendance,
  briefingAlerts,
  nextAction,
  users,
}) => {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 8 }}>
      <HeroUnfinishedBanner
        unfilledCount={hero.unfilledCount}
        approvalPendingCount={hero.approvalPendingCount}
        onClickPrimary={hero.onOpenUnfilled}
        onClickSecondary={hero.onOpenMenu}
        sticky={true}
      />

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* 左：主動線 */}
          <Grid size={{ xs: 12, md: 8 }}>
            <AttendanceSummaryCard {...attendance} />

            <BriefingActionList alerts={briefingAlerts} />

            <Typography variant="h6" gutterBottom fontWeight="bold">
              👥 今日の利用者
            </Typography>

            <UserCompactList
              items={users.items}
              onOpenQuickRecord={users.onOpenQuickRecord}
              onOpenISP={users.onOpenISP}
            />
          </Grid>

          {/* 右：補助線 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <NextActionCard nextAction={nextAction} />

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  🚚 送迎状況
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  P1で実データ接続予定
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
