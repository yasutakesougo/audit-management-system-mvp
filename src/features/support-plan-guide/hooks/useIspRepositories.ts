import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { 
  DataProviderIspRepository, 
  DataProviderPlanningSheetRepository, 
  DataProviderProcedureRecordRepository 
} from '@/data/isp/infra';
import type { SupportPlanBundleRepositories } from './useSupportPlanBundle';

/**
 * ISP 三層 Repository を初期化して返す。
 */
export function useIspRepositories(): SupportPlanBundleRepositories {
  const { provider } = useDataProvider();

  return useMemo(() => ({
    ispRepo: new DataProviderIspRepository(provider),
    planningSheetRepo: new DataProviderPlanningSheetRepository(provider),
    procedureRecordRepo: new DataProviderProcedureRecordRepository(provider),
  }), [provider]);
}
