// ---------------------------------------------------------------------------
// staffQualification.spec.ts — P4 研修・資格・観察のドメインテスト
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import type { StaffTrainingHistory } from '../staffTrainingHistory';
import {
  getCompletedTrainingTypes,
  getExpiredTrainings,
  getMissingCertificates,
} from '../staffTrainingHistory';

import type { QualificationAssignment } from '../qualificationAssignment';
import {
  isAssignmentActive,
  getActiveAssignments,
  getAssignmentsByUser,
} from '../qualificationAssignment';

import type { WeeklyObservationRecord } from '../weeklyObservation';
import {
  computeExpectedWeeks,
  evaluateObservationFulfillment,
  daysSinceLastObservation,
  computeStaffQualificationSummary,
  WEEKLY_OBSERVATION_FULFILLMENT_THRESHOLD,
} from '../weeklyObservation';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTraining(
  overrides: Partial<StaffTrainingHistory> = {},
): StaffTrainingHistory {
  return {
    id: 'trh-001',
    staffId: 'S001',
    staffName: '田中太郎',
    trainingType: 'practical_training',
    completedAt: '2025-04-01',
    certificateNumber: 'CERT-001',
    issuingOrganization: '東京都',
    registeredBy: '管理者',
    registeredAt: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<QualificationAssignment> = {},
): QualificationAssignment {
  return {
    id: 'asn-001',
    staffId: 'S001',
    staffName: '田中太郎',
    userId: 'U001',
    assignedFrom: '2026-01-01',
    assignmentType: 'primary',
    notes: '',
    registeredBy: '管理者',
    registeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeObservation(
  overrides: Partial<WeeklyObservationRecord> = {},
): WeeklyObservationRecord {
  return {
    id: 'obs-001',
    observerId: 'S002',
    observerName: '佐藤花子',
    targetStaffId: 'S001',
    targetStaffName: '田中太郎',
    userId: 'U001',
    observationDate: '2026-03-01',
    observationContent: '適切な支援実施',
    adviceContent: '声かけのタイミングを工夫',
    followUpActions: '翌週確認',
    recordedBy: '佐藤花子',
    recordedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

// =========================================================================
// StaffTrainingHistory
// =========================================================================

describe('getCompletedTrainingTypes', () => {
  it('should return unique training types', () => {
    const records = [
      makeTraining({ trainingType: 'practical_training' }),
      makeTraining({ id: 'trh-002', trainingType: 'basic_training' }),
      makeTraining({ id: 'trh-003', trainingType: 'practical_training' }),
    ];

    const types = getCompletedTrainingTypes(records);
    expect(types.size).toBe(2);
    expect(types.has('practical_training')).toBe(true);
    expect(types.has('basic_training')).toBe(true);
  });
});

describe('getExpiredTrainings', () => {
  it('should detect expired trainings', () => {
    const records = [
      makeTraining({ expiresAt: '2025-12-31' }),
      makeTraining({ id: 'trh-002', expiresAt: '2027-12-31' }),
      makeTraining({ id: 'trh-003' }), // no expiry
    ];

    const expired = getExpiredTrainings(records, '2026-06-01');
    expect(expired).toHaveLength(1);
    expect(expired[0].expiresAt).toBe('2025-12-31');
  });
});

describe('getMissingCertificates', () => {
  it('should detect when profile has flag but no certificate record', () => {
    const profileFlags = new Set<import('@/domain/isp/schema').StaffQualification>([
      'practical_training',
      'core_person_training',
    ]);
    const records = [
      makeTraining({ trainingType: 'practical_training' }),
    ];

    const missing = getMissingCertificates(profileFlags, records);
    expect(missing).toEqual(['core_person_training']);
  });

  it('should return empty when all certificates exist', () => {
    const profileFlags = new Set<import('@/domain/isp/schema').StaffQualification>([
      'practical_training',
    ]);
    const records = [
      makeTraining({ trainingType: 'practical_training' }),
    ];

    expect(getMissingCertificates(profileFlags, records)).toHaveLength(0);
  });
});

// =========================================================================
// QualificationAssignment
// =========================================================================

describe('isAssignmentActive', () => {
  it('should be active when no end date', () => {
    expect(isAssignmentActive(makeAssignment())).toBe(true);
  });

  it('should be active when end date is in the future', () => {
    expect(isAssignmentActive(
      makeAssignment({ assignedTo: '2027-12-31' }),
      '2026-06-01',
    )).toBe(true);
  });

  it('should be inactive when end date has passed', () => {
    expect(isAssignmentActive(
      makeAssignment({ assignedTo: '2026-01-01' }),
      '2026-06-01',
    )).toBe(false);
  });
});

describe('getActiveAssignments', () => {
  it('should filter to active assignments for a staff member', () => {
    const assignments = [
      makeAssignment({ id: '1', staffId: 'S001' }),
      makeAssignment({ id: '2', staffId: 'S001', assignedTo: '2025-12-31' }),
      makeAssignment({ id: '3', staffId: 'S002' }),
    ];

    const result = getActiveAssignments(assignments, 'S001', '2026-06-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getAssignmentsByUser', () => {
  it('should filter active assignments by user', () => {
    const assignments = [
      makeAssignment({ id: '1', userId: 'U001' }),
      makeAssignment({ id: '2', userId: 'U001', assignedTo: '2025-01-01' }),
      makeAssignment({ id: '3', userId: 'U002' }),
    ];

    const result = getAssignmentsByUser(assignments, 'U001', '2026-06-01');
    expect(result).toHaveLength(1);
  });
});

// =========================================================================
// WeeklyObservation
// =========================================================================

describe('computeExpectedWeeks', () => {
  it('should compute weeks between dates', () => {
    expect(computeExpectedWeeks('2026-01-01', '2026-03-01')).toBe(8); // ~59 days / 7
  });

  it('should return 0 when from >= to', () => {
    expect(computeExpectedWeeks('2026-03-01', '2026-01-01')).toBe(0);
  });

  it('should return at least 1 for small gaps', () => {
    expect(computeExpectedWeeks('2026-03-01', '2026-03-08')).toBe(1);
  });
});

describe('evaluateObservationFulfillment', () => {
  it('should be fulfilled when observations meet threshold', () => {
    const assignment = makeAssignment({ assignedFrom: '2026-01-01' });
    // 8 weeks expected, need 80% = 6.4 → 7
    const observations = Array.from({ length: 7 }, (_, i) =>
      makeObservation({
        id: `obs-${i}`,
        observationDate: `2026-01-${String(7 * (i + 1)).padStart(2, '0')}`,
      }),
    );

    const result = evaluateObservationFulfillment(assignment, observations, '2026-03-01');
    expect(result.fulfilled).toBe(true);
    expect(result.rate).toBeGreaterThanOrEqual(WEEKLY_OBSERVATION_FULFILLMENT_THRESHOLD);
  });

  it('should not be fulfilled when observations are insufficient', () => {
    const assignment = makeAssignment({ assignedFrom: '2026-01-01' });
    const observations = [
      makeObservation({ observationDate: '2026-01-07' }),
      makeObservation({ id: 'obs-2', observationDate: '2026-01-14' }),
    ];

    const result = evaluateObservationFulfillment(assignment, observations, '2026-03-01');
    expect(result.fulfilled).toBe(false);
    expect(result.gap).toBeGreaterThan(0);
  });

  it('should handle ended assignments', () => {
    const assignment = makeAssignment({
      assignedFrom: '2026-01-01',
      assignedTo: '2026-02-01',
    });
    const observations = [
      makeObservation({ observationDate: '2026-01-07' }),
      makeObservation({ id: '2', observationDate: '2026-01-14' }),
      makeObservation({ id: '3', observationDate: '2026-01-21' }),
      makeObservation({ id: '4', observationDate: '2026-01-28' }),
    ];

    const result = evaluateObservationFulfillment(assignment, observations, '2026-06-01');
    // 4 weeks in Jan, 4 observations → 100%
    expect(result.fulfilled).toBe(true);
  });
});

describe('daysSinceLastObservation', () => {
  it('should return days since last observation', () => {
    const obs = [
      makeObservation({ observationDate: '2026-02-20' }),
      makeObservation({ id: '2', observationDate: '2026-02-27' }),
    ];

    expect(daysSinceLastObservation(obs, 'S001', 'U001', '2026-03-10')).toBe(11);
  });

  it('should return null when no observations exist', () => {
    expect(daysSinceLastObservation([], 'S001', 'U001', '2026-03-10')).toBeNull();
  });
});

describe('computeStaffQualificationSummary', () => {
  it('should aggregate all metrics', () => {
    const assignments = [
      makeAssignment({ id: '1', staffId: 'S001', userId: 'U001' }),
    ];
    const observations = Array.from({ length: 10 }, (_, i) =>
      makeObservation({
        id: `obs-${i}`,
        observationDate: `2026-01-${String(7 * (i + 1)).padStart(2, '0')}`,
      }),
    );

    const summary = computeStaffQualificationSummary({
      certificates: 3,
      missingCertificates: 1,
      assignments,
      observations,
      corePersonAssignments: [],
      today: '2026-03-10',
    });

    expect(summary.totalCertificates).toBe(3);
    expect(summary.missingCertificates).toBe(1);
    expect(summary.activeAssignments).toBe(1);
  });

  it('unqualifiedAssignmentCount 省略時はデフォルト 0', () => {
    const summary = computeStaffQualificationSummary({
      certificates: 0,
      missingCertificates: 0,
      assignments: [],
      observations: [],
      corePersonAssignments: [],
      today: '2026-03-10',
    });

    expect(summary.unqualifiedAssignments).toBe(0);
  });

  it('unqualifiedAssignmentCount を渡すとサマリに反映される', () => {
    const summary = computeStaffQualificationSummary({
      certificates: 2,
      missingCertificates: 0,
      assignments: [],
      observations: [],
      corePersonAssignments: [],
      unqualifiedAssignmentCount: 3,
      today: '2026-03-10',
    });

    expect(summary.unqualifiedAssignments).toBe(3);
  });
});
