import { TodayOpsLayout } from '@/features/today/layouts/TodayOpsLayout';
import React, { useMemo } from 'react';

export const TodayOpsPage: React.FC = () => {
  // PR1: まずは表示できる「枠」だけを作る（既存VM接続はPR2）
  const layoutProps = useMemo(() => {
    return {
      hero: {
        unfilledCount: 3,
        approvalPendingCount: 1,
        onOpenUnfilled: () => {
          // PR3で QuickRecordDrawer に接続
          // eslint-disable-next-line no-console
          console.log('Open Quick Record for Unfilled');
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
  }, []);

  return <TodayOpsLayout {...layoutProps} />;
};

export default TodayOpsPage;
