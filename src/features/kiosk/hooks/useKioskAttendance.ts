import { useState, useEffect } from 'react';
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

export function useKioskAttendance(
  userId: string | undefined,
  selectedDateIso: string,
  userCandidates: string[],
  refreshTrigger?: number
): KioskAbsenceState {
  const [state, setState] = useState<KioskAbsenceState>({
    isAbsent: false,
    isLoading: true,
    isError: false,
  });

  const repository = useAttendanceRepository();

  useEffect(() => {
    if (!userId || !selectedDateIso || userCandidates.length === 0) {
      setState({ isAbsent: false, isLoading: false, isError: false });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, isLoading: true, isError: false }));

    const fetchAttendance = async () => {
      try {
        const dailyItems = await repository.getDailyByDate({ recordDate: selectedDateIso });
        if (!active) return;

        // 候補ユーザーID群のいずれかに合致するレコードを検索
        const candidatesUpper = userCandidates.map((c) => c.trim().toUpperCase());
        const userDailyRecord = dailyItems.find((item) => {
          const itemUserUpper = String(item.UserCode ?? '').trim().toUpperCase();
          return candidatesUpper.includes(itemUserUpper);
        });

        if (userDailyRecord) {
          const normalized = normalizeAttendanceStatus(userDailyRecord.Status);
          const isAbsent = isAbsentStatus(normalized);
          setState({
            isAbsent,
            reason: userDailyRecord.AbsentReason || userDailyRecord.EveningNote || undefined,
            isLoading: false,
            isError: false,
          });
        } else {
          // レコードが存在しない場合は「欠席していない（未）」として扱う
          setState({
            isAbsent: false,
            isLoading: false,
            isError: false,
          });
        }
      } catch (error) {
        console.error('[useKioskAttendance] Failed to fetch daily attendance:', error);
        if (active) {
          setState({
            isAbsent: false,
            isLoading: false,
            isError: true,
          });
        }
      }
    };

    void fetchAttendance();

    return () => {
      active = false;
    };
  }, [userId, selectedDateIso, userCandidates, repository, refreshTrigger]);

  return state;
}
