import { describe, expect, it } from 'vitest';
import { moveScheduleToDay } from '@/features/schedule/move';
import type { ScheduleUserCare } from '@/features/schedule/types';

const createSchedule = (overrides: Partial<ScheduleUserCare> = {}): ScheduleUserCare => ({
  id: 'id1',
  etag: 'W/"etag"',
  category: 'User',
  title: 'Schedule',
  start: '2025-01-10T10:00:00Z',
  end: '2025-01-10T11:00:00Z',
  allDay: false,
  status: '承認済み',
  staffIds: ['001'],
  staffNames: ['Staff'],
  personId: '101',
  personName: 'Person',
  serviceType: 'ショートステイ',
  personType: 'Internal',
  dayKey: '2025-01-10',
  ...overrides,
});

describe('moveScheduleToDay edge behaviour', () => {
  it('preserves original timestamps when moving to the same day', () => {
    const schedule = createSchedule();
    const moved = moveScheduleToDay(schedule, '2025-01-10');
    expect(moved.start).toBe('2025-01-10T10:00:00Z');
    expect(moved.end).toBe('2025-01-10T11:00:00Z');
    expect(moved.dayKey).toBe('2025-01-10');
  });

  it('shifts to the next day while keeping clock time', () => {
    const schedule = createSchedule();
    const moved = moveScheduleToDay(schedule, '2025-01-11');
    expect(moved.start).toBe('2025-01-11T10:00:00Z');
    expect(moved.end).toBe('2025-01-11T11:00:00Z');
    expect(moved.dayKey).toBe('2025-01-11');
  });

  it('falls back to concatenating malformed keys without normalization', () => {
    const schedule = createSchedule();
    const moved = moveScheduleToDay(schedule, '2025/01/12');
    expect(moved.start).toBe('2025/01/12T10:00:00Z');
    expect(moved.end).toBe('2025/01/12T11:00:00Z');
    expect(moved.dayKey).toBe('');
  });
});
