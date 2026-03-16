import { describe, it, expect } from 'vitest';
import { detectRepeatingPatterns } from '../detectRepeatingPatterns';
import type { HandoffRecord } from '../../handoffTypes';

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

const BASE = new Date('2026-03-16T12:00:00Z');

// ────────────────────────────────────────────────────────────
// 基本動作
// ────────────────────────────────────────────────────────────

describe('detectRepeatingPatterns', () => {
  describe('基本動作', () => {
    it('returns empty array for empty records', () => {
      expect(detectRepeatingPatterns([])).toEqual([]);
    });

    it('returns empty when no patterns exceed minRepeatCount', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '行動面' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const catRepeats = result.filter(p => p.type === 'same-category-repeat');

      expect(catRepeats).toHaveLength(0);
    });

    it('ignores records with empty userCode', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', userCode: '' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', userCode: '  ' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // same-category-repeat
  // ────────────────────────────────────────────────────────────

  describe('same-category-repeat', () => {
    it('detects repeated category within period', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-12T10:00:00Z', category: '行動面' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const catRepeat = result.find(p => p.type === 'same-category-repeat');

      expect(catRepeat).toBeDefined();
      expect(catRepeat!.category).toBe('行動面');
      expect(catRepeat!.count).toBe(3);
      expect(catRepeat!.handoffIds).toHaveLength(3);
      expect(catRepeat!.summary).toContain('行動面');
      expect(catRepeat!.summary).toContain('3回');
    });

    it('does not fire below min count', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const catRepeat = result.find(p => p.type === 'same-category-repeat');

      expect(catRepeat).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────
  // consecutive-days
  // ────────────────────────────────────────────────────────────

  describe('consecutive-days', () => {
    it('detects consecutive day patterns', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const consecutive = result.find(p => p.type === 'consecutive-days');

      expect(consecutive).toBeDefined();
      expect(consecutive!.consecutiveDays).toBe(3);
      expect(consecutive!.category).toBe('体調');
      expect(consecutive!.summary).toContain('3日連続');
    });

    it('detects 2-day consecutive patterns', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const consecutive = result.find(p => p.type === 'consecutive-days');

      expect(consecutive).toBeDefined();
      expect(consecutive!.consecutiveDays).toBe(2);
    });

    it('does not detect with gap', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        // 15日なし
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const consecutive = result.find(p => p.type === 'consecutive-days');

      // 連続日数は1（16日のみ） → 2未満なので検出されない
      expect(consecutive).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────
  // same-timeband-repeat
  // ────────────────────────────────────────────────────────────

  describe('same-timeband-repeat', () => {
    it('detects time band concentration', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T18:00:00Z', category: '行動面' }), // 夕方
        makeRecord({ createdAt: '2026-03-15T19:00:00Z', category: '行動面' }), // 夕方
        makeRecord({ createdAt: '2026-03-14T17:30:00Z', category: '行動面' }), // 夕方
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const tbRepeat = result.find(p => p.type === 'same-timeband-repeat');

      expect(tbRepeat).toBeDefined();
      expect(tbRepeat!.timeBand).toBe('夕方');
      expect(tbRepeat!.category).toBe('行動面');
      expect(tbRepeat!.summary).toContain('夕方');
      expect(tbRepeat!.summary).toContain('行動面');
      expect(tbRepeat!.summary).toContain('3回');
    });
  });

  // ────────────────────────────────────────────────────────────
  // unresolved-repeat
  // ────────────────────────────────────────────────────────────

  describe('unresolved-repeat', () => {
    it('detects stale unresolved handoffs', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '家族連絡', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '家族連絡', status: '対応中' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const unresolved = result.find(p => p.type === 'unresolved-repeat');

      expect(unresolved).toBeDefined();
      expect(unresolved!.category).toBe('家族連絡');
      expect(unresolved!.count).toBe(2);
      expect(unresolved!.summary).toContain('未対応');
      expect(unresolved!.summary).toContain('滞留');
    });

    it('ignores resolved handoffs', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '家族連絡', status: '対応済' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '家族連絡', status: '完了' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const unresolved = result.find(p => p.type === 'unresolved-repeat');

      expect(unresolved).toBeUndefined();
    });

    it('only watches key categories', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '良かったこと', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '良かったこと', status: '未対応' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const unresolved = result.find(p => p.type === 'unresolved-repeat');

      expect(unresolved).toBeUndefined(); // 良かったことは監視対象外
    });
  });

  // ────────────────────────────────────────────────────────────
  // オプション・ソート
  // ────────────────────────────────────────────────────────────

  describe('options', () => {
    it('filters by periodDays', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-02-01T10:00:00Z', category: '体調' }), // 期間外
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, periodDays: 7 });
      const catRepeat = result.find(p => p.type === 'same-category-repeat');

      expect(catRepeat!.count).toBe(3); // 期間外の1件は除外
    });

    it('respects minRepeatCount', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      // minRepeatCount=4 → 3回なので検出されない
      const result4 = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 4 });
      expect(result4.find(p => p.type === 'same-category-repeat')).toBeUndefined();

      // minRepeatCount=3 → 検出される
      const result3 = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      expect(result3.find(p => p.type === 'same-category-repeat')).toBeDefined();
    });
  });

  describe('ソート順', () => {
    it('sorts by confidence desc, count desc, lastSeenAt desc', () => {
      resetIds();
      const records = [
        // U001: 体調5回 → confidence high (count >= 5)
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-13T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-12T10:00:00Z', category: '体調' }),
        // U002: 行動面3回 → confidence medium
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ userCode: 'U002', createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
        makeRecord({ userCode: 'U002', createdAt: '2026-03-12T10:00:00Z', category: '行動面' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });

      // high confidence が先
      const highPatterns = result.filter(p => p.confidence === 'high');
      const medPatterns = result.filter(p => p.confidence === 'medium');

      if (highPatterns.length > 0 && medPatterns.length > 0) {
        const firstHighIdx = result.indexOf(highPatterns[0]);
        const firstMedIdx = result.indexOf(medPatterns[0]);
        expect(firstHighIdx).toBeLessThan(firstMedIdx);
      }
    });
  });

  describe('confidence levels', () => {
    it('assigns high confidence for count >= 5', () => {
      resetIds();
      const records = Array.from({ length: 5 }, (_, i) =>
        makeRecord({ createdAt: `2026-03-${16 - i}T10:00:00Z`, category: '体調' }),
      );

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const catRepeat = result.find(p => p.type === 'same-category-repeat');

      expect(catRepeat!.confidence).toBe('high');
    });

    it('assigns medium confidence for count 3-4', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-12T10:00:00Z', category: '行動面' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE, minRepeatCount: 3 });
      const catRepeat = result.find(p => p.type === 'same-category-repeat');

      expect(catRepeat!.confidence).toBe('medium');
    });

    it('assigns high confidence for 3+ consecutive days', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = detectRepeatingPatterns(records, { baseDate: BASE });
      const consecutive = result.find(p => p.type === 'consecutive-days');

      expect(consecutive!.confidence).toBe('high'); // 3日連続 → high
    });
  });
});
