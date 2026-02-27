import { describe, it, expect } from 'vitest';
import { parseYmdLocal, computeDiff, createEmptyCurrentPlan, DOMAINS } from '../ispRepo';

describe('ispRepo', () => {
  /* ── parseYmdLocal ── */
  describe('parseYmdLocal', () => {
    it('creates local date at midnight (no timezone drift)', () => {
      const d = parseYmdLocal('2026-05-31');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4); // May = 4
      expect(d.getDate()).toBe(31);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });

    it('handles year boundary correctly', () => {
      const d = parseYmdLocal('2027-01-01');
      expect(d.getFullYear()).toBe(2027);
      expect(d.getMonth()).toBe(0);
      expect(d.getDate()).toBe(1);
    });
  });

  /* ── computeDiff ── */
  describe('computeDiff', () => {
    it('returns same when text matches', () => {
      const diff = computeDiff('こんにちは', 'こんにちは');
      expect(diff).toEqual([{ type: 'same', text: 'こんにちは' }]);
    });

    it('returns add when old is empty', () => {
      const diff = computeDiff('', '追加');
      expect(diff).toEqual([{ type: 'add', text: '追加' }]);
    });

    it('returns del when new is empty', () => {
      const diff = computeDiff('削除', '');
      expect(diff).toEqual([{ type: 'del', text: '削除' }]);
    });

    it('returns empty array when both empty', () => {
      expect(computeDiff('', '')).toEqual([]);
    });

    it('includes add/del segments when text changed', () => {
      const diff = computeDiff('朝の会で挨拶', '朝の会で自発的に挨拶');
      const types = new Set(diff.map((d) => d.type));
      expect(types.has('add')).toBe(true);
      expect(types.has('same')).toBe(true);
    });

    it('concatenated diff text reproduces both inputs', () => {
      const old = '日中活動に参加する';
      const nw = '日中活動に主体的に参加する';
      const diff = computeDiff(old, nw);

      const reconstructOld = diff
        .filter((s) => s.type !== 'add')
        .map((s) => s.text)
        .join('');
      const reconstructNew = diff
        .filter((s) => s.type !== 'del')
        .map((s) => s.text)
        .join('');

      expect(reconstructOld).toBe(old);
      expect(reconstructNew).toBe(nw);
    });
  });

  /* ── createEmptyCurrentPlan ── */
  describe('createEmptyCurrentPlan', () => {
    it('returns plan with all empty goal texts', () => {
      const plan = createEmptyCurrentPlan();
      expect(plan.goals.every((g) => g.text === '')).toBe(true);
    });

    it('returns a new object each call (no shared reference)', () => {
      const a = createEmptyCurrentPlan();
      const b = createEmptyCurrentPlan();
      expect(a).not.toBe(b);
      expect(a.goals).not.toBe(b.goals);
    });
  });

  /* ── DOMAINS constant ── */
  describe('DOMAINS', () => {
    it('has exactly 5 domains', () => {
      expect(DOMAINS).toHaveLength(5);
    });

    it('each domain has id, label, color, bg', () => {
      for (const d of DOMAINS) {
        expect(d.id).toBeTruthy();
        expect(d.label).toBeTruthy();
        expect(d.color).toMatch(/^#/);
        expect(d.bg).toMatch(/^#/);
      }
    });
  });
});
