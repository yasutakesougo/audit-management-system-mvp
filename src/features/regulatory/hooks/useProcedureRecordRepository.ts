import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderProcedureRecordRepository } from '@/data/isp/infra/DataProviderProcedureRecordRepository';
import type { ProcedureRecordRepository } from '@/domain/isp/port';

/**
 * ProcedureRecordRepository インスタンスを提供する。
 */
export function useProcedureRecordRepository(): ProcedureRecordRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderProcedureRecordRepository(provider),
    [provider],
  );
}
