import { describe, expect, it } from 'vitest';
import type { DailyTableRecord } from '@/features/daily/repositories/sharepoint/dailyTableRepository';
import { aggregateMonitoringBehaviors } from './monitoringDailyBehaviors';

const mkRecord = (
  overrides: Partial<DailyTableRecord> & { recordDate: string },
): DailyTableRecord => ({
  userId: 'u1',
  activities: {},
  submittedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('aggregateMonitoringBehaviors', () => {
  it('空配列は問題行動なしを返す', () => {
    expect(aggregateMonitoringBehaviors([])).toEqual({
      totalDays: 0,
      rate: 0,
      byType: [],
      weeklyTrend: [],
      recentChange: 'flat',
      changeRate: 0,
    });
  });

  it('種別集計と recentChange を算出できる', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-02', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-08' }),
      mkRecord({ recordDate: '2024-01-15', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-16', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-22', problemBehaviors: ['shouting'] }),
      mkRecord({ recordDate: '2024-01-23', problemBehaviors: ['selfHarm'] }),
    ];

    const result = aggregateMonitoringBehaviors(records);
    expect(result.totalDays).toBe(5);
    expect(result.rate).toBe(83);
    expect(result.byType[0]).toEqual({ type: 'shouting', label: '大声', count: 4 });
    expect(result.recentChange).toBe('up');
  });
});
