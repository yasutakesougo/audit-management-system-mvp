import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseYmdLocal,
  computeDiff,
  createEmptyCurrentPlan,
  DOMAINS,
  loadDraft,
  saveDraft,
  deleteDraft,
  draftKey,
} from '../ispRepo';

describe('ispRepo', () => {
  /* ── parseYmdLocal ── */
  it('parseYmdLocal should create local date at midnight (no timezone drift)', () => {
    const d = parseYmdLocal('2026-05-31');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May = 4
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  /* ── computeDiff ── */
  it('computeDiff returns same when text is identical', () => {
    const result = computeDiff('abc', 'abc');
    expect(result).toEqual([{ type: 'same', text: 'abc' }]);
  });

  it('computeDiff returns add when old is empty', () => {
    const result = computeDiff('', '新しい');
    expect(result).toEqual([{ type: 'add', text: '新しい' }]);
  });

  it('computeDiff returns del when new is empty', () => {
    const result = computeDiff('古い', '');
    expect(result).toEqual([{ type: 'del', text: '古い' }]);
  });

  it('computeDiff detects character-level changes', () => {
    const result = computeDiff('ABC', 'AXC');
    expect(result.length).toBeGreaterThan(1);
    expect(result.some((s) => s.type === 'add')).toBe(true);
    expect(result.some((s) => s.type === 'del')).toBe(true);
    expect(result.some((s) => s.type === 'same')).toBe(true);
  });

  it('computeDiff returns empty array for both empty', () => {
    expect(computeDiff('', '')).toEqual([]);
  });

  /* ── createEmptyCurrentPlan ── */
  it('createEmptyCurrentPlan returns plan with empty goals', () => {
    const plan = createEmptyCurrentPlan();
    expect(plan.goals.length).toBe(5);
    expect(plan.goals.every((g) => g.text === '')).toBe(true);
    expect(plan.status).toBe('draft');
  });

  it('createEmptyCurrentPlan creates independent objects', () => {
    const a = createEmptyCurrentPlan();
    const b = createEmptyCurrentPlan();
    a.goals[0].text = 'modified';
    expect(b.goals[0].text).toBe('');
  });

  it('createEmptyCurrentPlan accepts custom userName and certExpiry', () => {
    const plan = createEmptyCurrentPlan('田中 花子', '2027-03-31');
    expect(plan.userName).toBe('田中 花子');
    expect(plan.certExpiry).toBe('2027-03-31');
  });

  /* ── DOMAINS ── */
  it('DOMAINS has 5 entries with required fields', () => {
    expect(DOMAINS.length).toBe(5);
    DOMAINS.forEach((d) => {
      expect(d.id).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.color).toMatch(/^#/);
    });
  });

  /* ── Draft CRUD (LocalStorage) ── */
  describe('draft CRUD', () => {
    const userId = 'test-user-1';
    const planPeriod = '2025年10月〜2026年3月';

    beforeEach(() => {
      localStorage.clear();
    });
    afterEach(() => {
      localStorage.clear();
    });

    it('draftKey includes userId and planPeriod', () => {
      const key = draftKey(userId, planPeriod);
      expect(key).toContain(userId);
      expect(key).toContain(planPeriod);
    });

    it('loadDraft returns null when no draft exists', () => {
      expect(loadDraft(userId, planPeriod)).toBeNull();
    });

    it('saveDraft stores and loadDraft reads back', () => {
      const plan = createEmptyCurrentPlan();
      plan.goals[0].text = 'テスト目標';
      const { savedAt } = saveDraft(userId, planPeriod, plan);
      expect(savedAt).toBeGreaterThan(0);

      const loaded = loadDraft(userId, planPeriod);
      expect(loaded).not.toBeNull();
      expect(loaded!.goals[0].text).toBe('テスト目標');
    });

    it('deleteDraft clears the draft', () => {
      const plan = createEmptyCurrentPlan();
      saveDraft(userId, planPeriod, plan);
      expect(loadDraft(userId, planPeriod)).not.toBeNull();

      deleteDraft(userId, planPeriod);
      expect(loadDraft(userId, planPeriod)).toBeNull();
    });

    it('different userId+planPeriod keys do not conflict', () => {
      const plan1 = createEmptyCurrentPlan();
      plan1.goals[0].text = 'ユーザー1';
      saveDraft('u1', planPeriod, plan1);

      const plan2 = createEmptyCurrentPlan();
      plan2.goals[0].text = 'ユーザー2';
      saveDraft('u2', planPeriod, plan2);

      expect(loadDraft('u1', planPeriod)!.goals[0].text).toBe('ユーザー1');
      expect(loadDraft('u2', planPeriod)!.goals[0].text).toBe('ユーザー2');
    });
  });
});
