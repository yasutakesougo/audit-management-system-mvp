import { describe, it, expect } from 'vitest';
import type { DailyTableRecord } from '@/features/daily/repositories/sharepoint/dailyTableRepository';
import { buildMonitoringPeriodMetrics } from './monitoringDailyPeriod';

const mkRecord = (
  overrides: Partial<DailyTableRecord> & { recordDate: string },
): DailyTableRecord => ({
  userId: 'u1',
  activities: {},
  submittedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('buildMonitoringPeriodMetrics', () => {
  it('空配列はゼロ値を返す', () => {
    expect(buildMonitoringPeriodMetrics([])).toEqual({
      from: '',
      to: '',
      totalDays: 0,
      recordedDays: 0,
      recordRate: 0,
    });
  });

  it('重複日を除外して記録率を算出する', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-01' }),
      mkRecord({ recordDate: '2024-01-01' }),
      mkRecord({ recordDate: '2024-01-03' }),
    ];

    expect(buildMonitoringPeriodMetrics(records)).toEqual({
      from: '2024-01-01',
      to: '2024-01-03',
      totalDays: 3,
      recordedDays: 2,
      recordRate: 67,
    });
  });

  it('入力順に依存せず最小日/最大日を使う', () => {
    const records = [
      mkRecord({ recordDate: '2024-01-10' }),
      mkRecord({ recordDate: '2024-01-02' }),
    ];

    expect(buildMonitoringPeriodMetrics(records)).toEqual({
      from: '2024-01-02',
      to: '2024-01-10',
      totalDays: 9,
      recordedDays: 2,
      recordRate: 22,
    });
  });
});
