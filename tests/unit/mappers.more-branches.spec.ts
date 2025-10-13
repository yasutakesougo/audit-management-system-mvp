import { describe, expect, it } from 'vitest';
import { detectAllDay, mapSchedule, toLocalRange } from '../../src/lib/mappers';
import {
    SCHEDULE_FIELD_ASSIGNED_STAFF,
    SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
    SCHEDULE_FIELD_BILLING_FLAGS,
    SCHEDULE_FIELD_END,
    SCHEDULE_FIELD_NOTE,
    SCHEDULE_FIELD_START,
    SCHEDULE_FIELD_STATUS,
    SCHEDULE_FIELD_TARGET_USER_ID,
    type ScheduleRow,
} from '../../src/sharepoint/fields';

describe('lib/mappers additional branch coverage', () => {
  it('normalizes duplicates, invalid lookups, and fallback strings', () => {
    const row: ScheduleRow = {
      Id: 401,
      Title: '  Branchy Event ',
      [SCHEDULE_FIELD_START]: '2025-04-01 09:00:00',
      [SCHEDULE_FIELD_END]: '',
      [SCHEDULE_FIELD_STATUS]: '完了',
      [SCHEDULE_FIELD_NOTE]: ' legacy ',
      [SCHEDULE_FIELD_ASSIGNED_STAFF_ID]: { results: ['7', ' 7 ', 'abc', '', 8] } as unknown as number[],
      [SCHEDULE_FIELD_ASSIGNED_STAFF]: [{ Title: '  Ann ' }, { Title: 'Ann' }, { Title: '' }],
      [SCHEDULE_FIELD_TARGET_USER_ID]: { results: ['21', '  21', 'NaN'] } as unknown as number[],
      [SCHEDULE_FIELD_BILLING_FLAGS]: 'Alpha;# ;#Beta;#Alpha',
      Notes: ' note ',
      StaffIdId: '5',
      UserIdId: '24',
      cr014_category: 'Staff',
      cr014_staffIds: '4;#4;#5',
      cr014_staffNames: 'Ada;#Ada;#Bea',
      cr014_personType: 'Internal',
      cr014_personId: ' U-24 ',
      cr014_personName: '  User  ',
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.startUtc?.endsWith('Z')).toBe(true);
    expect(schedule.endUtc).toBeNull();
    expect(schedule.notes).toBe('legacy');
    expect(schedule.staffIds).toEqual(['7', '8']);
    expect(schedule.assignedStaffNames).toEqual(['Ann', 'Ann']);
    expect(schedule.targetUserIds).toEqual([21]);
    expect(schedule.billingFlags).toEqual(['Alpha', 'Beta']);
  });

  it('detectAllDay respects boolean coercion tokens and invalid ranges', () => {
    const start = '2025-05-01T00:00:00Z';
    const end = '2025-05-02T00:00:00Z';
    const range = toLocalRange(start, end);
    expect(detectAllDay('YES', start, end, range)).toBe(true);
    expect(detectAllDay('No', start, end, range)).toBe(false);

    const invalidRange = toLocalRange(start, 'not-a-date');
    expect(detectAllDay(undefined, start, 'not-a-date', invalidRange)).toBe(false);
  });

  it('ensures local range handles naive timestamps and invalid input', () => {
    const naiveRow: ScheduleRow = {
      Id: 402,
      Title: 'Naive Range',
      [SCHEDULE_FIELD_START]: '2025-06-10 08:30:00',
      [SCHEDULE_FIELD_END]: 'not-a-date',
      [SCHEDULE_FIELD_STATUS]: 'draft',
      cr014_category: 'Org',
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(naiveRow);

    expect(schedule.startUtc?.endsWith('Z')).toBe(true);
    expect(schedule.endUtc).toBe('not-a-date');
    expect(schedule.startLocal).toBeTruthy();
    expect(schedule.endLocal).toBe(schedule.startLocal);
  });
});
