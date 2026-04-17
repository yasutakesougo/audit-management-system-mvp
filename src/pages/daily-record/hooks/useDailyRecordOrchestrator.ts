import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useUsers } from '@/features/users/useUsers';
import { useSchedules } from '@/features/schedules/store';
import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import { 
  useTodayAttendanceInfo, 
  type UserData as AttendanceUserData, 
  type ScheduleData as AttendanceScheduleData 
} from '@/features/daily/hooks/legacy/useTodayAttendanceInfo';
import { useDailyRecordContextData } from '@/features/daily/hooks/legacy/useDailyRecordContextData';
import { recordCtaClick, CTA_EVENTS } from '@/features/today/telemetry/recordCtaClick';
import { toLocalDateISO } from '@/utils/getNow';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import { getNextIncompleteRecord, saveDailyRecord, validateDailyRecord } from '@/features/daily';
import { 
  mockRecords, 
  mockUsers, 
  generateTodayRecords as _generateTodayRecords, 
  createMissingRecord 
} from '../../dailyRecordMockData';

import { type DailyRecordViewModel, type DailyRecordActionHandlers } from '../types';
import { useDailyRecordUiState } from './useDailyRecordUiState';
import { mapToDailyRecordViewModel } from './dailyRecordViewModelMapper';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { mapPlanningToDailyBridge } from '@/domain/isp/dailyBridgeMapper';
import { detectPlanningDailyExceptions, summarizeTriggeredExceptions } from '@/domain/isp/exceptionDetector';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { PersonDaily } from '@/domain/daily/types';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';

/**
 * DailyRecordPage のオーケストレーター hook。
 */
export function useDailyRecordOrchestrator(): {
  viewModel: DailyRecordViewModel | null;
  handlers: DailyRecordActionHandlers;
} {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const { data: usersData } = useUsers();
  const { data: schedulesData } = useSchedules();
  
  const { state: uiState, actions: uiActions } = useDailyRecordUiState(mockRecords);

  // 1. Highlight 判定
  const navState = (location.state ?? {}) as {
    highlightUserId?: string | null;
    highlightDate?: string | null;
  };
  const highlightUserId = navState.highlightUserId ?? searchParams.get('userId');

  // ハイライト実行 (副作用)
  useEffect(() => {
    if (!highlightUserId) return;
    const timer = setTimeout(() => {
      const element = document.querySelector(`[data-person-id="${highlightUserId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        uiActions.setActiveHighlightUserId(highlightUserId);
        setTimeout(() => uiActions.setActiveHighlightUserId(null), 1500);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightUserId, uiState.records, uiActions]);

  // 2. 外部データ統合
  const { total: handoffTotal, criticalCount: handoffCritical } = useHandoffSummary({ dayScope: 'today' });
  const { repo: handoffRepo } = useHandoffData();
  const [handoffRecordsForContext, setHandoffRecordsForContext] = useState<HandoffRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadHandoffs() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) setHandoffRecordsForContext(records);
      } catch {
        if (!cancelled) setHandoffRecordsForContext([]);
      }
    }
    loadHandoffs();
    return () => { cancelled = true; };
  }, [handoffRepo]);

  const { contextData, contextUserName } = useDailyRecordContextData({
    editingRecord: uiState.editingRecord ? { userId: uiState.editingRecord.userId, userName: uiState.editingRecord.userName } : null,
    records: uiState.records,
    usersData: usersData ?? [],
    handoffRecordsForContext,
  });

  const todayAttendanceInfo = useMemo(() => {
    const raw = useTodayAttendanceInfo(
      (usersData ?? []) as unknown as AttendanceUserData[], 
      (schedulesData ?? []) as unknown as AttendanceScheduleData[], 
      uiState.records
    );
    return {
      expectedCount: raw.expectedCount,
      attendanceRate: raw.attendanceRate,
      absentUserIds: raw.absentUserIds ?? [],
    };
  }, [usersData, schedulesData, uiState.records]);

  // 3. 業務ハンドラの定義
  const handleSaveRecordWithNext = useCallback(async (record: Omit<PersonDaily, 'id'>) => {
    const validationResult = validateDailyRecord(record);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errors.join('\n'));
    }

    const updatedRecords = saveDailyRecord(uiState.records, record, uiState.editingRecord?.id);
    uiActions.setRecords(updatedRecords);

    const operation = uiState.editingRecord ? '更新' : '新規作成';
    toast.success(`日々の記録の${operation}が完了しました`);

    // 自動次レコード
    setTimeout(() => {
      const savedRecord = updatedRecords.find(r => r.userId === record.userId && r.date === record.date);
      if (savedRecord) {
        const next = getNextIncompleteRecord(updatedRecords, savedRecord.id);
        if (next) {
          uiActions.setEditingRecord(next);
          uiActions.setFormOpen(true);
        }
      }
    }, 100);
  }, [uiState.records, uiState.editingRecord, uiActions]);

  // Planning Bridge (Guidance)
  const planningRepo = usePlanningSheetRepositories();
  const [activePlan, setActivePlan] = useState<SupportPlanningSheet | null>(null);
  const targetIdForGuidance = highlightUserId || uiState.editingRecord?.userId;

  useEffect(() => {
    if (!targetIdForGuidance) {
      setActivePlan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const items = await planningRepo.listCurrentByUser(targetIdForGuidance);
        if (cancelled) return;
        if (items.length > 0) {
          const sheet = await planningRepo.getById(items[0].id);
          if (!cancelled) setActivePlan(sheet);
        } else {
          setActivePlan(null);
        }
      } catch (err) {
        console.warn('[DailyOrchestrator] Failed to fetch active plan for bridge:', err);
        if (!cancelled) setActivePlan(null);
      }
    })();
    return () => { cancelled = true; };
  }, [targetIdForGuidance, planningRepo]);

  const guidanceBundle = useMemo(() => {
    return activePlan ? mapPlanningToDailyBridge(activePlan) : null;
  }, [activePlan]);

  const activeRecordForGuidance = useMemo(() => {
    if (!targetIdForGuidance) return null;
    const today = toLocalDateISO();
    return uiState.records.find(r => r.userId === targetIdForGuidance && r.date === today) || null;
  }, [targetIdForGuidance, uiState.records]);

  const triggeredExceptions = useMemo(() => {
    if (!guidanceBundle) return [];
    return detectPlanningDailyExceptions(guidanceBundle, activeRecordForGuidance);
  }, [guidanceBundle, activeRecordForGuidance]);

  const exceptionSummary = useMemo(() => summarizeTriggeredExceptions(triggeredExceptions), [triggeredExceptions]);

  const handlers: DailyRecordActionHandlers = {
    onSearchChange: uiActions.setSearchQuery,
    onStatusFilterChange: uiActions.setStatusFilter,
    onDateFilterChange: uiActions.setDateFilter,
    onClearFilters: () => {
      uiActions.setSearchQuery('');
      uiActions.setStatusFilter('all');
      uiActions.setDateFilter('');
    },
    
    onOpenForm: () => {
      uiActions.setEditingRecord(undefined);
      uiActions.setFormOpen(true);
    },
    onEditRecord: (record) => {
      uiActions.setEditingRecord(record);
      uiActions.setFormOpen(true);
    },
    onCloseForm: () => {
      uiActions.setFormOpen(false);
      uiActions.setEditingRecord(undefined);
    },
    onSaveRecord: handleSaveRecordWithNext,
    onDeleteRecord: (id) => {
      uiActions.removeRecord(id);
      toast.success('削除しました');
    },
    onOpenAttendance: (userId) => navigate(`/daily/attendance?userId=${userId}&date=${toLocalDateISO()}`),
    
    onGenerateTodayRecords: () => {
      uiActions.setRecords(_generateTodayRecords());
      toast.success('本日分を作成しました');
    },
    onBulkCreateMissing: () => {
      const today = toLocalDateISO();
      const existingIds = uiState.records.filter(r => r.date === today).map(r => r.userId);
      const missing = mockUsers.filter((_name: string, i: number) => !existingIds.includes(String(i+1).padStart(3, '0')));
      if (missing.length === 0) {
        toast('全員作成済みです');
        return;
      }
      const newRecords = missing.map((name: string, i: number) => {
        const globalIndex = mockUsers.indexOf(name);
        return createMissingRecord(name, String(globalIndex+1).padStart(3, '0'), today, i);
      });
      uiActions.setRecords([...uiState.records, ...newRecords]);
      toast.success(`${missing.length}名分を追加しました`);
    },
    onBulkComplete: () => {
      const today = toLocalDateISO();
      let count = 0;
      const updated = uiState.records.map(r => {
        if (r.date === today && r.status === '未作成') {
          count++;
          return { ...r, status: '完了' as const, draft: { isDraft: false } };
        }
        return r;
      });
      uiActions.setRecords(updated);
      toast.success(`${count}件を一括完了しました`);
    },
    
    onHeroStartRecord: (record) => {
      recordCtaClick({ ctaId: CTA_EVENTS.DAILY_HERO_CLICKED, sourceComponent: 'NextRecordHero', stateType: 'widget-action', scene: record.status });
      uiActions.setEditingRecord(record);
      uiActions.setFormOpen(true);
    },
    onQueueStartRecord: (record) => {
      recordCtaClick({ ctaId: CTA_EVENTS.DAILY_QUEUE_ITEM_CLICKED, sourceComponent: 'RecordActionQueue', stateType: 'widget-action', scene: record.status });
      uiActions.setEditingRecord(record);
      uiActions.setFormOpen(true);
    },
    onCompletedToggle: (expanded) => {
      recordCtaClick({ ctaId: CTA_EVENTS.DAILY_QUEUE_COMPLETED_TOGGLED, sourceComponent: 'RecordActionQueue', stateType: 'widget-action', scene: expanded ? 'expanded' : 'collapsed' });
    },
    onAllCompletedAction: () => {
      recordCtaClick({ ctaId: CTA_EVENTS.DAILY_HERO_ALL_COMPLETED, sourceComponent: 'NextRecordHero', stateType: 'navigation', targetUrl: '/handoff/timeline' });
      navigate(buildHandoffTimelineUrl(), { state: { dayScope: 'today', timeFilter: 'all' } });
    },
    onNavigateToTimeline: () => navigate(buildHandoffTimelineUrl(), { state: { dayScope: 'today', timeFilter: 'all' } }),
    onBack: () => navigate('/daily/menu'),
    
    onToggleContext: () => uiActions.setContextOpen(!uiState.contextOpen),
    onCloseContext: () => uiActions.setContextOpen(false),
  };

  // 4. ViewModel 合成
  const viewModel = useMemo(() => mapToDailyRecordViewModel({
    uiState,
    todayAttendanceInfo,
    handoffSummary: { total: handoffTotal, criticalCount: handoffCritical },
    contextData,
    contextUserName,
    guidanceBundle,
    triggeredExceptions,
    exceptionSummary,
  }), [uiState, todayAttendanceInfo, handoffTotal, handoffCritical, contextData, contextUserName, guidanceBundle, triggeredExceptions, exceptionSummary]);

  return { viewModel, handlers };
}
