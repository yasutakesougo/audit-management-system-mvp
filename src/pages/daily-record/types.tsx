import { PersonDaily } from '@/domain/daily/types';
import type { DailyGuidanceBundle } from '@/domain/isp/dailyBridge';
import type { TriggeredException, ExceptionSummary } from '@/domain/isp/exceptionBridge';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';

/**
 * DailyRecordPage の ViewModel。
 * 統計情報、フィルタ済みリスト、表示フラグなど描画に必要なデータを集約。
 */
export interface DailyRecordViewModel {
  // 基本データ
  records: PersonDaily[];
  filteredRecords: PersonDaily[];
  todayRecords: PersonDaily[];
  
  // 統計・インジケータ
  stats: {
    expectedCount: number;
    attendanceRate: number;
    absentUserIds: string[];
    totalCount: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };
  
  // フィルタ・検索
  searchQuery: string;
  statusFilter: string;
  dateFilter: string;
  
  // UI 状態
  formOpen: boolean;
  editingRecord?: PersonDaily;
  contextOpen: boolean;
  contextUserName: string;
  contextData: ContextPanelData;
  activeHighlightUserId: string | null;
  
  // 現場ガイダンス (Planning Bridge)
  guidanceBundle?: DailyGuidanceBundle | null;
  
  // 現場例外 (Exception Bridge)
  triggeredExceptions?: TriggeredException[];
  exceptionSummary?: ExceptionSummary;
  
  // Handoff 情報
  handoffSummary: {
    total: number;
    critical: number;
  };
}

/**
 * 画面アクションのハンドラ定義 (Orchestrator へ委譲)。
 */
export interface DailyRecordActionHandlers {
  // フィルタ・検索
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
  onDateFilterChange: (date: string) => void;
  onClearFilters: () => void;
  
  // レコード操作
  onOpenForm: () => void;
  onEditRecord: (record: PersonDaily) => void;
  onCloseForm: () => void;
  onSaveRecord: (record: Omit<PersonDaily, 'id'>) => Promise<void>;
  onDeleteRecord: (id: string) => void;
  onOpenAttendance: (userId: string) => void;
  
  // 一括操作
  onGenerateTodayRecords: () => void;
  onBulkCreateMissing: () => void;
  onBulkComplete: () => void;
  
  // ナビゲーション・テレメトリ
  onHeroStartRecord: (record: PersonDaily) => void;
  onQueueStartRecord: (record: PersonDaily) => void;
  onCompletedToggle: (expanded: boolean) => void;
  onAllCompletedAction: () => void;
  onNavigateToTimeline: () => void;
  onBack: () => void;
  
  // コンテキスト
  onToggleContext: () => void;
  onCloseContext: () => void;
}

export interface DailyRecordViewProps {
  viewModel: DailyRecordViewModel | null;
  handlers: DailyRecordActionHandlers;
}
