import { IToiletRecordRepository } from './types';
import { LocalStorageToiletRecordRepository } from './toiletRecordRepository';
import { SharePointToiletRecordRepository } from './SharePointToiletRecordRepository';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { readOptionalEnv } from '@/lib/env';
import { defaultShouldUseDemo } from '@/lib/createRepositoryFactory';

export type ToiletRepositoryKind = 'local' | 'sharepoint';

const shouldUseLocalRepository = (): boolean => {
  const providerParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('provider') : undefined;
  const providerEnv = readOptionalEnv('VITE_DATA_PROVIDER');
  const providerHint = (providerParam ?? providerEnv ?? '').trim().toLowerCase();

  // 1. 全体標準のデモ判定（hasSpfxContext などの安全なフォールバックを含む）に従う
  if (defaultShouldUseDemo()) {
    return true;
  }

  // 2. クエリパラメータまたは環境変数で明示的にローカルが指定されている場合
  if (providerHint === 'local' || providerHint === 'memory') {
    return true;
  }

  // 3. デフォルトは SharePoint 永続化
  return false;
};

export const getToiletRepository = (
  spFetch?: SpFetchFn,
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>
): IToiletRecordRepository => {
  if (shouldUseLocalRepository() || !spFetch) {
    return new LocalStorageToiletRecordRepository();
  }
  return new SharePointToiletRecordRepository(spFetch, getListFieldInternalNames);
};
