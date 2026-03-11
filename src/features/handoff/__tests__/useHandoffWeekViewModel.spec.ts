import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import {
  buildTopCategories,
  buildWeekBuckets,
  buildWeekSummary,
  groupHandoffsByDate,
} from '../hooks/useHandoffWeekViewModel';

// ── Test helpers ──

function makeRecord(overrides: Partial<HandoffRecord> & { createdAt: string }): HandoffRecord {
  const defaults: Omit<HandoffRecord, 'createdAt'> = {
    id: Math.floor(Math.random() * 10000),
    title: 'テスト',
    message: 'テストメッセージ',
    userCode: 'U001',
    userDisplayName: 'テストユーザー',
    category: 'その他',
    severity: '通常',
    status: '未対応',
    timeBand: '朝',
    createdByName: 'テスト',
    isDraft: false,
  };
  return { ...defaults, ...overrides };
}

describe('useHandoffWeekViewModel pure helpers', () => {
  // ── buildWeekBuckets ──
  describe('buildWeekBuckets', () => {
    it('月〜日の7日分のバケットを生成する', () => {
      const buckets = buildWeekBuckets('2026-03-09', '2026-03-15');
      expect(buckets).toHaveLength(7);

      // 月〜日の順
      expect(buckets[0].date).toBe('2026-03-09');
      expect(buckets[0].label).toContain('3/9');
      expect(buckets[0].label).toContain('月');

      expect(buckets[6].date).toBe('2026-03-15');
      expect(buckets[6].label).toContain('3/15');
      expect(buckets[6].label).toContain('日');
    });

    it('曜日インデックスが正しい (月=1, 日=0)', () => {
      const buckets = buildWeekBuckets('2026-03-09', '2026-03-15');
      expect(buckets[0].dayOfWeek).toBe(1); // Monday
      expect(buckets[6].dayOfWeek).toBe(0); // Sunday
    });

    it('初期値は全て 0', () => {
      const buckets = buildWeekBuckets('2026-03-09', '2026-03-15');
      for (const b of buckets) {
        expect(b.count).toBe(0);
        expect(b.criticalCount).toBe(0);
        expect(b.unhandledCount).toBe(0);
      }
    });

    it('月跨ぎでも正しく生成', () => {
      // 2025-12-29 (月) 〜 2026-01-04 (日)
      const buckets = buildWeekBuckets('2025-12-29', '2026-01-04');
      expect(buckets).toHaveLength(7);
      expect(buckets[0].date).toBe('2025-12-29');
      expect(buckets[3].date).toBe('2026-01-01');
      expect(buckets[6].date).toBe('2026-01-04');
    });

    it('未来日フラグが付く', () => {
      // 十分未来の日付を使う
      const buckets = buildWeekBuckets('2099-01-06', '2099-01-12');
      for (const b of buckets) {
        expect(b.isFuture).toBe(true);
      }
    });

    it('無効入力で空配列', () => {
      expect(buildWeekBuckets('invalid', 'bad')).toEqual([]);
    });
  });

  // ── groupHandoffsByDate ──
  describe('groupHandoffsByDate', () => {
    const weekRange: [string, string] = ['2026-03-09', '2026-03-15'];

    it('レコードを日付でバケットに振り分ける', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-09T09:00:00.000+09:00' }),
        makeRecord({ createdAt: '2026-03-09T14:00:00.000+09:00' }),
        makeRecord({ createdAt: '2026-03-11T10:00:00.000+09:00' }),
      ];

      const days = groupHandoffsByDate(items, weekRange);
      // 月曜 (3/9) に2件
      expect(days[0].count).toBe(2);
      // 水曜 (3/11) に1件
      expect(days[2].count).toBe(1);
      // それ以外は0件
      expect(days[1].count).toBe(0);
      expect(days[3].count).toBe(0);
    });

    it('severity=重要 を criticalCount にカウントする', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', severity: '重要' }),
        makeRecord({ createdAt: '2026-03-10T10:00:00.000+09:00', severity: '通常' }),
        makeRecord({ createdAt: '2026-03-10T11:00:00.000+09:00', severity: '要注意' }),
      ];

      const days = groupHandoffsByDate(items, weekRange);
      // 火曜 (3/10)
      expect(days[1].count).toBe(3);
      expect(days[1].criticalCount).toBe(1);
    });

    it('status=未対応 を unhandledCount にカウントする', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-12T09:00:00.000+09:00', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-12T10:00:00.000+09:00', status: '対応済' }),
        makeRecord({ createdAt: '2026-03-12T11:00:00.000+09:00', status: '未対応' }),
      ];

      const days = groupHandoffsByDate(items, weekRange);
      // 木曜 (3/12)
      expect(days[3].count).toBe(3);
      expect(days[3].unhandledCount).toBe(2);
    });

    it('週範囲外のレコードは無視される', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-08T09:00:00.000+09:00' }), // 前週日曜
        makeRecord({ createdAt: '2026-03-16T09:00:00.000+09:00' }), // 翌週月曜
      ];

      const days = groupHandoffsByDate(items, weekRange);
      for (const d of days) {
        expect(d.count).toBe(0);
      }
    });

    it('空配列でも7日分のバケットが返る', () => {
      const days = groupHandoffsByDate([], weekRange);
      expect(days).toHaveLength(7);
    });

    it('カテゴリ別の上位2件が topCategories に入る', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T10:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T11:00:00.000+09:00', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-10T12:00:00.000+09:00', category: '家族連絡' }),
      ];

      const days = groupHandoffsByDate(items, weekRange);
      // 火曜 (3/10) の上位カテゴリ
      expect(days[1].topCategories).toHaveLength(2);
      expect(days[1].topCategories[0]).toEqual({ category: '体調', count: 2 });
      // 行動面と家族連絡は同数→優先度が高い行動面が2番目
      expect(days[1].topCategories[1]).toEqual({ category: '行動面', count: 1 });
    });

    it('事故・ヒヤリがある日は hasIncident=true', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-11T09:00:00.000+09:00', category: '事故・ヒヤリ' }),
        makeRecord({ createdAt: '2026-03-11T10:00:00.000+09:00', category: '体調' }),
      ];

      const days = groupHandoffsByDate(items, weekRange);
      expect(days[2].hasIncident).toBe(true);
      // 事故・ヒヤリがない日は false
      expect(days[0].hasIncident).toBe(false);
    });
  });

  // ── buildWeekSummary ──
  describe('buildWeekSummary', () => {
    it('全日の合計を計算する', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-09T09:00:00.000+09:00', severity: '重要', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', severity: '通常', status: '対応済' }),
        makeRecord({ createdAt: '2026-03-11T09:00:00.000+09:00', severity: '重要', status: '未対応' }),
      ];

      const weekRange: [string, string] = ['2026-03-09', '2026-03-15'];
      const days = groupHandoffsByDate(items, weekRange);
      const summary = buildWeekSummary(days);

      expect(summary.totalCount).toBe(3);
      expect(summary.criticalCount).toBe(2);
      expect(summary.unhandledCount).toBe(2);
      expect(summary.hasAnyItems).toBe(true);
      expect(summary.days).toHaveLength(7);
    });

    it('全件0なら hasAnyItems=false', () => {
      const weekRange: [string, string] = ['2026-03-09', '2026-03-15'];
      const days = groupHandoffsByDate([], weekRange);
      const summary = buildWeekSummary(days);

      expect(summary.totalCount).toBe(0);
      expect(summary.hasAnyItems).toBe(false);
    });

    it('週全体の topCategories が集計される', () => {
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-09T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T10:00:00.000+09:00', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-11T09:00:00.000+09:00', category: '事故・ヒヤリ' }),
      ];

      const weekRange: [string, string] = ['2026-03-09', '2026-03-15'];
      const days = groupHandoffsByDate(items, weekRange);
      const summary = buildWeekSummary(days);

      expect(summary.topCategories[0]).toEqual({ category: '体調', count: 2 });
      expect(summary.hasIncident).toBe(true);
    });
  });

  // ── buildTopCategories ──
  describe('buildTopCategories', () => {
    it('件数降順で上位N件を返す', () => {
      const catMap = new Map<string, number>([
        ['体調', 3],
        ['行動面', 5],
        ['家族連絡', 1],
      ]);
      const result = buildTopCategories(catMap, 2);
      expect(result[0]).toEqual({ category: '行動面', count: 5 });
      expect(result[1]).toEqual({ category: '体調', count: 3 });
    });

    it('同件数なら優先度が高いカテゴリが上', () => {
      const catMap = new Map<string, number>([
        ['その他', 2],
        ['事故・ヒヤリ', 2],
      ]);
      const result = buildTopCategories(catMap, 2);
      expect(result[0].category).toBe('事故・ヒヤリ');
      expect(result[1].category).toBe('その他');
    });

    it('0件のカテゴリは除外', () => {
      const catMap = new Map<string, number>([
        ['体調', 0],
        ['行動面', 1],
      ]);
      const result = buildTopCategories(catMap, 3);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('行動面');
    });
  });
});
