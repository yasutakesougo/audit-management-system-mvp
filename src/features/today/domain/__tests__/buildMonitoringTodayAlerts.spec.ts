import { describe, expect, it } from 'vitest';
import { buildMonitoringTodayAlerts } from '../buildMonitoringTodayAlerts';

describe('buildMonitoringTodayAlerts', () => {
  it('resolves L2 start date priority and emits due/provisional/unset alerts', () => {
    const result = buildMonitoringTodayAlerts(
      [
        {
          userId: 'U001',
          userName: '計画優先',
          serviceStartDate: '2026-01-01',
          supportStartDate: '2026-02-07',
        },
        {
          userId: 'U002',
          userName: '暫定起点',
          appliedFrom: '2026-02-10',
        },
        {
          userId: 'U003',
          userName: '未設定',
        },
      ],
      '2026-05-08',
    );

    const signals = result.map((x) => x.signal);
    const user1 = signals.find((x) => x.metadata?.userId === 'U001');
    const user2Provisional = signals.find((x) => x.id.startsWith('monitoring-origin-provisional:U002'));
    const user3Unset = signals.find((x) => x.metadata?.userId === 'U003');

    expect(user1?.code).toBe('monitoring_due_today');
    expect(user2Provisional?.code).toBe('monitoring_origin_provisional');
    expect(user3Unset?.code).toBe('monitoring_origin_unset');
  });
});

