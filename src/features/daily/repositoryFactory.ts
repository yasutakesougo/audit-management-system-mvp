import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import type { DailyRecordRepository } from './domain/DailyRecordRepository';
import { inMemoryDailyRecordRepository } from './infra/InMemoryDailyRecordRepository';
// import { SharePointDailyRecordRepository } from './infra/SharePointDailyRecordRepository';
// import { createSpClient, ensureConfig } from '@/lib/spClient';

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
  createReal: (_options) => {
    // TODO: Restore SharePointDailyRecordRepository when the infra layer is stable.
    console.warn('[DailyRecordRepositoryFactory] Real repository missing, using Demo.');
    return inMemoryDailyRecordRepository;
  },
});

export const getDailyRecordRepository = factory.getRepository;
export const useDailyRecordRepository = factory.useRepository;
export const overrideDailyRecordRepository = factory.override;
export const resetDailyRecordRepository = factory.reset;
export const getCurrentDailyRecordRepositoryKind = factory.getCurrentKind;

export type DailyRecordRepositoryKind = 'demo' | 'real';
