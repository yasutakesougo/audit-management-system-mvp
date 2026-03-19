/**
 * TodayOpsPage (Execution Layer)
 *
 * Positioning:
 * - /dashboard: Decision Layer（判断・俯瞰・管理）
 * - /today:     Execution Layer（実行・未処理ゼロ化）
 *
 * Guardrails:
 * - 集約/分析ロジックを持たない（dashboard domain に寄せる）
 * - データ参照は useTodaySummary（facade）経由に限定する
 * - Today に新しい集約が必要なら dashboard 側に追加してから pick する
 * - Today の追加は UIウィジェット or 実行操作 (QuickRecord等) に限定
 * - Layout props mapping は useTodayLayoutProps に委譲
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { useAuthStore } from '@/features/auth/store';
import { useTodaySummary } from '@/features/today/domain';
import { useApprovalFlow } from '@/features/today/hooks/useApprovalFlow';
import { useNextAction } from '@/features/today/hooks/useNextAction';
import { useSceneNextAction } from '@/features/today/hooks/useSceneNextAction';
import { useTodayScheduleLanes } from '@/features/today/hooks/useTodayScheduleLanes';
import { useWorkflowPhases } from '@/features/today/hooks/useWorkflowPhases';
import { useTodayLayoutProps } from '@/features/today/hooks/useTodayLayoutProps';
import { useTodayActionQueue } from '@/features/today/hooks/useTodayActionQueue';
import type { ActionCard } from '@/features/today/domain/models/queue.types';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { TodayBentoLayout } from '@/features/today/layouts/TodayBentoLayout';
import { recordAutoNextComplete, recordAutoNextSave } from '@/features/today/records/autoNextCounters';
import { QuickRecordDrawer } from '@/features/today/records/QuickRecordDrawer';
import { resolveNextUser } from '@/features/today/records/resolveNextUser';
import { useQuickRecord } from '@/features/today/records/useQuickRecord';
import { recordLanding } from '@/features/today/telemetry/recordLanding';
import { CTA_EVENTS, recordCtaClick } from '@/features/today/telemetry/recordCtaClick';
import { useTransportStatus } from '@/features/today/transport';
import { ApprovalDialog } from '@/features/today/widgets/ApprovalDialog';
import { toLocalDateISO } from '@/utils/getNow';
import { HandoffPanel } from '@/features/handoff/components';
import { useCallLogsSummary } from '@/features/callLogs/hooks/useCallLogsSummary';
import { CallLogQuickDrawer } from '@/features/callLogs/components/CallLogQuickDrawer';
import { buildCallLogFilterUrl, type CallLogFilterPreset } from '@/features/callLogs/domain/callLogFilterPresets';
import { useAuth } from '@/auth/useAuth';
import type { ProgressRingItem } from '@/features/today/components/ProgressRings';

import { Alert, Snackbar } from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const TodayOpsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.currentUserRole);

  // ── Landing Telemetry (Trial Observation) ────────────────────────
  const landingLoggedRef = useRef(false);
  useEffect(() => {
    if (landingLoggedRef.current) return;
    landingLoggedRef.current = true;
    recordLanding({
      path: location.pathname,
      search: location.search,
      role,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
  }, [location.pathname, location.search, role]);

  // ── Data Fetching (Facade) ──
  const summary = useTodaySummary();

  // ── Schedule Lanes (Real-data with fallback) ──
  const realSchedule = useTodayScheduleLanes();
  const hasRealLanes =
    realSchedule.lanes.staffLane.length > 0 ||
    realSchedule.lanes.userLane.length > 0 ||
    realSchedule.lanes.organizationLane.length > 0;
  const effectiveLanes =
    !realSchedule.isLoading && hasRealLanes
      ? realSchedule.lanes
      : summary.scheduleLanesToday;

  // ── Derived Hooks ──
  const nextAction = useNextAction(effectiveLanes);
  const sceneAction = useSceneNextAction({
    briefingAlerts: summary.briefingAlerts ?? [],
    attendanceSummary: summary.attendanceSummary ?? {},
    dailyRecordStatus: summary.dailyRecordStatus ?? {},
    todayRecordCompletion: summary.todayRecordCompletion,
    users: summary.users ?? [],
    scheduledCount: summary.users?.length ?? 0,
  });
  const transport = useTransportStatus();
  const quickRecord = useQuickRecord();
  const approvalFlow = useApprovalFlow();

  // ── Workflow Phases (Phase 2) ──
  const isServiceManager = role === 'admin';
  const planningSheetRepo = usePlanningSheetRepositories();
  const workflowPhases = useWorkflowPhases(
    summary.users ?? [],
    isServiceManager ? planningSheetRepo : null,
  );

  // ── Timeline Action Queue (Phase 3) ──
  const { actionQueue, isLoading: isQueueLoading } = useTodayActionQueue({
    currentStaffId: 'staff-a', // 仮: ログインユーザーのIDを連携できるとベター
  });

  const handleActionClick = React.useCallback(
    (action: ActionCard) => {
      if (action.actionType === 'OPEN_DRAWER') {
        quickRecord.openUnfilled();
      } else if (action.actionType === 'NAVIGATE') {
        const payload = action.payload as { path?: string };
        if (payload?.path) navigate(payload.path);
        else navigate('/schedules');
      } else if (action.actionType === 'ACKNOWLEDGE') {
        // No-op for now. Acknowledge handler can be hooked into an API action later.
      }
    },
    [quickRecord.openUnfilled, navigate]
  );

  // ── CallLog Summary (Today 連携) ──
  // account.name を myName として注入し、自分宛未対応件数を算出する
  const { account } = useAuth();
  const myName = (account as { name?: string } | null)?.name ?? '';
  const callLogsSummary = useCallLogsSummary({ myName });
  const [callLogDrawerOpen, setCallLogDrawerOpen] = useState(false);

  // ── Schedule Detail Deep Link ──
  const scheduleDetailHref = useMemo(() => {
    const dateIso = toLocalDateISO();
    const params = new URLSearchParams();
    params.set('date', dateIso);
    params.set('tab', 'day');
    if (nextAction.sourceLane) {
      params.set('cat', nextAction.sourceLane);
    }
    return `/schedules/week?${params.toString()}`;
  }, [nextAction.sourceLane]);

  // ── Layout Props (extracted to dedicated hook) ──
  const baseLayoutProps = useTodayLayoutProps({
    summary,
    nextAction,
    sceneAction,
    transport,
    quickRecord,
    navigate,
    role,
    scheduleDetailHref,
  });

  const layoutProps = useMemo(() => {
    // ── Step 3: ProgressRings — 既存データから4指標を投影 ──
    // Guard: テストmock等で progress が未定義の場合はリング生成をスキップ
    const progressData = baseLayoutProps.progress;
    const attendanceData = baseLayoutProps.attendance;

    let progressRings: ProgressRingItem[] | undefined;

    if (progressData?.summary && attendanceData) {
      const { summary: progressSummary, onChipClick } = progressData;

      // ── 支援手順記録 (todayRecordCompletion 起点) ──
      const recordTotal = progressSummary.totalRecordCount || 1;
      const recordCompleted = Math.max(0, recordTotal - progressSummary.pendingRecordCount);
      const recordPct = Math.round((recordCompleted / recordTotal) * 100);

      // ── ケース記録 (dailyRecordStatus — Dashboard 起点) ──
      const caseRecordStatus = summary.dailyRecordStatus;
      const caseTotal = caseRecordStatus?.total || (summary.users?.length ?? 0) || 1;
      const caseCompleted = caseRecordStatus?.completed ?? 0;
      const casePct = Math.round((caseCompleted / caseTotal) * 100);

      // ── 出欠 ──
      const attScheduled = attendanceData.scheduledCount || 1;
      const attPresent = attendanceData.facilityAttendees || 0;
      const attPct = Math.round((attPresent / attScheduled) * 100);

      const contactCount = callLogsSummary.openCount + callLogsSummary.callbackPendingCount;

      progressRings = [
        {
          key: 'records',
          label: '支援手順',
          valueText: `${recordCompleted}/${recordTotal}`,
          progress: recordPct,
          status: recordPct >= 100 ? 'complete' : recordPct >= 50 ? 'in_progress' : 'attention',
          onClick: () => onChipClick?.('record'),
        },
        {
          key: 'caseRecords',
          label: 'ケース記録',
          valueText: `${caseCompleted}/${caseTotal}`,
          progress: casePct,
          status: casePct >= 100 ? 'complete' : casePct >= 50 ? 'in_progress' : 'attention',
          onClick: () => {
            recordCtaClick({
              ctaId: CTA_EVENTS.PROGRESS_RING_CASE_RECORD,
              sourceComponent: 'ProgressRings',
              stateType: 'navigation',
              targetUrl: '/daily/table',
              userRole: role,
            });
            navigate('/daily/table');
          },
        },
        {
          key: 'attendance',
          label: '出欠',
          valueText: `${attPresent}/${attScheduled}`,
          progress: attPct,
          status: attPct >= 100 ? 'complete' : attPct >= 50 ? 'in_progress' : 'attention',
          onClick: () => onChipClick?.('attendance'),
        },
        {
          key: 'contacts',
          label: '連絡',
          valueText: `${contactCount}件`,
          progress: undefined,
          status: contactCount === 0 ? 'complete' : contactCount <= 2 ? 'in_progress' : 'attention',
          onClick: () => {
            recordCtaClick({
              ctaId: CTA_EVENTS.PROGRESS_RING_CONTACTS,
              sourceComponent: 'ProgressRings',
              stateType: 'navigation',
              targetUrl: '/call-logs',
              userRole: role,
            });
            navigate('/call-logs');
          },
        },
      ];
    }

    return {
      ...baseLayoutProps,
      progressRings,
      actionQueueTimeline: {
        actionQueue,
        isLoading: isQueueLoading,
        onActionClick: handleActionClick,
      },
      workflowCard: isServiceManager && workflowPhases.items.length > 0
        ? {
          items: workflowPhases.items,
          counts: workflowPhases.counts,
          topPriorityItem: workflowPhases.topPriorityItem,
          isLoading: workflowPhases.isLoading,
          onNavigate: (href: string) => navigate(href),
        }
      : undefined,
    handoffPanel: <HandoffPanel targetDate={toLocalDateISO()} />,
    callLogSummary: {
      openCount: callLogsSummary.openCount,
      urgentCount: callLogsSummary.urgentCount,
      callbackPendingCount: callLogsSummary.callbackPendingCount,
      myOpenCount: callLogsSummary.myOpenCount,
      overdueCount: callLogsSummary.overdueCount,
      isLoading: callLogsSummary.isLoading,
      onNavigate: () => navigate('/call-logs'),
      onNavigateWithFilter: (preset: CallLogFilterPreset) => navigate(buildCallLogFilterUrl(preset)),
      onOpenDrawer: () => setCallLogDrawerOpen(true),
    },
    };
  }, [baseLayoutProps, isServiceManager, workflowPhases, navigate, actionQueue, isQueueLoading, handleActionClick, callLogsSummary]);

  // ── Save Success Handler (Quick Record auto-next) ──
  const [showCompletionToast, setShowCompletionToast] = React.useState(false);

  const handleSaveSuccess = React.useCallback(() => {
    if (!quickRecord.autoNextEnabled) {
      quickRecord.close();
      return;
    }

    recordAutoNextSave();

    const pendingUserIds = summary?.dailyRecordStatus?.pendingUserIds || [];
    const nextUserId = resolveNextUser(quickRecord.userId, pendingUserIds);

    if (nextUserId) {
      setTimeout(() => {
        quickRecord.openUnfilled(nextUserId);
      }, 0);
    } else {
      quickRecord.close();
      setShowCompletionToast(true);
      recordAutoNextComplete();
    }
  }, [summary?.dailyRecordStatus?.pendingUserIds, quickRecord]);

  // ── Render ──
  return (
    <>
      <TodayBentoLayout {...layoutProps} />

      <QuickRecordDrawer
        open={quickRecord.isOpen}
        mode={quickRecord.mode}
        userId={quickRecord.userId}
        onClose={quickRecord.close}
        onSaveSuccess={handleSaveSuccess}
        autoNextEnabled={quickRecord.autoNextEnabled}
        setAutoNextEnabled={quickRecord.setAutoNextEnabled}
      />

      {/* 電話ログ Quick Drawer (Today 内専用インスタンス) */}
      <CallLogQuickDrawer
        open={callLogDrawerOpen}
        onClose={() => setCallLogDrawerOpen(false)}
      />

      <Snackbar
        open={showCompletionToast}
        autoHideDuration={4000}
        onClose={() => setShowCompletionToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        data-testid="today-completion-toast"
      >
        <Alert
          onClose={() => setShowCompletionToast(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          ✅ 全員の記録が完了しました
        </Alert>
      </Snackbar>

      <ApprovalDialog
        open={approvalFlow.isOpen}
        targetDate={approvalFlow.targetDate}
        isApproving={approvalFlow.isApproving}
        error={approvalFlow.error}
        onApprove={approvalFlow.approve}
        onClose={approvalFlow.close}
      />
    </>
  );
};

export default TodayOpsPage;
