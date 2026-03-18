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
import { useTransportStatus } from '@/features/today/transport';
import { ApprovalDialog } from '@/features/today/widgets/ApprovalDialog';
import { toLocalDateISO } from '@/utils/getNow';
import { HandoffPanel } from '@/features/handoff/components';
import { useCallLogsSummary } from '@/features/callLogs/hooks/useCallLogsSummary';
import { CallLogQuickDrawer } from '@/features/callLogs/components/CallLogQuickDrawer';
import { useAuth } from '@/auth/useAuth';

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

  const layoutProps = useMemo(() => ({
    ...baseLayoutProps,
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
      onOpenDrawer: () => setCallLogDrawerOpen(true),
    },
  }), [baseLayoutProps, isServiceManager, workflowPhases, navigate, actionQueue, isQueueLoading, handleActionClick, callLogsSummary]);

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
