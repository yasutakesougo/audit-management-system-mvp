import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderMonitoringMeetingRepository } from './DataProviderMonitoringMeetingRepository';

/**
 * useMonitoringMeetingRepository
 * 
 * IDataProvider を注入した MonitoringMeetingRepository を取得するカスタムフック。
 * 実行時 backend (SharePoint / InMemory) の切り替えに自動対応。
 */
export function useMonitoringMeetingRepository() {
  const { provider } = useDataProvider();

  return useMemo(() => {
    return new DataProviderMonitoringMeetingRepository(provider);
  }, [provider]);
}
