import { describe, expect, it } from 'vitest';

import type {
  PlanningSheetCreateInput,
  PlanningSheetRepository,
  PlanningSheetUpdateInput,
} from '@/domain/isp/port';
import type {
  PlanningSheetListItem,
  SupportPlanningSheet,
} from '@/domain/isp/schema';
import {
  activatePlanningSheetVersionInRepository,
  archivePlanningSheetVersionInRepository,
  createPlanningSheetRevision,
  getCurrentOrLatestPlanningSheet,
} from '../planningSheetVersionWorkflow';

function makeSheet(overrides: Partial<SupportPlanningSheet>): SupportPlanningSheet {
  return {
    id: 'sp-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
    version: 1,
    userId: 'U-001',
    ispId: 'ISP-001',
    title: '支援計画シート',
    targetScene: '',
    targetDomain: '',
    observationFacts: 'obs',
    collectedInformation: '',
    interpretationHypothesis: 'hyp',
    supportIssues: 'issues',
    supportPolicy: 'policy',
    environmentalAdjustments: '',
    concreteApproaches: 'approaches',
    appliedFrom: '2026-01-01',
    nextReviewAt: '2026-04-01',
    supportStartDate: '2026-01-01',
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
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    ...overrides,
  };
}

function toListItem(sheet: SupportPlanningSheet): PlanningSheetListItem {
  return {
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
  };
}

class InMemoryPlanningSheetRepository implements PlanningSheetRepository {
  public createInputs: PlanningSheetCreateInput[] = [];
  public updateInputs: Array<{ id: string; input: PlanningSheetUpdateInput }> = [];
  private nextId = 100;

  constructor(private readonly sheets: SupportPlanningSheet[]) {}

  async getById(id: string): Promise<SupportPlanningSheet | null> {
    return this.sheets.find((sheet) => sheet.id === id) ?? null;
  }

  async listByIsp(ispId: string): Promise<PlanningSheetListItem[]> {
    return this.sheets
      .filter((sheet) => sheet.ispId === ispId)
      .map(toListItem);
  }

  async listByUser(userId: string): Promise<PlanningSheetListItem[]> {
    return this.sheets
      .filter((sheet) => sheet.userId === userId)
      .sort((a, b) => b.version - a.version)
      .map(toListItem);
  }

  async listCurrentByUser(userId: string): Promise<PlanningSheetListItem[]> {
    return this.sheets
      .filter((sheet) => sheet.userId === userId && sheet.isCurrent)
      .sort((a, b) => b.version - a.version)
      .map(toListItem);
  }

  async listBySeries(userId: string, ispId: string): Promise<SupportPlanningSheet[]> {
    return this.sheets.filter(
      (sheet) => sheet.userId === userId && sheet.ispId === ispId,
    );
  }

  async create(input: PlanningSheetCreateInput): Promise<SupportPlanningSheet> {
    this.createInputs.push(input);
    const id = `sp-${this.nextId++}`;
    const sheet = makeSheet({
      id,
      userId: input.userId,
      ispId: input.ispId,
      title: input.title,
      targetScene: input.targetScene,
      targetDomain: input.targetDomain,
      observationFacts: input.observationFacts,
      collectedInformation: input.collectedInformation,
      interpretationHypothesis: input.interpretationHypothesis,
      supportIssues: input.supportIssues,
      supportPolicy: input.supportPolicy,
      environmentalAdjustments: input.environmentalAdjustments,
      concreteApproaches: input.concreteApproaches,
      appliedFrom: input.appliedFrom ?? null,
      nextReviewAt: input.nextReviewAt ?? null,
      supportStartDate: input.supportStartDate ?? null,
      monitoringCycleDays: input.monitoringCycleDays ?? 90,
      authoredByStaffId: input.authoredByStaffId ?? '',
      authoredByQualification: input.authoredByQualification ?? 'unknown',
      authoredAt: input.authoredAt ?? null,
      applicableServiceType: input.applicableServiceType ?? 'other',
      applicableAddOnTypes: input.applicableAddOnTypes ?? ['none'],
      deliveredToUserAt: input.deliveredToUserAt ?? null,
      reviewedAt: input.reviewedAt ?? null,
      hasMedicalCoordination: input.hasMedicalCoordination ?? false,
      hasEducationCoordination: input.hasEducationCoordination ?? false,
      status: input.status ?? 'draft',
      version: input.version ?? 1,
      isCurrent: input.isCurrent ?? true,
      regulatoryBasisSnapshot: input.regulatoryBasisSnapshot ?? {
        supportLevel: null,
        behaviorScore: null,
        serviceType: null,
        eligibilityCheckedAt: null,
      },
      intake: input.intake ?? makeSheet({}).intake,
      assessment: input.assessment ?? makeSheet({}).assessment,
      planning: input.planning ?? makeSheet({}).planning,
    });
    this.sheets.push(sheet);
    return sheet;
  }

  async update(id: string, input: PlanningSheetUpdateInput): Promise<SupportPlanningSheet> {
    this.updateInputs.push({ id, input });
    const index = this.sheets.findIndex((sheet) => sheet.id === id);
    if (index < 0) {
      throw new Error(`not found: ${id}`);
    }
    const current = this.sheets[index];
    const updated = makeSheet({
      ...current,
      ...input,
      id: current.id,
      version: input.version ?? current.version,
      isCurrent: input.isCurrent ?? current.isCurrent,
    });
    this.sheets[index] = updated;
    return updated;
  }
}

describe('planningSheetVersionWorkflow', () => {
  it('prefers current sheet when resolving current or latest', async () => {
    const repo = new InMemoryPlanningSheetRepository([
      makeSheet({ id: 'sp-1', userId: 'U-001', version: 1, status: 'archived', isCurrent: false }),
      makeSheet({ id: 'sp-2', userId: 'U-001', version: 2, status: 'active', isCurrent: true }),
    ]);

    const sheet = await getCurrentOrLatestPlanningSheet(repo, 'U-001');
    expect(sheet?.id).toBe('sp-2');
  });

  it('falls back to latest version when current sheet does not exist', async () => {
    const repo = new InMemoryPlanningSheetRepository([
      makeSheet({ id: 'sp-1', userId: 'U-001', version: 1, isCurrent: false, status: 'archived' }),
      makeSheet({ id: 'sp-2', userId: 'U-001', version: 2, isCurrent: false, status: 'draft' }),
    ]);

    const sheet = await getCurrentOrLatestPlanningSheet(repo, 'U-001');
    expect(sheet?.id).toBe('sp-2');
  });

  it('creates revision draft with incremented version and non-current status', async () => {
    const repo = new InMemoryPlanningSheetRepository([
      makeSheet({ id: 'sp-10', version: 2, isCurrent: true, status: 'active' }),
    ]);

    const created = await createPlanningSheetRevision(repo, 'sp-10', {
      changeReason: 'monitoring',
      changedBy: 'staff-1',
    });

    expect(created.version).toBe(3);
    expect(created.status).toBe('draft');
    expect(created.isCurrent).toBe(false);
    expect(repo.createInputs[0].version).toBe(3);
    expect(repo.createInputs[0].isCurrent).toBe(false);
  });

  it('activates target version and archives previous active version', async () => {
    const repo = new InMemoryPlanningSheetRepository([
      makeSheet({ id: 'sp-20', version: 1, status: 'active', isCurrent: true }),
      makeSheet({ id: 'sp-21', version: 2, status: 'draft', isCurrent: false }),
    ]);

    const updated = await activatePlanningSheetVersionInRepository(repo, 'sp-21', {
      activatedBy: 'staff-1',
      appliedFrom: '2026-05-01',
    });

    const v1 = updated.find((sheet) => sheet.id === 'sp-20');
    const v2 = updated.find((sheet) => sheet.id === 'sp-21');

    expect(v1?.status).toBe('archived');
    expect(v1?.isCurrent).toBe(false);
    expect(v2?.status).toBe('active');
    expect(v2?.isCurrent).toBe(true);
  });

  it('archives selected version through repository update', async () => {
    const repo = new InMemoryPlanningSheetRepository([
      makeSheet({ id: 'sp-30', status: 'draft', isCurrent: false }),
    ]);

    const archived = await archivePlanningSheetVersionInRepository(repo, 'sp-30', {
      archivedBy: 'staff-1',
    });

    expect(archived.status).toBe('archived');
    expect(archived.isCurrent).toBe(false);
    expect(repo.updateInputs).toHaveLength(1);
    expect(repo.updateInputs[0].id).toBe('sp-30');
    expect(repo.updateInputs[0].input.status).toBe('archived');
  });
});
