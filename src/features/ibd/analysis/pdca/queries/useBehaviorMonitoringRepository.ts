import { createSharePointBehaviorMonitoringRepository } from '@/data/isp/sharepoint';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';
import { useSP } from '@/lib/spClient';
import { useMemo } from 'react';

export function useBehaviorMonitoringRepository(): BehaviorMonitoringRepository {
  const client = useSP();

  return useMemo(
    () => createSharePointBehaviorMonitoringRepository(client),
    [client],
  );
}
