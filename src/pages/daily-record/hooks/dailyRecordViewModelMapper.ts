import { toLocalDateISO } from '@/utils/getNow';
import type { DailyRecordViewModel } from '../types';
import type { DailyRecordUiState } from './useDailyRecordUiState';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import type { TriggeredException, ExceptionSummary } from '@/domain/isp/exceptionBridge';
import type { DailyGuidanceBundle } from '@/domain/isp/dailyBridge';

export interface MapperInput {
  uiState: DailyRecordUiState;
  
  // 現場ガイダンス (Planning Bridge)
  guidanceBundle?: DailyGuidanceBundle | null;
  
  // 現場例外 (Exception Bridge)
  triggeredExceptions?: TriggeredException[];
  exceptionSummary?: ExceptionSummary;
  
  // 外部データ
  todayAttendanceInfo: {
    expectedCount: number;
    attendanceRate: number;
    absentUserIds: string[];
  };
  handoffSummary: {
    total: number;
    criticalCount: number;
  };
  contextData: ContextPanelData;
  contextUserName: string;
}

/**
 * DailyRecordPage の ViewModel を構築する純粋関数。
 * フィルタリング、統計計算、UI状態の合成を担当。
 */
export function mapToDailyRecordViewModel(input: MapperInput): DailyRecordViewModel {
  const {
    uiState,
    todayAttendanceInfo,
    handoffSummary,
    contextData,
    contextUserName,
  } = input;

  const {
    records,
    searchQuery,
    statusFilter,
    dateFilter,
  } = uiState;

  // 1. フィルタリング (派生データ)
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !searchQuery ||
      record.userName.includes(searchQuery) ||
      record.userId.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesDate = !dateFilter || record.date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  // 2. 今日のレコード (Hero/Queue 用)
  const todayStr = toLocalDateISO();
  const todayRecords = records.filter((r) => r.date === todayStr);

  // 3. 完了統計
  const totalCount = todayRecords.length;
  const completedCount = todayRecords.filter(r => r.status === '完了').length;
  const inProgressCount = todayRecords.filter(r => r.status === '作成中').length;
  const notStartedCount = todayRecords.filter(r => r.status === '未作成').length;

  return {
    records,
    filteredRecords,
    todayRecords,
    
    stats: {
      ...todayAttendanceInfo,
      totalCount,
      completedCount,
      inProgressCount,
      notStartedCount,
    },
    
    searchQuery,
    statusFilter,
    dateFilter,
    
    formOpen: uiState.formOpen,
    editingRecord: uiState.editingRecord,
    contextOpen: uiState.contextOpen,
    contextUserName,
    contextData,
    activeHighlightUserId: uiState.activeHighlightUserId,
    
    handoffSummary: {
      total: handoffSummary.total,
      critical: handoffSummary.criticalCount,
    },
    
    guidanceBundle: input.guidanceBundle,
    triggeredExceptions: input.triggeredExceptions,
    exceptionSummary: input.exceptionSummary,
  };
}
