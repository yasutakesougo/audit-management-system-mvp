/**
 * OperationalPhaseRepository — フェーズ設定の永続化インターフェース
 *
 * 目的:
 *   - UI が直接 local state でフェーズ設定を持つのを防ぎ、
 *     必ず Repository 経由で取得・保存するアーキテクチャを提供する
 *   - 実装を差し替えるだけで InMemory → SharePoint → 他のバックエンドへ移行可能
 *
 * 設計方針:
 *   - async/await ベース（ネットワーク系実装を想定）
 *   - getAll は sortOrder 順でソート済みの配列を返す
 *   - saveAll は配列全体を置換する（差分更新はしない）
 */

import type { OperationFlowPhaseConfig } from '../domain/operationFlowTypes';

export interface OperationalPhaseRepository {
  /**
   * 全フェーズ設定を取得する
   *
   * @returns sortOrder 順にソートされた設定配列
   */
  getAll(): Promise<OperationFlowPhaseConfig[]>;

  /**
   * 全フェーズ設定を上書き保存する
   *
   * @param phases - 保存する設定配列（sortOrder は呼び出し側が管理）
   */
  saveAll(phases: OperationFlowPhaseConfig[]): Promise<void>;

  /**
   * デフォルト設定にリセットする
   *
   * @returns リセット後の設定配列（sortOrder 順）
   */
  resetToDefault(): Promise<OperationFlowPhaseConfig[]>;
}
