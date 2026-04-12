import { useMemo } from 'react';
import type { PlanPatchRepository } from '@/domain/isp/planPatchRepository';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderPlanPatchRepository } from '@/data/isp/infra/DataProviderPlanPatchRepository';

export function usePlanPatchRepository(): PlanPatchRepository {
  const { provider } = useDataProvider();
  return useMemo(() => new DataProviderPlanPatchRepository(provider), [provider]);
}
