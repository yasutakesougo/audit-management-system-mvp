import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type { RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import type { ABCRecord } from '@/domain/behavior';
import { getScheduleKey } from '@/features/daily';
import type { BehaviorRepository, ProcedureRepository } from '@/features/daily';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    handleSelectStep,
    handleAfterSubmit,
  } as const;
}
