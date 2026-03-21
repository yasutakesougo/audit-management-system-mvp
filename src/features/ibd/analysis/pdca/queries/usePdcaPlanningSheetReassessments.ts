import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import type { PlanningSheetReassessment } from '@/domain/isp/planningSheetReassessment';
import { useEffect, useState } from 'react';

import { usePlanningSheetReassessmentRepository } from './usePlanningSheetReassessmentRepository';

export interface UsePdcaPlanningSheetReassessmentsRepositories {
  planningSheetReassessmentRepository?: PlanningSheetReassessmentRepository;
}

export interface UsePdcaPlanningSheetReassessmentsParams {
  planningSheetId?: string | null;
  repositories?: UsePdcaPlanningSheetReassessmentsRepositories;
}

export interface UsePdcaPlanningSheetReassessmentsResult {
  data: PlanningSheetReassessment[];
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
}

export function usePdcaPlanningSheetReassessments(
  params: UsePdcaPlanningSheetReassessmentsParams,
): UsePdcaPlanningSheetReassessmentsResult {
  const { planningSheetId, repositories } = params;

  const defaultRepository = usePlanningSheetReassessmentRepository();
  const repository =
    repositories?.planningSheetReassessmentRepository ?? defaultRepository;

  const [data, setData] = useState<PlanningSheetReassessment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!planningSheetId) {
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
        const rows = await repository.findByPlanningSheetId({
          planningSheetId,
        });

        if (cancelled) return;
        setData(rows);
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
  }, [planningSheetId, repository]);

  return {
    data,
    isLoading,
    error,
    isEmpty: !isLoading && !error && data.length === 0,
  };
}
