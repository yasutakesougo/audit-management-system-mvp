import { describe, expect, it } from 'vitest';

import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { buildShadowSpsHistory, toShadowSps } from '../spsShadowAdapter';

function makeSheet(overrides: Partial<SupportPlanningSheet>): SupportPlanningSheet {
  return {
    id: 'sp-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedAt: '2026-01-10T00:00:00.000Z',
    updatedBy: 'system',
    version: 1,
    userId: 'U-001',
    ispId: 'ISP-001',
    title: '支援計画シート',
    targetScene: '',
    targetDomain: '',
    observationFacts: '行動観察1\n行動観察2',
    collectedInformation: '',
    interpretationHypothesis: '背景仮説',
    supportIssues: '支援課題',
    supportPolicy: '方針',
    environmentalAdjustments: '環境調整A',
    concreteApproaches: '具体策',
    appliedFrom: '2026-01-01',
    nextReviewAt: '2026-04-01',
    supportStartDate: '2026-01-01',
    monitoringCycleDays: 90,
    authoredByStaffId: '100',
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
      supportPriorities: ['穏やかな環境'],
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

describe('spsShadowAdapter', () => {
  it('maps support planning sheet to shadow SPS model', () => {
    const shadow = toShadowSps(makeSheet({}), 999);

    expect(shadow.id).toBe('sp-1');
    expect(shadow.userId).toBe(999);
    expect(shadow.version).toBe('v1');
    expect(shadow.status).toBe('confirmed');
    expect(shadow.confirmedBy).toBe(100);
    expect(shadow.icebergModel.observableBehaviors).toContain('行動観察1');
    expect(shadow.positiveConditions).toContain('穏やかな環境');
  });

  it('builds history entries from non-current series versions', () => {
    const current = makeSheet({ id: 'sp-2', version: 2, status: 'active', isCurrent: true });
    const previous = makeSheet({ id: 'sp-1', version: 1, status: 'archived', isCurrent: false });

    const history = buildShadowSpsHistory([current, previous], current.id, 999);

    expect(history).toHaveLength(1);
    expect(history[0].spsId).toBe('sp-2');
    expect(history[0].version).toBe('v1');
    expect(history[0].revisionReason).toContain('アーカイブ');
  });
});
