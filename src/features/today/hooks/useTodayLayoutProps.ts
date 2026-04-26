/**
 * useTodayLayoutProps — TodayOpsPage の Layout Props Mapping を分離
 *
 * 責務:
 * - summary / nextAction / sceneAction / transport / quickRecord から
 *   TodayBentoLayout が受け取る props を組み立てる
 * - navigate と recordCtaClick を使うハンドラを生成する
 * - ソートやフィルタなどの表示用 derivation
 *
 * 含めないこと:
 * - データ取得 (useTodaySummary 等)
 * - save success の副作用
 * - landing telemetry
 * - JSX
 *
 * @see TodayOpsPage.tsx — オーケストレーター
 * @see TodayBentoLayout.tsx — プレゼンテーション
 */
import { useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import {
  buildDailyHubFromTodayUrl,
  buildHandoffFromTodayState,
  buildHandoffTimelineUrl,
  buildIcebergPdcaUrl,
  sceneToTimeBand,
} from '@/app/links/navigationLinks';
import { buildDailySupportUrl } from '@/app/links/dailySupportLinks';
import { isE2E } from '@/lib/env';
import { getWindowFlag } from '@/env';
import { CTA_EVENTS, recordCtaClick } from '@/features/today/telemetry/recordCtaClick';

import type { TodayBentoProps } from '../layouts/TodayBentoLayout';
import type { UserCompactListProps } from '../widgets/UserCompactList';
import type { ProgressChipKey } from '../widgets/ProgressStatusBar';
import type { NextActionWithProgress } from './useNextAction';
import type { SceneNextActionViewModel } from './useSceneNextAction';
import type { UseTransportStatusReturn } from '../transport';
import type { UserAlert } from '../domain/buildUserAlerts';
import type { UserStatusRecord } from '@/features/schedules/domain/mappers/userStatus';

// ── Input Types ──

export type TodayLayoutPropsInput = {
  summary: {
    users?: Array<{ Id?: number; UserID?: string; FullName?: string }>;
    visits: Record<string, { status?: string }>;
    scheduleLanesToday: unknown;
    attendanceSummary?: {
      facilityAttendees?: number;
      sameDayAbsenceCount?: number;
      sameDayAbsenceNames?: string[];
      priorAbsenceCount?: number;
      priorAbsenceNames?: string[];
      lateOrEarlyLeave?: number;
      lateOrEarlyNames?: string[];
    };
    briefingAlerts?: Array<{ severity: string; [key: string]: unknown }>;
    dailyRecordStatus?: {
      pending?: number;
      pendingUserIds?: string[];
    };
    todayRecordCompletion?: {
      total: number;
      completed: number;
      pending: number;
      pendingUserIds: string[];
    };
    serviceStructure?: TodayBentoProps['serviceStructure'];
  };
  nextAction: NextActionWithProgress;
  sceneAction?: SceneNextActionViewModel;
  transport: UseTransportStatusReturn;
  quickRecord: {
    openUser: (id: string) => void;
    openUnfilled: (id?: string) => void;
  };
  navigate: NavigateFunction;
  role: string;
  scheduleDetailHref: string;
  /** 利用者ごとの直近注意点（useUserAlerts の出力） */
  alertsByUser?: Map<string, UserAlert[]>;
  /** Phase 8-A: 利用者状態ダイアログを開くコールバック */
  onOpenUserStatus?: UserCompactListProps['onOpenUserStatus'];
  /** Phase 8-A: 当日の利用者状態レコード一覧 */
  userStatusRecords?: UserStatusRecord[];
  /** ExceptionCenter deep link: ハイライト対象ユーザーID */
  transportHighlightUserId?: string | null;
};

// ── Return Type ──

export type TodayLayoutPropsResult = Omit<TodayBentoProps, 'todayTasks' | 'onPhaseNavigate'>;

// ── Hook ──

export function useTodayLayoutProps(input: TodayLayoutPropsInput): TodayLayoutPropsResult {
  const {
    summary,
    nextAction,
    sceneAction,
    transport,
    quickRecord,
    navigate,
    role,
    scheduleDetailHref,
    alertsByUser,
    onOpenUserStatus,
    userStatusRecords,
    transportHighlightUserId,
  } = input;

  return useMemo(() => {
    const isE2EEnv = isE2E() || getWindowFlag('__E2E_TODAY_OPS_MOCK__');

    // ── Progress ──
    const recordCompletion = summary?.todayRecordCompletion;
    // recordCompletion がある場合でも total=0（高強度支援対象者なし）なら
    // dailyRecordStatus にフォールバックして正しい pending 件数を使う。
    const realPendingCount = (recordCompletion && recordCompletion.total > 0)
      ? recordCompletion.pending
      : Math.max(0, summary?.dailyRecordStatus?.pending ?? 0);
    const pendingRecordCount = isE2EEnv ? 3 : realPendingCount;
    // recordCompletion.total は IsHighIntensitySupportTarget=true の利用者数のみ。
    // 0 の場合（該当者なし）は全利用者数にフォールバックして分母が 1 になるのを防ぐ。
    const totalRecordCount = recordCompletion?.total || (summary.users?.length ?? 0);

    const facilityAttendees = summary?.attendanceSummary?.facilityAttendees ?? 0;
    const pendingAttendanceCount = isE2EEnv
      ? 2
      : Math.max(0, (summary.users?.length ?? 0) - facilityAttendees);

    const pendingBriefingCount = isE2EEnv
      ? 1
      : (summary?.briefingAlerts ?? []).filter(
          (a) => a.severity === 'error' || a.severity === 'warning',
        ).length;

    // ── User List ──
    const pendingUserIds = new Set(
      (recordCompletion && recordCompletion.total > 0)
        ? recordCompletion.pendingUserIds
        : (summary?.dailyRecordStatus?.pendingUserIds ?? []),
    );

    // Phase 8-A: statusMap の作成を先に行い、ソートでステータスを利用可能にする
    const statusMap = new Map<string, UserStatusRecord>();
    for (const record of (userStatusRecords ?? [])) {
      statusMap.set(record.userId, record);
    }

    const userItems = (summary.users || []).map((u, i) => {
      const userId = (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`;
      const name = u.FullName ?? `利用者${i + 1}`;
      const visit = summary.visits[userId];
      const statusRecord = statusMap.get(userId);

      let status: 'present' | 'absent' | 'unknown' = 'unknown';
      if (visit) {
        if (visit.status === '通所中' || visit.status === '退所済') status = 'present';
        else if (visit.status === '当日欠席' || visit.status === '事前欠席') status = 'absent';
      }

      // Phase 8-A: statusRecord による上書き
      const userStatusType = statusRecord?.statusType;
      if (userStatusType === 'absence' || userStatusType === 'preAbsence') {
        status = 'absent';
      }

      const recordFilled = !pendingUserIds.has(userId);
      const alerts = alertsByUser?.get(userId);

      return { userId, name, status, recordFilled, alerts, userStatusType };
    });

    // ガイドに基づくソート順位の定義
    // 1. 未入力 (recordFilled: false) -> 最優先
    // 2. 事前欠席 (preAbsence)
    // 3. 当日欠席 (absence)
    // 4. 入力完了 (recordFilled: true)
    const getSortPriority = (item: typeof userItems[0]) => {
      if (!item.recordFilled) return 0;
      if (item.userStatusType === 'preAbsence') return 1;
      if (item.userStatusType === 'absence') return 2;
      return 3;
    };

    const sortedUserItems = [...userItems].sort((a, b) => {
      const priA = getSortPriority(a);
      const priB = getSortPriority(b);
      if (priA !== priB) return priA - priB;
      return (a.userId < b.userId) ? -1 : 1;
    });

    const userItemsWithStatus = sortedUserItems; // すでに userStatusType 等を内包済み

    // ── Assemble Props ──
    return {
      progress: {
        summary: {
          pendingRecordCount,
          totalRecordCount,
          pendingAttendanceCount,
          pendingBriefingCount,
        },
        onChipClick: (key: ProgressChipKey) => {
          const chipRoutes: Record<ProgressChipKey, string> = {
            record: buildDailySupportUrl({ wizard: 'user' }),
            attendance: '/daily/attendance',
            briefing: buildHandoffTimelineUrl(),
          };
          const chipCtaEvents: Record<ProgressChipKey, typeof CTA_EVENTS[keyof typeof CTA_EVENTS]> = {
            record: CTA_EVENTS.PROGRESS_CHIP_RECORD,
            attendance: CTA_EVENTS.PROGRESS_CHIP_ATTENDANCE,
            briefing: CTA_EVENTS.PROGRESS_CHIP_BRIEFING,
          };
          const targetUrl = chipRoutes[key];
          recordCtaClick({
            ctaId: chipCtaEvents[key],
            sourceComponent: 'ProgressStatusBar',
            stateType: 'navigation',
            targetUrl,
            userRole: role,
          });
          navigate(targetUrl);
        },
        scene: sceneAction?.scene,
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
        onAction: () => {
          recordCtaClick({
            ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
            sourceComponent: 'AttendanceSummaryCard',
            stateType: 'navigation',
            targetUrl: '/daily/attendance',
            userRole: role,
          });
          navigate('/daily/attendance');
        },
      },
      briefingAlerts: (summary?.briefingAlerts ?? []) as TodayBentoProps['briefingAlerts'],
      serviceStructure: summary?.serviceStructure,
      nextAction,
      sceneAction,
      onSceneAction: (target: string, userId?: string) => {
        recordCtaClick({
          ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
          sourceComponent: 'NextActionCard',
          stateType: 'scene-action',
          scene: sceneAction?.sceneLabel,
          priority: sceneAction?.priority,
          targetUrl: target,
          userRole: role,
        });
        switch (target) {
          case 'briefing':
            // reserved: 将来 HandoffPanel 連携で申し送り起点 Hero を実装する際に使用
            navigate(buildHandoffTimelineUrl(), {
              state: buildHandoffFromTodayState({
                timeFilter: sceneAction ? sceneToTimeBand(sceneAction.scene) : undefined,
              }),
            });
            break;
          case 'attendance-alert':
            navigate('/daily/attendance');
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
      transportCard: transport.isReady
        ? {
            legs: transport.status.legs,
            toSummary: transport.status.to,
            fromSummary: transport.status.from,
            activeDirection: transport.activeDirection,
            onDirectionChange: transport.setActiveDirection,
            onTransition: transport.transition,
            currentTime: transport.currentTime,
            highlightUserId: transportHighlightUserId,
          }
        : undefined,
      userListProps: {
        items: isE2EEnv
          ? [
              { userId: 'I022', name: '中村 裕樹', status: 'present' as const, recordFilled: false },
              { userId: 'I105', name: '山田 花子', status: 'present' as const, recordFilled: true },
            ]
          : userItemsWithStatus,
        onOpenQuickRecord: quickRecord.openUser,
        onOpenISP: (userId: string) => navigate(`/isp-editor/${userId}`),
        onOpenIceberg: (userId: string) => navigate(buildIcebergPdcaUrl(userId)),
        onAlertClick: (userId: string) => {
          const targetUrl = buildDailySupportUrl({ userId });
          recordCtaClick({
            ctaId: CTA_EVENTS.USER_ALERT_CLICKED,
            sourceComponent: 'UserCompactList',
            stateType: 'navigation',
            targetUrl,
            userRole: role,
          });
          navigate(targetUrl);
        },
        onOpenUserStatus,
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
      scheduleDetailHref,
      onNextActionNavigate: (href: string) => {
        recordCtaClick({
          ctaId: CTA_EVENTS.NEXT_ACTION_PRIMARY,
          sourceComponent: 'NextActionCard',
          stateType: 'navigation',
          targetUrl: href,
          userRole: role,
        });
        navigate(href);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      users: summary.users as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visits: summary.visits as any,
    };
  }, [summary, nextAction, sceneAction, transport, quickRecord.openUnfilled, quickRecord.openUser, navigate, role, scheduleDetailHref, alertsByUser, onOpenUserStatus, userStatusRecords]);
}
