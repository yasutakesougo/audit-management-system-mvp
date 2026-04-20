/**
 * TodayBentoLayout — 3-Zone "Action-First" Bento Grid
 *
 * 3-Zone Architecture:
 * ┌──────────────────────────────────────┐
 * │  ZONE A: Hero (NextAction, 4col)     │  ← 0-5秒: 今やること1つ
 * ├──────────────────┬───────────────────┤
 * │  ZONE B: Progress (3col) + Att(1col) │  ← 5-10秒: あとどれくらいか
 * ├──────────────────┴───────────────────┤
 * │  ZONE C1: Users + Handoff + CallLog  │  ← 常時表示: 実行対象
 * ├──────────────────────────────────────┤
 * │  ZONE C2: Structure/Plan/Transport   │  ← 折りたたみ: 必要時開く
 * └──────────────────────────────────────┘
 */
import { BentoCard, BentoContainer } from '@/components/ui/BentoGrid';
import { TESTIDS } from '@/testids';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { ServiceStructure } from '@/features/today/domain/serviceStructure.types';
import type { TodayScene } from '@/features/today/domain/todayScene';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import type { NextActionWithProgress } from '../hooks/useNextAction';
import type { SceneNextActionViewModel } from '../hooks/useSceneNextAction';
import { TransportStatusCard, type TransportStatusCardProps } from '../transport';
import type { AttendanceSummaryCardProps } from '../widgets/AttendanceSummaryCard';
import { AttendanceSummaryCard } from '../widgets/AttendanceSummaryCard';
import { ProgressStatusBar, type TodayProgressSummary, type ProgressChipKey } from '../widgets/ProgressStatusBar';
import { HeroActionCard, type HeroActionCardProps } from '../components/HeroActionCard';
import { ProgressRings, type ProgressRingItem } from '../components/ProgressRings';
import { PlanningWorkflowCard, type PlanningWorkflowCardProps } from '../widgets/PlanningWorkflowCard';
import { TodayServiceStructureCard } from '../widgets/TodayServiceStructureCard';
import type { TodayTasksCardProps } from '../widgets/TodayTasksCard';
import { UserCompactList, type UserCompactListProps } from '../widgets/UserCompactList';
import type { ActionQueueCardProps } from '../widgets/ActionQueueCard';
import type { ActionQueueTimelineWidgetProps } from '../widgets/ActionQueueTimelineWidget';
import { TodayPhaseIndicator } from '../widgets/TodayPhaseIndicator';
import { CallLogSummaryCard, type CallLogSummaryCardProps } from '@/features/callLogs/components/CallLogSummaryCard';
import { ScheduleOpsHighLoadTile } from '../widgets/ScheduleOpsHighLoadTile';
import type { HighLoadTileViewModel } from '../domain/buildHighLoadTileViewModel';
import { TodayExceptionAlerts } from '../components/TodayExceptionAlerts';
import { KioskStatusBar, type KioskStatusMetrics } from '../components/KioskStatusBar';
import { KioskHeroBlock } from '../components/KioskHeroBlock';
import type { UseTodayExceptionsResult } from '../hooks/useTodayExceptions';
import { useSettingsContext } from '@/features/settings/SettingsContext';
import type { Role } from '@/auth/roles';

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
  /** Step 3: ProgressRings 用の3指標 */
  progressRings?: ProgressRingItem[];
  briefingAlerts: BriefingAlert[];
  serviceStructure?: ServiceStructure;
  nextAction: NextActionWithProgress;
  sceneAction?: SceneNextActionViewModel;
  onSceneAction?: (target: string, userId?: string) => void;
  nextActionEmptyAction?: HeroActionCardProps['onEmptyAction'];
  nextActionMenuAction?: HeroActionCardProps['onMenuAction'];
  scheduleDetailHref?: string;
  /** ナビゲーション CTA クリック → ページ遷移 */
  onNextActionNavigate?: (href: string) => void;
  /** フェーズサジェスト: 主役画面への遷移ハンドラ */
  onPhaseNavigate?: (path: string) => void;
  /** TodayEngine output */
  todayTasks?: TodayTasksCardProps;
  users?: import('@/sharepoint/fields/userFields').IUserMaster[];
  userListProps: UserCompactListProps;
  visits: Record<string, import('@/features/attendance/attendance.logic').AttendanceVisit>;
  correctiveActions?: string[];
  /** 未処理キュー表示 */
  actionQueue?: ActionQueueCardProps;
  /** Timeline Engine queue */
  actionQueueTimeline?: ActionQueueTimelineWidgetProps;
  /** 支援計画管理カード */
  workflowCard?: PlanningWorkflowCardProps;
  transport: { pending: TransportUser[]; inProgress: TransportUser[]; onArrived: (id: string) => void };
  transportCard?: TransportStatusCardProps;
  /** 日々の申し送り一覧パネル (optional) */
  handoffPanel?: React.ReactNode;
  /** アクションタスクリスト (Command Center) */
  actionTaskList?: React.ReactNode;
  /** 電話・連絡ログ要約カード (undefined 時は非表示) */
  callLogSummary?: CallLogSummaryCardProps;
  /** 高負荷日タイル */
  highLoadTile?: {
    viewModel: HighLoadTileViewModel;
    onClick: () => void;
  };
  exceptionsQueue?: UseTodayExceptionsResult;
  /** 電話・連絡ログの未対応件数 */
  contactPendingCount?: number;
  /** キオスクモードでのクイックリンク遷移ハンドラ */
  onQuickLinkNavigate?: (href: string) => void;
  /** 権限オーディエンス */
  audience?: Role;
};

// ─── Compact Section Title ───────────────────────────────────

function SectionLabel({ emoji, text }: { emoji: string; text: string }) {
  const theme = useTheme();
  const labelColor = theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.text.secondary;

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
        color: labelColor,
        fontSize: '0.7rem',
      }}
    >
      {emoji} {text}
    </Typography>
  );
}

const ENABLE_3ZONE = true;

// ─── Layout ──────────────────────────────────────────────────

export const TodayBentoLayout: React.FC<TodayBentoProps> = ({
  progress,
  attendance,
  progressRings,
  briefingAlerts: _briefingAlerts,
  serviceStructure,
  nextAction,
  sceneAction,
  onSceneAction,
  nextActionEmptyAction,
  nextActionMenuAction,
  scheduleDetailHref,
  onNextActionNavigate,
  onPhaseNavigate,
  todayTasks: _todayTasks,
  actionQueue: _actionQueue,
  actionQueueTimeline: _actionQueueTimeline,
  workflowCard,
  transportCard,
  users,
  userListProps,
  handoffPanel,
  actionTaskList,
  callLogSummary,
  highLoadTile,
  exceptionsQueue,
  contactPendingCount,
  onQuickLinkNavigate,
  audience = 'viewer',
}) => {
  const { settings } = useSettingsContext();
  const isKiosk = settings.layoutMode === 'kiosk';

  // ── KioskStatusBar metrics ──
  const kioskMetrics: KioskStatusMetrics | undefined = React.useMemo(() => {
    if (!isKiosk) return undefined;
    const recordTotal = progress.summary?.totalRecordCount || 0;
    const recordCompleted = Math.max(0, recordTotal - (progress.summary?.pendingRecordCount || 0));

    const caseRing = progressRings?.find((r) => r.key === 'caseRecords');
    let caseCompleted = 0;
    let caseTotal = 0;
    if (caseRing?.valueText) {
      const parts = caseRing.valueText.split('/');
      if (parts.length === 2) {
        caseCompleted = parseInt(parts[0], 10) || 0;
        caseTotal = parseInt(parts[1], 10) || 0;
      }
    }

    const contactRing = progressRings?.find((r) => r.key === 'contacts');
    let contactPending = contactPendingCount ?? 0;
    if (contactRing?.valueText) {
      const parsed = parseInt(contactRing.valueText, 10);
      if (!isNaN(parsed)) contactPending = parsed;
    }

    return {
      recordCompleted,
      recordTotal,
      caseCompleted,
      caseTotal,
      attendeeCount: attendance.facilityAttendees || 0,
      scheduledCount: attendance.scheduledCount || 0,
      contactPending,
    };
  }, [isKiosk, progress.summary, attendance, contactPendingCount, progressRings]);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 8 }}>
      {/* ── Kiosk Status Bar ── */}
      {isKiosk && kioskMetrics && (
        <KioskStatusBar metrics={kioskMetrics} />
      )}

      {/* ── Phase Indicator (Legacy) ── */}
      {!ENABLE_3ZONE && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 0 }}>
          <TodayPhaseIndicator onNavigate={onPhaseNavigate} />
        </Box>
      )}

      {/* ── Bento Grid ── */}
      <BentoContainer sx={{ mt: 2 }}>

        {/* ZONE A: Hero */}
        {isKiosk ? (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="accent"
            testId={TESTIDS.TODAY_HERO}
            sx={{ py: { xs: 2.5, sm: 3 } }}
          >
            <KioskHeroBlock
              heroProps={{
                sceneAction,
                onSceneAction,
                nextAction,
                onEmptyAction: nextActionEmptyAction,
                onMenuAction: nextActionMenuAction,
                scheduleDetailHref,
                onNavigate: onNextActionNavigate,
              }}
              exceptionsQueue={exceptionsQueue}
              progressRings={progressRings}
              onQuickLinkNavigate={onQuickLinkNavigate}
              users={users}
            />
          </BentoCard>
        ) : (
          <>
            <TodayExceptionAlerts exceptionsQueue={exceptionsQueue} audience={audience} />
            <BentoCard
              colSpan={{ xs: 1, sm: 2, md: 4 }}
              variant="accent"
              testId={TESTIDS.TODAY_HERO}
              sx={{ py: { xs: 2.5, sm: 3 } }}
            >
              <HeroActionCard
                sceneAction={sceneAction}
                onSceneAction={onSceneAction}
                nextAction={nextAction}
                onEmptyAction={nextActionEmptyAction}
                onMenuAction={nextActionMenuAction}
                scheduleDetailHref={scheduleDetailHref}
                onNavigate={onNextActionNavigate}
              />
            </BentoCard>
          </>
        )}

        {/* ZONE B: Progress */}
        {!isKiosk && (
          progressRings ? (
            <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default" noHover testId={TESTIDS.TODAY_PROGRESS_RINGS}>
              <SectionLabel emoji="📊" text="本日の進捗" />
              <ProgressRings items={progressRings} />
            </BentoCard>
          ) : (
            <>
              <BentoCard colSpan={{ xs: 1, sm: 2, md: 3 }} variant="default" noHover testId="bento-progress" sx={{ p: 0, overflow: 'hidden' }}>
                <ProgressStatusBar summary={progress.summary} onChipClick={progress.onChipClick} scene={progress.scene} />
              </BentoCard>
              <BentoCard colSpan={{ xs: 1, sm: 1, md: 1 }} testId="bento-attendance">
                <SectionLabel emoji="📊" text="出席状況" />
                <AttendanceSummaryCard {...attendance} />
              </BentoCard>
            </>
          )
        )}

        {/* High Load Tile */}
        {highLoadTile?.viewModel.visible && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default" testId={TESTIDS.TODAY_HIGH_LOAD_TILE}>
            <ScheduleOpsHighLoadTile viewModel={highLoadTile.viewModel} onClick={highLoadTile.onClick} />
          </BentoCard>
        )}

        <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} testId={TESTIDS.TODAY_USER_LIST}>
          <SectionLabel emoji="👥" text="利用者記録" />
          <UserCompactList {...userListProps} />
        </BentoCard>

        {actionTaskList && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default" testId="bento-action-task-list">
            {actionTaskList}
          </BentoCard>
        )}

        {handoffPanel && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} testId={TESTIDS.TODAY_HANDOFF}>
            {handoffPanel}
          </BentoCard>
        )}

        {callLogSummary && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default" testId={TESTIDS.TODAY_CALL_LOG_SUMMARY}>
            <CallLogSummaryCard {...callLogSummary} />
          </BentoCard>
        )}

        {/* ZONE C2: Details */}
        {serviceStructure && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} testId="bento-service-structure" sx={{ p: 0 }}>
            <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
                <SectionLabel emoji="🏢" text="業務体制" />
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 2.5, pb: 2 }}>
                <TodayServiceStructureCard serviceStructure={serviceStructure} />
              </AccordionDetails>
            </Accordion>
          </BentoCard>
        )}

        {workflowCard && !isKiosk && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} testId={TESTIDS.TODAY_WORKFLOW_CARD} sx={{ p: 0 }}>
            <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
                <SectionLabel emoji="📋" text="支援計画管理" />
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 2.5, pb: 2 }}>
                <PlanningWorkflowCard {...workflowCard} />
              </AccordionDetails>
            </Accordion>
          </BentoCard>
        )}

        {transportCard && (
          <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} testId={TESTIDS.TODAY_TRANSPORT}>
            <TransportStatusCard {...transportCard} />
          </BentoCard>
        )}

      </BentoContainer>
    </Box>
  );
};
