import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImportHandlers } from '@/pages/support-planning-sheet/hooks/useImportHandlers';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { MonitoringToPlanningBridge } from '@/domain/isp/bridge';

describe('useImportHandlers', () => {
  const mockSetFieldValue = vi.fn();
  const mockSetToast = vi.fn();
  const mockSetSessionProvenance = vi.fn();
  const mockSaveAuditRecord = vi.fn();

  const mockForm = {
    values: {
      observationFacts: '既存の行動観察',
      collectedInformation: '',
      environmentalAdjustments: '',
      concreteApproaches: '',
    },
    setFieldValue: mockSetFieldValue,
    setIntake: vi.fn(),
  } as unknown as UsePlanningSheetFormReturn;

  const mockBridge: MonitoringToPlanningBridge = {
    planningSheetId: 'sheet-1',
    candidates: [
      {
        id: 'cand-1',
        type: 'observation',
        content: '新しい行動観察の提案',
        reason: '理由',
        confidence: 0.9,
        provenance: { sourceId: 'src-1', sourceType: 'monitoring', observedAt: '2026-04-01' },
        suggestedAction: 'refine',
      },
      {
        id: 'cand-2',
        type: 'strategy',
        content: '新しい関わり方の提案',
        reason: '理由',
        confidence: 0.8,
        provenance: { sourceId: 'src-2', sourceType: 'monitoring', observedAt: '2026-04-01' },
        suggestedAction: 'add',
      },
    ],
    reassessmentSignal: { isRequired: false, reason: '', priority: 'low', triggerPhase: 'plan' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleReflectCandidate reflects new content correctly', () => {
    const { result } = renderHook(() => useImportHandlers({
      form: mockForm,
      planningSheetId: 'sheet-1',
      currentAssessment: null,
      account: { name: 'テスト' },
      saveAuditRecord: mockSaveAuditRecord,
      setToast: mockSetToast,
      setSessionProvenance: mockSetSessionProvenance,
    }));

    act(() => {
      result.current.handleReflectCandidate(mockBridge, 'cand-1');
    });

    expect(mockSetFieldValue).toHaveBeenCalledWith('observationFacts', '既存の行動観察\n\n新しい行動観察の提案');
    expect(mockSetToast).toHaveBeenCalledWith(expect.objectContaining({ 
      severity: 'success',
      message: expect.stringContaining('提案を反映しました')
    }));
  });

  it('handleReflectCandidate reflects content to correct field based on type', () => {
    const { result } = renderHook(() => useImportHandlers({
      form: mockForm,
      planningSheetId: 'sheet-1',
      currentAssessment: null,
      account: { name: 'テスト' },
      saveAuditRecord: mockSaveAuditRecord,
      setToast: mockSetToast,
      setSessionProvenance: mockSetSessionProvenance,
    }));

    act(() => {
      result.current.handleReflectCandidate(mockBridge, 'cand-2');
    });

    expect(mockSetFieldValue).toHaveBeenCalledWith('concreteApproaches', '新しい関わり方の提案');
  });

  it('handleReflectCandidate prevents duplicate reflection using slice check', () => {
    const formWithExistingContent = {
      ...mockForm,
      values: {
        ...mockForm.values,
        observationFacts: '新しい行動観察の提案が含まれている既存のテキスト',
      },
    } as unknown as UsePlanningSheetFormReturn;

    const { result } = renderHook(() => useImportHandlers({
      form: formWithExistingContent,
      planningSheetId: 'sheet-1',
      currentAssessment: null,
      account: { name: 'テスト' },
      saveAuditRecord: mockSaveAuditRecord,
      setToast: mockSetToast,
      setSessionProvenance: mockSetSessionProvenance,
    }));

    act(() => {
      result.current.handleReflectCandidate(mockBridge, 'cand-1');
    });

    expect(mockSetFieldValue).not.toHaveBeenCalled();
    expect(mockSetToast).toHaveBeenCalledWith(expect.objectContaining({ 
      severity: 'info', 
      message: 'この内容は既に反映されています' 
    }));
  });
});
