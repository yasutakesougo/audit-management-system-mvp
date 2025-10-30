import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MeetingGuidePage from '@/features/records/dashboard/MeetingGuidePage';
import { TESTIDS } from '@/testids';
import { useUsersStore } from '@/features/users/store';
import lazyWithPreload from '@/utils/lazyWithPreload';
import { cancelIdle, runOnIdle } from '@/utils/runOnIdle';

const WeeklySummaryChartLazy = lazyWithPreload(() =>
  import('@/features/records/dashboard/WeeklySummaryChart').then((module) => ({ default: module.WeeklySummaryChart })),
);

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
  const { data: usersStore } = useUsersStore();
  const activeUsers = useMemo(() => usersStore.filter((user) => user?.IsActive !== false), [usersStore]);
  const activeUserIds = useMemo(() => activeUsers.map(getUserId), [activeUsers]);
  const weekStartYYYYMMDD = useMemo(
    () => startOfWeek(new Date(), 1).toISOString().split('T')[0],
    []
  );
  const hoverTimerRef = useRef<number | null>(null);

  const preloadOnHover = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      WeeklySummaryChartLazy.preload?.();
    }, 150);
  }, []);

  useEffect(() => {
    const handle = runOnIdle(() => WeeklySummaryChartLazy.preload?.());
    return () => {
      cancelIdle(handle);
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (tab === 'weekly') {
      WeeklySummaryChartLazy.preload?.();
    }
  }, [tab]);

  return (
  <Container maxWidth="lg" data-testid={TESTIDS['dashboard-page']}>
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
            <Tab
              key={t.value}
              label={t.label}
              value={t.value}
              onMouseEnter={t.value === 'weekly' ? preloadOnHover : undefined}
            />
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
              <Suspense fallback={null}>
                <WeeklySummaryChartLazy userIds={activeUserIds} weekStartYYYYMMDD={weekStartYYYYMMDD} />
              </Suspense>
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
