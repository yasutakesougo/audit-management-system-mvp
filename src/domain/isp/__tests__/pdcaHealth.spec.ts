import { describe, expect, it } from 'vitest';
import { buildPdcaHealthScore, calculatePdcaHealthScore } from '../pdcaHealth';
import type { ImprovementOutcome } from '../improvementOutcome';
import type { PlanPatchForPlan } from '../planPatch';
import type { MonitoringMeetingRecord } from '../monitoringMeeting';

function makePatch(overrides: Partial<PlanPatchForPlan> = {}): PlanPatchForPlan {
  return {
    id: 'patch-1',
    planningSheetId: 'sheet-1',
    baseVersion: '1',
    target: 'plan',
    before: {},
    after: { status: 'revision_pending' },
    reason: '計画更新',
    evidenceIds: ['meeting-1'],
    status: 'needs_update',
    dueAt: '2026-04-10',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMeeting(overrides: Partial<MonitoringMeetingRecord> = {}): MonitoringMeetingRecord {
  return {
    id: 'meeting-1',
    userId: 'U001',
    userName: '利用者A',
    planningSheetId: 'sheet-1',
    ispId: 'ISP001',
    meetingType: 'regular',
    meetingDate: '2026-04-01',
    venue: '相談室',
    attendees: [],
    goalEvaluations: [],
    overallAssessment: '',
    userFeedback: '',
    familyFeedback: '',
    issueSummary: '',
    effectiveSupportSummary: '',
    planChangeDecision: 'minor_revision',
    requiresPlanSheetUpdate: true,
    changeReason: '',
    decisions: [],
    nextActions: [],
    nextMonitoringDate: '2026-04-20',
    discussionSummary: '',
    recordedBy: 'tester',
    recordedAt: '2026-04-01T00:00:00.000Z',
    status: 'finalized',
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<ImprovementOutcome> = {}): ImprovementOutcome {
  return {
    id: 'outcome-1',
    planningSheetId: 'sheet-1',
    patchId: 'patch-1',
    observedAt: '2026-04-12',
    targetMetric: 'incident_count',
    source: 'manual_kpi',
    beforeValue: 5,
    afterValue: 2,
    changeRate: -0.6,
    isImproved: true,
    confidence: 'medium',
    createdAt: '2026-04-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('pdcaHealth', () => {
  it('calculates severity from overdue and pending counts', () => {
    expect(
      calculatePdcaHealthScore({
        pendingPatchCount: 1,
        overdueDays: 0,
        daysSinceLastMeeting: 1,
        evidenceCount: 1,
      }),
    ).toMatchObject({ severity: 'medium', baseScore: 13 });

    expect(
      calculatePdcaHealthScore({
        pendingPatchCount: 2,
        overdueDays: 4,
        daysSinceLastMeeting: 5,
        evidenceCount: 2,
      }),
    ).toMatchObject({ severity: 'high', baseScore: 52 });

    expect(
      calculatePdcaHealthScore({
        pendingPatchCount: 5,
        overdueDays: 1,
        daysSinceLastMeeting: 5,
        evidenceCount: 3,
      }),
    ).toMatchObject({ severity: 'critical', baseScore: 68 });
  });

  it('builds pdca health score from patches and meetings', () => {
    const result = buildPdcaHealthScore({
      planningSheetId: 'sheet-1',
      userId: 'U001',
      patches: [
        makePatch(),
        makePatch({ id: 'patch-2', evidenceIds: ['meeting-2', 'meeting-3'] }),
      ],
      meetings: [makeMeeting({ meetingDate: '2026-04-05' })],
      outcomes: [makeOutcome()],
      referenceDate: '2026-04-12',
    });

    expect(result).toMatchObject({
      planningSheetId: 'sheet-1',
      userId: 'U001',
      pendingPatchCount: 2,
      overdueDays: 2,
      daysSinceLastMeeting: 7,
      evidenceCount: 3,
      baseScore: 47,
      improvementSuccessRate: 1,
      improvementFactor: 1,
      score: 94,
      severity: 'medium',
    });
  });
});
