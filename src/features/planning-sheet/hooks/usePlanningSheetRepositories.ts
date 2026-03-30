import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderPlanningSheetRepository } from '@/data/isp/infra/DataProviderPlanningSheetRepository';
import type { PlanningSheetRepository } from '@/domain/isp/port';

/**
 * PlanningSheetRepository インスタンスを提供する。
 */
export function usePlanningSheetRepositories(): PlanningSheetRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderPlanningSheetRepository(provider),
    [provider],
  );
}
