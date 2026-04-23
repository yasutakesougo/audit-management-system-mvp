import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
} from '@mui/material';

import { useTodaySummary } from '@/features/today/domain/useTodaySummary';
import { useTodayScheduleLanes } from '@/features/today/hooks/useTodayScheduleLanes';
import { useNextAction } from '@/features/today/hooks/useNextAction';
import { useSceneNextAction } from '@/features/today/hooks/useSceneNextAction';
import { useTransportStatus } from '@/features/today/transport/useTransportStatus';
import { useTransportHighlight } from '@/features/today/transport/useTransportHighlight';
import { useQuickRecord } from '@/features/today/records/useQuickRecord';
import { useTodayUserAlerts } from '@/features/today/hooks/useUserAlerts';
import { useTodayActionQueue } from '@/features/today/hooks/useTodayActionQueue';
import { useTodayLayoutProps } from '@/features/today/hooks/useTodayLayoutProps';
import { useTodayIspRenewSuggestActions } from '@/features/today/hooks/useTodayIspRenewSuggestActions';
import { useTodayPlanPatchActions } from '@/features/today/hooks/useTodayPlanPatchActions';
import { useTodayExceptions } from '@/features/today/hooks/useTodayExceptions';
import { useCallLogsSummary } from '@/features/callLogs/hooks/useCallLogsSummary';
import { useKioskAutoRefresh } from '@/features/today/hooks/useKioskAutoRefresh';
import { useSuggestionStateStore } from '@/features/action-engine/hooks/useSuggestionStateStore';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { useKioskDetection } from '@/features/settings/hooks/useKioskDetection';
import { useFeatureFlag } from '@/config/featureFlags';
import { useQueryClient } from '@tanstack/react-query';

import { TodayBentoLayout } from '@/features/today/layouts/TodayBentoLayout';
import { ActionTaskList } from '@/features/action-engine/components/ActionTaskList';
import { HandoffPanel } from '@/features/handoff/components/HandoffPanel';
import { ConnectionDegradedBanner } from '@/features/sp/health/components/ConnectionDegradedBanner';
import { TodayLitePage as TodayLiteOpsPage } from '@/features/today/lightweight/TodayLitePage';
import { TransportConcurrencyInsightBanner } from '../transport-assignment/TransportConcurrencyInsightBanner';

import type { ActionCard } from '@/features/today/domain/models/queue.types';
import type { ActionSuggestion } from '@/features/action-engine/domain/types';
import type { ProgressRingItem } from '@/features/today/components/ProgressRings';
import {
  recordKioskTelemetry,
  KIOSK_TELEMETRY_EVENTS,
  createKioskSessionId,
} from '@/features/today/telemetry/kioskTelemetry';
import {
  recordLanding,
} from '@/features/today/telemetry/recordLanding';
import { formatDateIso } from '@/lib/dateFormat';
import { computeSnoozeUntil } from '@/features/action-engine/domain/computeSnoozeUntil';

const TodayOpsPageInner: React.FC<{ correctiveActions?: ActionSuggestion[] }> = ({ correctiveActions = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useUserAuthz();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authzRole = role as any;
  const telemetryRole = useMemo(() => (role === 'admin' ? 'admin' : 'staff'), [role]);
  const suggestionStates = useSuggestionStateStore((s) => s.states);
  const dismissSuggestion = useSuggestionStateStore((s) => s.dismiss);
  const snoozeSuggestion = useSuggestionStateStore((s) => s.snooze);
  const { isKioskMode } = useKioskDetection();
  const kioskSessionIdRef = useRef(createKioskSessionId());
  const kioskSessionLoggedRef = useRef(false);

  useEffect(() => {
    recordLanding({ path: location.pathname, search: location.search, role, referrer: document.referrer, userAgent: navigator.userAgent });
  }, [location.pathname, location.search, role]);

  useEffect(() => {
    if (!isKioskMode || !location.pathname.startsWith('/today') || kioskSessionLoggedRef.current) return;
    kioskSessionLoggedRef.current = true;
    recordKioskTelemetry(KIOSK_TELEMETRY_EVENTS.KIOSK_SESSION_STARTED, {
      mode: 'kiosk',
      source: 'today',
      sessionId: kioskSessionIdRef.current,
      role: telemetryRole,
    });
  }, [isKioskMode, location.pathname, telemetryRole]);

  const summary = useTodaySummary();
  const todayPlanPatchActions = useTodayPlanPatchActions(summary.users ?? []);
  const todayIspRenewSuggest = useTodayIspRenewSuggestActions(summary.users ?? []);
  const pendingSupportUsers = useMemo(() => {
    const ids = summary.todayRecordCompletion?.pendingUserIds ?? [];
    const usersArr = summary.users ?? [];
    const userMap = new Map(usersArr.map((u) => [u.UserID ?? String(u.Id), u.FullName ?? '']));
    return ids.map((id) => ({ userId: id, userName: userMap.get(id) ?? id })).filter((u) => u.userName);
  }, [summary.todayRecordCompletion?.pendingUserIds, summary.users]);

  const exceptionsQueue = useTodayExceptions({ pendingSupportUsers, role: authzRole });
  const realSchedule = useTodayScheduleLanes();
  const nextAction = useNextAction(realSchedule.lanes);
  const sceneAction = useSceneNextAction({
    briefingAlerts: summary.briefingAlerts ?? [],
    attendanceSummary: summary.attendanceSummary ?? {},
    dailyRecordStatus: summary.dailyRecordStatus ?? {},
    todayRecordCompletion: summary.todayRecordCompletion,
    users: summary.users ?? [],
    scheduledCount: summary.users?.length ?? 0,
    todayExceptions: summary.todayExceptions,
  });
  const transport = useTransportStatus();
  const transportHighlight = useTransportHighlight();
  const quickRecord = useQuickRecord();

  const { actionQueue, isLoading: isQueueLoading } = useTodayActionQueue({
    currentStaffId: 'staff-a',
    correctiveActions,
    suggestionStates,
    exceptionActions: [
      ...summary.todayExceptionActions,
      ...todayPlanPatchActions,
      ...todayIspRenewSuggest.actionSources,
    ],
  });

  const handleActionClick = useCallback((action: ActionCard) => {
    if (action.actionType === 'OPEN_DRAWER') {
      const payload = action.payload as { userId?: string } | undefined;
      quickRecord.openUnfilled(payload?.userId);
    } else if (action.actionType === 'NAVIGATE') {
      const payload = action.payload as { path?: string; suggestion?: ActionSuggestion } | undefined;
      const targetUrl = payload?.path ?? payload?.suggestion?.cta?.route;
      if (targetUrl) navigate(targetUrl);
    }
  }, [quickRecord, navigate]);

  const { account } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myName = (account as any)?.name ?? '';
  const callLogsSummary = useCallLogsSummary({ myName });
  const queryClient = useQueryClient();

  useKioskAutoRefresh({
    enabled: isKioskMode,
    intervalMs: 45_000,
    onRefresh: async () => {
      await Promise.allSettled([
        realSchedule.refetch(),
        exceptionsQueue.refetchDailyRecords(),
        transport.refresh(),
        callLogsSummary.refresh(),
        queryClient.invalidateQueries({ queryKey: ['users:list'] }),
      ]);
    },
  });

  const { alertsByUser } = useTodayUserAlerts(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (summary.users ?? []) as any,
  );
  const handoffPanelElement = useMemo(() => <HandoffPanel targetDate={formatDateIso(new Date())} />, []);

  const layoutProps = useTodayLayoutProps({
    summary,
    nextAction,
    sceneAction,
    transport,
    transportHighlightUserId: transportHighlight.userId,
    quickRecord,
    navigate,
    role: authzRole,
    scheduleDetailHref: '/schedules',
    alertsByUser,
    onOpenUserStatus: () => {},
    userStatusRecords: [],
  });

  const finalLayoutProps = useMemo(() => {
    const progressData = layoutProps.progress;
    const attendanceData = layoutProps.attendance;
    let progressRings: ProgressRingItem[] | undefined;

    if (progressData?.summary && attendanceData) {
      const { summary: ps, onChipClick } = progressData;
      const rt = ps.totalRecordCount ?? 0;
      const rc = Math.max(0, rt - (ps.pendingRecordCount ?? 0));
      const ds = summary.dailyRecordStatus;
      const ct = ds?.total ?? (summary.users?.length ?? 0);
      const cc = ds?.completed ?? 0;
      const as = attendanceData.scheduledCount ?? 0;
      const ap = attendanceData.facilityAttendees ?? 0;

      progressRings = [
        { key: 'records', label: '支援手順', valueText: `${rc}/${rt}`, progress: rt ? Math.round((rc/rt)*100) : 100, status: rc >= rt ? 'complete' : 'attention', onClick: () => onChipClick?.('record') },
        { key: 'caseRecords', label: '日々の記録', valueText: `${cc}/${ct}`, progress: ct ? Math.round((cc/ct)*100) : 100, status: cc >= ct ? 'complete' : 'attention', onClick: () => navigate('/daily/table') },
        { key: 'attendance', label: '出欠', valueText: `${ap}/${as}`, progress: as ? Math.round((ap/as)*100) : 100, status: ap >= as ? 'complete' : 'attention', onClick: () => onChipClick?.('attendance') },
      ];
    }

    return {
      ...layoutProps,
      progressRings,
      actionQueueTimeline: { 
        actionQueue, 
        isLoading: isQueueLoading, 
        onActionClick: handleActionClick, 
        onDismissSuggestion: (id: string) => dismissSuggestion(id, {by:'today'}), 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSnoozeSuggestion: (id: string, p: any) => snoozeSuggestion(id, computeSnoozeUntil(p, new Date()), {by:'today'}) 
      },
      actionTaskList: <ActionTaskList onOpenTask={() => {}} />,
      handoffPanel: handoffPanelElement,
      exceptionsQueue,
      onQuickLinkNavigate: (href: string) => navigate(href),
    };
  }, [layoutProps, summary, navigate, actionQueue, isQueueLoading, handleActionClick, dismissSuggestion, snoozeSuggestion, handoffPanelElement, exceptionsQueue]);

  return (
    <Box sx={{ width: '100%' }}>
      <ConnectionDegradedBanner />
      <TransportConcurrencyInsightBanner />
      <TodayBentoLayout {...finalLayoutProps} audience={authzRole} />
    </Box>
  );
};

export const TodayOpsPage: React.FC<{ correctiveActions?: ActionSuggestion[] }> = ({ correctiveActions = [] }) => {
  const { isKioskMode } = useKioskDetection();
  const todayLiteUiEnabled = useFeatureFlag('todayLiteUi');
  const navigate = useNavigate();
  const { role } = useUserAuthz();

  if (todayLiteUiEnabled && !isKioskMode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <TodayLiteOpsPage role={role as any} onNavigate={(to) => navigate(to)} />;
  }

  return <TodayOpsPageInner correctiveActions={correctiveActions} />;
};

export default TodayOpsPage;
