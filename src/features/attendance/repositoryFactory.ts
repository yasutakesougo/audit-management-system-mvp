import {
  getAppConfig,
  isDemoModeEnabled,
  isForceDemoEnabled,
  isTestMode,
  shouldSkipLogin,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';

import { useAuth } from '@/auth/useAuth';
import type { AttendanceRepository } from './domain/AttendanceRepository';
import { inMemoryAttendanceRepository } from './infra/InMemoryAttendanceRepository';
import {
  SharePointAttendanceRepository,
  type SharePointAttendanceRepositoryOptions,
} from './infra/SharePointAttendanceRepository';

export type AttendanceRepositoryKind = 'demo' | 'sharepoint';

export type AttendanceRepositoryFactoryOptions = SharePointAttendanceRepositoryOptions & {
  forceKind?: AttendanceRepositoryKind;
  acquireToken?: () => Promise<string | null>;
};

let cachedRepository: AttendanceRepository | null = null;
let cachedKind: AttendanceRepositoryKind | null = null;
let overrideRepository: AttendanceRepository | null = null;
let overrideKind: AttendanceRepositoryKind | null = null;

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

const resolveKind = (forced?: AttendanceRepositoryKind): AttendanceRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

const createRepository = (
  kind: AttendanceRepositoryKind,
  options?: AttendanceRepositoryFactoryOptions,
): AttendanceRepository => {
  if (kind === 'demo') {
    return inMemoryAttendanceRepository;
  }

  const acquireToken = options?.acquireToken;
  if (!acquireToken) {
    throw new Error(
      '[AttendanceRepositoryFactory] acquireToken is required for SharePoint repository.',
    );
  }

  return new SharePointAttendanceRepository(acquireToken, {
    listTitleUsers: options?.listTitleUsers,
    listTitleDaily: options?.listTitleDaily,
  });
};

const shouldUseCache = (
  kind: AttendanceRepositoryKind,
  options?: AttendanceRepositoryFactoryOptions,
): boolean => {
  if (!cachedRepository || cachedKind !== kind) {
    return false;
  }
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitleUsers, listTitleDaily } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitleUsers === undefined &&
    listTitleDaily === undefined
  );
};

const shouldCacheRepository = (options?: AttendanceRepositoryFactoryOptions): boolean => {
  if (!options) {
    return true;
  }
  const { forceKind, acquireToken, listTitleUsers, listTitleDaily } = options;
  return (
    forceKind === undefined &&
    acquireToken === undefined &&
    listTitleUsers === undefined &&
    listTitleDaily === undefined
  );
};

export const getAttendanceRepository = (
  options?: AttendanceRepositoryFactoryOptions,
): AttendanceRepository => {
  if (overrideRepository) {
    return overrideRepository;
  }

  const kind = resolveKind(options?.forceKind);

  if (shouldUseCache(kind, options)) {
    return cachedRepository as AttendanceRepository;
  }

  const repository = createRepository(kind, options);

  if (shouldCacheRepository(options)) {
    cachedRepository = repository;
    cachedKind = kind;
  }

  return repository;
};

export const useAttendanceRepository = (): AttendanceRepository => {
  const { acquireToken } = useAuth();
  return getAttendanceRepository({ acquireToken });
};

export const overrideAttendanceRepository = (
  repository: AttendanceRepository | null,
  kind?: AttendanceRepositoryKind,
): void => {
  overrideRepository = repository;
  if (repository) {
    overrideKind = kind ?? cachedKind ?? resolveKind();
  } else {
    overrideKind = null;
  }
};

export const resetAttendanceRepository = (): void => {
  cachedRepository = null;
  cachedKind = null;
  overrideRepository = null;
  overrideKind = null;
};

export const getCurrentAttendanceRepositoryKind = (): AttendanceRepositoryKind => {
  if (overrideRepository) {
    return overrideKind ?? cachedKind ?? resolveKind();
  }
  return cachedKind ?? resolveKind();
};
