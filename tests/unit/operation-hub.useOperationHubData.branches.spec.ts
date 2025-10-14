import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schedule } from '@/lib/mappers';
import type { Staff, User } from '@/types';

type StoreResult<T> = {
  data: T | undefined;
  loading: boolean;
  error?: Error | null;
  reload: () => Promise<void>;
};

const { mockUseSchedules, mockUseUsers, mockUseStaff, mockUseSP, mockEnsureOperationHubLists, mockUseEnsureOperationHubLists, mockGetNow } = vi.hoisted(() => {
  return {
    mockUseSchedules: vi.fn<() => StoreResult<Schedule[]>>(),
    mockUseUsers: vi.fn<() => StoreResult<User[]>>(),
    mockUseStaff: vi.fn<() => StoreResult<Staff[]>>(),
    mockUseSP: vi.fn(() => ({})),
    mockEnsureOperationHubLists: vi.fn(async () => {}),
    mockUseEnsureOperationHubLists: vi.fn(),
    mockGetNow: vi.fn<() => Date>(),
  };
});

vi.mock('@/stores/useSchedules', () => ({ useSchedules: mockUseSchedules }));
vi.mock('@/stores/useUsers', () => ({ useUsers: mockUseUsers }));
vi.mock('@/stores/useStaff', () => ({ useStaff: mockUseStaff }));
vi.mock('@/lib/spClient', () => ({ useSP: mockUseSP }));
vi.mock('@/features/operation-hub/ensureCoreLists', () => ({
  ensureOperationHubLists: mockEnsureOperationHubLists,
  useEnsureOperationHubLists: mockUseEnsureOperationHubLists,
}));
vi.mock('@/utils/getNow', () => ({ getNow: mockGetNow }));

const loadHook = async () => {
  const mod = await import('@/features/operation-hub/useOperationHubData');
  return mod.useOperationHubData;
};

const resolvedReload = () => vi.fn(async () => {});

const baseStaff = (overrides: Partial<Staff>): Staff => ({
  id: overrides.id ?? 1,
  staffId: overrides.staffId ?? String(overrides.id ?? 1),
  name: overrides.name ?? '職員A',
  certifications: overrides.certifications ?? [],
  workDays: overrides.workDays ?? [],
  baseWorkingDays: overrides.baseWorkingDays ?? [],
  employmentType: overrides.employmentType,
  role: overrides.role,
  active: overrides.active,
  ...overrides,
});

const baseSchedule = (overrides: Partial<Schedule>): Schedule => ({
  id: overrides.id ?? 1,
  etag: overrides.etag ?? null,
  title: overrides.title ?? '予定',
  startUtc: overrides.startUtc ?? '2025-03-09T00:00:00.000Z',
  endUtc: overrides.endUtc ?? '2025-03-09T01:00:00.000Z',
  startLocal: overrides.startLocal ?? '2025-03-09T09:00:00+09:00',
  endLocal: overrides.endLocal ?? '2025-03-09T10:00:00+09:00',
  startDate: overrides.startDate ?? '2025-03-09',
  endDate: overrides.endDate ?? '2025-03-09',
  allDay: overrides.allDay ?? false,
  location: overrides.location ?? null,
  staffId: overrides.staffId ?? null,
  userId: overrides.userId ?? null,
  status: overrides.status ?? 'draft',
  notes: overrides.notes ?? null,
  recurrenceRaw: overrides.recurrenceRaw ?? null,
  recurrence: overrides.recurrence,
  created: overrides.created,
  modified: overrides.modified,
  category: overrides.category ?? 'ショートステイ',
  serviceType: overrides.serviceType ?? null,
  personType: overrides.personType ?? null,
  personId: overrides.personId ?? null,
  personName: overrides.personName ?? null,
  staffIds: overrides.staffIds,
  staffNames: overrides.staffNames,
  dayPart: overrides.dayPart ?? null,
  billingFlags: overrides.billingFlags,
  targetUserIds: overrides.targetUserIds,
  targetUserNames: overrides.targetUserNames,
  relatedResourceIds: overrides.relatedResourceIds,
  relatedResourceNames: overrides.relatedResourceNames,
  rowKey: overrides.rowKey ?? null,
  dayKey: overrides.dayKey ?? null,
  monthKey: overrides.monthKey ?? null,
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  assignedStaffIds: overrides.assignedStaffIds,
  assignedStaffNames: overrides.assignedStaffNames,
  statusLabel: overrides.statusLabel,
});

const baseUser = (overrides: Partial<User>): User => ({
  id: overrides.id ?? 1,
  userId: overrides.userId ?? String(overrides.id ?? 1),
  name: overrides.name ?? '利用者A',
  toDays: overrides.toDays ?? [],
  fromDays: overrides.fromDays ?? [],
  attendanceDays: overrides.attendanceDays ?? [],
  certExpiry: overrides.certExpiry,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

describe('useOperationHubData branch coverage', () => {
  it('surfaces loading state, errors, and refresh logic', async () => {
    mockGetNow.mockReturnValue(new Date('2025-03-09T00:00:00.000Z'));
    const reloadSchedules = resolvedReload();
    const reloadUsers = resolvedReload();
    const reloadStaff = resolvedReload();

    mockUseSchedules.mockReturnValue({ data: undefined, loading: true, error: new Error('schedules boom'), reload: reloadSchedules });
    mockUseUsers.mockReturnValue({ data: undefined, loading: false, error: new Error('users boom'), reload: reloadUsers });
    mockUseStaff.mockReturnValue({ data: undefined, loading: false, error: undefined, reload: reloadStaff });

    const useOperationHubData = await loadHook();
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.loading).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(result.current.errors).toEqual({ schedules: 'schedules boom', users: 'users boom', staff: undefined });
    expect(mockUseEnsureOperationHubLists).toHaveBeenCalledWith(expect.any(Object));

    await act(async () => {
      await result.current.refresh();
    });
    expect(mockEnsureOperationHubLists).toHaveBeenCalledTimes(1);
    expect(reloadSchedules).toHaveBeenCalledTimes(1);
    expect(reloadUsers).toHaveBeenCalledTimes(1);
    expect(reloadStaff).toHaveBeenCalledTimes(1);
  });

  it('merges schedules across branches and annotates timeline conflicts', async () => {
    mockGetNow.mockReturnValue(new Date('2025-03-09T00:00:00.000Z'));

    const staffMembers: Staff[] = [
      baseStaff({ id: 1, staffId: '1', name: '佐藤 太郎', employmentType: '常勤職員', certifications: ['介護福祉士 更新要'], workDays: [], baseWorkingDays: [], role: '常勤', active: true }),
      baseStaff({ id: 2, staffId: '2', name: '山田 一郎', role: '非常勤スタッフ', certifications: [], workDays: [], baseWorkingDays: [], employmentType: 'アルバイト', active: true }),
      baseStaff({ id: 3, staffId: '3', name: '高橋 未来', certifications: [], workDays: [], baseWorkingDays: [], role: '', active: false }),
      baseStaff({ id: 4, staffId: '4', name: '派遣 サポーター', employmentType: '派遣', role: '派遣スタッフ', certifications: [], workDays: [], baseWorkingDays: [], active: true }),
    ];

    const schedules: Schedule[] = [
  baseSchedule({ id: 10, staffId: 1, status: 'submitted', startLocal: '2025-03-09T09:00:00+09:00', endLocal: '2025-03-09T13:00:00+09:00', startUtc: '2025-03-09T00:00:00.000Z', endUtc: '2025-03-09T04:00:00.000Z', title: '訪問A', notes: '要確認' }),
  baseSchedule({ id: 11, staffId: 1, status: 'draft', startLocal: '2025-03-09T12:00:00+09:00', endLocal: '2025-03-09T15:00:00+09:00', startUtc: '2025-03-09T03:00:00.000Z', endUtc: '2025-03-09T06:00:00.000Z', title: '訪問B' }),
      baseSchedule({ id: 12, staffId: null, staffNames: ['山田 一郎'], startLocal: '2025-03-09T13:00:00+09:00', endLocal: '2025-03-09T14:00:00+09:00', startUtc: '2025-03-09T04:00:00.000Z', endUtc: '2025-03-09T05:00:00.000Z', title: '送迎C', category: '送迎', notes: '送迎注意' }),
  baseSchedule({ id: 13, staffId: null, staffNames: [], startLocal: '2025-03-09T15:00:00+09:00', endLocal: '2025-03-09T17:00:00+09:00', startUtc: '2025-03-09T06:00:00.000Z', endUtc: '2025-03-09T08:00:00.000Z', title: '未割当D', category: 'イベント' }),
  baseSchedule({ id: 14, staffId: 2, startLocal: '2025-03-09T08:00:00+09:00', endLocal: '2025-03-09T08:30:00+09:00', startUtc: '2025-03-08T23:00:00.000Z', endUtc: '2025-03-08T23:30:00.000Z', title: '前日作業', notes: '終了済み' }),
  baseSchedule({ id: 15, staffId: 2, startLocal: '2025-03-09T09:10:00+09:00', endLocal: '2025-03-09T09:40:00+09:00', startUtc: '2025-03-09T00:10:00.000Z', endUtc: '2025-03-09T00:40:00.000Z', title: 'まもなく訪問', notes: null }),
  baseSchedule({ id: 16, staffId: 2, startLocal: '2025-03-09T12:00:00+09:00', endLocal: '2025-03-09T15:00:00+09:00', startUtc: '2025-03-09T03:00:00.000Z', endUtc: '2025-03-09T06:00:00.000Z', title: '午後訪問', notes: null }),
      baseSchedule({ id: 17, staffId: 4, startLocal: '2025-03-09T10:00:00+09:00', endLocal: '2025-03-09T11:00:00+09:00', startUtc: '2025-03-09T01:00:00.000Z', endUtc: '2025-03-09T02:00:00.000Z', title: '派遣支援', notes: '派遣対応' }),
    ];

    const users: User[] = [
      baseUser({ id: 20, userId: 'U-20', name: '田中 花子', certExpiry: '2025-03-14' }),
    ];

    const reloadSchedules = resolvedReload();
    const reloadUsers = resolvedReload();
    const reloadStaff = resolvedReload();

    mockUseSchedules.mockReturnValue({ data: schedules, loading: false, error: undefined, reload: reloadSchedules });
    mockUseUsers.mockReturnValue({ data: users, loading: false, error: undefined, reload: reloadUsers });
    mockUseStaff.mockReturnValue({ data: staffMembers, loading: false, error: undefined, reload: reloadStaff });

    const useOperationHubData = await loadHook();
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.ready).toBe(true);
    expect(result.current.unassignedSchedules.map((item) => item.id)).toContain(13);
    expect(result.current.kpis.find((kpi) => kpi.id === 'unassigned')?.tone).toBe('error');
  expect(result.current.kpis.find((kpi) => kpi.id === 'coverage')?.tone).toBe('error');

  const timeline = result.current.timeline;
    expect(timeline?.resources.some((resource) => resource.events.some((event) => event.conflict))).toBe(true);
    const unassignedResource = timeline?.resources.find((resource) => resource.id.startsWith('その他:'));
    expect(unassignedResource?.events).toHaveLength(1);
  const otherGroup = timeline?.resources.find((resource) => resource.id.startsWith('その他:4'));
  expect(otherGroup?.groupLabel).toBe('その他リソース');

    const tasks = result.current.mobileTasks;
  const statuses = tasks.map((task) => task.status).sort();
  expect(statuses).toEqual(['alert', 'completed', 'pending', 'pending']);
    expect(tasks.find((task) => task.status === 'alert')?.actions?.some((action) => action.label === '緊急連絡')).toBe(true);

    expect(result.current.alerts.some((alert) => alert.id.startsWith('cert-'))).toBe(true);
    expect(result.current.alerts.some((alert) => alert.id.startsWith('staff-cert'))).toBe(true);
  expect(result.current.staff).toHaveLength(4);
    expect(result.current.users).toHaveLength(1);
  });

  it('falls back to neutral alerts and empty timeline when no schedules', async () => {
    mockGetNow.mockReturnValue(new Date('2025-03-09T00:00:00.000Z'));

    const reloadSchedules = resolvedReload();
    const reloadUsers = resolvedReload();
    const reloadStaff = resolvedReload();

    mockUseSchedules.mockReturnValue({ data: [], loading: false, error: undefined, reload: reloadSchedules });
    mockUseUsers.mockReturnValue({ data: [], loading: false, error: undefined, reload: reloadUsers });
    mockUseStaff.mockReturnValue({
      data: [
        baseStaff({ id: 100, staffId: '100', name: '斎藤 直子', certifications: [], workDays: [], baseWorkingDays: [], role: '登録済み', active: true }),
      ],
      loading: false,
      error: undefined,
      reload: reloadStaff,
    });

    const useOperationHubData = await loadHook();
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.alerts).toEqual([
      {
        id: 'no-alerts',
        tone: 'info',
        message: '重大なアラートはありません。',
      },
    ]);
    expect(result.current.timeline).toBeNull();
    expect(result.current.mobileTasks).toHaveLength(0);
    expect(result.current.kpis.find((kpi) => kpi.id === 'coverage')?.tone).toBe('error');
  });

  it('uses default timeline bounds when no schedule times can be parsed', async () => {
    mockGetNow.mockReturnValue(new Date('2025-03-09T00:00:00.000Z'));

    const reloadSchedules = resolvedReload();
    const reloadUsers = resolvedReload();
    const reloadStaff = resolvedReload();

    mockUseSchedules.mockReturnValue({
      data: [
        baseSchedule({
          id: 50,
          staffId: null,
          startLocal: 'invalid',
          endLocal: 'invalid',
          startUtc: 'invalid',
          endUtc: 'invalid',
          startDate: '2025-03-09',
          endDate: '2025-03-09',
        }),
      ],
      loading: false,
      error: undefined,
      reload: reloadSchedules,
    });
    mockUseUsers.mockReturnValue({ data: [], loading: false, error: undefined, reload: reloadUsers });
    mockUseStaff.mockReturnValue({
      data: [baseStaff({ id: 200, staffId: '200', name: '解析 対象', role: 'その他', employmentType: 'その他', active: true })],
      loading: false,
      error: undefined,
      reload: reloadStaff,
    });

    const useOperationHubData = await loadHook();
    const { result } = renderHook(() => useOperationHubData());

    expect(result.current.timeline).not.toBeNull();
    const start = result.current.timeline!.start.getTime();
    const end = result.current.timeline!.end.getTime();
    expect(Math.round((end - start) / (60 * 60 * 1000))).toBe(9);
    expect(result.current.timeline!.resources).toHaveLength(0);
  });
});
