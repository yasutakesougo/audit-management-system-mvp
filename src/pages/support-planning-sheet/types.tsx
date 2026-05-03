/**
 * SupportPlanningSheetPage — 共有型・定数・小コンポーネント
 */
import React from 'react';
import Box from '@mui/material/Box';
import type { PlanningSheetStatus } from '@/domain/isp/schema';
import { MonitoringToPlanningBridge } from '@/domain/isp/bridge';
import type { UserAssessment } from '@/features/assessment/domain/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SheetTabKey = 'overview' | 'intake' | 'assessment' | 'planning' | 'regulatory';

export const TAB_SECTIONS: { key: SheetTabKey; label: string }[] = [
  { key: 'overview', label: '概要' },
  { key: 'intake', label: '情報収集' },
  { key: 'assessment', label: 'アセスメント' },
  { key: 'planning', label: '支援設計' },
  { key: 'regulatory', label: '制度項目' },
];

export const VALID_TABS: string[] = TAB_SECTIONS.map((s) => s.key);

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────

export function statusColor(status: PlanningSheetStatus): 'default' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'draft': return 'default';
    case 'review': return 'info';
    case 'active': return 'success';
    case 'revision_pending': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
}

// ─────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────

export const TabPanel: React.FC<{
  current: SheetTabKey;
  value: SheetTabKey;
  children: React.ReactNode;
}> = ({ current, value, children }) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`planning-sheet-tabpanel-${value}`}
    aria-labelledby={`planning-sheet-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? children : null}
  </Box>
);

// ─────────────────────────────────────────────
// ViewModel & ActionHandlers
// ─────────────────────────────────────────────

import type { SupportPlanningSheet, IcebergSummary, DifferenceInsight } from '@/domain/isp/schema';
import { type WorkflowPhase } from '@/app/services/bridgeProxy';
import type { IcebergEvidenceBySheet } from '@/domain/regulatory/findingEvidenceSummary';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { ProvenanceEntry, AssessmentBridgeResult } from '@/features/planning-sheet/assessmentBridge';
import type { MonitoringToPlanningResult } from '@/features/planning-sheet/monitoringToPlanningBridge';
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';
import type { AuditHistoryFilter } from '@/features/planning-sheet/domain/filterAuditHistory';
import type { EvidenceLinkMap, EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import type { StrategyUsageSummary, StrategyUsageTrendResult } from '@/domain/isp/aggregateStrategyUsage';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import type { TrendDays } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';

export interface SupportPlanningSheetViewModel {
  planningSheetId: string;
  sheet: SupportPlanningSheet;
  isLoading: boolean;
  error: string | null;
  isEditing: boolean;
  activeTab: SheetTabKey;
  
  // UI States
  toast: { open: boolean; message: string; severity: 'success' | 'warning' | 'error' | 'info' };
  importDialogOpen: boolean;
  monitoringDialogOpen: boolean;
  contextOpen: boolean;
  historyFilter: AuditHistoryFilter;

  // Domain derived data (ViewModel)
  currentPhase: WorkflowPhase | null;
  targetUserName?: string;
  hasAssessment: boolean;
  currentAssessment: UserAssessment | null;
  hasMonitoringRecord: boolean;
  icebergEvidence: IcebergEvidenceBySheet | null;
  allProvenanceEntries: ProvenanceEntry[];
  auditRecords: ImportAuditRecord[];
  filteredAuditRecords: ImportAuditRecord[];
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
  
  // Bridge
  monitoringBridge: MonitoringToPlanningBridge | null;
  
  // Form
  form: UsePlanningSheetFormReturn;
  
  // Handoff / Audit
  source: string | null;
  diffSummary: string | null;

  // New: Iceberg synchronization insights
  icebergSummary?: IcebergSummary;
  differenceInsight?: DifferenceInsight;
}

export interface SupportPlanningSheetActionHandlers {
  onBack: () => void;
  onEdit: () => void;
  onReset: () => void;
  onSave: () => void;
  onImportAssessment: () => void;
  onImportMonitoring: () => void;
  onCloseImportDialog: () => void;
  onCloseMonitoringDialog: () => void;
  onPerformAssessmentImport: (result: AssessmentBridgeResult) => void;
  onPerformMonitoringImport: (result: MonitoringToPlanningResult, selectedCandidateIds: string[]) => void;
  onCloseToast: () => void;
  onTabChange: (tab: SheetTabKey) => void;
  onBannerNavigate: (href: string) => void;
  onJumpToMonitoringHistory: () => void;
  onJumpToPlanningTab: () => void;
  onTrendDaysChange: (days: TrendDays) => void;
  onHistoryFilterChange: (filter: AuditHistoryFilter) => void;
  onToggleContext: () => void;
  onCloseContext: () => void;
  onEvidenceLinksChange: (links: EvidenceLinkMap) => void;
  onEvidenceClick: (type: EvidenceLinkType, referenceId: string) => void;
  onReflectCandidate: (candidateId: string) => void;
  /** 支援手順の実施ボタン: /daily/support へ planningSheetId 付きで遷移 */
  onNavigateToExecution: () => void;
  /** 見直し・PDCAボタン: /analysis/iceberg-pdca へ遷移 */
  onNavigateToPdca: () => void;
}

export interface SupportPlanningSheetViewProps {
  viewModel: SupportPlanningSheetViewModel | null;
  handlers: SupportPlanningSheetActionHandlers;
}
