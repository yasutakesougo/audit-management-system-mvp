/**
 * @fileoverview SupportPlanningSheet Repository ファクトリ
 * @description
 * 呼び出し側が具体実装を知らなくても Repository を取得できる。
 *
 * 切替ロジック:
 * - shouldSkipSharePoint() が true → InMemorySupportPlanningSheetRepository
 * - それ以外（本番）→ SharePointSupportPlanningSheetRepository
 *
 * テスト時は __setSupportPlanningSheetRepositoryForTesting() で任意の実装を注入可能。
 */
import { shouldSkipSharePoint } from '@/lib/sharepoint/skipSharePoint';
import { InMemorySupportPlanningSheetRepository } from './InMemorySupportPlanningSheetRepository';
import type { SupportPlanningSheetRepository } from './SupportPlanningSheetRepository';
import { SharePointSupportPlanningSheetRepository } from './SharePointSupportPlanningSheetRepository';

/** シングルトンインスタンス */
let instance: SupportPlanningSheetRepository | null = null;

/**
 * Repository インスタンスを取得する
 *
 * 初回呼び出し時に環境判定して生成し、以降は同一インスタンスを返す。
 * - 本番: SharePointSupportPlanningSheetRepository
 * - dev/demo/test: InMemorySupportPlanningSheetRepository
 */
export function createSupportPlanningSheetRepository(): SupportPlanningSheetRepository {
  if (!instance) {
    const skip = shouldSkipSharePoint();
    instance = skip
      ? new InMemorySupportPlanningSheetRepository()
      : new SharePointSupportPlanningSheetRepository();

    if (!skip) {
      console.info('[SupportPlanningSheetRepository] Using SharePoint backend');
    }
  }
  return instance;
}

/**
 * テスト用: シングルトンをリセットする
 * @internal テストでのみ使用
 */
export function __resetSupportPlanningSheetRepositoryForTesting(): void {
  instance = null;
}

/**
 * テスト用: カスタム Repository を注入する
 * @internal テストでのみ使用
 */
export function __setSupportPlanningSheetRepositoryForTesting(repo: SupportPlanningSheetRepository): void {
  instance = repo;
}
