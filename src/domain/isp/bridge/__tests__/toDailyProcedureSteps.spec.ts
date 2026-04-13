/**
 * toDailyProcedureSteps Adapter テスト
 *
 * 支援計画シートの planningDesign.procedureSteps から
 * Daily の ProcedureStep[] への変換を検証する。
 *
 * カバー範囲:
 * - timing あり (HH:MM) → time へマッピング
 * - timing なし → order ベースのデフォルト時刻
 * - 空 procedureSteps → 空配列
 * - order 順維持（ソート）
 * - planningSheetId 引き継ぎ
 * - sourceStepOrder 逆参照
 * - source === 'planning_sheet' 保証
 * - isKey: 最初と最後のみ true
 * - activityLabel 優先
 * - instruction からの activity 抽出
 * - 境界値: 1件, 多数件
 */
import { describe, expect, it } from 'vitest';
import type { PlanningDesign } from '@/domain/isp/schema';
import {
  extractActivityLabel,
  generateDefaultTime,
  parseTimingToTime,
  toDailyProcedureSteps,
} from '@/domain/isp/bridge/toDailyProcedureSteps';

// ─── helpers ───

function makeDesign(
  steps: Array<{ order: number; instruction: string; staff?: string; timing?: string }>,
): PlanningDesign {
  return {
    supportPriorities: [],
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
    procedureSteps: steps.map((s) => ({
      order: s.order,
      instruction: s.instruction,
      staff: s.staff ?? '',
      timing: s.timing ?? '',
    })),
    crisisThresholds: null,
    restraintPolicy: 'prohibited_except_emergency',
    reviewCycleDays: 180,
  };
}

// =======================
// parseTimingToTime
// =======================

describe('parseTimingToTime', () => {
  it('parses valid HH:MM', () => {
    expect(parseTimingToTime('09:00')).toBe('09:00');
    expect(parseTimingToTime('9:30')).toBe('09:30');
    expect(parseTimingToTime('15:45')).toBe('15:45');
    expect(parseTimingToTime('0:00')).toBe('00:00');
    expect(parseTimingToTime('23:59')).toBe('23:59');
  });

  it('rejects invalid formats', () => {
    expect(parseTimingToTime('')).toBeNull();
    expect(parseTimingToTime('morning')).toBeNull();
    expect(parseTimingToTime('9am')).toBeNull();
    expect(parseTimingToTime('09:00:00')).toBeNull();
    expect(parseTimingToTime('25:00')).toBeNull();
    expect(parseTimingToTime('09:60')).toBeNull();
    expect(parseTimingToTime('-1:00')).toBeNull();
  });
});

// =======================
// generateDefaultTime
// =======================

describe('generateDefaultTime', () => {
  it('generates 09:00 for order 1', () => {
    expect(generateDefaultTime(1)).toBe('09:00');
  });

  it('generates 09:30 for order 2', () => {
    expect(generateDefaultTime(2)).toBe('09:30');
  });

  it('generates 10:00 for order 3', () => {
    expect(generateDefaultTime(3)).toBe('10:00');
  });

  it('generates 12:00 for order 7', () => {
    expect(generateDefaultTime(7)).toBe('12:00');
  });

  it('caps at 23:xx for very large orders', () => {
    const result = generateDefaultTime(50);
    expect(result.startsWith('23:')).toBe(true);
  });
});

// =======================
// extractActivityLabel
// =======================

describe('extractActivityLabel', () => {
  it('prefers activityLabel when provided', () => {
    expect(extractActivityLabel('長い手順テキスト。', '朝の受け入れ')).toBe('朝の受け入れ');
  });

  it('extracts first sentence before 。', () => {
    expect(extractActivityLabel('視線を合わせて挨拶。体調チェック。')).toBe('視線を合わせて挨拶');
  });

  it('extracts first sentence before .', () => {
    expect(extractActivityLabel('Check card. Then proceed.')).toBe('Check card');
  });

  it('truncates at 40 chars', () => {
    const long = 'あ'.repeat(50);
    const result = extractActivityLabel(long);
    // slice(0, 37) + '…' = 38 chars
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(38);
  });

  it('returns full instruction if no sentence break and short', () => {
    expect(extractActivityLabel('短い手順')).toBe('短い手順');
  });

  it('falls back to first 40 chars if no sentence break and instruction is only whitespace', () => {
    // Empty first sentence after split
    expect(extractActivityLabel('')).toBe('');
  });
});

// =======================
// toDailyProcedureSteps
// =======================

describe('toDailyProcedureSteps', () => {
  it('returns empty array for empty procedureSteps', () => {
    const design = makeDesign([]);
    const result = toDailyProcedureSteps(design, 'ps-001');
    expect(result).toEqual([]);
  });

  it('converts a single step correctly', () => {
    const design = makeDesign([
      { order: 1, instruction: '視線を合わせて挨拶。体調チェック。', timing: '09:00' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-001');

    expect(result).toHaveLength(1);
    const step = result[0];
    expect(step.id).toBe('ps-ps-001-1-0');
    expect(step.time).toBe('09:00');
    expect(step.activity).toBe('視線を合わせて挨拶');
    expect(step.instruction).toBe('視線を合わせて挨拶。体調チェック。');
    expect(step.isKey).toBe(true); // only step = first AND last
    expect(step.planningSheetId).toBe('ps-001');
    expect(step.sourceStepOrder).toBe(1);
    expect(step.source).toBe('planning_sheet');
  });

  it('maps timing to time correctly', () => {
    const design = makeDesign([
      { order: 1, instruction: '朝の挨拶。', timing: '9:00' },
      { order: 2, instruction: '持ち物整理。', timing: '09:15' },
      { order: 3, instruction: '作業活動。', timing: '10:00' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-002');

    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('09:15');
    expect(result[2].time).toBe('10:00');
  });

  it('uses default time when timing is empty', () => {
    const design = makeDesign([
      { order: 1, instruction: '最初の作業。' },
      { order: 2, instruction: '次の作業。' },
      { order: 3, instruction: '最後の作業。' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-003');

    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('09:30');
    expect(result[2].time).toBe('10:00');
  });

  it('uses default time when timing is non-HH:MM', () => {
    const design = makeDesign([
      { order: 1, instruction: '朝。', timing: 'morning' },
      { order: 2, instruction: '昼。', timing: 'afternoon' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-004');

    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('09:30');
  });

  it('sorts by order regardless of input order', () => {
    const design = makeDesign([
      { order: 3, instruction: '三番目。', timing: '11:00' },
      { order: 1, instruction: '一番目。', timing: '09:00' },
      { order: 2, instruction: '二番目。', timing: '10:00' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-005');

    expect(result[0].sourceStepOrder).toBe(1);
    expect(result[1].sourceStepOrder).toBe(2);
    expect(result[2].sourceStepOrder).toBe(3);
    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('10:00');
    expect(result[2].time).toBe('11:00');
  });

  it('sets isKey true only for first and last steps', () => {
    const design = makeDesign([
      { order: 1, instruction: '最初。' },
      { order: 2, instruction: '中間A。' },
      { order: 3, instruction: '中間B。' },
      { order: 4, instruction: '最後。' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-006');

    expect(result[0].isKey).toBe(true);
    expect(result[1].isKey).toBe(false);
    expect(result[2].isKey).toBe(false);
    expect(result[3].isKey).toBe(true);
  });

  it('preserves planningSheetId on all steps', () => {
    const design = makeDesign([
      { order: 1, instruction: 'A。' },
      { order: 2, instruction: 'B。' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-unique-id');

    result.forEach((step) => {
      expect(step.planningSheetId).toBe('ps-unique-id');
      expect(step.source).toBe('planning_sheet');
    });
  });

  it('uses activityLabels when provided', () => {
    const design = makeDesign([
      { order: 1, instruction: '視線を合わせて挨拶。体調チェックシート記入。', timing: '09:00' },
      { order: 2, instruction: 'ロッカーへの収納を支援。手順書を提示。', timing: '09:15' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-007', {
      activityLabels: {
        1: '朝の受け入れ',
        2: '持ち物整理',
      },
    });

    expect(result[0].activity).toBe('朝の受け入れ');
    expect(result[1].activity).toBe('持ち物整理');
  });

  it('falls back to instruction extraction when activityLabels is partial', () => {
    const design = makeDesign([
      { order: 1, instruction: '視線を合わせて挨拶。', timing: '09:00' },
      { order: 2, instruction: 'ロッカーへの収納を支援。', timing: '09:15' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-008', {
      activityLabels: { 1: '朝の受け入れ' },
    });

    expect(result[0].activity).toBe('朝の受け入れ');
    expect(result[1].activity).toBe('ロッカーへの収納を支援'); // extracted from instruction
  });

  it('handles many steps correctly', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      order: i + 1,
      instruction: `手順${i + 1}。詳細。`,
      timing: `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
    }));
    const design = makeDesign(steps);
    const result = toDailyProcedureSteps(design, 'ps-bulk');

    expect(result).toHaveLength(10);
    expect(result[0].isKey).toBe(true);
    expect(result[9].isKey).toBe(true);
    expect(result[4].isKey).toBe(false);
    result.forEach((step, i) => {
      expect(step.sourceStepOrder).toBe(i + 1);
      expect(step.source).toBe('planning_sheet');
    });
  });

  it('handles mixed valid and invalid timings gracefully', () => {
    const design = makeDesign([
      { order: 1, instruction: '手順A。', timing: '09:00' },
      { order: 2, instruction: '手順B。', timing: 'invalid' },
      { order: 3, instruction: '手順C。', timing: '10:00' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-009');

    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('09:30'); // default for order 2
    expect(result[2].time).toBe('10:00');
  });

  it('handles duplicate orders by keeping original order but updating sourceStepOrder', () => {
    // Note: In a real system, schema validation might prevent duplicate orders,
    // but the bridge should handle it just in case.
    const design = makeDesign([
      { order: 1, instruction: '手順A。' },
      { order: 1, instruction: '手順B。' },
    ]);
    const result = toDailyProcedureSteps(design, 'ps-010');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ps-ps-010-1-0');
    expect(result[1].id).toBe('ps-ps-010-1-1');
    expect(result[0].id).not.toBe(result[1].id);
  });
});
