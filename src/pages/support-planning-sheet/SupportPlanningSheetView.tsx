import React from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

// import { createSharePointIspRepository } from '@/data/isp/sharepoint/SharePointIspRepository';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { usePlanPatchRepository } from '@/features/planning-sheet/hooks/usePlanPatchRepository';
import { NewPlanningSheetForm } from '@/features/planning-sheet/components/NewPlanningSheetForm';
// import { useSP } from '@/lib/spClient';
import { TESTIDS, tid } from '@/testids';
import {
  detectPlanNeedsUpdate,
  isPlanPatchOverdue,
  type PlanPatch,
} from '@/domain/isp/planPatch';

import { type SupportPlanningSheetViewProps } from './types';
import type { IspRepository } from '@/domain/isp/port';
import { usePlanningSheetOrchestrator } from '@/features/planning-sheet/hooks/orchestrators/usePlanningSheetOrchestrator';
import { ContextPanelSection } from './sections/ContextPanelSection';
import { ImportDialogsSection } from './sections/ImportDialogsSection';
import { PlanningMainStackSection } from './sections/PlanningMainStackSection';

export const SupportPlanningSheetView: React.FC<SupportPlanningSheetViewProps> = ({
  viewModel,
  handlers,
}) => {
  const planningSheetRepo = usePlanningSheetRepositories();
  const planPatchRepository = usePlanPatchRepository();
  // const spClient = useSP();
  const ispRepo = React.useMemo(() => ({
    getCurrentByUser: async () => null,
  } as unknown as IspRepository), []);
  const [pendingPatchCount, setPendingPatchCount] = React.useState(0);
  const [pendingPatches, setPendingPatches] = React.useState<PlanPatch[]>([]);
  const [patchActionMessage, setPatchActionMessage] = React.useState<string | null>(null);
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

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, pb: 4 }} {...tid(TESTIDS['planning-sheet-page'])}>
        {/* Iceberg Summary & Difference Insight */}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {icebergSummary && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 1.5, 
                bgcolor: alpha('#ed6c02', 0.04), 
                borderColor: alpha('#ed6c02', 0.2),
                borderRadius: 2
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700} color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InsightsRoundedIcon fontSize="small" />
                  最新の氷山分析
                </Typography>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">行動</Typography>
                  <Typography variant="body2" fontWeight={600}>{icebergSummary.primaryBehavior}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">要因</Typography>
                  <Typography variant="body2" fontWeight={600}>{icebergSummary.primaryFactor}</Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.disabled">
                  {new Date(icebergSummary.updatedAt).toLocaleDateString()} 更新
                </Typography>
              </Stack>
            </Paper>
          )}

          {differenceInsight && differenceInsight.changes.length > 0 && (
            <Paper 
              variant="outlined" 
              data-testid="difference-insight-bar"
              sx={{ 
                p: 1.5, 
                borderLeft: '4px solid #d32f2f',
                bgcolor: alpha('#d32f2f', 0.02),
                borderRadius: '0 8px 8px 0'
              }}
            >
              <Stack spacing={1}>
                <Typography variant="caption" fontWeight={700} color="error.main" sx={{ letterSpacing: 1 }}>
                  計画未反映の変更検知 (DIFFERENCE INSIGHT)
                </Typography>
                <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 2 }}>
                  {differenceInsight.changes.map((change, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip 
                        label={change.label} 
                        size="small" 
                        color={change.level === 'high' ? 'error' : change.level === 'medium' ? 'warning' : 'default'}
                        variant="outlined" 
                        sx={{ height: 20, fontSize: '0.65rem' }} 
                      />
                      <Typography 
                        variant="body2" 
                        fontWeight={600} 
                        color={change.level === 'high' ? 'error.main' : change.level === 'medium' ? 'warning.main' : 'text.primary'}
                      >
                        {change.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}
        </Stack>

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
