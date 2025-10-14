import { describe, expect, it } from 'vitest';
import type { SpScheduleItem } from '../../src/types';
import type { ScheduleOrg } from '../../src/features/schedule/types';
import { fromSpSchedule } from '../../src/features/schedule/spMap';

describe('schedule spMap additional branches', () => {
  const baseOrg = {
    Id: 900,
    '@odata.etag': 'etag',
    Title: 'Org session',
    cr014_category: 'Org',
    SubType: 'meeting',
  } satisfies Partial<SpScheduleItem>;

  it('honours zero-length date ranges for org schedules', () => {
    const item: SpScheduleItem = {
      ...baseOrg,
      EventDate: '2025-01-01T09:00:00Z',
      EndDate: '2025-01-01T09:00:00Z',
      cr014_orgAudience: ' ["Ops","Ops" ] ',
      cr014_resourceId: '   ',
    } as SpScheduleItem;

    const schedule = fromSpSchedule(item) as ScheduleOrg;

  expect(schedule.start).toBe('2025-01-01T09:00:00.000Z');
  expect(schedule.end).toBe('2025-01-01T09:00:00.000Z');
    expect(schedule.audience).toEqual(['Ops']);
    expect(schedule.resourceId).toBeUndefined();
  });

  it('falls back when EndDate is empty, null, or missing', () => {
    const endings: Array<string | null | undefined> = ['', null, undefined];
    for (const EndDate of endings) {
      const item: SpScheduleItem = {
        ...baseOrg,
        EventDate: '2025-02-01T00:00:00Z',
        EndDate,
        Location: EndDate === '' ? '  ' : undefined,
      } as SpScheduleItem;

      const schedule = fromSpSchedule(item) as ScheduleOrg;

  expect(schedule.end).toBe('2025-02-01T00:00:00.000Z');
      expect(schedule.location).toBeUndefined();
    }
  });

  it('normalizes timezone crossover to UTC outputs', () => {
    const item: SpScheduleItem = {
      ...baseOrg,
      EventDate: '2025-06-01T23:30:00+09:00',
      EndDate: '2025-06-02T00:15:00+09:00',
      cr014_orgAudience: ['Care', ' Care '],
    } as SpScheduleItem;

    const schedule = fromSpSchedule(item) as ScheduleOrg;

    expect(schedule.start).toBe('2025-06-01T14:30:00.000Z');
    expect(schedule.end).toBe('2025-06-01T15:15:00.000Z');
  expect(schedule.dayKey).toBe('20250601');
    expect(schedule.audience).toEqual(['Care']);
  });
});
