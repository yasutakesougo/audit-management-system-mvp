/**
 * useHandoffData — Factory-aware Hook for HandoffRepository
 *
 * UI / Page コンポーネントはこの Hook を通じてのみ申し送りデータにアクセスする。
 * インフラ層の実装詳細（localStorage / SharePoint）を完全に隠蔽。
 *
 * ADR-3 に準拠: neutral naming（useHandoffData、not useLocalStorageHandoff）
 *
 * @see domain/HandoffRepository.ts — Port 定義
 * @see infra/handoffRepositoryFactory.ts — Factory + Adapter
 */

import type { HandoffAuditRepository, HandoffRepository } from '../domain/HandoffRepository';
import { useHandoffRepository } from '../infra/handoffRepositoryFactory';

/**
 * Factory-aware hook for HandoffRepository + HandoffAuditRepository
 *
 * 使い方:
 * ```ts
 * const { repo, auditRepo } = useHandoffData();
 * ```
 */
export function useHandoffData(): {
  repo: HandoffRepository;
  auditRepo: HandoffAuditRepository;
} {
  return useHandoffRepository();
}
