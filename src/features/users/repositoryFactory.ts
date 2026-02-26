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

import type { UserRepository } from './domain/UserRepository';
import { inMemoryUserRepository } from './infra/InMemoryUserRepository';
import {
    SharePointUserRepository,
    type SharePointUserRepositoryOptions,
} from './infra/SharePointUserRepository';

export type UserRepositoryKind = 'demo' | 'sharepoint';

export type UserRepositoryFactoryOptions = SharePointUserRepositoryOptions & {
  forceKind?: UserRepositoryKind;
};

let cachedRepository: UserRepository | null = null;
let cachedKind: UserRepositoryKind | null = null;
let overrideRepository: UserRepository | null = null;
let overrideKind: UserRepositoryKind | null = null;

const shouldUseDemoRepository = (): boolean => {
  const { isDev } = getAppConfig();
  const spfxContextAvailable = hasSpfxContext();

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

  // 環境変数での制御
  if (readBool('VITE_FEATURE_USERS_SP', false)) {
    return false;
  }

  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldUseSkipLogin() ||
    // Workers/pages (non-SharePoint) runtime: avoid SPFx-only repository
    !spfxContextAvailable
  );
};

// 内部的に使用
const shouldUseSkipLogin = (): boolean => shouldSkipLogin();

const resolveKind = (forced?: UserRepositoryKind): UserRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

const createRepository = (
  kind: UserRepositoryKind,
  options?: SharePointUserRepositoryOptions,
): UserRepository => {
  if (kind === 'demo') {
    return inMemoryUserRepository;
  }
  return new SharePointUserRepository(options);
};

const shouldUseCache = (kind: UserRepositoryKind, options?: UserRepositoryFactoryOptions): boolean => {
  if (!cachedRepository || cachedKind !== kind) {
    return false;
  }
  if (!options) {
    return true;
  }
  const { forceKind, sp, spfxContext, defaultTop } = options;
  return (
    forceKind === undefined &&
    sp === undefined &&
    spfxContext === undefined &&
    defaultTop === undefined
  );
};

const shouldCacheRepository = (options?: UserRepositoryFactoryOptions): boolean => {
  if (!options) {
    return true;
  }
  const { forceKind, sp, spfxContext, defaultTop } = options;
  return (
    forceKind === undefined &&
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
 * Repository is memoized based on its configuration.
 *
 * @returns UserRepository instance
 */
export const useUserRepository = (options?: UserRepositoryFactoryOptions): UserRepository => {
  return useMemo(() => {
    return getUserRepository(options);
  }, [options]);
};
