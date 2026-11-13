import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getSaveStatusText } from '../../TransportAssignmentPage.logic';

const LEDGER_KEY = 'iceberg.transportAssignment.unresolvedSave.v1';

const harness = vi.hoisted(() => ({
  schedules: [] as Array<Record<string, string>>,
  saveBulk: vi.fn(),
  consumeRecoveryMerges: vi.fn(),
  refetchSchedules: vi.fn(),
  refetchAssignments: vi.fn(),
  releaseSave: undefined as (() => void) | undefined,
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '?date=2026-03-25' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn(),
}));

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
    items: harness.schedules,
    loading: false,
    update: vi.fn(),
    refetch: harness.refetchSchedules,
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
  useAssignmentRepository: () => harness,
}));

vi.mock('@/features/schedules/hooks/useAssignments', () => ({
  useAssignments: () => ({
    assignments: [],
    loading: false,
    refetch: harness.refetchAssignments,
  }),
}));

import { useTransportAssignmentPage } from '../useTransportAssignmentPage';

function scheduleRow(etag: string) {
  return {
    id: 'row-1',
    start: '2026-03-25T08:30:00+09:00',
    end: '2026-03-25T09:30:00+09:00',
    title: '送迎',
    serviceType: 'transport',
    userId: 'I005',
    vehicleId: '車両1',
    etag,
  };
}

function seedUnresolvedRecovery() {
  localStorage.setItem(LEDGER_KEY, JSON.stringify([{
    schemaVersion: 2,
    saveContractVersion: 1,
    requestId: 'req-synthetic',
    reconciliation: 'pending',
    targets: [{
      dateKey: '2026-03-25',
      direction: 'to',
      userId: 'I005',
      scheduleRowId: 'row-1',
      outcome: 'IN_FLIGHT',
      conflict: false,
      writeStarted: false,
      before: { vehicleId: '車両1', driverId: '', mark: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      intent: { vehicleId: '車両1', driverId: 'S001', mark: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    }],
  }]));
}

function installLock() {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, _options: unknown, callback: (lock: object | null) => Promise<unknown>) =>
        callback({ name: 'held' }),
    },
  });
}

function vehicle(result: { current: ReturnType<typeof useTransportAssignmentPage> }) {
  return result.current.currentDraft.vehicles.find((item) => item.vehicleId === '車両1');
}

function statusText(result: { current: ReturnType<typeof useTransportAssignmentPage> }) {
  return getSaveStatusText({
    saveStatus: result.current.saveStatus,
    dirty: result.current.dirty,
    lastSavedAt: result.current.lastSavedAt,
  });
}

describe('useTransportAssignmentPage recovery save', () => {
  beforeEach(() => {
    localStorage.clear();
    seedUnresolvedRecovery();
    installLock();
    harness.schedules = [scheduleRow('mock-etag-1')];
    harness.releaseSave = undefined;
    harness.saveBulk = vi.fn(() => new Promise<void>((resolve) => {
      harness.releaseSave = resolve;
    }));
    harness.consumeRecoveryMerges = vi.fn(() => [{
      scheduleRowId: 'row-1',
      beforeEtag: '"8,1"',
      afterEtag: '"9,1"',
    }]);
    harness.refetchSchedules = vi.fn(async () => {
      harness.schedules = [scheduleRow('mock-etag-2')];
    });
    harness.refetchAssignments = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  async function startRecoveryUntilWrite(result: { current: ReturnType<typeof useTransportAssignmentPage> }) {
    expect(result.current.canRecover).toBe(true);
    expect(vehicle(result)?.riderUserIds).toEqual(['I005']);
    const pending = result.current.onRecover();
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.saveBulk).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('saving');
    return { pending };
  }

  async function finishRecovery(pending: Promise<void>) {
    if (!harness.releaseSave) throw new Error('recovery write was not waiting');
    await act(async () => {
      harness.releaseSave?.();
      await pending;
    });
  }

  it('does not accept unassign while recovery saveBulk is in flight', async () => {
    const { result } = renderHook(() => useTransportAssignmentPage());
    const { pending } = await startRecoveryUntilWrite(result);

    act(() => {
      result.current.onRemoveUser('I005');
    });

    expect(vehicle(result)?.riderUserIds).toEqual(['I005']);
    expect(result.current.currentDraft.unassignedUserIds).not.toContain('I005');

    await finishRecovery(pending);
  });

  it('keeps a driver edit and the unsaved flag when recovery succeeds after the edit, including an etag advance', async () => {
    const { result, rerender } = renderHook(() => useTransportAssignmentPage());
    const { pending } = await startRecoveryUntilWrite(result);

    act(() => {
      result.current.onDriverChange('車両1', 'S002');
    });
    expect(vehicle(result)?.driverStaffId).toBe('S002');
    expect(result.current.dirty).toBe(true);

    await finishRecovery(pending);

    expect(result.current.saveStatus).toBe('success');
    expect(result.current.dirty).toBe(true);
    expect(vehicle(result)?.driverStaffId).toBe('S002');
    expect(statusText(result)).toBe('未保存の変更があります');
    expect(harness.refetchSchedules).not.toHaveBeenCalled();

    act(() => {
      harness.schedules = [scheduleRow('mock-etag-2')];
    });
    rerender();

    expect(vehicle(result)?.driverStaffId).toBe('S002');
    expect(result.current.dirty).toBe(true);
    expect(statusText(result)).toBe('未保存の変更があります');
  });

  it('completes an unchanged recovery as saved', async () => {
    const { result } = renderHook(() => useTransportAssignmentPage());
    const { pending } = await startRecoveryUntilWrite(result);

    await finishRecovery(pending);

    expect(harness.saveBulk).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('success');
    expect(result.current.dirty).toBe(false);
    expect(statusText(result)).toMatch(/^保存済み/);
    expect(harness.refetchSchedules).toHaveBeenCalledTimes(1);
  });
});
