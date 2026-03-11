/**
 * TodayBentoLayout — Bento Grid 版「今日の業務」画面レイアウト
 *
 * Action Surface Layout (UX改善後):
 *
 * Grid 配置 (md 4-column):
 * ┌──────────────────────────────────────┐
 * │    Hero (full-width, primary CTA)     │
 * ├──────────┬───────────────────────────┤
 * │Attendance│      NextAction (3col)     │
 * │  (1col)  │      ← 昇格: 即アクション  │
 * ├──────────┴───────────────────────────┤
 * │  Briefing (full 4col) ← 対応必要 強調  │
 * ├───────────────────────┬──────────────┤
 * │     ServiceStructure (full 4col)      │
 * ├───────────────────────┴──────────────┤
 * │   Users (full 4col) ← 記録操作導線    │
 * ├──────────────────────────────────────┤
 * │        Transport (full 4col)          │
 * └──────────────────────────────────────┘
 *
 * Mobile (1-column): すべて縦並び
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
import type { SceneNextActionViewModel } from '../hooks/useSceneNextAction';
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
  /** 最優先ユーザー名 */
  highestPriorityUserName?: string;
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
  sceneAction?: SceneNextActionViewModel;
  onSceneAction?: (target: string, userId?: string) => void;
  nextActionEmptyAction?: NextActionCardProps['onEmptyAction'];
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  transportCard?: TransportStatusCardProps;
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void; onEmptyAction?: () => void };
  /** 出欠入力CTA */
  onAttendanceAction?: () => void;
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
  sceneAction,
  onSceneAction,
  nextActionEmptyAction,
  transportCard,
  users,
  onAttendanceAction,
}) => {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        pb: 8,
      }}
    >
      {/* ── Row 0: Hero Banner (full bleed, primary action surface) ── */}
      <HeroUnfinishedBanner
        unfilledCount={hero.unfilledCount}
        approvalPendingCount={hero.approvalPendingCount}
        highestPriorityUserName={hero.highestPriorityUserName}
        onClickPrimary={hero.onOpenUnfilled}
        onClickSecondary={hero.onOpenMenu}
        sticky={true}
      />

      {/* ── Bento Grid ── */}
      <BentoContainer sx={{ mt: 3 }}>
        {/* ── Row 1: Attendance (1) + NextAction (3) — 即アクション導線 ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 1, md: 1 }}
          testId="bento-attendance"
        >
          <SectionLabel emoji="📊" text="出席状況" />
          <AttendanceSummaryCard {...attendance} onAction={onAttendanceAction} />
        </BentoCard>

        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 3 }}
          variant="accent"
          testId="bento-next-action"
        >
          <SectionLabel emoji="▶️" text="次にやること" />
          <NextActionCard
            nextAction={nextAction}
            sceneAction={sceneAction}
            onSceneAction={onSceneAction}
            onEmptyAction={nextActionEmptyAction}
          />
        </BentoCard>

        {/* ── Row 2: Briefing (full-width) — 対応が必要な申し送り ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          variant="subtle"
          testId="bento-briefing"
        >
          <SectionLabel emoji="📋" text="対応が必要な申し送り" />
          <BriefingActionList alerts={briefingAlerts} />
        </BentoCard>

        {/* ── Row 3: Service Structure (full-width) ── */}
        {serviceStructure && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId="bento-service-structure"
          >
            <SectionLabel emoji="🏢" text="業務体制" />
            <TodayServiceStructureCard serviceStructure={serviceStructure} />
          </BentoCard>
        )}

        {/* ── Row 4: Users (full-width) — 利用者記録操作 ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          testId="bento-users"
        >
          <SectionLabel emoji="👥" text="利用者記録" />
          <UserCompactList
            items={users.items}
            onOpenQuickRecord={users.onOpenQuickRecord}
            onOpenISP={users.onOpenISP}
            onEmptyAction={users.onEmptyAction}
          />
        </BentoCard>

        {/* ── Row 5: Transport (full-width) ── */}
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
