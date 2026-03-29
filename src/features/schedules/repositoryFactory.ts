import { isE2E } from '@/env';
// contract:allow-sp-direct — factory creates spClient for DI — EXCEPT in DataProvider mode
import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { resolveProvider, getActiveProviderType, isDataProviderReady } from '@/lib/data/createDataProvider';

/** Debug-only window extension for tracking repository changes in E2E */
interface WindowWithDebug extends Window {
  __LAST_REPO__?: unknown;
}

import type { ScheduleRepository } from './domain/ScheduleRepository';
import {
    DataProviderScheduleRepository,
} from './infra/DataProviderScheduleRepository';

export type ScheduleRepositoryKind = 'demo' | 'sharepoint';

export type ScheduleRepositoryFactoryOptions = {
  forceKind?: ScheduleRepositoryKind;
  acquireToken?: () => Promise<string | null>;
  currentOwnerUserId?: string;
  provider?: IDataProvider;
  listTitle?: string;
};

let cachedRepository: ScheduleRepository | null = null;
let cachedKind: ScheduleRepositoryKind | null = null;
let overrideRepository: ScheduleRepository | null = null;
let overrideKind: ScheduleRepositoryKind | null = null;

// ... (deleted shouldUseDemoRepository)

/**
 * Resolve repository kind based on environment or forced value
 */
const resolveKind = (forced?: ScheduleRepositoryKind): ScheduleRepositoryKind =>
  forced ?? (getActiveProviderType() === 'sharepoint' ? 'sharepoint' : 'demo');

/**
 * Create repository instance based on kind
 */
const createRepository = (
  _kind: ScheduleRepositoryKind,
  options?: ScheduleRepositoryFactoryOptions,
): ScheduleRepository => {
  const provider = resolveProvider(options?.provider);

  return new DataProviderScheduleRepository({
    provider,
    listTitle: options?.listTitle,
    currentOwnerUserId: options?.currentOwnerUserId,
  });
};

/**
 * Check if cached repository can be reused
 */
const shouldUseCache = (
  kind: ScheduleRepositoryKind,
  options?: ScheduleRepositoryFactoryOptions,
): boolean => {
  if (!cachedRepository || cachedKind !== kind) {
    return false;
  }
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitle, currentOwnerUserId } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitle === undefined &&
    currentOwnerUserId === undefined
  );
};

/**
 * Check if repository should be cached
 */
const shouldCacheRepository = (options?: ScheduleRepositoryFactoryOptions): boolean => {
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitle, currentOwnerUserId, provider } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitle === undefined &&
    currentOwnerUserId === undefined &&
    provider === undefined
  );
};

/**
 * Get schedule repository instance
 * 
 * @deprecated Use useScheduleRepository() in React components to ensure proper Data OS lifecycle management.
 * This function may throw DataProviderNotInitializedError if called before authentication.
 * 
 * @param options - Factory options including configuration
 * @returns ScheduleRepository instance
 */
export const getScheduleRepository = (
  options?: ScheduleRepositoryFactoryOptions,
): ScheduleRepository => {
  if (import.meta.env.DEV && !options?.provider && !isDataProviderReady()) {
    console.warn(
      '[DataOS] getScheduleRepository called before initialization. ' +
      'Ensure you are in a test context or use useScheduleRepository() hook instead.'
    );
  }
  if (overrideRepository) {
    return overrideRepository;
  }

  const kind = resolveKind(options?.forceKind);

  if (shouldUseCache(kind, options)) {
    return cachedRepository as ScheduleRepository;
  }

  const repository = createRepository(kind, options);

  if (shouldCacheRepository(options)) {
    cachedRepository = repository;
    cachedKind = kind;
  }

  return repository;
};

/**
 * React Hook: Get schedule repository instance
 *
 * Automatically provides acquireToken from auth context.
 * Repository is memoized to prevent unnecessary re-instantiation.
 *
 * Usage:
 * ```tsx
 * const repository = useScheduleRepository();
 * const schedules = await repository.list({ range: { from, to } });
 * ```
 *
 * @returns ScheduleRepository instance
 */
export const useScheduleRepository = (): ScheduleRepository => {
  const { provider } = useDataProvider();

  const repo = useMemo(() => {
    return getScheduleRepository({ provider });
  }, [provider]);

  if (typeof window !== 'undefined' && isE2E) {
    const w = window as WindowWithDebug;
    w.__LAST_REPO__ = w.__LAST_REPO__ || null;
    const changed = w.__LAST_REPO__ !== repo;
    if (changed) {
      // eslint-disable-next-line no-console
      console.log('[schedules] [useScheduleRepository] repository instance CHANGED');
      w.__LAST_REPO__ = repo;
    }
  }

  return repo;
};

/**
 * Override schedule repository for testing
 *
 * Useful for:
 * - Unit testing with mock repositories
 * - Integration testing with custom implementations
 * - Temporary runtime overrides
 *
 * @param repository - Repository instance to use (null to clear override)
 * @param kind - Optional repository kind for tracking
 */
export const overrideScheduleRepository = (
  repository: ScheduleRepository | null,
  kind?: ScheduleRepositoryKind,
): void => {
  overrideRepository = repository;
  if (repository) {
    overrideKind = kind ?? cachedKind ?? resolveKind();
  } else {
    overrideKind = null;
  }
};

/**
 * Reset schedule repository cache and overrides
 *
 * Use when:
 * - Environment changes (demo ↔ production)
 * - Need to force repository re-instantiation
 * - Testing cleanup
 */
export const resetScheduleRepository = (): void => {
  cachedRepository = null;
  cachedKind = null;
  overrideRepository = null;
  overrideKind = null;
};

/**
 * Get current schedule repository kind
 *
 * Returns:
 * - Override kind if repository is overridden
 * - Cached kind if repository is cached
 * - Resolved kind based on environment
 *
 * @returns Current repository kind
 */
export const getCurrentScheduleRepositoryKind = (): ScheduleRepositoryKind => {
  if (overrideRepository) {
    return overrideKind ?? cachedKind ?? resolveKind();
  }
  return cachedKind ?? resolveKind();
};
