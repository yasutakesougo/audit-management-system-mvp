import { describe, expect, it } from 'vitest';
import type { SupportPlanningSheet, ProcedureStep } from '@/domain/isp/schema';
import {
  applyPlanPatch,
  detectPlanNeedsUpdate,
  generatePlanPatch,
  isPlanPatchOverdue,
  validatePlanPatch,
  type MeetingDecision,
  type PlanPatch,
} from '../planPatch';

function makeSheet(overrides: Partial<SupportPlanningSheet> = {}): SupportPlanningSheet {
  return {
    id: 'sheet-1',
    version: 1,
    userId: 'U001',
    ispId: 'ISP001',
    title: '支援計画シート',
    targetScene: '',
    targetDomain: '',
    observationFacts: '観察',
    collectedInformation: '',
    interpretationHypothesis: '仮説',
    supportIssues: '既存課題',
    supportPolicy: '既存方針',
    environmentalAdjustments: '',
    concreteApproaches: '既存具体策',
    appliedFrom: null,
    nextReviewAt: '2026-06-01',
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
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    createdBy: 'tester',
    updatedBy: 'tester',
    ...overrides,
  };
}

function makeDecision(overrides: Partial<MeetingDecision> = {}): MeetingDecision {
  return {
    id: 'meeting-1',
    planningSheetId: 'sheet-1',
    planChangeDecision: 'major_revision',
    changeReason: '支援方針の見直しが必要',
    discussionSummary: '会議で新しい対応方針を協議した',
    issueSummary: '午後の不穏が増えている',
    effectiveSupportSummary: '静養室での切り替え支援は有効',
    nextActions: ['午後活動前に休憩を入れる'],
    requiresPlanSheetUpdate: true,
    meetingDate: '2026-04-12',
    nextMonitoringDate: '2026-07-12',
    ...overrides,
  };
}

describe('planPatch', () => {
  it('generatePlanPatch creates pending plan patch from meeting decision', () => {
    const patch = generatePlanPatch(makeDecision(), makeSheet());

    expect(patch).not.toBeNull();
    expect(patch?.target).toBe('plan');
    expect(patch?.status).toBe('needs_update');
    expect(patch?.baseVersion).toBe('1');
    expect(patch?.dueAt).toBe('2026-07-12');
    expect(patch?.after.status).toBe('revision_pending');
    expect(patch?.evidenceIds).toEqual(['meeting-1']);
  });

  it('generatePlanPatch returns null when no plan change is required', () => {
    const patch = generatePlanPatch(
      makeDecision({ planChangeDecision: 'no_change', requiresPlanSheetUpdate: false }),
      makeSheet(),
    );

    expect(patch).toBeNull();
  });

  it('applyPlanPatch merges plan patch fields into current plan', () => {
    const patch = generatePlanPatch(makeDecision(), makeSheet());
    expect(patch).not.toBeNull();

    const updated = applyPlanPatch(patch as PlanPatch, makeSheet());

    expect(updated.status).toBe('revision_pending');
    expect(updated.reviewedAt).toBe('2026-04-12');
    expect(updated.supportIssues).toContain('午後の不穏');
  });

  it('applyPlanPatch replaces procedure steps for procedure target', () => {
    const patch: PlanPatch = {
      id: 'patch-2',
      planningSheetId: 'sheet-1',
      baseVersion: '1',
      target: 'procedure',
      before: [],
      after: [{ order: 1, instruction: '静養室でスケジュール確認', staff: 'A', timing: '09:00' }] satisfies ProcedureStep[],
      reason: '手順変更',
      evidenceIds: ['meeting-1'],
      status: 'review',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    };

    const updated = applyPlanPatch(patch, makeSheet());

    expect(updated.planning.procedureSteps).toHaveLength(1);
    expect(updated.planning.procedureSteps[0]?.instruction).toContain('スケジュール確認');
  });

  it('validatePlanPatch returns return when evidence is missing', () => {
    const patch = generatePlanPatch(makeDecision(), makeSheet()) as PlanPatch;
    const invalid: PlanPatch = { ...patch, evidenceIds: [] };

    expect(validatePlanPatch(invalid)).toBe('return');
  });

  it('applyPlanPatch throws on version conflict', () => {
    const patch = generatePlanPatch(makeDecision(), makeSheet()) as PlanPatch;

    expect(() => applyPlanPatch(patch, makeSheet({ version: 2 }))).toThrow('VERSION_CONFLICT');
  });

  it('detectPlanNeedsUpdate returns true while unconfirmed patch exists', () => {
    const patch = generatePlanPatch(makeDecision(), makeSheet());
    expect(detectPlanNeedsUpdate(patch ? [patch] : [])).toBe(true);
  });

  it('isPlanPatchOverdue returns true when dueAt is past the reference date', () => {
    const patch = generatePlanPatch(
      makeDecision({ nextMonitoringDate: '2026-04-10' }),
      makeSheet(),
    ) as PlanPatch;

    expect(isPlanPatchOverdue(patch, '2026-04-12')).toBe(true);
  });
});
