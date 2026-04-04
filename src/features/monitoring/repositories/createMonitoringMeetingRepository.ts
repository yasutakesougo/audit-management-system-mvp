/**
 * createMonitoringMeetingRepository — compat shim
 *
 * 'local'  → LocalStorage ベースの singleton を返す
 * 'sharepoint' → SharePointDataProvider + DataProviderMonitoringMeetingRepository を返す
 */

import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';
import { SharePointMonitoringMeetingRepository } from './sharepoint/SharePointMonitoringMeetingRepository';

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
  return new SharePointMonitoringMeetingRepository({ 
      sp: options.spClient,
      listTitle: 'MonitoringMeetings'
  });
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

