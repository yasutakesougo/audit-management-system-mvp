import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { InMemoryDataProvider } from './inMemoryDataProvider';
import { LocalStorageDataProvider } from './LocalStorageDataProvider';
import type { IDataProvider } from './dataProvider.interface';
import type { UseSP } from '@/lib/spClient';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { useDataProviderObservabilityStore } from './dataProviderObservabilityStore';

export type ProviderType = 'sharepoint' | 'memory' | 'local';

/**
 * DataProvider を生成するファクトリ。
 * 優先順位: 
 *   1. URL パラメータ ?provider=...
 *   2. 環境変数 VITE_DATA_PROVIDER=...
 *   3. デフォルト (sharepoint)
 */
export function createDataProvider(spClient: UseSP): { provider: IDataProvider; type: ProviderType } {
  const urlParams = new URLSearchParams(window.location.search);
  const providerParam = urlParams.get('provider');
  const envProvider = import.meta.env.VITE_DATA_PROVIDER;

  let type: ProviderType = 'sharepoint';
  const selected = providerParam || envProvider;

  if (selected === 'memory') {
    type = 'memory';
  } else if (selected === 'local') {
    type = 'local';
  }

  console.info(`[DataProvider] Selecting backend: ${type} (selected=${selected})`);

  // Telemetry 記録
  trackSpEvent('provider_selected', { providerName: type });

  // Observability Store に反映
  useDataProviderObservabilityStore.getState().setProvider(type);

  let provider: IDataProvider;
  switch (type) {
    case 'memory':
      provider = new InMemoryDataProvider();
      break;
    case 'local':
      provider = new LocalStorageDataProvider();
      break;
    default:
      provider = new SharePointDataProvider(spClient);
      break;
  }

  return { provider, type };
}
