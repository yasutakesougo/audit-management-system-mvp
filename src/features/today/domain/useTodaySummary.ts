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
import { useQuery } from '@tanstack/react-query';
import { useDashboardSummary } from '@/features/dashboard';
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { useStaffStore } from '@/features/staff';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { toLocalDateISO } from '@/utils/getNow';
import { useMemo } from 'react';
import { useSupportRecordCompletion } from '../hooks/useSupportRecordCompletion';
import type { SupportRecordCompletionSummary } from '../hooks/useSupportRecordCompletion';
import type { ServiceStructure } from './serviceStructure.types';
import { buildServiceStructure } from './buildServiceStructure';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { IUserMaster } from '@/features/users/types';
import type { AttendanceVisitSnapshot } from '@/features/dashboard/selectors/useAttendanceAnalytics';
import type { RawActionSource } from '../domain/models/queue.types';
import type { TriggeredException } from '@/domain/isp/exceptionBridge';
import { simulateAllTodayExceptions } from '@/domain/isp/exceptionDetector';
import { mapExceptionsToTodayActionSources } from '@/domain/today/exceptionToTodayActionMapper';

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
  todayExceptions: TriggeredException[];
  todayExceptionActions: RawActionSource[];
};

// ─── Internal: Dashboard-irrelevant defaults ────────────────────────────
const generateMockActivityRecords = () => [];
const mockAttendanceCounts = { onDuty: 0, out: 0, absent: 0, total: 0 };
const mockSpSyncStatus = { 
  spLane: 'demo' as string | null,
  loading: false, 
  error: null, 
  itemCount: 0, 
  source: 'demo' as const 
};

// buildMockServiceStructure は削除 → buildServiceStructure.ts に移行済み

// ─── Constants ───
const USERS_QUERY_PARAMS = { selectMode: 'detail' as const };

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
  const { data: queriedUsers } = useUsersQuery(USERS_QUERY_PARAMS);
  const users = useMemo(
    () => filterActiveUsers(queriedUsers),
    [queriedUsers],
  );
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

  // ─── 2b. Daily records (today) from repository ───
  // /today の「本日の進捗」は SharePoint 日次記録（SupportRecord_Daily）を正として集計する。
  const dailyRecordRepository = useDailyRecordRepository();
  const { data: todayDailyRecords = [] } = useQuery({
    queryKey: ['today-summary', 'daily-records', today],
    queryFn: () =>
      dailyRecordRepository.list({
        range: { startDate: today, endDate: today },
      }),
    enabled: !!dailyRecordRepository && !!today,
    staleTime: 60_000,
    retry: false,
  });

  const dailyRecordStatusFromRepository = useMemo<DailyRecordStatusPick>(() => {
    const expectedUserIds = users
      .map((u) => String(u.UserID ?? '').trim())
      .filter(Boolean);
    const expectedSet = new Set(expectedUserIds);

    const completedSet = new Set(
      todayDailyRecords.flatMap((record) =>
        (record.userRows ?? [])
          .map((row) => String(row.userId ?? '').trim())
          .filter((id) => id && expectedSet.has(id)),
      ),
    );

    const pendingUserIds = expectedUserIds.filter((id) => !completedSet.has(id));

    return {
      pending: pendingUserIds.length,
      completed: completedSet.size,
      total: expectedUserIds.length,
      pendingUserIds,
    };
  }, [todayDailyRecords, users]);

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
  const supportTargetCompletionUserIds = useMemo(
    () =>
      users
        .filter((u) => u.IsHighIntensitySupportTarget === true)
        .map((u) => {
        const uid = String(u.UserID ?? '').trim();
        return uid || `U${String(u.Id ?? 0).padStart(3, '0')}`;
      }),
    [users],
  );
  const todayRecordCompletion = useSupportRecordCompletion(today, supportTargetCompletionUserIds);

  const { todayExceptions, todayExceptionActions } = useMemo(() => {
    // 計画と実績のズレを検知してアクションソースへ変換
    const exceptions = simulateAllTodayExceptions(full.activityRecords, users);
    return {
      todayExceptions: exceptions,
      todayExceptionActions: mapExceptionsToTodayActionSources(exceptions)
    };
  }, [full.activityRecords, users]);

  // ─── 4. Pick-only: Today のデータ契約 ───
  // ⚠ このリストを拡張する場合は ADR-002 を参照し、
  //   dashboard domain 側に追加してから pick すること。
  // ⚠ todayRecordCompletion は ADR-002 例外: ExecutionStore 起点で /today のみ消費。
  return useMemo(
    () => ({
      // 出欠サマリー
      attendanceSummary: full.attendanceSummary,
      // 日次記録ステータス（未記録件数・pendingUserIds — Dashboard 起点）
      dailyRecordStatus: dailyRecordStatusFromRepository,
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
      todayExceptions,
      todayExceptionActions,
    }),
    [
      full.attendanceSummary,
      dailyRecordStatusFromRepository,
      todayRecordCompletion,
      full.briefingAlerts,
      full.scheduleLanesToday,
      serviceStructure,
      users,
      visits,
      todayExceptions,
      todayExceptionActions,
    ],
  );
}
