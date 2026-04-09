import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { usePlanningSheetForm } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import { useImportAuditStore } from '@/features/planning-sheet/stores/importAuditStore';
import { filterAuditHistoryRecords } from '@/features/planning-sheet/domain/filterAuditHistory';
import { useLatestBehaviorMonitoring } from '@/features/planning-sheet/hooks/useLatestBehaviorMonitoring';
import { useMonitoringMeetingRepository } from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import { useStrategyUsageCounts } from '@/features/planning-sheet/hooks/useStrategyUsageCounts';
import { useStrategyUsageTrend, type TrendDays } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import { useUsers } from '@/features/users/useUsers';
import { usePdcaCycleState } from '@/features/ibd/analysis/pdca/queries/usePdcaCycleState';
import { mapMonitoringToPlanningBridge, mapMonitoringMeetingToMonitoringRecord } from '@/domain/isp/bridgeMapper';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { MonitoringRecord } from '@/domain/isp/types';
import type { IUserMaster } from '@/features/users/types';
import type { UseAuth } from '@/auth/useAuth';

import { 
  type SupportPlanningSheetViewModel, 
  type SupportPlanningSheetActionHandlers
} from '../types';
import { useImportHandlers } from './useImportHandlers';
import { usePlanningEvidenceState } from './usePlanningEvidenceState';
import { useSupportPlanningContextPanel } from './useSupportPlanningContextPanel';
import { useSupportPlanningPageHandlers } from './useSupportPlanningPageHandlers';
import { useSupportPlanningSheetUiState } from './useSupportPlanningSheetUiState';
import { mapToSupportPlanningSheetViewModel } from './supportPlanningSheetViewModelMapper';

export function useSupportPlanningSheetOrchestrator(): {
  viewModel: SupportPlanningSheetViewModel | null;
  handlers: SupportPlanningSheetActionHandlers;
} {
  const { planningSheetId } = useParams<{ planningSheetId: string }>();
  const navigate = useNavigate();
  const { state: uiState, actions: uiActions } = useSupportPlanningSheetUiState();

  const planningSheetRepo = usePlanningSheetRepositories();
  // spClient は repository hooks 内に隠蔽されました


  // 1. データフェッチ
  const { data: sheet, isLoading, error, refetch } = usePlanningSheetData(planningSheetId, planningSheetRepo);
  const form = usePlanningSheetForm(sheet, planningSheetRepo, (updated) => {
    uiActions.setToast({ open: true, message: `「${updated.title}」を保存しました`, severity: 'success' });
    uiActions.setIsEditing(false);
    refetch();
  });

  const { data: icebergEvidence } = useIcebergEvidence(sheet?.userId ?? null);
  const { summary: strategyUsage, loading: strategyUsageLoading } = useStrategyUsageCounts(sheet?.userId);
  const {
    result: trendResult,
    days: trendDays,
    setDays: setTrendDays,
    loading: trendLoading,
  } = useStrategyUsageTrend(sheet?.userId);

  const { evidenceLinks, setEvidenceLinks, abcRecords, pdcaItems } = usePlanningEvidenceState(
    planningSheetId,
    sheet?.userId,
  );

  const { getByUserId: getAssessment } = useAssessmentStore();
  const { data: users } = useUsers();
  const searchParams = new URLSearchParams(window.location.search);
  const userIdParam = searchParams.get('userId');
  const source = searchParams.get('source');
  const diffSummary = searchParams.get('diffSummary');

  const { account } = useAuth();
  const { saveAuditRecord, getAllProvenance, getBySheetId } = useImportAuditStore();

  const targetUser = React.useMemo(
    () => users.find((user: IUserMaster) => user.UserID === (sheet?.userId || userIdParam)),
    [users, sheet?.userId, userIdParam],
  );

  // 新規作成時の仮想シート生成
  const effectiveSheet = React.useMemo(() => {
    if (sheet) return sheet;
    if (planningSheetId === 'new') {
      return {
        id: 'new',
        userId: userIdParam || '',
        title: targetUser?.FullName || '新規支援計画',
        status: 'draft' as const,
        planning: {
          procedureSteps: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as SupportPlanningSheet;
    }
    return null;
  }, [sheet, planningSheetId, userIdParam, targetUser]);

  const currentAssessment = React.useMemo(
    () => (effectiveSheet?.userId ? getAssessment(effectiveSheet.userId) : null),
    [effectiveSheet?.userId, getAssessment],
  );

  const persistedProvenance = React.useMemo(
    () => (planningSheetId && planningSheetId !== 'new' ? getAllProvenance(planningSheetId) : []),
    [planningSheetId, getAllProvenance],
  );

  const auditRecords = React.useMemo(
    () => (planningSheetId && planningSheetId !== 'new' ? getBySheetId(planningSheetId) : []),
    [planningSheetId, getBySheetId],
  );
  const filteredAuditRecords = React.useMemo(
    () => filterAuditHistoryRecords(auditRecords, uiState.historyFilter),
    [auditRecords, uiState.historyFilter],
  );

  const monitoringRepo = useMonitoringMeetingRepository();
  const { record: latestMonitoringRecord } = useLatestBehaviorMonitoring(effectiveSheet?.userId ?? null, {
    repository: monitoringRepo,
    planningSheetId: planningSheetId ?? 'new',
  });

  // Monitoring Bridge Logic
  const [monitoringMeetings, setMonitoringMeetings] = React.useState<MonitoringRecord[]>([]);
  React.useEffect(() => {
    if (!effectiveSheet?.userId) return;
    monitoringRepo.listByUser(String(effectiveSheet.userId))
      .then(records => records.map(mapMonitoringMeetingToMonitoringRecord))
      .then(setMonitoringMeetings);
  }, [effectiveSheet?.userId, monitoringRepo]);

  const { state: pdcaState } = usePdcaCycleState({
    userId: effectiveSheet?.userId ?? null,
    planningSheetId: planningSheetId ?? 'new',
    behaviorMonitoringRecords: latestMonitoringRecord ? [latestMonitoringRecord] : [],
    planningSheetReassessments: [], // 可動域として空配列
  });

  const monitoringBridge = React.useMemo(() => {
    return mapMonitoringToPlanningBridge(
      planningSheetId ?? 'new',
      monitoringMeetings,
      latestMonitoringRecord,
      pdcaState
    );
  }, [planningSheetId, monitoringMeetings, latestMonitoringRecord, pdcaState]);

  const { handleAssessmentImport, handleMonitoringImport, handleReflectCandidate } = useImportHandlers({
    form,
    planningSheetId,
    currentAssessment,
    account: (account as UseAuth['account']),
    saveAuditRecord,
    setToast: uiActions.setToast,
    setSessionProvenance: uiActions.setSessionProvenance,
  });

  const {
    handleSave,
    handleReset,
    handleBannerNavigate,
    handleJumpToMonitoringHistory,
    handleEvidenceClick,
    handleNavigateToExecution,
    handleNavigateToPdca,
  } = useSupportPlanningPageHandlers({
    navigate,
    setActiveTab: uiActions.setActiveTab,
    sheetUserId: effectiveSheet?.userId,
    planningSheetId,
    form,
    setIsEditing: uiActions.setIsEditing,
    setToast: uiActions.setToast,
  });

  const { repo: handoffRepo } = useHandoffData();
  const { contextData, contextUserName } = useSupportPlanningContextPanel({
    userId: effectiveSheet?.userId,
    targetUser,
    handoffRepo,
  });

  // 2. ViewModel の構築
  const viewModel: SupportPlanningSheetViewModel | null = React.useMemo(() => {
    if (!effectiveSheet) return null;
    return mapToSupportPlanningSheetViewModel({
      planningSheetId: planningSheetId!,
      sheet: effectiveSheet,
      isLoading,
      error,
      uiState,
      targetUser,
      currentAssessment: currentAssessment ?? null,
      persistedProvenance,
      auditRecords,
      filteredAuditRecords,
      icebergEvidence,
      latestMonitoringRecord,
      monitoringBridge,
      evidenceLinks,
      abcRecords,
      pdcaItems,
      strategyUsage,
      strategyUsageLoading,
      trendResult,
      trendDays: trendDays as TrendDays,
      trendLoading,
      contextUserName,
      contextData,
      form,
      source,
      diffSummary,
    });
  }, [
    planningSheetId, sheet, isLoading, error, uiState, 
    targetUser, currentAssessment, persistedProvenance, 
    auditRecords, filteredAuditRecords, latestMonitoringRecord, 
    icebergEvidence, evidenceLinks, abcRecords, pdcaItems, 
    strategyUsage, strategyUsageLoading, trendResult, trendDays, 
    trendLoading, contextUserName, contextData, form, source, diffSummary
  ]);

  // 差分引き継ぎの監査ログ記録
  React.useEffect(() => {
    if (planningSheetId === 'new' && diffSummary && account) {
      saveAuditRecord({
        planningSheetId: 'new',
        importedAt: new Date().toISOString(),
        importedBy: account.name ?? 'unknown',
        assessmentId: null,
        tokuseiResponseId: null,
        mode: 'behavior-monitoring',
        affectedFields: ['iceberg_differential_initialization'],
        provenance: [],
        summaryText: `氷山分析の差分基づき初期化: ${diffSummary}`,
      });
    }
  }, [planningSheetId, diffSummary, account, saveAuditRecord]);

  // 3. Handlers の合成
  const handlers: SupportPlanningSheetActionHandlers = {
    onBack: () => navigate('/support-plan-guide'),
    onEdit: () => uiActions.setIsEditing(true),
    onReset: handleReset,
    onSave: handleSave,
    onImportAssessment: () => uiActions.setImportDialogOpen(true),
    onImportMonitoring: () => uiActions.setMonitoringDialogOpen(true),
    onCloseImportDialog: () => uiActions.setImportDialogOpen(false),
    onCloseMonitoringDialog: () => uiActions.setMonitoringDialogOpen(false),
    onPerformAssessmentImport: handleAssessmentImport,
    onPerformMonitoringImport: handleMonitoringImport,
    onCloseToast: () => uiActions.setToast({ ...uiState.toast, open: false }),
    onTabChange: uiActions.setActiveTab,
    onBannerNavigate: handleBannerNavigate,
    onJumpToMonitoringHistory: handleJumpToMonitoringHistory,
    onJumpToPlanningTab: () => uiActions.setActiveTab('planning'),
    onTrendDaysChange: setTrendDays,
    onHistoryFilterChange: uiActions.setHistoryFilter,
    onToggleContext: () => uiActions.setContextOpen(!uiState.contextOpen),
    onCloseContext: () => uiActions.setContextOpen(false),
    onEvidenceLinksChange: setEvidenceLinks,
    onEvidenceClick: handleEvidenceClick,
    onReflectCandidate: (candidateId: string) => {
      if (!monitoringBridge) return;
      handleReflectCandidate(monitoringBridge, candidateId);
    },
    onNavigateToExecution: handleNavigateToExecution,
    onNavigateToPdca: handleNavigateToPdca,
  };

  return { viewModel, handlers };
}
