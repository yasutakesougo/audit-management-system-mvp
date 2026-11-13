import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isTransportAssignmentEditorBusy } from '@/features/schedules';

const repositoryBox = vi.hoisted(() => ({
  previewTransportSave: vi.fn(),
  saveBulk: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '?date=2026-03-25' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn(),
}));

const MOCK_SCHEDULES = [
  {
    id: 'row-1',
    start: '2026-03-25T08:30:00+09:00',
    end: '2026-03-25T09:30:00+09:00',
    title: '送迎',
    serviceType: 'transport',
    userId: 'I005',
    vehicleId: '車両1',
    etag: 'mock-etag-1',
  },
];

const MOCK_USERS = [
  {
    UserID: 'I005',
    FullName: '利用者 五郎',
    Status: 'active',
    TransportCourse: 'A',
  },
];

const MOCK_STAFF = [
  { id: 1, staffId: 'S001', name: 'スタッフ 太郎' },
  { id: 2, staffId: 'S002', name: 'スタッフ 次郎' },
];

vi.mock('@/features/schedules/hooks/legacy/useSchedules', () => ({
  useSchedules: () => ({
    items: MOCK_SCHEDULES,
    loading: false,
    update: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: () => ({
    data: MOCK_USERS,
    status: 'success',
  }),
}));

vi.mock('@/features/staff/store', () => ({
  useStaffStore: () => ({
    data: MOCK_STAFF,
    loading: false,
  }),
}));

vi.mock('@/features/schedules/assignmentRepositoryFactory', () => ({
  useAssignmentRepository: () => repositoryBox,
}));

vi.mock('@/features/schedules/hooks/useAssignments', () => ({
  useAssignments: () => ({
    assignments: [],
    loading: false,
    refetch: vi.fn(),
  }),
}));

import { useTransportAssignmentPage } from '../useTransportAssignmentPage';

const planned = [{
  dateKey: '2026-03-25',
  direction: 'to' as const,
  userId: 'I005',
  scheduleRowId: 'row-1',
  before: { vehicleId: '車両1', driverId: '', notes: '' },
  intent: { vehicleId: '車両1', driverId: 'S001', notes: '' },
}];

function driverId(result: { current: ReturnType<typeof useTransportAssignmentPage> }): string | null | undefined {
  return result.current.currentDraft.vehicles.find((vehicle) => vehicle.vehicleId === '車両1')?.driverStaffId;
}

describe('useTransportAssignmentPage save preview', () => {
  beforeEach(() => {
    localStorage.clear();
    repositoryBox.saveBulk = vi.fn().mockResolvedValue(undefined);
    repositoryBox.previewTransportSave = vi.fn();
  });

  it('keeps a driver edit made while the save preview is still running', async () => {
    let releasePreview: ((value: unknown) => void) | undefined;
    repositoryBox.previewTransportSave.mockImplementation(() => new Promise((resolve) => {
      releasePreview = resolve;
    }));
    const { result } = renderHook(() => useTransportAssignmentPage());

    act(() => {
      result.current.onDriverChange('車両1', 'S001');
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.canSave).toBe(true);
    expect(driverId(result)).toBe('S001');

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.onSave();
    });
    await vi.waitFor(() => {
      expect(repositoryBox.previewTransportSave).toHaveBeenCalledTimes(1);
    });
    expect(result.current.saveStatus).toBe('saving');
    expect(isTransportAssignmentEditorBusy(result.current.saveStatus)).toBe(true);
    expect(repositoryBox.saveBulk).not.toHaveBeenCalled();

    act(() => {
      result.current.onDriverChange('車両1', 'S002');
    });
    expect(driverId(result)).toBe('S002');

    await act(async () => {
      releasePreview?.(planned);
      await pending;
    });

    expect(driverId(result)).toBe('S002');
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe('idle');
    expect(repositoryBox.saveBulk).not.toHaveBeenCalled();

    repositoryBox.previewTransportSave.mockResolvedValue(planned);
    await act(async () => {
      await result.current.onSave();
    });

    expect(repositoryBox.saveBulk).toHaveBeenCalledTimes(1);
    const written = repositoryBox.saveBulk.mock.calls[0]?.[0] as Array<{ driverId?: string }>;
    expect(written.some((item) => item.driverId === 'S002')).toBe(true);
    expect(result.current.dirty).toBe(false);
    expect(driverId(result)).toBe('S002');
    expect(result.current.saveStatus).toBe('success');
  });
});
