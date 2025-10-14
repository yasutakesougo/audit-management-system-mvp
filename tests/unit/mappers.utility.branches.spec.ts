import { describe, expect, it } from 'vitest';
import {
  type DailyRow,
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
  type ScheduleRow,
  type StaffRow,
  type UserRow,
  SCHEDULE_FIELD_BILLING_FLAGS,
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_TARGET_USER_ID,
} from '@/sharepoint/fields';
import {
  detectAllDay,
  getScheduleStatusLabel,
  mapDaily,
  mapSchedule,
  mapScheduleToSp,
  mapStaff,
  mapUser,
  toLocalRange,
  type Schedule,
} from '@/lib/mappers';

describe('mappers utility branch coverage', () => {
  const baseUser = {
    Id: 1,
    UserID: '  U-1  ',
    FullName: ' 山田 太郎 ',
    severeFlag: true,
    TransportToDays: { results: [' 月 ', ''] } as unknown,
    Transport_x0020_FromDays: ' 火;# 火 ;# 水 ',
    AttendanceDays: ['木', '木', ''],
    RecipientCertNumber: '   ',
    RecipientCertExpiry: '   ',
    ServiceStartDate: '2025-03-01T00:00:00Z',
    ServiceEndDate: '',
    ContractDate: '2025-02-01T00:00:00Z',
    IsActive: false,
    Modified: '2025-02-02T00:00:00Z',
    Created: '2025-02-01T00:00:00Z',
  } as unknown as UserRow;

  it('mapUser normalises transport collections and trims metadata', () => {
    const mapped = mapUser(baseUser);

    expect(mapped.toDays).toEqual(['月']);
    expect(mapped.fromDays).toEqual(['火', '水']);
    expect(mapped.attendanceDays).toEqual(['木']);
    expect(mapped.certNumber).toBeUndefined();
    expect(mapped.certExpiry).toBeUndefined();
    expect(mapped.highIntensitySupport).toBe(true);
    expect(mapped.active).toBe(false);
    expect(mapped.contractDate).toBe('2025-02-01');
    expect(mapped.serviceStartDate).toBe('2025-03-01');
    expect(mapped.serviceEndDate).toBeNull();
  });

  it('mapStaff merges legacy work days and parses base shift timings', () => {
    const staffRow = {
      Id: 10,
      StaffID: '  ST-1  ',
      FullName: ' 佐藤 花子 ',
      WorkDays: ['月', '火'],
      BaseWorkingDays: { results: [' 水 ', '水'] } as unknown,
      BaseShiftStartTime: '25:00',
      BaseShiftEndTime: '2025-03-01T09:15:00Z',
      JobTitle: ' 介護職 ',
      EmploymentType: ' 常勤 ',
      Role: ' リーダー ',
      Email: ' staff@example.com ',
  } as unknown as StaffRow;

    const mapped = mapStaff(staffRow);

    expect(mapped.workDays).toEqual(['月', '火']);
    expect(mapped.baseWorkingDays).toEqual(['水']);
    expect(mapped.baseShiftStartTime).toBeUndefined();
    expect(mapped.baseShiftEndTime).toBe('09:15');
    expect(mapped.role).toBe('リーダー');
    expect(mapped.employmentType).toBe('常勤');
    expect(mapped.active).toBe(true);
  });

  it('toLocalRange handles invalid end and timezone failures gracefully', () => {
    const fallbackRange = toLocalRange('2025-03-05T01:02:03Z', 'invalid-end');
    expect(fallbackRange.startLocal).toBeTruthy();
    expect(fallbackRange.endLocal).toBe(fallbackRange.startLocal);

    const invalidTzRange = toLocalRange('2025-03-05T01:02:03Z', '2025-03-05T03:00:00Z', 'Invalid/Timezone');
    expect(invalidTzRange.startLocal).toBeNull();
    expect(invalidTzRange.endLocal).toBeNull();
    expect(invalidTzRange.startDate).toBeNull();
    expect(invalidTzRange.endDate).toBeNull();
  });

  it('detectAllDay respects explicit flags and derived midnight ranges', () => {
    const explicit = detectAllDay('yes', null, null, { startLocal: null, endLocal: null, startDate: null, endDate: null });
    expect(explicit).toBe(true);

    const derived = detectAllDay(undefined, '2025-03-01T15:00:00Z', '2025-03-02T15:00:00Z', {
      startLocal: '2025-03-02T00:00:00+09:00',
      endLocal: '2025-03-03T00:00:00+09:00',
      startDate: '2025-03-02',
      endDate: '2025-03-03',
    });
    expect(derived).toBe(true);
  });

  const makeSchedule = (overrides: Record<string, unknown>): Schedule =>
    mapSchedule({
      Id: 44,
      Title: ' complex title ',
      EventDate: '2025-03-02T00:00:00Z',
      EndDate: '2025-03-03T00:00:00Z',
      ...overrides,
    } as ScheduleRow);

  it('mapSchedule expands lookup fields, dedupes IDs, and normalises metadata', () => {
    const schedule = makeSchedule({
      AssignedStaffId: { results: [900, '901', '901'] },
      AssignedStaff: { results: [{ Title: ' 佐藤 ' }, { Title: '' }] },
      TargetUserId: ['1000'],
      TargetUser: { results: [{ Title: ' 太郎 ' }] },
      RelatedResourceId: { results: ['2000', 2000] },
      RelatedResource: [{ Title: '会議室' }],
      cr014_staffIds: 'legacy;# legacy',
      cr014_staffNames: 'Legacy Person',
      cr014_category: ' User ',
      cr014_personType: ' Internal ',
      cr014_personId: ' P-1 ',
      cr014_personName: ' 氏名 ',
      DayPart: ' 午後 ',
      RowKey: ' row-123 ',
      Date: ' 20250302 ',
      MonthKey: ' 202503 ',
      CreatedAt: '2025-03-01T00:00:00Z',
      UpdatedAt: '2025-03-01T01:00:00Z',
      Status: '完了',
      BillingFlags: ['A', ' B ', 'A'],
      Note: ' 備考 ',
      RecurrenceJson: ' not json ',
      RecurrenceData: 'RRULE:FREQ=WEEKLY',
      '@odata.etag': '"etag"',
    });

    expect(schedule.allDay).toBe(true);
    expect(schedule.status).toBe('approved');
    expect(schedule.statusLabel).toBe('確定');
    expect(schedule.staffIds).toEqual(['900', '901']);
    expect(schedule.assignedStaffNames).toEqual(['佐藤']);
    expect(schedule.targetUserIds).toEqual([1000]);
    expect(schedule.targetUserNames).toEqual(['太郎']);
    expect(schedule.relatedResourceIds).toEqual([2000]);
    expect(schedule.relatedResourceNames).toEqual(['会議室']);
    expect(schedule.billingFlags).toEqual(['A', 'B']);
    expect(schedule.dayKey).toBe('20250302');
    expect(schedule.recurrenceRaw).toBe('not json');
    expect(schedule.recurrence?.rule).toBe('RRULE:FREQ=WEEKLY');
  });

  it('mapSchedule falls back to legacy staff IDs and handles JSON recurrence', () => {
    const schedule = mapSchedule({
      Id: 55,
      Title: ' legacy ',
      EventDate: '2025-03-04T09:00:00Z',
      EndDate: 'invalid',
      AllDay: 'true' as unknown as boolean,
  cr014_staffIds: '42;#42',
      cr014_staffNames: 'Alpha;#Beta',
      Status: '申請中',
      UserIdId: '98',
      RecurrenceJson: '{"foo":1}',
      BillingFlags: 'X,Y,X',
      cr014_dayKey: ' 20250304 ',
      Note: ' legacy note ',
  } as unknown as ScheduleRow);

  expect(schedule.staffIds).toEqual(['42']);
    expect(schedule.assignedStaffNames).toEqual(['Alpha', 'Beta']);
    expect(schedule.userId).toBe(98);
    expect(schedule.allDay).toBe(true);
    expect(schedule.status).toBe('submitted');
    expect(schedule.recurrenceRaw).toEqual({ foo: 1 });
    expect(schedule.billingFlags).toEqual(['X', 'Y']);
    expect(schedule.dayKey).toBe('20250304');
    expect(schedule.endLocal).toBe(schedule.startLocal);
  });

  it('mapScheduleToSp honours target user, billing flags, and status mappings', () => {
    const payload = mapScheduleToSp({
      title: '  create ',
      start: 'not-a-date',
      end: '2025-03-05T04:00:00Z',
      status: 'holiday',
      note: ' memo ',
      targetUserId: '42',
      billingFlags: ['A', ' A ', 'B'],
    });

    expect(payload.Title).toBe('create');
  expect(payload[SCHEDULE_FIELD_TARGET_USER_ID]).toEqual({ results: [42] });
  expect(payload[SCHEDULE_FIELD_BILLING_FLAGS]).toEqual({ results: ['A', 'B'] });
  expect(payload[SCHEDULE_FIELD_STATUS]).toBe('完了');
  expect(payload[SCHEDULE_FIELD_START]).toBe('not-a-date');

    const statusPayloads = {
      submitted: '実施中',
      approved: '確定',
      confirmed: '確定',
      absent: 'キャンセル',
      planned: '未確定',
    } as const;

    for (const [status, expected] of Object.entries(statusPayloads)) {
  const result = mapScheduleToSp({ title: 'x', start: '2025-03-01T00:00:00Z', end: '2025-03-01T01:00:00Z', status: status as keyof typeof statusPayloads });
  expect(result[SCHEDULE_FIELD_STATUS]).toBe(expected);
    }
  });

  it('getScheduleStatusLabel returns a sensible fallback', () => {
    expect(getScheduleStatusLabel('approved')).toBe('確定');
    expect(getScheduleStatusLabel('submitted')).toBe('実施中');
    expect(getScheduleStatusLabel('draft')).toBe('未確定');
    expect(getScheduleStatusLabel('unknown' as Schedule['status'])).toBe('未確定');
  });

  it('mapDaily parses JSON payloads and coerces nullable fields', () => {
    const dailyRow = {
  Id: '77',
      [DAILY_FIELD_DATE]: '2025-04-01',
      [DAILY_FIELD_START_TIME]: ' 08:30 ',
  [DAILY_FIELD_END_TIME]: '   ',
      [DAILY_FIELD_LOCATION]: ' 施設 ',
      [DAILY_FIELD_STAFF_ID]: '101',
      [DAILY_FIELD_USER_ID]: 55,
      [DAILY_FIELD_NOTES]: ' メモ ',
      [DAILY_FIELD_MEAL_LOG]: ' 朝 ',
      [DAILY_FIELD_BEHAVIOR_LOG]: ' 行動 ',
      [DAILY_FIELD_DRAFT]: ' not json ',
      [DAILY_FIELD_STATUS]: ' 実施 ',
  } as unknown as DailyRow;

    const mapped = mapDaily(dailyRow);

    expect(mapped.id).toBe(77);
    expect(mapped.startTime).toBe('08:30');
  expect(mapped.endTime).toBeNull();
    expect(mapped.staffId).toBe(101);
    expect(mapped.userId).toBe(55);
    expect(mapped.draft).toBe('not json');
    expect(mapped.status).toBe('実施');
  });
});
