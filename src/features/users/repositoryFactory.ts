// contract:allow-sp-direct
import { createRepositoryFactory, defaultShouldUseDemo, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { UserRepository } from './domain/UserRepository';
import { inMemoryUserRepository } from './infra/InMemoryUserRepository';
import { DataProviderUserRepository } from './infra/DataProviderUserRepository';
import { createDataProvider, resolveProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { pushAudit } from '@/lib/audit';


/**
 * User Repository Factory options.
 */
export interface UserRepositoryFactoryOptions extends BaseFactoryOptions {
  /** Optional custom fetching function (for REST API mode). */
  spFetch?: (path: string, init?: RequestInit) => Promise<Response>;
  /** Optional top value for queries. */
  defaultTop?: number;
}

const factory = createRepositoryFactory<UserRepository, UserRepositoryFactoryOptions>({
  name: 'User',
  createDemo: () => inMemoryUserRepository,
  shouldUseDemo: () => {
    // E2E環境やデバッグ時に確実にデモモードを選択するための明示的なチェック
    const forceDemo = (import.meta as ImportMeta).env.VITE_FORCE_DEMO === '1' || (import.meta as ImportMeta).env.VITE_FORCE_DEMO === 'true';
    if (forceDemo) return true;
    return defaultShouldUseDemo();
  },
  createReal: (options) => {
    // 1. DataProvider 版を使用 (Split Write / Lazy Join 対応の本番用実装)
    const { acquireToken } = options || {};
    if (!acquireToken) {
      try {
        const provider = resolveProvider();
        return new DataProviderUserRepository({
          provider,
          audit: pushAudit,
        });
      } catch (e) {
        // Fallback to generic error if resolveProvider also failed or threw unexpected
        if ((e as Error)?.name === 'DataProviderNotInitializedError') {
          console.warn('[UserRepositoryFactory] Falling back to global provider (not initialized)');
          throw e;
        }
        throw e;
      }
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl));
    
    return new DataProviderUserRepository({
      provider,
      audit: pushAudit,
    });
  },
});

export const getUserRepository = factory.getRepository;
export const useUserRepository = factory.useRepository;
export const overrideUserRepository = factory.override;
export const resetUserRepository = factory.reset;
export const getCurrentUserRepositoryKind = factory.getCurrentKind;

export type UserRepositoryKind = 'demo' | 'real';
