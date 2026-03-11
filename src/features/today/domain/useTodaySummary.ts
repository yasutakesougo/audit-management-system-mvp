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
import { useAttendanceStore } from '@/features/attendance';
import { useDashboardSummary } from '@/features/dashboard';
import { useStaffStore } from '@/features/staff';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { toLocalDateISO } from '@/utils/getNow';
import { useMemo } from 'react';
import type { ServiceStructure } from './serviceStructure.types';

// ─── Internal: Dashboard-irrelevant defaults ────────────────────────────
const generateMockActivityRecords = () => [];
const mockAttendanceCounts = { onDuty: 0, out: 0, absent: 0, total: 0 };
const mockSpSyncStatus = { loading: false, error: null, itemCount: 0, source: 'demo' as const };

/** 業務体制モック — staff 名からデモ配置を生成 */
function buildMockServiceStructure(staffNames: string[]): ServiceStructure {
  const s = (i: number) => staffNames[i % staffNames.length] ?? '未定';
  return {
    dayCare: {
      floorWatchStaff: [s(0), s(1)],
      activityLeadStaff: [s(2)],
      mealSupportStaff: [s(3)],
      recordCheckStaff: [s(4)],
      returnAcceptStaff: [s(5)],
    },
    lifeSupport: {
      shortStayCount: 1,
      temporaryCareCount: 2,
      intakeDeskStaff: [s(1)],
      supportStaff: [s(3), s(5)],
      coordinatorStaff: [s(4)],
      notes: ['送迎時間確認あり'],
    },
    decisionSupport: {
      directorPresent: true,
      serviceManagerPresent: true,
      nursePresent: true,
      directorNames: [s(0)],
      serviceManagerNames: [s(4)],
      nurseNames: [s(2)],
    },
    operationalSupport: {
      accountantPresent: true,
      accountantNames: [s(3)],
      mealStaff: [s(5), s(6 % staffNames.length)],
      transportStaff: [s(1), s(7 % staffNames.length)],
      volunteerStaff: [s(6 % staffNames.length)],
      visitorNames: [s(7 % staffNames.length)],
    },
  };
}

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
  const today = toLocalDateISO();
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

  // ─── 3. Service Structure (Today-only: facade 内で生成) ───
  const serviceStructure = useMemo(
    () => {
      const staffNames = staff.map((s) => s.name ?? `職員${staff.indexOf(s) + 1}`);
      return buildMockServiceStructure(staffNames);
    },
    [staff],
  );

  // ─── 4. Pick-only: Today のデータ契約 ───
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
      // 業務体制（Today-only）
      serviceStructure,

      // ─── Passthrough: TodayOpsPage の UI マッピングで必要 ───
      users,
      visits,
    }),
    [
      full.attendanceSummary,
      full.dailyRecordStatus,
      full.briefingAlerts,
      full.scheduleLanesToday,
      serviceStructure,
      users,
      visits,
    ],
  );
}

export type TodaySummary = ReturnType<typeof useTodaySummary>;
