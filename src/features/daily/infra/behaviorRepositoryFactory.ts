import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    readBool,
    shouldSkipLogin,
    shouldSkipSharePoint,
} from '@/lib/env';
import type { BehaviorRepository } from '../domain/BehaviorRepository';
import { InMemoryBehaviorRepository } from './InMemoryBehaviorRepository';
import { SharePointBehaviorRepository } from './SharePointBehaviorRepository';

let cachedRepository: BehaviorRepository | null = null;

const shouldUseInMemoryRepository = (): boolean => {
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
  return isDev;
};

const createRepository = (): BehaviorRepository => {
  if (shouldUseInMemoryRepository()) {
    return new InMemoryBehaviorRepository();
  }

  try {
    return new SharePointBehaviorRepository();
  } catch (error) {
    console.warn('[behaviorRepositoryFactory] Falling back to in-memory repository:', error);
    return new InMemoryBehaviorRepository();
  }
};

export const getBehaviorRepository = (): BehaviorRepository => {
  if (!cachedRepository) {
    cachedRepository = createRepository();
  }
  return cachedRepository;
};

export const getInMemoryBehaviorRepository = (): InMemoryBehaviorRepository | null => {
  const repo = getBehaviorRepository();
  return repo instanceof InMemoryBehaviorRepository ? repo : null;
};

export const __resetBehaviorRepositoryForTests = (): void => {
  cachedRepository = null;
};
