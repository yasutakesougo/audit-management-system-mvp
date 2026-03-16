import { pushAudit } from '@/lib/audit';
import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    readBool,
    shouldSkipLogin,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';
import { useMemo } from 'react';

import { useAuth } from '@/auth/useAuth';
import type { UserRepository } from './domain/UserRepository';
import { inMemoryUserRepository } from './infra/InMemoryUserRepository';
import {
    RestApiUserRepository,
} from './infra/RestApiUserRepository';
import {
    SharePointUserRepository,
    type SharePointUserRepositoryOptions,
} from './infra/SharePointUserRepository';

export type UserRepositoryKind = 'demo' | 'sharepoint';

export type UserRepositoryFactoryOptions = SharePointUserRepositoryOptions & {
  forceKind?: UserRepositoryKind;
  acquireToken?: () => Promise<string | null>;
};

let cachedRepository: UserRepository | null = null;
let cachedKind: UserRepositoryKind | null = null;
let overrideRepository: UserRepository | null = null;
let overrideKind: UserRepositoryKind | null = null;

const shouldUseDemoRepository = (): boolean => {
  // E2Eで明示的に SharePoint リポジトリを使いたい場合のフラグ
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:forceUsersSp');
      if (flag === '1' || flag === 'true') {
        return false;
      }
    } catch {
      // ignore
    }
  }

  // 環境変数での制御: VITE_FEATURE_USERS_SP=1 なら SharePoint 優先
  if (readBool('VITE_FEATURE_USERS_SP', false)) {
    return false;
  }

  const { isDev } = getAppConfig();
  const spfxContextAvailable = hasSpfxContext();

  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    // Workers/pages (non-SharePoint) runtime: avoid SPFx-only repository
    !spfxContextAvailable
  );
};

const resolveKind = (forced?: UserRepositoryKind): UserRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

const createRepository = (
  kind: UserRepositoryKind,
  options?: UserRepositoryFactoryOptions,
): UserRepository => {
  if (kind === 'demo') {
    return inMemoryUserRepository;
  }

  // acquireToken がある場合は REST API リポジトリを優先（SPFx 不要）
  if (options?.acquireToken) {
    return new RestApiUserRepository({
      acquireToken: options.acquireToken,
      audit: pushAudit,
    });
  }

  // SPFx コンテキストがある場合のみ PnPJS リポジトリ
  if (hasSpfxContext()) {
    return new SharePointUserRepository({ ...options, audit: pushAudit });
  }

  // acquireToken も SPFx もない場合はエラー
  throw new Error(
    '[UserRepositoryFactory] acquireToken is required for SharePoint repository in non-SPFx environments. ' +
    'Provide acquireToken via useUserRepository() hook or set VITE_FEATURE_USERS_SP=0.',
  );
};

const shouldUseCache = (kind: UserRepositoryKind, options?: UserRepositoryFactoryOptions): boolean => {
  if (!cachedRepository || cachedKind !== kind) {
    return false;
  }
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, sp, spfxContext, defaultTop } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    sp === undefined &&
    spfxContext === undefined &&
    defaultTop === undefined
  );
};

const shouldCacheRepository = (options?: UserRepositoryFactoryOptions): boolean => {
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, sp, spfxContext, defaultTop } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    sp === undefined &&
    spfxContext === undefined &&
    defaultTop === undefined
  );
};

export const getUserRepository = (
  options?: UserRepositoryFactoryOptions,
): UserRepository => {
  if (overrideRepository) {
    return overrideRepository;
  }

  const kind = resolveKind(options?.forceKind);

  if (shouldUseCache(kind, options)) {
    return cachedRepository as UserRepository;
  }

  const repository = createRepository(kind, options);

  if (shouldCacheRepository(options)) {
    cachedRepository = repository;
    cachedKind = kind;
  }

  return repository;
};

export const overrideUserRepository = (
  repository: UserRepository | null,
  kind?: UserRepositoryKind,
): void => {
  overrideRepository = repository;
  if (repository) {
    overrideKind = kind ?? cachedKind ?? resolveKind();
  } else {
    overrideKind = null;
  }
};

export const resetUserRepository = (): void => {
  cachedRepository = null;
  cachedKind = null;
  overrideRepository = null;
  overrideKind = null;
};

export const getCurrentUserRepositoryKind = (): UserRepositoryKind => {
  if (overrideRepository) {
    return overrideKind ?? cachedKind ?? resolveKind();
  }
  return cachedKind ?? resolveKind();
};

/**
 * React Hook: Get user repository instance
 *
 * Automatically provides acquireToken from auth context.
 * This enables the REST API repository for local development
 * without SPFx context.
 *
 * @returns UserRepository instance
 */
export const useUserRepository = (options?: UserRepositoryFactoryOptions): UserRepository => {
  const { acquireToken } = useAuth();

  return useMemo(() => {
    return getUserRepository({
      ...options,
      acquireToken: options?.acquireToken ?? acquireToken,
    });
  }, [options, acquireToken]);
};
