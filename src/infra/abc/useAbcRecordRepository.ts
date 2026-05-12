import { useMemo } from 'react';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import { SharePointAbcRecordRepository } from '@/infra/sharepoint/repos/SharePointAbcRecordRepository';
import type { AbcRecordRepository } from '@/domain/abc/abcRecord';

/**
 * ABC記録リポジトリを注入する React カスタムフック。
 *
 * 環境変数 VITE_DATA_PROVIDER=sharepoint の場合は SharePointAbcRecordRepository、
 * それ以外の場合は localAbcRecordRepository にフォールバックする安全設計。
 */
export function useAbcRecordRepository(): AbcRecordRepository {
  const { provider, type } = useDataProvider();

  return useMemo(() => {
    if (type === 'sharepoint') {
      return new SharePointAbcRecordRepository(provider);
    }
    return localAbcRecordRepository;
  }, [provider, type]);
}
