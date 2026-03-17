/**
 * @fileoverview ContextPanel ロジックの単体テスト
 * @description
 * MVP-005: buildContextAlerts / createEmptyContextData のテスト
 */

import { describe, it, expect } from 'vitest';
import { buildContextAlerts, createEmptyContextData } from '../contextPanelLogic';

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
