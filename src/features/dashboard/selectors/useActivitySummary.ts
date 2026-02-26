import type { PersonDaily } from '@/domain/daily/types';
import { calculateUsageFromDailyRecords } from '@/features/users/userMasterDashboardUtils';
import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import type { IUserMaster } from '@/sharepoint/fields';
import { useMemo } from 'react';

export function useActivitySummary(
  users: IUserMaster[],
  today: string,
  currentMonth: string,
  generateMockActivityRecords: (users: IUserMaster[], date: string) => PersonDaily[]
) {
  const activityRecords = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.activityModel, {
      status: 'pending',
      users: users.length,
    });
    try {
      const records = generateMockActivityRecords(users, today);
      span({
        meta: {
          status: 'ok',
          recordCount: records.length,
          bytes: estimatePayloadSize(records),
        },
      });
      return records;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [users, today, generateMockActivityRecords]);

  const usageMap = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.usageAggregation, {
      status: 'pending',
      month: currentMonth,
    });
    try {
      const map = calculateUsageFromDailyRecords(activityRecords, users, currentMonth, {
        userKey: (record) => String(record.personId ?? ''),
        dateKey: (record) => record.date ?? '',
        countRule: (record) => record.status === '完了',
      });
      const entryCount = map && typeof map === 'object'
        ? Object.keys(map as Record<string, unknown>).length
        : 0;
      span({
        meta: {
          status: 'ok',
          entries: entryCount,
          bytes: estimatePayloadSize(map),
        },
      });
      return map;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [activityRecords, users, currentMonth]);

  const intensiveSupportUsers = useMemo(
    () => users.filter(user => user.IsSupportProcedureTarget),
    [users],
  );

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

    const problemBehaviorStats = activityRecords.reduce((acc, record) => {
      const pb = record.data.problemBehavior;
      if (pb) {
        if (pb.selfHarm) acc.selfHarm++;
        if (pb.violence) acc.violence++;
        if (pb.loudVoice) acc.loudVoice++;
        if (pb.pica) acc.pica++;
        if (pb.other) acc.other++;
      }
      return acc;
    }, { selfHarm: 0, violence: 0, loudVoice: 0, pica: 0, other: 0 });

    const seizureCount = activityRecords.filter(r =>
      r.data.seizureRecord && r.data.seizureRecord.occurred
    ).length;

    const lunchStats = activityRecords.reduce((acc, record) => {
      const amount = record.data.mealAmount || 'なし';
      acc[amount] = (acc[amount] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      recordedUsers,
      completionRate,
      problemBehaviorStats,
      seizureCount,
      lunchStats
    };
  }, [users, activityRecords]);

  const dailyRecordStatus = useMemo(() => {
    const total = users.length;
    const completed = activityRecords.filter((record) => record.status === '完了').length;
    const inProgress = activityRecords.filter((record) => record.status === '作成中').length;
    const pending = Math.max(total - completed - inProgress, 0);

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [activityRecords, users.length]);

  return {
    activityRecords,
    usageMap,
    intensiveSupportUsers,
    stats,
    dailyRecordStatus,
  };
}
