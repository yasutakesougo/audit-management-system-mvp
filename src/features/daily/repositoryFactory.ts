// contract:allow-sp-direct
import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { isTestMode } from '@/lib/env';
import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { inMemoryDailyRecordRepository } from './infra/InMemoryDailyRecordRepository';
import { DataProviderDailyRecordRepository } from './infra/DataProviderDailyRecordRepository';
import { createDataProvider } from '@/lib/data/createDataProvider';
import {  createSpClient, ensureConfig } from '@/lib/spClient';

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
    const acquireToken = options?.acquireToken;
    if (!acquireToken) {
      if (isTestMode()) {
        console.warn('[DailyRecordRepositoryFactory] Running in test mode WITHOUT acquireToken. Falling back to dummy provider.');
        // We return a mock-ready instance that won't crash on boot
        return new DataProviderDailyRecordRepository({
          provider: createDataProvider(null, { type: 'memory' }).provider,
          listTitle: options?.listTitle || 'SupportRecord_Daily',
        });
      }
      throw new Error('[DailyRecordRepositoryFactory] acquireToken is required for real repository.');
    }
    const { baseUrl } = ensureConfig();
    const { provider } = createDataProvider(createSpClient(acquireToken, baseUrl), { type: 'sharepoint' });

    return new DataProviderDailyRecordRepository({
      provider,
      listTitle: options.listTitle || 'SupportRecord_Daily',
    });
  },
});

export const getDailyRecordRepository = factory.getRepository;
export const useDailyRecordRepository = factory.useRepository;
export const overrideDailyRecordRepository = factory.override;
export const resetDailyRecordRepository = factory.reset;
export const getCurrentDailyRecordRepositoryKind = factory.getCurrentKind;

export type DailyRecordRepositoryKind = 'demo' | 'real';
