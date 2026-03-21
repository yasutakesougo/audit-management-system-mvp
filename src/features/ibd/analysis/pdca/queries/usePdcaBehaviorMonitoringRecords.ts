import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';
import { useEffect, useState } from 'react';

import { useBehaviorMonitoringRepository } from './useBehaviorMonitoringRepository';

export interface UsePdcaBehaviorMonitoringRecordsRepositories {
  behaviorMonitoringRepository?: BehaviorMonitoringRepository;
}

export interface UsePdcaBehaviorMonitoringRecordsParams {
  userCode: string | null | undefined;
  supervisionUserId: number | null | undefined;
  planningSheetId?: string | null;
  repositories?: UsePdcaBehaviorMonitoringRecordsRepositories;
}

export interface UsePdcaBehaviorMonitoringRecordsResult {
  data: BehaviorMonitoringRecord[];
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
}

export function usePdcaBehaviorMonitoringRecords(
  params: UsePdcaBehaviorMonitoringRecordsParams,
): UsePdcaBehaviorMonitoringRecordsResult {
  const {
    userCode,
    supervisionUserId,
    planningSheetId,
    repositories,
  } = params;

  // NOTE: API 後方互換のため残す（現行の正式取得は userCode + planningSheetId を利用）。
  void supervisionUserId;

  const defaultRepository = useBehaviorMonitoringRepository();
  const repository =
    repositories?.behaviorMonitoringRepository ?? defaultRepository;

  const [data, setData] = useState<BehaviorMonitoringRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userCode || !planningSheetId) {
      setData([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const records = await repository.findByPlanningSheetId({
          planningSheetId,
          userId: userCode,
        });

        if (cancelled) return;
        setData(records);
      } catch (fetchError) {
        if (cancelled) return;
        const normalized =
          fetchError instanceof Error
            ? fetchError
            : new Error(String(fetchError));
        setError(normalized);
        setData([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planningSheetId, repository, userCode]);

  return {
    data,
    isLoading,
    error,
    isEmpty: !isLoading && !error && data.length === 0,
  };
}
