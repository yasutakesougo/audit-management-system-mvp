// ---------------------------------------------------------------------------
// physicalRestraint.spec.ts — ドメインロジックのユニットテスト
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  allThreeRequirementsMet,
  computeDurationMinutes,
  computeRestraintSummary,
  countMetRequirements,
  createEmptyRestraintDraft,
  fromDraftToRestraintRecord,
  type PhysicalRestraintRecord,
  type ThreeRequirements,
} from '../physicalRestraint';

describe('computeDurationMinutes', () => {
  it('should compute duration in minutes from start/end ISO strings', () => {
    const start = '2026-03-13T10:00:00.000Z';
    const end = '2026-03-13T10:45:00.000Z';
    expect(computeDurationMinutes(start, end)).toBe(45);
  });

  it('should return 0 when end is before start', () => {
    const start = '2026-03-13T11:00:00.000Z';
    const end = '2026-03-13T10:00:00.000Z';
    expect(computeDurationMinutes(start, end)).toBe(0);
  });

  it('should return 0 for invalid dates', () => {
    expect(computeDurationMinutes('invalid', '2026-03-13T10:00:00.000Z')).toBe(0);
    expect(computeDurationMinutes('2026-03-13T10:00:00.000Z', 'invalid')).toBe(0);
  });

  it('should handle same start and end', () => {
    const same = '2026-03-13T10:00:00.000Z';
    expect(computeDurationMinutes(same, same)).toBe(0);
  });

  it('should handle multi-hour durations', () => {
    const start = '2026-03-13T08:00:00.000Z';
    const end = '2026-03-13T10:30:00.000Z';
    expect(computeDurationMinutes(start, end)).toBe(150);
  });
});

describe('allThreeRequirementsMet', () => {
  it('should return true when all three are met', () => {
    const req: ThreeRequirements = {
      immediacy: true,
      immediacyReason: 'test',
      nonSubstitutability: true,
      nonSubstitutabilityReason: 'test',
      temporariness: true,
      temporarinessReason: 'test',
    };
    expect(allThreeRequirementsMet(req)).toBe(true);
  });

  it('should return false when any is missing', () => {
    const req: ThreeRequirements = {
      immediacy: true,
      immediacyReason: 'test',
      nonSubstitutability: false,
      nonSubstitutabilityReason: '',
      temporariness: true,
      temporarinessReason: 'test',
    };
    expect(allThreeRequirementsMet(req)).toBe(false);
  });

  it('should return false when none are met', () => {
    const req: ThreeRequirements = {
      immediacy: false,
      immediacyReason: '',
      nonSubstitutability: false,
      nonSubstitutabilityReason: '',
      temporariness: false,
      temporarinessReason: '',
    };
    expect(allThreeRequirementsMet(req)).toBe(false);
  });
});

describe('countMetRequirements', () => {
  it('should count 0 when none met', () => {
    const req: ThreeRequirements = {
      immediacy: false,
      immediacyReason: '',
      nonSubstitutability: false,
      nonSubstitutabilityReason: '',
      temporariness: false,
      temporarinessReason: '',
    };
    expect(countMetRequirements(req)).toBe(0);
  });

  it('should count 2 when two met', () => {
    const req: ThreeRequirements = {
      immediacy: true,
      immediacyReason: 'a',
      nonSubstitutability: false,
      nonSubstitutabilityReason: '',
      temporariness: true,
      temporarinessReason: 'b',
    };
    expect(countMetRequirements(req)).toBe(2);
  });
});

describe('createEmptyRestraintDraft', () => {
  it('should create a draft with userId', () => {
    const draft = createEmptyRestraintDraft('user-1');
    expect(draft.userId).toBe('user-1');
    expect(draft.performed).toBe(true);
    expect(draft.threeRequirements.immediacy).toBe(false);
  });

  it('should carry relatedIncidentId when provided', () => {
    const draft = createEmptyRestraintDraft('user-1', 'inc_123');
    expect(draft.relatedIncidentId).toBe('inc_123');
  });
});

describe('fromDraftToRestraintRecord', () => {
  it('should convert draft to record with computed duration', () => {
    const draft = createEmptyRestraintDraft('user-1');
    draft.startedAt = '2026-03-13T10:00:00.000Z';
    draft.endedAt = '2026-03-13T11:30:00.000Z';
    draft.reason = 'some reason';
    draft.recordedBy = '田中太郎';

    const record = fromDraftToRestraintRecord('rst_test', draft);
    expect(record.id).toBe('rst_test');
    expect(record.userId).toBe('user-1');
    expect(record.durationMinutes).toBe(90);
    expect(record.status).toBe('draft');
    expect(record.recordedBy).toBe('田中太郎');
  });
});

describe('computeRestraintSummary', () => {
  const baseRecord: PhysicalRestraintRecord = {
    id: 'rst_1',
    userId: 'user-1',
    performed: true,
    restraintType: 'その他',
    startedAt: new Date().toISOString(),
    endedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    durationMinutes: 60,
    threeRequirements: {
      immediacy: true,
      immediacyReason: 'test',
      nonSubstitutability: true,
      nonSubstitutabilityReason: 'test',
      temporariness: true,
      temporarinessReason: 'test',
    },
    reason: 'test',
    physicalMentalCondition: '',
    surroundingCondition: '',
    recordedBy: 'tester',
    recordedAt: new Date().toISOString(),
    status: 'approved',
  };

  it('should return empty summary for empty array', () => {
    const summary = computeRestraintSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.avgDurationMinutes).toBe(0);
  });

  it('should compute correct totals', () => {
    const records: PhysicalRestraintRecord[] = [
      { ...baseRecord, id: '1', status: 'approved' },
      { ...baseRecord, id: '2', status: 'submitted' },
      {
        ...baseRecord,
        id: '3',
        status: 'draft',
        threeRequirements: {
          ...baseRecord.threeRequirements,
          immediacy: false,
        },
      },
    ];
    const summary = computeRestraintSummary(records);
    expect(summary.total).toBe(3);
    expect(summary.pendingApproval).toBe(1);
    expect(summary.incompleteRequirements).toBe(1);
    expect(summary.byStatus.approved).toBe(1);
    expect(summary.byStatus.submitted).toBe(1);
  });

  it('should compute average duration', () => {
    const records: PhysicalRestraintRecord[] = [
      { ...baseRecord, id: '1', durationMinutes: 30 },
      { ...baseRecord, id: '2', durationMinutes: 90 },
    ];
    const summary = computeRestraintSummary(records);
    expect(summary.avgDurationMinutes).toBe(60);
  });
});
