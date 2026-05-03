import { describe, it, expect, vi } from 'vitest';
import { mapToSupportPlanningSheetViewModel, MapperInput } from '../supportPlanningSheetViewModelMapper';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { SupportPlanningSheetUiState } from '../useSupportPlanningSheetUiState';
import type { IUserMaster } from '@/features/users/types';
import type { UserAssessment } from '@/features/assessment/domain/types';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';

// Mock dependencies
vi.mock('@/app/services/bridgeProxy', () => ({
  getPlanningWorkflowPhaseForSheet: vi.fn(() => ({ phase: 'active_plan' })),
}));

describe('supportPlanningSheetViewModelMapper', () => {
  const mockSheet = {
    id: 'sheet-1',
    userId: 'user-1',
    title: 'テスト計画',
    status: 'active',
    supportStartDate: '2026-04-01',
    monitoringCycleDays: 90,
    planning: { procedureSteps: [{}, {}] },
    reviewedAt: '2026-04-05',
  } as unknown as SupportPlanningSheet;

  const mockUiState = {
    isEditing: false,
    activeTab: 'overview',
    toast: { open: false, message: '', severity: 'info' },
    importDialogOpen: false,
    monitoringDialogOpen: false,
    contextOpen: false,
    historyFilter: { type: 'all' },
    sessionProvenance: [{ field: 'goal', source: 'assessment_sensory', sourceLabel: 'Session Prov', reason: 'reason', value: 'value', importedAt: '2026-04-01' }],
  } as unknown as SupportPlanningSheetUiState;

  const baseInput: MapperInput = {
    planningSheetId: 'sheet-1',
    sheet: mockSheet,
    isLoading: false,
    error: null,
    uiState: mockUiState,
    monitoringBridge: null,
    targetUser: { FullName: '利用者 太郎' } as unknown as IUserMaster,
    currentAssessment: { id: 'as-1' } as unknown as UserAssessment,
    persistedProvenance: [{ field: 'goal', source: 'assessment_sensory', sourceLabel: 'Persisted Prov', reason: 'reason', value: 'value', importedAt: '2026-04-01' }],
    auditRecords: [],
    filteredAuditRecords: [],
    icebergEvidence: null,
    latestMonitoringRecord: null,
    evidenceLinks: {
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
    },
    abcRecords: [],
    pdcaItems: [],
    strategyUsage: null,
    strategyUsageLoading: false,
    trendResult: null,
    trendDays: 30,
    trendLoading: false,
    contextUserName: '利用者 太郎',
    contextData: {} as unknown as ContextPanelData,
    form: {} as unknown as UsePlanningSheetFormReturn,
    source: null,
    diffSummary: null,
    latestIcebergSnapshot: null,
  };

  it('ViewModel が正しくマッピングされること', () => {
    const vm = mapToSupportPlanningSheetViewModel(baseInput);

    expect(vm.planningSheetId).toBe('sheet-1');
    expect(vm.targetUserName).toBe('利用者 太郎');
    expect(vm.isEditing).toBe(false);
    expect(vm.activeTab).toBe('overview');
    expect(vm.currentPhase).toBe('active_plan');
  });

  it('Provenance が結合されること (永続化 + セッション分)', () => {
    const vm = mapToSupportPlanningSheetViewModel(baseInput);

    expect(vm.allProvenanceEntries.length).toBe(2);
    expect(vm.allProvenanceEntries[0].sourceLabel).toBe('Persisted Prov');
    expect(vm.allProvenanceEntries[1].sourceLabel).toBe('Session Prov');
  });

  it('アセスメントの有無が正しく判定されること', () => {
    const vmWithAssessment = mapToSupportPlanningSheetViewModel(baseInput);
    expect(vmWithAssessment.hasAssessment).toBe(true);

    const vmWithoutAssessment = mapToSupportPlanningSheetViewModel({
      ...baseInput,
      currentAssessment: null,
    });
    expect(vmWithoutAssessment.hasAssessment).toBe(false);
  });

  it('モニタリング記録の有無が正しく判定されること', () => {
    const vmWithMonitoring = mapToSupportPlanningSheetViewModel({
      ...baseInput,
      latestMonitoringRecord: { id: 'mon-1' } as unknown as BehaviorMonitoringRecord,
    });
    expect(vmWithMonitoring.hasMonitoringRecord).toBe(true);

    const vmWithoutMonitoring = mapToSupportPlanningSheetViewModel(baseInput);
    expect(vmWithoutMonitoring.hasMonitoringRecord).toBe(false);
  });

  it('氷山分析との差分がある場合、differenceInsight が算出されること', () => {
    const inputWithDiff: MapperInput = {
      ...baseInput,
      latestIcebergSnapshot: {
        sessionId: 'sess-new',
        nodes: [{ type: 'behavior', label: 'パニック', updatedAt: '2026-05-01T10:00:00Z' }],
        links: [],
        updatedAt: '2026-05-01T10:00:00Z',
      } as unknown as IcebergSnapshot,
      sheet: {
        ...mockSheet,
        assessment: {
          targetBehaviors: [{ name: '自傷' }], // 'パニック' が含まれていない
          hypotheses: [],
        },
      } as unknown as SupportPlanningSheet,
    };

    const vm = mapToSupportPlanningSheetViewModel(inputWithDiff);
    expect(vm.differenceInsight).toBeDefined();
    expect(vm.differenceInsight?.changes[0].value).toContain('パニック');
  });
});
