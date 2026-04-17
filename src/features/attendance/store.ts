import { useAttendanceRepository } from './repositoryFactory';
import { toLocalDateISO } from '@/utils/getNow';
import { useCallback, useEffect, useState } from 'react';
import { generateDemoTemperature } from './infra/demoDataGenerator';
import type { TransportMethod } from './transportMethod';

export type AttendanceVisitSnapshot = {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
  /** 検温値 (℃) — 37.5以上で発熱アラート */
  temperature?: number;
  /** 欠席者の朝連絡受け入れ完了フラグ */
  morningContacted?: boolean;
  /** 欠席者の夕方フォロー完了フラグ */
  eveningChecked?: boolean;
  /** 行き送迎手段（SS / 一時ケア / その他） */
  transportToMethod?: TransportMethod;
  /** 帰り送迎手段 */
  transportFromMethod?: TransportMethod;
};

type AttendanceStoreState = {
  visits: Record<string, AttendanceVisitSnapshot>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/**
 * Root Hook: useAttendanceStore
 * 
 * Bridges the attendance UI with the AttendanceRepository.
 * Maps repository domain items to the UI-friendly AttendanceVisitSnapshot.
 */
export const useAttendanceStore = (): AttendanceStoreState => {
  const repository = useAttendanceRepository();
  const [visits, setVisits] = useState<Record<string, AttendanceVisitSnapshot>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const today = toLocalDateISO();
      const records = await repository.getDailyByDate({ recordDate: today });
      
      const nextVisits: Record<string, AttendanceVisitSnapshot> = {};
      records.forEach((rec, index) => {
        nextVisits[rec.UserCode] = {
          userCode: rec.UserCode,
          status: rec.Status,
          providedMinutes: rec.ProvidedMinutes ?? undefined,
          isEarlyLeave: rec.IsEarlyLeave,
          // Temperature is currently synthetic/inferred as it often comes from a separate list
          // but we keep the demo generator here for the UI alert demonstration.
          temperature: generateDemoTemperature(index),
          morningContacted: rec.AbsentMorningContacted,
          eveningChecked: rec.EveningChecked,
          transportToMethod: rec.TransportToMethod,
          transportFromMethod: rec.TransportFromMethod,
        };
      });
      setVisits(nextVisits);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  return {
    visits,
    loading,
    error,
    refresh: fetchAttendance,
  };
};
