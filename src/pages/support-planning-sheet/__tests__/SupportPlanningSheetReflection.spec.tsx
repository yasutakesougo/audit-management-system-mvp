import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SupportPlanningSheetView } from '../SupportPlanningSheetView';
import { MemoryRouter } from 'react-router-dom';
import { SupportPlanningSheetViewModel, SupportPlanningSheetActionHandlers } from '../types';

vi.mock('@/features/planning-sheet/hooks/orchestrators/usePlanningSheetOrchestrator', () => ({
  usePlanningSheetOrchestrator: () => ({
    handleApplyPatch: vi.fn(),
    handleUpdatePatchStatus: vi.fn(),
  }),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => ({}),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanPatchRepository', () => ({
  usePlanPatchRepository: () => ({
    findPending: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../hooks/supportPlanningSheetViewModelMapper', () => ({
  mapToSupportPlanningSheetViewModel: vi.fn(),
}));

const mockHandlers: SupportPlanningSheetActionHandlers = {
  onBack: vi.fn(),
  onEdit: vi.fn(),
  onReset: vi.fn(),
  onSave: vi.fn(),
  onImportAssessment: vi.fn(),
  onImportMonitoring: vi.fn(),
  onCloseImportDialog: vi.fn(),
  onCloseMonitoringDialog: vi.fn(),
  onPerformAssessmentImport: vi.fn(),
  onPerformMonitoringImport: vi.fn(),
  onCloseToast: vi.fn(),
  onTabChange: vi.fn(),
  onBannerNavigate: vi.fn(),
  onJumpToMonitoringHistory: vi.fn(),
  onJumpToPlanningTab: vi.fn(),
  onTrendDaysChange: vi.fn(),
  onHistoryFilterChange: vi.fn(),
  onToggleContext: vi.fn(),
  onCloseContext: vi.fn(),
  onEvidenceLinksChange: vi.fn(),
  onEvidenceClick: vi.fn(),
  onReflectCandidate: vi.fn(),
  onNavigateToExecution: vi.fn(),
  onNavigateToPdca: vi.fn(),
  onOpenReflectPreview: vi.fn(),
  onCloseReflectPreview: vi.fn(),
  onConfirmReflect: vi.fn(),
};

const mockViewModel: SupportPlanningSheetViewModel = {
  planningSheetId: 'test-id',
  sheet: {
    id: 'test-id',
    userId: 'user-1',
    title: 'テスト太郎',
    status: 'active',
    assessment: {
      behaviorSummary: '既存の行動',
      factorAnalysis: '既存の要因',
    },
    planning: { procedureSteps: [] },
    monitoringCycleDays: 90,
    supportStartDate: '2024-01-01',
    reviewedAt: '2024-01-01',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  } as any,
  isLoading: false,
  error: null,
  isEditing: false,
  activeTab: 'overview',
  toast: { open: false, message: '', severity: 'success' },
  importDialogOpen: false,
  monitoringDialogOpen: false,
  contextOpen: false,
  historyFilter: 'all',
  currentPhase: null,
  hasAssessment: true,
  currentAssessment: null,
  hasMonitoringRecord: false,
  icebergEvidence: null,
  allProvenanceEntries: [],
  auditRecords: [],
  filteredAuditRecords: [],
  latestMonitoringRecord: null,
  evidenceLinks: {},
  abcRecords: [],
  pdcaItems: [],
  strategyUsage: null,
  strategyUsageLoading: false,
  trendResult: null,
  trendDays: 30,
  trendLoading: false,
  contextUserName: 'テスト太郎',
  contextData: { 
    personalHistory: [], 
    traits: [], 
    supportPolicies: [], 
    alerts: [],
    summary: 'テストサマリー',
    prompts: [],
    supportPlan: { status: 'none', goals: [] },
    handoffs: [],
    recentRecords: [],
  } as any,
  form: { 
    values: {}, 
    setValues: vi.fn(),
    isDirty: false,
    isSaving: false,
    isValid: true,
    validationErrors: [],
  } as any,
  monitoringBridge: null,
  source: null,
  diffSummary: null,
  reflectPreviewOpen: false,
};

describe('SupportPlanningSheetReflection UI Interaction', () => {
  it('反映内容を確認ボタンをクリックすると onOpenReflectPreview が呼ばれること', () => {
    const vmWithDiff = {
      ...mockViewModel,
      differenceInsight: {
        changes: [{ label: '行動', value: '新しい行動', level: 'high' }]
      }
    };
    
    render(
      <MemoryRouter>
        <SupportPlanningSheetView viewModel={vmWithDiff as any} handlers={mockHandlers} />
      </MemoryRouter>
    );
    
    const reflectBtn = screen.getByText('反映内容を確認');
    fireEvent.click(reflectBtn);
    
    expect(mockHandlers.onOpenReflectPreview).toHaveBeenCalled();
  });

  it('reflectPreviewOpen が true の場合、プレビューダイアログが表示されること', () => {
    const vmWithPreview = {
      ...mockViewModel,
      reflectPreviewOpen: true,
      reflectPreview: {
        changes: [
          { label: '行動', before: '既存の行動', after: '新しい行動' }
        ]
      }
    };
    
    render(
      <MemoryRouter>
        <SupportPlanningSheetView viewModel={vmWithPreview as any} handlers={mockHandlers} />
      </MemoryRouter>
    );
    
    expect(screen.getByText('支援計画への反映プレビュー')).toBeInTheDocument();
    expect(screen.getByText('既存の行動')).toBeInTheDocument();
    expect(screen.getByText('新しい行動')).toBeInTheDocument();
  });

  it('ダイアログの「反映する」をクリックすると onConfirmReflect が呼ばれること', () => {
    const vmWithPreview = {
      ...mockViewModel,
      reflectPreviewOpen: true,
      reflectPreview: {
        changes: [{ label: '行動', before: '既存', after: '新規' }]
      }
    };
    
    render(
      <MemoryRouter>
        <SupportPlanningSheetView viewModel={vmWithPreview as any} handlers={mockHandlers} />
      </MemoryRouter>
    );
    
    const confirmBtn = screen.getByText('反映する');
    fireEvent.click(confirmBtn);
    
    expect(mockHandlers.onConfirmReflect).toHaveBeenCalled();
  });
});
