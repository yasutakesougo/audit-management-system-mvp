import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSupportRecordSubmit } from '../useSupportRecordSubmit';
import type { ProcedureStep } from '@/features/daily/domain/ProcedureRepository';
import type { SupportProcedureRecord } from '@/domain/isp/schema';

// ── Mock Repositories & Stores ──────────────────────────────────────────────

const mockBehaviorRepoAdd = vi.fn();
const mockExecutionUpsert = vi.fn();
const mockProcedureCreate = vi.fn();
const mockPersistDailySubmission = vi.fn();
const mockAuditLogWarn = vi.fn();
const mockGetCurrentByUser = vi.fn();

vi.mock('@/features/regulatory/hooks/useProcedureRecordRepository', () => ({
  useProcedureRecordRepository: () => ({
    create: mockProcedureCreate,
  }),
}));

vi.mock('@/features/ibd/analysis/pdca/persistDailyPdca', () => ({
  makeIdempotencyKey: () => 'mock-idempotency-key',
  persistDailySubmission: (...args: unknown[]) => mockPersistDailySubmission(...args),
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    warn: (...args: unknown[]) => mockAuditLogWarn(...args),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/runtimeEnv', () => ({
  getEnv: (key: string) => {
    if (key === 'VITE_FIREBASE_ACTOR_ID') return 'staff-001';
    return 'mock-env';
  },
}));

vi.mock('@/features/planning-sheet/hooks/useIspRepository', () => ({
  useIspRepository: () => ({
    getCurrentByUser: mockGetCurrentByUser,
  }),
}));

vi.mock('@/features/ibd/core/ibdStore', () => ({
  getLatestSPS: (userId: number) => ({
    id: 'sps-001',
    userId,
    version: 'v1',
    createdAt: '2026-03-01T00:00:00Z',
    status: 'confirmed' as const,
    confirmedBy: null,
    confirmedAt: null,
    icebergModel: {
      observableBehaviors: [],
      underlyingFactors: [],
      environmentalAdjustments: [],
    },
    positiveConditions: [],
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: 'admin' }),
}));

// ── Test Cases ──────────────────────────────────────────────────────────────

describe('useSupportRecordSubmit - Layer 3 Persistence', () => {
  const defaultSchedule: ProcedureStep[] = [
    {
      id: 'step-1',
      time: '09:00',
      activity: '朝の会',
      instruction: '挨拶と検温',
      isKey: true,
      source: 'planning_sheet',
      planningSheetId: 'ps-001',
      sourceStepOrder: 1,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockBehaviorRepoAdd.mockReset();
    mockExecutionUpsert.mockReset();
    mockProcedureCreate.mockReset();
    mockPersistDailySubmission.mockReset();
    mockAuditLogWarn.mockReset();
    mockGetCurrentByUser.mockReset();

    // Default successes
    mockBehaviorRepoAdd.mockImplementation(async (payload) => ({
      id: 'abc-001',
      userId: 'U001',
      ...payload,
    }));
    mockExecutionUpsert.mockResolvedValue(undefined);
    mockProcedureCreate.mockResolvedValue({} as SupportProcedureRecord);
    mockPersistDailySubmission.mockResolvedValue(undefined);
    mockGetCurrentByUser.mockResolvedValue({ id: 'isp-001' });
  });

  it('successfully persists SupportProcedureRecord (Layer 3) when step is convertible', async () => {
    const { result } = renderHook(() =>
      useSupportRecordSubmit({
        behaviorRepo: { add: mockBehaviorRepoAdd } as any,
        executionStore: { upsertRecord: mockExecutionUpsert } as any,
        targetUserId: 'U001',
        targetDate: '2026-05-28',
        totalSteps: 1,
        unfilledStepsCount: 1,
        schedule: defaultSchedule,
      })
    );

    await act(async () => {
      await result.current.handleRecordSubmit({
        recordedAt: '2026-05-28T10:00:00.000Z',
        behavior: '日常記録',
        actualObservation: '元気に登校した',
        staffResponse: '挨拶を交わした',
        followUpNote: '',
        planSlotKey: '09:00|朝の会',
        antecedent: '',
        antecedentTags: [],
        consequence: '',
        intensity: 1,
      });
    });

    // Behavior and Execution must be saved
    expect(mockBehaviorRepoAdd).toHaveBeenCalled();
    expect(mockExecutionUpsert).toHaveBeenCalled();

    // Layer 3 create must be called with converted payload
    expect(mockProcedureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'U001',
        planningSheetId: 'ps-001',
        ispId: 'isp-001',
        recordDate: '2026-05-28',
        timeSlot: '09:00',
        activity: '朝の会',
        procedureText: '挨拶と検温',
        executionStatus: 'done',
        userResponse: '元気に登校した',
        specialNotes: '挨拶を交わした',
        handoffNotes: '',
        performedBy: 'staff-001',
        performedAt: '2026-05-28T10:00:00.000Z',
        sourceStepOrder: 1,
      })
    );

    // No warning log should be recorded
    expect(mockAuditLogWarn).not.toHaveBeenCalled();
  });

  it('keeps submission flow completely successful even if Layer 3 persistence throws an error', async () => {
    // Simulate Layer 3 persistence error
    const testError = new Error('SharePoint save failed');
    mockProcedureCreate.mockRejectedValue(testError);

    const { result } = renderHook(() =>
      useSupportRecordSubmit({
        behaviorRepo: { add: mockBehaviorRepoAdd } as any,
        executionStore: { upsertRecord: mockExecutionUpsert } as any,
        targetUserId: 'U001',
        targetDate: '2026-05-28',
        totalSteps: 1,
        unfilledStepsCount: 1,
        schedule: defaultSchedule,
      })
    );

    await act(async () => {
      await result.current.handleRecordSubmit({
        recordedAt: '2026-05-28T10:00:00.000Z',
        behavior: '日常記録',
        actualObservation: '元気に登校した',
        staffResponse: '挨拶を交わした',
        followUpNote: '',
        planSlotKey: '09:00|朝の会',
        antecedent: '',
        antecedentTags: [],
        consequence: '',
        intensity: 1,
      });
    });

    // Main flows must still succeed
    expect(mockBehaviorRepoAdd).toHaveBeenCalled();
    expect(mockExecutionUpsert).toHaveBeenCalled();
    expect(mockProcedureCreate).toHaveBeenCalled();

    // Error must be logged as a warning, and NOT crash/throw
    expect(mockAuditLogWarn).toHaveBeenCalledWith(
      'daily/support',
      'Failed to persist Layer 3 SupportProcedureRecord',
      testError,
      'U001',
      '09:00|朝の会'
    );
  });

  it('bypasses Layer 3 persistence when step is not convertible', async () => {
    // Set up schedule with a base_step (not from planning_sheet)
    const baseSchedule: ProcedureStep[] = [
      {
        id: 'step-1',
        time: '09:00',
        activity: '朝の会',
        instruction: '挨拶',
        isKey: true,
        source: 'base_steps',
      },
    ];

    const { result } = renderHook(() =>
      useSupportRecordSubmit({
        behaviorRepo: { add: mockBehaviorRepoAdd } as any,
        executionStore: { upsertRecord: mockExecutionUpsert } as any,
        targetUserId: 'U001',
        targetDate: '2026-05-28',
        totalSteps: 1,
        unfilledStepsCount: 1,
        schedule: baseSchedule,
      })
    );

    await act(async () => {
      await result.current.handleRecordSubmit({
        recordedAt: '2026-05-28T10:00:00.000Z',
        behavior: '日常記録',
        actualObservation: '元気に登校した',
        staffResponse: '挨拶を交わした',
        followUpNote: '',
        planSlotKey: '09:00|朝の会',
        antecedent: '',
        antecedentTags: [],
        consequence: '',
        intensity: 1,
      });
    });

    expect(mockBehaviorRepoAdd).toHaveBeenCalled();
    expect(mockExecutionUpsert).toHaveBeenCalled();

    // Layer 3 create must NOT be called since step is not convertible
    expect(mockProcedureCreate).not.toHaveBeenCalled();
    expect(mockAuditLogWarn).not.toHaveBeenCalled();
  });

  it('keeps submission flow completely successful when current ISP is not found (L3 created without ispId)', async () => {
    // Current ISP is not found (null)
    mockGetCurrentByUser.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useSupportRecordSubmit({
        behaviorRepo: { add: mockBehaviorRepoAdd } as any,
        executionStore: { upsertRecord: mockExecutionUpsert } as any,
        targetUserId: 'U001',
        targetDate: '2026-05-28',
        totalSteps: 1,
        unfilledStepsCount: 1,
        schedule: defaultSchedule,
      })
    );

    await act(async () => {
      await result.current.handleRecordSubmit({
        recordedAt: '2026-05-28T10:00:00.000Z',
        behavior: '日常記録',
        actualObservation: '元気に登校した',
        staffResponse: '挨拶を交わした',
        followUpNote: '',
        planSlotKey: '09:00|朝の会',
        antecedent: '',
        antecedentTags: [],
        consequence: '',
        intensity: 1,
      });
    });

    expect(mockBehaviorRepoAdd).toHaveBeenCalled();
    expect(mockExecutionUpsert).toHaveBeenCalled();

    // Layer 3 create must be called but ispId should be undefined
    expect(mockProcedureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'U001',
        planningSheetId: 'ps-001',
        ispId: undefined, // no ispId
        recordDate: '2026-05-28',
        timeSlot: '09:00',
        activity: '朝の会',
        procedureText: '挨拶と検温',
        executionStatus: 'done',
      })
    );
    expect(mockAuditLogWarn).not.toHaveBeenCalled();
  });

  it('keeps submission flow completely successful when ISP resolution throws an error (L3 created without ispId)', async () => {
    // Current ISP throws an error
    const testError = new Error('ISP fetch failed');
    mockGetCurrentByUser.mockRejectedValue(testError);

    const { result } = renderHook(() =>
      useSupportRecordSubmit({
        behaviorRepo: { add: mockBehaviorRepoAdd } as any,
        executionStore: { upsertRecord: mockExecutionUpsert } as any,
        targetUserId: 'U001',
        targetDate: '2026-05-28',
        totalSteps: 1,
        unfilledStepsCount: 1,
        schedule: defaultSchedule,
      })
    );

    await act(async () => {
      await result.current.handleRecordSubmit({
        recordedAt: '2026-05-28T10:00:00.000Z',
        behavior: '日常記録',
        actualObservation: '元気に登校した',
        staffResponse: '挨拶を交わした',
        followUpNote: '',
        planSlotKey: '09:00|朝の会',
        antecedent: '',
        antecedentTags: [],
        consequence: '',
        intensity: 1,
      });
    });

    expect(mockBehaviorRepoAdd).toHaveBeenCalled();
    expect(mockExecutionUpsert).toHaveBeenCalled();

    // Layer 3 create must be called but ispId should be undefined
    expect(mockProcedureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'U001',
        planningSheetId: 'ps-001',
        ispId: undefined,
        recordDate: '2026-05-28',
        timeSlot: '09:00',
        activity: '朝の会',
        procedureText: '挨拶と検温',
        executionStatus: 'done',
      })
    );

    // Warning log must be recorded specifically for ISP resolution failure
    expect(mockAuditLogWarn).toHaveBeenCalledWith(
      'daily/support',
      'Failed to resolve current ISP ID for Layer 3 persistence',
      testError,
      'U001',
      '09:00|朝の会'
    );
  });
});
