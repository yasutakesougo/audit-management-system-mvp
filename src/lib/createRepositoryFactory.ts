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
    readBool,
    readEnv,
    isTestMode,
    shouldSkipLogin,
    shouldSkipSharePoint,
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
  // 0. Test mode should be isolated from environment-driven 'force sharepoint'
  // to prevent .env.local from breaking unit tests in developer environments.
  if (isTestMode()) {
    return true;
  }

  // 1. Explicit force SharePoint wins in non-test codes.
  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);
  if (forceSharePoint) {
    return false;
  }

  // 2. Priority overrides for forcing demo
  if (
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    shouldSkipSharePoint()
  ) {
    return true;
  }

  // 2. SharePoint Enablement Logic
  // We use readEnv directly here to match the strict 'true' check used in env.ts
  // while also supporting readBool for broader compatibility if needed.
  const spEnabled = readEnv('VITE_SP_ENABLED', '') === 'true' || readBool('VITE_SP_ENABLED', false);
  const spfxContextAvailable = hasSpfxContext();
  const { isDev } = getAppConfig();

  if (spEnabled) {
    // In production or when explicitly enabled, we prefer 'real'.
    // However, in local dev, if no SPFx context is available, we only use 'real'
    // if specifically forced (handled by forceSharePoint above) or if we are
    // NOT in a dev environment.
    if (isDev && !spfxContextAvailable) {
      return true;
    }
    return false;
  }

  // 3. Default: Use demo in dev or when context is missing
  return isDev || !spfxContextAvailable;
};

// ────────────────────────────────────────────────────────────────────────────
// Factory builder
// ────────────────────────────────────────────────────────────────────────────

export function createRepositoryFactory<
  TRepo,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
>(config: RepositoryFactoryConfig<TRepo, TOptions>): RepositoryFactory<TRepo, TOptions> {
  const {
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

    return createReal(options as TOptions);
  };

  // ── Public API ──────────────────────────────────────────────────────────
  const getRepository = (options?: TOptions): TRepo => {
    if (overrideRepo) {
      return overrideRepo;
    }

    const kind = resolveKind(options?.forceKind);

    // 内部的なメモ化用の型
    interface RepositoryMetadata {
      __acquireToken?: () => Promise<string | null>;
    }

    // acquireToken が同一であり、かつ明示的な forceKind 指定がない場合に限りキャッシュを再利用する
    const canReuseCache = cachedRepo && 
      cachedKind === kind && 
      !options?.forceKind &&
      (!options || (cachedRepo as RepositoryMetadata).__acquireToken === options.acquireToken);

    if (canReuseCache) {
      return cachedRepo!;
    }

    const repo = createInstance(kind, options);
    
    // インスタンスにトークン取得関数を紐付けて、次回比較できるようにする
    if (options?.acquireToken) {
      (repo as RepositoryMetadata).__acquireToken = options.acquireToken;
    }

    // 初回または安定したインスタンスとしてキャッシュ
    if (!cachedRepo || (!options?.forceKind)) {
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
