import { describe, expect, it } from 'vitest';
import { computeMonitoringDeadlineFromSupportStart } from '../monitoringDeadline';

describe('computeMonitoringDeadlineFromSupportStart', () => {
  it('2026-05-01 base / 2026-05-08 today => due 2026-07-30, remaining 83, normal', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-05-08');
    expect(result.nextDueDate).toBe('2026-07-30');
    expect(result.remainingDays).toBe(83);
    expect(result.status).toBe('normal');
  });

  it('dueToday when remaining is 0', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-07-30');
    expect(result.remainingDays).toBe(0);
    expect(result.status).toBe('dueToday');
  });

  it('overdue when remaining is negative', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-07-31');
    expect(result.remainingDays).toBe(-1);
    expect(result.status).toBe('overdue');
  });

  it('warning when remaining is 30', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-06-30');
    expect(result.remainingDays).toBe(30);
    expect(result.status).toBe('warning');
  });

  it('critical when remaining is 14', () => {
    const result = computeMonitoringDeadlineFromSupportStart('2026-05-01', '2026-07-16');
    expect(result.remainingDays).toBe(14);
    expect(result.status).toBe('critical');
  });

  it('unknown when base date is missing', () => {
    const result = computeMonitoringDeadlineFromSupportStart(null, '2026-05-08');
    expect(result.nextDueDate).toBeNull();
    expect(result.remainingDays).toBeNull();
    expect(result.status).toBe('unknown');
  });

  it('invalid when base date is invalid', () => {
    const result = computeMonitoringDeadlineFromSupportStart('invalid-date', '2026-05-08');
    expect(result.nextDueDate).toBeNull();
    expect(result.remainingDays).toBeNull();
    expect(result.status).toBe('invalid');
  });
});

