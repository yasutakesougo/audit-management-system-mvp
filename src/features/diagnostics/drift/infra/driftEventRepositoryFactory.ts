import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
// eslint-disable-next-line no-restricted-imports -- Factory は composition root として spClient を生成する責務を持つ。
import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { IDriftEventRepository } from '../domain/DriftEventRepository';
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
  IDriftEventRepository,
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
    const client = createSpClient(acquireToken, baseUrl);

    return new SharePointDriftEventRepository(client);
  },
});

/**
 * ドリフトイベントリポジトリを取得する React Hook。
 */
export const useDriftEventRepository = () => driftEventRepositoryFactory.useRepository();
