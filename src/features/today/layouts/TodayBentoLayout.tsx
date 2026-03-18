/**
 * TodayBentoLayout — Bento Grid 版「今日の業務」画面レイアウト
 *
 * NextAction-First Layout (UX昇格):
 *
 * Grid 配置 (md 4-column):
 * ┌──────────────────────────────────────┐
 * │  NextAction (full 4col, accent)       │  ← PRIMARY: 今すぐやること
 * ├──────────────────┬───────────────────┤
 * │  Progress (3col)  │ Attendance (1col) │  ← STATUS: 進捗要約
 * ├──────────────────┴───────────────────┤
 * │  Briefing (full 4col) ← 対応が必要    │
 * ├──────────────────────────────────────┤
 * │  ServiceStructure (full 4col)         │
 * ├──────────────────────────────────────┤
 * │  Users (full 4col) ← 記録操作導線     │
 * ├──────────────────────────────────────┤
 * │  Transport (full 4col)                │
 * └──────────────────────────────────────┘
 *
 * Mobile (1-column): NextAction → Progress → Attendance → ...
 *
 * Design Principle:
 *   NextAction = 認知の入口（「今何をすべきか？」に即答）
 *   Progress/Attendance = 補足証拠（NextAction を裏付ける情報）
 *
 * Layout state は view-only。データ集約・副作用は追加しない。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 * @see docs/ui-principles.md
 */
import { BentoCard, BentoContainer } from '@/components/ui/BentoGrid';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { ServiceStructure } from '@/features/today/domain/serviceStructure.types';
import type { TodayScene } from '@/features/today/domain/todayScene';
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
import { ProgressStatusBar, type TodayProgressSummary, type ProgressChipKey } from '../widgets/ProgressStatusBar';
import type { NextActionCardProps } from '../widgets/NextActionCard';
import { NextActionCard } from '../widgets/NextActionCard';
import { PlanningWorkflowCard, type PlanningWorkflowCardProps } from '../widgets/PlanningWorkflowCard';
import { TodayTasksCard, type TodayTasksCardProps } from '../widgets/TodayTasksCard';
import { TodayServiceStructureCard } from '../widgets/TodayServiceStructureCard';
import { UserCompactList, type UserRow } from '../widgets/UserCompactList';
import { ActionQueueCard, type ActionQueueCardProps } from '../widgets/ActionQueueCard';
import { ActionQueueTimelineWidget, type ActionQueueTimelineWidgetProps } from '../widgets/ActionQueueTimelineWidget';
import { TodayPhaseIndicator } from '../widgets/TodayPhaseIndicator';
import { CallLogSummaryCard, type CallLogSummaryCardProps } from '@/features/callLogs/components/CallLogSummaryCard';

// ─── Types ───────────────────────────────────────────────────

type ProgressSummaryProps = {
  summary: TodayProgressSummary;
  onChipClick?: (key: ProgressChipKey) => void;
  /** 現在の運営場面。ProgressStatusBar に中継 */
  scene?: TodayScene;
};

type TransportUser = { userId: string; name: string };

export type TodayBentoProps = {
  progress: ProgressSummaryProps;
  attendance: AttendanceSummaryCardProps;
  briefingAlerts: BriefingAlert[];
  serviceStructure?: ServiceStructure;
  nextAction: NextActionWithProgress;
  sceneAction?: SceneNextActionViewModel;
  onSceneAction?: (target: string, userId?: string) => void;
  nextActionEmptyAction?: NextActionCardProps['onEmptyAction'];
  nextActionMenuAction?: NextActionCardProps['onMenuAction'];
  scheduleDetailHref?: string;
  /** ナビゲーション CTA クリック → ページ遷移 */
  onNextActionNavigate?: (href: string) => void;
  /** フェーズサジェスト: 主役画面への遷移ハンドラ */
  onPhaseNavigate?: (path: string) => void;
  /** TodayEngine output (optional: widget hidden when undefined) */
  todayTasks?: TodayTasksCardProps;
  /** 未処理キュー表示 (optional: widget hidden when undefined) */
  actionQueue?: ActionQueueCardProps;
  /** Timeline Engine queue (optional) */
  actionQueueTimeline?: ActionQueueTimelineWidgetProps;
  /** 支援計画管理カード (optional: hidden when undefined) */
  workflowCard?: PlanningWorkflowCardProps;
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  transportCard?: TransportStatusCardProps;
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void; onOpenIceberg?: (id: string) => void; onEmptyAction?: () => void };
  /** 電話・連絡ログ要約カード (undefined 時は非表示) */
  callLogSummary?: CallLogSummaryCardProps;
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
  progress,
  attendance,
  briefingAlerts,
  serviceStructure,
  nextAction,
  sceneAction,
  onSceneAction,
  nextActionEmptyAction,
  nextActionMenuAction,
  scheduleDetailHref,
  onNextActionNavigate,
  onPhaseNavigate,
  todayTasks,
  actionQueue,
  actionQueueTimeline,
  workflowCard,
  transportCard,
  users,
  callLogSummary,
}) => {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        pb: 8,
      }}
    >
      {/* ── Phase Indicator (OperationalPhase 接続) ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 0 }}>
        <TodayPhaseIndicator onNavigate={onPhaseNavigate} />
      </Box>

      {/* ── Bento Grid ── */}
      <BentoContainer sx={{ mt: 2 }}>
        {/* ── Row 0: NextAction (full-width) — PRIMARY ENTRY POINT ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          variant="accent"
          testId="bento-next-action"
          sx={{ py: { xs: 2.5, sm: 3 } }}
        >
          <NextActionCard
            nextAction={nextAction}
            sceneAction={sceneAction}
            onSceneAction={onSceneAction}
            onEmptyAction={nextActionEmptyAction}
            onMenuAction={nextActionMenuAction}
            scheduleDetailHref={scheduleDetailHref}
            onNavigate={onNextActionNavigate}
          />
        </BentoCard>

        {/* ── Row 0.3: ActionQueue (未処理キュー — MVP-002) ── */}
        {actionQueue && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-action-queue"
          >
            <ActionQueueCard {...actionQueue} />
          </BentoCard>
        )}

        {/* ── Row 0.4: ActionQueueTimeline (Engine-driven Action Queue) ── */}
        {actionQueueTimeline && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-action-queue-timeline"
          >
            <SectionLabel emoji="⚡️" text="アクションキュー" />
            <ActionQueueTimelineWidget {...actionQueueTimeline} />
          </BentoCard>
        )}

        {/* ── Row 0.5: TodayTasks (engine-driven focus + summary) ── */}
        {todayTasks && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-today-tasks"
          >
            <TodayTasksCard {...todayTasks} />
          </BentoCard>
        )}

        {/* ── Row 1: Progress (3col) + Attendance (1col) — 進捗要約 ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 3 }}
          variant="default"
          noHover
          testId="bento-progress"
          sx={{ p: 0, overflow: 'hidden' }}
        >
          <ProgressStatusBar summary={progress.summary} onChipClick={progress.onChipClick} scene={progress.scene} />
        </BentoCard>

        <BentoCard
          colSpan={{ xs: 1, sm: 1, md: 1 }}
          testId="bento-attendance"
        >
          <SectionLabel emoji="📊" text="出席状況" />
          <AttendanceSummaryCard {...attendance} />
        </BentoCard>

        {/* ── Row 2: Briefing (full-width) — 対応が必要な申し送り ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          variant="subtle"
          testId="bento-briefing"
        >
          <BriefingActionList alerts={briefingAlerts} />
        </BentoCard>

        {/* ── Row 2.5: CallLog Summary (full-width, optional) ── */}
        {callLogSummary && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-call-log-summary"
          >
            <CallLogSummaryCard {...callLogSummary} />
          </BentoCard>
        )}

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

        {/* ── Row 3.5: Planning Workflow (full-width) — 支援計画管理 ── */}
        {workflowCard && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId="bento-workflow"
          >
            <SectionLabel emoji="📋" text="支援計画管理" />
            <PlanningWorkflowCard {...workflowCard} />
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
            onOpenIceberg={users.onOpenIceberg}
            onEmptyAction={users.onEmptyAction}
          />
        </BentoCard>

        {/* ── Row 5: Transport (full-width) ── */}
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          testId="bento-transport"
        >
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
