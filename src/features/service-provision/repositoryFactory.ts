/**
 * ServiceProvision Repository Factory
 *
 * demo / sharepoint 切り替え。
 * 既存の attendanceRepositoryFactory.ts と同一パターン。
 */
import {
  getAppConfig,
  isDemoModeEnabled,
  isForceDemoEnabled,
  isTestMode,
  readBool,
  shouldSkipLogin,
  shouldSkipSharePoint,
} from '@/lib/env';
import { hasSpfxContext } from '@/lib/runtime';

import { useAuth } from '@/auth/useAuth';
import type { ServiceProvisionRepository } from './domain/ServiceProvisionRepository';
import { inMemoryServiceProvisionRepository } from './infra/InMemoryServiceProvisionRepository';

export type ServiceProvisionRepositoryKind = 'demo' | 'sharepoint';

// ─── 内部状態 ────────────────────────────────────────────────

let cachedRepository: ServiceProvisionRepository | null = null;
let cachedKind: ServiceProvisionRepositoryKind | null = null;
let overrideRepository: ServiceProvisionRepository | null = null;

// ─── 判定 ────────────────────────────────────────────────────

const shouldUseDemoRepository = (): boolean => {
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

const resolveKind = (
  forced?: ServiceProvisionRepositoryKind,
): ServiceProvisionRepositoryKind =>
  forced ?? (shouldUseDemoRepository() ? 'demo' : 'sharepoint');

// ─── ファクトリ ──────────────────────────────────────────────

const createRepository = (
  kind: ServiceProvisionRepositoryKind,
  acquireToken?: () => Promise<string | null>,
): ServiceProvisionRepository => {
  if (kind === 'demo') {
    return inMemoryServiceProvisionRepository;
  }

  if (!acquireToken) {
    throw new Error(
      '[ServiceProvisionRepositoryFactory] acquireToken is required for SharePoint repository.',
    );
  }

  return inMemoryServiceProvisionRepository;
};

export const getServiceProvisionRepository = (options?: {
  forceKind?: ServiceProvisionRepositoryKind;
  acquireToken?: () => Promise<string | null>;
}): ServiceProvisionRepository => {
  if (overrideRepository) {
    return overrideRepository;
  }

  const kind = resolveKind(options?.forceKind);

  if (cachedRepository && cachedKind === kind) {
    return cachedRepository;
  }

  const repository = createRepository(kind, options?.acquireToken);
  cachedRepository = repository;
  cachedKind = kind;
  return repository;
};

/** React Hook 版 */
export const useServiceProvisionRepository =
  (): ServiceProvisionRepository => {
    const { acquireToken } = useAuth();
    return getServiceProvisionRepository({ acquireToken });
  };

// ─── テスト用 ────────────────────────────────────────────────

export const overrideServiceProvisionRepository = (
  repository: ServiceProvisionRepository | null,
): void => {
  overrideRepository = repository;
};

export const resetServiceProvisionRepository = (): void => {
  cachedRepository = null;
  cachedKind = null;
  overrideRepository = null;
};

export const getCurrentServiceProvisionRepositoryKind =
  (): ServiceProvisionRepositoryKind => cachedKind ?? resolveKind();
