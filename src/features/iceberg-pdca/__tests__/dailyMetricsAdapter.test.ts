import { describe, expect, it } from 'vitest';

import {
  getMonthlyMetrics,
  getTrend,
  getWeeklyMetrics,
  type DailySubmissionEvent,
} from '../dailyMetricsAdapter';

const targetUserIds = ['U001', 'U002'];

const createEvent = (params: {
  userId: string;
  recordDate: string;
  leadTimeMinutes?: number;
}): DailySubmissionEvent => {
  const submittedAt = `${params.recordDate}T10:00:00+09:00`;
  const leadMinutes = params.leadTimeMinutes ?? 0;

  const draftCreatedAt = leadMinutes > 0
    ? new Date(new Date(submittedAt).getTime() - leadMinutes * 60_000).toISOString()
    : undefined;

  return {
    userId: params.userId,
    recordDate: params.recordDate,
    submittedAt,
    draftCreatedAt,
  };
};

describe('dailyMetricsAdapter trend functions', () => {
  it('returns current-week metrics when only this week has events', () => {
    const referenceDate = new Date('2026-02-11T12:00:00+09:00');
    const events = [
      createEvent({ userId: 'U001', recordDate: '2026-02-10', leadTimeMinutes: 20 }),
    ];

    const weekly = getWeeklyMetrics({ events, targetUserIds, referenceDate });

    expect(weekly.current.submittedCount).toBe(1);
    expect(weekly.previous.submittedCount).toBe(0);
    expect(weekly.completionTrend).toBe('up');
  });

  it('returns up trend when current completion rate improves over previous week', () => {
    const referenceDate = new Date('2026-02-11T12:00:00+09:00');
    const events = [
      createEvent({ userId: 'U001', recordDate: '2026-02-03' }),
      createEvent({ userId: 'U001', recordDate: '2026-02-10' }),
      createEvent({ userId: 'U002', recordDate: '2026-02-10' }),
    ];

    const weekly = getWeeklyMetrics({ events, targetUserIds, referenceDate });

    expect(weekly.completionTrend).toBe('up');
  });

  it('returns down trend when current completion rate worsens over previous week', () => {
    const referenceDate = new Date('2026-02-11T12:00:00+09:00');
    const events = [
      createEvent({ userId: 'U001', recordDate: '2026-02-03' }),
      createEvent({ userId: 'U002', recordDate: '2026-02-03' }),
      createEvent({ userId: 'U001', recordDate: '2026-02-10' }),
    ];

    const weekly = getWeeklyMetrics({ events, targetUserIds, referenceDate });

    expect(weekly.completionTrend).toBe('down');
  });

  it('returns flat trend when difference is inside threshold', () => {
    expect(getTrend(0.5004, 0.5)).toBe('flat');
    expect(getTrend(0.5, 0.5004)).toBe('flat');
  });

  it('aggregates month boundary correctly for current and previous month', () => {
    const referenceDate = new Date('2026-03-15T12:00:00+09:00');
    const events = [
      createEvent({ userId: 'U001', recordDate: '2026-03-03', leadTimeMinutes: 10 }),
      createEvent({ userId: 'U002', recordDate: '2026-03-10', leadTimeMinutes: 30 }),
      createEvent({ userId: 'U001', recordDate: '2026-02-12', leadTimeMinutes: 40 }),
    ];

    const monthly = getMonthlyMetrics({ events, targetUserIds, referenceDate });

    expect(monthly.current.dayCount).toBe(31);
    expect(monthly.previous.dayCount).toBe(28);
    expect(monthly.current.averageLeadTimeMinutes).toBe(20);
    expect(monthly.previous.averageLeadTimeMinutes).toBe(40);
    expect(monthly.leadTimeTrend).toBe('up');
  });
});
