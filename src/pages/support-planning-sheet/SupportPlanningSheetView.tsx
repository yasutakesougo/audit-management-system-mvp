import React from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

// import { createSharePointIspRepository } from '@/data/isp/sharepoint/SharePointIspRepository';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { NewPlanningSheetForm } from '@/features/planning-sheet/components/NewPlanningSheetForm';
// import { useSP } from '@/lib/spClient';
import { TESTIDS, tid } from '@/testids';

import { type SupportPlanningSheetViewProps } from './types';
import type { IspRepository } from '@/domain/isp/port';
import { ContextPanelSection } from './sections/ContextPanelSection';
import { ImportDialogsSection } from './sections/ImportDialogsSection';
import { PlanningMainStackSection } from './sections/PlanningMainStackSection';

export const SupportPlanningSheetView: React.FC<SupportPlanningSheetViewProps> = ({
  viewModel,
  handlers,
}) => {
  const planningSheetRepo = usePlanningSheetRepositories();
  // const spClient = useSP();
  const ispRepo = React.useMemo(() => ({
    getCurrentByUser: async () => null,
  } as unknown as IspRepository), []);

  if (!viewModel) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const {
    planningSheetId,
    sheet,
    isLoading,
    error,
    isEditing,
    activeTab,
    toast,
    importDialogOpen,
    monitoringDialogOpen,
    contextOpen,
    historyFilter,
    currentPhase,
    targetUserName,
    hasAssessment,
    currentAssessment,
    hasMonitoringRecord,
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
  } = viewModel;

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
        initialUserId={sheet?.userId ?? undefined}
        initialSource={source ?? undefined}
        diffSummary={diffSummary ?? undefined}
      />
    );
  }

  if (error || !sheet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || '支援計画シートが見つかりません。利用者ハブから対象のシートを選び直してください。'}
        </Alert>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={handlers.onBack}
          sx={{ mt: 2 }}
        >
          利用者ハブに戻る
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
            hasAssessment,
            hasMonitoringRecord,
            icebergEvidence: icebergEvidence ?? undefined,
            onBack: handlers.onBack,
            onEdit: handlers.onEdit,
            onReset: handlers.onReset,
            onSave: handlers.onSave,
            onImportAssessment: handlers.onImportAssessment,
            onImportMonitoring: handlers.onImportMonitoring,
            onNavigateToExecution: handlers.onNavigateToExecution,
            onNavigateToPdca: handlers.onNavigateToPdca,
          }}
          operationGuideProps={{
            isEditing,
            onJumpToMonitoringHistory: handlers.onJumpToMonitoringHistory,
            onJumpToPlanningTab: handlers.onJumpToPlanningTab,
            onStartEditing: handlers.onEdit,
          }}
          planningStatusProps={{
            userId: sheet.userId,
            isEditing,
            validationErrors: form.validationErrors,
            provenanceEntries: allProvenanceEntries,
          }}
          bridgeSuggestionsProps={{
            bridge: monitoringBridge,
            isEditing,
            onReflectCandidate: handlers.onReflectCandidate,
          }}
          importHistoryProps={{
            auditRecords,
            filteredAuditRecords,
            historyFilter,
            onHistoryFilterChange: handlers.onHistoryFilterChange,
          }}
          planningTabsProps={{
            activeTab,
            onTabChange: handlers.onTabChange,
            currentPhase,
            onBannerNavigate: handlers.onBannerNavigate,
            isEditing,
            form,
            allProvenanceEntries,
            sheet,
            evidenceLinks,
            abcRecords,
            pdcaItems,
            onEvidenceLinksChange: handlers.onEvidenceLinksChange,
            onEvidenceClick: handlers.onEvidenceClick,
            strategyUsage,
            strategyUsageLoading,
            trendResult,
            trendDays,
            onTrendDaysChange: handlers.onTrendDaysChange,
            trendLoading,
          }}
          tagAnalyticsProps={{ userId: sheet.userId }}
          metadataFooterProps={{ sheet }}
        />

        <ImportDialogsSection
          toast={toast}
          onCloseToast={handlers.onCloseToast}
          currentAssessment={currentAssessment}
          importDialogOpen={importDialogOpen}
          onCloseImportDialog={handlers.onCloseImportDialog}
          targetUserName={targetUserName}
          formValues={form.values}
          formIntake={form.intake}
          onImportAssessment={handlers.onPerformAssessmentImport}
          latestMonitoringRecord={latestMonitoringRecord}
          monitoringDialogOpen={monitoringDialogOpen}
          onCloseMonitoringDialog={handlers.onCloseMonitoringDialog}
          onImportMonitoring={handlers.onPerformMonitoringImport}
        />
      </Box>

      <ContextPanelSection
        open={contextOpen}
        onClose={handlers.onCloseContext}
        onToggle={handlers.onToggleContext}
        userName={contextUserName}
        data={contextData}
      />
    </Box>
  );
};
