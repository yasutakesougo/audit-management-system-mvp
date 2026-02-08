import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
import { useUsersStore } from '@/features/users/store';
import { TESTIDS } from '@/testids';
import lazyWithPreload from '@/utils/lazyWithPreload';
import { cancelIdle, runOnIdle } from '@/utils/runOnIdle';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TodayHandoffTimelineList } from '@/features/handoff/TodayHandoffTimelineList';

const WeeklySummaryChartLazy = lazyWithPreload(() => import('@/features/records/dashboard/WeeklySummaryChart'));

const TABS = [
  { label: '運営管理情報', value: 'management' },
  { label: '申し送りタイムライン', value: 'timeline' },
  { label: '週次サマリー', value: 'weekly' },
  { label: '朝会', value: 'morning' },
  { label: '夕会', value: 'evening' },
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
  const defaultTab: TabValue = new Date().getHours() < 14 ? 'morning' : 'evening';
  const [tab, setTab] = useState<TabValue>(defaultTab);
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

  const { total, byStatus, criticalCount } = useHandoffSummary({ dayScope: 'today' });
  const hasSummaryInfo = total > 0;

  const meetingGuide = useMemo(() => ({
    morning: {
      title: '朝会',
      subtitle: '今日の要点を確認して、優先対応を揃えます。',
      steps: [
        '安全指標の確認（注意事項があれば共有）',
        '重要・未対応の申し送りを確認',
        '当日の支援・配置の確認',
        '未入力のケース記録の優先度を確認',
      ],
    },
    evening: {
      title: '夕会',
      subtitle: '今日の振り返りと明日の準備を整えます。',
      steps: [
        '本日の記録・対応状況の確認',
        '重要案件の申し送りを整理',
        '未入力のケース記録を確認',
        '明日の注意点を共有',
      ],
    },
  }), []);

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
      <Box py={4} data-testid={TESTIDS['dashboard-briefing-page']}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            朝会・夕会情報
          </Typography>
          <Typography variant="body2" color="text.secondary">
            今日の要点を確認し、進行ガイドを必要なときに開けます。
          </Typography>
        </Stack>
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
              <Button variant="outlined" size="small" onClick={openTimelineToday}>
                タイムラインを開く
              </Button>
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
        {tab === 'morning' && (
          <Stack spacing={3}>
            {hasSummaryInfo && (
              <Paper
                elevation={3}
                sx={{ p: 2, mb: 1.5 }}
                data-testid={TESTIDS['dashboard-briefing-summary-morning']}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    今日の要点
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {criticalCount > 0 && (
                      <Chip size="small" color="error" label={`注意 ${criticalCount}`} />
                    )}
                    {byStatus['未対応'] > 0 && (
                      <Chip size="small" color="warning" label={`未対応 ${byStatus['未対応']}`} />
                    )}
                    <Chip size="small" color="default" label={`合計 ${total}`} />
                  </Stack>
                  <Button
                    size="small"
                    variant="text"
                    onClick={openTimelineToday}
                    sx={{ ml: { sm: 'auto' } }}
                  >
                    タイムラインを見る
                  </Button>
                </Stack>
              </Paper>
            )}
            {!hasSummaryInfo && null}
            <Alert severity="info">
              安全指標サマリはダッシュボードの「安全インジケーター」で確認できます。
            </Alert>
            <Paper elevation={3} sx={{ p: 2, mb: 1.5 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    申し送りタイムライン（昨日）
                  </Typography>
                  <Chip size="small" label="朝会" color="primary" />
                </Stack>
                <TodayHandoffTimelineList dayScope="yesterday" timeFilter="all" />
              </Stack>
            </Paper>
            <Accordion
              elevation={3}
              defaultExpanded={false}
              data-testid={TESTIDS['dashboard-briefing-guide-morning']}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  進行ガイド（チェックリスト）
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {meetingGuide.morning.steps.map((step) => (
                    <Typography key={step} variant="body2">
                      • {step}
                    </Typography>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
        {tab === 'evening' && (
          <Stack spacing={3}>
            {hasSummaryInfo && (
              <Paper
                elevation={3}
                sx={{ p: 2, mb: 1.5 }}
                data-testid={TESTIDS['dashboard-briefing-summary-evening']}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    今日の要点
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {criticalCount > 0 && (
                      <Chip size="small" color="error" label={`注意 ${criticalCount}`} />
                    )}
                    {byStatus['未対応'] > 0 && (
                      <Chip size="small" color="warning" label={`未対応 ${byStatus['未対応']}`} />
                    )}
                    <Chip size="small" color="default" label={`合計 ${total}`} />
                  </Stack>
                  <Button
                    size="small"
                    variant="text"
                    onClick={openTimelineToday}
                    sx={{ ml: { sm: 'auto' } }}
                  >
                    タイムラインを見る
                  </Button>
                </Stack>
              </Paper>
            )}
            {!hasSummaryInfo && null}
            <Alert severity="info">
              記録状況の詳細はダッシュボードの「ケース記録」カードから確認できます。
            </Alert>
            <Paper elevation={3} sx={{ p: 2, mb: 1.5 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    申し送りタイムライン（今日）
                  </Typography>
                  <Chip size="small" label="夕会" color="secondary" />
                </Stack>
                <TodayHandoffTimelineList dayScope="today" timeFilter="all" />
              </Stack>
            </Paper>
            <Accordion
              elevation={3}
              defaultExpanded={false}
              data-testid={TESTIDS['dashboard-briefing-guide-evening']}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  進行ガイド（チェックリスト）
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {meetingGuide.evening.steps.map((step) => (
                    <Typography key={step} variant="body2">
                      • {step}
                    </Typography>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
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
