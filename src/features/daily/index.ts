// Repository Pattern - Domain Layer
export type {
    DailyRecordDateRange, DailyRecordItem, DailyRecordRepository, DailyRecordRepositoryListParams,
    DailyRecordRepositoryMutationParams, SaveDailyRecordInput
} from './domain/legacy/DailyRecordRepository';

// Behavior / Procedure / Execution Repository Interfaces
export type { BehaviorRepository, ProcedureRepository } from './repositories/sharepoint/repositoryTypes';
export type { ExecutionRecordRepository } from './domain/legacy/ExecutionRecordRepository';

// Repository Pattern - Infrastructure Layer
export {
    InMemoryDailyRecordRepository,
    inMemoryDailyRecordRepository
} from './repositories/sharepoint/InMemoryDailyRecordRepository';

export {
    SharePointDailyRecordRepository,
} from './repositories/sharepoint/SharePointDailyRecordRepository';

// Repository Factory
export type {
    DailyRecordRepositoryFactoryOptions, DailyRecordRepositoryKind
} from './repositories/repositoryFactory';

export {
    getCurrentDailyRecordRepositoryKind, getDailyRecordRepository, overrideDailyRecordRepository,
    resetDailyRecordRepository, useDailyRecordRepository
} from './repositories/repositoryFactory';

// Components & Hooks
export { DailyRecordForm } from './components/forms/DailyRecordForm';
export { DailyRecordList } from './components/lists/DailyRecordList';
export { useDailyUserOptions } from './components/forms/useDailyUserOptions';
export type { DailyUserOption } from './components/forms/useDailyUserOptions';

// Domain Utilities
export { getScheduleKey } from './domain/builders/getScheduleKey';
export { generateDailyReport } from './domain/legacy/generateDailyReport';
export { toBipOptions } from './domain/builders/toBipOptions';
export { saveDailyRecord, validateDailyRecord } from './domain/validation/dailyRecordLogic';
export { getNextIncompleteRecord } from './domain/validation/nextIncompleteRecord';

// Domain Types
export * from '../../domain/daily/types';
export * from './domain/daily/types';
