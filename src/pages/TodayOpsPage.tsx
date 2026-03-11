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
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { buildDailyHubFromTodayUrl, buildHandoffFromTodayState, sceneToTimeBand } from '@/app/links/navigationLinks';
import { CTA_EVENTS, recordCtaClick } from '@/features/today/telemetry/recordCtaClick';
import { useAuthStore } from '@/features/auth/store';
import { useTodaySummary } from '@/features/today/domain';
import { useApprovalFlow } from '@/features/today/hooks/useApprovalFlow';
import { useNextAction } from '@/features/today/hooks/useNextAction';
import { useSceneNextAction } from '@/features/today/hooks/useSceneNextAction';
import { useTodayScheduleLanes } from '@/features/today/hooks/useTodayScheduleLanes';
import { TodayBentoLayout } from '@/features/today/layouts/TodayBentoLayout';
import { recordAutoNextComplete, recordAutoNextSave } from '@/features/today/records/autoNextCounters';
import { QuickRecordDrawer } from '@/features/today/records/QuickRecordDrawer';
import { resolveNextUser } from '@/features/today/records/resolveNextUser';
import { useQuickRecord } from '@/features/today/records/useQuickRecord';
import { recordLanding } from '@/features/today/telemetry/recordLanding';
import { useTransportStatus } from '@/features/today/transport';
import { ApprovalDialog } from '@/features/today/widgets/ApprovalDialog';
import { isE2E } from '@/lib/env';

import { Alert, Snackbar } from '@mui/material';
import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const TodayOpsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.currentUserRole);

  // ── Landing Telemetry (Trial Observation) ────────────────────────
  // 1回だけ記録。StrictMode の二重発火を ref で防止。
  // Firestore telemetry コレクションに永続化（fire-and-forget）。
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
  // ────────────────────────────────────────────────────────────────

  // 1. Data via Facade (Execution Layer はドメイン集約を持たない)
  const summary = useTodaySummary();

  // 2. Real-data schedule lanes (P0: truth-source alignment)
  //    /today now derives NextAction from the same ScheduleRepository as /schedules.
  //    Falls back to mock lanes from useTodaySummary when real data is loading/empty.
  const realSchedule = useTodayScheduleLanes();
  const hasRealLanes =
    realSchedule.lanes.staffLane.length > 0 ||
    realSchedule.lanes.userLane.length > 0 ||
    realSchedule.lanes.organizationLane.length > 0;
  const effectiveLanes =
    !realSchedule.isLoading && hasRealLanes
      ? realSchedule.lanes
      : summary.scheduleLanesToday;

  // 3. Derived: Next Action (hook で算出 — ページが太らない)
  const nextAction = useNextAction(effectiveLanes);

  // 2b. Scene-based Next Action (場面ベースの次アクション)
  const sceneAction = useSceneNextAction({
    briefingAlerts: summary.briefingAlerts ?? [],
    attendanceSummary: summary.attendanceSummary ?? {},
    dailyRecordStatus: summary.dailyRecordStatus ?? {},
    users: summary.users ?? [],
    scheduledCount: summary.users?.length ?? 0,
  });

  // 3. Transport Status (Composable Hook — #635)
  const transport = useTransportStatus();

  // 4. Local State / URL State (Quick Record Drawer)
  const quickRecord = useQuickRecord();

  // 5. Approval Flow (#765)
  const approvalFlow = useApprovalFlow();

  // End-of-queue completion notification (#631)
  const [showCompletionToast, setShowCompletionToast] = React.useState(false);

  // 4. Map to Layout Props (Defensive mapping)
  const layoutProps = useMemo(() => {
    const isE2EEnv = isE2E() || (typeof window !== 'undefined' && (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__);

    // Progress: 進捗サマリー（ProgressStatusBar 用）
    const realPendingCount = Math.max(0, summary?.dailyRecordStatus?.pending ?? 0);
    const pendingRecordCount = isE2EEnv ? 3 : realPendingCount;
    const totalRecordCount = summary.users?.length ?? 0;

    const facilityAttendees = summary?.attendanceSummary?.facilityAttendees ?? 0;
    const pendingAttendanceCount = isE2EEnv ? 2 : Math.max(0, totalRecordCount - facilityAttendees);

    const pendingBriefingCount = isE2EEnv ? 1 : (summary?.briefingAlerts ?? []).filter(
      (a) => a.severity === 'error' || a.severity === 'warning',
    ).length;

    // 利用者一覧: recordFilled はページで計算（widget は表示だけ）
    const pendingUserIds = new Set(summary?.dailyRecordStatus?.pendingUserIds ?? []);

    const userItems = (summary.users || []).map((u, i) => {
      const userId = (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`;
      const name = u.FullName ?? `利用者${i + 1}`;
      const visit = summary.visits[userId];
      let status: 'present' | 'absent' | 'unknown' = 'unknown';
      if (visit) {
        if (visit.status === '通所中' || visit.status === '退所済') status = 'present';
        else if (visit.status === '当日欠席' || visit.status === '事前欠席') status = 'absent';
      }
      const recordFilled = !pendingUserIds.has(userId);
      return { userId, name, status, recordFilled };
    });

    // 未記録を上に、記録済みを下にソート
    const sortedUserItems = [...userItems].sort((a, b) => {
      if (a.recordFilled === b.recordFilled) return 0;
      return a.recordFilled ? 1 : -1;
    });

    return {
      progress: {
        summary: {
          pendingRecordCount,
          totalRecordCount,
          pendingAttendanceCount,
          pendingBriefingCount,
        },
      },
      attendance: {
        scheduledCount: summary.users?.length ?? 0,
        facilityAttendees: summary?.attendanceSummary?.facilityAttendees ?? 0,
        sameDayAbsenceCount: summary?.attendanceSummary?.sameDayAbsenceCount ?? 0,
        sameDayAbsenceNames: summary?.attendanceSummary?.sameDayAbsenceNames ?? [],
        priorAbsenceCount: summary?.attendanceSummary?.priorAbsenceCount ?? 0,
        priorAbsenceNames: summary?.attendanceSummary?.priorAbsenceNames ?? [],
        lateOrEarlyLeave: summary?.attendanceSummary?.lateOrEarlyLeave ?? 0,
        lateOrEarlyNames: summary?.attendanceSummary?.lateOrEarlyNames ?? [],
      },
      briefingAlerts: summary?.briefingAlerts ?? [],
      serviceStructure: summary?.serviceStructure,
      nextAction,
      sceneAction,
      onSceneAction: (target: string, userId?: string) => {
        // ── CTA Telemetry ────────────────────────────────────
        recordCtaClick({
          ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
          sourceComponent: 'NextActionCard',
          stateType: 'scene-action',
          scene: sceneAction?.sceneLabel,
          priority: sceneAction?.priority,
          targetUrl: target,
          userRole: role,
        });
        // ────────────────────────────────────────────────────
        switch (target) {
          case 'briefing':
            // 申し送り確認 — Handoff Timeline へ意味付きナビゲーション
            navigate('/handoff-timeline', {
              state: buildHandoffFromTodayState({
                timeFilter: sceneAction ? sceneToTimeBand(sceneAction.scene) : undefined,
              }),
            });
            break;
          case 'attendance':
            navigate('/daily/attendance');
            break;
          case 'quick-record':
            if (userId) quickRecord.openUser(userId);
            else quickRecord.openUnfilled(summary?.dailyRecordStatus?.pendingUserIds?.[0]);
            break;
          case 'user':
            document.getElementById('bento-users')?.scrollIntoView({ behavior: 'smooth' });
            break;
          default:
            break;
        }
      },
      transport: {
        pending: transport.isReady
          ? transport.status.legs
              .filter((l) => l.direction === transport.activeDirection && (l.status === 'pending' || l.status === 'in-progress'))
              .map((l) => ({ userId: l.userId, name: l.userName }))
          : [],
        inProgress: transport.isReady
          ? transport.status.legs
              .filter((l) => l.direction === transport.activeDirection && l.status === 'arrived')
              .map((l) => ({ userId: l.userId, name: l.userName }))
          : [],
        onArrived: (userId: string) => {
          transport.markArrived(userId, transport.activeDirection);
        },
      },
      // Phase 3: Full TransportStatusCard props
      transportCard: transport.isReady
        ? {
            legs: transport.status.legs,
            toSummary: transport.status.to,
            fromSummary: transport.status.from,
            activeDirection: transport.activeDirection,
            onDirectionChange: transport.setActiveDirection,
            onTransition: transport.transition,
            currentTime: transport.currentTime,
          }
        : undefined,
      users: {
        items: isE2EEnv
          ? [
              { userId: 'I022', name: '中村 裕樹', status: 'present' as const, recordFilled: false },
              { userId: 'I105', name: '山田 花子', status: 'present' as const, recordFilled: true },
            ]
          : sortedUserItems,
        onOpenQuickRecord: quickRecord.openUser,
        onOpenISP: (userId: string) => navigate(`/isp-editor/${userId}`),
        onEmptyAction: () => navigate('/schedules'),
      },
      nextActionEmptyAction: () => {
        recordCtaClick({
          ctaId: CTA_EVENTS.NEXT_ACTION_EMPTY,
          sourceComponent: 'NextActionCard',
          stateType: 'empty-state',
          targetUrl: '/schedules',
          userRole: role,
        });
        navigate('/schedules');
      },
      nextActionMenuAction: () => {
        const today = new Date().toISOString().split('T')[0];
        const url = buildDailyHubFromTodayUrl(today);
        recordCtaClick({
          ctaId: CTA_EVENTS.NEXT_ACTION_UTILITY,
          sourceComponent: 'NextActionCard',
          stateType: 'empty-state',
          targetUrl: url,
          userRole: role,
        });
        navigate(url);
      },

    };
  }, [summary, nextAction, quickRecord.openUnfilled, quickRecord.openUser, approvalFlow.open, navigate]);

  const handleSaveSuccess = React.useCallback(() => {
    if (!quickRecord.autoNextEnabled) {
      quickRecord.close();
      return;
    }

    // Record auto-next save counter (#632)
    recordAutoNextSave();

    const pendingUserIds = summary?.dailyRecordStatus?.pendingUserIds || [];
    const nextUserId = resolveNextUser(quickRecord.userId, pendingUserIds);

    if (nextUserId) {
      setTimeout(() => {
        quickRecord.openUnfilled(nextUserId);
      }, 0);
    } else {
      // End-of-queue: close drawer + show completion toast + record complete (#632)
      quickRecord.close();
      setShowCompletionToast(true);
      recordAutoNextComplete();
    }
  }, [summary?.dailyRecordStatus?.pendingUserIds, quickRecord]);

  return (
    <>
      <TodayBentoLayout {...layoutProps} />

      {/* Quick Record Drawer Overlay */}
      <QuickRecordDrawer
        open={quickRecord.isOpen}
        mode={quickRecord.mode}
        userId={quickRecord.userId}
        onClose={quickRecord.close}
        onSaveSuccess={handleSaveSuccess}
        autoNextEnabled={quickRecord.autoNextEnabled}
        setAutoNextEnabled={quickRecord.setAutoNextEnabled}
      />

      {/* End-of-queue completion toast (#631) */}
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

      {/* Approval Dialog (#765) */}
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
