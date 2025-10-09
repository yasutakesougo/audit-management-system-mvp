import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getBriefingForDay } from '../briefing';
import { getUserCareSchedules } from '../spClient.schedule';
import { getOrgSchedules } from '../spClient.schedule.org';
import { getStaffSchedules } from '../spClient.schedule.staff';
import type { ScheduleOrg, ScheduleStaff } from '../types';
import type { UseSP } from '@/lib/spClient';

vi.mock('../spClient.schedule', () => ({
  getUserCareSchedules: vi.fn(),
}));

vi.mock('../spClient.schedule.org', () => ({
  getOrgSchedules: vi.fn(),
}));

vi.mock('../spClient.schedule.staff', () => ({
  getStaffSchedules: vi.fn(),
}));

const mockedGetUserCare = getUserCareSchedules as typeof getUserCareSchedules & {
  mockReset: () => void;
  mockResolvedValue: (value: Awaited<ReturnType<typeof getUserCareSchedules>>) => void;
};

const mockedGetOrg = getOrgSchedules as typeof getOrgSchedules & {
  mockReset: () => void;
  mockResolvedValue: (value: Awaited<ReturnType<typeof getOrgSchedules>>) => void;
};

const mockedGetStaff = getStaffSchedules as typeof getStaffSchedules & {
  mockReset: () => void;
  mockResolvedValue: (value: Awaited<ReturnType<typeof getStaffSchedules>>) => void;
};

describe('briefing schedule integration (Org/Staff)', () => {
  const sp = {} as UseSP;

  beforeEach(() => {
    mockedGetUserCare.mockReset();
    mockedGetOrg.mockReset();
    mockedGetStaff.mockReset();
  });

  test('org schedules are rendered with external org head and time span', async () => {
    mockedGetUserCare.mockResolvedValue([]);
    const orgRow: ScheduleOrg = {
      id: 'org-1',
      etag: '1',
      category: 'Org',
      title: '地域連携会議',
      start: '2025-10-02T23:30:00.000Z',
      end: '2025-10-03T01:00:00.000Z',
      allDay: false,
    status: '承認済み',
      location: '第1会議室',
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      subType: '外部団体利用',
      audience: undefined,
      resourceId: undefined,
      externalOrgName: 'さつき会',
    };
    mockedGetOrg.mockResolvedValue([orgRow]);
    mockedGetStaff.mockResolvedValue([]);

    const bundle = await getBriefingForDay(sp, new Date('2025-10-03T00:00:00+09:00'));

    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].kind).toBe('Org');
    expect(bundle.items[0].text).toMatch(/さつき会 \/ 外部団体利用・第1会議室：地域連携会議 08:30–10:00/);
  });

  test('staff schedules include half-day annotation with AM/PM mark', async () => {
    mockedGetUserCare.mockResolvedValue([]);
    mockedGetOrg.mockResolvedValue([]);
    const staffRow: ScheduleStaff = {
      id: 'staff-1',
      etag: '2',
      category: 'Staff',
      title: '年休',
      start: '2025-10-02T23:30:00.000Z',
      end: '2025-10-03T04:00:00.000Z',
      allDay: false,
      status: '申請中',
      location: undefined,
      notes: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
      subType: '年休',
      staffIds: ['S-101'],
      staffNames: ['坂元'],
      dayPart: 'AM',
    };
    mockedGetStaff.mockResolvedValue([staffRow]);

    const bundle = await getBriefingForDay(sp, new Date('2025-10-03T00:00:00+09:00'));
    const staffLine = bundle.items.find((item) => item.kind === 'Staff');

    expect(staffLine?.text).toMatch(/坂元 年休\(AM\) 08:30–13:00/);
  });
});
