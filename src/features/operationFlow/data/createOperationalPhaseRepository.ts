/**
 * createOperationalPhaseRepository — Repository のファクトリ関数
 *
 * 目的:
 *   - 呼び出し側が具体実装を知らなくても Repository を取得できる
 *   - 将来 SharePoint 実装を追加した際に、ここを差し替えるだけで切り替わる
 *
 * 現在の実装:
 *   - InMemoryOperationalPhaseRepository を返す
 *
 * 将来の拡張イメージ:
 *   ```ts
 *   export function createOperationalPhaseRepository(
 *     backend: 'inmemory' | 'sharepoint' = 'inmemory',
 *   ): OperationalPhaseRepository {
 *     switch (backend) {
 *       case 'sharepoint':
 *         return new SharePointOperationalPhaseRepository(graphClient);
 *       case 'inmemory':
 *       default:
 *         return new InMemoryOperationalPhaseRepository();
 *     }
 *   }
 *   ```
 */

import { InMemoryOperationalPhaseRepository } from './InMemoryOperationalPhaseRepository';
import type { OperationalPhaseRepository } from './OperationalPhaseRepository';

/** シングルトンインスタンス（アプリ内で1つだけ保持） */
let instance: OperationalPhaseRepository | null = null;

/**
 * Repository インスタンスを取得する
 *
 * 初回呼び出し時に InMemoryOperationalPhaseRepository を生成し、
 * 以降は同一インスタンスを返す。
 *
 * @returns OperationalPhaseRepository の実装
 */
export function createOperationalPhaseRepository(): OperationalPhaseRepository {
  if (!instance) {
    instance = new InMemoryOperationalPhaseRepository();
  }
  return instance;
}

/**
 * テスト用: シングルトンをリセットする
 *
 * @internal テストでのみ使用
 */
export function __resetRepositoryForTesting(): void {
  instance = null;
}
