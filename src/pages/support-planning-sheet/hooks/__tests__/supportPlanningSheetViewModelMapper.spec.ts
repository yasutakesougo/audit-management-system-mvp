import { describe, it, expect, vi } from 'vitest';
import { mapToSupportPlanningSheetViewModel, MapperInput } from '../supportPlanningSheetViewModelMapper';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { SupportPlanningSheetUiState } from '../useSupportPlanningSheetUiState';
import type { IUserMaster } from '@/features/users/types';
import type { UserAssessment } from '@/features/assessment/domain/types';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';

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
    sessionProvenance: [{ id: 'prov-session', type: 'iceberg', label: 'Session Prov' }],
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
    persistedProvenance: [{ id: 'prov-1', type: 'iceberg', label: 'Persisted Prov' }],
    auditRecords: [],
    filteredAuditRecords: [],
    icebergEvidence: null,
    latestMonitoringRecord: null,
    evidenceLinks: {},
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
    expect(vm.allProvenanceEntries[0].id).toBe('prov-1');
    expect(vm.allProvenanceEntries[1].id).toBe('prov-session');
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
});
