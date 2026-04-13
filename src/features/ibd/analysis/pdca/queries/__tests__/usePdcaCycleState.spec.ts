import { renderHook, waitFor } from '@testing-library/react';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePlanningSheetRepositories = vi.fn();
const mockUseProcedureRecordRepository = vi.fn();

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => mockUsePlanningSheetRepositories(),
}));

vi.mock('@/features/regulatory/hooks/useProcedureRecordRepository', () => ({
  useProcedureRecordRepository: () => mockUseProcedureRecordRepository(),
}));

import {
  mapExecutionStatusToRecordStatus,
  pickLatestBehaviorMonitoringAt,
  toExecutionRecords,
  toWorkflowSnapshot,
  usePdcaCycleState,
  type UsePdcaCycleStateParams,
} from '../usePdcaCycleState';

function makePlanningSheet(
  overrides: Partial<SupportPlanningSheet> = {},
): SupportPlanningSheet {
  return {
    id: 'sp-1',
    createdAt: '2026-03-01T00:00:00.000Z',
    createdBy: 'staff-1',
    updatedAt: '2026-03-02T00:00:00.000Z',
    updatedBy: 'staff-1',
    version: 1,
    userId: 'U-001',
    ispId: 'ISP-1',
    title: 'title',
    targetScene: '',
    targetDomain: '',
    observationFacts: 'obs',
    collectedInformation: '',
    interpretationHypothesis: 'hypothesis',
    supportIssues: 'issue',
    supportPolicy: 'policy',
    environmentalAdjustments: '',
    concreteApproaches: 'approach',
    appliedFrom: '2026-03-01',
    nextReviewAt: null,
    supportStartDate: null,
    monitoringCycleDays: 90,
    authoredByStaffId: '',
    authoredByQualification: 'unknown',
    authoredAt: null,
    applicableServiceType: 'other',
    applicableAddOnTypes: ['none'],
    deliveredToUserAt: null,
    reviewedAt: null,
    hasMedicalCoordination: false,
    hasEducationCoordination: false,
    regulatoryBasisSnapshot: {
      supportLevel: null,
      behaviorScore: null,
      serviceType: null,
      eligibilityCheckedAt: null,
    },
    status: 'active',
    isCurrent: true,
    intake: {
      presentingProblem: '',
      targetBehaviorsDraft: [],
      behaviorItemsTotal: null,
      incidentSummaryLast30d: '',
      communicationModes: [],
      sensoryTriggers: [],
      medicalFlags: [],
      consentScope: [],
      consentDate: null,
    },
    assessment: {
      targetBehaviors: [],
      abcEvents: [],
      hypotheses: [],
      riskLevel: 'low',
      healthFactors: [],
      teamConsensusNote: '',
    },
    planning: {
      supportPriorities: [],
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
      procedureSteps: [
        {
          order: 1,
          instruction: '手順1',
          staff: 'staff-1',
          timing: '09:00',
        },
      ],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    ...overrides,
  };
}

function makeProcedureRecord(
  overrides: Partial<ProcedureRecordListItem> = {},
): ProcedureRecordListItem {
  return {
    id: 'sp-record-1',
    userId: 'U-001',
    planningSheetId: 'sp-1',
    recordDate: '2026-03-20',
    timeSlot: '09:00',
    activity: '朝の支援',
    executionStatus: 'done',
    performedBy: 'staff-1',
    ...overrides,
  };
}

function makeBehaviorMonitoringRecord(
  overrides: Partial<BehaviorMonitoringRecord> = {},
): BehaviorMonitoringRecord {
  return {
    id: 'bm-1',
    userId: 'U-001',
    planningSheetId: 'sp-1',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-10',
    supportEvaluations: [],
    environmentFindings: [],
    effectiveSupports: '',
    difficultiesObserved: '',
    newTriggers: [],
    medicalSafetyNotes: '',
    userFeedback: '',
    familyFeedback: '',
    recommendedChanges: [],
    summary: '',
    recordedBy: 'staff-1',
    recordedAt: '2026-03-10T09:00:00+09:00',
    ...overrides,
  };
}

function makePlanningSheetReassessment(
  overrides: Partial<PlanningSheetReassessment> = {},
): PlanningSheetReassessment {
  return {
    id: 'reassess-1',
    planningSheetId: 'sp-1',
    reassessedAt: '2026-03-18',
    reassessedBy: 'staff-1',
    triggerType: 'monitoring',
    abcSummary: 'abc summary',
    hypothesisReview: 'hypothesis review',
    procedureEffectiveness: 'procedure effectiveness',
    environmentChange: 'environment change',
    planChangeDecision: 'major_revision',
    nextReassessmentAt: '2026-06-16',
    notes: '',
    ...overrides,
  };
}

function createPlanningSheetRepository(
  sheet: SupportPlanningSheet,
): PlanningSheetRepository {
  return {
    getById: vi.fn(async (id: string) => (id === sheet.id ? sheet : null)),
    listCurrentByUser: vi.fn(async () => [
      {
        id: sheet.id,
        userId: sheet.userId,
        ispId: sheet.ispId,
        title: sheet.title,
        targetScene: sheet.targetScene,
        status: sheet.status,
        nextReviewAt: sheet.nextReviewAt,
        isCurrent: sheet.isCurrent,
        applicableServiceType: sheet.applicableServiceType,
        applicableAddOnTypes: sheet.applicableAddOnTypes,
        authoredByQualification: sheet.authoredByQualification,
        reviewedAt: sheet.reviewedAt,
      },
    ]),
    listByIsp: vi.fn(async () => []),
    listByUser: vi.fn(async () => []),
    listBySeries: vi.fn(async () => []),
    create: vi.fn(async () => sheet),
    update: vi.fn(async () => sheet),
  };
}

function createProcedureRecordRepository(
  records: ProcedureRecordListItem[],
): ProcedureRecordRepository {
  return {
    getById: vi.fn(async () => null),
    listByPlanningSheet: vi.fn(async () => records),
    listByUserAndDate: vi.fn(async () => []),
    create: vi.fn(async () => {
      throw new Error('not implemented');
    }),
    update: vi.fn(async () => {
      throw new Error('not implemented');
    }),
  };
}

describe('usePdcaCycleState helpers', () => {
  it('executionStatus を ExecutionRecord status に正規化する', () => {
    expect(mapExecutionStatusToRecordStatus('done')).toBe('completed');
    expect(mapExecutionStatusToRecordStatus('partially_done')).toBe('triggered');
    expect(mapExecutionStatusToRecordStatus('skipped')).toBe('skipped');
    expect(mapExecutionStatusToRecordStatus('planned')).toBe('unrecorded');
  });

  it('procedure records を execution records に変換する', () => {
    const records = toExecutionRecords('U-001', [makeProcedureRecord()]);

    expect(records).toHaveLength(1);
    expect(records[0].scheduleItemId).toBe('09:00|朝の支援');
    expect(records[0].status).toBe('completed');
  });

  it('behavior monitoring は planningSheet 一致を優先して最新日を返す', () => {
    const latest = pickLatestBehaviorMonitoringAt(
      [
        makeBehaviorMonitoringRecord({
          id: 'bm-1',
          planningSheetId: 'sp-1',
          periodEnd: '2026-03-10',
          recordedAt: '2026-03-10T09:00:00+09:00',
        }),
        makeBehaviorMonitoringRecord({
          id: 'bm-2',
          planningSheetId: 'sp-2',
          periodEnd: '2026-03-20',
          recordedAt: '2026-03-20T09:00:00+09:00',
        }),
      ],
      'sp-1',
    );

    expect(latest).toBe('2026-03-10');
  });

  it('SupportPlanningSheet を WorkflowPhase 判定用に変換する', () => {
    const snapshot = toWorkflowSnapshot(
      makePlanningSheet({
        planning: {
          supportPriorities: [],
          antecedentStrategies: [],
          teachingStrategies: [],
          consequenceStrategies: [],
          procedureSteps: [],
          crisisThresholds: null,
          restraintPolicy: 'prohibited_except_emergency',
          reviewCycleDays: 180,
        },
      }),
    );

    expect(snapshot.id).toBe('sp-1');
    expect(snapshot.procedureCount).toBe(0);
    expect(snapshot.status).toBe('active');
  });
});

describe('usePdcaCycleState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlanningSheetRepositories.mockReturnValue({});
    mockUseProcedureRecordRepository.mockReturnValue({});
  });

  it('BehaviorMonitoringRecord 供給で Check 完了日が更新される', async () => {
    const sheet = makePlanningSheet();
    const repositories = {
      planningSheetRepository: createPlanningSheetRepository(sheet),
      procedureRecordRepository: createProcedureRecordRepository([
        makeProcedureRecord(),
      ]),
    };

    const initialProps: UsePdcaCycleStateParams = {
      userId: 'U-001',
      planningSheetId: sheet.id,
      referenceDate: '2026-03-20',
      behaviorMonitoringRecords: [],
      planningSheetReassessments: [],
      repositories,
    };

    const { result, rerender } = renderHook(
      (
        props: UsePdcaCycleStateParams,
      ) => usePdcaCycleState(props),
      {
        initialProps,
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state?.currentPhase).toBe('do');
    expect(result.current.state?.phaseCompletions.check).toBeNull();

    rerender({
      userId: 'U-001',
      planningSheetId: sheet.id,
      referenceDate: '2026-03-20',
      behaviorMonitoringRecords: [
        makeBehaviorMonitoringRecord({
          periodEnd: '2026-03-19',
          recordedAt: '2026-03-19T08:30:00+09:00',
        }),
      ],
      planningSheetReassessments: [],
      repositories,
    });

    await waitFor(() => {
      expect(result.current.state?.phaseCompletions.check).toBe('2026-03-19');
    });
  });

  it('PlanningSheetReassessment 供給で Act 状態へ遷移する', async () => {
    const sheet = makePlanningSheet();
    const repositories = {
      planningSheetRepository: createPlanningSheetRepository(sheet),
      procedureRecordRepository: createProcedureRecordRepository([
        makeProcedureRecord(),
      ]),
    };

    const initialProps: UsePdcaCycleStateParams = {
      userId: 'U-001',
      planningSheetId: sheet.id,
      referenceDate: '2026-03-20',
      behaviorMonitoringRecords: [],
      planningSheetReassessments: [],
      repositories,
    };

    const { result, rerender } = renderHook(
      (
        props: UsePdcaCycleStateParams,
      ) => usePdcaCycleState(props),
      {
        initialProps,
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state?.currentPhase).toBe('do');
    expect(result.current.state?.cycleNumber).toBe(1);

    rerender({
      userId: 'U-001',
      planningSheetId: sheet.id,
      referenceDate: '2026-03-20',
      behaviorMonitoringRecords: [],
      planningSheetReassessments: [makePlanningSheetReassessment()],
      repositories,
    });

    await waitFor(() => {
      expect(result.current.state?.currentPhase).toBe('act');
    });

    expect(result.current.state?.phaseCompletions.act).toBe('2026-03-18');
    expect(result.current.state?.cycleNumber).toBe(2);
  });

  it('明示的な空配列フォールバックでも従来通り動く（MonitoringMeeting不要）', async () => {
    const sheet = makePlanningSheet();
    const repositories = {
      planningSheetRepository: createPlanningSheetRepository(sheet),
      procedureRecordRepository: createProcedureRecordRepository([
        makeProcedureRecord(),
      ]),
    };

    const { result } = renderHook(() =>
      usePdcaCycleState({
        userId: 'U-001',
        planningSheetId: sheet.id,
        referenceDate: '2026-03-20',
        behaviorMonitoringRecords: [],
        planningSheetReassessments: [],
        repositories,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.currentPhase).toBe('do');
    expect(result.current.state?.phaseCompletions.check).toBeNull();
    expect(result.current.state?.phaseCompletions.act).toBeNull();
  });
});
