import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderIspRepository } from '@/data/isp/infra/DataProviderIspRepository';
import type { IspRepository } from '@/domain/isp/port';

/**
 * IspRepository インスタンスを提供する。
 */
export function useIspRepository(): IspRepository {
  const { provider } = useDataProvider();

  return useMemo(
    () => new DataProviderIspRepository(provider),
    [provider]
  );
}
