/**
 * TodayBentoLayout — Bento Grid 版「今日の業務」画面レイアウト
 *
 * 従来の 2-column + Tabs レイアウトを、全ウィジェットが一覧できる
 * Bento Grid レイアウトに刷新。タブレット操作に最適化。
 *
 * Grid 配置 (md 4-column):
 * ┌──────────────────────────────────────┐
 * │    Hero (full-width, sticky banner)   │
 * ├──────────┬───────────────────────────┤
 * │Attendance│      Briefing (3col)       │
 * │  (1col)  │                            │
 * ├──────────┴───────────────────────────┤
 * │     ServiceStructure (full 4col)      │
 * ├───────────────────────┬──────────────┤
 * │   Users (3col)        │  NextAction  │
 * │                       │   (1col)     │
 * ├───────────────────────┴──────────────┤
 * │        Transport (full 4col)          │
 * └──────────────────────────────────────┘
 *
 * Mobile (1-column): すべて縦並び
 * Tablet (2-column): Hero → Attendance(1)+Briefing(2) → Service(2) → Users(2)+Next(1) → Transport(2)
 *
 * Layout state は view-only。データ集約・副作用は追加しない。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 * @see docs/ui-principles.md
 */
import { BentoCard, BentoContainer } from '@/components/ui/BentoGrid';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { ServiceStructure } from '@/features/today/domain/serviceStructure.types';
import {
    Box,
    Typography,
} from '@mui/material';
import React from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import { TransportStatusCard, type TransportStatusCardProps } from '../transport';
import type { AttendanceSummaryCardProps } from '../widgets/AttendanceSummaryCard';
import { AttendanceSummaryCard } from '../widgets/AttendanceSummaryCard';
import { BriefingActionList } from '../widgets/BriefingActionList';
import { HeroUnfinishedBanner } from '../widgets/HeroUnfinishedBanner';
import type { NextActionCardProps } from '../widgets/NextActionCard';
import { NextActionCard } from '../widgets/NextActionCard';
import { TodayServiceStructureCard } from '../widgets/TodayServiceStructureCard';
import { UserCompactList, type UserRow } from '../widgets/UserCompactList';

// ─── Types ───────────────────────────────────────────────────

type HeroProps = {
  unfilledCount: number;
  approvalPendingCount: number;
  onOpenUnfilled: () => void;
  onOpenApproval: () => void;
  onOpenMenu?: () => void;
};

type TransportUser = { userId: string; name: string };

export type TodayBentoProps = {
  hero: HeroProps;
  attendance: AttendanceSummaryCardProps;
  briefingAlerts: BriefingAlert[];
  serviceStructure?: ServiceStructure;
  nextAction: NextActionWithProgress;
  nextActionEmptyAction?: NextActionCardProps['onEmptyAction'];
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  transportCard?: TransportStatusCardProps;
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void; onEmptyAction?: () => void };
};

// ─── Compact Section Title ───────────────────────────────────

function SectionLabel({ emoji, text }: { emoji: string; text: string }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mb: 1.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'text.secondary',
        fontSize: '0.7rem',
      }}
    >
      {emoji} {text}
    </Typography>
  );
}

// ─── Layout ──────────────────────────────────────────────────

export const TodayBentoLayout: React.FC<TodayBentoProps> = ({
  hero,
  attendance,
  briefingAlerts,
  serviceStructure,
  nextAction,
  nextActionEmptyAction,
  transportCard,
  users,
}) => {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        pb: 8,
      }}
    >
      {/* ── Row 0: Hero Banner (full bleed, outside BentoContainer) ── */}
      <HeroUnfinishedBanner
        unfilledCount={hero.unfilledCount}
        approvalPendingCount={hero.approvalPendingCount}
        onClickPrimary={hero.onOpenUnfilled}
        onClickSecondary={hero.onOpenMenu}
        sticky={true}
      />

      {/* ── Bento Grid ── */}
      <BentoContainer sx={{ mt: 3 }}>
        {/* ── Row 1: Attendance (1) + Briefing (3) — 朝会確認導線 ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 1, md: 1 }}
          testId="bento-attendance"
        >
          <SectionLabel emoji="📊" text="出席状況" />
          <AttendanceSummaryCard {...attendance} />
        </BentoCard>

        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 3 }}
          variant="subtle"
          testId="bento-briefing"
        >
          <SectionLabel emoji="📋" text="申し送り" />
          <BriefingActionList alerts={briefingAlerts} />
        </BentoCard>

        {/* ── Row 2: Service Structure (full-width) — 朝会確認の一部 ── */}
        {serviceStructure && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId="bento-service-structure"
          >
            <SectionLabel emoji="🏢" text="業務体制" />
            <TodayServiceStructureCard serviceStructure={serviceStructure} />
          </BentoCard>
        )}

        {/* ── Row 3: Users (3) + NextAction (1) — 実行導線 ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 3 }}
          testId="bento-users"
        >
          <SectionLabel emoji="👥" text="利用者一覧" />
          <UserCompactList
            items={users.items}
            onOpenQuickRecord={users.onOpenQuickRecord}
            onOpenISP={users.onOpenISP}
            onEmptyAction={users.onEmptyAction}
          />
        </BentoCard>

        <BentoCard
          colSpan={{ xs: 1, sm: 1, md: 1 }}
          variant="accent"
          testId="bento-next-action"
        >
          <SectionLabel emoji="▶️" text="次のアクション" />
          <NextActionCard nextAction={nextAction} onEmptyAction={nextActionEmptyAction} />
        </BentoCard>

        {/* ── Row 4: Transport (full-width) ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          testId="bento-transport"
        >
          <SectionLabel emoji="🚌" text="送迎状況" />
          {transportCard ? (
            <TransportStatusCard {...transportCard} />
          ) : (
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                🚚 送迎機能は準備中です
              </Typography>
            </Box>
          )}
        </BentoCard>
      </BentoContainer>
    </Box>
  );
};
