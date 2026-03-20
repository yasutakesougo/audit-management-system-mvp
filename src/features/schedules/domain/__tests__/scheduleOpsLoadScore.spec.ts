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
  computeHighLoadReasons,
  computeHighLoadWarnings,
  computeLeaveReasons,
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

// ============================================================================
// computeLeaveReasons (Phase 3-C)
// ============================================================================

describe('computeLeaveReasons', () => {
  it('空の日 → 利用人数がとても少ない + 空き枠に余裕あり', () => {
    const day = makeDaySummary({ totalCount: 0, availableSlots: 25 });
    const reasons = computeLeaveReasons(day);

    expect(reasons).toHaveLength(2);
    expect(reasons[0]!.key).toBe('very-low-total');
    expect(reasons[1]!.key).toBe('high-availability');
  });

  it('利用者5人以下は very-low-total', () => {
    const day = makeDaySummary({ totalCount: 5, availableSlots: 20 });
    const reasons = computeLeaveReasons(day);

    expect(reasons[0]!.key).toBe('very-low-total');
  });

  it('利用者6〜10人は low-total（優先度低め）', () => {
    const day = makeDaySummary({ totalCount: 8, availableSlots: 5, attentionCount: 1, shortStayCount: 1 });
    const reasons = computeLeaveReasons(day);

    // high-availability (5 < 10) は入らない、注意対象あり、ショートステイあり
    // なので low-total が候補に入るはず
    expect(reasons.some((r) => r.key === 'low-total')).toBe(true);
  });

  it('利用者11人以上は total 系の理由が出ない', () => {
    const day = makeDaySummary({ totalCount: 15, availableSlots: 10 });
    const reasons = computeLeaveReasons(day);

    expect(reasons.every((r) => !r.key.includes('total'))).toBe(true);
  });

  it('空き枠10以上は high-availability', () => {
    const day = makeDaySummary({ totalCount: 12, availableSlots: 10 });
    const reasons = computeLeaveReasons(day);

    expect(reasons[0]!.key).toBe('high-availability');
  });

  it('注意対象0は no-attention', () => {
    const day = makeDaySummary({ totalCount: 12, availableSlots: 5, attentionCount: 0 });
    const reasons = computeLeaveReasons(day);

    expect(reasons.some((r) => r.key === 'no-attention')).toBe(true);
  });

  it('ショートステイ0は no-short-stay', () => {
    const day = makeDaySummary({ totalCount: 12, availableSlots: 5, attentionCount: 2, shortStayCount: 0 });
    const reasons = computeLeaveReasons(day);

    expect(reasons.some((r) => r.key === 'no-short-stay')).toBe(true);
  });

  it('レスパイト0は no-respite', () => {
    const day = makeDaySummary({
      totalCount: 12, availableSlots: 5, attentionCount: 2, shortStayCount: 1, respiteCount: 0,
    });
    const reasons = computeLeaveReasons(day);

    expect(reasons.some((r) => r.key === 'no-respite')).toBe(true);
  });

  it('maxReasons=1 で1つだけ返す', () => {
    const day = makeDaySummary({ totalCount: 0, availableSlots: 25 });
    const reasons = computeLeaveReasons(day, 1);

    expect(reasons).toHaveLength(1);
  });

  it('すべて該当する日は優先度上位2つだけ返す', () => {
    const day = makeDaySummary({
      totalCount: 3, availableSlots: 15, attentionCount: 0, shortStayCount: 0, respiteCount: 0,
    });
    const reasons = computeLeaveReasons(day);

    expect(reasons).toHaveLength(2);
    // 優先度順: very-low-total > high-availability
    expect(reasons[0]!.key).toBe('very-low-total');
    expect(reasons[1]!.key).toBe('high-availability');
  });
});

// ============================================================================
// suggestBestLeaveDays with reasons (Phase 3-C)
// ============================================================================

describe('suggestBestLeaveDays with weekSummary', () => {
  it('weekSummary を渡すと reasons が含まれる', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 15, availableSlots: 10 }),
    ];
    const scores = computeWeeklyLoadScores(week);
    const suggestions = suggestBestLeaveDays(scores, 3, week);

    expect(suggestions[0]!.reasons.length).toBeGreaterThan(0);
    expect(suggestions[0]!.reasons[0]!.key).toBe('very-low-total');
  });

  it('weekSummary なしでも動作する（reasons は空配列）', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),
    ];
    const scores = computeWeeklyLoadScores(week);
    const suggestions = suggestBestLeaveDays(scores);

    expect(suggestions[0]!.reasons).toEqual([]);
  });
});

// ============================================================================
// computeHighLoadReasons (Phase 4-A-1)
// ============================================================================

describe('computeHighLoadReasons', () => {
  it('定員超過日 → over-capacity', () => {
    const day = makeDaySummary({ totalCount: 30, availableSlots: 0, isOverCapacity: true });
    const reasons = computeHighLoadReasons(day);

    expect(reasons[0]!.key).toBe('over-capacity');
    expect(reasons[0]!.label).toBe('定員超過');
  });

  it('空き枠なし → no-slots', () => {
    const day = makeDaySummary({ totalCount: 20, availableSlots: 0 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons.some((r) => r.key === 'no-slots')).toBe(true);
  });

  it('注意対象5名以上 → many-attention', () => {
    const day = makeDaySummary({ totalCount: 20, attentionCount: 5, availableSlots: 5 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons.some((r) => r.key === 'many-attention')).toBe(true);
    expect(reasons.find((r) => r.key === 'many-attention')!.label).toBe('注意対象5名');
  });

  it('レスパイト3名以上 → many-respite', () => {
    const day = makeDaySummary({ totalCount: 20, respiteCount: 3, availableSlots: 5 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons.some((r) => r.key === 'many-respite')).toBe(true);
  });

  it('ショートステイ2名以上 → many-short-stay', () => {
    const day = makeDaySummary({ totalCount: 20, shortStayCount: 2, availableSlots: 5 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons.some((r) => r.key === 'many-short-stay')).toBe(true);
  });

  it('利用者20名以上 → very-high-total', () => {
    const day = makeDaySummary({ totalCount: 22, availableSlots: 3 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons.some((r) => r.key === 'very-high-total')).toBe(true);
    expect(reasons.find((r) => r.key === 'very-high-total')!.label).toBe('利用者22名');
  });

  it('maxReasons=1 で1つだけ返す', () => {
    const day = makeDaySummary({ totalCount: 30, availableSlots: 0, isOverCapacity: true, attentionCount: 8 });
    const reasons = computeHighLoadReasons(day, 1);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]!.key).toBe('over-capacity');
  });

  it('優先度順: over-capacity > no-slots > many-attention', () => {
    const day = makeDaySummary({
      totalCount: 30, availableSlots: 0, isOverCapacity: true, attentionCount: 6,
    });
    const reasons = computeHighLoadReasons(day);

    expect(reasons[0]!.key).toBe('over-capacity');
    expect(reasons[1]!.key).toBe('no-slots');
  });

  it('該当理由なし → 空配列', () => {
    const day = makeDaySummary({ totalCount: 10, availableSlots: 15 });
    const reasons = computeHighLoadReasons(day);

    expect(reasons).toHaveLength(0);
  });
});

// ============================================================================
// computeHighLoadWarnings (Phase 4-A-1)
// ============================================================================

describe('computeHighLoadWarnings', () => {
  it('high/critical のみ抽出される', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),       // low
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 15, availableSlots: 8 }),       // moderate
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 25, respiteCount: 3, shortStayCount: 2, attentionCount: 5, availableSlots: 0 }), // critical
    ];
    const scores = computeWeeklyLoadScores(week);
    const warnings = computeHighLoadWarnings(scores, week);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.dateIso).toBe('2026-03-18');
    expect(warnings[0]!.level).toBe('critical');
  });

  it('スコア降順でソートされる', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 22, attentionCount: 4, availableSlots: 2 }),  // high (score ~28)
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 30, respiteCount: 3, shortStayCount: 2, attentionCount: 6, availableSlots: 0, isOverCapacity: true }),  // critical (score ~54)
    ];
    const scores = computeWeeklyLoadScores(week);
    const warnings = computeHighLoadWarnings(scores, week);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]!.dateIso).toBe('2026-03-17'); // より高いスコアが先
    expect(warnings[0]!.score).toBeGreaterThan(warnings[1]!.score);
  });

  it('weekSummary ありで reasons が含まれる', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 30, availableSlots: 0, isOverCapacity: true }),
    ];
    const scores = computeWeeklyLoadScores(week);
    const warnings = computeHighLoadWarnings(scores, week);

    expect(warnings[0]!.reasons.length).toBeGreaterThan(0);
    expect(warnings[0]!.reasons[0]!.key).toBe('over-capacity');
  });

  it('weekSummary なしでも動作する（reasons は空配列）', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-18', totalCount: 30, availableSlots: 0, isOverCapacity: true }),
    ];
    const scores = computeWeeklyLoadScores(week);
    const warnings = computeHighLoadWarnings(scores);

    expect(warnings[0]!.reasons).toEqual([]);
  });

  it('全日 low/moderate → 空配列', () => {
    const week = [
      makeDaySummary({ dateIso: '2026-03-16', totalCount: 3, availableSlots: 22 }),
      makeDaySummary({ dateIso: '2026-03-17', totalCount: 15, availableSlots: 8 }),
    ];
    const scores = computeWeeklyLoadScores(week);
    const warnings = computeHighLoadWarnings(scores, week);

    expect(warnings).toHaveLength(0);
  });

  it('空配列 → 空配列', () => {
    expect(computeHighLoadWarnings([])).toEqual([]);
  });
});
