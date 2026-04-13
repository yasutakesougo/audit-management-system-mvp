import type { SelectChangeEvent } from '@mui/material/Select';
import type { 
  TabValue, 
  ScheduleSlot, 
  SlotFormState, 
  TimelineEntry,
  ABCSelection
} from '@/features/ibd/procedures/daily-records/types';
import type { IUserMaster } from '@/features/users/types';
import type { PdcaCycleState } from '@/domain/isp/types';
import type { SupportStepTemplate } from '@/domain/support/step-templates';
import type { SupportPlanSheet, SPSHistoryEntry } from '@/features/ibd/core/ibdTypes';

/**
 * IndividualSupportManagement の ViewModel 型。
 * View が描画に必要な全てのデータと状態を保持する。
 */
export interface IndividualSupportViewModel {
  // 基本状態
  userCode: string | undefined;
  selectedUser: IUserMaster | null;
  ibdUsers: IUserMaster[];
  
  // タブ・UI状態
  activeTab: TabValue;
  isTemplatesLoading: boolean;
  
  // 実務データ
  slots: (ScheduleSlot & { isRecorded: boolean })[];
  recordedCount: number;
  formState: Record<string, SlotFormState>;
  timeline: TimelineEntry[];
  showOnlyUnrecorded: boolean;
  
  // PDCA / モニタリング
  pdcaState: PdcaCycleState | null;
  isPdcaLoading: boolean;
  pdcaError: unknown;
  monitoringDialogOpen: boolean;
  activeSPS: SupportPlanSheet | null;
  activeSPSHistory: SPSHistoryEntry[];
  
  // その他 UI
  snackbar: {
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  };
  
  // 依存データ（子コンポーネント用）
  templates: SupportStepTemplate[];
}

/**
 * 画面アクションのハンドラ定義。
 * View から Orchestrator へ委譲される操作。
 */
export interface IndividualSupportActionHandlers {
  onUserChange: (event: SelectChangeEvent) => void;
  onUserSelect: (code: string) => void;
  onTabChange: (event: React.SyntheticEvent, value: TabValue) => void;
  
  // 記録操作
  onMoodSelect: (slotId: string, mood: string) => void;
  onNoteChange: (slotId: string, value: string) => void;
  onToggleABC: (slotId: string) => void;
  onABCSelect: (slotId: string, key: keyof ABCSelection, value: string) => void;
  onRecord: (slot: ScheduleSlot) => void;
  onToggleUnrecorded: (show: boolean) => void;
  
  // モニタリング
  onOpenMonitoring: () => void;
  onCloseMonitoring: () => void;
  onReviseSPS: (
    spsId: string,
    revisedBy: number | null,
    revisionReason: string,
    changesSummary: string,
  ) => Promise<boolean>;
  
  // その他
  onCloseSnackbar: () => void;
}

export interface IndividualSupportViewProps {
  viewModel: IndividualSupportViewModel | null;
  handlers: IndividualSupportActionHandlers;
}
