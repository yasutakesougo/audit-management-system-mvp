import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { DriftEventRepository } from '../application/DriftEventRepository';
import { InMemoryDriftEventRepository } from './InMemoryDriftEventRepository';
import { SharePointDriftEventRepository } from './SharePointDriftEventRepository';

export interface DriftEventRepositoryOptions extends BaseFactoryOptions {
  /** 取得上限（読み取り時） */
  limit?: number;
}

/**
 * ドリフトイベントリポジトリのファクトリ。
 * UI層からは useDriftEventRepository() を使用してください。
 */
export const driftEventRepositoryFactory = createRepositoryFactory<
  DriftEventRepository,
  DriftEventRepositoryOptions
>({
  name: 'DriftEvent',
  
  createDemo: () => new InMemoryDriftEventRepository(),
  
  createReal: (options) => {
    const { acquireToken } = options;
    if (!acquireToken) {
      throw new Error('[DriftEventRepoFactory] acquireToken is required for real repository.');
    }

    const { baseUrl } = ensureConfig();
    const { spFetch } = createSpClient(acquireToken, baseUrl);

    return new SharePointDriftEventRepository(spFetch);
  },
});

/**
 * ドリフトイベントリポジトリを取得する React Hook。
 */
export const useDriftEventRepository = () => driftEventRepositoryFactory.useRepository();
