import type { BehaviorObservation } from '@/features/daily';
import { describe, expect, it } from 'vitest';
import {
    buildAttendanceSummaryData,
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

// ---------------------------------------------------------------------------
// buildAttendanceSummaryData
// ---------------------------------------------------------------------------

describe('buildAttendanceSummaryData', () => {
  it('空の visits では全てゼロを返す', () => {
    const result = buildAttendanceSummaryData({});
    expect(result.attending).toBe(0);
    expect(result.absent).toBe(0);
    expect(result.undecided).toBe(0);
    expect(result.feverCount).toBe(0);
    expect(result.eveningPending).toBe(0);
    expect(result.donut).toHaveLength(3);
    expect(result.donut.every((s) => s.percentage === 0)).toBe(true);
  });

  it('通所中・退所済を attending に分類する', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中' },
      U2: { status: '退所済' },
      U3: { status: '通所中' },
    });
    expect(result.attending).toBe(3);
    expect(result.absent).toBe(0);
    expect(result.undecided).toBe(0);
  });

  it('当日欠席・事前欠席を absent に分類する', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '当日欠席' },
      U2: { status: '事前欠席' },
    });
    expect(result.absent).toBe(2);
    expect(result.attending).toBe(0);
  });

  it('その他のステータスを undecided に分類する', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '未連絡' },
      U2: { status: '遅刻連絡済' },
    });
    expect(result.undecided).toBe(2);
    expect(result.attending).toBe(0);
    expect(result.absent).toBe(0);
  });

  it('37.5℃以上を発熱としてカウントする', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中', temperature: 38.2 },
      U2: { status: '通所中', temperature: 37.5 },  // 境界値
      U3: { status: '通所中', temperature: 37.4 },  // セーフ
    });
    expect(result.feverCount).toBe(2);
  });

  it('temperature が undefined の場合は発熱対象外', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中' },
    });
    expect(result.feverCount).toBe(0);
  });

  it('欠席者で eveningChecked !== true の場合に eveningPending をカウントする', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '当日欠席', eveningChecked: false },
      U2: { status: '事前欠席' },  // eveningChecked undefined → 未完了
      U3: { status: '当日欠席', eveningChecked: true },  // 完了済み
    });
    expect(result.eveningPending).toBe(2);
  });

  it('通所中の利用者は eveningChecked !== true でも eveningPending 対象外', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中', eveningChecked: false },
    });
    expect(result.eveningPending).toBe(0);
  });

  it('ドーナツの割合が正しく計算される', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中' },
      U2: { status: '通所中' },
      U3: { status: '通所中' },
      U4: { status: '通所中' },
      U5: { status: '通所中' },
      U6: { status: '通所中' },
      U7: { status: '通所中' },
      U8: { status: '当日欠席' },
      U9: { status: '当日欠席' },
      U10: { status: '未連絡' },
    });
    expect(result.donut[0].label).toBe('通所');
    expect(result.donut[0].percentage).toBe(70);
    expect(result.donut[1].label).toBe('欠席');
    expect(result.donut[1].percentage).toBe(20);
    expect(result.donut[2].label).toBe('未定');
    expect(result.donut[2].percentage).toBe(10);
  });

  it('複合ケース：発熱+欠席+夕方フォロー未完了', () => {
    const result = buildAttendanceSummaryData({
      U1: { status: '通所中', temperature: 38.5 },           // 通所+発熱
      U2: { status: '当日欠席', eveningChecked: false },       // 欠席+夕方未完了
      U3: { status: '退所済', temperature: 36.5 },             // 通所（正常）
      U4: { status: '事前欠席', eveningChecked: true },        // 欠席+夕方完了
    });
    expect(result.attending).toBe(2);
    expect(result.absent).toBe(2);
    expect(result.undecided).toBe(0);
    expect(result.feverCount).toBe(1);
    expect(result.eveningPending).toBe(1);
  });
});
