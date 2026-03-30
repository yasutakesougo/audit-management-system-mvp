import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { sanitizeEnvValue } from '@/lib/sp/helpers';
import { readEnv } from '@/lib/env';
import { resolveProvider, getActiveProviderType, isDataProviderReady } from '@/lib/data/createDataProvider';

import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { DataProviderDailyRecordRepository } from './infra/DataProviderDailyRecordRepository';
import { inMemoryDailyRecordRepository } from './infra/InMemoryDailyRecordRepository';


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
 * @deprecated Use useDailyRecordRepository() in React hooks to ensure proper Data OS lifecycle management.
 * This function may throw DataProviderNotInitializedError if called before authentication.
 */
export const getDailyRecordRepository = (
  provider?: IDataProvider | Record<string, unknown>,
  options?: { listTitle?: string }
): DailyRecordRepository => {
  if (import.meta.env.DEV && !provider && !isDataProviderReady()) {
    console.warn(
      '[DataOS] getDailyRecordRepository called before initialization. ' +
      'Ensure you are in a test context or use useDailyRecordRepository() hook instead.'
    );
  }
  if (overrideRepository) return overrideRepository;

  const type = getActiveProviderType();
  if (!provider && (type === 'memory' || type === 'local')) {
    return inMemoryDailyRecordRepository;
  }

  const actualProvider = resolveProvider(provider);
  return createDailyRecordRepository(actualProvider, options);
};


export const overrideDailyRecordRepository = (
  repository: DailyRecordRepository | null,
): void => {
  overrideRepository = repository;
};

export const resetDailyRecordRepository = (): void => {
  overrideRepository = null;
};

/** @internal compat stub — returns 'demo' in all contexts (new factory uses IDataProvider directly) */
export const getCurrentDailyRecordRepositoryKind = (): 'sharepoint' | 'demo' => {
  const type = getActiveProviderType();
  return type === 'sharepoint' ? 'sharepoint' : 'demo';
};
