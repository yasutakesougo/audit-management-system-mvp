import { useMemo } from 'react';
import { useSP } from '@/lib/spClient';
import type { IDataProvider } from './dataProvider.interface';
import { createDataProvider, type ProviderType } from './createDataProvider';

/**
 * 現在有効な DataProvider を取得するフック。
 * 
 * 優先順位に基づき SharePoint か InMemory を返します。
 * ?provider=memory が URL にある場合は InMemory モードになります。
 */
export function useDataProvider(): { provider: IDataProvider; type: ProviderType } {
  const spClient = useSP();
  
  // メモ化して再レンダリング時のインスタンス生成を抑制
  const result = useMemo(() => createDataProvider(spClient), [spClient]);
  
  return result;
}
