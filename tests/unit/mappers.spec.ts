import { describe, expect, it } from 'vitest';
import { mapUser, mapStaff, mapDaily, toLocalRange, detectAllDay } from '../../src/lib/mappers';
import type { UserRow, StaffRow, DailyRow } from '../../src/sharepoint/fields';
import {
  DAILY_FIELD_BEHAVIOR_LOG,
  DAILY_FIELD_DATE,
  DAILY_FIELD_DRAFT,
  DAILY_FIELD_END_TIME,
  DAILY_FIELD_LOCATION,
  DAILY_FIELD_MEAL_LOG,
  DAILY_FIELD_NOTES,
  DAILY_FIELD_START_TIME,
  DAILY_FIELD_STATUS,
  DAILY_FIELD_STAFF_ID,
  DAILY_FIELD_USER_ID,
} from '../../src/sharepoint/fields';

describe('lib/mappers', () => {
  it('mapUser normalizes strings, arrays, and fallback fields', () => {
    const row: UserRow = {
      Id: 101,
      UserID: '  U-01  ',
      Title: '  Primary  ',
      FullName: '  Hanako Suzuki  ',
      Furigana: '  すずき はなこ  ',
      FullNameKana: '  スズキ ハナコ  ',
      TransportToDays: 'Mon;#Tue;#Mon',
      Transport_x0020_FromDays: { results: [' Wed ', 'Thu', ''] } as unknown as string[],
      AttendanceDays: 'Fri, Sat, Fri',
      RecipientCertNumber: ' 12345 ',
      RecipientCertExpiry: '2025-05-10T00:00:00Z',
      ContractDate: '2024-12-31T15:00:00Z',
      ServiceStartDate: '2025-01-01T09:00:00Z',
      ServiceEndDate: null,
      SevereFlag: true,
      IsActive: undefined,
      Modified: '2025-01-02T00:00:00Z',
      Created: '2025-01-01T00:00:00Z',
    };

    const user = mapUser(row);

    expect(user.id).toBe(101);
    expect(user.userId).toBe('U-01');
    expect(user.name).toBe('Hanako Suzuki');
    expect(user.furigana).toBe('すずき はなこ');
    expect(user.nameKana).toBe('スズキ ハナコ');
    expect(user.toDays).toEqual(['Mon', 'Tue']);
    expect(user.fromDays).toEqual(['Wed', 'Thu']);
    expect(user.attendanceDays).toEqual(['Fri', 'Sat']);
    expect(user.certNumber).toBe('12345');
    expect(user.certExpiry).toBe('2025-05-10');
    expect(user.contractDate).toBe('2024-12-31');
    expect(user.serviceStartDate).toBe('2025-01-01');
    expect(user.serviceEndDate).toBeNull();
    expect(user.severe).toBe(true);
    expect(user.highIntensitySupport).toBe(true);
    expect(user.active).toBe(true);
    expect(user.modified).toBe('2025-01-02T00:00:00Z');
    expect(user.created).toBe('2025-01-01T00:00:00Z');
  });

  it('mapStaff merges legacy fields, normalizes times, and deduplicates arrays', () => {
    const row: StaffRow = {
      Id: 7,
      StaffID: '  77 ',
      FullName: '  Ichiro Tanaka  ',
      Furigana: ' たなか いちろう ',
      FullNameKana: ' タナカ イチロウ ',
      JobTitle: ' Care Manager ',
      EmploymentType: ' Full-time ',
      RBACRole: ' Supervisor ',
      Role: ' ',
      Department: ' Operations ',
      Email: ' ichiro@example.com ',
      Phone: ' 000-1111 ',
      Certifications: 'CPR;#First Aid;#CPR',
      WorkDays: undefined,
      Work_x0020_Days: 'Mon, Tue, Tue',
  BaseShiftStartTime: '9:05',
      BaseShiftEndTime: '2025-01-01T01:30:00Z',
      BaseWorkingDays: { results: ['Sat', 'Sun', 'Sat'] } as unknown as string[],
      HireDate: '2020-04-01T00:00:00Z',
  ResignDate: undefined,
      IsActive: true,
      Modified: '2024-12-31T00:00:00Z',
      Created: '2020-04-01T00:00:00Z',
    };

    const staff = mapStaff(row);

    expect(staff.id).toBe(7);
    expect(staff.staffId).toBe('77');
    expect(staff.name).toBe('Ichiro Tanaka');
    expect(staff.role).toBe('Care Manager');
    expect(staff.jobTitle).toBe('Care Manager');
    expect(staff.department).toBe('Operations');
    expect(staff.certifications).toEqual(['CPR', 'First Aid']);
    expect(staff.workDays).toEqual(['Mon', 'Tue']);
    expect(staff.baseWorkingDays).toEqual(['Sat', 'Sun']);
    expect(staff.baseShiftStartTime).toBe('09:05');
    expect(staff.baseShiftEndTime).toBe('01:30');
    expect(staff.active).toBe(true);
    expect(staff.hireDate).toBe('2020-04-01');
  expect(staff.resignDate).toBeUndefined();
  });

  it('mapDaily coerces numbers, strings, and nested values safely', () => {
    const daily: DailyRow = {
      Id: 15,
      Title: ' Daily note ',
      [DAILY_FIELD_DATE]: '2025-02-10',
      [DAILY_FIELD_START_TIME]: '08:00',
      [DAILY_FIELD_END_TIME]: '  ',
      [DAILY_FIELD_LOCATION]: ' Meeting room ',
      [DAILY_FIELD_STAFF_ID]: '24',
      [DAILY_FIELD_USER_ID]: null,
      [DAILY_FIELD_NOTES]: '  Summary ',
      [DAILY_FIELD_MEAL_LOG]: '',
      [DAILY_FIELD_BEHAVIOR_LOG]: null,
      [DAILY_FIELD_DRAFT]: '{"key":1}',
      [DAILY_FIELD_STATUS]: ' In progress ',
      Created: '2025-02-08T00:00:00Z',
      Modified: '2025-02-09T00:00:00Z',
    } as unknown as DailyRow;

    const result = mapDaily(daily);

    expect(result.id).toBe(15);
    expect(result.title).toBe('Daily note');
    expect(result.date).toBe('2025-02-10');
    expect(result.startTime).toBe('08:00');
    expect(result.endTime).toBeNull();
    expect(result.location).toBe('Meeting room');
    expect(result.staffId).toBe(24);
    expect(result.userId).toBeNull();
    expect(result.notes).toBe('Summary');
    expect(result.mealLog).toBeNull();
    expect(result.behaviorLog).toBeNull();
    expect(result.draft).toEqual({ key: 1 });
    expect(result.status).toBe('In progress');
    expect(result.created).toBe('2025-02-08T00:00:00Z');
    expect(result.modified).toBe('2025-02-09T00:00:00Z');
  });

  it('detectAllDay respects explicit flag and derives from local range when absent', () => {
    const start = '2025-03-01T00:00:00Z';
    const end = '2025-03-02T00:00:00Z';
    const range = toLocalRange(start, end, 'Asia/Tokyo');

    expect(detectAllDay(true, start, end, range)).toBe(true);
    expect(detectAllDay(undefined, start, end, range)).toBe(true);
    expect(detectAllDay(undefined, 'invalid', end, range)).toBe(false);
    expect(detectAllDay(false, start, end, range)).toBe(false);
  });
});
