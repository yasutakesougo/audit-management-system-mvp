/**
 * CallLog Repository Factory
 */

import { useMemo } from 'react';
import type { CallLogRepository } from '@/domain/callLogs/repository';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderCallLogRepository } from './DataProviderCallLogRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

/**
 * Creates a CallLogRepository instance.
 */
export const createCallLogRepository = (provider: IDataProvider): CallLogRepository => {
  return new DataProviderCallLogRepository(provider);
};

/**
 * React Hook: UI / Hook 層からリポジトリを取得するための推奨パス。
 * global DataProvider を DI する。
 */
export const useCallLogRepository = (): CallLogRepository => {
  const { provider } = useDataProvider();

  return useMemo(() => {
    return createCallLogRepository(provider);
  }, [provider]);
};

/**
 * 非 Hook 文脈用のゲッター。
 */
export const getCallLogRepository = (provider: IDataProvider): CallLogRepository => {
  return createCallLogRepository(provider);
};

/** @internal テスト用リセット（新ファクトリはシングルトン状態を持たないが後方互換のため提供） */
export const __resetCallLogRepositoryFactoryForTests = (): void => {
  // no-op: DataProvider-based factory has no singleton state
};
