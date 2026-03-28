import {
    getAppConfig,
    isDemoModeEnabled,
    isForceDemoEnabled,
    isTestMode,
    shouldSkipLogin,
    skipSharePoint,
} from '@/lib/env';
import type { BehaviorRepository } from '../domain/BehaviorRepository';
import { InMemoryBehaviorRepository } from './InMemoryBehaviorRepository';
import { SharePointBehaviorRepository } from './SharePointBehaviorRepository';

let cachedRepository: BehaviorRepository | null = null;

const shouldUseInMemoryRepository = (): boolean => {
  const { isDev } = getAppConfig();
  return (
    isDev ||
    isTestMode() ||
    isForceDemoEnabled() ||
    isDemoModeEnabled() ||
    shouldSkipLogin() ||
    skipSharePoint()
  );
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
