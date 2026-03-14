/**
 * monitoringSchedule — ユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeMonitoringSchedule,
  formatMonitoringDeadline,
} from '../monitoringSchedule';

describe('computeMonitoringSchedule', () => {
  it('should return null for invalid appliedFrom', () => {
    const result = computeMonitoringSchedule({ appliedFrom: 'invalid' });
    expect(result).toBeNull();
  });

  it('should compute first monitoring due date from start', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-02-15',
    });

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-01-01');
    expect(result!.nextDueDate).toBe('2026-04-01'); // 1/1 + 90
    expect(result!.daysRemaining).toBe(45); // 4/1 - 2/15
    expect(result!.urgency).toBe('safe');
  });

  it('should use lastMonitoredAt for next due date', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      lastMonitoredAt: '2026-03-15',
      referenceDate: '2026-05-01',
    });

    expect(result!.nextDueDate).toBe('2026-06-13'); // 3/15 + 90
    expect(result!.urgency).toBe('safe');
  });

  it('should prefer reviewedAt over lastMonitoredAt', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      lastMonitoredAt: '2026-02-01', // earlier
      reviewedAt: '2026-03-20',      // later — should be used
      referenceDate: '2026-05-01',
    });

    expect(result!.nextDueDate).toBe('2026-06-18'); // 3/20 + 90
    expect(result!.lastMonitoredAt).toBe('2026-03-20');
  });

  it('should detect overdue', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-04-15', // 14 days after 4/1
    });

    expect(result!.urgency).toBe('overdue');
    expect(result!.daysRemaining).toBe(-14);
  });

  it('should detect due today', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-04-01', // exactly on due date
    });

    expect(result!.urgency).toBe('due');
    expect(result!.daysRemaining).toBe(0);
  });

  it('should detect upcoming (within 14 days)', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-03-25', // 7 days before 4/1
    });

    expect(result!.urgency).toBe('upcoming');
    expect(result!.daysRemaining).toBe(7);
  });

  it('should generate annual schedule', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-01-15',
    });

    // 12 months with 90-day cycle = 4 milestones
    expect(result!.schedule.length).toBe(4);
    expect(result!.schedule[0].dueDate).toBe('2026-04-01');
    expect(result!.schedule[0].round).toBe(1);
    expect(result!.schedule[1].dueDate).toBe('2026-06-30');
    expect(result!.schedule[2].dueDate).toBe('2026-09-28');
    expect(result!.schedule[3].dueDate).toBe('2026-12-27');
  });

  it('should mark completed milestones', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      lastMonitoredAt: '2026-04-01',
      referenceDate: '2026-05-01',
    });

    // First milestone (4/1) should be completed
    expect(result!.schedule[0].completed).toBe(true);
    // Current milestone should be the second one
    const current = result!.schedule.find((m) => m.isCurrent);
    expect(current).toBeDefined();
    expect(current!.round).toBe(2);
  });

  it('should use default 90 days if reviewCycleDays not specified', () => {
    const result = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      referenceDate: '2026-03-01',
    });

    expect(result!.cycleDays).toBe(90);
    expect(result!.nextDueDate).toBe('2026-04-01');
  });
});

describe('formatMonitoringDeadline', () => {
  it('should format overdue', () => {
    const info = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-04-10',
    })!;
    const label = formatMonitoringDeadline(info);
    expect(label).toContain('超過');
    expect(label).toContain('9日');
  });

  it('should format due today', () => {
    const info = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-04-01',
    })!;
    const label = formatMonitoringDeadline(info);
    expect(label).toContain('本日');
  });

  it('should format upcoming', () => {
    const info = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-03-25',
    })!;
    const label = formatMonitoringDeadline(info);
    expect(label).toContain('7日');
    expect(label).toContain('🟡');
  });

  it('should format safe', () => {
    const info = computeMonitoringSchedule({
      appliedFrom: '2026-01-01',
      reviewCycleDays: 90,
      referenceDate: '2026-01-15',
    })!;
    const label = formatMonitoringDeadline(info);
    expect(label).toContain('🟢');
    expect(label).toContain('日後');
  });
});
