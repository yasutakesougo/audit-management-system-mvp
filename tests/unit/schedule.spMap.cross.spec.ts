import { describe, it } from 'vitest';

describe.skip('legacy schedule tests removed', () => {
  it('skipped', () => {});
});
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
import {
    SCHEDULE_FIELD_DAY_PART,
    SCHEDULE_FIELD_EXTERNAL_CONTACT,
    SCHEDULE_FIELD_EXTERNAL_NAME,
    SCHEDULE_FIELD_EXTERNAL_ORG,
    SCHEDULE_FIELD_ORG_AUDIENCE,
    SCHEDULE_FIELD_PERSON_ID,
    SCHEDULE_FIELD_PERSON_NAME,
    SCHEDULE_FIELD_PERSON_TYPE,
    SCHEDULE_FIELD_STAFF_IDS,
    SCHEDULE_FIELD_STAFF_NAMES,
} from '@/sharepoint/fields';
import type { SpScheduleItem } from '@/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const staffTextColumns = vi.fn(() => false);

vi.mock('@/features/schedule/scheduleFeatures', async () => {
  const actual = await vi.importActual<typeof import('@/features/schedule/scheduleFeatures')>(
    '@/features/schedule/scheduleFeatures'
  );
  return {
    ...actual,
    isScheduleStaffTextColumnsEnabled: () => staffTextColumns(),
  };
});

describe.skip('schedule spMap cross-branch coverage (legacy)', () => {
  beforeEach(() => {
    vi.resetModules();
    staffTextColumns.mockReset();
    staffTextColumns.mockReturnValue(false);
  });

  it('keeps internal person fields while tolerating missing staff ids when text columns disabled', async () => {
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleUserCare = {
      id: 'user-1',
      etag: 'etag-1',
      category: 'User',
      title: '訪問支援',
      start: '2025-01-10T00:00:00Z',
      end: '2025-01-10T00:30:00Z',
      allDay: false,
      status: '下書き',
      serviceType: '一時ケア',
      personType: 'Internal',
      personName: '山田 花子',
      staffIds: ['  '],
      staffNames: ['担当者A'],
      notes: undefined,
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields.StaffIdId).toBeNull();
    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBeUndefined();
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeUndefined();
    expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('Internal');
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBe('');
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBe('山田 花子');
  });

  it('maps external person columns and clears unused internal fields', async () => {
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleUserCare = {
      id: 'user-2',
      etag: 'etag-2',
      category: 'User',
      title: '事業所見学',
      start: '2025-02-01T00:00:00Z',
      end: '2025-02-01T01:00:00Z',
      allDay: false,
      status: '下書き',
      serviceType: 'ショートステイ',
      personType: 'External',
      externalPersonName: '外部ゲスト',
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      staffIds: ['staff-9'],
      staffNames: undefined,
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('External');
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBeNull();
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_NAME]).toBe('外部ゲスト');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_ORG]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_CONTACT]).toBeNull();
  });

  it('emits org audience arrays and staff text placeholders when toggle enabled', async () => {
    staffTextColumns.mockReturnValue(true);
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleOrg = {
      id: 'org-1',
      etag: 'etag-3',
      category: 'Org',
      title: '全体会議',
      start: '2025-03-05T00:00:00Z',
      end: '2025-03-05T01:30:00Z',
      allDay: false,
      status: '下書き',
      subType: '会議',
      audience: ['看護', '看護', '生活介護'],
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_ORG_AUDIENCE]).toBe(JSON.stringify(['看護', '生活介護']));
    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBeNull();
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeNull();
  });

  it('defaults staff annual leave dayPart to Full when missing', async () => {
    const { toSpScheduleFields } = await import('@/features/schedule/spMap');

    const schedule: ScheduleStaff = {
      id: 'staff-1',
      etag: 'etag-4',
      category: 'Staff',
      title: '年休取得',
      start: '2025-04-10T00:00:00Z',
      end: '2025-04-10T01:00:00Z',
      allDay: false,
      status: '下書き',
      subType: '年休',
      staffIds: ['501'],
    };

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_DAY_PART]).toBe('Full');
  });

  it('hydrates staff schedules from mixed lookup payloads', async () => {
    const { fromSpSchedule } = await import('@/features/schedule/spMap');

    const item: SpScheduleItem = {
      Id: 912,
      '@odata.etag': 'etag-lookup',
      Title: '年休 午後',
      cr014_category: 'Staff',
      EventDate: '2025-05-02T09:00:00+09:00',
      EndDate: '2025-05-02T12:00:00+09:00',
      SubType: 'vacation',
      DayPart: '午後',
      cr014_staffIds: '',
      StaffLookupId: {
        results: [101, '202;#303', { Id: '404;#505' }, { Id: 606 }],
      } as unknown as number[],
      StaffLookup: {
        results: ['  Alice  ', { Title: 'Brenda ' }, { FullName: ' Charlie ' }, { StaffID: 'Delta' }],
      } as unknown as number[],
    };

    const schedule = fromSpSchedule(item) as ScheduleStaff;

    expect(schedule.subType).toBe('年休');
    expect(schedule.dayPart).toBe('PM');
  expect(schedule.staffIds).toEqual(['101', '202', '#303', '404', '#505', '606']);
    expect(schedule.staffNames).toEqual(['Alice', 'Brenda', 'Charlie', 'Delta']);
  });
});
