import { useMemo } from 'react';
import {
  getAppConfig,
  isDemoModeEnabled,
  isForceDemoEnabled,
  isTestMode,
  shouldSkipLogin,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';

import { useAuth } from '@/auth/useAuth';
import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { inMemoryDailyRecordRepository } from './infra/InMemoryDailyRecordRepository';
import {
  SharePointDailyRecordRepository,
} from './infra/SharePointDailyRecordRepository';

export type DailyRecordRepositoryKind = 'demo' | 'sharepoint';

export type DailyRecordRepositoryFactoryOptions = {
  forceKind?: DailyRecordRepositoryKind;
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
};

let cachedRepository: DailyRecordRepository | null = null;
let cachedKind: DailyRecordRepositoryKind | null = null;
let overrideRepository: DailyRecordRepository | null = null;
let overrideKind: DailyRecordRepositoryKind | null = null;

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
  const { isDev } = getAppConfig();
  const spfxContextAvailable = hasSpfxContext();
  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    !spfxContextAvailable
  );
};

/**
 * Resolve repository kind based on environment or forced value
 */
const resolveKind = (forced?: DailyRecordRepositoryKind): DailyRecordRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

/**
 * Create repository instance based on kind
 */
const createRepository = (
  kind: DailyRecordRepositoryKind,
  options?: DailyRecordRepositoryFactoryOptions,
): DailyRecordRepository => {
  if (kind === 'demo') {
    return inMemoryDailyRecordRepository;
  }

  const acquireToken = options?.acquireToken;
  if (!acquireToken) {
    throw new Error(
      '[DailyRecordRepositoryFactory] acquireToken is required for SharePoint repository.',
    );
  }

  return new SharePointDailyRecordRepository({
    acquireToken,
    listTitle: options?.listTitle,
  });
};

/**
 * Check if cached repository can be reused
 */
const shouldUseCache = (
  kind: DailyRecordRepositoryKind,
  options?: DailyRecordRepositoryFactoryOptions,
): boolean => {
  if (!cachedRepository || cachedKind !== kind) {
    return false;
  }
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitle } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitle === undefined
  );
};

/**
 * Check if repository should be cached
 */
const shouldCacheRepository = (options?: DailyRecordRepositoryFactoryOptions): boolean => {
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitle } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitle === undefined
  );
};

/**
 * Get daily record repository instance
 * 
 * Returns appropriate repository based on environment:
 * - Demo mode: InMemoryDailyRecordRepository (no SharePoint dependency)
 * - Production: SharePointDailyRecordRepository (requires acquireToken)
 * 
 * Caching:
 * - Repository instances are cached when no custom options are provided
 * - Override mechanism available for testing
 * 
 * @param options - Factory options including acquireToken and configuration
 * @returns DailyRecordRepository instance
 */
export const getDailyRecordRepository = (
  options?: DailyRecordRepositoryFactoryOptions,
): DailyRecordRepository => {
  if (overrideRepository) {
    return overrideRepository;
  }

  const kind = resolveKind(options?.forceKind);

  if (shouldUseCache(kind, options)) {
    return cachedRepository as DailyRecordRepository;
  }

  const repository = createRepository(kind, options);

  if (shouldCacheRepository(options)) {
    cachedRepository = repository;
    cachedKind = kind;
  }

  return repository;
};

/**
 * React Hook: Get daily record repository instance
 * 
 * Automatically provides acquireToken from auth context.
 * Repository is memoized to prevent unnecessary re-instantiation.
 * 
 * Usage:
 * ```tsx
 * const repository = useDailyRecordRepository();
 * const record = await repository.load('2026-02-24');
 * await repository.save(recordData);
 * ```
 * 
 * @returns DailyRecordRepository instance
 */
export const useDailyRecordRepository = (): DailyRecordRepository => {
  const { acquireToken } = useAuth();
  
  return useMemo(() => {
    return getDailyRecordRepository({ acquireToken });
  }, [acquireToken]);
};

/**
 * Override daily record repository for testing
 * 
 * Useful for:
 * - Unit testing with mock repositories
 * - Integration testing with custom implementations
 * - Temporary runtime overrides
 * 
 * @param repository - Repository instance to use (null to clear override)
 * @param kind - Optional repository kind for tracking
 */
export const overrideDailyRecordRepository = (
  repository: DailyRecordRepository | null,
  kind?: DailyRecordRepositoryKind,
): void => {
  overrideRepository = repository;
  if (repository) {
    overrideKind = kind ?? cachedKind ?? resolveKind();
  } else {
    overrideKind = null;
  }
};

/**
 * Reset daily record repository cache and overrides
 * 
 * Use when:
 * - Environment changes (demo ↔ production)
 * - Need to force repository re-instantiation
 * - Testing cleanup
 */
export const resetDailyRecordRepository = (): void => {
  cachedRepository = null;
  cachedKind = null;
  overrideRepository = null;
  overrideKind = null;
};

/**
 * Get current daily record repository kind
 * 
 * Returns:
 * - Override kind if repository is overridden
 * - Cached kind if repository is cached
 * - Resolved kind based on environment
 * 
 * @returns Current repository kind
 */
export const getCurrentDailyRecordRepositoryKind = (): DailyRecordRepositoryKind => {
  if (overrideRepository) {
    return overrideKind ?? cachedKind ?? resolveKind();
  }
  return cachedKind ?? resolveKind();
};
