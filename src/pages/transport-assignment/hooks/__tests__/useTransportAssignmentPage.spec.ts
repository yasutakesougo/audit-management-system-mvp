import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const assignmentSaveHarness = vi.hoisted(() => ({
  recoverAssignments: vi.fn().mockResolvedValue({ success: true }),
  unresolvedSaves: [] as unknown[],
  ledgerState: { kind: 'empty' } as unknown,
}));

// Mock routing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '?date=2026-03-25' }),
  useNavigate: () => mockNavigate,
}));

// Mock telemetry
vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn(),
}));

// Stable mock data references to prevent state resets caused by inline array recreation
const MOCK_SCHEDULES = [
  {
    id: 'row-1',
    start: '2026-03-25T08:30:00+09:00',
    end: '2026-03-25T09:30:00+09:00',
    title: '送迎',
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
    ToCourse: 'A',
  },
];

const MOCK_STAFF = [
  { id: 1, staffId: 'S001', name: 'スタッフ 太郎' },
  { id: 2, staffId: 'S002', name: 'スタッフ 次郎' },
];

// Mock feature hooks
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

vi.mock('@/features/transport-assignments/hooks/useTransportAssignmentSave', () => ({
  useTransportAssignmentSave: () => ({
    status: 'idle',
    error: null,
    clearError: vi.fn(),
    lastSavedAt: null,
  }),
}));

vi.mock('@/features/transport-assignments/hooks/useAssignmentSave', () => ({
  useAssignmentSave: () => ({
    status: 'idle',
    error: null,
    saveAssignments: vi.fn().mockResolvedValue({ success: true }),
    saveBulkAssignments: vi.fn().mockResolvedValue({ success: true }),
    recoverAssignments: assignmentSaveHarness.recoverAssignments,
    clearError: vi.fn(),
    resetSaveFeedback: vi.fn(),
    unresolvedSaves: assignmentSaveHarness.unresolvedSaves,
    ledgerState: assignmentSaveHarness.ledgerState,
    reconcileUnresolved: vi.fn(),
  }),
}));

vi.mock('@/features/schedules/assignmentRepositoryFactory', () => ({
  useAssignmentRepository: () => ({}),
}));

vi.mock('@/features/schedules/hooks/useAssignments', () => ({
  useAssignments: () => ({
    assignments: [],
    loading: false,
    refetch: vi.fn(),
  }),
}));

import { useTransportAssignmentPage } from '../useTransportAssignmentPage';

function unresolvedLedgerFor(userId: string) {
  const record = {
    schemaVersion: 2,
    saveContractVersion: 1,
    requestId: 'req-synthetic',
    reconciliation: 'pending',
    targets: [{
      dateKey: '2026-03-25',
      direction: 'to',
      userId,
      scheduleRowId: 'row-1',
      outcome: 'IN_FLIGHT',
      conflict: false,
      writeStarted: false,
    }],
  };
  return {
    kind: 'records' as const,
    scopeClosed: false,
    records: [record],
  };
}

describe('useTransportAssignmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assignmentSaveHarness.unresolvedSaves = [];
    assignmentSaveHarness.ledgerState = { kind: 'empty' };
    MOCK_SCHEDULES.splice(1);
  });

  it('初期状態が正しくロードされること', () => {
    const { result } = renderHook(() => useTransportAssignmentPage());

    expect(result.current.targetDate).toBe('2026-03-25');
    expect(result.current.direction).toBe('to');
    expect(result.current.dirty).toBe(false);
    expect(result.current.allowConcurrencyBypass).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('方向を変更できること', () => {
    const { result } = renderHook(() => useTransportAssignmentPage());

    act(() => {
      result.current.setDirection('from');
    });

    expect(result.current.direction).toBe('from');
  });

  it('運転手を変更すると、dirtyフラグが立ち、ドラフトが更新されること', () => {
    const { result } = renderHook(() => useTransportAssignmentPage());

    act(() => {
      result.current.onDriverChange('車両1', 'S001');
    });

    expect(result.current.dirty).toBe(true);
    const vehicle1 = result.current.currentDraft.vehicles.find(v => v.vehicleId === '車両1');
    expect(vehicle1?.driverName).toBe('スタッフ 太郎');
  });

  it('日付移動アクションが正常に機能すること', () => {
    const { result } = renderHook(() => useTransportAssignmentPage());

    act(() => {
      result.current.onChangeWeek(7);
    });

    // 2026-03-25 + 7 days = 2026-04-01
    expect(result.current.targetDate).toBe('2026-04-01');
  });

  it('定員内の未解決保存ではRecoveryを出せる', () => {
    const ledger = unresolvedLedgerFor('I005');
    assignmentSaveHarness.ledgerState = ledger;
    assignmentSaveHarness.unresolvedSaves = ledger.records;
    const { result } = renderHook(() => useTransportAssignmentPage());

    const vehicle1 = result.current.currentDraft.vehicles.find((vehicle) => vehicle.vehicleId === '車両1');
    expect(vehicle1?.riderUserIds).toEqual(['I005']);
    expect(result.current.recoveryEligibility).toBe('available');
    expect(result.current.canRecover).toBe(true);
  });

  it('定員超過のときRecoveryを出さず、やり直しを呼ばない', async () => {
    const ledger = unresolvedLedgerFor('I005');
    assignmentSaveHarness.ledgerState = ledger;
    assignmentSaveHarness.unresolvedSaves = ledger.records;
    for (let index = 2; index <= 7; index += 1) {
      MOCK_SCHEDULES.push({
        id: `row-extra-${index}`,
        start: '2026-03-25T08:30:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
        title: '送迎',
        userId: `rider-${index}`,
        vehicleId: '車両1',
        etag: `mock-etag-extra-${index}`,
      });
    }
    const { result } = renderHook(() => useTransportAssignmentPage());

    const vehicle1 = result.current.currentDraft.vehicles.find((vehicle) => vehicle.vehicleId === '車両1');
    expect(vehicle1?.riderUserIds).toHaveLength(7);
    expect(result.current.coordinationInsights).toContainEqual(expect.objectContaining({
      type: 'capacity',
      severity: 'error',
    }));
    expect(result.current.recoveryEligibility).toBe('available');
    expect(result.current.canRecover).toBe(false);

    await act(async () => {
      await result.current.onRecover();
    });
    expect(assignmentSaveHarness.recoverAssignments).not.toHaveBeenCalled();
  });
});
