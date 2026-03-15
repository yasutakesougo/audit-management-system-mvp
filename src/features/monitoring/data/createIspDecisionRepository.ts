/**
 * @fileoverview ISP 判断記録 Repository ファクトリ
 * @description
 * 呼び出し側が具体実装を知らなくても Repository を取得できる。
 *
 * 切替ロジック:
 * - shouldSkipSharePoint() が true → InMemoryIspDecisionRepository
 * - それ以外（本番）→ SharePointIspDecisionRepository
 *
 * テスト時は __setIspDecisionRepositoryForTesting() で任意の実装を注入可能。
 */
import { shouldSkipSharePoint } from '@/lib/sharepoint/skipSharePoint';
import { InMemoryIspDecisionRepository } from './InMemoryIspDecisionRepository';
import type { IspDecisionRepository } from './IspDecisionRepository';
import { SharePointIspDecisionRepository } from './SharePointIspDecisionRepository';

/** シングルトンインスタンス */
let instance: IspDecisionRepository | null = null;

/**
 * Repository インスタンスを取得する
 *
 * 初回呼び出し時に環境判定して生成し、以降は同一インスタンスを返す。
 * - 本番: SharePointIspDecisionRepository
 * - dev/demo/test: InMemoryIspDecisionRepository
 */
export function createIspDecisionRepository(): IspDecisionRepository {
  if (!instance) {
    const skip = shouldSkipSharePoint();
    instance = skip
      ? new InMemoryIspDecisionRepository()
      : new SharePointIspDecisionRepository();

    if (!skip) {
      console.info('[IspDecisionRepository] Using SharePoint backend');
    }
  }
  return instance;
}

/**
 * テスト用: シングルトンをリセットする
 * @internal テストでのみ使用
 */
export function __resetIspDecisionRepositoryForTesting(): void {
  instance = null;
}

/**
 * テスト用: カスタム Repository を注入する
 * @internal テストでのみ使用
 */
export function __setIspDecisionRepositoryForTesting(repo: IspDecisionRepository): void {
  instance = repo;
}
