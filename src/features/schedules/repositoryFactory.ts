// contract:allow-sp-direct
import { createRepositoryFactory, type BaseFactoryOptions, defaultShouldUseDemo } from '@/lib/createRepositoryFactory';
import type { ScheduleRepository } from './domain/ScheduleRepository';
import { inMemoryScheduleRepository } from './infra/InMemoryScheduleRepository';
import { DataProviderScheduleRepository } from './infra/DataProviderScheduleRepository';
import { createDataProvider } from '@/lib/data/createDataProvider';
import { createSpClient, ensureConfig } from '@/lib/spClient';

/**
 * Schedule Repository Factory options.
 */
export interface ScheduleRepositoryFactoryOptions extends BaseFactoryOptions {
  listTitle?: string;
  currentOwnerUserId?: string;
}

const factory = createRepositoryFactory<ScheduleRepository, ScheduleRepositoryFactoryOptions>({
  name: 'Schedule',
  createDemo: () => inMemoryScheduleRepository,
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[ScheduleRepositoryFactory] acquireToken is required for real repository.');
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl));

    return new DataProviderScheduleRepository({
      provider,
      listTitle: options.listTitle,
      currentOwnerUserId: options.currentOwnerUserId,
    });
  },
  shouldUseDemo: () => {
    return defaultShouldUseDemo();
  },
});

export const getScheduleRepository = factory.getRepository;
export const useScheduleRepository = factory.useRepository;
export const overrideScheduleRepository = factory.override;
export const resetScheduleRepository = factory.reset;
export const getCurrentScheduleRepositoryKind = factory.getCurrentKind;

export type ScheduleRepositoryKind = 'demo' | 'real';
