/**
 * useTodaySummary — Thin Facade for Today Execution Layer
 *
 * Guardrails:
 * - TodayOpsPage は "実行UI"。集約ロジックを持たない。
 * - データ参照は本ファサード経由に限定する。
 * - 新しい集約が必要なら dashboard 側に追加してから pick する。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { useAttendanceStore } from '@/features/attendance/store';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useStaffStore } from '@/features/staff/store';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { useMemo } from 'react';

// ─── Internal: Dashboard-irrelevant defaults ────────────────────────────
const generateMockActivityRecords = () => [];
const mockAttendanceCounts = { onDuty: 0, out: 0, absent: 0, total: 0 };
const mockSpSyncStatus = { loading: false, error: null, itemCount: 0, source: 'demo' as const };

/**
 * Today Summary Facade
 *
 * Internalizes store calls and delegates to useDashboardSummary,
 * then picks only the keys that Today's execution UI actually needs.
 *
 * ✅ Pick list = Today のデータ契約。変更には意図的なレビューが必要。
 */
export function useTodaySummary() {
  // ─── 1. Data Fetching (internalized from TodayOpsPage) ───
  const { data: users } = useUsersDemo();
  const { visits } = useAttendanceStore();
  const { staff } = useStaffStore();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  // ─── 2. Delegate to shared domain aggregation ───
  const full = useDashboardSummary({
    users,
    staff,
    visits,
    today,
    currentMonth,
    generateMockActivityRecords,
    attendanceCounts: mockAttendanceCounts,
    spSyncStatus: mockSpSyncStatus,
  });

  // ─── 3. Pick-only: Today のデータ契約 ───
  // ⚠ このリストを拡張する場合は ADR-002 を参照し、
  //   dashboard domain 側に追加してから pick すること。
  return useMemo(
    () => ({
      // 出欠サマリー
      attendanceSummary: full.attendanceSummary,
      // 日次記録ステータス（未記録件数・pendingUserIds）
      dailyRecordStatus: full.dailyRecordStatus,
      // ブリーフィングアラート
      briefingAlerts: full.briefingAlerts,
      // 当日スケジュールレーン（NextAction 導出に使用）
      scheduleLanesToday: full.scheduleLanesToday,

      // ─── Passthrough: TodayOpsPage の UI マッピングで必要 ───
      users,
      visits,
    }),
    [
      full.attendanceSummary,
      full.dailyRecordStatus,
      full.briefingAlerts,
      full.scheduleLanesToday,
      users,
      visits,
    ],
  );
}

export type TodaySummary = ReturnType<typeof useTodaySummary>;
