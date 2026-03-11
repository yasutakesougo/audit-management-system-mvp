import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import {
  buildMonthGrid,
  buildMonthSummary,
  populateMonthGrid,
} from '../hooks/useHandoffMonthViewModel';

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

describe('useHandoffMonthViewModel pure helpers', () => {
  // ── buildMonthGrid ──
  describe('buildMonthGrid', () => {
    it('2026年3月のグリッドを生成する', () => {
      const weeks = buildMonthGrid(2026, 3);

      // 3月1日は日曜 → 月曜始まりなので前の週が必要
      expect(weeks.length).toBeGreaterThanOrEqual(4);
      expect(weeks.length).toBeLessThanOrEqual(6);

      // 各行は7日
      for (const week of weeks) {
        expect(week.days).toHaveLength(7);
      }
    });

    it('月曜始まりで各行が月〜日の順', () => {
      const weeks = buildMonthGrid(2026, 3);
      for (const week of weeks) {
        // 月=1, 火=2, ..., 土=6, 日=0
        expect(week.days[0].dayOfWeek).toBe(1); // 月曜
        expect(week.days[6].dayOfWeek).toBe(0); // 日曜
      }
    });

    it('対象月の日は isCurrentMonth=true', () => {
      const weeks = buildMonthGrid(2026, 3);
      const marchDays = weeks.flatMap(w => w.days).filter(d => d.isCurrentMonth);
      expect(marchDays).toHaveLength(31); // 3月は31日
    });

    it('パディング日は isCurrentMonth=false', () => {
      const weeks = buildMonthGrid(2026, 3);
      const allDays = weeks.flatMap(w => w.days);
      const paddingDays = allDays.filter(d => !d.isCurrentMonth);
      expect(paddingDays.length).toBeGreaterThan(0);
    });

    it('2月 (閏年2024) も正しく生成', () => {
      const weeks = buildMonthGrid(2024, 2);
      const febDays = weeks.flatMap(w => w.days).filter(d => d.isCurrentMonth);
      expect(febDays).toHaveLength(29); // 2024年は閏年
    });

    it('初期値は全て count=0', () => {
      const weeks = buildMonthGrid(2026, 3);
      for (const week of weeks) {
        for (const day of week.days) {
          expect(day.count).toBe(0);
          expect(day.unhandledCount).toBe(0);
        }
      }
    });
  });

  // ── populateMonthGrid ──
  describe('populateMonthGrid', () => {
    it('レコードを日付でセルに振り分ける', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00' }),
        makeRecord({ createdAt: '2026-03-10T14:00:00.000+09:00' }),
        makeRecord({ createdAt: '2026-03-11T10:00:00.000+09:00' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const allDays = populated.flatMap(w => w.days);

      const mar10 = allDays.find(d => d.date === '2026-03-10');
      const mar11 = allDays.find(d => d.date === '2026-03-11');
      expect(mar10?.count).toBe(2);
      expect(mar11?.count).toBe(1);
    });

    it('カテゴリチップが集計される', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T10:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T11:00:00.000+09:00', category: '行動面' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const allDays = populated.flatMap(w => w.days);
      const mar10 = allDays.find(d => d.date === '2026-03-10')!;

      expect(mar10.topCategories).toHaveLength(2);
      expect(mar10.topCategories[0]).toEqual({ category: '体調', count: 2 });
    });

    it('事故・ヒヤリがある日は hasIncident=true', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-15T09:00:00.000+09:00', category: '事故・ヒヤリ' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const allDays = populated.flatMap(w => w.days);
      const mar15 = allDays.find(d => d.date === '2026-03-15')!;

      expect(mar15.hasIncident).toBe(true);
      expect(mar15.count).toBe(1);
    });

    it('未対応件数がカウントされる', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-12T09:00:00.000+09:00', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-12T10:00:00.000+09:00', status: '対応済' }),
        makeRecord({ createdAt: '2026-03-12T11:00:00.000+09:00', status: '未対応' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const allDays = populated.flatMap(w => w.days);
      const mar12 = allDays.find(d => d.date === '2026-03-12')!;

      expect(mar12.unhandledCount).toBe(2);
    });
  });

  // ── buildMonthSummary ──
  describe('buildMonthSummary', () => {
    it('月全体の集計が正しい', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-09T09:00:00.000+09:00', category: '体調', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', category: '体調', status: '対応済' }),
        makeRecord({ createdAt: '2026-03-11T09:00:00.000+09:00', category: '事故・ヒヤリ', status: '未対応' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const summary = buildMonthSummary(populated, 2026, 3);

      expect(summary.year).toBe(2026);
      expect(summary.month).toBe(3);
      expect(summary.totalCount).toBe(3);
      expect(summary.unhandledCount).toBe(2);
      expect(summary.hasIncident).toBe(true);
      expect(summary.hasAnyItems).toBe(true);
    });

    it('パディング日のデータは集計に含まれない', () => {
      const grid = buildMonthGrid(2026, 3);
      // 3月のグリッドには2月末や4月頭のパディングがある
      // 2月のレコードは totalCount に含まれるべきではない
      // (ただし populateMonthGrid はパディング日にもカウントするので、
      //  buildMonthSummary で isCurrentMonth=false を除外する)
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-02-28T09:00:00.000+09:00' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const summary = buildMonthSummary(populated, 2026, 3);

      // 2月28日は3月のグリッドのパディング日
      // buildMonthSummary は isCurrentMonth=false を除外する
      expect(summary.totalCount).toBe(0);
    });

    it('空データなら hasAnyItems=false', () => {
      const grid = buildMonthGrid(2026, 3);
      const summary = buildMonthSummary(grid, 2026, 3);

      expect(summary.totalCount).toBe(0);
      expect(summary.hasAnyItems).toBe(false);
    });

    it('月全体の topCategories が集計される', () => {
      const grid = buildMonthGrid(2026, 3);
      const items: HandoffRecord[] = [
        makeRecord({ createdAt: '2026-03-01T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-10T09:00:00.000+09:00', category: '体調' }),
        makeRecord({ createdAt: '2026-03-20T09:00:00.000+09:00', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-25T09:00:00.000+09:00', category: '事故・ヒヤリ' }),
      ];

      const populated = populateMonthGrid(grid, items);
      const summary = buildMonthSummary(populated, 2026, 3);

      expect(summary.topCategories[0]).toEqual({ category: '体調', count: 2 });
      expect(summary.topCategories.length).toBeLessThanOrEqual(3);
    });
  });
});
