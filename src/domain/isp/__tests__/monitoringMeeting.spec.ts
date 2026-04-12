// ---------------------------------------------------------------------------
// monitoringMeeting.spec.ts — P3 モニタリング会議記録のドメインテスト
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import type { MonitoringMeetingRecord } from '../monitoringMeeting';
import {
  getFiscalYear,
  filterByFiscalYear,
  computeDaysUntilNextMonitoring,
  computeMonitoringSummary,
  computeAchievementDistribution,
} from '../monitoringMeeting';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRecord(
  overrides: Partial<MonitoringMeetingRecord> = {},
): MonitoringMeetingRecord {
  return {
    id: 'mtg-001',
    userId: 'U001',
    ispId: 'ISP-001',
    meetingType: 'regular',
    meetingDate: '2026-06-15',
    venue: '相談室A',
    attendees: [
      { name: '田中太郎', role: 'サビ管', present: true },
      { name: '佐藤花子', role: '支援員', present: true },
    ],
    goalEvaluations: [
      { goalText: '自立的な日課遂行', achievementLevel: 'mostly_achieved', comment: '良好' },
      { goalText: 'コミュニケーション', achievementLevel: 'partial', comment: '改善傾向' },
    ],
    overallAssessment: '全体的に安定した支援が継続できている',
    userFeedback: '今の支援に満足している',
    familyFeedback: '家庭でも安定している',
    planChangeDecision: 'no_change',
    changeReason: '',
    decisions: ['現行計画を継続'],
    nextMonitoringDate: '2026-12-15',
    recordedBy: '田中太郎',
    recordedAt: '2026-06-15T10:00:00Z',
    ...overrides,
  };
}

// =========================================================================
// getFiscalYear
// =========================================================================

describe('getFiscalYear', () => {
  it('should return same year for April-December', () => {
    expect(getFiscalYear('2026-04-01')).toBe(2026);
    expect(getFiscalYear('2026-12-31')).toBe(2026);
  });

  it('should return previous year for January-March', () => {
    expect(getFiscalYear('2027-01-15')).toBe(2026);
    expect(getFiscalYear('2027-03-31')).toBe(2026);
  });

  it('should handle April 1st as new fiscal year', () => {
    expect(getFiscalYear('2027-04-01')).toBe(2027);
  });
});

// =========================================================================
// filterByFiscalYear
// =========================================================================

describe('filterByFiscalYear', () => {
  it('should filter records by fiscal year', () => {
    const records = [
      makeRecord({ meetingDate: '2025-10-01' }), // FY2025
      makeRecord({ meetingDate: '2026-02-01' }), // FY2025 (Jan-Mar)
      makeRecord({ meetingDate: '2026-06-01' }), // FY2026
      makeRecord({ meetingDate: '2026-11-01' }), // FY2026
    ];

    const fy2025 = filterByFiscalYear(records, 2025);
    const fy2026 = filterByFiscalYear(records, 2026);

    expect(fy2025).toHaveLength(2);
    expect(fy2026).toHaveLength(2);
  });
});

// =========================================================================
// computeDaysUntilNextMonitoring
// =========================================================================

describe('computeDaysUntilNextMonitoring', () => {
  it('should return positive days when next date is in the future', () => {
    expect(computeDaysUntilNextMonitoring('2026-03-20', '2026-03-10')).toBe(10);
  });

  it('should return negative days when overdue', () => {
    expect(computeDaysUntilNextMonitoring('2026-03-01', '2026-03-11')).toBe(-10);
  });

  it('should return 0 on the day', () => {
    expect(computeDaysUntilNextMonitoring('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('should return null for null input', () => {
    expect(computeDaysUntilNextMonitoring(null)).toBeNull();
  });

  it('should return null for invalid date', () => {
    expect(computeDaysUntilNextMonitoring('invalid')).toBeNull();
  });
});

// =========================================================================
// computeMonitoringSummary
// =========================================================================

describe('computeMonitoringSummary', () => {
  it('should compute summary for fiscal year with fulfilled meetings', () => {
    const records = [
      makeRecord({ id: 'mtg-1', meetingDate: '2026-06-15', nextMonitoringDate: '2026-12-15' }),
      makeRecord({ id: 'mtg-2', meetingDate: '2026-12-15', nextMonitoringDate: '2027-06-15' }),
    ];

    const summary = computeMonitoringSummary(records, '2027-01-01');

    expect(summary.totalMeetings).toBe(2);
    expect(summary.meetingsThisFiscalYear).toBe(2); // FY2026: both in Apr-Mar
    expect(summary.requiredPerYear).toBe(2);
    expect(summary.isFulfilled).toBe(true);
    expect(summary.fulfillmentRate).toBe(1.0);
    expect(summary.lastMeetingDate).toBe('2026-12-15');
    expect(summary.nextScheduledDate).toBe('2027-06-15');
  });

  it('should detect unfulfilled monitoring', () => {
    const records = [
      makeRecord({ meetingDate: '2026-06-15' }),
    ];

    const summary = computeMonitoringSummary(records, '2026-10-01');

    expect(summary.meetingsThisFiscalYear).toBe(1);
    expect(summary.isFulfilled).toBe(false);
    expect(summary.fulfillmentRate).toBe(0.5);
  });

  it('should count pending plan changes', () => {
    const records = [
      makeRecord({ id: '1', planChangeDecision: 'no_change' }),
      makeRecord({ id: '2', planChangeDecision: 'minor_revision' }),
      makeRecord({ id: '3', planChangeDecision: 'major_revision' }),
    ];

    const summary = computeMonitoringSummary(records, '2026-10-01');
    expect(summary.pendingPlanChanges).toBe(2);
  });

  it('should handle empty records', () => {
    const summary = computeMonitoringSummary([], '2026-10-01');

    expect(summary.totalMeetings).toBe(0);
    expect(summary.meetingsThisFiscalYear).toBe(0);
    expect(summary.isFulfilled).toBe(false);
    expect(summary.lastMeetingDate).toBeNull();
    expect(summary.nextScheduledDate).toBeNull();
    expect(summary.daysUntilNextMonitoring).toBeNull();
  });

  it('should compute days until next monitoring', () => {
    const records = [
      makeRecord({ meetingDate: '2026-06-15', nextMonitoringDate: '2026-12-15' }),
    ];

    const summary = computeMonitoringSummary(records, '2026-10-01');
    expect(summary.daysUntilNextMonitoring).toBe(75); // Oct 1 → Dec 15
  });

  it('should detect 6-month continuity violations (gap between meetings)', () => {
    const records = [
      makeRecord({ meetingDate: '2026-01-01' }),
      makeRecord({ meetingDate: '2026-07-10' }), // > 183 days (approx 190 days)
    ];
    const summary = computeMonitoringSummary(records, '2026-08-01');
    expect(summary.hasContinuityViolation).toBe(true);
    expect(summary.maxGapDays).toBeGreaterThan(183);
  });

  it('should detect 6-month continuity violations (overdue from last meeting)', () => {
    const records = [
      makeRecord({ meetingDate: '2026-01-01' }),
    ];
    const summary = computeMonitoringSummary(records, '2026-07-15'); // > 183 days since last meeting
    expect(summary.hasContinuityViolation).toBe(true);
  });

  it('should pass consistency check when gap is within 6 months', () => {
    const records = [
      makeRecord({ meetingDate: '2026-04-01' }),
      makeRecord({ meetingDate: '2026-09-01' }), // ~ 153 days
    ];
    const summary = computeMonitoringSummary(records, '2026-10-01');
    expect(summary.hasContinuityViolation).toBe(false);
    expect(summary.maxGapDays).toBeLessThanOrEqual(183);
  });
});

// =========================================================================
// computeAchievementDistribution
// =========================================================================

describe('computeAchievementDistribution', () => {
  it('should count achievement levels across all records', () => {
    const records = [
      makeRecord({
        id: '1',
        goalEvaluations: [
          { goalText: 'A', achievementLevel: 'achieved', comment: '' },
          { goalText: 'B', achievementLevel: 'partial', comment: '' },
        ],
      }),
      makeRecord({
        id: '2',
        goalEvaluations: [
          { goalText: 'A', achievementLevel: 'achieved', comment: '' },
          { goalText: 'C', achievementLevel: 'not_achieved', comment: '' },
        ],
      }),
    ];

    const dist = computeAchievementDistribution(records);

    expect(dist.achieved).toBe(2);
    expect(dist.partial).toBe(1);
    expect(dist.not_achieved).toBe(1);
    expect(dist.mostly_achieved).toBe(0);
    expect(dist.not_evaluable).toBe(0);
  });

  it('should return all zeros for empty records', () => {
    const dist = computeAchievementDistribution([]);
    expect(Object.values(dist).every((v) => v === 0)).toBe(true);
  });
});
