/**
 * useTodayAttendanceInfo — 本日の出席情報を算出するカスタム hook
 *
 * DailyRecordPage から切り出した派生計算ロジック。
 * users / schedules / records から本日の予定人数・出席率・欠席者を算出する。
 */

import { useMemo } from 'react';
import type { PersonDaily } from '@/domain/daily/types';
import {
  calculateAttendanceRate,
  getExpectedAttendeeCount,
} from '@/utils/attendanceUtils';

interface TodayAttendanceInfo {
  /** 予定通所者数 */
  expectedCount: number;
  /** 通所率 (%) */
  attendanceRate: number;
  /** 完了済みレコード数 */
  actualCount?: number;
  /** 欠席者 ID 配列 */
  absentUserIds?: string[];
}

export interface UserData {
  Id: number;
  UserID: string;
  FullName: string;
  AttendanceDays?: string[] | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
}

export interface ScheduleData {
  id: string | number;
  userId?: string | number | null;
  // eslint-disable-next-line no-restricted-syntax -- backward-compat adapter field
  personId?: string | number | null;
  title?: string | null;
  startLocal?: string | null;
  startUtc?: string | null;
  status?: string | null;
  category?: string | null;
}

/**
 * 本日の出席情報を算出する。
 *
 * @param usersData   利用者マスタ (undefined = ローディング中)
 * @param schedulesData スケジュール (undefined = ローディング中)
 * @param records     本日のレコード一覧
 */
export function useTodayAttendanceInfo(
  usersData: UserData[] | undefined,
  schedulesData: ScheduleData[] | undefined,
  records: PersonDaily[],
): TodayAttendanceInfo {
  return useMemo(() => {
    const today = new Date();
    if (!usersData || !schedulesData) {
      return { expectedCount: 32, attendanceRate: 0 };
    }

    const adaptedUsers = usersData.map((user) => ({
      Id: user.Id,
      UserID: user.UserID,
      FullName: user.FullName,
      AttendanceDays: user.AttendanceDays || [],
      ServiceStartDate: user.ServiceStartDate || undefined,
      ServiceEndDate: user.ServiceEndDate || undefined,
    }));

    const adaptedSchedules = schedulesData.map((schedule) => ({
      id: schedule.id,
      userId: schedule.userId?.toString() || schedule.personId?.toString(),
      title: schedule.title || '',
      startLocal: schedule.startLocal || undefined,
      startUtc: schedule.startUtc || undefined,
      status: schedule.status ?? undefined,
      category: schedule.category || undefined,
    }));

    const { expectedCount, absentUserIds } = getExpectedAttendeeCount(
      adaptedUsers,
      adaptedSchedules,
      today,
    );

    const todayRecords = records.filter(
      (r) => r.date === today.toISOString().split('T')[0],
    );
    const actualCount = todayRecords.filter((r) => r.status === '完了').length;
    const attendanceRate = calculateAttendanceRate(actualCount, expectedCount);

    return { expectedCount, attendanceRate, actualCount, absentUserIds };
  }, [usersData, schedulesData, records]);
}
