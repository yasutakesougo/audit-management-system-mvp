import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpScheduleItem } from '../../src/types';
import {
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_DAY_PART,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_ORG_RESOURCE_ID,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
} from '../../src/sharepoint/fields';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '../../src/features/schedule/types';

const isScheduleStaffTextColumnsEnabledMock = vi.fn(() => true);

vi.mock('../../src/features/schedule/scheduleFeatures', () => ({
  isScheduleStaffTextColumnsEnabled: isScheduleStaffTextColumnsEnabledMock,
}));

describe('schedule spMap', () => {
  let fromSpSchedule: typeof import('../../src/features/schedule/spMap').fromSpSchedule;
  let toSpScheduleFields: typeof import('../../src/features/schedule/spMap').toSpScheduleFields;

  beforeEach(async () => {
    vi.resetModules();
    isScheduleStaffTextColumnsEnabledMock.mockReturnValue(true);
    ({ fromSpSchedule, toSpScheduleFields } = await import('../../src/features/schedule/spMap'));
  });

  it('hydrates user schedules with fallbacks and normalization', () => {
    const spItem: SpScheduleItem = {
      Id: 42,
      '@odata.etag': '"etag"',
      Title: '  External Visit  ',
      cr014_category: 'User',
      EventDate: '2025-04-01T00:00:00Z',
      EndDate: '2025-04-01T01:15:00Z',
      Status: '未確定',
      Notes: ' bring documents ',
      Location: ' Meeting Room ',
      cr014_serviceType: 'ショートステイ',
      cr014_personType: 'External',
      cr014_externalPersonName: 'Guest',
      cr014_externalPersonOrg: 'Partner Org',
      cr014_externalPersonContact: 'call ahead',
      cr014_staffIds: '101;#102',
      cr014_staffNames: 'Alice;#Bob',
    };

    const schedule = fromSpSchedule(spItem) as ScheduleUserCare;

    expect(schedule.category).toBe('User');
    expect(schedule.title).toBe('External Visit');
  expect(schedule.staffIds).toEqual(['101', '#102']);
  expect(schedule.staffNames).toEqual(['Alice', '#Bob']);
    expect(schedule.personType).toBe('External');
    expect(schedule.externalPersonName).toBe('Guest');
    expect(schedule.dayKey).toMatch(/^2025/);
    expect(schedule.fiscalYear).toBe('2025');
  });

  it('hydrates org and staff schedules with subtype normalization and lookup parsing', () => {
    const orgItem: SpScheduleItem = {
      Id: 7,
      '@odata.etag': 'etag-org',
      Title: ' Org Meeting ',
      cr014_category: 'Org',
      EventDate: '2025-06-10T00:00:00Z',
      EndDate: '2025-06-10T03:00:00Z',
      SubType: 'training',
      cr014_orgAudience: '["All","Team"]',
      cr014_resourceId: 'room-1',
      ExternalOrgName: 'External Partner',
    };

    const staffItem: SpScheduleItem = {
      Id: 8,
      '@odata.etag': 'etag-staff',
      Title: ' PTO ',
      cr014_category: 'Staff',
      EventDate: '2025-07-01T00:00:00Z',
      EndDate: '2025-07-01T23:59:00Z',
      SubType: 'vacation',
      DayPart: '午後',
      StaffLookupId: { results: [55, '56'] } as unknown as number[],
      StaffLookup: [{ Title: 'Makoto' }],
    };

    const org = fromSpSchedule(orgItem) as ScheduleOrg;
    const staff = fromSpSchedule(staffItem) as ScheduleStaff;

    expect(org.category).toBe('Org');
    expect(org.subType).toBe('研修');
    expect(org.audience).toEqual(['All', 'Team']);
    expect(org.resourceId).toBe('room-1');
    expect(org.externalOrgName).toBe('External Partner');

    expect(staff.category).toBe('Staff');
    expect(staff.subType).toBe('年休');
    expect(staff.staffIds).toEqual(['55', '56']);
    expect(staff.staffNames).toEqual(['Makoto']);
    expect(staff.dayPart).toBe('PM');
  });

  it('produces SharePoint payload for user schedules including staff text columns', async () => {
    const spItem: SpScheduleItem = {
      Id: 21,
      '@odata.etag': '"etag"',
      Title: ' Internal ',
      cr014_category: 'User',
      EventDate: '2025-08-01T00:00:00Z',
      EndDate: '2025-08-01T02:00:00Z',
      cr014_serviceType: 'ショートステイ',
      cr014_personType: 'Internal',
      cr014_personId: '2001',
      cr014_personName: 'Suzuki',
      cr014_staffIds: '501;#502',
      cr014_staffNames: 'Alpha;#Beta',
    };
    const schedule = fromSpSchedule(spItem) as ScheduleUserCare;

    const fields = toSpScheduleFields(schedule);

    expect(fields.Title).toBe('Internal');
  expect(fields.EventDate).toBe('2025-08-01T00:00:00.000Z');
    expect(fields[SCHEDULE_FIELD_CATEGORY]).toBe('User');
    expect(fields[SCHEDULE_FIELD_SERVICE_TYPE]).toBe('ショートステイ');
    expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('Internal');
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBe('2001');
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBe('Suzuki');
  expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBe('["501","#502"]');
  expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBe('["Alpha","#Beta"]');
    expect(fields.StaffIdId).toBe(501);
  });

  it('produces SharePoint payload for org and staff schedules respecting staff text toggle', async () => {
    const orgSchedule: ScheduleOrg = {
      id: '31',
      etag: 'etag-org',
      category: 'Org',
      title: 'Strategy session',
      start: '2025-09-10T01:00:00Z',
      end: '2025-09-10T03:00:00Z',
      allDay: false,
      status: '申請中',
      location: 'Hall',
      notes: 'Bring slides',
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      subType: '会議',
      audience: ['Ops', 'Care'],
      resourceId: 'room-2',
      externalOrgName: undefined,
    };

    const staffSchedule: ScheduleStaff = {
      id: '41',
      etag: 'etag-staff',
      category: 'Staff',
      title: 'Paid leave',
      start: '2025-10-01T00:00:00Z',
      end: '2025-10-01T12:00:00Z',
      allDay: false,
      status: '下書き',
      location: undefined,
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      subType: '年休',
      staffIds: ['700'],
      staffNames: ['Kana'],
      dayPart: 'AM',
    };

    isScheduleStaffTextColumnsEnabledMock.mockReturnValue(true);
    const orgFields = toSpScheduleFields(orgSchedule);
    expect(orgFields[SCHEDULE_FIELD_ORG_AUDIENCE]).toBe('["Ops","Care"]');
    expect(orgFields[SCHEDULE_FIELD_STAFF_IDS]).toBeNull();
    expect(orgFields[SCHEDULE_FIELD_ORG_RESOURCE_ID]).toBe('room-2');

    isScheduleStaffTextColumnsEnabledMock.mockReturnValue(false);
    const staffFields = toSpScheduleFields(staffSchedule);
    expect(staffFields[SCHEDULE_FIELD_STAFF_IDS]).toBeUndefined();
    expect(staffFields[SCHEDULE_FIELD_STAFF_NAMES]).toBeUndefined();
    expect(staffFields.StaffIdId).toBe(700);
    expect(staffFields[SCHEDULE_FIELD_DAY_PART]).toBe('AM');
    expect(staffFields[SCHEDULE_FIELD_EXTERNAL_NAME]).toBeNull();
    expect(staffFields[SCHEDULE_FIELD_PERSON_NAME]).toBeNull();
    expect(staffFields[SCHEDULE_FIELD_PERSON_ID]).toBeNull();
    expect(staffFields[SCHEDULE_FIELD_SERVICE_TYPE]).toBeNull();
  });
});
