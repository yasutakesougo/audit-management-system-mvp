import { describe, it, expect } from 'vitest';
import { computeTimePatterns, __test__ } from '../computeTimePatterns';
import type { HandoffRecord } from '../../handoffTypes';

const { hourToTimeBand } = __test__;

// ── テストヘルパー ──

let idCounter = 0;
function resetIds() { idCounter = 0; }

function makeRecord(
  overrides: Partial<HandoffRecord> & { createdAt: string },
): HandoffRecord {
  idCounter++;
  return {
    id: idCounter,
    title: 'テスト',
    message: 'テストメッセージ',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// hourToTimeBand
// ────────────────────────────────────────────────────────────

describe('hourToTimeBand', () => {
  it('maps 6-8 → 朝', () => {
    expect(hourToTimeBand(6)).toBe('朝');
    expect(hourToTimeBand(7)).toBe('朝');
    expect(hourToTimeBand(8)).toBe('朝');
  });

  it('maps 9-11 → 午前', () => {
    expect(hourToTimeBand(9)).toBe('午前');
    expect(hourToTimeBand(10)).toBe('午前');
    expect(hourToTimeBand(11)).toBe('午前');
  });

  it('maps 12-16 → 午後', () => {
    expect(hourToTimeBand(12)).toBe('午後');
    expect(hourToTimeBand(14)).toBe('午後');
    expect(hourToTimeBand(16)).toBe('午後');
  });

  it('maps 17-23 and 0-5 → 夕方', () => {
    expect(hourToTimeBand(17)).toBe('夕方');
    expect(hourToTimeBand(20)).toBe('夕方');
    expect(hourToTimeBand(23)).toBe('夕方');
    expect(hourToTimeBand(0)).toBe('夕方');
    expect(hourToTimeBand(3)).toBe('夕方');
    expect(hourToTimeBand(5)).toBe('夕方');
  });

  // 境界値テスト
  it('handles boundary values correctly', () => {
    expect(hourToTimeBand(5)).toBe('夕方');  // 5:59 は夕方
    expect(hourToTimeBand(6)).toBe('朝');    // 6:00 は朝
    expect(hourToTimeBand(8)).toBe('朝');    // 8:59 は朝
    expect(hourToTimeBand(9)).toBe('午前');  // 9:00 は午前
    expect(hourToTimeBand(11)).toBe('午前'); // 11:59 は午前
    expect(hourToTimeBand(12)).toBe('午後'); // 12:00 は午後
    expect(hourToTimeBand(16)).toBe('午後'); // 16:59 は午後
    expect(hourToTimeBand(17)).toBe('夕方'); // 17:00 は夕方
  });
});

// ────────────────────────────────────────────────────────────
// computeTimePatterns
// ────────────────────────────────────────────────────────────

describe('computeTimePatterns', () => {
  describe('基本動作', () => {
    it('returns empty result for empty records', () => {
      const result = computeTimePatterns([]);

      expect(result.patterns).toEqual([]);
      expect(result.byTimeBand).toEqual([]);
      expect(result.totalRecordsAnalyzed).toBe(0);
    });

    it('groups records by dayOfWeek × timeBand', () => {
      resetIds();
      const records = [
        // 月曜午前（9時台）
        makeRecord({ createdAt: '2026-03-16T09:30:00' }), // 月曜
        makeRecord({ createdAt: '2026-03-16T10:00:00' }), // 月曜
        // 火曜午後（14時台）
        makeRecord({ createdAt: '2026-03-17T14:00:00' }), // 火曜
      ];

      const result = computeTimePatterns(records);

      expect(result.totalRecordsAnalyzed).toBe(3);

      // 月曜午前
      const monAm = result.patterns.find(p => p.dayOfWeek === 1 && p.timeBand === '午前');
      expect(monAm).toBeDefined();
      expect(monAm!.count).toBe(2);

      // 火曜午後
      const tuePm = result.patterns.find(p => p.dayOfWeek === 2 && p.timeBand === '午後');
      expect(tuePm).toBeDefined();
      expect(tuePm!.count).toBe(1);
    });
  });

  describe('topCategory', () => {
    it('selects the most frequent category', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-16T10:30:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-16T11:00:00', category: '行動面' }),
      ];

      const result = computeTimePatterns(records);

      expect(result.patterns[0].topCategory).toBe('体調');
    });

    it('uses stable sort for tied categories (Japanese sort)', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-16T10:30:00', category: '体調' }),
      ];

      const result = computeTimePatterns(records);
      // 同点 → カテゴリ名昇順（Japanese locale）
      const top = result.patterns[0].topCategory;
      expect(['体調', '行動面']).toContain(top);
    });
  });

  describe('categoryBreakdown', () => {
    it('includes category breakdown sorted by count', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-16T10:30:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-16T11:00:00', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-16T11:30:00', category: '良かったこと' }),
      ];

      const result = computeTimePatterns(records);
      const breakdown = result.patterns[0].categoryBreakdown;

      expect(breakdown[0]).toEqual({ category: '体調', count: 2 });
      expect(breakdown.length).toBe(3);
    });
  });

  describe('peakHour', () => {
    it('returns the most frequent hour', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00' }),
        makeRecord({ createdAt: '2026-03-16T10:30:00' }),
        makeRecord({ createdAt: '2026-03-16T10:45:00' }),
        makeRecord({ createdAt: '2026-03-16T11:00:00' }),
      ];

      const result = computeTimePatterns(records);

      expect(result.patterns[0].peakHour).toBe(10);
    });

    it('returns earlier hour when tied', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00' }),
        makeRecord({ createdAt: '2026-03-16T11:00:00' }),
      ];

      const result = computeTimePatterns(records);
      // 同点 → 早い方
      expect(result.patterns[0].peakHour).toBe(10);
    });
  });

  describe('byTimeBand（横断集計）', () => {
    it('sums across all days of week', () => {
      resetIds();
      const records = [
        // 月曜午前 ×2
        makeRecord({ createdAt: '2026-03-16T10:00:00' }),
        makeRecord({ createdAt: '2026-03-16T11:00:00' }),
        // 火曜午前 ×1
        makeRecord({ createdAt: '2026-03-17T09:00:00' }),
        // 月曜午後 ×1
        makeRecord({ createdAt: '2026-03-16T14:00:00' }),
      ];

      const result = computeTimePatterns(records);
      const amTotal = result.byTimeBand.find(b => b.timeBand === '午前');
      const pmTotal = result.byTimeBand.find(b => b.timeBand === '午後');

      expect(amTotal!.count).toBe(3); // 月×2 + 火×1
      expect(pmTotal!.count).toBe(1);
    });

    it('is sorted in natural timeBand order', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T14:00:00' }), // 午後
        makeRecord({ createdAt: '2026-03-16T07:00:00' }), // 朝
        makeRecord({ createdAt: '2026-03-16T10:00:00' }), // 午前
        makeRecord({ createdAt: '2026-03-16T18:00:00' }), // 夕方
      ];

      const result = computeTimePatterns(records);
      const order = result.byTimeBand.map(b => b.timeBand);

      expect(order).toEqual(['朝', '午前', '午後', '夕方']);
    });
  });

  describe('ソート順', () => {
    it('sorts patterns by dayOfWeek then timeBand order', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-17T14:00:00' }), // 火曜午後
        makeRecord({ createdAt: '2026-03-16T07:00:00' }), // 月曜朝
        makeRecord({ createdAt: '2026-03-16T10:00:00' }), // 月曜午前
        makeRecord({ createdAt: '2026-03-17T09:00:00' }), // 火曜午前
      ];

      const result = computeTimePatterns(records);
      const keys = result.patterns.map(p => `${p.dayOfWeek}:${p.timeBand}`);

      expect(keys).toEqual([
        '1:朝',     // 月曜朝
        '1:午前',   // 月曜午前
        '2:午前',   // 火曜午前
        '2:午後',   // 火曜午後
      ]);
    });
  });

  describe('エッジケース', () => {
    it('ignores records with invalid createdAt', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: 'invalid-date' }),
        makeRecord({ createdAt: '' }),
        makeRecord({ createdAt: '2026-03-16T10:00:00' }),
      ];

      const result = computeTimePatterns(records);

      expect(result.totalRecordsAnalyzed).toBe(1);
      expect(result.patterns).toHaveLength(1);
    });

    it('handles records across multiple weeks', () => {
      resetIds();
      const records = [
        // 2週分の月曜午前
        makeRecord({ createdAt: '2026-03-09T10:00:00' }),
        makeRecord({ createdAt: '2026-03-16T10:00:00' }),
      ];

      const result = computeTimePatterns(records);

      // 同じ曜日×時間帯は1グループにまとまる
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].count).toBe(2);
    });
  });
});
