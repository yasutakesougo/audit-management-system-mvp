import { describe, expect, it } from 'vitest';
import { moveScheduleToDay } from '@/features/schedule/move';
import type { Schedule, ScheduleUserCare } from '@/features/schedule/types';

const createSchedule = (overrides: Partial<ScheduleUserCare> = {}): Schedule => ({
  id: overrides.id ?? 'demo-1',
  etag: overrides.etag ?? 'W/"demo"',
  category: 'User',
  title: overrides.title ?? 'Demo',
  start: overrides.start ?? '2025-01-15T09:00:00Z',
  end: overrides.end ?? '2025-01-15T11:00:00Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '承認済み',
  location: overrides.location,
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  dayKey: overrides.dayKey,
  fiscalYear: overrides.fiscalYear,
  baseShiftWarnings: overrides.baseShiftWarnings,
  serviceType: overrides.serviceType ?? 'ショートステイ',
  personType: overrides.personType ?? 'Internal',
  personId: overrides.personId ?? '201',
  personName: overrides.personName ?? '利用者 201',
  externalPersonName: overrides.externalPersonName,
  externalPersonOrg: overrides.externalPersonOrg,
  externalPersonContact: overrides.externalPersonContact,
  staffIds: overrides.staffIds ?? ['101'],
  staffNames: overrides.staffNames ?? ['Demo Staff'],
}) as Schedule;

describe('moveScheduleToDay', () => {
  it('retains time portion when moving to a different day', () => {
    const schedule = createSchedule();
    const moved = moveScheduleToDay(schedule, '20250210');
    expect(moved.start).toBe('2025-02-10T09:00:00Z');
    expect(moved.end).toBe('2025-02-10T11:00:00Z');
    expect(moved.dayKey).toBe('2025-02-10');
  });

  it('supports keys with hyphenated form', () => {
    const schedule = createSchedule();
    const moved = moveScheduleToDay(schedule, '2025-03-01');
    expect(moved.start).toBe('2025-03-01T09:00:00Z');
    expect(moved.end).toBe('2025-03-01T11:00:00Z');
  });

  it('is a no-op when dayKey is falsy', () => {
    const original = createSchedule();
    const moved = moveScheduleToDay(original, '');
    expect(moved).toBe(original);
  });
});
