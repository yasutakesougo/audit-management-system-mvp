// ---------------------------------------------------------------------------
// P0-3 適正化運用 — Domain 型のユニットテスト
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeCommitteeSummary,
  fromDraftToCommitteeRecord,
  createEmptyCommitteeDraft,
  type CommitteeMeetingRecord,
} from '../complianceCommittee';
import {
  computeGuidelineSummary,
  fromDraftToGuidelineVersion,
  createEmptyGuidelineDraft,
  countFulfilledRequiredItems,
  allRequiredItemsFulfilled,
  TOTAL_REQUIRED_ITEMS,
  type GuidelineVersion,
  type GuidelineRequiredItems,
} from '../guidelineVersion';
import {
  computeTrainingSummary,
  fromDraftToTrainingRecord,
  createEmptyTrainingDraft,
  computeAttendanceRate,
  computeAverageComprehension,
  type TrainingRecord,
  type TrainingParticipant,
} from '../trainingRecord';

// ─── helpers ──────────────────────────────────────────

function makeCommitteeRecord(
  overrides: Partial<CommitteeMeetingRecord> = {},
): CommitteeMeetingRecord {
  return {
    id: 'cmte_test',
    meetingDate: '2026-01-15',
    committeeType: '定期開催',
    agenda: 'テスト議題',
    attendees: [],
    summary: 'テスト概要',
    decisions: 'テスト決定事項',
    issues: 'テスト課題',
    restraintDiscussed: false,
    restraintDiscussionDetail: '',
    recordedBy: 'staff_1',
    recordedAt: '2026-01-15T10:00:00Z',
    status: 'finalized',
    ...overrides,
  };
}

function makeGuidelineVersion(
  overrides: Partial<GuidelineVersion> = {},
): GuidelineVersion {
  return {
    id: 'gl_test',
    version: '1.0',
    title: '身体拘束等適正化のための指針',
    content: 'テスト内容',
    changeType: '新規策定',
    changeReason: '',
    requiredItems: {
      procedureForRestraint: false,
      organizationalStructure: false,
      staffTrainingPolicy: false,
      reportingProcedure: false,
      threeRequirementsVerification: false,
      userExplanationMethod: false,
      reviewReleaseProcess: false,
    },
    effectiveDate: '2026-04-01',
    status: 'active',
    createdBy: 'staff_1',
    createdAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function makeTrainingRecord(
  overrides: Partial<TrainingRecord> = {},
): TrainingRecord {
  return {
    id: 'trn_test',
    title: '身体拘束等適正化研修',
    trainingType: '身体拘束等適正化研修',
    format: '集合研修',
    trainingDate: '2026-01-20',
    durationMinutes: 120,
    description: 'テスト研修',
    materials: 'テスト資料',
    instructor: '山田太郎',
    participants: [],
    achievementNotes: '',
    improvementNotes: '',
    recordedBy: 'staff_1',
    recordedAt: '2026-01-20T10:00:00Z',
    status: 'completed',
    ...overrides,
  };
}

// ─── Committee ────────────────────────────────────────

describe('complianceCommittee', () => {
  describe('createEmptyCommitteeDraft', () => {
    it('returns draft with defaults', () => {
      const draft = createEmptyCommitteeDraft('staff_1');
      expect(draft.recordedBy).toBe('staff_1');
      expect(draft.committeeType).toBe('定期開催');
      expect(draft.restraintDiscussed).toBe(false);
    });
  });

  describe('fromDraftToCommitteeRecord', () => {
    it('converts draft to record with status=draft', () => {
      const draft = createEmptyCommitteeDraft('staff_1');
      const record = fromDraftToCommitteeRecord('cmte_1', draft);
      expect(record.id).toBe('cmte_1');
      expect(record.status).toBe('draft');
      expect(record.recordedAt).toBeTruthy();
    });
  });

  describe('computeCommitteeSummary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns empty summary for no records', () => {
      const summary = computeCommitteeSummary([]);
      expect(summary.totalMeetings).toBe(0);
      expect(summary.meetsQuarterlyRequirement).toBe(false);
      expect(summary.lastMeetingDate).toBeNull();
    });

    it('counts fiscal year meetings correctly', () => {
      // 4月から始まる年度で4回以上開催
      const records = [
        makeCommitteeRecord({ id: '1', meetingDate: '2025-04-15' }),
        makeCommitteeRecord({ id: '2', meetingDate: '2025-07-15' }),
        makeCommitteeRecord({ id: '3', meetingDate: '2025-10-15' }),
        makeCommitteeRecord({ id: '4', meetingDate: '2026-01-15' }),
      ];
      const summary = computeCommitteeSummary(records);
      expect(summary.totalMeetings).toBe(4);
      expect(summary.currentFiscalYearMeetings).toBe(4);
      expect(summary.meetsQuarterlyRequirement).toBe(true);
    });

    it('calculates restraint discussion rate', () => {
      const records = [
        makeCommitteeRecord({ id: '1', restraintDiscussed: true }),
        makeCommitteeRecord({ id: '2', restraintDiscussed: true }),
        makeCommitteeRecord({ id: '3', restraintDiscussed: false }),
      ];
      const summary = computeCommitteeSummary(records);
      expect(summary.restraintDiscussionRate).toBe(67);
    });

    it('computes next recommended date as +3 months', () => {
      const records = [
        makeCommitteeRecord({ id: '1', meetingDate: '2026-01-15' }),
      ];
      const summary = computeCommitteeSummary(records);
      expect(summary.nextRecommendedDate).toBe('2026-04-15');
    });
  });
});

// ─── Guideline ────────────────────────────────────────

describe('guidelineVersion', () => {
  describe('createEmptyGuidelineDraft', () => {
    it('returns draft with defaults', () => {
      const draft = createEmptyGuidelineDraft('staff_1');
      expect(draft.createdBy).toBe('staff_1');
      expect(draft.version).toBe('1.0');
      expect(draft.changeType).toBe('新規策定');
    });
  });

  describe('fromDraftToGuidelineVersion', () => {
    it('converts draft to version with status=draft', () => {
      const draft = createEmptyGuidelineDraft('staff_1');
      const version = fromDraftToGuidelineVersion('gl_1', draft);
      expect(version.id).toBe('gl_1');
      expect(version.status).toBe('draft');
    });
  });

  describe('countFulfilledRequiredItems', () => {
    it('returns 0 when none fulfilled', () => {
      const items: GuidelineRequiredItems = {
        procedureForRestraint: false,
        organizationalStructure: false,
        staffTrainingPolicy: false,
        reportingProcedure: false,
        threeRequirementsVerification: false,
        userExplanationMethod: false,
        reviewReleaseProcess: false,
      };
      expect(countFulfilledRequiredItems(items)).toBe(0);
    });

    it('returns correct count when some fulfilled', () => {
      const items: GuidelineRequiredItems = {
        procedureForRestraint: true,
        organizationalStructure: true,
        staffTrainingPolicy: true,
        reportingProcedure: false,
        threeRequirementsVerification: false,
        userExplanationMethod: false,
        reviewReleaseProcess: false,
      };
      expect(countFulfilledRequiredItems(items)).toBe(3);
    });

    it('returns TOTAL_REQUIRED_ITEMS when all fulfilled', () => {
      const items: GuidelineRequiredItems = {
        procedureForRestraint: true,
        organizationalStructure: true,
        staffTrainingPolicy: true,
        reportingProcedure: true,
        threeRequirementsVerification: true,
        userExplanationMethod: true,
        reviewReleaseProcess: true,
      };
      expect(countFulfilledRequiredItems(items)).toBe(TOTAL_REQUIRED_ITEMS);
      expect(allRequiredItemsFulfilled(items)).toBe(true);
    });
  });

  describe('computeGuidelineSummary', () => {
    it('returns empty summary for no versions', () => {
      const summary = computeGuidelineSummary([]);
      expect(summary.totalVersions).toBe(0);
      expect(summary.currentVersion).toBeNull();
      expect(summary.allItemsFulfilled).toBe(false);
    });

    it('identifies current active version', () => {
      const versions = [
        makeGuidelineVersion({
          id: '1',
          version: '1.0',
          effectiveDate: '2025-04-01',
          status: 'archived',
        }),
        makeGuidelineVersion({
          id: '2',
          version: '2.0',
          effectiveDate: '2026-04-01',
          status: 'active',
          requiredItems: {
            procedureForRestraint: true,
            organizationalStructure: true,
            staffTrainingPolicy: true,
            reportingProcedure: true,
            threeRequirementsVerification: true,
            userExplanationMethod: true,
            reviewReleaseProcess: true,
          },
        }),
      ];
      const summary = computeGuidelineSummary(versions);
      expect(summary.currentVersion).toBe('2.0');
      expect(summary.currentFulfilledItems).toBe(7);
      expect(summary.currentFulfillmentRate).toBe(100);
      expect(summary.allItemsFulfilled).toBe(true);
    });
  });
});

// ─── Training ─────────────────────────────────────────

describe('trainingRecord', () => {
  describe('createEmptyTrainingDraft', () => {
    it('returns draft with defaults', () => {
      const draft = createEmptyTrainingDraft('staff_1');
      expect(draft.recordedBy).toBe('staff_1');
      expect(draft.trainingType).toBe('身体拘束等適正化研修');
      expect(draft.durationMinutes).toBe(60);
    });
  });

  describe('fromDraftToTrainingRecord', () => {
    it('converts draft to record with status=completed', () => {
      const draft = createEmptyTrainingDraft('staff_1');
      const record = fromDraftToTrainingRecord('trn_1', draft);
      expect(record.id).toBe('trn_1');
      expect(record.status).toBe('completed');
    });
  });

  describe('computeAttendanceRate', () => {
    it('returns 0 for empty participants', () => {
      expect(computeAttendanceRate([])).toBe(0);
    });

    it('calculates rate correctly', () => {
      const participants: TrainingParticipant[] = [
        { staffId: '1', staffName: 'A', attended: true },
        { staffId: '2', staffName: 'B', attended: true },
        { staffId: '3', staffName: 'C', attended: false },
      ];
      expect(computeAttendanceRate(participants)).toBe(67);
    });
  });

  describe('computeAverageComprehension', () => {
    it('returns 0 for no data', () => {
      expect(computeAverageComprehension([])).toBe(0);
    });

    it('calculates average correctly', () => {
      const participants: TrainingParticipant[] = [
        { staffId: '1', staffName: 'A', attended: true, comprehensionLevel: 4 },
        { staffId: '2', staffName: 'B', attended: true, comprehensionLevel: 5 },
        { staffId: '3', staffName: 'C', attended: false, comprehensionLevel: 3 },
      ];
      // Only attended with levels: (4 + 5) / 2 = 4.5
      expect(computeAverageComprehension(participants)).toBe(4.5);
    });
  });

  describe('computeTrainingSummary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns empty summary for no records', () => {
      const summary = computeTrainingSummary([]);
      expect(summary.totalTrainings).toBe(0);
      expect(summary.meetsBiannualRequirement).toBe(false);
    });

    it('counts fiscal year trainings correctly', () => {
      const records = [
        makeTrainingRecord({ id: '1', trainingDate: '2025-06-15' }),
        makeTrainingRecord({ id: '2', trainingDate: '2025-12-15' }),
        makeTrainingRecord({ id: '3', trainingDate: '2024-01-15' }), // 前年度
      ];
      const summary = computeTrainingSummary(records);
      expect(summary.totalTrainings).toBe(3);
      expect(summary.currentFiscalYearTrainings).toBe(2);
      expect(summary.meetsBiannualRequirement).toBe(true);
    });

    it('computes next recommended date as +6 months', () => {
      const records = [
        makeTrainingRecord({ id: '1', trainingDate: '2026-01-20' }),
      ];
      const summary = computeTrainingSummary(records);
      expect(summary.nextRecommendedDate).toBe('2026-07-20');
    });

    it('excludes cancelled records', () => {
      const records = [
        makeTrainingRecord({ id: '1', status: 'completed' }),
        makeTrainingRecord({ id: '2', status: 'cancelled' }),
      ];
      const summary = computeTrainingSummary(records);
      expect(summary.totalTrainings).toBe(1);
    });
  });
});
