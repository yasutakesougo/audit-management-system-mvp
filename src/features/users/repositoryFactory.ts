import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
} from '@/lib/env';

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
  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin()
  );
};

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
