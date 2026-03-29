import { useMemo } from 'react';
import { pushAudit } from '@/lib/audit';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

import type { UserRepository } from './domain/UserRepository';
import { DataProviderUserRepository } from './infra/DataProviderUserRepository';

export type UserRepositoryFactoryOptions = {
  provider?: IDataProvider;
};

let overrideRepository: UserRepository | null = null;

/**
 * Creates a repository based on the provided DataProvider.
 */
export const createUserRepository = (provider: IDataProvider): UserRepository => {
  return new DataProviderUserRepository({
    provider,
    audit: pushAudit,
  });
};

/**
 * React Hook: Get user repository instance
 * 
 * Uses the global DataProvider to create a backend-agnostic repository.
 */
export const useUserRepository = (options?: UserRepositoryFactoryOptions): UserRepository => {
  const { provider: globalProvider } = useDataProvider();
  const provider = options?.provider ?? globalProvider;

  return useMemo(() => {
    if (overrideRepository) return overrideRepository;
    return createUserRepository(provider);
  }, [provider]);
};

/**
 * Legacy support / Non-React context getter.
 * Note: This requires an explicit provider to be passed if not using the hook.
 */
export const getUserRepository = (provider: IDataProvider): UserRepository => {
  if (overrideRepository) return overrideRepository;
  return createUserRepository(provider);
};

export const overrideUserRepository = (repository: UserRepository | null): void => {
  overrideRepository = repository;
};

export const resetUserRepository = (): void => {
  overrideRepository = null;
};

/**
 * Returns the kind of the current repository ('sharepoint' | 'demo')
 * Used by UI hooks to determine if seeding is needed.
 */
export const getCurrentUserRepositoryKind = (): 'sharepoint' | 'demo' => {
  // We check the same logic as createDataProvider to determine if we are in memory mode
  if (typeof window === 'undefined') return 'sharepoint';
  
  const urlParams = new URLSearchParams(window.location.search);
  const providerParam = urlParams.get('provider');
  const envProvider = import.meta.env.VITE_DATA_PROVIDER;

  const isMemory = providerParam === 'memory' || envProvider === 'memory';
  return isMemory ? 'demo' : 'sharepoint';
};
