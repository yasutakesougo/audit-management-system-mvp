import type { BehaviorObservation } from '@/features/daily';
import { describe, expect, it } from 'vitest';
import {
    buildDonutData,
    buildHourlyHeatmap,
    buildRecentEvents,
} from '../useAnalysisDashboardViewModel';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeRecord = (hour: number, intensity: number, dayOffset = 0): BehaviorObservation => {
  const d = new Date('2025-04-01T00:00:00');
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, 15, 0, 0);
  return {
    id: `rec-${hour}-${dayOffset}-${intensity}`,
    userId: 'U-001',
    recordedAt: d.toISOString(),
    behavior: '大声',
    antecedent: '待ち時間',
    antecedentTags: [],
    consequence: 'スタッフ対応',
    intensity: intensity as 1 | 2 | 3 | 4 | 5,
  };
};

// ---------------------------------------------------------------------------
// buildHourlyHeatmap
// ---------------------------------------------------------------------------

describe('buildHourlyHeatmap', () => {
  it('returns 24 cells', () => {
    const result = buildHourlyHeatmap([]);
    expect(result).toHaveLength(24);
    expect(result.every((c) => c.count === 0)).toBe(true);
    expect(result.every((c) => c.intensity === 0)).toBe(true);
  });

  it('counts records by hour and normalises intensity', () => {
    const records = [makeRecord(9, 3), makeRecord(9, 4), makeRecord(14, 2)];
    const result = buildHourlyHeatmap(records);

    expect(result[9].count).toBe(2);
    expect(result[14].count).toBe(1);
    // max = 2 → hour 9 intensity = 1.0, hour 14 intensity = 0.5
    expect(result[9].intensity).toBe(1.0);
    expect(result[14].intensity).toBe(0.5);
  });

  it('ignores records with invalid dates', () => {
    const bad: BehaviorObservation = {
      id: 'bad',
      userId: 'U-001',
      recordedAt: 'INVALID',
      behavior: '---',
      antecedent: '',
      antecedentTags: [],
      consequence: '',
      intensity: 1,
    };
    const result = buildHourlyHeatmap([bad]);
    expect(result.every((c) => c.count === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildDonutData
// ---------------------------------------------------------------------------

describe('buildDonutData', () => {
  it('returns zero percentages when all counts are 0', () => {
    const result = buildDonutData(0, 0, 0);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.percentage === 0)).toBe(true);
  });

  it('calculates correct percentages', () => {
    const result = buildDonutData(7, 2, 1);
    expect(result[0].percentage).toBe(70);
    expect(result[1].percentage).toBe(20);
    expect(result[2].percentage).toBe(10);
  });

  it('handles uneven splits', () => {
    const result = buildDonutData(1, 1, 1);
    expect(result[0].percentage).toBeCloseTo(33.3, 0);
    expect(result[1].percentage).toBeCloseTo(33.3, 0);
    expect(result[2].percentage).toBeCloseTo(33.3, 0);
  });
});

// ---------------------------------------------------------------------------
// buildRecentEvents
// ---------------------------------------------------------------------------

describe('buildRecentEvents', () => {
  it('returns empty array for no records', () => {
    expect(buildRecentEvents([])).toEqual([]);
  });

  it('limits to 10 events and sorts newest first', () => {
    const records = Array.from({ length: 15 }, (_, i) => makeRecord(10, 3, i));
    const result = buildRecentEvents(records);

    expect(result).toHaveLength(10);
    // First event should be the newest (dayOffset = 0)
    expect(result[0].id).toContain('rec-10-0-3');
  });

  it('respects custom limit', () => {
    const records = Array.from({ length: 5 }, (_, i) => makeRecord(10, 3, i));
    const result = buildRecentEvents(records, 3);
    expect(result).toHaveLength(3);
  });
});
