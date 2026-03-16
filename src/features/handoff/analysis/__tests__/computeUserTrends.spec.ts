import { describe, it, expect } from 'vitest';
import { computeUserTrends } from '../computeUserTrends';
import type { HandoffRecord } from '../../handoffTypes';

// ── テストヘルパー ──

let idCounter = 0;

function makeRecord(
  overrides: Partial<HandoffRecord> & Pick<HandoffRecord, 'userCode' | 'message'>,
): HandoffRecord {
  idCounter++;
  return {
    id: idCounter,
    title: 'テスト',
    userDisplayName: `${overrides.userCode}の名前`,
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdAt: '2026-03-10T10:00:00Z',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

// 各テスト前にカウンターリセット
function resetIds() { idCounter = 0; }

// ────────────────────────────────────────────────────────────
// 基本動作
// ────────────────────────────────────────────────────────────

describe('computeUserTrends', () => {
  describe('基本動作', () => {
    it('returns empty array for empty records', () => {
      resetIds();
      expect(computeUserTrends([])).toEqual([]);
    });

    it('groups records by userCode', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: '発熱あり' }),
        makeRecord({ userCode: 'U001', message: '嘔吐1回' }),
        makeRecord({ userCode: 'U002', message: '笑顔が見られた' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends).toHaveLength(2);
      expect(trends[0].userCode).toBe('U001'); // 2件 > 1件
      expect(trends[0].totalMentions).toBe(2);
      expect(trends[1].userCode).toBe('U002');
      expect(trends[1].totalMentions).toBe(1);
    });

    it('sorts by totalMentions descending', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: 'テスト' }),
        makeRecord({ userCode: 'U002', message: 'テスト' }),
        makeRecord({ userCode: 'U002', message: 'テスト' }),
        makeRecord({ userCode: 'U002', message: 'テスト' }),
        makeRecord({ userCode: 'U003', message: 'テスト' }),
        makeRecord({ userCode: 'U003', message: 'テスト' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends[0].userCode).toBe('U002'); // 3件
      expect(trends[1].userCode).toBe('U003'); // 2件
      expect(trends[2].userCode).toBe('U001'); // 1件
    });

    it('uses stable sort for equal totalMentions (userCode ascending)', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U003', message: 'テスト' }),
        makeRecord({ userCode: 'U001', message: 'テスト' }),
        makeRecord({ userCode: 'U002', message: 'テスト' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends.map(t => t.userCode)).toEqual(['U001', 'U002', 'U003']);
    });
  });

  // ────────────────────────────────────────────────────────────
  // topCategories
  // ────────────────────────────────────────────────────────────

  describe('topCategories', () => {
    it('returns categories sorted by count descending', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: '発熱', category: '体調' }),
        makeRecord({ userCode: 'U001', message: '発熱', category: '体調' }),
        makeRecord({ userCode: 'U001', message: '不穏', category: '行動面' }),
        makeRecord({ userCode: 'U001', message: '笑顔', category: '良かったこと' }),
        makeRecord({ userCode: 'U001', message: '転倒', category: '事故・ヒヤリ' }),
      ];

      const trends = computeUserTrends(records);
      const top = trends[0].topCategories;

      expect(top[0].category).toBe('体調');
      expect(top[0].count).toBe(2);
      // デフォルト topCategoryCount = 3
      expect(top.length).toBeLessThanOrEqual(3);
    });

    it('respects topCategoryCount option', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', category: '体調' }),
        makeRecord({ userCode: 'U001', message: 'b', category: '行動面' }),
        makeRecord({ userCode: 'U001', message: 'c', category: '良かったこと' }),
        makeRecord({ userCode: 'U001', message: 'd', category: '事故・ヒヤリ' }),
      ];

      const trends = computeUserTrends(records, { topCategoryCount: 2 });

      expect(trends[0].topCategories).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────
  // topKeywords (extractKeywords 再利用)
  // ────────────────────────────────────────────────────────────

  describe('topKeywords', () => {
    it('extracts keywords using extractKeywords engine', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: '午前中に発熱あり。体温37.8℃。' }),
        makeRecord({ userCode: 'U001', message: '嘔吐が1回あった。' }),
      ];

      const trends = computeUserTrends(records);
      const keywords = trends[0].topKeywords;

      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.some(k => k.keyword === '発熱')).toBe(true);
    });

    it('limits to topKeywordCount (default 5)', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: '発熱 嘔吐 下痢 便秘 頭痛 腹痛 脱水 浮腫' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends[0].topKeywords.length).toBeLessThanOrEqual(5);
    });

    it('respects topKeywordCount option', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: '発熱 嘔吐 下痢 便秘 頭痛 腹痛' }),
      ];

      const trends = computeUserTrends(records, { topKeywordCount: 2 });

      expect(trends[0].topKeywords.length).toBeLessThanOrEqual(2);
    });
  });

  // ────────────────────────────────────────────────────────────
  // severityDistribution
  // ────────────────────────────────────────────────────────────

  describe('severityDistribution', () => {
    it('returns zero-filled severity distribution', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: 'テスト', severity: '通常' }),
      ];

      const trends = computeUserTrends(records);
      const dist = trends[0].severityDistribution;

      expect(dist).toEqual({
        '通常': 1,
        '要注意': 0,
        '重要': 0,
      });
    });

    it('counts all severity levels correctly', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', severity: '通常' }),
        makeRecord({ userCode: 'U001', message: 'b', severity: '通常' }),
        makeRecord({ userCode: 'U001', message: 'c', severity: '要注意' }),
        makeRecord({ userCode: 'U001', message: 'd', severity: '重要' }),
        makeRecord({ userCode: 'U001', message: 'e', severity: '重要' }),
        makeRecord({ userCode: 'U001', message: 'f', severity: '重要' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends[0].severityDistribution).toEqual({
        '通常': 2,
        '要注意': 1,
        '重要': 3,
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // recentTrend
  // ────────────────────────────────────────────────────────────

  describe('recentTrend', () => {
    const BASE = new Date('2026-03-16T12:00:00Z');

    it('returns increasing when recent > prev × 1.2', () => {
      resetIds();
      // 直近7日: 5件, 前7日: 2件 → 5 > 2×1.2 → increasing
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', createdAt: '2026-03-15T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'b', createdAt: '2026-03-14T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'c', createdAt: '2026-03-13T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'd', createdAt: '2026-03-12T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'e', createdAt: '2026-03-11T10:00:00Z' }),
        // 前7日
        makeRecord({ userCode: 'U001', message: 'f', createdAt: '2026-03-05T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'g', createdAt: '2026-03-04T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { baseDate: BASE });

      expect(trends[0].recentTrend).toBe('increasing');
    });

    it('returns decreasing when recent < prev × 0.8', () => {
      resetIds();
      // 直近7日: 1件, 前7日: 5件 → 1 < 5×0.8 → decreasing
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', createdAt: '2026-03-15T10:00:00Z' }),
        // 前7日
        makeRecord({ userCode: 'U001', message: 'b', createdAt: '2026-03-05T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'c', createdAt: '2026-03-04T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'd', createdAt: '2026-03-03T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'e', createdAt: '2026-03-06T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'f', createdAt: '2026-03-07T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { baseDate: BASE });

      expect(trends[0].recentTrend).toBe('decreasing');
    });

    it('returns stable when counts are similar', () => {
      resetIds();
      // 直近7日: 3件, 前7日: 3件 → stable
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', createdAt: '2026-03-15T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'b', createdAt: '2026-03-14T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'c', createdAt: '2026-03-13T10:00:00Z' }),
        // 前7日
        makeRecord({ userCode: 'U001', message: 'd', createdAt: '2026-03-05T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'e', createdAt: '2026-03-04T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'f', createdAt: '2026-03-03T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { baseDate: BASE });

      expect(trends[0].recentTrend).toBe('stable');
    });

    it('returns stable when both periods have zero records', () => {
      resetIds();
      // 全レコードが14日以上前
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', createdAt: '2026-02-20T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { baseDate: BASE });

      expect(trends[0].recentTrend).toBe('stable');
    });

    it('returns increasing when prev is zero but recent has records', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', message: 'a', createdAt: '2026-03-15T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: 'b', createdAt: '2026-03-14T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { baseDate: BASE });

      expect(trends[0].recentTrend).toBe('increasing');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 期間フィルタ
  // ────────────────────────────────────────────────────────────

  describe('periodDays filter', () => {
    it('filters records to specified period', () => {
      resetIds();
      const BASE = new Date('2026-03-16T12:00:00Z');
      const records = [
        makeRecord({ userCode: 'U001', message: '最近', createdAt: '2026-03-15T10:00:00Z' }),
        makeRecord({ userCode: 'U001', message: '古い', createdAt: '2026-02-01T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { periodDays: 7, baseDate: BASE });

      expect(trends[0].totalMentions).toBe(1); // 直近7日のみ
    });

    it('returns empty when no records in period', () => {
      resetIds();
      const BASE = new Date('2026-03-16T12:00:00Z');
      const records = [
        makeRecord({ userCode: 'U001', message: '古い', createdAt: '2026-01-01T10:00:00Z' }),
      ];

      const trends = computeUserTrends(records, { periodDays: 7, baseDate: BASE });

      expect(trends).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // エッジケース
  // ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('ignores records with empty userCode', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: '', message: '発熱あり' }),
        makeRecord({ userCode: '  ', message: '嘔吐あり' }),
        makeRecord({ userCode: 'U001', message: '笑顔あり' }),
      ];

      const trends = computeUserTrends(records);

      expect(trends).toHaveLength(1);
      expect(trends[0].userCode).toBe('U001');
    });

    it('resolves displayName from most recent record', () => {
      resetIds();
      const records = [
        makeRecord({
          userCode: 'U001', message: 'a',
          userDisplayName: '旧名前',
          createdAt: '2026-03-10T10:00:00Z',
        }),
        makeRecord({
          userCode: 'U001', message: 'b',
          userDisplayName: '新名前',
          createdAt: '2026-03-15T10:00:00Z',
        }),
      ];

      const trends = computeUserTrends(records);

      expect(trends[0].userDisplayName).toBe('新名前');
    });
  });
});
