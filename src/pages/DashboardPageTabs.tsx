import HandoffSummaryForMeeting from '@/features/handoff/HandoffSummaryForMeeting';
import MeetingGuidePage from '@/features/records/dashboard/MeetingGuidePage';
import { useUsersStore } from '@/features/users/store';
import { TESTIDS } from '@/testids';
import lazyWithPreload from '@/utils/lazyWithPreload';
import { cancelIdle, runOnIdle } from '@/utils/runOnIdle';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const WeeklySummaryChartLazy = lazyWithPreload(() => import('@/features/records/dashboard/WeeklySummaryChart'));

const TABS = [
  { label: '運営管理情報', value: 'management' },
  { label: '申し送りタイムライン', value: 'timeline' },
  { label: '週次サマリー', value: 'weekly' },
  { label: 'ミーティングガイド', value: 'meeting' },
  { label: '統合利用者プロファイル', value: 'profile' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

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
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabValue>('timeline'); // 初期タブを「申し送りタイムライン」に変更
  const { data: usersStore = [] } = useUsersStore(); // 🛡️ undefined対策: 初期値 [] でクラッシュ防止
  const activeUsers = useMemo(() => usersStore.filter((user) => user?.IsActive !== false), [usersStore]);
  const activeUserIds = useMemo(() => activeUsers.map(getUserId), [activeUsers]);
  const weekStartYYYYMMDD = useMemo(
    () => startOfWeek(new Date(), 1).toISOString().split('T')[0],
    []
  );
  const hoverTimerRef = useRef<number | null>(null);
  const openTimelineToday = useCallback(() => {
    navigate('/handoff-timeline', { state: { dayScope: 'today', timeFilter: 'all' } });
  }, [navigate]);

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
  <Container maxWidth="lg" data-testid={TESTIDS['dashboard-page-tabs']}> {/* 🧪 タブ専用testid */}
      <Box py={4}>
        <Tabs
          value={tab}
          onChange={(_, v: TabValue) => setTab(v)} // 🎯 型安全: TabValue で制限
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
              data-testid={TESTIDS[`dashboard-tab-${t.value}` as keyof typeof TESTIDS]} // 🌱 個別タブ検査用
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
              今日の申し送り状況のサマリーを確認し、詳細はタイムライン画面で操作できます。
            </Typography>
            <Box sx={{ mt: 2 }}>
              <HandoffSummaryForMeeting
                dayScope="today"
                title="申し送りタイムライン"
                description="今日の申し送りの件数と状況を確認できます。詳細はタイムライン画面で確認してください。"
                actionLabel="タイムラインを開く"
                onOpenTimeline={openTimelineToday}
              />
            </Box>
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
            <Stack
              spacing={3}
              sx={{ mt: 2 }}
              data-week-start={weekStartYYYYMMDD}
              data-users={activeUserIds.join(',')}
            >
              {/* NOTE: 💡 パラメータ橋渡しの設計について
                 現在は data-* 属性経由で WeeklySummaryChart が値を取得。
                 将来は <WeeklySummaryChartLazy weekStart={weekStartYYYYMMDD} userIds={activeUserIds} />
                 のように props 経由に差し替える想定。
                 data-* は「レガシー対応期間」として使用中。
              */}
              <Suspense fallback={null}>
                <WeeklySummaryChartLazy />
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
