/**
 * useZeroScrollTabs — Zero-Scroll レイアウト用タブデータ構築フック
 *
 * 責務:
 * - UserStatusTab / StaffStatusTab / TodoTab のデータ準備
 * - DashboardTab[] 配列の useMemo 生成
 *
 * DashboardPage（Container）から呼ばれ、ZeroScrollLayout に渡すタブ配列を返す。
 */

import { generateTodosFromSchedule } from '@/features/dashboard/generateTodos';
import type { DashboardTab } from '@/features/dashboard/layouts/ZeroScrollLayout';
import { StaffStatusTab } from '@/features/dashboard/tabs/StaffStatusTab';
import { TodoTab } from '@/features/dashboard/tabs/TodoTab';
import { UserStatusTab } from '@/features/dashboard/tabs/UserStatusTab';
import type { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import React, { useMemo } from 'react';

// ── 入力 Props ──
export interface UseZeroScrollTabsParams {
  attendanceSummary: ReturnType<typeof useDashboardSummary>['attendanceSummary'];
  staffAvailability: ReturnType<typeof useDashboardSummary>['staffAvailability'];
  scheduleLanesToday: ReturnType<typeof useDashboardSummary>['scheduleLanesToday'];
}

/**
 * タブデータを構築して返す
 */
export function useZeroScrollTabs(params: UseZeroScrollTabsParams): DashboardTab[] {
  const { attendanceSummary, staffAvailability, scheduleLanesToday } = params;

  return useMemo(() => {
    // 利用者タブのデータ
    const userTabData = {
      attendeeCount: attendanceSummary.facilityAttendees,
      absentUsers: attendanceSummary.absenceNames.map((name, index) => ({
        id: `absent-${index}`,
        name,
        reason: '理由未記入', // @backlog: SP実データ連携時に取得ロジックへ置換
      })),
      lateOrEarlyUsers: attendanceSummary.lateOrEarlyNames.map((name, index) => ({
        id: `late-${index}`,
        name,
        type: 'late' as const, // @backlog: SP実データで判別
      })),
    };

    // 職員タブのデータ
    const staffTabData = {
      staffAvailability,
      absentStaff: [] as never[], // 外出中 status removed (Issue 1-1)
      lateOrAdjustStaff: [] as never[], // @backlog: SP実データから取得
    };

    // やることタブのデータ（スケジュールから自動生成）
    const todoItems = generateTodosFromSchedule(scheduleLanesToday);

    return [
      {
        id: 'users',
        label: '利用者',
        count: userTabData.absentUsers.length + userTabData.lateOrEarlyUsers.length,
        component: React.createElement(UserStatusTab, userTabData),
      },
      {
        id: 'staff',
        label: '職員',
        count: staffTabData.absentStaff.length,
        component: React.createElement(StaffStatusTab, staffTabData),
      },
      {
        id: 'todo',
        label: 'やること',
        count: todoItems.length,
        component: React.createElement(TodoTab, { todos: todoItems }),
      },
    ] satisfies DashboardTab[];
  }, [attendanceSummary, staffAvailability, scheduleLanesToday]);
}
