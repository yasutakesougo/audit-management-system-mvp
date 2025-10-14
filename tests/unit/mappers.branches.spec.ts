import { describe, expect, it } from 'vitest';
import { detectAllDay, mapSchedule, toLocalRange } from '../../src/lib/mappers';
import {
  SCHEDULE_FIELD_ASSIGNED_STAFF,
  SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  SCHEDULE_FIELD_BILLING_FLAGS,
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_NOTE,
  SCHEDULE_FIELD_RELATED_RESOURCE,
  SCHEDULE_FIELD_RELATED_RESOURCE_ID,
  SCHEDULE_FIELD_ROW_KEY,
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_TARGET_USER,
  SCHEDULE_FIELD_TARGET_USER_ID,
  type ScheduleRow,
} from '../../src/sharepoint/fields';

describe('lib/mappers branch coverage', () => {
  it('toLocalRange gracefully handles missing or invalid dates', () => {
    const range = toLocalRange('not-a-date', null, 'Asia/Tokyo');
    expect(range.startLocal).toBeNull();
    expect(range.endLocal).toBeNull();
    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
  });

  it('detectAllDay derives value from local midnight bounds and respects invalid cases', () => {
    const midnightStart = '2025-03-01T00:00:00Z';
    const midnightEnd = '2025-03-02T00:00:00Z';
    const range = toLocalRange(midnightStart, midnightEnd, 'Asia/Tokyo');
    expect(detectAllDay(undefined, midnightStart, midnightEnd, range)).toBe(true);

    const reverseRange = toLocalRange(midnightEnd, midnightStart, 'Asia/Tokyo');
    expect(detectAllDay(undefined, midnightEnd, midnightStart, reverseRange)).toBe(false);
  });

  it('mapSchedule normalizes fields, preserves invalid ISO strings, and deduplicates lookups', () => {
    const row: ScheduleRow = {
      Id: 42,
      Title: '  Primary  ',
      [SCHEDULE_FIELD_START]: 'not-a-date',
      [SCHEDULE_FIELD_END]: '',
      [SCHEDULE_FIELD_STATUS]: '完了',
      [SCHEDULE_FIELD_NOTE]: '  memo  ',
      [SCHEDULE_FIELD_ASSIGNED_STAFF_ID]: { results: ['7', ' 7 ', 8] } as unknown as number[],
      [SCHEDULE_FIELD_ASSIGNED_STAFF]: [{ Title: ' Alice ' }, { Title: 'Bob' }],
      [SCHEDULE_FIELD_TARGET_USER_ID]: '11',
      [SCHEDULE_FIELD_TARGET_USER]: [{ Title: 'User A' }],
      [SCHEDULE_FIELD_RELATED_RESOURCE_ID]: { results: [1, '2', '2'] } as unknown as number[],
      [SCHEDULE_FIELD_RELATED_RESOURCE]: [{ Title: ' Room 1 ' }],
      [SCHEDULE_FIELD_BILLING_FLAGS]: 'Flag1;#Flag2;#Flag1',
      [SCHEDULE_FIELD_ROW_KEY]: 'rk',
      EventDate: undefined,
      EndDate: undefined,
      AllDay: undefined,
      Location: '  Room  ',
      StaffIdId: '9',
      UserIdId: '13',
      Notes: '  legacy  ',
      cr014_category: 'User',
      cr014_staffIds: '21;#22',
      cr014_staffNames: 'Taro;#Jiro',
      cr014_personType: 'Internal',
      cr014_personId: ' U-001 ',
      cr014_personName: '  Sato  ',
      cr014_externalPersonName: '  External  ',
      cr014_externalPersonOrg: ' Org ',
      cr014_externalPersonContact: ' contact ',
      cr014_dayKey: '',
      cr014_fiscalYear: '2025',
      RecurrenceJson: '{"freq":"daily"}',
      RRule: 'FREQ=DAILY',
      RecurrenceData: null,
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

  expect(schedule.startUtc).toBe('not-a-date');
  expect(schedule.endUtc).toBeNull();
    expect(schedule.notes).toBe('memo');
    expect(schedule.location).toBe('Room');
    expect(schedule.staffIds).toEqual(['7', '8']);
    expect(schedule.assignedStaffNames).toEqual(['Alice', 'Bob']);
    expect(schedule.targetUserIds).toEqual([11]);
    expect(schedule.relatedResourceIds).toEqual([1, 2]);
    expect(schedule.billingFlags).toEqual(['Flag1', 'Flag2']);
    const userSchedule = schedule as unknown as {
      personType?: string;
      personId?: string | null;
      personName?: string | null;
      externalPersonName?: string | null;
    };
    expect(userSchedule.personId).toBe('U-001');
    expect(userSchedule.personName).toBe('Sato');
    expect(userSchedule.personType).toBe('Internal');
    expect(userSchedule.externalPersonName).toBeUndefined();
    expect(schedule.rowKey).toBe('rk');
    expect(schedule.recurrence?.rule).toBe('FREQ=DAILY');
    expect(schedule.allDay).toBe(false);
  });
});
