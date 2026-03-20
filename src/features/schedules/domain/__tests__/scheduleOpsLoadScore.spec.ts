/**
 * scheduleOpsLoadScore.spec.ts — 負荷スコア・判断支援の純粋関数テスト
 *
 * 責務:
 * - computeLoadScore の重み計算が正しいことを保証
 * - classifyLoadLevel の閾値分類が正しいことを保証
 * - assessLeaveEligibility の判定ロジックを保証
 * - computeWeeklyLoadScores の一括算出を保証
 * - suggestBestLeaveDays の推奨ロジックを保証
 * - エッジケース（0件日、超過日、全quiet週）をカバー
 */

import { describe, expect, it } from 'vitest';

import type { DaySummaryEntry } from '../scheduleOps';
import {
  assessLeaveEligibility,
  classifyLoadLevel,
  computeDayLoadScore,
  computeLoadScore,
  computeWeeklyLoadScores,
  suggestBestLeaveDays,
} from '../scheduleOpsLoadScore';

// ─── Test Data Factory ───────────────────────────────────────────────────────

function makeDaySummary(overrides?: Partial<DaySummaryEntry>): DaySummaryEntry {
  return {
    dateIso: '2026-03-20',
    totalCount: 0,
    respiteCount: 0,
    shortStayCount: 0,
    attentionCount: 0,
    availableSlots: 25,
    isOverCapacity: false,
    ...overrides,
  };
}

// ============================================================================
// computeLoadScore
// ============================================================================

describe('computeLoadScore', () => {
  it('空の日はスコア 0 にならない（空き枠分がマイナスされるが 0 にクランプ）', () => {
    const day = makeDaySummary({ totalCount: 0, availableSlots: 25 });
    // raw = 0*1 + 0*2 + 0*3 + 0*2 - 25*1 = -25 → clamped to 0
    expect(computeLoadScore(day)).toBe(0);
  });

  it('基本的な重み計算が正しい', () => {
    const day = makeDaySummary({
      totalCount: 15,
      respiteCount: 2,
      shortStayCount: 1,
      attentionCount: 3,
      availableSlots: 10,
    });
    // raw = 15*1 + 2*2 + 1*3 + 3*2 - 10*1 = 15 + 4 + 3 + 6 - 10 = 18
    expect(computeLoadScore(day)).toBe(18);
  });

  it('カスタム重みが適用される', () => {
    const day = makeDaySummary({
      totalCount: 10,
      respiteCount: 1,
      shortStayCount: 1,
      attentionCount: 1,
      availableSlots: 5,
    });
    const weights = {
      totalWeight: 2,
      respiteWeight: 3,
      shortStayWeight: 5,
      attentionWeight: 4,
      availableSlotWeight: 2,
    };
    // raw = 10*2 + 1*3 + 1*5 + 1*4 - 5*2 = 20 + 3 + 5 + 4 - 10 = 22
    expect(computeLoadScore(day, weights)).toBe(22);
  });

  it('定員超過の日は高スコアになる', () => {
    const day = makeDaySummary({
      totalCount: 30,
      respiteCount: 3,
      shortStayCount: 2,
      attentionCount: 5,
      availableSlots: 0,
      isOverCapacity: true,
    });
    // raw = 30*1 + 3*2 + 2*3 + 5*2 - 0*1 = 30 + 6 + 6 + 10 = 52
    expect(computeLoadScore(day)).toBe(52);
  });

  it('マイナスになるケースは0にクランプされる', () => {
    const day = makeDaySummary({
      totalCount: 1,
      availableSlots: 25,
    });
    // raw = 1*1 - 25*1 = -24 → 0
    expect(computeLoadScore(day)).toBe(0);
  });
});

// ============================================================================
// classifyLoadLevel
// ============================================================================

describe('classifyLoadLevel', () => {
  it('score=0 は low', () => {
    expect(classifyLoadLevel(0)).toBe('low');
  });

  it('score=10 は low（境界値）', () => {
    expect(classifyLoadLevel(10)).toBe('low');
  });

  it('score=11 は moderate', () => {
    expect(classifyLoadLevel(11)).toBe('moderate');
  });

  it('score=20 は moderate（境界値）', () => {
    expect(classifyLoadLevel(20)).toBe('moderate');
  });

  it('score=21 は high', () => {
    expect(classifyLoadLevel(21)).toBe('high');
  });

  it('score=29 は high', () => {
    expect(classifyLoadLevel(29)).toBe('high');
  });

  it('score=30 は critical（境界値）', () => {
    expect(classifyLoadLevel(30)).toBe('critical');
  });

  it('score=99 は critical', () => {
    expect(classifyLoadLevel(99)).toBe('critical');
  });

  it('カスタム閾値が適用される', () => {
    const thresholds = { lowMax: 5, moderateMax: 15, criticalMin: 25 };
    expect(classifyLoadLevel(4, thresholds)).toBe('low');
    expect(classifyLoadLevel(6, thresholds)).toBe('moderate');
    expect(classifyLoadLevel(16, thresholds)).toBe('high');
    expect(classifyLoadLevel(25, thresholds)).toBe('critical');
  });
});

// ============================================================================
// assessLeaveEligibility
// ============================================================================

describe('assessLeaveEligibility', () => {
  it('low スコア → available（🟢 休める）', () => {
    const day = makeDaySummary();
    expect(assessLeaveEligibility(day, 5, 'low')).toBe('available');
  });

  it('moderate スコア → caution（🟡 微妙）', () => {
    const day = makeDaySummary();
    expect(assessLeaveEligibility(day, 15, 'moderate')).toBe('caution');
  });

  it('high スコア → unavailable（🔴 無理）', () => {
    const day = makeDaySummary();
    expect(assessLeaveEligibility(day, 25, 'high')).toBe('unavailable');
  });

  it('critical スコア → unavailable', () => {
    const day = makeDaySummary();
    expect(assessLeaveEligibility(day, 35, 'critical')).toBe('unavailable');
  });

  it('isOverCapacity=true は low でも unavailable', () => {
    const day = makeDaySummary({ isOverCapacity: true });
    expect(assessLeaveEligibility(day, 5, 'low')).toBe('unavailable');
  });

  it('isOverCapacity=true は moderate でも unavailable', () => {
    const day = makeDaySummary({ isOverCapacity: true });
    expect(assessLeaveEligibility(day, 15, 'moderate')).toBe('unavailable');
  });
});

// ============================================================================
// computeWeeklyLoadScores
// ============================================================================

describe('computeWeeklyLoadScores', () => {
  it('空配列 → 空配列', () => {
    expect(computeWeeklyLoadScores([])).toEqual([]);
  });

  it('7日分の一括算出が正しい', () => {
    const week: DaySummaryEntry[] = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),   // low
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 15, respiteCount: 2, availableSlots: 8 }), // moderate
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 22, respiteCount: 3, shortStayCount: 2, attentionCount: 4, availableSlots: 0 }), // critical
      makeDaySummary({ dateIso: '2026-03-19', totalCount: 5, availableSlots: 20 }),   // low
      makeDaySummary({ dateIso: '2026-03-20', totalCount: 10, attentionCount: 2, availableSlots: 15 }),  // low
      makeDaySummary({ dateIso: '2026-03-21', totalCount: 0, availableSlots: 25 }),   // low (0)
      makeDaySummary({ dateIso: '2026-03-22', totalCount: 0, availableSlots: 25 }),   // low (0)
    ];

    const result = computeWeeklyLoadScores(week);

    expect(result).toHaveLength(7);
    expect(result[0]!.dateIso).toBe('2026-03-16');
    expect(result[0]!.level).toBe('low');
    expect(result[0]!.leaveEligibility).toBe('available');

    expect(result[2]!.dateIso).toBe('2026-03-18');
    expect(result[2]!.level).toBe('critical');
    expect(result[2]!.leaveEligibility).toBe('unavailable');

    expect(result[5]!.score).toBe(0);
    expect(result[5]!.leaveEligibility).toBe('available');
  });

  it('超過日は unavailable になる', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 30, availableSlots: 0, isOverCapacity: true }),
    ];
    const result = computeWeeklyLoadScores(week);
    expect(result[0]!.leaveEligibility).toBe('unavailable');
  });
});

// ============================================================================
// suggestBestLeaveDays
// ============================================================================

describe('suggestBestLeaveDays', () => {
  it('unavailable な日は除外される', () => {
    const scores = computeWeeklyLoadScores([
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 30, availableSlots: 0, isOverCapacity: true }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 5, availableSlots: 20 }),
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 3, availableSlots: 22 }),
    ]);
    const suggestions = suggestBestLeaveDays(scores);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.dateIso !== '2026-03-16')).toBe(true);
  });

  it('スコアが低い順にランク付けされる', () => {
    const scores = computeWeeklyLoadScores([
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 18, respiteCount: 1, availableSlots: 7 }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 8, availableSlots: 17 }),
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 12, attentionCount: 1, availableSlots: 13 }),
    ]);
    // 03-16: 18*1 + 1*2 - 7*1 = 13
    // 03-17: 8*1 - 17*1 = -9 → 0
    // 03-18: 12*1 + 1*2 - 13*1 = 1
    const suggestions = suggestBestLeaveDays(scores);

    expect(suggestions[0]!.rank).toBe(1);
    expect(suggestions[0]!.dateIso).toBe('2026-03-17'); // 最も低スコア (0)
    expect(suggestions[1]!.rank).toBe(2);
    expect(suggestions[1]!.dateIso).toBe('2026-03-18'); // 次に低い (1)
  });

  it('maxSuggestions で上限が適用される', () => {
    const scores = computeWeeklyLoadScores([
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 5, availableSlots: 20 }),
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 7, availableSlots: 18 }),
      makeDaySummary({ dateIso: '2026-03-19', totalCount: 9, availableSlots: 16 }),
    ]);
    const suggestions = suggestBestLeaveDays(scores, 2);

    expect(suggestions).toHaveLength(2);
  });

  it('全日 unavailable → 空配列', () => {
    const scores = computeWeeklyLoadScores([
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 30, availableSlots: 0, isOverCapacity: true }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 28, availableSlots: 0, isOverCapacity: true }),
    ]);
    const suggestions = suggestBestLeaveDays(scores);

    expect(suggestions).toHaveLength(0);
  });

  it('空配列 → 空配列', () => {
    expect(suggestBestLeaveDays([])).toEqual([]);
  });
});

// ============================================================================
// computeDayLoadScore (convenience function)
// ============================================================================

describe('computeDayLoadScore', () => {
  it('単独日のスコアが正しく算出される', () => {
    const day = makeDaySummary({
      dateIso: '2026-03-20',
      totalCount: 15,
      respiteCount: 2,
      shortStayCount: 1,
      attentionCount: 3,
      availableSlots: 10,
    });
    const result = computeDayLoadScore(day);

    expect(result.dateIso).toBe('2026-03-20');
    expect(result.score).toBe(18); // same as computeLoadScore test
    expect(result.level).toBe('moderate');
    expect(result.leaveEligibility).toBe('caution');
  });

  it('quiet day は available', () => {
    const day = makeDaySummary({
      dateIso: '2026-03-21',
      totalCount: 2,
      availableSlots: 23,
    });
    const result = computeDayLoadScore(day);

    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.leaveEligibility).toBe('available');
  });
});
