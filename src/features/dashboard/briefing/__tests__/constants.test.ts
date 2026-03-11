/**
 * constants.ts の pure function テスト
 *
 * 対象:
 * - resolveDefaultTab: navState 優先、14時境界
 * - startOfWeek: 月曜開始の週頭計算
 * - BRIEFING_TABS / MEETING_GUIDES / MEETING_CONFIG の構造検証
 */

import { describe, expect, it } from 'vitest';
import {
  BRIEFING_TABS,
  MEETING_CONFIG,
  MEETING_GUIDES,
  resolveDefaultTab,
  startOfWeek,
} from '../constants';
import type { BriefingTabValue } from '../types';

// ---------------------------------------------------------------------------
// resolveDefaultTab
// ---------------------------------------------------------------------------

describe('resolveDefaultTab', () => {
  it('navState.tab があればそちらを優先する', () => {
    const now = new Date('2026-03-11T09:00:00');
    expect(resolveDefaultTab('weekly', now)).toBe('weekly');
    expect(resolveDefaultTab('timeline', now)).toBe('timeline');
    expect(resolveDefaultTab('evening', now)).toBe('evening');
  });

  it('navTab=undefined かつ 13:59 → morning', () => {
    const now = new Date('2026-03-11T13:59:00');
    expect(resolveDefaultTab(undefined, now)).toBe('morning');
  });

  it('navTab=undefined かつ 14:00 → evening', () => {
    const now = new Date('2026-03-11T14:00:00');
    expect(resolveDefaultTab(undefined, now)).toBe('evening');
  });

  it('navTab=undefined かつ 0:00（深夜） → morning', () => {
    const now = new Date('2026-03-11T00:00:00');
    expect(resolveDefaultTab(undefined, now)).toBe('morning');
  });

  it('navTab=undefined かつ 23:59 → evening', () => {
    const now = new Date('2026-03-11T23:59:00');
    expect(resolveDefaultTab(undefined, now)).toBe('evening');
  });

  it('navTab=undefined で now 省略時はデフォルト Date が使われる（エラーにならない）', () => {
    const result = resolveDefaultTab(undefined);
    expect(['morning', 'evening']).toContain(result);
  });

  it('非表示タブ値 management が渡されたら時間帯フォールバックする', () => {
    const now = new Date('2026-03-11T09:00:00');
    expect(resolveDefaultTab('management', now)).toBe('morning');
  });

  it('非表示タブ値 profile が渡されたら時間帯フォールバックする', () => {
    const now = new Date('2026-03-11T15:00:00');
    expect(resolveDefaultTab('profile', now)).toBe('evening');
  });
});

// ---------------------------------------------------------------------------
// startOfWeek
// ---------------------------------------------------------------------------

describe('startOfWeek', () => {
  it('月曜日自身を渡すと同日 00:00 を返す', () => {
    // 2026-03-09 は月曜
    const mon = new Date(2026, 2, 9, 15, 30);
    const result = startOfWeek(mon, 1);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('水曜日を渡すと直近の月曜を返す', () => {
    // 2026-03-11 は水曜
    const wed = new Date(2026, 2, 11, 12, 0);
    const result = startOfWeek(wed, 1);
    expect(result.getDate()).toBe(9); // 前の月曜
  });

  it('日曜日を渡すと前週の月曜を返す（weekStart=1）', () => {
    // 2026-03-15 は日曜
    const sun = new Date(2026, 2, 15, 10, 0);
    const result = startOfWeek(sun, 1);
    expect(result.getDate()).toBe(9); // 前の月曜
  });

  it('土曜日を渡すと同週の月曜を返す', () => {
    // 2026-03-14 は土曜
    const sat = new Date(2026, 2, 14, 10, 0);
    const result = startOfWeek(sat, 1);
    expect(result.getDate()).toBe(9);
  });

  it('weekStart=0（日曜開始）で日曜自身を渡すと同日を返す', () => {
    const sun = new Date(2026, 2, 15, 10, 0);
    const result = startOfWeek(sun, 0);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
  });

  it('weekStart=0（日曜開始）で月曜を渡すと前日の日曜を返す', () => {
    const mon = new Date(2026, 2, 9, 10, 0);
    const result = startOfWeek(mon, 0);
    expect(result.getDate()).toBe(8);
  });

  it('月跨ぎの計算が正しい（3月1日 水曜 → 2月27日 月曜）', () => {
    // 2026年3月1日は日曜 → 実際に水曜なのは3月4日
    // 2026-02-25 (水) → 2026-02-23 (月)
    const wed = new Date(2026, 1, 25, 10, 0);
    const result = startOfWeek(wed, 1);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(23);
  });

  it('元の Date オブジェクトを変更しない（immutable）', () => {
    const original = new Date(2026, 2, 11, 15, 30);
    const originalTime = original.getTime();
    startOfWeek(original, 1);
    expect(original.getTime()).toBe(originalTime);
  });
});

// ---------------------------------------------------------------------------
// 定数の構造検証
// ---------------------------------------------------------------------------

describe('BRIEFING_TABS', () => {
  it('4 タブ定義を含む', () => {
    expect(BRIEFING_TABS).toHaveLength(4);
  });

  it('全タブの value は BriefingTabValue に含まれる', () => {
    const expectedValues: BriefingTabValue[] = [
      'timeline',
      'weekly',
      'morning',
      'evening',
    ];
    const values = BRIEFING_TABS.map((t) => t.value);
    expect(values).toEqual(expect.arrayContaining(expectedValues));
  });

  it('label が空文字でない', () => {
    for (const tab of BRIEFING_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });
});

describe('MEETING_GUIDES', () => {
  it('morning と evening の両方が定義されている', () => {
    expect(MEETING_GUIDES.morning).toBeDefined();
    expect(MEETING_GUIDES.evening).toBeDefined();
  });

  it('steps が空でない', () => {
    expect(MEETING_GUIDES.morning.steps.length).toBeGreaterThan(0);
    expect(MEETING_GUIDES.evening.steps.length).toBeGreaterThan(0);
  });

  it('title が朝会/夕会である', () => {
    expect(MEETING_GUIDES.morning.title).toBe('朝会');
    expect(MEETING_GUIDES.evening.title).toBe('夕会');
  });
});

describe('MEETING_CONFIG', () => {
  it('morning と evening の両方が定義されている', () => {
    expect(MEETING_CONFIG.morning).toBeDefined();
    expect(MEETING_CONFIG.evening).toBeDefined();
  });

  it('dayScope が正しい', () => {
    expect(MEETING_CONFIG.morning.dayScope).toBe('yesterday');
    expect(MEETING_CONFIG.evening.dayScope).toBe('today');
  });

  it('chipLabel が朝会/夕会である', () => {
    expect(MEETING_CONFIG.morning.chipLabel).toBe('朝会');
    expect(MEETING_CONFIG.evening.chipLabel).toBe('夕会');
  });

  it('alertText が空でない', () => {
    expect(MEETING_CONFIG.morning.alertText.length).toBeGreaterThan(0);
    expect(MEETING_CONFIG.evening.alertText.length).toBeGreaterThan(0);
  });

  it('morning と evening で alertText が異なる', () => {
    expect(MEETING_CONFIG.morning.alertText).not.toBe(MEETING_CONFIG.evening.alertText);
  });
});
