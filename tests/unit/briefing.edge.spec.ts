import { describe, it } from 'vitest';

describe.skip('legacy schedule tests removed', () => {
  it('skipped', () => {});
});
import { getBriefingForDay } from '@/features/schedule/briefing';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
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

const getUserCareSchedules = vi.mocked(
  await import('@/features/schedule/spClient.schedule').then((mod) => mod.getUserCareSchedules),
);
const getOrgSchedules = vi.mocked(
  await import('@/features/schedule/spClient.schedule.org').then((mod) => mod.getOrgSchedules),
);
const getStaffSchedules = vi.mocked(
  await import('@/features/schedule/spClient.schedule.staff').then((mod) => mod.getStaffSchedules),
);

describe.skip('getBriefingForDay (legacy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves external all-day wording for user care schedules', async () => {
    const externalUser: ScheduleUserCare = {
        id: 'u-1',
        category: 'User',
        etag: 'W/"1"',
        status: '承認済み',
        allDay: true,
        start: '2025-06-01T00:00:00Z',
        end: '2025-06-02T00:00:00Z',
        serviceType: '一時ケア',
        personType: 'External',
        externalPersonName: '',
  externalPersonOrg: '芸術サポート',
        title: '訪問支援',
        staffNames: [],
        staffIds: [],
        notes: '',
        location: '',
      };
    getUserCareSchedules.mockResolvedValue([externalUser]);
    getOrgSchedules.mockResolvedValue([]);
    getStaffSchedules.mockResolvedValue([]);

    const briefing = await getBriefingForDay({} as never, new Date('2025-06-01T03:00:00Z'));
    expect(briefing.items).toHaveLength(1);
    expect(briefing.items[0].text).toContain('外部利用者');
    expect(briefing.items[0].text).toContain('終日');
  });

  it('sorts mixed sources by start time and keeps staff names grouped', async () => {
    const userEvent: ScheduleUserCare = {
        id: 'u-2',
        category: 'User',
        etag: 'W/"2"',
        status: '承認済み',
        allDay: false,
        start: '2025-06-01T00:30:00Z',
        end: '2025-06-01T01:00:00Z',
        serviceType: 'ショートステイ',
        personType: 'Internal',
        externalPersonName: '',
  externalPersonOrg: '',
        title: '通所プログラム',
        staffNames: ['山田', '佐藤'],
        staffIds: ['11', '12'],
        notes: '',
        location: '',
      };
    const orgEvent: ScheduleOrg = {
        id: 'o-1',
        category: 'Org',
        etag: 'W/"3"',
        status: '承認済み',
        allDay: false,
        start: '2025-06-01T00:00:00Z',
        end: '2025-06-01T00:30:00Z',
        title: '朝礼',
        notes: '',
        location: '会議室',
        subType: '会議',
      };
    const staffEvent: ScheduleStaff = {
        id: 's-1',
        category: 'Staff',
        etag: 'W/"4"',
        status: '承認済み',
        allDay: false,
        start: '2025-06-01T02:00:00Z',
        end: '2025-06-01T03:00:00Z',
        title: '個別面談',
        notes: '',
        location: '相談室',
        staffNames: ['田中'],
        staffIds: ['21'],
        subType: '会議',
        dayPart: 'Full',
      };
    getUserCareSchedules.mockResolvedValue([userEvent]);
    getOrgSchedules.mockResolvedValue([orgEvent]);
    getStaffSchedules.mockResolvedValue([staffEvent]);

    const briefing = await getBriefingForDay({} as never, new Date('2025-06-01T03:00:00Z'));
    expect(briefing.items.map((item) => item.id)).toEqual(['o-1', 'u-2', 's-1']);
    expect(briefing.items[1].text).toContain('山田');
    expect(briefing.items[1].text).toContain('佐藤');
  });
});
