import {
  planningDesignSchema,
  supportPlanningSheetSchema,
  type PlanningDesign,
  type SupportPlanningSheet,
} from '@/domain/isp/schema';

type SupportPlanningSheetOverrides =
  Partial<Omit<
    SupportPlanningSheet,
    'intake' | 'assessment' | 'planning' | 'regulatoryBasisSnapshot'
  >> & {
    intake?: Partial<SupportPlanningSheet['intake']>;
    assessment?: Partial<SupportPlanningSheet['assessment']>;
    planning?: Partial<SupportPlanningSheet['planning']>;
    regulatoryBasisSnapshot?: Partial<SupportPlanningSheet['regulatoryBasisSnapshot']>;
  };

export function makePlanningDesign(overrides: Partial<PlanningDesign> = {}): PlanningDesign {
  return planningDesignSchema.parse(overrides);
}

export function makeSupportPlanningSheet(
  overrides: SupportPlanningSheetOverrides = {},
): SupportPlanningSheet {
  return supportPlanningSheetSchema.parse({
    id: 'sheet-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'tester',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'tester',
    version: 1,
    userId: 'U-001',
    ispId: 'ISP-001',
    title: '支援計画シート',
    targetScene: '',
    targetDomain: '',
    observationFacts: '観察記録',
    collectedInformation: '',
    interpretationHypothesis: '仮説',
    supportIssues: '課題',
    supportPolicy: '方針',
    environmentalAdjustments: '',
    concreteApproaches: '具体策',
    appliedFrom: null,
    nextReviewAt: null,
    supportStartDate: null,
    monitoringCycleDays: 90,
    evaluationIndicator: '',
    evaluationPeriod: '',
    evaluationMethod: '',
    improvementResult: '',
    nextSupport: '',
    monitoringEvidenceLinks: [],
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
    status: 'draft',
    isCurrent: true,
    intake: {},
    assessment: {},
    planning: {},
    ...overrides,
  });
}
