/**
 * @fileoverview ContextPanel ロジックの単体テスト
 * @description
 * MVP-005: buildContextAlerts / createEmptyContextData のテスト
 */

import { describe, it, expect } from 'vitest';
import {
  buildContextAlerts,
  buildContextSummary,
  buildRecommendedPrompts,
  createEmptyContextData,
  prioritizeContextAlerts,
  type ContextSupportPlan,
  type ContextAlert,
} from '../contextPanelLogic';

describe('createEmptyContextData', () => {
  it('空のコンテキストデータを返す', () => {
    const data = createEmptyContextData();
    expect(data.supportPlan.status).toBe('none');
    expect(data.handoffs).toEqual([]);
    expect(data.recentRecords).toEqual([]);
    expect(data.alerts).toEqual([]);
  });
});

describe('buildContextAlerts', () => {
  const baseParams = {
    supportPlan: { status: 'confirmed' as const, planPeriod: '2026-04~2026-09', goals: [] },
    handoffs: [],
    recentRecords: [{ date: '2026-03-17', status: '完了' }],
    isHighIntensity: false,
    isSupportProcedureTarget: false,
  };

  it('すべて正常なら空配列', () => {
    const alerts = buildContextAlerts(baseParams);
    expect(alerts).toEqual([]);
  });

  it('支援計画未作成で warning', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      supportPlan: { status: 'none', planPeriod: '', goals: [] },
    });
    const ispAlert = alerts.find((a) => a.key === 'isp-missing');
    expect(ispAlert).toBeDefined();
    expect(ispAlert?.level).toBe('warning');
  });

  it('重要な申し送りがあれば error', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      handoffs: [
        { id: '1', message: 'テスト', category: '体調', severity: '重要', status: '未対応', createdAt: '' },
      ],
    });
    const criticalAlert = alerts.find((a) => a.key === 'critical-handoff');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert?.level).toBe('error');
  });

  it('完了済み重要申し送りはアラートにならない', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      handoffs: [
        { id: '1', message: 'テスト', category: '体調', severity: '重要', status: '完了', createdAt: '' },
      ],
    });
    const criticalAlert = alerts.find((a) => a.key === 'critical-handoff');
    expect(criticalAlert).toBeUndefined();
  });

  it('直近記録なしで info', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      recentRecords: [],
    });
    const noRecords = alerts.find((a) => a.key === 'no-recent-records');
    expect(noRecords).toBeDefined();
    expect(noRecords?.level).toBe('info');
  });

  it('強度行動障害対象で warning', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      isHighIntensity: true,
    });
    const hiAlert = alerts.find((a) => a.key === 'high-intensity');
    expect(hiAlert).toBeDefined();
    expect(hiAlert?.level).toBe('warning');
  });

  it('支援手順対象者（強度行動障害でない）で info', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      isSupportProcedureTarget: true,
    });
    const spAlert = alerts.find((a) => a.key === 'support-procedure');
    expect(spAlert).toBeDefined();
    expect(spAlert?.level).toBe('info');
  });

  it('強度行動障害 + 支援手順対象は高強度のみ表示', () => {
    const alerts = buildContextAlerts({
      ...baseParams,
      isHighIntensity: true,
      isSupportProcedureTarget: true,
    });
    const hiAlert = alerts.find((a) => a.key === 'high-intensity');
    const spAlert = alerts.find((a) => a.key === 'support-procedure');
    expect(hiAlert).toBeDefined();
    expect(spAlert).toBeUndefined();   // 重複回避
  });

  it('複数アラートが同時に生成される', () => {
    const alerts = buildContextAlerts({
      supportPlan: { status: 'none', planPeriod: '', goals: [] },
      handoffs: [
        { id: '1', message: 'テスト', category: '体調', severity: '重要', status: '未対応', createdAt: '' },
      ],
      recentRecords: [],
      isHighIntensity: true,
      isSupportProcedureTarget: false,
    });
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    const keys = alerts.map((a) => a.key);
    expect(keys).toContain('isp-missing');
    expect(keys).toContain('critical-handoff');
    expect(keys).toContain('high-intensity');
  });
});

describe('buildContextSummary', () => {
  it('記録と申し送りから履歴要約を生成する', () => {
    const summary = buildContextSummary(
      [
        { date: '2026-03-17', status: '完了', specialNotes: '転倒あり' },
      ],
      [
        { id: '1', message: '薬忘れ', category: '健康', severity: '重要', status: '未対応', createdAt: '' }
      ]
    );
    expect(summary).toContain('未対応の重要な申し送りが1件あります。');
    expect(summary).toContain('直近の記録に特記事項あり（1件）。');
  });

  it('問題がない場合は正常完了の旨を返す', () => {
    const summary = buildContextSummary(
      [
        { date: '2026-03-17', status: '完了' },
        { date: '2026-03-16', status: '完了' },
      ],
      []
    );
    expect(summary).toContain('直近2回の記録は特筆すべき問題なく完了しています。');
  });

  it('データが全くない場合', () => {
    expect(buildContextSummary([], [])).toBe('直近の関連履歴はありません。');
  });
});

describe('buildRecommendedPrompts', () => {
  const basePlan: ContextSupportPlan = {
    status: 'confirmed',
    planPeriod: '2026',
    goals: [
      { type: 'support', label: '本人の支援', text: '見守り' },
    ]
  };

  it('強度行動障害がある場合は専用のプロンプトを優先する', () => {
    const prompts = buildRecommendedPrompts(basePlan, true, true);
    expect(prompts[0]).toContain('強度行動障害');
    expect(prompts).toHaveLength(2); // 手順対象 + goal 1つ
  });

  it('支援手順対象のみの場合', () => {
    const prompts = buildRecommendedPrompts(basePlan, false, true);
    expect(prompts[0]).toContain('個別支援手順書');
  });

  it('目標から効果的なプロンプトを生成する', () => {
    const prompts = buildRecommendedPrompts(basePlan, false, false);
    expect(prompts[0]).toContain('目標「本人の支援」に対する本日のアプローチ結果はどうでしたか？');
  });

  it('目標がない場合は汎用プロンプトを返す', () => {
    const emptyPlan: ContextSupportPlan = { ...basePlan, goals: [] };
    const prompts = buildRecommendedPrompts(emptyPlan, false, false);
    expect(prompts[0]).toContain('本日の利用者の様子で気になった些細な変化や気づきを記録してください。');
  });
});

describe('prioritizeContextAlerts', () => {
  it('アラートを error > warning > info の順にソートする', () => {
    const alerts: ContextAlert[] = [
      { key: '3', level: 'info', message: 'C' },
      { key: '1', level: 'error', message: 'A' },
      { key: '2', level: 'warning', message: 'B' },
    ];
    const sorted = prioritizeContextAlerts(alerts);
    expect(sorted[0].level).toBe('error');
    expect(sorted[1].level).toBe('warning');
    expect(sorted[2].level).toBe('info');
  });
});
