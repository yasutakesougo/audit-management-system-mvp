import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSupportPlanningSheetOrchestrator } from '../useSupportPlanningSheetOrchestrator';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock React Router
const mockNavigate = vi.fn();
const mockParams = { planningSheetId: 'sheet-1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock UI State
const mockUiActions = {
  setToast: vi.fn(),
  setIsEditing: vi.fn(),
  setImportDialogOpen: vi.fn(),
  setMonitoringDialogOpen: vi.fn(),
  setActiveTab: vi.fn(),
  setContextOpen: vi.fn(),
  setHistoryFilter: vi.fn(),
  setSessionProvenance: vi.fn(),
};

vi.mock('../useSupportPlanningSheetUiState', () => ({
  useSupportPlanningSheetUiState: () => ({
    state: {
      isEditing: false,
      activeTab: 'overview',
      toast: { open: false, message: '', severity: 'info' },
      importDialogOpen: false,
      monitoringDialogOpen: false,
      contextOpen: false,
      historyFilter: { type: 'all' },
      sessionProvenance: [],
    },
    actions: mockUiActions,
  }),
}));

// Mock Domain Hooks
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetData', () => ({
  usePlanningSheetData: vi.fn((id) => {
    if (id === 'new') return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    return { data: { id: 'sheet-1', userId: 'user-1', status: 'active' }, isLoading: false, error: null, refetch: vi.fn() };
  }),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetForm', () => ({
  usePlanningSheetForm: vi.fn(() => ({})),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: vi.fn(() => ({})),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: vi.fn(() => ({ data: [{ UserID: 'user-1', FullName: 'Test User' }] })),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ account: { name: 'Admin' } })),
}));

vi.mock('@/features/planning-sheet/stores/importAuditStore', () => ({
  useImportAuditStore: vi.fn(() => ({
    saveAuditRecord: vi.fn(),
    getAllProvenance: vi.fn(() => []),
    getBySheetId: vi.fn(() => []),
  })),
}));

vi.mock('../useImportHandlers', () => ({
  useImportHandlers: vi.fn(() => ({
    handleAssessmentImport: vi.fn(),
    handleMonitoringImport: vi.fn(),
    handleReflectCandidate: vi.fn(),
  })),
}));

vi.mock('../useSupportPlanningPageHandlers', () => ({
  useSupportPlanningPageHandlers: vi.fn(() => ({
    handleSave: vi.fn(),
    handleReset: vi.fn(),
    handleBannerNavigate: vi.fn(),
    handleJumpToMonitoringHistory: vi.fn(),
    handleEvidenceClick: vi.fn(),
    handleNavigateToExecution: vi.fn(),
    handleNavigateToPdca: vi.fn(),
  })),
}));

vi.mock('../usePlanningEvidenceState', () => ({
  usePlanningEvidenceState: vi.fn(() => ({ evidenceLinks: {}, abcRecords: [], pdcaItems: [] })),
}));

vi.mock('../useSupportPlanningContextPanel', () => ({
  useSupportPlanningContextPanel: vi.fn(() => ({ contextData: {}, contextUserName: 'Test User' })),
}));

// More mocks for the remaining hooks...
vi.mock('@/features/handoff/hooks/useHandoffData', () => ({ useHandoffData: () => ({ repo: {} }) }));
vi.mock('@/features/ibd/analysis/pdca/queries/useIcebergEvidence', () => ({ useIcebergEvidence: () => ({ data: null }) }));
vi.mock('@/features/planning-sheet/hooks/useStrategyUsageCounts', () => ({ useStrategyUsageCounts: () => ({ summary: null, loading: false }) }));
vi.mock('@/features/planning-sheet/hooks/useStrategyUsageTrend', () => ({ useStrategyUsageTrend: () => ({ result: null, days: 30, setDays: vi.fn(), loading: false }) }));
vi.mock('@/features/assessment/stores/assessmentStore', () => ({ useAssessmentStore: () => ({ getByUserId: vi.fn() }) }));
vi.mock('@/features/planning-sheet/hooks/useLatestBehaviorMonitoring', () => ({ useLatestBehaviorMonitoring: () => ({ record: null }) }));
vi.mock('@/features/monitoring/repositories/createMonitoringMeetingRepository', () => ({ useMonitoringMeetingRepository: () => ({ listByUser: vi.fn(async () => []) }) }));
vi.mock('@/features/ibd/analysis/pdca/queries/usePdcaCycleState', () => ({ usePdcaCycleState: () => ({ state: {} }) }));
vi.mock('@/app/services/bridgeProxy', () => ({
  getPlanningWorkflowPhaseForSheet: vi.fn(() => ({ phase: 'active_plan' })),
  getMonitoringToPlanningBridge: vi.fn(),
  getMonitoringRecordFromMeeting: vi.fn(),
}));

describe('useSupportPlanningSheetOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.planningSheetId = 'sheet-1';
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  it('既存シートを表示する場合、データがフェッチされ viewModel が構築されること', async () => {
    const { result } = renderHook(() => useSupportPlanningSheetOrchestrator(), { wrapper });

    await waitFor(() => {
      expect(result.current.viewModel).not.toBeNull();
      expect(result.current.viewModel?.planningSheetId).toBe('sheet-1');
    });
  });

  it('新規作成時 (planningSheetId="new")、仮想シートが生成されること', async () => {
    mockParams.planningSheetId = 'new';
    const { result } = renderHook(() => useSupportPlanningSheetOrchestrator(), { wrapper });

    await waitFor(() => {
      expect(result.current.viewModel?.sheet.id).toBe('new');
      expect(result.current.viewModel?.sheet.status).toBe('draft');
    });
  });

  it('ハンドラが正しく公開されていること', () => {
    const { result } = renderHook(() => useSupportPlanningSheetOrchestrator(), { wrapper });

    expect(result.current.handlers.onEdit).toBeDefined();
    expect(result.current.handlers.onSave).toBeDefined();
    
    result.current.handlers.onEdit();
    expect(mockUiActions.setIsEditing).toHaveBeenCalledWith(true);
  });
});
