import { addDays, formatISO, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { TIME_ZONE, type ScheduleFixtures, type ScheduleItem } from './spMock';

const TZ_OFFSET = '+09:00';

export const SCHEDULE_FIXTURE_BASE_DATE = new Date('2025-12-01T03:00:00+09:00');

const toIso = (dateKey: string, time: string) => formatISO(new Date(`${dateKey}T${time}${TZ_OFFSET}`));

const normaliseDateKey = (dateInput: Date | string): string => {
  if (typeof dateInput === 'string') {
    const parsed = parseISO(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      return formatInTimeZone(parsed, TIME_ZONE, 'yyyy-MM-dd');
    }
    return dateInput;
  }
  return formatInTimeZone(dateInput, TIME_ZONE, 'yyyy-MM-dd');
};

const withDateColumns = (startIso: string, endIso: string): Pick<ScheduleItem, 'Start' | 'EventDate' | 'End' | 'EndDate'> => ({
  Start: startIso,
  EventDate: startIso,
  End: endIso,
  EndDate: endIso,
});

export function buildStaffMorningFixture(dateInput: Date | string): ScheduleItem {
  const dateKey = normaliseDateKey(dateInput);
  const start = toIso(dateKey, '09:00:00');
  const end = toIso(dateKey, '12:00:00');
  return {
    Id: 9201,
    Title: '午前会議',
    ...withDateColumns(start, end),
    AllDay: false,
    Status: '承認済み',
    DayPart: 'AM',
    cr014_category: 'Staff',
    cr014_personType: 'Internal',
    cr014_personName: '吉田 千尋',
    cr014_staffIds: ['401'],
    cr014_staffNames: ['吉田 千尋'],
    cr014_dayKey: dateKey,
    cr014_fiscalYear: formatInTimeZone(new Date(`${dateKey}T00:00:00${TZ_OFFSET}`), TIME_ZONE, 'yyyy'),
    '@odata.etag': '"21"',
  } satisfies ScheduleItem;
}

export function buildScheduleFixturesForDate(dateInput: Date = new Date()): Required<ScheduleFixtures> {
  const dayKey = formatInTimeZone(dateInput, TIME_ZONE, 'yyyy-MM-dd');
  const fiscalYear = formatInTimeZone(dateInput, TIME_ZONE, 'yyyy');
  const previousDay = addDays(dateInput, -1);
  const previousDayKey = formatInTimeZone(previousDay, TIME_ZONE, 'yyyy-MM-dd');

  const userFixtures: ScheduleItem[] = [
    {
      Id: 9101,
      Title: '訪問リハビリ',
      ...withDateColumns(toIso(dayKey, '09:00:00'), toIso(dayKey, '09:30:00')),
      AllDay: false,
      Status: '承認済み',
      Location: 'リハビリ室A',
      cr014_category: 'User',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: 'U-101',
      cr014_personName: '田中 実',
      cr014_staffIds: ['301'],
      cr014_staffNames: ['阿部 真央'],
      cr014_dayKey: dayKey,
      cr014_fiscalYear: fiscalYear,
      '@odata.etag': '"9"',
    },
    {
      Id: 9102,
      Title: '訪問看護',
      ...withDateColumns(toIso(dayKey, '09:15:00'), toIso(dayKey, '10:00:00')),
      AllDay: false,
      Status: '申請中',
      Location: '利用者宅B',
      cr014_category: 'User',
      cr014_serviceType: 'ショートステイ',
      cr014_personType: 'Internal',
      cr014_personId: 'U-102',
      cr014_personName: '古山 美紀',
      cr014_staffIds: ['302'],
      cr014_staffNames: ['蒼井 純'],
      cr014_dayKey: dayKey,
      cr014_fiscalYear: fiscalYear,
      '@odata.etag': '"10"',
    },
    {
      Id: 9103,
      Title: '夜間対応',
      ...withDateColumns(toIso(previousDayKey, '23:30:00'), toIso(dayKey, '01:00:00')),
      AllDay: false,
      Status: '下書き',
      Location: '利用者宅C',
      cr014_category: 'User',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: 'U-103',
      cr014_personName: '斎藤 遼',
      cr014_staffIds: ['303'],
      cr014_staffNames: ['佐伯 由真'],
      cr014_dayKey: previousDayKey,
      cr014_fiscalYear: fiscalYear,
      '@odata.etag': '"11"',
    },
  ];

  const staffFixtures: ScheduleItem[] = [buildStaffMorningFixture(dateInput)];

  const orgFixtures: ScheduleItem[] = [
    {
      Id: 9301,
      Title: '連絡会議',
      ...withDateColumns(toIso(dayKey, '13:30:00'), toIso(dayKey, '14:30:00')),
      AllDay: false,
      Status: '承認済み',
      SubType: '会議',
      Location: '会議室B',
      cr014_category: 'Org',
      cr014_personType: 'Internal',
      cr014_personName: '調整担当',
      cr014_dayKey: dayKey,
      cr014_fiscalYear: fiscalYear,
      '@odata.etag': '"31"',
    },
  ];

  return {
    User: userFixtures,
    Staff: staffFixtures,
    Org: orgFixtures,
  };
}

export function buildWeekScheduleFixtures(dateInput: Date = SCHEDULE_FIXTURE_BASE_DATE): ScheduleItem[] {
  const fixtures = buildScheduleFixturesForDate(dateInput);
  return [...fixtures.User, ...fixtures.Staff, ...fixtures.Org];
}
