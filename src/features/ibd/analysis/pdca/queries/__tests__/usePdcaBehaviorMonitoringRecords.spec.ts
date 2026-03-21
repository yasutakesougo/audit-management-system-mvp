import { renderHook, waitFor } from '@testing-library/react';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseBehaviorMonitoringRepository = vi.fn();

vi.mock('../useBehaviorMonitoringRepository', () => ({
  useBehaviorMonitoringRepository: () => mockUseBehaviorMonitoringRepository(),
}));

import { usePdcaBehaviorMonitoringRecords } from '../usePdcaBehaviorMonitoringRecords';

function createBehaviorMonitoringRepository(
  overrides?: Partial<BehaviorMonitoringRepository>,
): BehaviorMonitoringRepository {
  return {
    findByPlanningSheetId: vi.fn(async () => []),
    ...overrides,
  };
}

describe('usePdcaBehaviorMonitoringRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBehaviorMonitoringRepository.mockReturnValue(
      createBehaviorMonitoringRepository(),
    );
  });

  it('repository から planningSheet 単位の行動モニタリングを取得する', async () => {
    const repository = createBehaviorMonitoringRepository({
      findByPlanningSheetId: vi.fn(async () => [
        {
          id: 'bm-1',
          userId: 'U-001',
          planningSheetId: 'sp-1',
          periodStart: '2026-03-01',
          periodEnd: '2026-03-10',
          supportEvaluations: [],
          environmentFindings: [],
          effectiveSupports: '',
          difficultiesObserved: '',
          newTriggers: [],
          medicalSafetyNotes: '',
          userFeedback: '',
          familyFeedback: '',
          recommendedChanges: [],
          summary: '',
          recordedBy: 'staff-1',
          recordedAt: '2026-03-10T09:00:00+09:00',
        },
      ]),
    });

    const { result } = renderHook(() =>
      usePdcaBehaviorMonitoringRecords({
        userCode: 'U-001',
        supervisionUserId: 1,
        planningSheetId: 'sp-1',
        repositories: {
          behaviorMonitoringRepository: repository,
        },
      }),
    );

    await waitFor(() => {
      expect(repository.findByPlanningSheetId).toHaveBeenCalledTimes(1);
    });

    expect(repository.findByPlanningSheetId).toHaveBeenCalledWith({
      planningSheetId: 'sp-1',
      userId: 'U-001',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].id).toBe('bm-1');
    expect(result.current.error).toBeNull();
  });

  it('repository エラー時は error を返し data を空配列にする', async () => {
    const repository = createBehaviorMonitoringRepository({
      findByPlanningSheetId: vi.fn(async () => {
        throw new Error('failed to fetch behavior monitoring');
      }),
    });

    const { result } = renderHook(() =>
      usePdcaBehaviorMonitoringRecords({
        userCode: 'U-001',
        supervisionUserId: 1,
        planningSheetId: 'sp-1',
        repositories: {
          behaviorMonitoringRepository: repository,
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toContain('failed to fetch');
    expect(result.current.data).toEqual([]);
  });

  it('planningSheetId 未解決時は明示的に空配列フォールバック', async () => {
    const repository = createBehaviorMonitoringRepository();

    const { result } = renderHook(() =>
      usePdcaBehaviorMonitoringRecords({
        userCode: 'U-001',
        supervisionUserId: 1,
        planningSheetId: null,
        repositories: {
          behaviorMonitoringRepository: repository,
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(repository.findByPlanningSheetId).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });
});
