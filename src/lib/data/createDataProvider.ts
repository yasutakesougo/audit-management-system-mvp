import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { InMemoryDataProvider } from './inMemoryDataProvider';
import { LocalStorageDataProvider } from './LocalStorageDataProvider';
import type { IDataProvider } from './dataProvider.interface';
import type { UseSP } from '@/lib/spClient';
import { 
  DataProviderNotInitializedError 
} from '@/lib/errors';

export type ProviderType = 'sharepoint' | 'memory' | 'local';

const providerInstances: Record<string, IDataProvider> = {};

/** @internal - For testing only */
export function __clearProviderCache(): void {
  Object.keys(providerInstances).forEach(k => delete providerInstances[k]);
}

/**
 * プロバイダーが初期化済み（SharePointならクライアント紐付け済み）かを確認する
 */
export function isDataProviderReady(): boolean {
  const type = getActiveProviderType();
  return !!providerInstances[type];
}

/**
 * 非Reactコンテキスト（テストや非Hook内部）でプロバイダーを解決するためのヘルパー。
 */
export function resolveProvider(provider?: unknown): IDataProvider {
  if (provider && typeof provider === 'object' && 'listItems' in provider) {
    return provider as IDataProvider;
  }

  const type = getActiveProviderType();
  const cacheKey = type;

  if (!providerInstances[cacheKey]) {
    switch (type) {
      case 'memory': providerInstances[cacheKey] = new InMemoryDataProvider(); break;
      case 'local': providerInstances[cacheKey] = new LocalStorageDataProvider(); break;
      default: 
        throw new DataProviderNotInitializedError(type);
    }
  }

  return providerInstances[cacheKey];
}

/**
 * DataProvider を生成または更新する。
 */
export function createDataProvider(spClient: UseSP): { provider: IDataProvider; type: ProviderType } {
  const type = getActiveProviderType();
  const cacheKey = type;

  if (!providerInstances[cacheKey]) {
    switch (type) {
      case 'memory': providerInstances[cacheKey] = new InMemoryDataProvider(); break;
      case 'local': providerInstances[cacheKey] = new LocalStorageDataProvider(); break;
      default: 
        providerInstances[cacheKey] = new SharePointDataProvider(spClient); 
        break;
    }
  } else if (type === 'sharepoint') {
    // 既存の SharePoint インスタンスがある場合はクライアントのみ更新する
    (providerInstances[cacheKey] as SharePointDataProvider).setClient(spClient);
  }

  console.info(`[DataProvider] Active backend: ${type}`);
  return { provider: providerInstances[cacheKey], type };
}

/**
 * 現在の動作モード（URL/環境変数）を React Hook 以外の場所から取得する。
 */
export function getActiveProviderType(): ProviderType {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const providerParam = urlParams?.get('provider');
  const envProvider = import.meta.env.VITE_DATA_PROVIDER;

  const selected = providerParam || envProvider;

  if (selected === 'memory') return 'memory';
  if (selected === 'local') return 'local';
  return 'sharepoint';
}
