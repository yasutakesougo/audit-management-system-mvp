/**
 * TodayOpsLayout — 「今日の業務」画面レイアウト
 *
 * 左カラム: Hero(常時表示) → Tabs(出席 / ブリーフィング / 利用者)
 * 右カラム: 次のアクション(sticky) → 送迎状況(Accordion)
 *
 * Layout state は view-only（tab index）に限定。
 * データ集約・副作用は追加しない。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
    Box,
    Container,
    Grid,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import { TransportStatusCard, type TransportStatusCardProps } from '../transport';
import type { AttendanceSummaryCardProps } from '../widgets/AttendanceSummaryCard';
import { AttendanceSummaryCard } from '../widgets/AttendanceSummaryCard';
import { BriefingActionList } from '../widgets/BriefingActionList';
import { HeroUnfinishedBanner } from '../widgets/HeroUnfinishedBanner';
import type { NextActionCardProps } from '../widgets/NextActionCard';
import { NextActionCard } from '../widgets/NextActionCard';
import { UserCompactList, type UserRow } from '../widgets/UserCompactList';

// ─── a11y helper: tab/tabpanel id binding ───────────────────────────
function a11yTabProps(index: number) {
  return {
    id: `today-tab-${index}`,
    'aria-controls': `today-tabpanel-${index}`,
  };
}

function a11yTabPanelProps(index: number) {
  return {
    id: `today-tabpanel-${index}`,
    'aria-labelledby': `today-tab-${index}`,
    role: 'tabpanel' as const,
  };
}

/** Tab label with optional completion ✅ */
function TabLabel({ emoji, text, isComplete }: { emoji: string; text: string; isComplete: boolean }) {
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {emoji} {text}
      {isComplete && <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', ml: 0.5 }} />}
    </Box>
  );
}

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
  nextActionEmptyAction?: NextActionCardProps['onEmptyAction'];
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  /** Phase 3: Full transport status card props (replaces accordion) */
  transportCard?: TransportStatusCardProps;
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void; onEmptyAction?: () => void };
};

export const TodayOpsLayout: React.FC<TodayOpsProps> = ({
  hero,
  attendance,
  briefingAlerts,
  nextAction,
  nextActionEmptyAction,
  transportCard,
  users,
}) => {
  // view-only state: tab index のみ
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 8 }}>
      {/* Hero — Tabs 外で常時表示 */}
      <HeroUnfinishedBanner
        unfilledCount={hero.unfilledCount}
        approvalPendingCount={hero.approvalPendingCount}
        onClickPrimary={hero.onOpenUnfilled}
        onClickSecondary={hero.onOpenMenu}
        sticky={true}
      />

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* 左：主動線 — Tabs で出席/ブリーフィング/利用者を切替 */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Tabs
              data-testid="today-tabs"
              value={tab}
              onChange={(_, v) => setTab(v)}
              aria-label="今日の業務セクション"
              sx={{
                mb: 2,
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  fontWeight: 'bold',
                  textTransform: 'none',
                  minHeight: 48,
                },
              }}
            >
              <Tab
                label={<TabLabel emoji="📊" text="出席" isComplete={attendance.facilityAttendees === 0 && attendance.absenceCount === 0 && attendance.lateOrEarlyLeave === 0} />}
                {...a11yTabProps(0)}
              />
              <Tab
                label={<TabLabel emoji="📋" text="ブリーフィング" isComplete={briefingAlerts.length === 0} />}
                {...a11yTabProps(1)}
              />
              <Tab
                label={<TabLabel emoji="👥" text="利用者" isComplete={users.items.length > 0 && users.items.every(u => u.recordFilled)} />}
                {...a11yTabProps(2)}
              />
            </Tabs>

            {/* TabPanel 0: 出席 — 常時マウント / hidden + display 切替 */}
            <Box
              {...a11yTabPanelProps(0)}
              data-testid="today-tabpanel-attendance"
              hidden={tab !== 0}
              sx={{ display: tab === 0 ? 'block' : 'none' }}
            >
              <AttendanceSummaryCard {...attendance} />
            </Box>

            {/* TabPanel 1: ブリーフィング — 常時マウント / hidden + display 切替 */}
            <Box
              {...a11yTabPanelProps(1)}
              data-testid="today-tabpanel-briefing"
              hidden={tab !== 1}
              sx={{ display: tab === 1 ? 'block' : 'none' }}
            >
              <BriefingActionList alerts={briefingAlerts} />
            </Box>

            {/* TabPanel 2: 利用者 — 常時マウント / hidden + display 切替 */}
            <Box
              {...a11yTabPanelProps(2)}
              data-testid="today-tabpanel-users"
              hidden={tab !== 2}
              sx={{ display: tab === 2 ? 'block' : 'none' }}
            >
              <Typography variant="h6" gutterBottom fontWeight="bold">
                👥 今日の利用者
              </Typography>
              <UserCompactList
                items={users.items}
                onOpenQuickRecord={users.onOpenQuickRecord}
                onOpenISP={users.onOpenISP}
                onEmptyAction={users.onEmptyAction}
              />
            </Box>
          </Grid>

          {/* 右：補助線 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <NextActionCard nextAction={nextAction} onEmptyAction={nextActionEmptyAction} />

              {/* 送迎状況 — TransportStatusCard (Phase 3) or placeholder */}
              {transportCard ? (
                <TransportStatusCard {...transportCard} />
              ) : (
                <Box
                  data-testid="today-accordion-transport"
                  sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    🚚 送迎機能は準備中です
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
