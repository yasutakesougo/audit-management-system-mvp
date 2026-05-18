import React from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { useIspRepository } from '@/features/planning-sheet/hooks/useIspRepository';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { usePlanPatchRepository } from '@/features/planning-sheet/hooks/usePlanPatchRepository';
import { activatePlanningSheetVersionInRepository } from '@/features/planning-sheet/domain/planningSheetVersionWorkflow';
import { NewPlanningSheetForm } from '@/features/planning-sheet/components/NewPlanningSheetForm';
import { TESTIDS, tid } from '@/testids';
import {
  detectPlanNeedsUpdate,
  isPlanPatchOverdue,
  type PlanPatch,
} from '@/domain/isp/planPatch';

import { type SupportPlanningSheetViewProps } from './types';
import { usePlanningSheetOrchestrator } from '@/features/planning-sheet/hooks/orchestrators/usePlanningSheetOrchestrator';
import { ContextPanelSection } from './sections/ContextPanelSection';
import { ImportDialogsSection } from './sections/ImportDialogsSection';
import { PlanningMainStackSection } from './sections/PlanningMainStackSection';
import { DifferenceInsightBar } from './components/DifferenceInsightBar';
import { ReflectPreviewDialog } from './components/ReflectPreviewDialog';
import { toLocalDateISO } from '@/utils/getNow';

export const SupportPlanningSheetView: React.FC<SupportPlanningSheetViewProps> = ({
  viewModel,
  handlers,
}) => {
  const planningSheetRepo = usePlanningSheetRepositories();
  const planPatchRepository = usePlanPatchRepository();
  const ispRepo = useIspRepository();
  const [pendingPatchCount, setPendingPatchCount] = React.useState(0);
  const [pendingPatches, setPendingPatches] = React.useState<PlanPatch[]>([]);
  const [patchActionMessage, setPatchActionMessage] = React.useState<string | null>(null);
  const [isActivatingOperationStart, setIsActivatingOperationStart] = React.useState(false);
  const hasPendingPlanUpdate = React.useMemo(
    () => detectPlanNeedsUpdate(pendingPatches),
    [pendingPatches],
  );
  const hasOverduePlanUpdate = React.useMemo(
    () => pendingPatches.some((patch) => isPlanPatchOverdue(patch)),
    [pendingPatches],
  );

  const planningSheetId = viewModel?.planningSheetId;

  React.useEffect(() => {
    if (!planningSheetId || planningSheetId === 'new') {
      setPendingPatchCount(0);
      setPendingPatches([]);
      return;
    }

    let active = true;

    void planPatchRepository.findPending(planningSheetId).then((patches) => {
      if (!active) return;
      setPendingPatchCount(patches.length);
      setPendingPatches(patches);
    });

    return () => {
      active = false;
    };
  }, [planPatchRepository, planningSheetId]);

  const { handleApplyPatch: orchestratorApplyPatch, handleUpdatePatchStatus } = usePlanningSheetOrchestrator({
    planningSheetRepo,
    planPatchRepo: planPatchRepository,
    showSnack: (_severity, msg) => setPatchActionMessage(msg),
    refresh: async () => {
      if (!planningSheetId || planningSheetId === 'new') return;
      // In a real VM setup, this would trigger a refetch in the VM.
      // For now, we simulate by re-fetching patches locally.
      const patches = await planPatchRepository.findPending(planningSheetId);
      setPendingPatches(patches);
      setPendingPatchCount(patches.length);
    }
  });

  if (!viewModel) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const {
    // planningSheetId, // Already extracted above
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
    icebergSummary,
    differenceInsight,
    reflectPreview,
    reflectPreviewOpen,
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

  const handlePatchStatusChange = async (
    patchId: string,
    status: PlanPatch['status'],
  ) => {
    await handleUpdatePatchStatus(patchId, status);
  };

  const handleApplyPatch = async (patch: PlanPatch) => {
    await orchestratorApplyPatch(patch, sheet);
  };

  const isValidDate = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  };

  const activationDisabledReason = React.useMemo(() => {
    if (sheet.status !== 'draft') return null;
    if (!sheet.supportStartDate) return '支援開始日（モニタリング起点）を設定してください。';
    if (!isValidDate(sheet.supportStartDate)) return '支援開始日の形式が不正です。';
    const hasProcedureSteps = (sheet.planning?.procedureSteps?.length ?? 0) > 0;
    const hasSupportPolicy = sheet.supportPolicy.trim().length > 0;
    if (!hasProcedureSteps && !hasSupportPolicy) {
      return '支援設計（手順または支援方針）を入力してください。';
    }
    return null;
  }, [sheet]);

  const handleActivateOperationStart = async () => {
    if (sheet.status !== 'draft') return;
    if (activationDisabledReason) return;
    setIsActivatingOperationStart(true);
    try {
      await activatePlanningSheetVersionInRepository(
        planningSheetRepo,
        sheet.id,
        {
          activatedBy: sheet.updatedBy || sheet.authoredByStaffId || 'current-user',
          appliedFrom: sheet.supportStartDate || toLocalDateISO(),
        },
      );
      setPatchActionMessage('支援計画シートを運用開始しました。');
      handlers.onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPatchActionMessage(`運用開始に失敗しました: ${message}`);
    } finally {
      setIsActivatingOperationStart(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, pb: 4 }} {...tid(TESTIDS['planning-sheet-page'])}>
        {/* Iceberg Summary & Difference Insight */}
        <DifferenceInsightBar 
          icebergSummary={icebergSummary}
          differenceInsight={differenceInsight}
          onOpenPreview={handlers.onOpenReflectPreview}
        />

        {hasPendingPlanUpdate ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            未反映の計画更新案が {pendingPatchCount} 件あります。モニタリング会議の結果を確認し、必要に応じて計画へ反映してください。
          </Alert>
        ) : null}
        {patchActionMessage ? (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPatchActionMessage(null)}>
            {patchActionMessage}
          </Alert>
        ) : null}
        {pendingPatches.length > 0 ? (
          <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              未反映の更新案レビュー
            </Typography>
            {pendingPatches.map((patch, index) => (
              <Box key={patch.id} sx={{ py: 2 }}>
                {index > 0 ? <Divider sx={{ mb: 2 }} /> : null}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {patch.target === 'plan' ? '計画更新案' : '手順更新案'} / status: {patch.status} / baseVersion: {patch.baseVersion}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                  理由: {patch.reason}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                  根拠記録: {patch.evidenceIds.join(', ') || 'なし'}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                      Before
                    </Typography>
                    <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'grey.100', overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(patch.before, null, 2)}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                      After
                    </Typography>
                    <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'grey.100', overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(patch.after, null, 2)}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" size="small" onClick={() => void handleApplyPatch(patch)}>
                    承認して反映
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => void handlePatchStatusChange(patch.id, 'review')}>
                    保留
                  </Button>
                  <Button variant="text" size="small" color="warning" onClick={() => void handlePatchStatusChange(patch.id, 'draft')}>
                    差し戻し
                  </Button>
                </Box>
              </Box>
            ))}
          </Paper>
        ) : null}
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
            onActivateOperationStart: () => {
              void handleActivateOperationStart();
            },
            activateOperationDisabledReason: activationDisabledReason,
            isActivatingOperationStart,
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
            hasPendingPlanUpdate,
            hasOverduePlanUpdate,
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

        <ReflectPreviewDialog 
          open={reflectPreviewOpen}
          preview={reflectPreview}
          onClose={handlers.onCloseReflectPreview}
          onConfirm={handlers.onConfirmReflect}
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
