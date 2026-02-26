import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';
import { useMemo } from 'react';

import { useAuth } from '@/auth/useAuth';
import type { ScheduleRepository } from './domain/ScheduleRepository';
import { inMemoryScheduleRepository } from './infra/InMemoryScheduleRepository';
import {
    SharePointScheduleRepository,
    type SharePointScheduleRepositoryOptions,
} from './infra/SharePointScheduleRepository';

export type ScheduleRepositoryKind = 'demo' | 'sharepoint';

export type ScheduleRepositoryFactoryOptions = SharePointScheduleRepositoryOptions & {
  forceKind?: ScheduleRepositoryKind;
  acquireToken?: () => Promise<string | null>;
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
  const { isDev } = getAppConfig();
  const spfxContextAvailable = hasSpfxContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isE2E = (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_E2E === '1');

  if (isE2E) return false;

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
const resolveKind = (forced?: ScheduleRepositoryKind): ScheduleRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

/**
 * Create repository instance based on kind
 */
const createRepository = (
  kind: ScheduleRepositoryKind,
  options?: ScheduleRepositoryFactoryOptions,
): ScheduleRepository => {
  if (kind === 'demo') {
    return inMemoryScheduleRepository;
  }

  const acquireToken = options?.acquireToken;
  if (!acquireToken) {
    throw new Error(
      '[ScheduleRepositoryFactory] acquireToken is required for SharePoint repository.',
    );
  }

  return new SharePointScheduleRepository({
    acquireToken,
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
  const { forceKind, acquireToken, listTitle, currentOwnerUserId } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitle === undefined &&
    currentOwnerUserId === undefined
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
  const { acquireToken } = useAuth();

  const repo = useMemo(() => {
    return getScheduleRepository({ acquireToken });
  }, [acquireToken]);

  // eslint-disable-next-line no-console
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_E2E === '1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__LAST_REPO__ = (window as any).__LAST_REPO__ || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changed = (window as any).__LAST_REPO__ !== repo;
    if (changed) {
      console.log('[schedules] [useScheduleRepository] repository instance CHANGED');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__LAST_REPO__ = repo;
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
