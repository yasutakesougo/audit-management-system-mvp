import { describe, it } from 'vitest';

describe.skip('legacy schedule tests removed', () => {
  it('skipped', () => {});
});
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleOrg, ScheduleUserCare } from '../../src/features/schedule/types';
import { SCHEDULE_FIELD_STAFF_IDS, SCHEDULE_FIELD_STAFF_NAMES } from '../../src/sharepoint/fields';
import type { SpScheduleItem } from '../../src/types';

const isScheduleStaffTextColumnsEnabledMock = vi.fn(() => false);

vi.mock('../../src/features/schedule/scheduleFeatures', () => ({
  isScheduleStaffTextColumnsEnabled: () => isScheduleStaffTextColumnsEnabledMock(),
}));

describe.skip('schedule spMap branch coverage (legacy)', () => {
  let fromSpSchedule: typeof import('../../src/features/schedule/spMap').fromSpSchedule;
  let toSpScheduleFields: typeof import('../../src/features/schedule/spMap').toSpScheduleFields;

  beforeEach(async () => {
    vi.resetModules();
    isScheduleStaffTextColumnsEnabledMock.mockReturnValue(false);
    ({ fromSpSchedule, toSpScheduleFields } = await import('../../src/features/schedule/spMap'));
  });

  it('hydrates user schedule with missing end and whitespace optional fields', () => {
    const spItem: SpScheduleItem = {
      Id: 1,
      Title: '  Visit  ',
      cr014_category: 'User',
      EventDate: '2025-05-01T10:00:00+09:00',
      EndDate: '2025-05-01T10:30:00+09:00',
      Location: '   ',
      Notes: '  note  ',
      Status: 'draft',
      StaffIdId: '7',
      cr014_personType: 'Internal',
      cr014_personId: '  U-42 ',
      cr014_personName: '  Tanaka  ',
      cr014_staffIds: '',
      cr014_staffNames: '',
    } as unknown as SpScheduleItem;

    const schedule = fromSpSchedule(spItem) as ScheduleUserCare;

  expect(schedule.start).toBe('2025-05-01T01:00:00.000Z');
  expect(schedule.end).toBe('2025-05-01T01:30:00.000Z');
    expect(schedule.location).toBeUndefined();
    expect(schedule.notes).toBe('note');
    expect(schedule.staffIds).toEqual(['7']);
    expect(schedule.personId).toBe('U-42');
    expect(schedule.personName).toBe('Tanaka');
    expect(schedule.dayKey).toBeDefined();
  });

  it('normalizes timezone-crossing range and optional fields for org schedules', () => {
    const spItem: SpScheduleItem = {
      Id: 99,
      Title: '  Org sync  ',
      cr014_category: 'Org',
      EventDate: '2025-06-30T23:30:00+09:00',
      EndDate: '2025-07-01T00:15:00+09:00',
      SubType: 'meeting',
      cr014_orgAudience: ['Ops', '  Care  '],
      cr014_resourceId: '  res-9 ',
      ExternalOrgName: '',
    } as unknown as SpScheduleItem;

    const schedule = fromSpSchedule(spItem) as ScheduleOrg;

    expect(schedule.start).toBe('2025-06-30T14:30:00.000Z');
    expect(schedule.end).toBe('2025-06-30T15:15:00.000Z');
    expect(schedule.subType).toBe('会議');
    expect(schedule.audience).toEqual(['Ops', 'Care']);
    expect(schedule.resourceId).toBe('res-9');
    expect(schedule.externalOrgName).toBeUndefined();
  });

  it('builds SharePoint payload with recurrence nulls and skips staff text when toggle off', () => {
    const schedule: ScheduleOrg = {
      id: '12',
      etag: 'etag',
      category: 'Org',
      title: 'Review',
      start: '2025-08-01T00:00:00Z',
      end: '2025-08-01T01:00:00Z',
      allDay: false,
      status: '申請中',
      location: undefined,
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      subType: '研修',
      audience: undefined,
      resourceId: undefined,
      externalOrgName: undefined,
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields.RecurrenceJson).toBeNull();
    expect(fields.RRule).toBeNull();
  expect(fields.EventDate).toBe('2025-08-01T00:00:00Z');
  expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBeUndefined();
  expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeUndefined();
  });

  it('throws when converting schedule with unsupported category', () => {
    expect(() =>
      toSpScheduleFields({
        id: '1',
        etag: 'etag',
        category: 'Other' as never,
        title: 'Invalid',
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T01:00:00Z',
        allDay: false,
        status: '下書き',
      } as unknown as ScheduleOrg)
    ).toThrow(/Unsupported schedule category/);
  });
});
