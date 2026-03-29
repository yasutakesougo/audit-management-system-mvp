import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    readBool,
    shouldSkipLogin,
    shouldSkipSharePoint,
} from '@/lib/env';
import { isE2E } from '@/env';
import { hasSpfxContext } from '@/lib/runtime';
// contract:allow-sp-direct — factory creates spClient for DI — EXCEPT in DataProvider mode
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

/** Debug-only window extension for tracking repository changes in E2E */
interface WindowWithDebug extends Window {
  __LAST_REPO__?: unknown;
}

import type { ScheduleRepository } from './domain/ScheduleRepository';
import {
    DataProviderScheduleRepository,
} from './infra/DataProviderScheduleRepository';
import {
    SharePointScheduleRepository
} from './infra/Legacy/SharePointScheduleRepository';

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

/**
 * Determine if demo repository should be used
 * Returns true for:
 * - Development mode
 * - Test mode
 * - Demo mode enabled
 * - Skip login mode
 * - No SPFx context (Workers/Pages runtime)
 */
const shouldUseDemoRepository = (): boolean => {
  const e2eActive = isE2E;

  if (e2eActive) return false;

  if (
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    shouldSkipSharePoint()
  ) {
    return true;
  }

  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);
  const spEnabled = readBool('VITE_SP_ENABLED', false);
  if (forceSharePoint || spEnabled) {
    return false;
  }

  const { isDev } = getAppConfig();
  const spfxContextAvailable = hasSpfxContext();

  return (
    isDev ||
    !spfxContextAvailable
  );
};

/**
 * Resolve repository kind based on environment or forced value
 */
const resolveKind = (forced?: ScheduleRepositoryKind): ScheduleRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

/**
 * Create repository instance based on kind
 */
const createRepository = (
  kind: ScheduleRepositoryKind,
  options?: ScheduleRepositoryFactoryOptions,
): ScheduleRepository => {
  // if kind === sharepoint but no provider, error
  const provider = options?.provider;
  if (kind === 'sharepoint' && !provider) {
    throw new Error(
      '[ScheduleRepositoryFactory] Provider is required for SharePoint repository.',
    );
  }

  // provider-based repository for SharePoint
  if (provider) {
    return new DataProviderScheduleRepository({
      provider,
      listTitle: options?.listTitle,
      currentOwnerUserId: options?.currentOwnerUserId,
    });
  }

  // legacy SharePoint fallback (if somehow still needed - should eventually be removed)
  const acquireToken = options?.acquireToken;
  if (!acquireToken) {
    throw new Error(
      '[ScheduleRepositoryFactory] acquireToken is required for legacy SharePoint repository.',
    );
  }

  const { baseUrl } = ensureConfig();
  const { spFetch } = createSpClient(acquireToken, baseUrl);

  return new SharePointScheduleRepository({
    acquireToken,
    spFetch,
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
 * Returns appropriate repository based on environment:
 * - Demo mode: InMemoryScheduleRepository (no SharePoint dependency)
 * - Production: SharePointScheduleRepository (requires acquireToken)
 *
 * Caching:
 * - Repository instances are cached when no custom options are provided
 * - Override mechanism available for testing
 *
 * @param options - Factory options including acquireToken and configuration
 * @returns ScheduleRepository instance
 */
export const getScheduleRepository = (
  options?: ScheduleRepositoryFactoryOptions,
): ScheduleRepository => {
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
