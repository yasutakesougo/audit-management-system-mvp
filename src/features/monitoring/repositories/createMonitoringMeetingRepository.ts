/**
 * createMonitoringMeetingRepository — compat shim
 *
 * 'local'  → LocalStorage ベースの singleton を返す
 * 'sharepoint' → SharePointDataProvider + DataProviderMonitoringMeetingRepository を返す
 */

import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';
import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';
import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { DataProviderMonitoringMeetingRepository } from '../data/DataProviderMonitoringMeetingRepository';

type Mode = 'local' | 'sharepoint';
type Options = { spClient?: UseSP };

export function createMonitoringMeetingRepository(
  mode?: Mode,
  options?: Options,
): MonitoringMeetingRepository {
  if (!mode || mode === 'local') {
    return localMonitoringMeetingRepository;
  }
  if (!options?.spClient) {
    throw new Error('sharepoint mode requires options.spClient');
  }
  const provider = new SharePointDataProvider(options.spClient);
  return new DataProviderMonitoringMeetingRepository(provider);
}

/**
 * React Hook: MonitoringMeetingRepository を取得する
 */
export function useMonitoringMeetingRepository(): MonitoringMeetingRepository {
  const { provider, type } = useDataProvider();
  return useMemo(() => {
    if (type !== 'sharepoint') {
      return localMonitoringMeetingRepository;
    }
    return new DataProviderMonitoringMeetingRepository(provider);
  }, [provider, type]);
}

