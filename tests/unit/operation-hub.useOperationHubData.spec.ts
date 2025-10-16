import type { Schedule } from '@/lib/mappers';
import type { Staff, User } from '@/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureOperationHubListsMock = vi.fn(async () => {});
const useEnsureOperationHubListsMock = vi.fn();
const useSchedulesMock = vi.fn();
const useUsersMock = vi.fn();
const useStaffMock = vi.fn();

const spStub = { ensureListExists: vi.fn(), spFetch: vi.fn() };
const useSPMock = vi.fn(() => spStub);

vi.mock('@/features/operation-hub/ensureCoreLists', () => ({
  ensureOperationHubLists: ensureOperationHubListsMock,
  useEnsureOperationHubLists: useEnsureOperationHubListsMock,
}));

vi.mock('@/stores/useSchedules', () => ({
  useSchedules: useSchedulesMock,
}));

vi.mock('@/stores/useUsers', () => ({
  useUsers: useUsersMock,
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: useStaffMock,
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => useSPMock(),
}));

vi.mock('@/utils/getNow', () => ({
  getNow: () => new Date('2025-05-01T00:00:00.000Z'),
}));

const assignedSchedule: Schedule = {
  id: 1,
  etag: '"1"',
  title: '生活介護（午前）',
  startUtc: '2025-05-01T00:00:00.000Z',
  endUtc: '2025-05-01T06:00:00.000Z',
  startLocal: '2025-05-01T09:00:00+09:00',
  endLocal: '2025-05-01T15:00:00+09:00',
  startDate: '2025-05-01',
  endDate: '2025-05-01',
  allDay: false,
  location: null,
  staffId: 11,
  userId: 20,
  status: 'approved',
  notes: null,
  recurrenceRaw: null,
  recurrence: undefined,
  created: undefined,
  modified: undefined,
  category: '生活介護',
  serviceType: null,
  personType: null,
  personId: null,
  personName: '利用者A',
  staffIds: ['10'],
  staffNames: ['高橋 三郎'],
  dayPart: null,
};

const unassignedSchedule: Schedule = {
  id: 2,
  etag: '"2"',
  title: '送迎（午後）',
  startUtc: '2025-05-01T06:00:00.000Z',
  endUtc: '2025-05-01T08:00:00.000Z',
  startLocal: '2025-05-01T15:00:00+09:00',
  endLocal: '2025-05-01T17:00:00+09:00',
  startDate: '2025-05-01',
  endDate: '2025-05-01',
  allDay: false,
  location: null,
  staffId: null,
  userId: 21,
  status: 'submitted',
  notes: '担当未定',
  recurrenceRaw: null,
  recurrence: undefined,
  created: undefined,
  modified: undefined,
  category: '送迎',
  serviceType: null,
  personType: null,
  personId: null,
  personName: '利用者B',
  staffIds: [],
  staffNames: [],
  dayPart: null,
};

const staffMembers: Staff[] = [
  {
    id: 10,
    staffId: 'S10',
    name: '佐藤 花子',
    role: '常勤',
    active: true,
    certifications: [],
    workDays: [],
    baseShiftStartTime: '09:00',
    baseShiftEndTime: '18:00',
    baseWorkingDays: ['月', '火', '水', '木', '金'],
  },
  {
    id: 11,
    staffId: 'S11',
    name: '高橋 三郎',
    role: '非常勤',
    active: true,
    certifications: ['更新要'],
    workDays: [],
    baseShiftStartTime: '10:00',
    baseShiftEndTime: '16:00',
    baseWorkingDays: ['火', '水', '木'],
  },
];

const users: User[] = [
  {
    id: 20,
    userId: 'U20',
    name: '利用者A',
    toDays: [],
    fromDays: [],
    attendanceDays: [],
    contractDate: '2024-05-25',
    certExpiry: '2025-05-05',
    active: true,
  },
  {
    id: 21,
    userId: 'U21',
    name: '利用者B',
    toDays: [],
    fromDays: [],
    attendanceDays: [],
    contractDate: '2024-04-01',
    certExpiry: undefined,
    active: true,
  },
];

const reloadSchedules = vi.fn(async () => {});
const reloadUsers = vi.fn(async () => {});
const reloadStaff = vi.fn(async () => {});

const loadStoreMocks = () => {
  useSchedulesMock.mockReturnValue({ data: [assignedSchedule, unassignedSchedule], loading: false, error: null, reload: reloadSchedules });
  useUsersMock.mockReturnValue({ data: users, loading: false, error: null, reload: reloadUsers });
  useStaffMock.mockReturnValue({ data: staffMembers, loading: false, error: null, reload: reloadStaff });
  useSPMock.mockReturnValue(spStub);
};

describe('useOperationHubData', () => {
  beforeEach(() => {
    ensureOperationHubListsMock.mockClear();
    useEnsureOperationHubListsMock.mockClear();
    useSchedulesMock.mockReset();
    useUsersMock.mockReset();
    useStaffMock.mockReset();
    reloadSchedules.mockClear();
    reloadUsers.mockClear();
    reloadStaff.mockClear();
    spStub.ensureListExists.mockClear();
    spStub.spFetch.mockClear();
    loadStoreMocks();
  });

  it('aggregates SharePoint data into dashboard state', async () => {
    const { useOperationHubData } = await import('@/features/operation-hub/useOperationHubData');
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.ready).toBe(true);
    expect(result.current.dateISO).toBe('2025-05-01');
    expect(result.current.kpis[0]).toMatchObject({ id: 'coverage', value: '50%' });
    expect(result.current.kpis[1]).toMatchObject({ id: 'unassigned', value: '1件' });
    expect(result.current.kpis[1].helperAction).toBeTruthy();
    expect(result.current.alerts.length).toBeGreaterThan(1);
  expect(result.current.contractExpirations).toHaveLength(0);
    expect(result.current.timeline).not.toBeNull();
    expect(result.current.timeline?.resources.length).toBeGreaterThanOrEqual(2);
    expect(result.current.mobileTasks).toHaveLength(1);
    expect(result.current.unassignedSchedules).toHaveLength(1);
  });

  it('refresh triggers ensure and reloads', async () => {
    const { useOperationHubData } = await import('@/features/operation-hub/useOperationHubData');
    const { result } = renderHook(() => useOperationHubData());

    await act(async () => {
      await result.current.refresh();
    });

    expect(ensureOperationHubListsMock).toHaveBeenCalledTimes(1);
    expect(reloadSchedules).toHaveBeenCalledTimes(1);
    expect(reloadUsers).toHaveBeenCalledTimes(1);
    expect(reloadStaff).toHaveBeenCalledTimes(1);
  });

  it('surfaces loading state and error messages from stores', async () => {
    useSchedulesMock.mockReturnValueOnce({
      data: undefined,
      loading: true,
      error: new Error('schedules down'),
      reload: reloadSchedules,
    });
    useUsersMock.mockReturnValueOnce({
      data: undefined,
      loading: false,
      error: new Error('users down'),
      reload: reloadUsers,
    });
    useStaffMock.mockReturnValueOnce({
      data: undefined,
      loading: false,
      error: new Error('staff down'),
      reload: reloadStaff,
    });

    const { useOperationHubData } = await import('@/features/operation-hub/useOperationHubData');
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.loading).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(result.current.errors).toEqual({
      schedules: 'schedules down',
      users: 'users down',
      staff: 'staff down',
    });
  });

  it('returns null timeline but keeps alerts when no schedules match today', async () => {
    useSchedulesMock.mockReturnValueOnce({
      data: [],
      loading: false,
      error: null,
      reload: reloadSchedules,
    });
    const infoStaff = staffMembers.map((member, index) => ({
      ...member,
      certifications: [],
      role: index === 0 ? '' : member.role,
    }));
    useStaffMock.mockReturnValueOnce({
      data: infoStaff,
      loading: false,
      error: null,
      reload: reloadStaff,
    });

    const { useOperationHubData } = await import('@/features/operation-hub/useOperationHubData');
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.timeline).toBeNull();
    expect(result.current.mobileTasks).toHaveLength(0);
    expect(result.current.unassignedSchedules).toHaveLength(0);
    expect(result.current.alerts.some((alert) => /役割情報が未入力/.test(alert.message))).toBe(true);
  });

  it('classifies timeline resources, marks conflicts, and derives mobile task statuses', async () => {
    const scheduleTemplate = (overrides: Partial<Schedule>): Schedule => ({
      id: 1000,
      etag: '"base"',
      title: '予定',
      startUtc: '2025-05-01T00:00:00.000Z',
      endUtc: '2025-05-01T01:00:00.000Z',
      startLocal: '2025-05-01T09:00:00+09:00',
      endLocal: '2025-05-01T10:00:00+09:00',
      startDate: '2025-05-01',
      endDate: '2025-05-01',
      allDay: false,
      location: null,
      staffId: null,
      userId: 20,
      status: 'approved',
      notes: null,
      recurrenceRaw: null,
      recurrence: undefined,
      created: undefined,
      modified: undefined,
      category: '生活介護',
      serviceType: null,
      personType: null,
      personId: null,
      personName: '利用者C',
      staffIds: [],
      staffNames: [],
      dayPart: null,
      ...overrides,
    });

    const extendedStaff: Staff[] = [
      {
        id: 5,
        staffId: 'ADMIN',
        name: '管理者 太郎',
        role: '施設長',
        active: true,
        certifications: [],
        workDays: [],
        baseShiftStartTime: '09:00',
        baseShiftEndTime: '18:00',
        baseWorkingDays: ['月', '火'],
      },
      ...staffMembers,
      {
        id: 12,
        staffId: 'S12',
        name: '山本 花',
        role: '正社員',
        active: true,
        certifications: [],
        workDays: [],
        baseShiftStartTime: '09:00',
        baseShiftEndTime: '18:00',
        baseWorkingDays: ['月', '火', '水'],
      },
    ];

    const overlapSchedules: Schedule[] = [
      scheduleTemplate({
        id: 201,
        staffId: 11,
        startLocal: '2025-05-01T05:30:00+09:00',
        endLocal: '2025-05-01T08:30:00+09:00',
        startUtc: '2025-04-30T20:30:00.000Z',
        endUtc: '2025-04-30T23:30:00.000Z',
        notes: '夜間対応',
      }),
      scheduleTemplate({
        id: 202,
        staffId: 11,
        startLocal: '2025-05-01T09:45:00+09:00',
        endLocal: '2025-05-01T10:45:00+09:00',
        startUtc: '2025-05-01T00:45:00.000Z',
        endUtc: '2025-05-01T01:45:00.000Z',
        category: '送迎',
      }),
      scheduleTemplate({
        id: 203,
        staffId: 11,
        startLocal: '2025-05-01T11:00:00+09:00',
        endLocal: '2025-05-01T12:30:00+09:00',
        startUtc: '2025-05-01T02:00:00.000Z',
        endUtc: '2025-05-01T03:30:00.000Z',
      }),
      scheduleTemplate({
        id: 208,
        staffId: 11,
        startLocal: '2025-05-01T08:15:00+09:00',
        endLocal: '2025-05-01T09:45:00+09:00',
        startUtc: '2025-04-30T23:15:00.000Z',
        endUtc: '2025-05-01T00:45:00.000Z',
        category: '一時ケア',
      }),
      scheduleTemplate({
        id: 204,
        staffId: 5,
        startLocal: '2025-05-01T09:00:00+09:00',
        endLocal: '2025-05-01T10:00:00+09:00',
        startUtc: '2025-05-01T00:00:00.000Z',
        endUtc: '2025-05-01T01:00:00.000Z',
        category: 'イベント',
      }),
      scheduleTemplate({
        id: 205,
        staffNames: ['高橋 三郎'],
        startLocal: '2025-05-01T12:30:00+09:00',
        endLocal: '2025-05-01T13:30:00+09:00',
        startUtc: '2025-05-01T03:30:00.000Z',
        endUtc: '2025-05-01T04:30:00.000Z',
      }),
      scheduleTemplate({
        id: 206,
        staffNames: ['外部支援者'],
        startLocal: '2025-05-01T09:30:00+09:00',
        endLocal: '2025-05-01T10:30:00+09:00',
        startUtc: '2025-05-01T00:30:00.000Z',
        endUtc: '2025-05-01T01:30:00.000Z',
      }),
      scheduleTemplate({
        id: 207,
        startLocal: '2025-05-01T13:00:00+09:00',
        endLocal: '2025-05-01T14:00:00+09:00',
        startUtc: '2025-05-01T04:00:00.000Z',
        endUtc: '2025-05-01T05:00:00.000Z',
      }),
    ];

    useSchedulesMock.mockReturnValueOnce({
      data: overlapSchedules,
      loading: false,
      error: null,
      reload: reloadSchedules,
    });
    useUsersMock.mockReturnValueOnce({ data: users, loading: false, error: null, reload: reloadUsers });
    useStaffMock.mockReturnValueOnce({ data: extendedStaff, loading: false, error: null, reload: reloadStaff });

    const { useOperationHubData } = await import('@/features/operation-hub/useOperationHubData');
    const { result } = renderHook(() => useOperationHubData());

    const timeline = result.current.timeline;
    expect(timeline).not.toBeNull();
    const staffResource = timeline?.resources.find((res) => res.name === '高橋 三郎');
  expect(staffResource?.events.filter((event) => event.conflict)).toHaveLength(2);
    const directorResource = timeline?.resources.find((res) => res.employmentType === '施設長');
    expect(directorResource?.groupLabel).toBe('施設長');
    const unmatchedResource = timeline?.resources.find((res) => res.name === '外部支援者');
    expect(unmatchedResource?.groupLabel).toBe('その他リソース');
    const unassignedResource = timeline?.resources.find((res) => res.name === '未割当');
    expect(unassignedResource).toBeTruthy();

    const statuses = result.current.mobileTasks.map((task) => task.status);
    expect(statuses).toEqual(expect.arrayContaining(['completed', 'alert', 'pending']));
    const alertTask = result.current.mobileTasks.find((task) => task.status === 'alert');
    expect(alertTask?.actions?.some((action) => action.label === '緊急連絡')).toBe(true);
  });
});
