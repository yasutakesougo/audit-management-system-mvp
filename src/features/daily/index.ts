export type {
    DailyRecordDomain, DailyRecordItem, SaveDailyRecordInput, DailyRecordUserRow
} from './schema';

export type {
    DailyRecordDateRange, DailyRecordRepository, DailyRecordRepositoryListParams,
    DailyRecordRepositoryMutationParams
} from './domain/DailyRecordRepository';

// Behavior / Procedure / Execution Repository Interfaces
export type { BehaviorRepository, ProcedureRepository } from './infra/repositoryTypes';
export type { ExecutionRecordRepository } from './domain/ExecutionRecordRepository';

// Repository Pattern - Infrastructure Layer
export {
    InMemoryDailyRecordRepository,
    inMemoryDailyRecordRepository
} from './infra/InMemoryDailyRecordRepository';

export {
    SharePointDailyRecordRepository,
} from './infra/Legacy/SharePointDailyRecordRepository';

// Repository Factory
export type {
    DailyRecordRepositoryFactoryOptions
} from './repositoryFactory';

export {
    getDailyRecordRepository, useDailyRecordRepository
} from './repositoryFactory';

// Components & Hooks
export { DailyRecordForm } from './forms/DailyRecordForm';
export { DailyRecordList } from './lists/DailyRecordList';
export { useDailyUserOptions } from './forms/useDailyUserOptions';
export type { DailyUserOption } from './forms/useDailyUserOptions';
export { useDaily } from './hooks/useDaily';

// Domain Utilities
export { getScheduleKey } from './domain/getScheduleKey';
export { generateDailyReport } from './domain/generateDailyReport';
export { toBipOptions } from './domain/toBipOptions';
export { saveDailyRecord, validateDailyRecord } from './domain/dailyRecordLogic';
export { getNextIncompleteRecord } from './domain/nextIncompleteRecord';

// Domain Types
export * from '../../domain/daily/types';
export * from './domain/daily/types';
