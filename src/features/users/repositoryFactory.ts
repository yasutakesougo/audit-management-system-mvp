import { useMemo } from 'react';
import { pushAudit } from '@/lib/audit';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { resolveProvider, getActiveProviderType, isDataProviderReady } from '@/lib/data/createDataProvider';
import { isDevMode } from '@/lib/env';

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
 * @deprecated Use useUserRepository() in React components to ensure proper Data OS lifecycle management.
 * This function may throw DataProviderNotInitializedError if called before authentication.
 */
export const getUserRepository = (
  provider?: IDataProvider | Record<string, unknown>,
): UserRepository => {
  if (isDevMode() && !provider && !isDataProviderReady()) {
    console.warn(
      '[DataOS] getUserRepository called before initialization. ' +
      'Ensure you are in a test context or use useUserRepository() hook instead.'
    );
  }
  if (overrideRepository) return overrideRepository;
  const actualProvider = resolveProvider(provider);
  return createUserRepository(actualProvider);
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
  const type = getActiveProviderType();
  return type === 'sharepoint' ? 'sharepoint' : 'demo';
};
