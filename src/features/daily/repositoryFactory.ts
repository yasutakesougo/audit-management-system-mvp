import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { sanitizeEnvValue } from '@/lib/sp/helpers';
import { readEnv } from '@/lib/env';

import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { DataProviderDailyRecordRepository } from './infra/DataProviderDailyRecordRepository';

export type DailyRecordRepositoryFactoryOptions = {
  provider?: IDataProvider;
  listTitle?: string;
};

let overrideRepository: DailyRecordRepository | null = null;

/**
 * Creates a repository based on the provided DataProvider.
 */
export const createDailyRecordRepository = (
  provider: IDataProvider,
  options?: { listTitle?: string }
): DailyRecordRepository => {
  const listTitle = (options?.listTitle ?? 
    sanitizeEnvValue(readEnv('VITE_SP_DAILY_RECORDS_LIST', ''))) || 
    'SupportRecord_Daily';

  return new DataProviderDailyRecordRepository({
    provider,
    listTitle,
  });
};

/**
 * React Hook: Get daily record repository instance
 * 
 * Uses the global DataProvider to create a backend-agnostic repository.
 */
export const useDailyRecordRepository = (options?: DailyRecordRepositoryFactoryOptions): DailyRecordRepository => {
  const { provider: globalProvider } = useDataProvider();
  const provider = options?.provider ?? globalProvider;

  return useMemo(() => {
    if (overrideRepository) return overrideRepository;
    return createDailyRecordRepository(provider, { listTitle: options?.listTitle });
  }, [provider, options?.listTitle]);
};

/**
 * Non-React context getter.
 * Requires an explicit provider.
 */
export const getDailyRecordRepository = (
  provider: IDataProvider,
  options?: { listTitle?: string }
): DailyRecordRepository => {
  if (overrideRepository) return overrideRepository;
  return createDailyRecordRepository(provider, options);
};

export const overrideDailyRecordRepository = (
  repository: DailyRecordRepository | null,
): void => {
  overrideRepository = repository;
};

export const resetDailyRecordRepository = (): void => {
  overrideRepository = null;
};
