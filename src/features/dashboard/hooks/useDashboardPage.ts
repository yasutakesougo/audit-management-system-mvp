/**
 * useDashboardPage — ダッシュボードページの Thin Orchestrator
 *
 * 責務:
 * - sub-hook の呼び出しと接続
 * - useDashboardSummary / useDashboardViewModel の接続
 * - グループ化された戻り値の返却
 *
 * DashboardPage.tsx はこのフックの戻り値のみに依存し、ロジックを一切持たない。
 */

import { type DashboardAudience } from '@/features/auth/store';
import { useAttendanceStore } from '@/features/attendance/store';
import { generateMockActivityRecords } from '@/features/dashboard/mocks/mockData';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useDashboardViewModel, type DashboardViewModel } from '@/features/dashboard/useDashboardViewModel';
import { useAttendanceCounts } from '@/features/staff/attendance/useAttendanceCounts';
import { useStaffStore } from '@/features/staff/store';
import { useUsers } from '@/features/users/useUsers';
import { toLocalDateISO } from '@/utils/getNow';

import { useDashboardHandoff, type DashboardHandoffGroup } from './useDashboardHandoff';
import { useDashboardNavigation, type DashboardNavGroup } from './useDashboardNavigation';
import { useDashboardUIState, type DashboardUIGroup } from './useDashboardUIState';

// ── re-export (外側互換を維持) ──
export type { DashboardHandoffGroup } from './useDashboardHandoff';
export type { DashboardNavGroup } from './useDashboardNavigation';
export type { DashboardUIGroup, DailyStatusCard } from './useDashboardUIState';

export interface UseDashboardPageReturn {
  nav: DashboardNavGroup;
  ui: DashboardUIGroup;
  vm: DashboardViewModel<unknown>;
  summary: ReturnType<typeof useDashboardSummary>;
  handoff: DashboardHandoffGroup;
}

// ── フック本体 ──
export function useDashboardPage(audience: DashboardAudience = 'staff'): UseDashboardPageReturn {
  // ── Shared domain data (summary と ui の両方で使用) ──
  const { data: users } = useUsers();
  const { visits } = useAttendanceStore();
  const { staff } = useStaffStore();
  const today = toLocalDateISO();
  const currentMonth = today.slice(0, 7);
  const attendanceCounts = useAttendanceCounts(today);

  // ── Sub-hooks: Handoff (自己完結) ──
  const handoff = useDashboardHandoff();

  // ── Summary ──
  const summary = useDashboardSummary({
    users,
    today,
    currentMonth,
    visits,
    staff,
    attendanceCounts,
    generateMockActivityRecords,
  });

  // ── Sub-hooks: UI State ──
  const ui = useDashboardUIState(audience, summary.dailyRecordStatus, users, visits);

  // ── Sub-hooks: Navigation (isMorningTime に依存) ──
  const nav = useDashboardNavigation(ui.isMorningTime);

  // ── ViewModel ──
  const vm = useDashboardViewModel({
    role: audience,
    summary: {
      attendanceSummary: summary.attendanceSummary,
      dailyRecordStatus: summary.dailyRecordStatus,
      stats: summary.stats,
      handoff: {
        total: handoff.total,
        byStatus: handoff.status,
        critical: handoff.critical,
      },
      timing: { isMorningTime: ui.isMorningTime, isEveningTime: ui.isEveningTime },
      briefingAlerts: summary.briefingAlerts,
    },
  });

  return { nav, ui, vm, summary, handoff };
}
