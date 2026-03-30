import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { inMemoryDailyRecordRepository } from './infra/InMemoryDailyRecordRepository';
import { SharePointDailyRecordRepository } from './infra/SharePointDailyRecordRepository';
import { createSpClient, ensureConfig } from '@/lib/spClient';

/**
 * Daily Record Repository Factory options.
 */
export interface DailyRecordRepositoryFactoryOptions extends BaseFactoryOptions {
  /** Optional custom list title. */
  listTitle?: string;
}

const factory = createRepositoryFactory<DailyRecordRepository, DailyRecordRepositoryFactoryOptions>({
  name: 'DailyRecord',
  createDemo: () => inMemoryDailyRecordRepository,
  createReal: (options) => {
    const acquireToken = options.acquireToken;
    if (!acquireToken) {
      throw new Error(
        '[DailyRecordRepositoryFactory] acquireToken is required for SharePoint repository.',
      );
    }

    const { baseUrl } = ensureConfig();
    const { spFetch } = createSpClient(acquireToken, baseUrl);

    return new SharePointDailyRecordRepository({
      spFetch,
      listTitle: options.listTitle,
    });
  },
});

export const getDailyRecordRepository = factory.getRepository;
export const useDailyRecordRepository = factory.useRepository;
export const overrideDailyRecordRepository = factory.override;
export const resetDailyRecordRepository = factory.reset;
export const getCurrentDailyRecordRepositoryKind = factory.getCurrentKind;

export type DailyRecordRepositoryKind = 'demo' | 'real';
