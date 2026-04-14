import {
  getPlanningWorkflowPhaseForSheet,
  type MonitoringToPlanningBridge,
} from '@/app/services/bridgeProxy';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { SupportPlanningSheetViewModel } from '../types';
import type { SupportPlanningSheetUiState } from './useSupportPlanningSheetUiState';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';
import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import type { StrategyUsageSummary, StrategyUsageTrendResult } from '@/domain/isp/aggregateStrategyUsage';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import type { IcebergEvidenceBySheet } from '@/domain/regulatory/findingEvidenceSummary';
import type { TrendDays } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import type { IUserMaster } from '@/features/users/types';
import type { UserAssessment } from '@/features/assessment/domain/types';

export interface MapperInput {
  planningSheetId: string;
  sheet: SupportPlanningSheet;
  isLoading: boolean;
  error: string | null;
  uiState: SupportPlanningSheetUiState;
  
  // Bridge
  monitoringBridge: MonitoringToPlanningBridge | null;
  
  // External Domain Data
  targetUser: IUserMaster | undefined;
  currentAssessment: UserAssessment | null;
  persistedProvenance: ProvenanceEntry[];
  auditRecords: ImportAuditRecord[];
  filteredAuditRecords: ImportAuditRecord[];
  icebergEvidence: IcebergEvidenceBySheet | null;
  latestMonitoringRecord: BehaviorMonitoringRecord | null;
  
  // Planning Evidence
  evidenceLinks: EvidenceLinkMap;
  abcRecords: AbcRecord[];
  pdcaItems: IcebergPdcaItem[];
  
  // Strategy Analytics
  strategyUsage: StrategyUsageSummary | null;
  strategyUsageLoading: boolean;
  trendResult: StrategyUsageTrendResult | null;
  trendDays: TrendDays;
  trendLoading: boolean;

  // Context Panel
  contextUserName: string;
  contextData: ContextPanelData;
  
  // Form
  form: UsePlanningSheetFormReturn;
  
  // Handoff
  source: string | null;
  diffSummary: string | null;
}

/**
 * SupportPlanningSheet の ViewModel を構築する純粋関数。
 * 派生データの再計算や表示制御ロジックをここに集約。
 */
export function mapToSupportPlanningSheetViewModel(input: MapperInput): SupportPlanningSheetViewModel {
  const {
    planningSheetId,
    sheet,
    error,
    uiState,
    monitoringBridge,
    isLoading,
    targetUser,
    currentAssessment,
    persistedProvenance,
    auditRecords,
    filteredAuditRecords,
    icebergEvidence,
    latestMonitoringRecord,
    evidenceLinks,
    abcRecords,
    pdcaItems,
    strategyUsage,
    strategyUsageLoading,
    trendResult,
    trendDays,
    trendLoading,
    contextUserName,
    contextData,
    form,
    source,
    diffSummary,
  } = input;

  // 1. セッションと永続化された Provenance の統合
  const allProvenanceEntries = [...persistedProvenance, ...uiState.sessionProvenance];

  // 2. ワークフローフェーズの判定（派生データ）
  const workflowResult = getPlanningWorkflowPhaseForSheet({
    userId: sheet.userId,
    userName: sheet.title,
    sheet: {
      id: sheet.id,
      status: sheet.status,
      appliedFrom: sheet.supportStartDate ?? null,
      reviewedAt: sheet.reviewedAt ?? null,
      reviewCycleDays: sheet.monitoringCycleDays ?? 90,
      procedureCount: sheet.planning?.procedureSteps?.length ?? 0,
      isCurrent: true,
    },
  });

  return {
    planningSheetId,
    sheet,
    isLoading,
    error,
    isEditing: uiState.isEditing,
    activeTab: uiState.activeTab,
    toast: uiState.toast,
    importDialogOpen: uiState.importDialogOpen,
    monitoringDialogOpen: uiState.monitoringDialogOpen,
    contextOpen: uiState.contextOpen,
    historyFilter: uiState.historyFilter,
    
    currentPhase: workflowResult.phase,
    targetUserName: targetUser?.FullName,
    hasAssessment: !!currentAssessment,
    currentAssessment,
    hasMonitoringRecord: !!latestMonitoringRecord,
    icebergEvidence,
    allProvenanceEntries,
    auditRecords,
    filteredAuditRecords,
    latestMonitoringRecord,
    evidenceLinks,
    abcRecords,
    pdcaItems,
    strategyUsage,
    strategyUsageLoading,
    trendResult,
    trendDays,
    trendLoading,
    contextUserName,
    contextData,
    form,
    monitoringBridge,
    source,
    diffSummary,
  };
}
