import { renderHook, waitFor } from '@testing-library/react';
import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import type { PlanningSheetReassessment } from '@/domain/isp/planningSheetReassessment';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePlanningSheetReassessmentRepository = vi.fn();

vi.mock('../usePlanningSheetReassessmentRepository', () => ({
  usePlanningSheetReassessmentRepository: () =>
    mockUsePlanningSheetReassessmentRepository(),
}));

import { usePdcaPlanningSheetReassessments } from '../usePdcaPlanningSheetReassessments';

function createReassessmentRepository(
  overrides?: Partial<PlanningSheetReassessmentRepository>,
): PlanningSheetReassessmentRepository {
  return {
    findByPlanningSheetId: vi.fn(async () => []),
    ...overrides,
  };
}

function makeReassessment(
  overrides?: Partial<PlanningSheetReassessment>,
): PlanningSheetReassessment {
  return {
    id: 'reassess-1',
    planningSheetId: 'sp-1',
    reassessedAt: '2026-03-18',
    reassessedBy: 'staff-1',
    triggerType: 'monitoring',
    abcSummary: 'abc',
    hypothesisReview: 'hypothesis',
    procedureEffectiveness: 'effectiveness',
    environmentChange: 'none',
    planChangeDecision: 'major_revision',
    nextReassessmentAt: '2026-06-16',
    notes: '',
    ...overrides,
  };
}

describe('usePdcaPlanningSheetReassessments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlanningSheetReassessmentRepository.mockReturnValue(
      createReassessmentRepository(),
    );
  });

  it('repository から planningSheet 再評価を取得する', async () => {
    const repository = createReassessmentRepository({
      findByPlanningSheetId: vi.fn(async () => [makeReassessment()]),
    });

    const { result } = renderHook(() =>
      usePdcaPlanningSheetReassessments({
        planningSheetId: 'sp-1',
        repositories: {
          planningSheetReassessmentRepository: repository,
        },
      }),
    );

    await waitFor(() => {
      expect(repository.findByPlanningSheetId).toHaveBeenCalledTimes(1);
    });

    expect(repository.findByPlanningSheetId).toHaveBeenCalledWith({
      planningSheetId: 'sp-1',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].planChangeDecision).toBe('major_revision');
  });

  it('planningSheetId 未解決時は空配列フォールバック', async () => {
    const repository = createReassessmentRepository();

    const { result } = renderHook(() =>
      usePdcaPlanningSheetReassessments({
        planningSheetId: null,
        repositories: {
          planningSheetReassessmentRepository: repository,
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

  it('repository エラー時は error を返す', async () => {
    const repository = createReassessmentRepository({
      findByPlanningSheetId: vi.fn(async () => {
        throw new Error('failed to fetch reassessment');
      }),
    });

    const { result } = renderHook(() =>
      usePdcaPlanningSheetReassessments({
        planningSheetId: 'sp-1',
        repositories: {
          planningSheetReassessmentRepository: repository,
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toContain('failed to fetch reassessment');
    expect(result.current.data).toEqual([]);
  });
});
