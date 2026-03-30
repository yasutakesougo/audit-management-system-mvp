/**
 * @fileoverview 個別支援計画シート Repository ファクトリ
 */
import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { DataProviderSupportPlanningSheetRepository } from './DataProviderSupportPlanningSheetRepository';
import type { SupportPlanningSheetRepository } from './SupportPlanningSheetRepository';

let overrideInstance: SupportPlanningSheetRepository | null = null;

/**
 * Repository インスタンスを取得する
 */
export function getSupportPlanningSheetRepository(provider: IDataProvider): SupportPlanningSheetRepository {
  if (overrideInstance) return overrideInstance;
  return new DataProviderSupportPlanningSheetRepository(provider);
}

/**
 * React Hook: 個別支援計画シート Repository を取得する
 */
export function useSupportPlanningSheetRepository(): SupportPlanningSheetRepository {
  const { provider } = useDataProvider();

  return useMemo(() => {
    return getSupportPlanningSheetRepository(provider);
  }, [provider]);
}

/**
 * Legacy support: createSupportPlanningSheetRepository (non-hook)
 */
export function createSupportPlanningSheetRepository(provider?: IDataProvider): SupportPlanningSheetRepository {
  if (!provider) {
    throw new Error('[SupportPlanningSheetRepository] provider is required for createSupportPlanningSheetRepository');
  }
  return getSupportPlanningSheetRepository(provider);
}

/**
 * テスト用
 */
export function __resetSupportPlanningSheetRepositoryForTesting(): void {
  overrideInstance = null;
}

/**
 * テスト用
 */
export function __setSupportPlanningSheetRepositoryForTesting(repo: SupportPlanningSheetRepository): void {
  overrideInstance = repo;
}
