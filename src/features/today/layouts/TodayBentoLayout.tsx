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
 *
 * Mobile (1-column): A → B(縦積み) → C1 → C2
 *
 * Design Principle:
 *   "探させない、考えさせない、戻らせない"
 *   NextAction = 認知の入口（「今何をすべきか？」に即答）
 *
 * ⚠️ Step 3: ProgressRings + HeroActionCard visual enhancement.
 *   - useTodaySummary / useTodayLayoutProps は変更しない.
 *   - ZONE A は HeroActionCard (sceneAction 優先, NextActionCard fallback).
 *   - ZONE B は ProgressRings (3指標圧縮表示) に統合.
 *   - ActionQueue/BriefingActionList remain hidden (not deleted).
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 * @see docs/ui-principles.md
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
import { BriefingActionList } from '../widgets/BriefingActionList';
import { ProgressStatusBar, type TodayProgressSummary, type ProgressChipKey } from '../widgets/ProgressStatusBar';
import { HeroActionCard, type HeroActionCardProps } from '../components/HeroActionCard';
import { ProgressRings, type ProgressRingItem } from '../components/ProgressRings';
import { PlanningWorkflowCard, type PlanningWorkflowCardProps } from '../widgets/PlanningWorkflowCard';
import { TodayTasksCard, type TodayTasksCardProps } from '../widgets/TodayTasksCard';
import { TodayServiceStructureCard } from '../widgets/TodayServiceStructureCard';
import { UserCompactList, type UserRow, type UserCompactListProps } from '../widgets/UserCompactList';
import { ActionQueueCard, type ActionQueueCardProps } from '../widgets/ActionQueueCard';
import { ActionQueueTimelineWidget, type ActionQueueTimelineWidgetProps } from '../widgets/ActionQueueTimelineWidget';
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
  /** Step 3: ProgressRings 用の3指標。undefined 時は旧 ProgressStatusBar にフォールバック */
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
  users: { items: UserRow[]; onOpenQuickRecord: (id: string) => void; onOpenISP?: (id: string) => void; onOpenIceberg?: (id: string) => void; onAlertClick?: (userId: string) => void; onOpenUserStatus?: UserCompactListProps['onOpenUserStatus']; onEmptyAction?: () => void };
  /** 日々の申し送り一覧パネル (optional) */
  handoffPanel?: React.ReactNode;
  /** アクションタスクリスト (Command Center) */
  actionTaskList?: React.ReactNode;
  /** 電話・連絡ログ要約カード (undefined 時は非表示) */
  callLogSummary?: CallLogSummaryCardProps;
  /** 高負荷日タイル (undefined または visible:false 時は非表示) */
  highLoadTile?: {
    viewModel: HighLoadTileViewModel;
    onClick: () => void;
  };
  exceptionsQueue?: UseTodayExceptionsResult;
  /** 電話・連絡ログの未対応件数 (KioskStatusBar 用、callLogSummary から派生) */
  contactPendingCount?: number;
  /** キオスクモードでのクイックリンク遷移ハンドラ */
  onQuickLinkNavigate?: (href: string) => void;
  /** 権限オーディエンス（TodayExceptionAlerts の表示制御に使用） */
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

// ─── Step 1: Feature flag for 3-zone mode ────────────────────
// When false, falls back to original layout order.
// Step 2/3 will remove this flag once integration is complete.
const ENABLE_3ZONE = true;

// ─── Layout ──────────────────────────────────────────────────

export const TodayBentoLayout: React.FC<TodayBentoProps> = ({
  progress,
  attendance,
  progressRings,
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
  // progressRings から各指標を抽出（ProgressRings と同一データソース）
  const kioskMetrics: KioskStatusMetrics | undefined = React.useMemo(() => {
    if (!isKiosk) return undefined;
    const recordTotal = progress.summary?.totalRecordCount || 0;
    const recordCompleted = Math.max(0, recordTotal - (progress.summary?.pendingRecordCount || 0));

    // ケース記録: progressRings の "caseRecords" から取得 (valueText: "0/32")
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

    // 連絡: progressRings の "contacts" から取得 (valueText: "2件")
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
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        pb: 8,
      }}
    >
      {/* ── Kiosk Status Bar (キオスクモード専用) ── */}
      {isKiosk && kioskMetrics && (
        <KioskStatusBar metrics={kioskMetrics} />
      )}

      {/* ── Phase Indicator: 非表示化 (Step 1) ──
       *  TodayPhaseIndicator は削除せず非表示にする。
       *  Step 2 で場面ラベルを HeroActionCard 内に統合するため残す。
       */}
      {!ENABLE_3ZONE && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 0 }}>
          <TodayPhaseIndicator onNavigate={onPhaseNavigate} />
        </Box>
      )}

      {/* ── Bento Grid ── */}
      <BentoContainer sx={{ mt: 2 }}>

        {/* ════════════════════════════════════════════════════
         *  キオスクモード: KioskHeroBlock（統合ブロック）
         *  Hero + アラート + 進捗 + QuickLinks を1ブロックに
         *  ════════════════════════════════════════════════════ */}
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
            />
          </BentoCard>
        ) : (
          /* ════════════════════════════════════════════════════
           *  通常モード: 既存のレイアウト（変更なし）
           *  ════════════════════════════════════════════════════ */
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

        {/* ── ActionQueue 系: 非表示化 (Step 1) ──
         *  Step 2 で HeroActionCard に統合予定。コンポーネントは残す。
         */}
        {!ENABLE_3ZONE && actionQueue && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-action-queue"
          >
            <ActionQueueCard {...actionQueue} />
          </BentoCard>
        )}

        {!ENABLE_3ZONE && actionQueueTimeline && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-action-queue-timeline"
          >
            <SectionLabel emoji="⚡️" text="アクションキュー" />
            <ActionQueueTimelineWidget {...actionQueueTimeline} />
          </BentoCard>
        )}

        {!ENABLE_3ZONE && todayTasks && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-today-tasks"
          >
            <TodayTasksCard {...todayTasks} />
          </BentoCard>
        )}

        {/* ════════════════════════════════════════════════════
         *  ZONE B: 進捗ダッシュ — 通常モードのみ（キオスクは HeroBlock に統合）
         *  ════════════════════════════════════════════════════ */}
        {!isKiosk && (
          progressRings ? (
            <BentoCard
              colSpan={{ xs: 1, sm: 2, md: 4 }}
              variant="default"
              noHover
              testId={TESTIDS.TODAY_PROGRESS_RINGS}
            >
              <SectionLabel emoji="📊" text="本日の進捗" />
              <ProgressRings items={progressRings} />
            </BentoCard>
          ) : (
            /* ── Legacy fallback: ProgressStatusBar + AttendanceSummaryCard ── */
            <>
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
            </>
          )
        )}

        {/* ── 高負荷日警告タイル (Schedule Ops 連携) ── */}
        {highLoadTile?.viewModel.visible && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId={TESTIDS.TODAY_HIGH_LOAD_TILE}
          >
            <ScheduleOpsHighLoadTile
              viewModel={highLoadTile.viewModel}
              onClick={highLoadTile.onClick}
            />
          </BentoCard>
        )}

        {/* ════════════════════════════════════════════════════
         *  ZONE C1: 常時表示 — 今日すぐ触るもの
         *  ════════════════════════════════════════════════════ */}

        {/* ── C1-a: 利用者リスト（未記録優先ソート済み） — キオスクモードでは非表示 ── */}
        {!isKiosk && (
        <BentoCard
          colSpan={{ xs: 1, sm: 2, md: 4 }}
          testId={TESTIDS.TODAY_USER_LIST}
        >
          <SectionLabel emoji="👥" text="利用者記録" />
          <UserCompactList
            items={users.items}
            onOpenQuickRecord={users.onOpenQuickRecord}
            onOpenISP={users.onOpenISP}
            onOpenIceberg={users.onOpenIceberg}
            onAlertClick={users.onAlertClick}
            onOpenUserStatus={users.onOpenUserStatus}
            onEmptyAction={users.onEmptyAction}
          />
        </BentoCard>
        )}

        {/* ── C1-b: アクションタスク（Command Center） ── */}
        {actionTaskList && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId="bento-action-task-list"
          >
            {actionTaskList}
          </BentoCard>
        )}

        {/* ── C1-c: 申し送りパネル ── */}
        {handoffPanel && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId={TESTIDS.TODAY_HANDOFF}
          >
            {handoffPanel}
          </BentoCard>
        )}

        {/* ── C1-c: 電話・連絡ログ ── */}
        {callLogSummary && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="default"
            testId={TESTIDS.TODAY_CALL_LOG_SUMMARY}
          >
            <CallLogSummaryCard {...callLogSummary} />
          </BentoCard>
        )}

        {/* ── BriefingActionList: 非表示化 (Step 1) ──
         *  Step 2 で HeroActionCard 内 BriefingInlineBadge に統合予定。
         */}
        {!ENABLE_3ZONE && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            variant="subtle"
            testId="bento-briefing"
          >
            <BriefingActionList alerts={briefingAlerts} />
          </BentoCard>
        )}

        {/* ════════════════════════════════════════════════════
         *  ZONE C2: 折りたたみ — 必要時だけ開くもの
         *  ════════════════════════════════════════════════════ */}

        {/* ── C2-a: 業務体制（デフォルト閉じ） ── */}
        {serviceStructure && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId="bento-service-structure"
            sx={{ p: 0 }}
          >
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

        {/* ── C2-b: 支援計画管理（管理者のみ・デフォルト閉じ） — キオスクモードでは非表示 ── */}
        {workflowCard && !isKiosk && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId={TESTIDS.TODAY_WORKFLOW_CARD}
            sx={{ p: 0 }}
          >
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

        {/* ── C2-c: 送迎（isReady=true の場合のみ表示） ──
         *  「準備中です」フォールバックを削除。transportCard が undefined なら非表示。
         */}
        {transportCard && (
          <BentoCard
            colSpan={{ xs: 1, sm: 2, md: 4 }}
            testId={TESTIDS.TODAY_TRANSPORT}
          >
            <TransportStatusCard {...transportCard} />
          </BentoCard>
        )}

      </BentoContainer>
    </Box>
  );
};
