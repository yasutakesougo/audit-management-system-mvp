import { describe, expect, it } from 'vitest';
import { mapTodaySignalToActionSource, mapTodaySignalsToActionSources } from '../mapTodaySignalToActionSource';
import type { TodaySignal } from '../../types/todaySignal.types';

function makeSignal(overrides: Partial<TodaySignal> = {}): TodaySignal {
  return {
    id: 'isp_renew_suggest:u001:meeting-2026-04',
    code: 'isp_renew_suggest',
    domain: 'Monitoring',
    priority: 'P2',
    audience: ['admin'],
    title: '利用者 U001 の ISP見直しを推奨',
    actionPath: '/support-plan-guide?userId=U001&tab=operations.monitoring',
    metadata: {
      userId: 'U001',
      sourceRef: 'meeting-2026-04',
      reason: '支援方法の見直しが必要',
      impact: 'low',
      createdAt: '2026-04-12T09:00:00.000Z',
    },
    ...overrides,
  };
}

describe('mapTodaySignalToActionSource', () => {
  it('isp_renew_suggest を ActionSource に変換する', () => {
    const signal = makeSignal();
    const result = mapTodaySignalToActionSource(signal);

    expect(result).not.toBeNull();
    expect(result?.sourceType).toBe('isp_renew_suggest');
    expect(result?.title).toBe(signal.title);
    expect(result?.payload).toMatchObject({
      signalCode: 'isp_renew_suggest',
      path: signal.actionPath,
      recommendedOnly: true,
      sourceRef: 'meeting-2026-04',
    });
  });

  it('対象外 code は null を返す', () => {
    const signal = makeSignal({ code: 'monitoring_due_soon' });
    const result = mapTodaySignalToActionSource(signal);
    expect(result).toBeNull();
  });

  it('配列変換では null を除外する', () => {
    const signals: TodaySignal[] = [
      makeSignal(),
      makeSignal({
        id: 'monitoring_due_soon:u002',
        code: 'monitoring_due_soon',
      }),
    ];
    const result = mapTodaySignalsToActionSources(signals);
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('isp_renew_suggest');
  });
});
