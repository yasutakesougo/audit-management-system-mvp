import {
  getDailyRecordRepository as getNewDailyRecordRepository,
  useDailyRecordRepository as useNewDailyRecordRepository,
  overrideDailyRecordRepository as overrideNewDailyRecordRepository,
  resetDailyRecordRepository as resetNewDailyRecordRepository,
  getCurrentDailyRecordRepositoryKind as getCurrentNewDailyRecordRepositoryKind,
} from '../repositoryFactory';
import type { DailyRecordRepository } from '../domain/DailyRecordRepository';

export type DailyRecordRepositoryKind = 'demo' | 'sharepoint';

export type DailyRecordRepositoryFactoryOptions = {
  forceKind?: DailyRecordRepositoryKind;
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
};

/**
 * Compatibility wrapper for the new standardized repository factory.
 * Resolves architectural drift by pointing legacy imports to the SSOT factory.
 */
export const getDailyRecordRepository = (
  options?: DailyRecordRepositoryFactoryOptions,
): DailyRecordRepository => {
  return getNewDailyRecordRepository({
    acquireToken: options?.acquireToken,
    listTitle: options?.listTitle,
    // Note: forceKind mapping 'sharepoint' -> 'real' if needed, 
    // but the new standardized factory handles env resolution better.
  });
};

export const useDailyRecordRepository = (): DailyRecordRepository => {
  return useNewDailyRecordRepository();
};

export const overrideDailyRecordRepository = (
  repository: DailyRecordRepository | null,
  kind?: DailyRecordRepositoryKind,
): void => {
  overrideNewDailyRecordRepository(repository, kind as 'real' | 'demo');
};

export const resetDailyRecordRepository = (): void => {
  resetNewDailyRecordRepository();
};

export const getCurrentDailyRecordRepositoryKind = (): DailyRecordRepositoryKind => {
  const kind = getCurrentNewDailyRecordRepositoryKind();
  return kind === 'real' ? 'sharepoint' : 'demo';
};
