import { describe, expect, it } from 'vitest';
import { computeMonitoringDeadlineFromSupportStart } from '../components/MonitoringCountdown';

describe('computeMonitoringDeadlineFromSupportStart（支援開始日起点・90日固定）', () => {
  it('baseDate=2026-05-01, today=2026-05-08', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-05-08');
    expect(result.nextDueDate).toBe('2026-07-30');
    expect(result.remainingDays).toBe(83);
    expect(result.status).toBe('normal');
  });

  it('baseDate=2026-05-01, today=2026-07-30', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-07-30');
    expect(result.remainingDays).toBe(0);
    expect(result.status).toBe('dueToday');
  });

  it('baseDate=2026-05-01, today=2026-07-31', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-07-31');
    expect(result.remainingDays).toBe(-1);
    expect(result.status).toBe('overdue');
  });
});

