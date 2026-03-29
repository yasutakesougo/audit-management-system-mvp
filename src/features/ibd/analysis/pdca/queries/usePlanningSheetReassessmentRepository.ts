import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderPlanningSheetReassessmentRepository } from '@/data/isp/infra/DataProviderPlanningSheetReassessmentRepository';
import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';

export function usePlanningSheetReassessmentRepository(): PlanningSheetReassessmentRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderPlanningSheetReassessmentRepository(provider),
    [provider],
  );
}
