import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { SupportPlanningSheetView } from '../SupportPlanningSheetView';
import { SupportPlanningSheetViewModel, SupportPlanningSheetActionHandlers } from '../types';
import { TESTIDS } from '@/testids';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: vi.fn().mockReturnValue({}),
}));
vi.mock('@/features/planning-sheet/hooks/usePlanPatchRepository', () => ({
  usePlanPatchRepository: vi.fn().mockReturnValue({
    findPending: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock('@/features/planning-sheet/hooks/orchestrators/usePlanningSheetOrchestrator', () => ({
  usePlanningSheetOrchestrator: vi.fn().mockReturnValue({
    handleApplyPatch: vi.fn(),
    handleUpdatePatchStatus: vi.fn(),
  }),
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
};

const baseViewModel = {
  planningSheetId: 's1',
  sheet: { id: 's1', title: 'Test Sheet' },
  isLoading: false,
  error: null,
  isEditing: false,
  activeTab: 'overview',
  toast: { open: false, message: '', severity: 'success' },
  importDialogOpen: false,
  monitoringDialogOpen: false,
  contextOpen: false,
  historyFilter: {},
  currentPhase: null,
  targetUserName: 'User A',
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
  trendDays: 7,
  trendLoading: false,
  contextUserName: 'User A',
  contextData: { 
    summary: '',
    prompts: [],
    alerts: [],
    supportPlan: { status: 'none', goals: [] },
    handoffs: [],
    recentRecords: [],
  },
  form: { 
    register: vi.fn(), 
    handleSubmit: vi.fn(), 
    formState: { errors: {} },
    getValues: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
    reset: vi.fn(),
  },
  monitoringBridge: null,
  source: null,
  diffSummary: null,
} as unknown as SupportPlanningSheetViewModel;

describe('SupportPlanningSheetView Regression Tests', () => {
  it('差分（Difference Insight）がある場合、警告バーが表示されること', () => {
    const vm = { 
      ...baseViewModel, 
      differenceInsight: {
        changes: [
          { label: '行動', value: '追加: 自傷行為', level: 'high' as const },
        ],
        sourceSessionId: 'session-456'
      }
    };
    render(
      <MemoryRouter>
        <SupportPlanningSheetView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByTestId(TESTIDS.DIFFERENCE_INSIGHT_BAR)).toBeInTheDocument();
    expect(screen.getByText('計画未反映の変更検知 (DIFFERENCE INSIGHT)')).toBeInTheDocument();
    expect(screen.getByText('追加: 自傷行為')).toBeInTheDocument();
  });

  it('差分がない場合、警告バーが表示されないこと', () => {
    const vm = { ...baseViewModel, differenceInsight: undefined };
    render(
      <MemoryRouter>
        <SupportPlanningSheetView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId(TESTIDS.DIFFERENCE_INSIGHT_BAR)).not.toBeInTheDocument();
  });
});
