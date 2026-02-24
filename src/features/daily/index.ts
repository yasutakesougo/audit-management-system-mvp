// Repository Pattern - Domain Layer
export type {
  DailyRecordRepository,
  DailyRecordItem,
  SaveDailyRecordInput,
  DailyRecordDateRange,
  DailyRecordRepositoryListParams,
  DailyRecordRepositoryMutationParams,
} from './domain/DailyRecordRepository';

// Repository Pattern - Infrastructure Layer
export {
  InMemoryDailyRecordRepository,
  inMemoryDailyRecordRepository,
} from './infra/InMemoryDailyRecordRepository';

export {
  SharePointDailyRecordRepository,
  sharePointDailyRecordRepository,
} from './infra/SharePointDailyRecordRepository';

// Repository Factory
export type {
  DailyRecordRepositoryKind,
  DailyRecordRepositoryFactoryOptions,
} from './repositoryFactory';

export {
  getDailyRecordRepository,
  useDailyRecordRepository,
  overrideDailyRecordRepository,
  resetDailyRecordRepository,
  getCurrentDailyRecordRepositoryKind,
} from './repositoryFactory';
