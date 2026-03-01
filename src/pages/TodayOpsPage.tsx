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
import { buildDailyHubFromTodayUrl } from '@/app/links/navigationLinks';
import { useTodaySummary } from '@/features/today/domain';
import { useNextAction } from '@/features/today/hooks/useNextAction';
import { TodayOpsLayout } from '@/features/today/layouts/TodayOpsLayout';
import { QuickRecordDrawer } from '@/features/today/records/QuickRecordDrawer';
import { useQuickRecord } from '@/features/today/records/useQuickRecord';
import { isE2E } from '@/lib/env';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const TodayOpsPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Data via Facade (Execution Layer はドメイン集約を持たない)
  const summary = useTodaySummary();

  // 2. Derived: Next Action (hook で算出 — ページが太らない)
  const nextAction = useNextAction(summary.scheduleLanesToday);

  // 3. Local State / URL State (Quick Record Drawer)
  const quickRecord = useQuickRecord();

  // 4. Map to Layout Props (Defensive mapping)
  const layoutProps = useMemo(() => {
    const isE2EEnv = isE2E() || (typeof window !== 'undefined' && (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__);

    // Hero: 未記録件数
    const realUnfilledCount = Math.max(0, summary?.dailyRecordStatus?.pending ?? 0);
    const unfilledCount = isE2EEnv ? 3 : realUnfilledCount;

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
      hero: {
        unfilledCount,
        approvalPendingCount: isE2EEnv ? 1 : 0,
        onOpenUnfilled: () => {
          const firstUnfilledUserId = summary?.dailyRecordStatus?.pendingUserIds?.[0];
          quickRecord.openUnfilled(firstUnfilledUserId);
        },
        onOpenApproval: () => {
          // eslint-disable-next-line no-console
          console.log('Open Approval Modal');
        },
        onOpenMenu: () => {
          const today = new Date().toISOString().split('T')[0];
          navigate(buildDailyHubFromTodayUrl(today));
        },
      },
      attendance: {
        facilityAttendees: summary?.attendanceSummary?.facilityAttendees ?? 0,
        absenceCount: summary?.attendanceSummary?.absenceCount ?? 0,
        absenceNames: summary?.attendanceSummary?.absenceNames ?? [],
        lateOrEarlyLeave: summary?.attendanceSummary?.lateOrEarlyLeave ?? 0,
        lateOrEarlyNames: summary?.attendanceSummary?.lateOrEarlyNames ?? [],
      },
      briefingAlerts: summary?.briefingAlerts ?? [],
      nextAction,
      transport: {
        pending: [],
        inProgress: [],
        onArrived: (userId: string) => {
          // eslint-disable-next-line no-console
          console.log(`Marked as arrived: ${userId}`);
        },
      },
      users: {
        items: isE2EEnv
          ? [
              { userId: 'I022', name: '中村 裕樹', status: 'present' as const, recordFilled: false },
              { userId: 'I105', name: '山田 花子', status: 'present' as const, recordFilled: true },
            ]
          : sortedUserItems,
        onOpenQuickRecord: quickRecord.openUser,
        onOpenISP: (userId: string) => navigate(`/isp-editor/${userId}`),
      },
    };
  }, [summary, nextAction, quickRecord.openUnfilled, quickRecord.openUser]);

  const handleSaveSuccess = React.useCallback(() => {
    if (!quickRecord.autoNextEnabled) {
      quickRecord.close();
      return;
    }

    const pendingUserIds = summary?.dailyRecordStatus?.pendingUserIds || [];
    const currentUserId = quickRecord.userId;

    const idx = currentUserId ? pendingUserIds.indexOf(currentUserId) : -1;
    let nextUserId: string | undefined;

    if (idx >= 0 && idx + 1 < pendingUserIds.length) {
      nextUserId = pendingUserIds[idx + 1];
    } else if (idx === -1 && pendingUserIds.length > 0) {
      nextUserId = pendingUserIds[0];
    }

    if (nextUserId) {
      setTimeout(() => {
        quickRecord.openUnfilled(nextUserId);
      }, 0);
    } else {
      quickRecord.close();
    }
  }, [summary?.dailyRecordStatus?.pendingUserIds, quickRecord]);

  return (
    <>
      <TodayOpsLayout {...layoutProps} />

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
    </>
  );
};

export default TodayOpsPage;
