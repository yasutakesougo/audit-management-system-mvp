/**
 * @fileoverview ISP 三層モデル整合性例外の取得 Hook
 */
import { useMemo } from 'react';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { simulateAllTodayExceptions } from '@/domain/isp/exceptionDetector';
import type { TriggeredException } from '@/domain/isp/exceptionBridge';
import type { IUserMaster } from '@/sharepoint/fields';

export function useBridgeExceptions() {
  const { data: users } = useUsersQuery();
  const summary = useDashboardSummary({
    targetDate: new Date()
  });

  const exceptions: TriggeredException[] = useMemo(() => {
    if (!users || !summary.full.activityRecords) return [];
    
    // 実績記録と利用者マスタを突き合わせて例外をシミュレート/検知
    return simulateAllTodayExceptions(summary.full.activityRecords, users as IUserMaster[]);
  }, [users, summary.full.activityRecords]);

  return {
    exceptions,
    isLoading: summary.status === 'loading',
    refetch: summary.refresh
  };
}
