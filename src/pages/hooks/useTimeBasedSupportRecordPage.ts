import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type { RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import type { ABCRecord } from '@/domain/behavior';
import { getScheduleKey } from '@/features/daily';
import type { BehaviorRepository, ProcedureRepository } from '@/features/daily';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  getSelectableState, 
  getHiddenOrdersBySelection 
} from '@/features/planning-sheet/logic/procedureLogic';

// スロットを一意に特定するためのキー生成ヘルパー
const getItemScheduleKey = (item: ScheduleItem) => getScheduleKey(item.time, item.activity);

type UseTimeBasedSupportRecordPageArgs = {
  procedureRepo: ProcedureRepository;
  behaviorRepo: BehaviorRepository;
  behaviorRecords: ABCRecord[];
  initialUserId?: string;
  initialStepKey?: string;
  initialUnfilledOnly?: boolean;
  storageKey?: string;
  /** 手順（TimeBasedSupportRecordPage から渡される優先スケジュール） */
  overrideSchedule?: ScheduleItem[];
};

const DEFAULT_UNFILLED_STORAGE_KEY = 'daily-support-unfilled-only';

export function useTimeBasedSupportRecordPage({
  procedureRepo,
  behaviorRepo,
  behaviorRecords,
  initialUserId = '',
  initialStepKey,
  initialUnfilledOnly,
  storageKey = DEFAULT_UNFILLED_STORAGE_KEY,
  overrideSchedule,
}: UseTimeBasedSupportRecordPageArgs) {
  const [targetUserId, setTargetUserId] = useState(initialUserId);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [scrollToStepId, setScrollToStepId] = useState<string | null>(null);
  const didApplyInitialStepRef = useRef(false);
  const [showUnfilledOnly, setShowUnfilledOnly] = useState(() => {
    if (initialUnfilledOnly !== undefined) return initialUnfilledOnly;
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(storageKey) === '1';
  });
  const skipAutoSelectRef = useRef(false);

  const schedule = useMemo(() => {
    if (overrideSchedule && overrideSchedule.length > 0) return overrideSchedule;
    if (!targetUserId) return [];
    return procedureRepo.getByUser(targetUserId) as ScheduleItem[];
  }, [overrideSchedule, procedureRepo, targetUserId]);
  const recentObservations = useMemo(
    () => behaviorRecords.filter((behavior) => behavior.userId === targetUserId),
    [behaviorRecords, targetUserId],
  );
  const scheduleKeys = useMemo(() => schedule.map((item) => getScheduleKey(item.time, item.activity)), [schedule]);
  const filledStepIds = useMemo(() => {
    if (!schedule.length || recentObservations.length === 0) return new Set<string>();
    const filled = new Set<string>();
    recentObservations.forEach((observation) => {
      if (observation.planSlotKey) {
        filled.add(observation.planSlotKey);
        return;
      }
      if (observation.timeSlot) {
        filled.add(getScheduleKey(observation.timeSlot, observation.plannedActivity ?? ''));
      }
    });
    return filled;
  }, [schedule, recentObservations]);
  const unfilledStepIds = useMemo(
    () => scheduleKeys.filter((key) => !filledStepIds.has(key)),
    [filledStepIds, scheduleKeys],
  );
  const totalSteps = scheduleKeys.length;
  const unfilledStepsCount = unfilledStepIds.length;

  /**
   * 現在記録済みの手順の行番号（order）の集合
   */
  const filledStepOrders = useMemo(() => {
    const result = new Set<number>();
    recentObservations.forEach((observation) => {
      // observation.planSlotKey から対応する scheduleItem を特定
      const item = schedule.find((s) => getScheduleKey(s.time, s.activity) === observation.planSlotKey);
      if (item?.sourceStepOrder) {
        result.add(item.sourceStepOrder);
      }
    });
    return result;
  }, [recentObservations, schedule]);

  /**
   * スロットごとの選択可否状態（競合の有無）
   */
  const selectableStateByStepId = useMemo(() => {
    const result = new Map<string, { conflicted: boolean; blockingOrders: number[] }>();
    schedule.forEach((item) => {
      const key = getScheduleKey(item.time, item.activity);
      if (item.sourceStepOrder) {
        result.set(key, getSelectableState(item.sourceStepOrder, filledStepOrders));
      }
    });
    return result;
  }, [schedule, filledStepOrders]);

  // 現在の「実質的な」選択状況（保存済み + 今選んでいるもの）
  const effectiveSelectedOrders = useMemo(() => {
    const orders = new Set(filledStepOrders);
    
    // 現在選択中のものも「仮の選択」として含めると、画面が即応する
    if (selectedStepId) {
      const item = schedule.find(s => getItemScheduleKey(s) === selectedStepId);
      const order = item?.sourceStepOrder;
      if (order != null) {
        orders.add(order);
      }
    }
    
    return orders;
  }, [filledStepOrders, selectedStepId, schedule]);

  // 非表示にすべき行番号
  const hiddenStepOrders = useMemo(() => {
    return new Set(getHiddenOrdersBySelection(effectiveSelectedOrders));
  }, [effectiveSelectedOrders]);


  /**
   * 保存前の競合確認（ガードレール）
   * @returns 保存を続行して良い場合は true, キャンセルされた場合は false
   */
  const verifySaveConflict = useCallback(async () => {
    // 1. 直近の競合（親と子が両方入力されている等）を収集
    const conflictEntries = Array.from(selectableStateByStepId.entries())
      .filter(([_, state]) => state.conflicted)
      .map(([id, state]) => ({ id, blocking: state.blockingOrders }));

    // 2. 「本来不要なはずの行（非表示行）」に記録が残っているものを収集
    // 行番号(order)で判定
    const filledHiddenOrders = Array.from(hiddenStepOrders).filter(order => 
      filledStepOrders.has(order)
    );

    if (conflictEntries.length === 0 && filledHiddenOrders.length === 0) return true;

    let message = '【保存前の最終確認】\n';
    message += '========================\n';
    
    if (conflictEntries.length > 0) {
      message += '● 通常活動と外活動オプションが重複しています\n';
      conflictEntries.forEach(entry => {
        // 現在の選択アイテムから rowNo を取得
        const item = schedule.find(s => getItemScheduleKey(s) === entry.id);
        const myOrder = item?.procedureStep?.sourceStepOrder;
        message += `   → 行${myOrder} と 行${entry.blocking.join(', ')}\n`;
      });
      message += '\n';
    }

    if (filledHiddenOrders.length > 0) {
      message += '● 現在のルートでは不要な手順に記録が残っています\n';
      message += `   → 対象行: ${filledHiddenOrders.sort((a, b) => a - b).join(', ')}\n`;
      message += '\n';
    }

    message += '========================\n';
    message += 'このまま保存してよろしいですか？\n';
    message += '（修正する場合は「キャンセル」を押して戻ってください）';

    return window.confirm(message);
  }, [selectableStateByStepId, hiddenStepOrders, filledStepOrders, schedule]);

  const recordLockState = useMemo<RecordPanelLockState>(() => {

    if (!targetUserId) return 'no-user';
    return 'unlocked';
  }, [targetUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(storageKey, showUnfilledOnly ? '1' : '0');
  }, [showUnfilledOnly, storageKey]);

  useEffect(() => {
    if (!targetUserId) return;
    void behaviorRepo.fetchByUser(targetUserId);
  }, [behaviorRepo, targetUserId]);

  useEffect(() => {
    if (!schedule.length) {
      setSelectedStepId(null);
      return;
    }
    if (selectedStepId && !scheduleKeys.includes(selectedStepId)) {
      setSelectedStepId(null);
    }
  }, [schedule, scheduleKeys, selectedStepId]);

  useEffect(() => {
    if (!initialStepKey) return;
    if (didApplyInitialStepRef.current) return;
    didApplyInitialStepRef.current = true;
    setSelectedStepId(initialStepKey);
    setScrollToStepId(initialStepKey);
  }, [initialStepKey]);

  useEffect(() => {
    if (!showUnfilledOnly) return;
    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }
    const nextTarget = unfilledStepIds[0] ?? null;
    if (!nextTarget) return;
    if (selectedStepId === nextTarget && scrollToStepId === nextTarget) return;
    if (!selectedStepId || filledStepIds.has(selectedStepId)) {
      setSelectedStepId(nextTarget);
      setScrollToStepId(nextTarget);
    }
  }, [filledStepIds, scrollToStepId, selectedStepId, showUnfilledOnly, unfilledStepIds]);

  const handleUserChange = useCallback((userId: string) => {
    setTargetUserId(userId);
    setIsAcknowledged(false);
    setSelectedStepId(null);
    setScrollToStepId(null);
    didApplyInitialStepRef.current = false;
  }, []);

  const handleSelectStep = useCallback((stepId: string) => {
    skipAutoSelectRef.current = true;
    setSelectedStepId(stepId);
    setScrollToStepId(stepId);
  }, []);

  const handleAfterSubmit = useCallback((currentStepId: string | null) => {
    const sourceId = currentStepId ?? selectedStepId;
    if (!sourceId) return;
    const currentIndex = scheduleKeys.indexOf(sourceId);
    if (currentIndex < 0) return;

    // Always advance to next unfilled slot (skip already-filled ones)
    let nextId: string | null = null;
    for (let i = currentIndex + 1; i < scheduleKeys.length; i += 1) {
      const candidate = scheduleKeys[i];
      if (!filledStepIds.has(candidate)) {
        nextId = candidate;
        break;
      }
    }
    // If no unfilled after current, wrap around from beginning
    if (!nextId) {
      for (let i = 0; i < currentIndex; i += 1) {
        const candidate = scheduleKeys[i];
        if (!filledStepIds.has(candidate)) {
          nextId = candidate;
          break;
        }
      }
    }
    // All filled — stay on current
    if (!nextId) nextId = sourceId;

    setSelectedStepId(nextId);
    setScrollToStepId(nextId);
  }, [filledStepIds, scheduleKeys, selectedStepId]);

  return {
    targetUserId,
    setTargetUserId,
    handleUserChange,
    schedule,
    filledStepIds,
    recentObservations,
    isAcknowledged,
    setIsAcknowledged,
    selectedStepId,
    setSelectedStepId,
    scrollToStepId,
    showUnfilledOnly,
    setShowUnfilledOnly,
    recordLockState,
    totalSteps,
    unfilledStepsCount,
    selectableStateByStepId,
    hiddenStepOrders,
    handleSelectStep,
    handleAfterSubmit,
    verifySaveConflict,
  } as const;



}
