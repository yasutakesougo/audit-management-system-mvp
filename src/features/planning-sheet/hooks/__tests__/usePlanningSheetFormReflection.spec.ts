import { renderHook, act } from '@testing-library/react';
import { usePlanningSheetForm } from '../usePlanningSheetForm';
import type { SupportPlanningSheet, PlanningAssessment } from '@/domain/isp/schema';
import { describe, it, expect, vi } from 'vitest';
import type { PlanningSheetRepository } from '@/domain/isp/port';

describe('usePlanningSheetForm Reflection Contract', () => {
  const existingBehavior = {
    name: '既存の行動',
    operationalDefinition: '',
    frequency: '',
    intensity: '',
    duration: '',
  };

  const mockSheet: SupportPlanningSheet = {
    id: 'sheet-1',
    userId: 'user-1',
    ispId: 'isp-1',
    title: 'テスト計画',
    status: 'draft',
    assessment: {
      targetBehaviors: [existingBehavior],
      abcEvents: [],
      hypotheses: [],
      riskLevel: 'low',
      healthFactors: [],
      teamConsensusNote: '',
    },
    intake: { 
      presentingProblem: '', 
      targetBehaviorsDraft: [], 
      behaviorItemsTotal: null, 
      incidentSummaryLast30d: '', 
      communicationModes: [], 
      sensoryTriggers: [], 
      medicalFlags: [], 
      consentScope: [], 
      consentDate: null 
    },
    planning: { 
      supportPriorities: [], 
      antecedentStrategies: [], 
      teachingStrategies: [], 
      consequenceStrategies: [], 
      procedureSteps: [], 
      crisisThresholds: null, 
      restraintPolicy: 'prohibited_except_emergency', 
      reviewCycleDays: 180 
    },
    monitoringCycleDays: 90,
    observationFacts: '行動観察',
    interpretationHypothesis: '分析・仮説',
    supportIssues: '支援課題',
    supportPolicy: '対応方針',
    concreteApproaches: '具体策',
    authoredByStaffId: 'staff-1',
    authoredByQualification: 'practical_training',
    applicableServiceType: 'other',
    applicableAddOnTypes: ['none'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  } as unknown as SupportPlanningSheet;

  const mockRepo = {
    update: vi.fn().mockResolvedValue({ ...mockSheet }),
  };

  it('反映アクションによって assessment が更新された場合、isDirty が true になること', () => {
    const { result } = renderHook(() => usePlanningSheetForm(mockSheet, mockRepo as unknown as PlanningSheetRepository));

    expect(result.current.isDirty).toBe(false);

    const updatedAssessment: PlanningAssessment = {
      ...mockSheet.assessment,
      targetBehaviors: [
        {
          ...existingBehavior,
          name: '反映後の行動',
        },
      ],
    };

    act(() => {
      result.current.setAssessment(updatedAssessment);
    });

    expect(result.current.assessment.targetBehaviors).toContainEqual({
      ...existingBehavior,
      name: '反映後の行動',
    });
    // 現状の実装では values のみが dirty 判定対象のため、ここが失敗するはず
    expect(result.current.isDirty).toBe(true);
  });

  it('反映アクション後の save() が、更新された assessment をリポジトリに送ること', async () => {
    const { result } = renderHook(() => usePlanningSheetForm(mockSheet, mockRepo as unknown as PlanningSheetRepository));

    const updatedAssessment: PlanningAssessment = {
      ...mockSheet.assessment,
      targetBehaviors: [
        {
          ...existingBehavior,
          name: '反映後の行動',
        },
      ],
    };

    act(() => {
      result.current.setAssessment(updatedAssessment);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockRepo.update).toHaveBeenCalledWith(
      'sheet-1',
      expect.objectContaining({
        assessment: expect.objectContaining({
          targetBehaviors: [
            expect.objectContaining({
              name: '反映後の行動',
            }),
          ],
        }),
      })
    );
  });
});
