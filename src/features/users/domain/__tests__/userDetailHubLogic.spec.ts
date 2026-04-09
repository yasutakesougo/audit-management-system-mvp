/**
 * @fileoverview UserDetailHub ロジックの単体テスト
 * @description
 * MVP-003: buildQuickActions / buildSummaryStats の純粋関数テスト
 */

import { describe, it, expect } from 'vitest';
import {
  buildQuickActions,
  buildCommonQuickActions,
  buildIbdQuickActions,
  buildSummaryStats,
  buildRecentRecordPreview,
  buildRecentHandoffPreview,
  buildTodayUserSnapshot,
  buildPlanHighlights,
} from '../userDetailHubLogic';

describe('buildCommonQuickActions', () => {
  it('4つの共通アクションを返す', () => {
    expect(buildCommonQuickActions('U-001')).toHaveLength(4);
  });

  it('各アクションにuserIdが含まれるパスを持つ', () => {
    buildCommonQuickActions('U-001').forEach((action) => {
      expect(action.path).toContain('U-001');
    });
  });

  it('キーが一意である', () => {
    const keys = buildCommonQuickActions('U-001').map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('特殊文字を含むuserIdがエンコードされる', () => {
    const actions = buildCommonQuickActions('U 001');
    expect(actions.find((a) => a.key === 'today-record')?.path).toContain('U%20001');
  });

  it('日々の記録は /daily/table へ遷移する', () => {
    const actions = buildCommonQuickActions('U-001');
    expect(actions.find((a) => a.key === 'today-record')?.path).toContain('/daily/table');
  });
});

describe('buildIbdQuickActions', () => {
  it('3つのIBD専用アクションを返す', () => {
    expect(buildIbdQuickActions('U-001')).toHaveLength(3);
  });

  it('支援計画シート・支援手順の実施・見直しPDCAを含む', () => {
    const keys = buildIbdQuickActions('U-001').map((a) => a.key);
    expect(keys).toContain('ibd-planning-sheet');
    expect(keys).toContain('ibd-support-execution');
    expect(keys).toContain('ibd-pdca');
  });

  it('支援手順の実施は /daily/support へ遷移する', () => {
    const actions = buildIbdQuickActions('U-001');
    expect(actions.find((a) => a.key === 'ibd-support-execution')?.path).toContain('/daily/support');
  });

  it('特殊文字を含むuserIdがエンコードされる', () => {
    buildIbdQuickActions('U 001').forEach((action) => {
      expect(action.path).toContain('U%20001');
    });
  });
});

describe('buildQuickActions (後方互換)', () => {
  it('isIbdTarget=false（デフォルト）なら4件', () => {
    expect(buildQuickActions('U-001')).toHaveLength(4);
  });

  it('isIbdTarget=true なら共通4件+IBD3件=7件', () => {
    expect(buildQuickActions('U-001', true)).toHaveLength(7);
  });

  it('全アクションのキーが一意である', () => {
    const keys = buildQuickActions('U-001', true).map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
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

// ─── MVP-010 テスト ──────────────────────────────────────────────

describe('buildRecentRecordPreview', () => {
  const records = [
    { date: '2026-03-17', status: '完了', specialNotes: '転倒あり' },
    { date: '2026-03-16', status: '完了' },
    { date: '2026-03-15', status: '未完了' },
    { date: '2026-03-14', status: '完了' }, // limit で切られること確認
  ];

  it('limit 件数まで返す', () => {
    expect(buildRecentRecordPreview(records, 3)).toHaveLength(3);
  });

  it('特記事項があれば hasSpecialNote=true かつ excerot を含む', () => {
    const items = buildRecentRecordPreview(records, 3);
    expect(items[0].hasSpecialNote).toBe(true);
    expect(items[0].noteExcerpt).toBe('転倒あり');
  });

  it('特記事項がなければ hasSpecialNote=false', () => {
    const items = buildRecentRecordPreview(records, 3);
    expect(items[1].hasSpecialNote).toBe(false);
    expect(items[1].noteExcerpt).toBeUndefined();
  });

  it('60文字超の特記事項は切り詰める', () => {
    const longNote = 'あ'.repeat(70);
    const items = buildRecentRecordPreview([{ date: '2026-03-17', status: '完了', specialNotes: longNote }]);
    expect(items[0].noteExcerpt).toHaveLength(61); // 60文字 + '…'
  });
});

describe('buildRecentHandoffPreview', () => {
  const handoffs = [
    { id: '1', message: '通常', severity: '通常', status: '未対応', createdAt: '2026-03-15' },
    { id: '2', message: '重要', severity: '重要', status: '未対応', createdAt: '2026-03-14' },
    { id: '3', message: '通常2', severity: '通常', status: '未対応', createdAt: '2026-03-16' },
  ];

  it('重要申し送りが先頭に来る', () => {
    const items = buildRecentHandoffPreview(handoffs);
    expect(items[0].severity).toBe('重要');
  });

  it('limit 件数まで返す', () => {
    expect(buildRecentHandoffPreview(handoffs, 2)).toHaveLength(2);
  });

  it('80文字超のメッセージは切り詰める', () => {
    const longMsg = 'い'.repeat(90);
    const items = buildRecentHandoffPreview([{ id: '1', message: longMsg, severity: '通常', status: '未対応', createdAt: '' }]);
    expect(items[0].message).toHaveLength(81); // 80文字 + '…'
  });
});

describe('buildTodayUserSnapshot', () => {
  it('重要申し送りがあれば urgency=high', () => {
    const snap = buildTodayUserSnapshot({ userId: 'U-001', hasRecordToday: false, hasCriticalHandoff: true, hasPlan: true });
    expect(snap.urgency).toBe('high');
    expect(snap.nextAction).toContain('重要な申し送り');
  });

  it('記録未入力なら urgency=medium で記録への誘導', () => {
    const snap = buildTodayUserSnapshot({ userId: 'U-001', hasRecordToday: false, hasCriticalHandoff: false, hasPlan: true });
    expect(snap.urgency).toBe('medium');
    expect(snap.nextActionPath).toContain('daily/activity');
  });

  it('計画未作成なら計画への誘導', () => {
    const snap = buildTodayUserSnapshot({ userId: 'U-001', hasRecordToday: true, hasCriticalHandoff: false, hasPlan: false });
    expect(snap.urgency).toBe('medium');
    expect(snap.nextAction).toContain('個別支援計画書');
  });

  it('すべて完了なら urgency=low', () => {
    const snap = buildTodayUserSnapshot({ userId: 'U-001', hasRecordToday: true, hasCriticalHandoff: false, hasPlan: true });
    expect(snap.urgency).toBe('low');
    expect(snap.nextAction).toContain('完了');
  });
});

describe('buildPlanHighlights', () => {
  const goals = [
    { type: 'long' as const, label: '長期目標', text: '社会参加を促進する' },
    { type: 'support' as const, label: '支援', text: '見守り支援を行う' },
    { type: 'short' as const, label: '短期目標', text: '人との交流を増やす' },
  ];

  it('short > support > long の優先順で返す', () => {
    const items = buildPlanHighlights(goals);
    expect(items[0].type).toBe('short');
    expect(items[1].type).toBe('support');
    expect(items[2].type).toBe('long');
  });

  it('limit 件数まで返す', () => {
    expect(buildPlanHighlights(goals, 2)).toHaveLength(2);
  });

  it('空ゴールなら空配列', () => {
    expect(buildPlanHighlights([])).toEqual([]);
  });

  it('テキストが空なら "内容未設定" を表示', () => {
    const items = buildPlanHighlights([{ type: 'short', label: 'テスト', text: '' }]);
    expect(items[0].excerpt).toBe('内容未設定');
  });

  it('70文字超のテキストは切り詰める', () => {
    const items = buildPlanHighlights([{ type: 'short', label: 'テスト', text: 'あ'.repeat(80) }]);
    expect(items[0].excerpt).toHaveLength(71); // 70文字 + '…'
  });
});
