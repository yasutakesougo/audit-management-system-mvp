import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderMonitoringMeetingRepository } from './DataProviderMonitoringMeetingRepository';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';

/**
 * useMonitoringMeetingRepository
 * 
 * IDataProvider を注入した MonitoringMeetingRepository を取得するカスタムフック。
 * 実行時 backend (SharePoint / InMemory) の切り替えに自動対応。
 */
export function useMonitoringMeetingRepository() {
  const { provider, type } = useDataProvider();

  return useMemo(() => {
    if (type !== 'sharepoint') {
      return localMonitoringMeetingRepository;
    }
    return new DataProviderMonitoringMeetingRepository(provider);
  }, [provider, type]);
}
