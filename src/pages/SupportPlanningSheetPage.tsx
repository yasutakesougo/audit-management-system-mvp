/**
 * SupportPlanningSheetPage — 支援計画シート画面 (L2)
 *
 * ADR-006 準拠: 画面責務境界
 *  - 読む: PlanningSheet, Iceberg PDCA
 *  - 書く: PlanningSheet
 *  - 書かない: ISP本文
 *
 * @see docs/adr/ADR-006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from '@/auth/useAuth';
import { createSharePointIspRepository } from '@/data/isp/sharepoint/SharePointIspRepository';
import { determineWorkflowPhase, type WorkflowPhase } from '@/domain/bridge/workflowPhase';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { usePlanningSheetForm } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { NewPlanningSheetForm } from '@/features/planning-sheet/components/NewPlanningSheetForm';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import { useImportAuditStore } from '@/features/planning-sheet/stores/importAuditStore';
import { filterAuditHistoryRecords, type AuditHistoryFilter } from '@/features/planning-sheet/domain/filterAuditHistory';
import { useLatestBehaviorMonitoring } from '@/features/planning-sheet/hooks/useLatestBehaviorMonitoring';
import { createMonitoringMeetingRepository } from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import { useStrategyUsageCounts } from '@/features/planning-sheet/hooks/useStrategyUsageCounts';
import { useStrategyUsageTrend } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import { useUsers } from '@/features/users/useUsers';
import { SP_ENABLED } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { TESTIDS, tid } from '@/testids';

// ── Local (split) ──
import { type SheetTabKey } from './support-planning-sheet/types';
import { VALID_TABS } from './support-planning-sheet/constants';
import { ContextPanelSection } from './support-planning-sheet/sections/ContextPanelSection';
import { ImportDialogsSection } from './support-planning-sheet/sections/ImportDialogsSection';
import { PlanningMainStackSection } from './support-planning-sheet/sections/PlanningMainStackSection';
import { useImportHandlers } from './support-planning-sheet/hooks/useImportHandlers';
import { usePlanningEvidenceState } from './support-planning-sheet/hooks/usePlanningEvidenceState';
import { useSupportPlanningContextPanel } from './support-planning-sheet/hooks/useSupportPlanningContextPanel';
import { useSupportPlanningPageHandlers } from './support-planning-sheet/hooks/useSupportPlanningPageHandlers';

export default function SupportPlanningSheetPage() {
  const { planningSheetId } = useParams<{ planningSheetId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdFromQuery = searchParams.get('userId');
  const tabFromQuery = searchParams.get('tab') as SheetTabKey | null;
  const initialTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'overview';

  const [activeTab, setActiveTab] = React.useState<SheetTabKey>(initialTab);
  const [isEditing, setIsEditing] = React.useState(false);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = React.useState(false);
  const [sessionProvenance, setSessionProvenance] = React.useState<ProvenanceEntry[]>([]);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [historyFilter, setHistoryFilter] = React.useState<AuditHistoryFilter>('all');

  const planningSheetRepo = usePlanningSheetRepositories();
  const spClient = useSP();
  const ispRepo = React.useMemo(() => createSharePointIspRepository(spClient), [spClient]);

  const { data: sheet, isLoading, error, refetch } = usePlanningSheetData(planningSheetId, planningSheetRepo);
  const form = usePlanningSheetForm(sheet, planningSheetRepo, (updated) => {
    setToast({ open: true, message: `「${updated.title}」を保存しました`, severity: 'success' });
    setIsEditing(false);
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
  const { account } = useAuth();
  const { saveAuditRecord, getAllProvenance, getBySheetId } = useImportAuditStore();

  const targetUser = React.useMemo(
    () => users.find((user) => user.UserID === sheet?.userId),
    [users, sheet?.userId],
  );
  const currentAssessment = React.useMemo(
    () => (sheet?.userId ? getAssessment(sheet.userId) : null),
    [sheet?.userId, getAssessment],
  );

  const persistedProvenance = React.useMemo(
    () => (planningSheetId ? getAllProvenance(planningSheetId) : []),
    [planningSheetId, getAllProvenance],
  );
  const allProvenanceEntries = React.useMemo(
    () => [...persistedProvenance, ...sessionProvenance],
    [persistedProvenance, sessionProvenance],
  );

  const auditRecords = React.useMemo(
    () => (planningSheetId ? getBySheetId(planningSheetId) : []),
    [planningSheetId, getBySheetId],
  );
  const filteredAuditRecords = React.useMemo(
    () => filterAuditHistoryRecords(auditRecords, historyFilter),
    [auditRecords, historyFilter],
  );

  const monitoringRepo = React.useMemo(
    () => SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient })
      : createMonitoringMeetingRepository('local'),
    [spClient],
  );
  const { record: latestMonitoringRecord } = useLatestBehaviorMonitoring(sheet?.userId ?? null, {
    repository: monitoringRepo,
    planningSheetId: planningSheetId ?? 'new',
  });

  const { handleAssessmentImport, handleMonitoringImport } = useImportHandlers({
    form,
    planningSheetId,
    currentAssessment,
    account: (account as { name?: string } | null | undefined),
    saveAuditRecord,
    setToast,
    setSessionProvenance,
  });

  const currentPhase = React.useMemo((): WorkflowPhase | null => {
    if (!sheet) return null;
    const result = determineWorkflowPhase({
      userId: sheet.userId,
      userName: (sheet as unknown as { userName?: string }).userName ?? sheet.userId,
      planningSheets: [{
        id: sheet.id,
        status: (sheet as unknown as { status?: string }).status ?? 'active',
        appliedFrom: (sheet as unknown as { supportStartDate?: string }).supportStartDate ?? null,
        reviewedAt: (sheet as unknown as { reviewedAt?: string }).reviewedAt ?? null,
        reviewCycleDays: (sheet as unknown as { monitoringCycleDays?: number }).monitoringCycleDays ?? 90,
        procedureCount: sheet.planning?.procedureSteps?.length ?? 0,
        isCurrent: true,
      }],
    });
    return result.phase;
  }, [sheet]);
  const {
    handleSave,
    handleReset,
    handleBannerNavigate,
    handleJumpToMonitoringHistory,
    handleEvidenceClick,
  } = useSupportPlanningPageHandlers({
    navigate,
    setActiveTab,
    sheetUserId: sheet?.userId,
    form,
    setIsEditing,
    setToast,
  });

  const { repo: handoffRepo } = useHandoffData();
  const { contextData, contextUserName } = useSupportPlanningContextPanel({
    userId: sheet?.userId,
    targetUser,
    handoffRepo,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (planningSheetId === 'new') {
    return (
      <NewPlanningSheetForm
        planningSheetRepo={planningSheetRepo}
        ispRepo={ispRepo}
        initialUserId={userIdFromQuery ?? undefined}
      />
    );
  }

  if (error || !sheet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || '支援計画シートが見つかりません'}</Alert>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate('/support-plan-guide')}
          sx={{ mt: 2 }}
        >
          ISP 画面に戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, pb: 4 }} {...tid(TESTIDS['planning-sheet-page'])}>
        <PlanningMainStackSection
          headerProps={{
            sheet,
            isEditing,
            isDirty: form.isDirty,
            isSaving: form.isSaving,
            isValid: form.isValid,
            hasAssessment: !!currentAssessment,
            hasMonitoringRecord: !!latestMonitoringRecord,
            icebergEvidence,
            onBack: () => navigate('/support-plan-guide'),
            onEdit: () => setIsEditing(true),
            onReset: handleReset,
            onSave: handleSave,
            onImportAssessment: () => setImportDialogOpen(true),
            onImportMonitoring: () => setMonitoringDialogOpen(true),
          }}
          operationGuideProps={{
            isEditing,
            onJumpToMonitoringHistory: handleJumpToMonitoringHistory,
            onJumpToPlanningTab: () => setActiveTab('planning'),
            onStartEditing: () => setIsEditing(true),
          }}
          planningStatusProps={{
            userId: sheet.userId,
            isEditing,
            validationErrors: form.validationErrors,
            provenanceEntries: allProvenanceEntries,
          }}
          importHistoryProps={{
            auditRecords,
            filteredAuditRecords,
            historyFilter,
            onHistoryFilterChange: setHistoryFilter,
          }}
          planningTabsProps={{
            activeTab,
            onTabChange: setActiveTab,
            currentPhase,
            onBannerNavigate: handleBannerNavigate,
            isEditing,
            form,
            allProvenanceEntries,
            sheet,
            evidenceLinks,
            abcRecords,
            pdcaItems,
            onEvidenceLinksChange: setEvidenceLinks,
            onEvidenceClick: handleEvidenceClick,
            strategyUsage,
            strategyUsageLoading,
            trendResult,
            trendDays,
            onTrendDaysChange: setTrendDays,
            trendLoading,
          }}
          tagAnalyticsProps={{ userId: sheet.userId }}
          metadataFooterProps={{ sheet }}
        />

        <ImportDialogsSection
          toast={toast}
          onCloseToast={() => setToast((prev) => ({ ...prev, open: false }))}
          currentAssessment={currentAssessment}
          importDialogOpen={importDialogOpen}
          onCloseImportDialog={() => setImportDialogOpen(false)}
          targetUserName={targetUser?.FullName}
          formValues={form.values}
          formIntake={form.intake}
          onImportAssessment={handleAssessmentImport}
          latestMonitoringRecord={latestMonitoringRecord}
          monitoringDialogOpen={monitoringDialogOpen}
          onCloseMonitoringDialog={() => setMonitoringDialogOpen(false)}
          onImportMonitoring={handleMonitoringImport}
        />
      </Box>

      <ContextPanelSection
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        onToggle={() => setContextOpen((prev) => !prev)}
        userName={contextUserName}
        data={contextData}
      />
    </Box>
  );
}
