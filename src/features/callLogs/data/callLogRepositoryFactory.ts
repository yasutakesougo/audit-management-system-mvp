/**
 * CallLog Repository Factory
 *
 * shouldSkipSharePoint() に基づき、適切な実装を返す。
 * UI / Hook 層はこの factory を経由するだけでよく、
 * SP or InMemory を直接意識しなくて済む。
 */

import { shouldSkipSharePoint } from '@/lib/env';
import type { CallLogRepository } from '@/domain/callLogs/repository';
import { InMemoryCallLogRepository } from './InMemoryCallLogRepository';
import { makeSharePointCallLogRepository } from './SharePointCallLogRepository';

let sharedInMemoryRepository: InMemoryCallLogRepository | null = null;

/**
 * Factory:環境に応じた CallLogRepository を生成する。
 *
 * - shouldSkipSharePoint() === true → InMemory 実装
 * - otherwise → SharePoint 実装
 *
 * 環境判定はこの factory 層の正当な責務。
 * UI / Hook 層で shouldSkipSharePoint() を直接呼ばないこと。
 */
export function createCallLogRepository(
  acquireToken: (resource?: string) => Promise<string | null>,
): CallLogRepository {
  if (shouldSkipSharePoint()) {
    if (!sharedInMemoryRepository) {
      sharedInMemoryRepository = new InMemoryCallLogRepository([], {
        useSharedStore: true,
      });
    }
    return sharedInMemoryRepository;
  }
  return makeSharePointCallLogRepository(acquireToken);
}

export const __resetCallLogRepositoryFactoryForTests = (): void => {
  sharedInMemoryRepository = null;
};
