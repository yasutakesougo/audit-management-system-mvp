import type { 
  IndividualSupportViewModel 
} from '../types';
import type { 
  IndividualSupportUiState 
} from './useIndividualSupportUiState';
import type { 
  ScheduleSlot,
} from '@/features/ibd/procedures/daily-records/types';
import type { IUserMaster } from '@/features/users/types';
import type { PdcaCycleState } from '@/domain/isp/types';
import type { SupportStepTemplate } from '@/domain/support/step-templates';

export interface MapperInput {
  userCode: string | undefined;
  selectedUser: IUserMaster | null;
  ibdUsers: IUserMaster[];
  
  // UI 状態
  uiState: IndividualSupportUiState;
  
  // ドメインデータ
  templates: SupportStepTemplate[];
  scheduleSlots: ScheduleSlot[];
  pdcaState: PdcaCycleState | null;
  isPdcaLoading: boolean;
  pdcaError: unknown;
  isTemplatesLoading: boolean;
}

/**
 * IndividualSupportManagement の ViewModel を構築する純粋関数。
 * 派生データの再計算（記録済み件数や表示制御）をここに集約。
 */
export function mapToIndividualSupportViewModel(input: MapperInput): IndividualSupportViewModel {
  const {
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
  } = input;

  // 1. スロットごとの記録状態の合成（派生データ）
  const slots = scheduleSlots.map((s) => ({
    ...s,
    isRecorded: uiState.recordedSlotIds.has(s.id),
  }));

  // 2. 記録済み件数の計算（派生データ）
  const recordedCount = scheduleSlots.filter(
    (slot) => uiState.formState[slot.id]?.mood || uiState.recordedSlotIds.has(slot.id)
  ).length;

  return {
    userCode,
    selectedUser,
    ibdUsers,
    
    activeTab: uiState.tab,
    isTemplatesLoading,
    
    slots,
    recordedCount,
    formState: uiState.formState,
    timeline: uiState.timeline,
    showOnlyUnrecorded: uiState.showOnlyUnrecorded,
    
    pdcaState,
    isPdcaLoading,
    pdcaError,
    
    monitoringDialogOpen: uiState.monitoringDialogOpen,
    activeSPS: uiState.activeSPS,
    activeSPSHistory: uiState.activeSPSHistory,
    
    snackbar: {
      open: uiState.snackbar.open,
      message: uiState.snackbar.message,
      severity: uiState.snackbar.severity,
    },
    
    templates,
  };
}
