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
import { useUsers } from '@/features/users/useUsers';
import { toLocalDateISO } from '@/utils/getNow';
import { useMemo } from 'react';
import { useSupportRecordCompletion } from '../hooks/useSupportRecordCompletion';
import type { SupportRecordCompletionSummary } from '../hooks/useSupportRecordCompletion';
import type { ServiceStructure } from './serviceStructure.types';
import { buildServiceStructure } from './buildServiceStructure';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { IUserMaster } from '@/sharepoint/fields';
import type { AttendanceVisitSnapshot } from '@/features/dashboard/selectors/useAttendanceAnalytics';

// ─── Explicit TodaySummary contract ─────────────────────────────────────
// Defined explicitly (not via ReturnType) so IDE type servers always
// resolve todayRecordCompletion without relying on deep inference caching.

/** Pick of useAttendanceAnalytics().attendanceSummary */
type AttendanceSummaryPick = ReturnType<typeof import('@/features/dashboard/selectors/useAttendanceAnalytics').useAttendanceAnalytics>['attendanceSummary'];

/** Pick of useActivitySummary().dailyRecordStatus */
type DailyRecordStatusPick = {
  pending: number;
  completed: number;
  total: number;
  pendingUserIds: string[];
};

type ScheduleLane = { id: string; title: string; time: string; category?: string };
type ScheduleLanesPick = {
  staffLane: ScheduleLane[];
  userLane: ScheduleLane[];
  organizationLane: ScheduleLane[];
};

export type TodaySummary = {
  attendanceSummary: AttendanceSummaryPick;
  dailyRecordStatus: DailyRecordStatusPick;
  todayRecordCompletion: SupportRecordCompletionSummary;
  briefingAlerts: BriefingAlert[];
  scheduleLanesToday: ScheduleLanesPick;
  serviceStructure: ServiceStructure;
  users: IUserMaster[];
  visits: Record<string, AttendanceVisitSnapshot>;
};

// ─── Internal: Dashboard-irrelevant defaults ────────────────────────────
const generateMockActivityRecords = () => [];
const mockAttendanceCounts = { onDuty: 0, out: 0, absent: 0, total: 0 };
const mockSpSyncStatus = { loading: false, error: null, itemCount: 0, source: 'demo' as const };

// buildMockServiceStructure は削除 → buildServiceStructure.ts に移行済み

/**
 * Today Summary Facade
 *
 * Internalizes store calls and delegates to useDashboardSummary,
 * then picks only the keys that Today's execution UI actually needs.
 *
 * ✅ Pick list = Today のデータ契約。変更には意図的なレビューが必要。
 */
export function useTodaySummary(): TodaySummary {
  // ─── 1. Data Fetching (internalized from TodayOpsPage) ───
  const { data: users } = useUsers();
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

  // ─── 3. Service Structure (Today-only: スケジュール staffLane + Staff マスタから導出) ───
  const serviceStructure = useMemo(
    () => buildServiceStructure(full.scheduleLanesToday.staffLane, staff),
    [full.scheduleLanesToday.staffLane, staff],
  );

  // ─── 3b. Support Record Completion (Today-only) ───
  // ExecutionStore × ProcedureStore から算出。
  // Dashboard の dailyRecordStatus とは別系統。
  // ⚠ /daily/support は強度行動障害支援対象者のみが記録対象。
  //   全利用者ではなく IsHighIntensitySupportTarget === true のみを集計する。
  const supportTargetUserIds = useMemo(
    () => users
      .filter((u) => u.IsHighIntensitySupportTarget === true)
      .map((u) => {
        const uid = (u.UserID ?? '').trim();
        return uid || `U${String(u.Id ?? 0).padStart(3, '0')}`;
      }),
    [users],
  );
  const todayRecordCompletion = useSupportRecordCompletion(today, supportTargetUserIds);

  // ─── 4. Pick-only: Today のデータ契約 ───
  // ⚠ このリストを拡張する場合は ADR-002 を参照し、
  //   dashboard domain 側に追加してから pick すること。
  // ⚠ todayRecordCompletion は ADR-002 例外: ExecutionStore 起点で /today のみ消費。
  return useMemo(
    () => ({
      // 出欠サマリー
      attendanceSummary: full.attendanceSummary,
      // 日次記録ステータス（未記録件数・pendingUserIds — Dashboard 起点）
      dailyRecordStatus: full.dailyRecordStatus,
      // 時間別記録完了ステータス（ExecutionStore 起点 — Today-only）
      todayRecordCompletion,
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
      todayRecordCompletion,
      full.briefingAlerts,
      full.scheduleLanesToday,
      serviceStructure,
      users,
      visits,
    ],
  );
}
