import { createRepositoryFactory, type BaseFactoryOptions, defaultShouldUseDemo } from '@/lib/createRepositoryFactory';
import { isE2E } from '@/env';
import type { ScheduleRepository } from './domain/ScheduleRepository';
import { inMemoryScheduleRepository } from './infra/InMemoryScheduleRepository';
import { SharePointScheduleRepository, type SharePointScheduleRepositoryOptions } from './infra/SharePointScheduleRepository';
import { createSpClient, ensureConfig } from '@/lib/spClient';

/**
 * Schedule Repository Factory options.
 */
export interface ScheduleRepositoryFactoryOptions extends BaseFactoryOptions, SharePointScheduleRepositoryOptions {}

const factory = createRepositoryFactory<ScheduleRepository, ScheduleRepositoryFactoryOptions>({
  name: 'Schedule',
  createDemo: () => inMemoryScheduleRepository,
  createReal: (options) => {
    const acquireToken = options.acquireToken;
    if (!acquireToken) {
      throw new Error(
        '[ScheduleRepositoryFactory] acquireToken is required for SharePoint repository.',
      );
    }

    const { baseUrl } = ensureConfig();
    const { spFetch } = createSpClient(acquireToken, baseUrl);

    return new SharePointScheduleRepository({
      acquireToken,
      spFetch,
      listTitle: options.listTitle,
      currentOwnerUserId: options.currentOwnerUserId,
    });
  },
  shouldUseDemo: () => {
    // E2E environment should ALWAYS use real (SharePoint) repository
    if (isE2E) return false;
    return defaultShouldUseDemo();
  },
});

export const getScheduleRepository = factory.getRepository;
export const useScheduleRepository = factory.useRepository;
export const overrideScheduleRepository = factory.override;
export const resetScheduleRepository = factory.reset;
export const getCurrentScheduleRepositoryKind = factory.getCurrentKind;

export type ScheduleRepositoryKind = 'demo' | 'real';
