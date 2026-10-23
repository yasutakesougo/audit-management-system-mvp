// contract:allow-sp-direct
import { createRepositoryFactory, defaultShouldUseDemo, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { readBool, readOptionalEnv } from '@/lib/env';
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

/**
 * User-repository demo gate.
 *
 * Precedence, using the existing runtime helpers (no helper change):
 * `mergeRuntimeEnv` copies usable strings in order build -> runtime file ->
 * `window.__ENV__`. `'0'` is usable, so it overwrites a build-time `'1'`.
 * A missing or blank runtime value does not overwrite, which is how unset
 * stays distinct from `'0'`. `getRuntimeEnv` then prefers that merged
 * `window.__ENV__` over the build snapshot, and `readOptionalEnv` / `readBool`
 * read that result. `readBool` alone collapses both `'0'` and a missing key
 * to false, so the string from `readOptionalEnv` is what keeps them apart.
 *
 * 1. Effective `VITE_FORCE_SHAREPOINT=1` (or any other truthy flag) selects SharePoint.
 * 2. Otherwise a present `VITE_FORCE_DEMO` decides: truthy => demo, `'0'`/`'false'` => SharePoint.
 * 3. When that merged value is absent, fall back to the build-time inline flag,
 *    then to `defaultShouldUseDemo`.
 */
export const shouldUseUserDemoRepository = (): boolean => {
  if (readBool('VITE_FORCE_SHAREPOINT', false)) return false;

  const forceDemo = readOptionalEnv('VITE_FORCE_DEMO');
  if (forceDemo !== undefined) {
    return readBool('VITE_FORCE_DEMO', false);
  }

  const buildDemo = (import.meta as ImportMeta).env.VITE_FORCE_DEMO;
  if (buildDemo === '1' || buildDemo === 'true') return true;
  return defaultShouldUseDemo();
};

const factory = createRepositoryFactory<UserRepository, UserRepositoryFactoryOptions>({
  name: 'User',
  createDemo: () => inMemoryUserRepository,
  shouldUseDemo: shouldUseUserDemoRepository,
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
