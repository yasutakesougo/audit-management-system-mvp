import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { InMemoryDataProvider } from './inMemoryDataProvider';
import { LocalStorageDataProvider } from './LocalStorageDataProvider';
import type { IDataProvider } from './dataProvider.interface';
import type { UseSP } from '@/lib/spClient';
import { 
  DataProviderNotInitializedError 
} from '@/lib/errors';

import { isDevMode, isDemoModeEnabled, readBool, readOptionalEnv, shouldSkipSharePoint, isTestMode } from '@/lib/env';

export type ProviderType = 'sharepoint' | 'memory' | 'local';

const providerInstances: Record<string, IDataProvider> = {};
let lastLoggedType: string | null = null;


/** @internal - For testing only */
export function __clearProviderCache(): void {
  Object.keys(providerInstances).forEach(k => delete providerInstances[k]);
  lastLoggedType = null;
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

  // forceKind オプションを考慮
  const forcedType = (provider as { forceKind?: ProviderType } | undefined)?.forceKind;
  const type = forcedType || getActiveProviderType();
  const cacheKey = type;

  if (!providerInstances[cacheKey]) {
    switch (type) {
      case 'memory': providerInstances[cacheKey] = new InMemoryDataProvider(); break;
      case 'local': providerInstances[cacheKey] = new LocalStorageDataProvider(); break;
      case 'sharepoint':
        throw new DataProviderNotInitializedError(type);
    }
  }

  return providerInstances[cacheKey];
}


/**
 * DataProvider を生成または更新する。
 */
export function createDataProvider(
  spClient: UseSP,
  options?: { type?: ProviderType }
): { provider: IDataProvider; type: ProviderType } {
  const type = options?.type || getActiveProviderType();
  const cacheKey = type;

  if (!providerInstances[cacheKey]) {
    switch (type) {
      case 'memory': providerInstances[cacheKey] = new InMemoryDataProvider(); break;
      case 'local': providerInstances[cacheKey] = new LocalStorageDataProvider(); break;
      case 'sharepoint':
        providerInstances[cacheKey] = new SharePointDataProvider(spClient); 
        break;
    }
  } else if (type === 'sharepoint' && providerInstances[cacheKey] instanceof SharePointDataProvider) {
    // SharePoint の場合はクライアントを更新する可能性があるため、インスタンスを再生成せず内容を更新して同一性を保つ
    providerInstances[cacheKey].setClient(spClient);
  }

  if (type !== lastLoggedType) {
    console.info(`[DataProvider] Active backend: ${type}`);
    lastLoggedType = type;
  }

  return { provider: providerInstances[cacheKey], type };
}

/**
 * 現在の動作モード（URL/環境変数）を React Hook 以外の場所から取得する。
 */
export function getActiveProviderType(): ProviderType {
  const isDev = isDevMode();
  const isDemo = isDemoModeEnabled();
  const skipSp = shouldSkipSharePoint();
  const forceSharePoint = readBool('VITE_FORCE_SHAREPOINT', false);

  // 1. スキップ指定 (VITE_SKIP_SHAREPOINT)
  if (skipSp) return 'memory';

  // 2. 明示的なバックエンド指定 (URL/環境変数 VITE_DATA_PROVIDER)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const providerParam = urlParams?.get('provider');
  const envProvider = readOptionalEnv('VITE_DATA_PROVIDER');
  const selected = providerParam || envProvider;

  if (selected === 'memory') return 'memory';
  if (selected === 'local') return 'local';
  if (selected === 'sharepoint') return 'sharepoint';

  // 3. 強制SharePoint指定 (統合テスト等で意図的に使用する場合。isTestMode より優先)
  if (forceSharePoint) return 'sharepoint';

  // 4. テストモード保護 (Vitest/Jest 実行時はモック不足によるクラッシュを防ぐため memory をデフォルトに)
  if (isTestMode()) return 'memory';

  // 5. フォールバック: デモ、開発環境ならメモリをデフォルトに
  if (isDemo || isDev) return 'memory';

  return 'sharepoint';
}
