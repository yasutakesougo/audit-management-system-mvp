import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { UserRepository } from './domain/UserRepository';
import { inMemoryUserRepository } from './infra/InMemoryUserRepository';
import { RestApiUserRepository } from './infra/RestApiUserRepository';
import { SharePointUserRepository } from './infra/SharePointUserRepository';
import { pushAudit } from '@/lib/audit';
import { hasSpfxContext } from '@/lib/runtime';

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
  createReal: (options) => {
    // 1. If spFetch is provided, prioritize RestApiUserRepository
    if (options.spFetch) {
      return new RestApiUserRepository({
        spFetch: options.spFetch,
        audit: pushAudit,
      });
    }

    // 2. If in SPFx context, use the SharePoint-pnpjs implementation
    if (hasSpfxContext()) {
      return new SharePointUserRepository({
        ...options,
        audit: pushAudit,
      });
    }

    // 3. Fallback/Error
    throw new Error(
      '[UserRepositoryFactory] spFetch or SPFx context is required for SharePoint repository.',
    );
  },
});

export const getUserRepository = factory.getRepository;
export const useUserRepository = factory.useRepository;
export const overrideUserRepository = factory.override;
export const resetUserRepository = factory.reset;
export const getCurrentUserRepositoryKind = factory.getCurrentKind;

export type UserRepositoryKind = 'demo' | 'real';
