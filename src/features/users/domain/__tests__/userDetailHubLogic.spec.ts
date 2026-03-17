/**
 * @fileoverview UserDetailHub ロジックの単体テスト
 * @description
 * MVP-003: buildQuickActions / buildSummaryStats の純粋関数テスト
 */

import { describe, it, expect } from 'vitest';
import { buildQuickActions, buildSummaryStats } from '../userDetailHubLogic';

describe('buildQuickActions', () => {
  it('4つのクイックアクションを返す', () => {
    const actions = buildQuickActions('U-001');
    expect(actions).toHaveLength(4);
  });

  it('各アクションにuserIdが含まれるパスを持つ', () => {
    const actions = buildQuickActions('U-001');
    actions.forEach((action) => {
      expect(action.path).toContain('U-001');
    });
  });

  it('キーが一意である', () => {
    const actions = buildQuickActions('U-001');
    const keys = actions.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('特殊文字を含むuserIdがエンコードされる', () => {
    const actions = buildQuickActions('U 001');
    const todayAction = actions.find((a) => a.key === 'today-record');
    expect(todayAction?.path).toContain('U%20001');
  });
});

describe('buildSummaryStats', () => {
  it('最小パラメータで基本統計を返す', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      isHighIntensity: false,
    });
    // today-record, latest-record, support-level (3つ)
    expect(stats.length).toBeGreaterThanOrEqual(3);
  });

  it('今日の記録が未入力なら attention', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      isHighIntensity: false,
    });
    const todayStat = stats.find((s) => s.key === 'today-record');
    expect(todayStat?.severity).toBe('attention');
    expect(todayStat?.value).toBe('未入力');
  });

  it('今日の記録が入力済みなら good', () => {
    const stats = buildSummaryStats({
      todayRecordExists: true,
      isHighIntensity: false,
    });
    const todayStat = stats.find((s) => s.key === 'today-record');
    expect(todayStat?.severity).toBe('good');
    expect(todayStat?.value).toBe('入力済み');
  });

  it('最新記録がなければ "—" を表示', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      latestDailyRecord: null,
      isHighIntensity: false,
    });
    const latestStat = stats.find((s) => s.key === 'latest-record');
    expect(latestStat?.value).toBe('—');
    expect(latestStat?.severity).toBe('attention');
  });

  it('最新記録があれば日付を表示', () => {
    const stats = buildSummaryStats({
      todayRecordExists: true,
      latestDailyRecord: { date: '2026-03-17', status: '完了' },
      isHighIntensity: false,
    });
    const latestStat = stats.find((s) => s.key === 'latest-record');
    expect(latestStat?.value).toBe('2026-03-17');
    expect(latestStat?.severity).toBe('normal');
  });

  it('申し送り情報がある場合にカードを追加', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      handoffInfo: { total: 3, criticalCount: 1 },
      isHighIntensity: false,
    });
    const handoffStat = stats.find((s) => s.key === 'handoff');
    expect(handoffStat).toBeDefined();
    expect(handoffStat?.severity).toBe('attention');
    expect(handoffStat?.value).toContain('3件');
    expect(handoffStat?.value).toContain('重要1件');
  });

  it('申し送りの重要件数が0なら normal', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      handoffInfo: { total: 2, criticalCount: 0 },
      isHighIntensity: false,
    });
    const handoffStat = stats.find((s) => s.key === 'handoff');
    expect(handoffStat?.severity).toBe('normal');
  });

  it('強度行動障害対象なら attention', () => {
    const stats = buildSummaryStats({
      todayRecordExists: false,
      isHighIntensity: true,
    });
    const supportStat = stats.find((s) => s.key === 'support-level');
    expect(supportStat?.severity).toBe('attention');
    expect(supportStat?.value).toContain('強度行動障害');
  });
});
