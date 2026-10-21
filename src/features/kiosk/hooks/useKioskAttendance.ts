import { useState, useEffect, useRef } from 'react';
import { useAttendanceRepository } from '@/features/attendance/repositoryFactory';

export function normalizeAttendanceStatus(status: unknown): string {
  if (!status) return '';
  if (typeof status === 'string') return status.trim();
  if (typeof status === 'object' && status !== null) {
    const obj = status as Record<string, unknown>;
    const val = obj.Value ?? obj.value ?? obj.label ?? obj.Title ?? obj.title;
    if (typeof val === 'string') return val.trim();
  }
  return String(status).trim();
}

export function isAbsentStatus(normalizedStatus: string): boolean {
  const s = normalizedStatus.toLowerCase();
  return s === '当日欠席' || s === '欠席' || s === 'absent';
}

export type KioskAbsenceState = {
  isAbsent: boolean;
  reason?: string;
  isLoading: boolean;
  isError: boolean;
};

type AttendanceResult = Pick<KioskAbsenceState, 'isAbsent' | 'reason'>;
type AttendanceOwnedState = {
  targetKey: string | null;
  repository: ReturnType<typeof useAttendanceRepository> | null;
  generation: number;
  refreshTrigger: number | undefined;
  refreshGeneration: number;
  requestSequence: number;
  phase: 'unresolved' | 'loading' | 'success' | 'error';
  result: AttendanceResult;
  lastSuccess?: AttendanceResult;
};

export function useKioskAttendance(
  userId: string | undefined,
  selectedDateIso: string,
  userCandidates: string[],
  refreshTrigger?: number
): KioskAbsenceState {
  const repository = useAttendanceRepository();
  // Membership is case-insensitive; input array identity and order are not a target.
  const candidates = Array.from(new Set(
    userCandidates.map((candidate) => candidate.trim().toUpperCase()).filter(Boolean),
  )).sort();
  const normalizedUserId = String(userId ?? '').trim();
  const targetKey = normalizedUserId && selectedDateIso.trim() && candidates.length > 0
    ? JSON.stringify([normalizedUserId, selectedDateIso, candidates])
    : null;
  const targetRepository = targetKey === null ? null : repository;
  const [state, setState] = useState<AttendanceOwnedState>(() => ({
    targetKey,
    repository: targetRepository,
    generation: 0,
    refreshTrigger,
    refreshGeneration: 0,
    requestSequence: 0,
    phase: targetKey === null ? 'unresolved' : 'loading',
    result: { isAbsent: false, reason: undefined },
  }));
  const requestSequenceRef = useRef(0);

  // Adjust only this component's state on a semantic transition. Return the new
  // view immediately too: an effect-time reset would expose the previous owner.
  let current = state;
  if (state.targetKey !== targetKey || state.repository !== targetRepository) {
    current = {
      targetKey,
      repository: targetRepository,
      generation: state.generation + 1,
      refreshTrigger,
      refreshGeneration: 0,
      requestSequence: 0,
      phase: targetKey === null ? 'unresolved' : 'loading',
      result: { isAbsent: false, reason: undefined },
    };
    setState(current);
  } else if (targetKey !== null && !Object.is(state.refreshTrigger, refreshTrigger)) {
    current = {
      ...state,
      refreshTrigger,
      refreshGeneration: state.refreshGeneration + 1,
      requestSequence: 0,
      phase: 'loading',
      result: state.lastSuccess ?? { isAbsent: false, reason: undefined },
    };
    setState(current);
  }
  const { generation, refreshGeneration } = current;

  useEffect(() => {
    if (targetKey === null || targetRepository === null) return;

    let active = true;
    const sequence = ++requestSequenceRef.current;
    const ownsTarget = (value: AttendanceOwnedState) =>
      value.targetKey === targetKey
      && value.repository === targetRepository
      && value.generation === generation
      && value.refreshGeneration === refreshGeneration;
    setState((prev) => ownsTarget(prev) && prev.requestSequence !== sequence
      ? { ...prev, requestSequence: sequence }
      : prev);
    const [, recordDate, candidatesUpper] = JSON.parse(targetKey) as [string, string, string[]];

    const fetchAttendance = async () => {
      try {
        const dailyItems = await targetRepository.getDailyByDate({ recordDate });
        if (!active || sequence !== requestSequenceRef.current) return;

        // 候補ユーザーID群のいずれかに合致するレコードを検索
        const userDailyRecord = dailyItems.find((item) => {
          const itemUserUpper = String(item.UserCode ?? '').trim().toUpperCase();
          return candidatesUpper.includes(itemUserUpper);
        });

        let result: AttendanceResult = { isAbsent: false, reason: undefined };
        if (userDailyRecord) {
          const normalized = normalizeAttendanceStatus(userDailyRecord.Status);
          const isAbsent = isAbsentStatus(normalized);
          const reasonParts = [
            userDailyRecord.AbsentReason,
            userDailyRecord.AbsentSupportContent || userDailyRecord.EveningNote
          ].filter(Boolean);
          result = {
            isAbsent,
            reason: reasonParts.length > 0 ? reasonParts.join(' - ') : undefined,
          };
        }
        setState((prev) => ownsTarget(prev) && prev.requestSequence === sequence
          ? { ...prev, phase: 'success', result, lastSuccess: result }
          : prev);
      } catch (error) {
        if (!active || sequence !== requestSequenceRef.current) return;
        console.error('[useKioskAttendance] Failed to fetch daily attendance:', error);
        setState((prev) => ownsTarget(prev) && prev.requestSequence === sequence
          ? { ...prev, phase: 'error', result: { isAbsent: false, reason: undefined } }
          : prev);
      }
    };

    void fetchAttendance();

    return () => {
      active = false;
    };
  }, [targetKey, targetRepository, generation, refreshGeneration]);

  return {
    ...current.result,
    isLoading: current.phase === 'loading',
    isError: current.phase === 'error',
  };
}
