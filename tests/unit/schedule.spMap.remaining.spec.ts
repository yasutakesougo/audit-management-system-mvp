import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
import {
    SCHEDULE_FIELD_EXTERNAL_CONTACT,
    SCHEDULE_FIELD_EXTERNAL_NAME,
    SCHEDULE_FIELD_EXTERNAL_ORG,
    SCHEDULE_FIELD_PERSON_ID,
    SCHEDULE_FIELD_PERSON_NAME,
    SCHEDULE_FIELD_PERSON_TYPE,
    SCHEDULE_FIELD_STAFF_IDS,
    SCHEDULE_FIELD_STAFF_NAMES,
} from '@/sharepoint/fields';
import type { SpScheduleItem } from '@/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const staffTextColumnsEnabledMock = vi.fn(() => true);

vi.mock('@/features/schedule/scheduleFeatures', () => ({
  isScheduleStaffTextColumnsEnabled: () => staffTextColumnsEnabledMock(),
}));

describe('schedule spMap remaining branches', () => {
  beforeEach(() => {
    vi.resetModules();
    staffTextColumnsEnabledMock.mockReturnValue(true);
  });

  it('maps external user schedules to external SharePoint columns', async () => {
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleUserCare = {
      id: 'ext-1',
      etag: 'etag',
      category: 'User',
      title: '訪問面談',
      start: '2025-02-01T00:00:00Z',
      end: '2025-02-01T01:00:00Z',
      allDay: false,
      status: '下書き',
      location: undefined,
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      serviceType: '一時ケア',
      personType: 'External',
      personId: undefined,
      personName: undefined,
      externalPersonName: '株式会社コンソーシアム',
      externalPersonOrg: 'コンソーシアム',
      externalPersonContact: '090-0000-0000',
      staffIds: ['ABC123'],
      staffNames: ['担当者'],
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('External');
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBeNull();
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_NAME]).toBe('株式会社コンソーシアム');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_ORG]).toBe('コンソーシアム');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_CONTACT]).toBe('090-0000-0000');
  expect(fields.StaffIdId ?? null).toBeNull();
  expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBe('["ABC123"]');
  expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBe('["担当者"]');
  });

  it('normalises org and staff subtype aliases when hydrating from SharePoint', async () => {
    const { fromSpSchedule } = await import('@/features/schedule/spMap');

    const orgItem: SpScheduleItem = {
      Id: 100,
      '@odata.etag': 'etag-org',
      Title: '外部団体利用',
      cr014_category: 'Org',
      EventDate: '2025-03-10T00:00:00Z',
      EndDate: '2025-03-10T02:00:00Z',
      SubType: 'external-group',
    };

    const staffItem: SpScheduleItem = {
      Id: 101,
      '@odata.etag': 'etag-staff',
      Title: '来客対応',
      cr014_category: 'Staff',
      EventDate: '2025-03-10T00:00:00Z',
      EndDate: '2025-03-10T01:00:00Z',
      SubType: 'visitor',
      DayPart: 'morning',
      StaffLookupId: { results: [301] } as unknown as number[],
      cr014_staffIds: ['301'],
    };

    const staffAnnualItem: SpScheduleItem = {
      Id: 102,
      '@odata.etag': 'etag-staff-annual',
      Title: '年休 (AM)',
      cr014_category: 'Staff',
      EventDate: '2025-03-10T00:00:00Z',
      EndDate: '2025-03-10T12:00:00Z',
      SubType: 'vacation',
      DayPart: 'morning',
      StaffLookupId: { results: [401] } as unknown as number[],
      cr014_staffIds: ['401'],
    };

    const org = fromSpSchedule(orgItem) as ScheduleOrg;
    const staff = fromSpSchedule(staffItem) as ScheduleStaff;
    const staffAnnual = fromSpSchedule(staffAnnualItem) as ScheduleStaff;

    expect(org.subType).toBe('外部団体利用');
    expect(staff.subType).toBe('来客対応');
    expect(staff.dayPart).toBeUndefined();
    expect(staffAnnual.subType).toBe('年休');
    expect(staffAnnual.dayPart).toBe('AM');
  });

  it('deduplicates staff IDs when staff text columns are emitted', async () => {
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleUserCare = {
      id: 'staff-dup',
      etag: 'etag',
      category: 'User',
      title: '複数担当',
      start: '2025-04-01T00:00:00Z',
      end: '2025-04-01T02:00:00Z',
      allDay: false,
      status: '下書き',
      location: undefined,
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      serviceType: 'ショートステイ',
      personType: 'Internal',
      personId: 'P-1',
      personName: '職員対応',
      externalPersonName: undefined,
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      staffIds: ['42', ' 42 ', '42'],
      staffNames: ['A', 'A', '  A  '],
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBe('["42"]');
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBe('["A"]');
    expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('Internal');
  });
});
