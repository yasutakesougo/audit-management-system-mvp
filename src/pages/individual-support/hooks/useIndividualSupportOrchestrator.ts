import { useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material/Select';

import { useUsers } from '@/features/users/useUsers';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useCurrentPlanningSheet } from '@/features/planning-sheet/hooks/useCurrentPlanningSheet';
import { usePdcaBehaviorMonitoringRecords, usePdcaPlanningSheetReassessments } from '@/features/ibd/analysis/pdca/queries';
import { usePdcaCycleState } from '@/features/ibd/analysis/pdca/queries/usePdcaCycleState';
import { useSupportStepTemplates } from '@/features/ibd/procedures/templates/hooks/useSupportStepTemplates';
import { useSPSRevision } from '@/features/ibd/core/useSPSHistory';
import { getLatestSPS, getSPSHistory, addSPS, confirmSPS } from '@/features/ibd/core/ibdStore';
import { toLocalDateISO } from '@/utils/getNow';

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

  const { revise: reviseSPS } = useSPSRevision();

  const handleOpenMonitoring = useCallback(() => {
    if (!selectedUser) return;
    let sps = getLatestSPS(selectedUser.Id);

    if (!sps) {
      const now = toLocalDateISO();
      const spsId = `sps-${selectedUser.UserID}-auto`;
      addSPS({
        id: spsId,
        userId: selectedUser.Id,
        version: 'v1',
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        confirmedBy: null,
        confirmedAt: null,
        icebergModel: {
          observableBehaviors: ['行動観察データ収集中'],
          underlyingFactors: ['背景要因の分析中'],
          environmentalAdjustments: ['環境調整の検討中'],
        },
        positiveConditions: ['穏やかな環境', '馴染みのスタッフ'],
      });
      confirmSPS(spsId, 100, now);
      sps = getLatestSPS(selectedUser.Id);
    }

    uiActions.setActiveSPS(sps ?? null);
    uiActions.setActiveSPSHistory(sps ? getSPSHistory(sps.id) : []);
    uiActions.setMonitoringDialogOpen(true);
  }, [selectedUser, uiActions]);

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
    
    onOpenMonitoring: handleOpenMonitoring,
    onCloseMonitoring: () => uiActions.setMonitoringDialogOpen(false),
    onReviseSPS: reviseSPS,
    
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
