import { getBriefingForDay } from '@/features/schedule/briefing';
import { getUserCareSchedules } from '@/features/schedule/spClient.schedule';
import { getOrgSchedules } from '@/features/schedule/spClient.schedule.org';
import { getStaffSchedules } from '@/features/schedule/spClient.schedule.staff';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
import type { UseSP } from '@/lib/spClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/schedule/spClient.schedule', () => ({
  getUserCareSchedules: vi.fn(),
}));

vi.mock('@/features/schedule/spClient.schedule.org', () => ({
  getOrgSchedules: vi.fn(),
}));

vi.mock('@/features/schedule/spClient.schedule.staff', () => ({
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

describe('briefing schedule formatting edge cases', () => {
  const sp = {} as UseSP;

  beforeEach(() => {
    mockedGetUserCare.mockReset();
    mockedGetOrg.mockReset();
    mockedGetStaff.mockReset();
  });

  it('formats external user all-day entries with fallback staff names and location', async () => {
    const userRow: ScheduleUserCare = {
      id: 'user-1',
      etag: 'etag-user-1',
      category: 'User',
      title: '訪問診療',
      start: '2025-10-03T00:00:00.000Z',
      end: '2025-10-03T12:00:00.000Z',
      allDay: true,
      status: '承認済み',
      serviceType: '一時ケア',
      personType: 'External',
  staffIds: ['S-200'],
  staffNames: ['佐藤'],
      externalPersonName: '',
      externalPersonOrg: 'さつき医院',
      location: '居室A',
    };

    mockedGetUserCare.mockResolvedValue([userRow]);
    mockedGetOrg.mockResolvedValue([]);
    mockedGetStaff.mockResolvedValue([]);

    const bundle = await getBriefingForDay(sp, new Date('2025-10-03T00:00:00+09:00'));
    const userLine = bundle.items.find((item) => item.kind === 'User');

    expect(userLine).toBeDefined();
    expect(userLine?.text).toContain('外部利用者');
    expect(userLine?.text).toContain('一時ケア');
  expect(userLine?.text).toContain('担当: 佐藤');
    expect(userLine?.text).toContain('居室A');
    expect(userLine?.text).toContain('終日');
  });

  it('includes fallback staff id and dayPart annotations for staff schedules', async () => {
    mockedGetUserCare.mockResolvedValue([]);
    mockedGetOrg.mockResolvedValue([]);

    const staffRow: ScheduleStaff = {
      id: 'staff-2',
      etag: 'etag-staff-2',
      category: 'Staff',
      title: '有給',
      start: '2025-10-02T23:00:00.000Z',
      end: '2025-10-03T04:00:00.000Z',
      allDay: false,
      status: '承認済み',
      subType: '年休',
      staffIds: ['S-300'],
      dayPart: 'PM',
    };

    mockedGetStaff.mockResolvedValue([staffRow]);

    const bundle = await getBriefingForDay(sp, new Date('2025-10-03T00:00:00+09:00'));
    const staffLine = bundle.items.find((item) => item.kind === 'Staff');

    expect(staffLine).toBeDefined();
    expect(staffLine?.text).toContain('S-300');
    expect(staffLine?.text).toContain('PM');
    expect(staffLine?.text).not.toContain('終日');
  });

  it('orders mixed schedule kinds by start time and formats org headings without location', async () => {
    const orgRow: ScheduleOrg = {
      id: 'org-2',
      etag: 'etag-org-2',
      category: 'Org',
      title: '運営会議',
      start: '2025-10-03T01:00:00.000Z',
      end: '2025-10-03T03:00:00.000Z',
      allDay: false,
      status: '承認済み',
      subType: '会議',
      externalOrgName: '地域包括',
    };

    const userRow: ScheduleUserCare = {
      id: 'user-2',
      etag: 'etag-user-2',
      category: 'User',
      title: 'ショート',
      start: '2025-10-03T02:00:00.000Z',
      end: '2025-10-03T05:00:00.000Z',
      allDay: false,
      status: '承認済み',
      serviceType: 'ショートステイ',
      personType: 'Internal',
      personId: 'P-10',
      personName: '田中',
      staffIds: ['S-400'],
    };

    mockedGetOrg.mockResolvedValue([orgRow]);
    mockedGetUserCare.mockResolvedValue([userRow]);
    mockedGetStaff.mockResolvedValue([]);

    const bundle = await getBriefingForDay(sp, new Date('2025-10-03T00:00:00+09:00'));

    expect(bundle.items).toHaveLength(2);
    expect(new Date(bundle.items[0]?.start ?? '').getTime()).toBeLessThan(new Date(bundle.items[1]?.start ?? '').getTime());
    const orgLine = bundle.items.find((item) => item.kind === 'Org');
    expect(orgLine?.text).toContain('地域包括');
    expect(orgLine?.text).toMatch(/運営会議/);
    expect(orgLine?.text).not.toContain('終日');
  });
});
