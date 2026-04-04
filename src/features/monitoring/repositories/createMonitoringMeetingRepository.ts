/**
 * createMonitoringMeetingRepository — compat shim
 *
 * 'local'  → LocalStorage ベースの singleton を返す
 * 'sharepoint' → SharePointDataProvider + DataProviderMonitoringMeetingRepository を返す
 */

import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';
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

import { useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import { SP_ENABLED } from '@/lib/env';

/**
 * React Hook: MonitoringMeetingRepository を取得する
 */
export function useMonitoringMeetingRepository(): MonitoringMeetingRepository {
  const spClient = useSP();
  return useMemo(() => {
    // SharePoint が有効かつクライアントが存在する場合のみ SharePoint モード
    const mode = (SP_ENABLED && spClient) ? 'sharepoint' : 'local';
    return createMonitoringMeetingRepository(mode, { spClient });
  }, [spClient]);
}

