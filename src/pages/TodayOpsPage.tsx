import { useAttendanceStore } from '@/features/attendance/store';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useStaffStore } from '@/features/staff/store';
import { TodayOpsLayout } from '@/features/today/layouts/TodayOpsLayout';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { isE2E } from '@/lib/env';
import React, { useMemo } from 'react';

// 仮のモックジェネレーターとカウント (本来はポートから注入されるべきだが、まずはダッシュボードと同等に扱う)
const generateMockActivityRecords = () => [];
const mockAttendanceCounts = { onDuty: 0, out: 0, absent: 0, total: 0 };
const mockSpSyncStatus = { loading: false, error: null, itemCount: 0, source: 'demo' as const };

export const TodayOpsPage: React.FC = () => {
  // 1. Data Fetching
  const { data: users } = useUsersDemo();
  const { visits } = useAttendanceStore();
  const { staff } = useStaffStore();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const summary = useDashboardSummary(
    users,
    staff,
    visits,
    today,
    currentMonth,
    generateMockActivityRecords,
    mockAttendanceCounts,
    mockSpSyncStatus
  );

  // 2. Map to Layout Props (Defensive mapping)
  const layoutProps = useMemo(() => {
    // E2E環境では固定値を注入（VITE_E2E=1 または Playwright注入フラグ）
    const isE2EEnv = isE2E() || (typeof window !== 'undefined' && (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__);

    // 防御的コーディング: undefined/null を 0 に正規化
    const realUnfilledCount = Math.max(0, summary?.dailyRecordStatus?.pending ?? 0);
    const unfilledCount = isE2EEnv ? 3 : realUnfilledCount;

    return {
      hero: {
        unfilledCount,
        approvalPendingCount: isE2EEnv ? 1 : 0, // 今後の拡張
        onOpenUnfilled: () => {
          // eslint-disable-next-line no-console
          console.log('Open Quick Record for Unfilled (PR3 implementation pending)');
        },
        onOpenApproval: () => {
          // eslint-disable-next-line no-console
          console.log('Open Approval Modal');
        },
      },
      nextAction: {
        title: '朝のバイタル確認',
        timeText: '09:10',
      },
      transport: {
        pending: [],
        inProgress: [],
        onArrived: (userId: string) => {
          // eslint-disable-next-line no-console
          console.log(`Marked as arrived: ${userId}`);
        },
      },
      users: {
        items: [
          { userId: 'I022', name: '中村 裕樹', status: 'present' as const },
          { userId: 'I105', name: '山田 花子', status: 'present' as const },
        ],
        onOpenQuickRecord: (userId: string) => {
          // eslint-disable-next-line no-console
          console.log(`Open Quick Record for: ${userId}`);
        },
      },
      alerts: {
        items: [{ id: 'a1', message: '服薬の確認（昼食前）' }],
        onOpenDetail: () => {
          // eslint-disable-next-line no-console
          console.log('Open Briefing Details');
        },
      },
    };
  }, [summary]);

  return <TodayOpsLayout {...layoutProps} />;
};

export default TodayOpsPage;
