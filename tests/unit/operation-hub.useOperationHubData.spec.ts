import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Schedule } from '@/lib/mappers';
import type { Staff, User } from '@/types';

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
});
