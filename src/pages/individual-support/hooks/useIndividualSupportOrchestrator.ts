import { useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material/Select';

import { useUsers } from '@/features/users/useUsers';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useCurrentPlanningSheet } from '@/features/planning-sheet/hooks/useCurrentPlanningSheet';
import type { PlanningSheetCreateInput } from '@/domain/isp/port';
import { usePdcaBehaviorMonitoringRecords, usePdcaPlanningSheetReassessments } from '@/features/ibd/analysis/pdca/queries';
import { usePdcaCycleState } from '@/features/ibd/analysis/pdca/queries/usePdcaCycleState';
import { useSupportStepTemplates } from '@/features/ibd/procedures/templates/hooks/useSupportStepTemplates';
import { toLocalDateISO } from '@/utils/getNow';
import {
  activatePlanningSheetVersionInRepository,
  createPlanningSheetRevision,
  getCurrentOrLatestPlanningSheet,
  listPlanningSheetSeries,
} from '@/features/planning-sheet/domain/planningSheetVersionWorkflow';

import { 
  type IndividualSupportViewModel, 
  type IndividualSupportActionHandlers 
} from '../types';
import { 
  toScheduleSlot, 
  buildInitialFormState, 
  type ScheduleSlot, 
  type TabValue
} from '@/features/ibd/procedures/daily-records/types';
import { useIndividualSupportUiState } from './useIndividualSupportUiState';
import { mapToIndividualSupportViewModel } from './individualSupportViewModelMapper';
import { buildShadowSpsHistory, toShadowSps } from './spsShadowAdapter';

function buildAutoPlanningSheetInput(
  userId: string,
  ispId: string,
  today: string,
): PlanningSheetCreateInput {
  return {
    userId,
    ispId,
    title: 'モニタリング運用シート',
    targetScene: '',
    targetDomain: '',
    observationFacts: '行動観察データ収集中',
    collectedInformation: '背景情報を収集中',
    interpretationHypothesis: '背景要因の分析中',
    supportIssues: '支援課題の整理中',
    supportPolicy: '支援方針の初期設定',
    environmentalAdjustments: '環境調整の検討中',
    concreteApproaches: '具体的関わり方を作成中',
    appliedFrom: today,
    nextReviewAt: today,
    supportStartDate: today,
    monitoringCycleDays: 90,
    authoredByStaffId: '',
    authoredByQualification: 'unknown',
    authoredAt: today,
    applicableServiceType: 'other',
    applicableAddOnTypes: ['none'],
    deliveredToUserAt: undefined,
    reviewedAt: undefined,
    hasMedicalCoordination: false,
    hasEducationCoordination: false,
    status: 'active',
    isCurrent: true,
  };
}

/**
 * IndividualSupportManagement のオーケストレーター hook。
 * データフェッチ、UI状態、アクションハンドラの統合を担当。
 */
export function useIndividualSupportOrchestrator(): {
  viewModel: IndividualSupportViewModel | null;
  handlers: IndividualSupportActionHandlers;
} {
  const { userCode } = useParams<{ userCode: string }>();
  const navigate = useNavigate();
  const { data: allUsers } = useUsers();
  const { state: uiState, actions: uiActions } = useIndividualSupportUiState();

  // 1. データ統合 (L2/L1/L0)
  const ibdUsers = useMemo(
    () => (allUsers ?? []).filter((u) => u.IsHighIntensitySupportTarget),
    [allUsers],
  );

  const selectedUser = useMemo(
    () => ibdUsers.find((u) => String(u.UserID) === userCode) ?? null,
    [ibdUsers, userCode],
  );

  const planningSheetRepository = usePlanningSheetRepositories();
  const { currentSheet } = useCurrentPlanningSheet(
    selectedUser?.UserID ?? null,
    planningSheetRepository,
  );
  const targetPlanningSheetId = currentSheet?.id ?? null;

  const { data: behaviorMonitoringRecords } = usePdcaBehaviorMonitoringRecords({
    userCode: selectedUser?.UserID ? String(selectedUser.UserID) : null,
    supervisionUserId: selectedUser?.Id ?? null,
    planningSheetId: targetPlanningSheetId,
  });

  const { data: planningSheetReassessments } = usePdcaPlanningSheetReassessments({
    planningSheetId: targetPlanningSheetId,
  });

  const { state: pdcaState, isLoading: isPdcaLoading, error: pdcaError } = usePdcaCycleState({
    userId: selectedUser?.UserID ? String(selectedUser.UserID) : null,
    planningSheetId: targetPlanningSheetId,
    behaviorMonitoringRecords: behaviorMonitoringRecords ?? [],
    planningSheetReassessments: planningSheetReassessments ?? [],
  });

  const { templates, isLoading: isTemplatesLoading } = useSupportStepTemplates(userCode ?? null);
  const scheduleSlots = useMemo(() => templates.map(toScheduleSlot), [templates]);

  // 利用者変更時のリセット
  useEffect(() => {
    uiActions.resetRecordingState(buildInitialFormState(scheduleSlots));
  }, [scheduleSlots, userCode]);

  // 2. 業務ハンドラの定義
  const handleRecord = useCallback((slot: ScheduleSlot) => {
    const currentState = uiState.formState[slot.id];

    if (!currentState?.mood) {
      uiActions.setFormState((prev) => ({
        ...prev,
        [slot.id]: { ...prev[slot.id], error: '「本人の様子」を選択してください。' },
      }));
      uiActions.showSnackbar('記録に必要な項目が未入力です。', 'error');
      return;
    }

    const abcIncluded = currentState.showABC && (currentState.abc.antecedent || currentState.abc.behavior || currentState.abc.consequence);
    const entry = {
      id: `${slot.id}-${Date.now()}`,
      time: slot.time,
      activity: slot.activity,
      mood: currentState.mood,
      note: currentState.note.trim(),
      abc: abcIncluded ? currentState.abc : undefined,
      recordedAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    uiActions.setTimeline((prev) => [entry, ...prev]);
    uiActions.setRecordedSlotIds((prev) => new Set(prev).add(slot.id));
    uiActions.setFormState((prev) => ({
      ...prev,
      [slot.id]: {
        mood: '',
        note: '',
        showABC: prev[slot.id].showABC,
        abc: { antecedent: '', behavior: '', consequence: '' },
        error: null,
      },
    }));
    uiActions.showSnackbar(`${slot.time}「${slot.activity}」を記録しました。`, 'success');
  }, [uiState.formState, uiActions]);

  const handleOpenMonitoring = useCallback(async () => {
    if (!selectedUser) return;

    const userId = String(selectedUser.UserID);
    const today = toLocalDateISO();

    try {
      let sheet = await getCurrentOrLatestPlanningSheet(
        planningSheetRepository,
        userId,
      );

      if (!sheet) {
        const autoIspId = `isp-${userId}-auto`;
        sheet = await planningSheetRepository.create(
          buildAutoPlanningSheetInput(userId, autoIspId, today),
        );
      }

      const series = await listPlanningSheetSeries(
        planningSheetRepository,
        sheet.userId,
        sheet.ispId,
      );

      uiActions.setActiveSPS(toShadowSps(sheet, selectedUser.Id));
      uiActions.setActiveSPSHistory(
        buildShadowSpsHistory(series, sheet.id, selectedUser.Id),
      );
      uiActions.setMonitoringDialogOpen(true);
    } catch (error) {
      console.error('[useIndividualSupportOrchestrator] open monitoring failed', error);
      uiActions.showSnackbar('モニタリング情報の取得に失敗しました。', 'error');
    }
  }, [planningSheetRepository, selectedUser, uiActions]);

  const handleReviseSPS = useCallback(
    async (
      spsId: string,
      revisedBy: number | null,
      revisionReason: string,
      changesSummary: string,
    ): Promise<boolean> => {
      if (!selectedUser) return false;

      const operatorId =
        revisedBy !== null ? String(revisedBy) : 'current-user';

      try {
        const draft = await createPlanningSheetRevision(
          planningSheetRepository,
          spsId,
          {
            changedBy: operatorId,
            changeReason: `${revisionReason}\n${changesSummary}`,
          },
        );

        const series = await activatePlanningSheetVersionInRepository(
          planningSheetRepository,
          draft.id,
          {
            activatedBy: operatorId,
            appliedFrom: toLocalDateISO(),
          },
        );

        const latest =
          series.find((sheet) => sheet.id === draft.id) ??
          series[0] ??
          draft;

        uiActions.setActiveSPS(toShadowSps(latest, selectedUser.Id));
        uiActions.setActiveSPSHistory(
          buildShadowSpsHistory(series, latest.id, selectedUser.Id),
        );
        return true;
      } catch (error) {
        console.error('[useIndividualSupportOrchestrator] revise failed', error);
        uiActions.showSnackbar('改訂の保存に失敗しました。', 'error');
        return false;
      }
    },
    [planningSheetRepository, selectedUser, uiActions],
  );

  // 3. Handlers の合成
  const handlers: IndividualSupportActionHandlers = {
    onUserChange: (e: SelectChangeEvent) => navigate(`/admin/individual-support/${e.target.value}`),
    onUserSelect: (code: string) => navigate(`/admin/individual-support/${code}`),
    onTabChange: (_e, v: TabValue) => uiActions.setTab(v),
    
    onMoodSelect: (slotId, mood) => uiActions.setFormState(prev => ({ 
      ...prev, [slotId]: { ...prev[slotId], mood, error: null } 
    })),
    onNoteChange: (slotId, value) => uiActions.setFormState(prev => ({
      ...prev, [slotId]: { ...prev[slotId], note: value }
    })),
    onToggleABC: (slotId) => uiActions.setFormState(prev => ({
      ...prev, [slotId]: { ...prev[slotId], showABC: !prev[slotId].showABC }
    })),
    onABCSelect: (slotId, key, value) => uiActions.setFormState(prev => ({
      ...prev, [slotId]: { ...prev[slotId], abc: { ...prev[slotId].abc, [key]: value } }
    })),
    onRecord: handleRecord,
    onToggleUnrecorded: uiActions.setShowOnlyUnrecorded,
    
    onOpenMonitoring: () => {
      void handleOpenMonitoring();
    },
    onCloseMonitoring: () => uiActions.setMonitoringDialogOpen(false),
    onReviseSPS: handleReviseSPS,
    
    onCloseSnackbar: uiActions.hideSnackbar,
  };

  // 4. ViewModel の構築
  const viewModel = useMemo(() => mapToIndividualSupportViewModel({
    userCode,
    selectedUser,
    ibdUsers,
    uiState,
    templates,
    scheduleSlots,
    pdcaState,
    isPdcaLoading,
    pdcaError,
    isTemplatesLoading,
  }), [
    userCode, selectedUser, ibdUsers, uiState, templates, 
    scheduleSlots, pdcaState, isPdcaLoading, pdcaError, isTemplatesLoading
  ]);

  return { viewModel, handlers };
}
