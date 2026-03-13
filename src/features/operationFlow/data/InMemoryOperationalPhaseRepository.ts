/**
 * InMemoryOperationalPhaseRepository — メモリ上でフェーズ設定を管理する実装
 *
 * 用途:
 *   - 開発・テスト用のスタブ実装
 *   - SharePoint が未接続の状態でも UI が動作するための fallback
 *
 * 特性:
 *   - ページリロードで状態がリセットされる（永続化なし）
 *   - DEFAULT_PHASE_CONFIG を初期値として使用
 *   - saveAll は配列をディープコピーして保持する（外部からの変更を防ぐ）
 */

import { DEFAULT_PHASE_CONFIG } from '../domain/defaultPhaseConfig';
import type { OperationFlowPhaseConfig } from '../domain/operationFlowTypes';
import type { OperationalPhaseRepository } from './OperationalPhaseRepository';

export class InMemoryOperationalPhaseRepository implements OperationalPhaseRepository {
  /** 内部ストレージ */
  private phases: OperationFlowPhaseConfig[];

  constructor(initial?: readonly OperationFlowPhaseConfig[]) {
    this.phases = structuredClone(initial ?? DEFAULT_PHASE_CONFIG) as OperationFlowPhaseConfig[];
  }

  async getAll(): Promise<OperationFlowPhaseConfig[]> {
    // sortOrder 順にソートしてディープコピーを返す
    return structuredClone(
      [...this.phases].sort((a, b) => a.sortOrder - b.sortOrder),
    ) as OperationFlowPhaseConfig[];
  }

  async saveAll(phases: OperationFlowPhaseConfig[]): Promise<void> {
    // ディープコピーして保持（外部変更からの隔離）
    this.phases = structuredClone(phases) as OperationFlowPhaseConfig[];
  }

  async resetToDefault(): Promise<OperationFlowPhaseConfig[]> {
    this.phases = structuredClone(DEFAULT_PHASE_CONFIG) as OperationFlowPhaseConfig[];
    return this.getAll();
  }
}
