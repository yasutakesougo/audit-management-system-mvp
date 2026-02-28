/**
 * Generic repository factory builder.
 *
 * Eliminates the ~150-line copy-paste pattern duplicated across:
 *   - features/daily/repositoryFactory.ts
 *   - features/attendance/repositoryFactory.ts
 *   - features/schedules/repositoryFactory.ts
 *   - features/users/repositoryFactory.ts
 *   - features/iceberg-pdca/repositoryFactory.ts
 *
 * Usage:
 * ```ts
 * const factory = createRepositoryFactory<DailyRecordRepository, DailyRecordFactoryOptions>({
 *   name: 'DailyRecord',
 *   createDemo: () => inMemoryDailyRecordRepository,
 *   createReal: (opts) => new SharePointDailyRecordRepository(opts),
 *   shouldUseDemo: defaultShouldUseDemo,
 * });
 *
 * // Plain function
 * const repo = factory.getRepository({ acquireToken });
 *
 * // React hook (auto-provides acquireToken from auth context)
 * const repo = factory.useRepository();
 *
 * // Testing
 * factory.override(mockRepo);
 * factory.reset();
 * ```
 */

import { useAuth } from '@/auth/useAuth';
import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';
import { useMemo } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type RepositoryKind = 'demo' | 'real';

/**
 * Minimal options that every factory accepts.
 * Feature-specific options can extend this via the TOptions generic.
 */
export interface BaseFactoryOptions {
  /** Force a specific repository kind (overrides environment detection). */
  forceKind?: RepositoryKind;
  /** Token acquisition function required for SharePoint repositories. */
  acquireToken?: () => Promise<string | null>;
}

/** Configuration passed to `createRepositoryFactory`. */
export interface RepositoryFactoryConfig<
  TRepo,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> {
  /** Human-readable name for logging/errors (e.g. 'DailyRecord'). */
  name: string;
  /** Factory function that creates the demo/in-memory repository. */
  createDemo: (options?: TOptions) => TRepo;
  /** Factory function that creates the real/SharePoint repository. */
  createReal: (options: TOptions) => TRepo;
  /**
   * Predicate deciding whether to use the demo repository.
   * Defaults to `defaultShouldUseDemo` if not provided.
   */
  shouldUseDemo?: () => boolean;
  /**
   * Whether to use React auth context in the `useRepository` hook.
   * Defaults to `true`.
   */
  useAuthInHook?: boolean;
}

/** The public API returned by `createRepositoryFactory`. */
export interface RepositoryFactory<
  TRepo,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> {
  /** Get or create a repository instance. */
  getRepository: (options?: TOptions) => TRepo;
  /** React hook that auto-provides acquireToken and memoizes the instance. */
  useRepository: (options?: Omit<TOptions, 'acquireToken'>) => TRepo;
  /** Override the repository with a custom instance (for testing). */
  override: (repo: TRepo | null, kind?: RepositoryKind) => void;
  /** Reset all caches and overrides. */
  reset: () => void;
  /** Get the current repository kind. */
  getCurrentKind: () => RepositoryKind;
}

// ────────────────────────────────────────────────────────────────────────────
// Default demo detection (matches the existing pattern across all factories)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default predicate that matches the existing `shouldUseDemoRepository`
 * logic shared across all 5 factory files.
 *
 * Returns `true` for: dev mode, test mode, force-demo, demo-mode,
 * skip-login, or missing SPFx context.
 */
export const defaultShouldUseDemo = (): boolean => {
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

// ────────────────────────────────────────────────────────────────────────────
// Factory builder
// ────────────────────────────────────────────────────────────────────────────

export function createRepositoryFactory<
  TRepo,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
>(config: RepositoryFactoryConfig<TRepo, TOptions>): RepositoryFactory<TRepo, TOptions> {
  const {
    name,
    createDemo,
    createReal,
    shouldUseDemo = defaultShouldUseDemo,
    useAuthInHook = true,
  } = config;

  // ── Internal state ──────────────────────────────────────────────────────
  let cachedRepo: TRepo | null = null;
  let cachedKind: RepositoryKind | null = null;
  let overrideRepo: TRepo | null = null;
  let overrideKind: RepositoryKind | null = null;

  // ── Internal helpers ────────────────────────────────────────────────────
  const resolveKind = (forced?: RepositoryKind): RepositoryKind =>
    forced ?? (shouldUseDemo() ? 'demo' : 'real');

  const createInstance = (kind: RepositoryKind, options?: TOptions): TRepo => {
    if (kind === 'demo') {
      return createDemo(options);
    }

    const acquireToken = options?.acquireToken;
    if (!acquireToken && useAuthInHook) {
      throw new Error(
        `[${name}RepositoryFactory] acquireToken is required for real repository.`,
      );
    }

    return createReal(options as TOptions);
  };

  // ── Public API ──────────────────────────────────────────────────────────
  const getRepository = (options?: TOptions): TRepo => {
    if (overrideRepo) {
      return overrideRepo;
    }

    const kind = resolveKind(options?.forceKind);

    // Reuse cache when no custom options are provided
    if (cachedRepo && cachedKind === kind && !options) {
      return cachedRepo;
    }

    const repo = createInstance(kind, options);

    // Cache only when no custom options (default behavior)
    if (!options) {
      cachedRepo = repo;
      cachedKind = kind;
    }

    return repo;
  };

  const useRepository = (options?: Omit<TOptions, 'acquireToken'>): TRepo => {
    // Conditionally call useAuth — always called (React rules of hooks)
    const auth = useAuthInHook ? useAuth() : { acquireToken: undefined };

    return useMemo(() => {
      const fullOptions = {
        ...options,
        acquireToken: auth.acquireToken,
      } as TOptions;
      return getRepository(fullOptions);
    }, [auth.acquireToken, options]);
  };

  const override = (repo: TRepo | null, kind?: RepositoryKind): void => {
    overrideRepo = repo;
    overrideKind = repo
      ? (kind ?? cachedKind ?? resolveKind())
      : null;
  };

  const reset = (): void => {
    cachedRepo = null;
    cachedKind = null;
    overrideRepo = null;
    overrideKind = null;
  };

  const getCurrentKind = (): RepositoryKind => {
    if (overrideRepo) {
      return overrideKind ?? cachedKind ?? resolveKind();
    }
    return cachedKind ?? resolveKind();
  };

  return { getRepository, useRepository, override, reset, getCurrentKind };
}
