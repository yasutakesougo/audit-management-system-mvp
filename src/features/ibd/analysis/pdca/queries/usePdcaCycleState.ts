import {
  getProcedureExecutionSummary,
  getPdcaCycleState,
  getPlanningWorkflowPhase,
  getDailyProcedureSteps,
  type PlanningSheetSnapshot,
  type ReassessmentSnapshot,
} from '@/app/services/bridgeProxy';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type {
  PlanningSheetRepository,
  ProcedureRecordRepository,
} from '@/domain/isp/port';
import type { PlanningSheetReassessment } from '@/domain/isp/planningSheetReassessment';
import type {
  ProcedureRecordListItem,
  SupportPlanningSheet,
} from '@/domain/isp/schema';
import type { PdcaCycleState } from '@/domain/isp/types';
import type {
  ExecutionRecord,
  RecordStatus,
} from '@/features/daily/domain/legacy/executionRecordTypes';
import { getScheduleKey } from '@/features/daily/domain/builders/getScheduleKey';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useProcedureRecordRepository } from '@/features/regulatory/hooks/useProcedureRecordRepository';
import { useEffect, useMemo, useState } from 'react';

export interface UsePdcaCycleStateRepositories {
  planningSheetRepository?: PlanningSheetRepository;
  procedureRecordRepository?: ProcedureRecordRepository;
}

export interface UsePdcaCycleStateParams {
  userId: string | null | undefined;
  planningSheetId?: string | null;
  referenceDate?: string;
  /** PDCA Check 入力（ISP MonitoringMeetingRecord は使わない） */
  behaviorMonitoringRecords?: BehaviorMonitoringRecord[] | null;
  /** PDCA Act 入力 */
  planningSheetReassessments?: PlanningSheetReassessment[] | null;
  repositories?: UsePdcaCycleStateRepositories;
}

export interface UsePdcaCycleStateResult {
  state: PdcaCycleState | null;
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function mapExecutionStatusToRecordStatus(
  status: ProcedureRecordListItem['executionStatus'],
): RecordStatus {
  switch (status) {
    case 'done':
      return 'completed';
    case 'partially_done':
      return 'triggered';
    case 'skipped':
      return 'skipped';
    case 'planned':
    default:
      return 'unrecorded';
  }
}

export function toExecutionRecords(
  userId: string,
  records: ProcedureRecordListItem[],
): ExecutionRecord[] {
  return records.map((record) => ({
    id: record.id,
    date: record.recordDate,
    userId,
    scheduleItemId: getScheduleKey(record.timeSlot ?? '', record.activity ?? ''),
    status: mapExecutionStatusToRecordStatus(record.executionStatus),
    triggeredBipIds: [],
    memo: '',
    recordedBy: record.performedBy,
    recordedAt: `${record.recordDate}T00:00:00.000Z`,
  }));
}

export function toWorkflowSnapshot(
  sheet: SupportPlanningSheet,
): PlanningSheetSnapshot {
  return {
    id: sheet.id,
    status: sheet.status,
    appliedFrom: sheet.appliedFrom ?? sheet.supportStartDate ?? null,
    reviewedAt: sheet.reviewedAt ?? null,
    reviewCycleDays: sheet.monitoringCycleDays ?? 90,
    procedureCount: sheet.planning?.procedureSteps?.length ?? 0,
    isCurrent: sheet.isCurrent,
  };
}

function toWorkflowReassessmentSnapshot(
  reassessment: PlanningSheetReassessment,
): ReassessmentSnapshot {
  return {
    planningSheetId: reassessment.planningSheetId,
    reassessedAt: reassessment.reassessedAt,
    planChangeDecision: reassessment.planChangeDecision,
  };
}

function toMonitoringDate(record: BehaviorMonitoringRecord): string | null {
  return toDateOnly(record.periodEnd) ?? toDateOnly(record.recordedAt);
}

export function pickLatestBehaviorMonitoringAt(
  records: BehaviorMonitoringRecord[],
  planningSheetId: string,
): string | null {
  const bySheet = records.filter(
    (record) => record.planningSheetId === planningSheetId,
  );
  const source = bySheet.length > 0 ? bySheet : records;
  if (source.length === 0) return null;

  const latest = [...source]
    .map(toMonitoringDate)
    .filter((v): v is string => v !== null)
    .sort((a, b) => b.localeCompare(a))[0];

  return latest ?? null;
}

async function resolvePlanningSheet(
  planningSheetRepository: PlanningSheetRepository,
  userId: string,
  planningSheetId?: string | null,
): Promise<SupportPlanningSheet | null> {
  if (planningSheetId) {
    return planningSheetRepository.getById(planningSheetId);
  }

  const currentSheets = await planningSheetRepository.listCurrentByUser(userId);
  const currentSheetId = currentSheets[0]?.id;
  if (!currentSheetId) return null;

  return planningSheetRepository.getById(currentSheetId);
}

export function usePdcaCycleState(
  params: UsePdcaCycleStateParams,
): UsePdcaCycleStateResult {
  const {
    userId,
    planningSheetId,
    referenceDate,
    repositories,
    behaviorMonitoringRecords,
    planningSheetReassessments,
  } = params;

  const safeBehaviorMonitoringRecords = behaviorMonitoringRecords ?? [];
  const safePlanningSheetReassessments = planningSheetReassessments ?? [];

  const defaultPlanningSheetRepository = usePlanningSheetRepositories();
  const defaultProcedureRecordRepository = useProcedureRecordRepository();

  const planningSheetRepository =
    repositories?.planningSheetRepository ?? defaultPlanningSheetRepository;
  const procedureRecordRepository =
    repositories?.procedureRecordRepository ?? defaultProcedureRecordRepository;

  const [planningSheet, setPlanningSheet] = useState<SupportPlanningSheet | null>(
    null,
  );
  const [procedureRecords, setProcedureRecords] = useState<
    ProcedureRecordListItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setPlanningSheet(null);
      setProcedureRecords([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const sheet = await resolvePlanningSheet(
          planningSheetRepository,
          userId,
          planningSheetId,
        );
        if (cancelled) return;

        if (!sheet) {
          setPlanningSheet(null);
          setProcedureRecords([]);
          return;
        }

        // NOTE:
        // PDCA 統合は第2層に閉じるため、ISP MonitoringMeetingRecord は取得しない。
        // Check は behaviorMonitoringRecords（引数）から、Act は planningSheetReassessments（引数）から解決する。
        const records = await procedureRecordRepository.listByPlanningSheet(
          sheet.id,
        );

        if (cancelled) return;
        setPlanningSheet(sheet);
        setProcedureRecords(records);
      } catch (fetchError) {
        if (cancelled) return;
        const normalized =
          fetchError instanceof Error
            ? fetchError
            : new Error(String(fetchError));
        setError(normalized);
        setPlanningSheet(null);
        setProcedureRecords([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planningSheetId, planningSheetRepository, procedureRecordRepository, userId]);

  const state = useMemo<PdcaCycleState | null>(() => {
    if (!userId || !planningSheet) return null;

    const reassessmentsBySheet = safePlanningSheetReassessments.filter(
      (r) => r.planningSheetId === planningSheet.id,
    );
    const workflowReassessments = reassessmentsBySheet.map(
      toWorkflowReassessmentSnapshot,
    );

    const workflowResult = getPlanningWorkflowPhase({
      userId,
      userName: userId,
      planningSheets: [toWorkflowSnapshot(planningSheet)],
      reassessments: workflowReassessments,
      referenceDate,
    });

    const planCreatedAt = toDateOnly(planningSheet.createdAt);
    const planAppliedAt =
      planningSheet.appliedFrom ?? planningSheet.supportStartDate ?? null;
    const lastMonitoringAt = pickLatestBehaviorMonitoringAt(
      safeBehaviorMonitoringRecords,
      planningSheet.id,
    );
    const latestReassessment = [...reassessmentsBySheet].sort((a, b) =>
      b.reassessedAt.localeCompare(a.reassessedAt),
    )[0];
    const lastReassessmentAt =
      toDateOnly(latestReassessment?.reassessedAt) ??
      toDateOnly(planningSheet.reviewedAt);
    const reassessmentCount =
      reassessmentsBySheet.length > 0
        ? reassessmentsBySheet.length
        : lastReassessmentAt
          ? 1
          : 0;

    const periodFrom = planAppliedAt ?? planCreatedAt ?? todayDate();
    const periodTo = referenceDate ?? todayDate();
    const procedures = getDailyProcedureSteps(
      planningSheet.planning,
      planningSheet.id,
    );
    const executionRecords = toExecutionRecords(userId, procedureRecords);

    const procedureCompletionRate =
      procedures.length > 0
        ? getProcedureExecutionSummary({
            userId,
            from: periodFrom,
            to: periodTo,
            procedures,
            executionRecords,
            filterByPlanningSheetId: planningSheet.id,
          }).overallCompletionRate
        : null;

    return getPdcaCycleState({
      userId,
      planningSheetId: planningSheet.id,
      workflowPhase: workflowResult.phase,
      planCreatedAt,
      planAppliedAt,
      lastMonitoringAt,
      lastReassessmentAt,
      reassessmentCount,
      procedureCompletionRate,
      monitoringDaysRemaining: workflowResult.monitoring?.daysRemaining ?? null,
      referenceDate,
    });
  }, [
    planningSheet,
    procedureRecords,
    referenceDate,
    safeBehaviorMonitoringRecords,
    safePlanningSheetReassessments,
    userId,
  ]);

  return {
    state,
    isLoading,
    error,
    isEmpty: !isLoading && !error && state === null,
  };
}
