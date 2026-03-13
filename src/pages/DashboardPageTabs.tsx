/**
 * /dashboard/briefing ページ
 *
 * 薄い Container: タブの配線のみ行い、
 * 状態管理は useBriefingPageState、表示は各 Panel に委譲する。
 *
 * Before: 403行（全ロジック内包）
 * After:  ~80行（配線のみ）
 */

import {
  BRIEFING_TABS,
  MeetingTabContent,
  TimelineTabPanel,
  WeeklyTabPanel,
  useBriefingPageState,
} from '@/features/dashboard/briefing';
import type { BriefingTabValue } from '@/features/dashboard/briefing';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React from 'react';

const DashboardPageTabs: React.FC = () => {
  const { tab, summary, timelines, weekly, actions } = useBriefingPageState();

  return (
    <Container maxWidth="lg" data-testid={TESTIDS['dashboard-page-tabs']}>
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
          value={tab.value}
          onChange={(_, v: BriefingTabValue) => tab.set(v)}
          aria-label="運営状況タブ"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3 }}
        >
          {BRIEFING_TABS.map((t) => (
            <Tab
              key={t.value}
              label={t.label}
              value={t.value}
              onMouseEnter={t.value === 'weekly' ? weekly.preloadOnHover : undefined}
              data-testid={TESTIDS[`dashboard-tab-${t.value}` as keyof typeof TESTIDS]}
            />
          ))}
        </Tabs>


        {tab.value === 'timeline' && (
          <TimelineTabPanel onOpen={actions.openTimelineToday} />
        )}

        {tab.value === 'weekly' && (
          <WeeklyTabPanel
            weekStartYYYYMMDD={weekly.weekStartYYYYMMDD}
            activeUserIds={weekly.activeUserIds}
          />
        )}

        {tab.value === 'morning' && (
          <MeetingTabContent
            mode="morning"
            hasSummaryInfo={summary.hasSummaryInfo}
            total={summary.total}
            criticalCount={summary.criticalCount}
            byStatus={summary.byStatus}
            timeline={timelines.morning}
            handoffStats={timelines.morningStats}
            onStatsChange={timelines.setMorningStats}
            previewLimit={timelines.previewLimit}
            onOpenTimeline={actions.openTimelineYesterday}
          />
        )}

        {tab.value === 'evening' && (
          <MeetingTabContent
            mode="evening"
            hasSummaryInfo={summary.hasSummaryInfo}
            total={summary.total}
            criticalCount={summary.criticalCount}
            byStatus={summary.byStatus}
            timeline={timelines.evening}
            handoffStats={timelines.eveningStats}
            onStatsChange={timelines.setEveningStats}
            previewLimit={timelines.previewLimit}
            onOpenTimeline={actions.openTimelineToday}
          />
        )}


      </Box>
    </Container>
  );
};

export default DashboardPageTabs;
