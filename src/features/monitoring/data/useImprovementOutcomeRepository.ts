import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderImprovementOutcomeRepository } from '@/data/isp/infra/DataProviderImprovementOutcomeRepository';
import type { ImprovementOutcomeRepository } from '@/domain/isp/improvementOutcomeRepository';

export function useImprovementOutcomeRepository(): ImprovementOutcomeRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderImprovementOutcomeRepository(provider),
    [provider],
  );
}
