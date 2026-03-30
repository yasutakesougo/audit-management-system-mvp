import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderBehaviorMonitoringRepository } from '@/data/isp/infra/DataProviderBehaviorMonitoringRepository';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';

export function useBehaviorMonitoringRepository(): BehaviorMonitoringRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderBehaviorMonitoringRepository(provider),
    [provider],
  );
}
