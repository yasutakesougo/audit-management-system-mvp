import { useState, useEffect } from 'react';
import { useExecutionStore } from '../../daily/stores/executionStore';
import { localWeeklyObservationRepository } from '@/infra/localStorage/localStaffQualificationRepository';
import { buildReverseBridgeSuggestions, type ReverseBridgeSuggestion } from '../reverseBridge';
import type { ExecutionRecord } from '../../daily/domain/executionRecordTypes';

export function useReverseBridge(userId?: string, supportStartDate?: string) {
  const [suggestions, setSuggestions] = useState<ReverseBridgeSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { getRecords } = useExecutionStore();

  useEffect(() => {
    if (!userId) {
      setSuggestions(null);
      return;
    }

    const activeUserId = userId;
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        // 集計期間を決定 (基本は過去90日間、supportStartDateがある場合はそこから今日まで)
        const today = new Date();
        const start = supportStartDate 
          ? new Date(supportStartDate) 
          : new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        
        // 安全のため未来日になっていた場合は過去90日間にフォールバック
        const normalizedStart = start > today 
          ? new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) 
          : start;

        // 日次記録をループで収集 (Zustandストア内のため瞬時に同期解決可能)
        const records: ExecutionRecord[] = [];
        const current = new Date(normalizedStart);
        
        let safetyCounter = 0;
        while (current <= today && safetyCounter < 180) {
          const dateStr = current.toISOString().slice(0, 10);
          const dailyRecords = getRecords(dateStr, activeUserId);
          records.push(...dailyRecords);
          current.setDate(current.getDate() + 1);
          safetyCounter++;
        }

        // 週次観察（L3）を取得
        const observations = await localWeeklyObservationRepository.listByUser(activeUserId);
        
        // 対象期間内の観察記録にフィルタリング
        const startStr = normalizedStart.toISOString().slice(0, 10);
        const todayStr = today.toISOString().slice(0, 10);
        const rangeObservations = observations.filter(
          (o) => o.observationDate >= startStr && o.observationDate <= todayStr
        );

        if (isMounted) {
          const result = buildReverseBridgeSuggestions({
            periodStart: startStr,
            periodEnd: todayStr,
            executionRecords: records,
            weeklyObservations: rangeObservations,
          });
          setSuggestions(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [userId, supportStartDate, getRecords]);

  return { suggestions, isLoading, error };
}
export type { ReverseBridgeSuggestion };
export { buildReverseBridgeSuggestions };
