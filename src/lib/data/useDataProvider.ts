import { useEffect, useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import type { IDataProvider } from './dataProvider.interface';
import { createDataProvider, type ProviderType } from './createDataProvider';
import { useDataProviderObservabilityStore } from './dataProviderObservabilityStore';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';

/**
 * 現在有効な DataProvider を取得するフック。
 */
export function useDataProvider(): { provider: IDataProvider; type: ProviderType } {
  const spClient = useSP();
  
  // メモ化して再レンダリング時のインスタンス生成を抑制
  const result = useMemo(() => createDataProvider(spClient), [spClient]);
  
  // 副作用（テレメトリ、ストア更新）はレンダリングフェーズ外で行う
  useEffect(() => {
    const { type } = result;
    const store = useDataProviderObservabilityStore.getState();
    
    // 値が実際に変化している場合のみ、ストア更新とテレメトリ発火を行う
    if (store.currentProvider !== type) {
      store.setProvider(type);
      trackSpEvent('provider_selected', { providerName: type });
    }
  }, [result.type]);

  return result;
}
