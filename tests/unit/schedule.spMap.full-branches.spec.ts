import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromSpSchedule, toSpScheduleFields } from '@/features/schedule/spMap';
import * as features from '@/features/schedule/scheduleFeatures';
import { toSharePointStatus } from '@/features/schedule/statusDictionary';
import {
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_EXTERNAL_ORG,
  SCHEDULE_FIELD_EXTERNAL_CONTACT,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
  SCHEDULE_FIELD_SUB_TYPE,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_ORG_RESOURCE_ID,
  SCHEDULE_FIELD_ORG_EXTERNAL_NAME,
  SCHEDULE_FIELD_DAY_PART,
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_FISCAL_YEAR,
} from '@/sharepoint/fields';
import type { SpScheduleItem } from '@/types';

vi.mock('@/features/schedule/statusDictionary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/schedule/statusDictionary')>();
  return {
    ...actual,
    toSharePointStatus: vi.fn(actual.toSharePointStatus),
  };
});

let staffTextSpy: ReturnType<typeof vi.spyOn> | undefined;

const baseSp = (overrides: Partial<SpScheduleItem> = {}): SpScheduleItem => ({
  Id: 1,
  Title: '  会議  ',
  EventDate: '2025-04-01T00:00:00Z',
  EndDate: '2025-04-01T01:00:00Z',
  AllDay: false,
  Status: '予定',
  cr014_category: 'User',
  cr014_staffIds: '99',
  '@odata.etag': '"1"',
  ...overrides,
});

describe('spMap full branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    staffTextSpy?.mockRestore();
    staffTextSpy = vi.spyOn(features, 'isScheduleStaffTextColumnsEnabled');
    vi.mocked(toSharePointStatus).mockClear();
  });

  it('User: 内部/外部で人属性の null/必須切替、staff-text=ON の書き分け', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(true);

    const u1 = fromSpSchedule(baseSp({
      cr014_category: 'User',
      cr014_personType: 'Internal',
      cr014_personId: '  21  ',
      cr014_personName: ' 山田 ',
      cr014_staffIds: ' 21 ',
      cr014_serviceType: '一時ケア',
    }));

    const payload1 = toSpScheduleFields(u1);
    expect(payload1).toMatchObject({
      Title: expect.any(String),
      EventDate: expect.any(String),
      EndDate: expect.any(String),
      AllDay: false,
      Notes: null,
      Location: null,
      [SCHEDULE_FIELD_CATEGORY]: 'User',
      [SCHEDULE_FIELD_SERVICE_TYPE]: '一時ケア',
      [SCHEDULE_FIELD_PERSON_TYPE]: 'Internal',
      [SCHEDULE_FIELD_PERSON_ID]: '21',
      [SCHEDULE_FIELD_PERSON_NAME]: '山田',
      [SCHEDULE_FIELD_EXTERNAL_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_ORG]: null,
      [SCHEDULE_FIELD_EXTERNAL_CONTACT]: null,
      [SCHEDULE_FIELD_STAFF_IDS]: '["21"]',
      [SCHEDULE_FIELD_STAFF_NAMES]: null,
    });
    expect(vi.mocked(toSharePointStatus)).toHaveBeenCalled();

    const u2 = fromSpSchedule(baseSp({
      cr014_category: 'User',
      cr014_personType: 'External',
      cr014_externalPersonName: '外部A',
      cr014_externalPersonOrg: 'OrgX',
      cr014_externalPersonContact: '090-xxxx-xxxx',
      cr014_staffIds: '   ',
      StaffIdId: 7,
      cr014_serviceType: 'ショートステイ',
    }));

    const payload2 = toSpScheduleFields(u2);
    expect(payload2).toMatchObject({
      [SCHEDULE_FIELD_PERSON_TYPE]: 'External',
      [SCHEDULE_FIELD_PERSON_ID]: null,
      [SCHEDULE_FIELD_PERSON_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_NAME]: '外部A',
      [SCHEDULE_FIELD_EXTERNAL_ORG]: 'OrgX',
      [SCHEDULE_FIELD_EXTERNAL_CONTACT]: '090-xxxx-xxxx',
    });
    expect(payload2[SCHEDULE_FIELD_STAFF_IDS]).toBe('["7"]');
  });

  it('Org: staff-text=OFF の時は staff テキスト列を送らない + audience 正規化', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(false);
    const org = fromSpSchedule(baseSp({
      cr014_category: 'Org',
      SubType: 'training',
      cr014_orgAudience: '  A, B ; C　,  A ',
      cr014_resourceId: '  R-1 ',
      ExternalOrgName: '  外部団体  ',
    }));

    const payload = toSpScheduleFields(org);
    expect(payload).toMatchObject({
      [SCHEDULE_FIELD_CATEGORY]: 'Org',
      [SCHEDULE_FIELD_SUB_TYPE]: '研修',
      [SCHEDULE_FIELD_ORG_AUDIENCE]: '["A","B","C"]',
      [SCHEDULE_FIELD_ORG_RESOURCE_ID]: 'R-1',
      [SCHEDULE_FIELD_ORG_EXTERNAL_NAME]: '外部団体',
    });
    const keys = Object.keys(payload);
    expect(keys).not.toContain(SCHEDULE_FIELD_STAFF_IDS);
    expect(keys).not.toContain(SCHEDULE_FIELD_STAFF_NAMES);
  });

  it('Staff: staffIds の優先順位（field > lookup > StaffIdId）と 年休のみ dayPart 反映', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(true);
    const st1 = fromSpSchedule(baseSp({
      cr014_category: 'Staff',
      SubType: 'vacation',
      DayPart: ' 午後 ',
      cr014_staffIds: '  ',
  StaffLookupId: { results: ['1', ' 2 , 3 ', ' 4;5 '] },
      StaffLookup: { results: [{ Title: ' 佐藤 ' }, { FullName: ' 鈴木 ' }, { StaffID: '  田中 ' }] },
      StaffIdId: 9,
    }));

    const payload1 = toSpScheduleFields(st1);
    expect(payload1[SCHEDULE_FIELD_SUB_TYPE]).toBe('年休');
    expect(payload1[SCHEDULE_FIELD_DAY_PART]).toBe('PM');
    const staffIds = JSON.parse(String(payload1[SCHEDULE_FIELD_STAFF_IDS])) as string[];
    expect(staffIds).toEqual(['1', '2', '3', '4', '5']);

    const st2 = fromSpSchedule(baseSp({
      cr014_category: 'Staff',
      SubType: 'meeting',
      DayPart: 'AM',
      cr014_staffIds: ' "21","22" ',
    }));
    const payload2 = toSpScheduleFields(st2);
    expect(payload2[SCHEDULE_FIELD_SUB_TYPE]).toBe('会議');
    expect(payload2[SCHEDULE_FIELD_DAY_PART]).toBeNull();
  });

  it('再発ルールの正規化（null 三点セット vs 文字列三点セット）', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(true);
    const user = fromSpSchedule(baseSp({
      cr014_category: 'User',
      cr014_personType: 'Internal',
      cr014_personId: '1',
      cr014_personName: 'A',
    }));

    const none = toSpScheduleFields(user);
    expect(none).toMatchObject({ RecurrenceJson: null, RRule: null, RecurrenceData: null });

    (user as { recurrenceRule?: string }).recurrenceRule = 'FREQ=DAILY';
    const withRule = toSpScheduleFields(user);
    expect(withRule).toMatchObject({ RecurrenceJson: 'FREQ=DAILY', RRule: 'FREQ=DAILY', RecurrenceData: 'FREQ=DAILY' });
  });

  it('dayKey / fiscalYear の算出フォールバック（空フィールド→計算値を補填）', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(false);
    const schedule = fromSpSchedule(baseSp({
      cr014_category: 'User',
      cr014_personType: 'Internal',
      cr014_personId: '10',
      cr014_personName: 'B',
      cr014_dayKey: '   ',
      cr014_fiscalYear: undefined,
    }));

    const payload = toSpScheduleFields(schedule);
    expect(String(payload[SCHEDULE_FIELD_DAY_KEY])).toMatch(/^[0-9]{8}$/);
    expect(Number(payload[SCHEDULE_FIELD_FISCAL_YEAR])).toBeGreaterThan(2000);
  });

  it('toSpScheduleFields: 未知カテゴリは例外を投げる（default 分岐）', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(true);
    const unsupported = {
      id: 'x',
      etag: 'W/"x"',
      category: 'Other',
      title: 'Unsupported',
      start: '2025-04-01T00:00:00Z',
      end: '2025-04-01T01:00:00Z',
      allDay: false,
      status: 'draft',
      location: null,
      notes: null,
    } as unknown as Parameters<typeof toSpScheduleFields>[0];

    expect(() => toSpScheduleFields(unsupported)).toThrow(/Unsupported schedule category/i);
  });

  it('入力 ISO が壊れていても toUtcIso/computeDayKey/computeFiscalYear の try/catch で安全に undefined', () => {
    const spy = staffTextSpy!;
    spy.mockReturnValue(false);
    const corrupted = fromSpSchedule(baseSp({
      cr014_category: 'Org',
      EventDate: '  not-a-date  ',
      EndDate: '    ',
      cr014_dayKey: undefined,
      cr014_fiscalYear: '   ',
    }));

    const payload = toSpScheduleFields(corrupted);
    expect(payload).toBeTruthy();
  });
});
