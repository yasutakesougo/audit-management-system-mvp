/**
 * @fileoverview ISP 判断記録 Repository ファクトリ
 */
import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { DataProviderIspDecisionRepository } from './DataProviderIspDecisionRepository';
import type { IspDecisionRepository } from './IspDecisionRepository';

let overrideInstance: IspDecisionRepository | null = null;

/**
 * Repository インスタンスを取得する
 */
export function getIspDecisionRepository(provider: IDataProvider): IspDecisionRepository {
  if (overrideInstance) return overrideInstance;
  return new DataProviderIspDecisionRepository(provider);
}

/**
 * React Hook: ISP 判断記録 Repository を取得する
 */
export function useIspDecisionRepository(): IspDecisionRepository {
  const { provider } = useDataProvider();

  return useMemo(() => {
    return getIspDecisionRepository(provider);
  }, [provider]);
}

/**
 * Legacy support: createIspDecisionRepository (non-hook)
 * NOTE: Provider を明示的に渡せない場合は警告が出る設計にすべきだが、
 * 既存の呼び出し箇所との互換性のために、必要ならここからシングルトンを返す等の調整が必要。
 */
export function createIspDecisionRepository(provider?: IDataProvider): IspDecisionRepository {
  if (overrideInstance) return overrideInstance;

  // 以前の createIspDecisionRepository は引数なしでシングルトンを返していた。
  // 新設計では provider が必須。
  if (!provider) {
    throw new Error('[IspDecisionRepository] provider is required for createIspDecisionRepository');
  }
  return getIspDecisionRepository(provider);
}

/**
 * テスト用
 */
export function __resetIspDecisionRepositoryForTesting(): void {
  overrideInstance = null;
}

/**
 * テスト用
 */
export function __setIspDecisionRepositoryForTesting(repo: IspDecisionRepository): void {
  overrideInstance = repo;
}

