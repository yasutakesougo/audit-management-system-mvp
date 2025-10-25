import React, { useMemo, useState } from 'react';
import { Box, Container, Paper, Stack, Typography, Tabs, Tab } from '@mui/material';
import { WeeklySummaryChart } from '@/features/records/dashboard/WeeklySummaryChart';
import MeetingGuidePage from '@/features/records/dashboard/MeetingGuidePage';
import { TESTIDS } from '@/testing/testids';
import { useUsersStore } from '@/features/users/store';

const TABS = [
  { label: '運営管理情報', value: 'management' },
  { label: '申し送りタイムライン', value: 'timeline' },
  { label: '週次サマリー', value: 'weekly' },
  { label: 'ミーティングガイド', value: 'meeting' },
  { label: '統合利用者プロファイル', value: 'profile' },
];

const startOfWeek = (d: Date, weekStart = 1) => {
  const day = d.getDay();
  const diff = (day < weekStart ? 7 : 0) + day - weekStart;
  const base = new Date(d);
  base.setDate(d.getDate() - diff);
  base.setHours(0, 0, 0, 0);
  return base;
};

type MaybeUser = { Id?: number | string; UserID?: string | number; IsActive?: boolean | null };
const getUserId = (u: MaybeUser) => String(u.UserID ?? u.Id ?? '');

const DashboardPageTabs: React.FC = () => {
  const [tab, setTab] = useState('management');
  const { data: usersStore = [] } = useUsersStore();
  const activeUsers = useMemo(() => usersStore.filter(u => u?.IsActive !== false), [usersStore]);
  const activeUserIds = useMemo(() => activeUsers.map(getUserId), [activeUsers]);
  const weekStartYYYYMMDD = useMemo(
    () => startOfWeek(new Date(), 1).toISOString().split('T')[0],
    []
  );

  return (
  <Container maxWidth="lg" data-testid={TESTIDS.DASHBOARD.PAGE}>
      <Box py={4}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          aria-label="黒ノート機能タブ"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3 }}
        >
          {TABS.map((t) => (
            <Tab key={t.value} label={t.label} value={t.value} />
          ))}
        </Tabs>
        {tab === 'management' && (
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              運営管理情報
            </Typography>
            <Typography variant="body2" color="text.secondary">
              施設運営に関する管理情報やお知らせを表示します。
            </Typography>
            {/* 管理情報のUIやコンポーネントをここに追加 */}
          </Paper>
        )}
        {tab === 'timeline' && (
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              申し送りタイムライン
            </Typography>
            <Typography variant="body2" color="text.secondary">
              施設内の申し送り事項や記録のタイムラインを表示します。
            </Typography>
            {/* タイムラインのUIやコンポーネントをここに追加 */}
          </Paper>
        )}
        {tab === 'weekly' && (
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              週次サマリー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              施設全体の記録状況（週次KPI）を俯瞰できます。
            </Typography>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <WeeklySummaryChart userIds={activeUserIds} weekStartYYYYMMDD={weekStartYYYYMMDD} />
            </Stack>
          </Paper>
        )}
        {tab === 'meeting' && <MeetingGuidePage />}
        {tab === 'profile' && (
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              統合利用者プロファイル
            </Typography>
            <Typography variant="body2" color="text.secondary">
              利用者の統合プロファイル情報をここに表示します（開発中）。
            </Typography>
            {/* プロファイルUIやコンポーネントをここに追加 */}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default DashboardPageTabs;
