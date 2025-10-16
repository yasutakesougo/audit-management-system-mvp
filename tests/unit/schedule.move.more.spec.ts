import { moveScheduleToDay } from '@/features/schedule/move';
import type { Schedule, ScheduleUserCare } from '@/features/schedule/types';
import { describe, expect, it } from 'vitest';

const baseSchedule = (overrides: Partial<ScheduleUserCare> = {}) => ({
  id: overrides.id ?? 'demo-1',
  etag: overrides.etag ?? 'etag',
  category: 'User' as const,
  title: overrides.title ?? 'Demo',
  start: overrides.start ?? '2025-01-15T09:00:00Z',
  end: overrides.end ?? '2025-01-15T11:00:00Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '承認済み',
  serviceType: overrides.serviceType ?? 'ショートステイ',
  personType: overrides.personType ?? 'Internal',
  personId: overrides.personId ?? '201',
  personName: overrides.personName ?? '利用者 201',
  staffIds: overrides.staffIds ?? ['101'],
  staffNames: overrides.staffNames ?? ['Demo'],
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  location: overrides.location,
  externalPersonName: overrides.externalPersonName,
  externalPersonOrg: overrides.externalPersonOrg,
  externalPersonContact: overrides.externalPersonContact,
  dayKey: overrides.dayKey,
  fiscalYear: overrides.fiscalYear,
  baseShiftWarnings: overrides.baseShiftWarnings,
}) satisfies ScheduleUserCare;

describe('moveScheduleToDay additional coverage', () => {
  it('keeps schedule untouched when start and end are empty', () => {
  const schedule = baseSchedule();
  const mutable = schedule as unknown as Record<string, unknown>;
  mutable.start = null;
  mutable.end = null;
  delete mutable.dayKey;

  const moved = moveScheduleToDay(mutable as unknown as Schedule, '2025-12-01');
    expect(moved.start).toBeNull();
    expect(moved.end).toBeNull();
    expect(moved.dayKey).toBe('2025-12-01');
  });

  it('appends time to arbitrary keys when pattern mismatches', () => {
    const schedule = baseSchedule();
    const moved = moveScheduleToDay(schedule, 'day-42');
    expect(moved.start).toBe('day-42T09:00:00Z');
    expect(moved.end).toBe('day-42T11:00:00Z');
    expect(moved.dayKey).toBe('');
  });

  it('defaults missing time portion to midnight', () => {
    const schedule = baseSchedule({ start: '2025-02-01', end: '2025-02-01' });
    const moved = moveScheduleToDay(schedule, '2025-03-05');
    expect(moved.start).toBe('2025-03-05T00:00:00');
    expect(moved.end).toBe('2025-03-05T00:00:00');
    expect(moved.dayKey).toBe('2025-03-05');
  });
});
