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

import { useMemo } from 'react';
import type { HandoffAuditRepository, HandoffRepository } from '../domain/HandoffRepository';
import { useHandoffApi } from '../handoffApi';
import { useHandoffAuditApi } from '../handoffAuditApi';
import {
    createHandoffAuditRepository,
    createHandoffRepository,
    type HandoffApiHooks,
} from '../infra/handoffRepositoryFactory';

/**
 * Factory-aware hook for HandoffRepository + HandoffAuditRepository
 *
 * 使い方:
 * ```ts
 * const { repo, auditRepo } = useHandoffData();
 * const records = await repo.getRecords('today', 'all');
 * ```
 */
export function useHandoffData(): {
  repo: HandoffRepository;
  auditRepo: HandoffAuditRepository;
} {
  const handoffApi = useHandoffApi();
  const auditApi = useHandoffAuditApi();

  const hooks: HandoffApiHooks = useMemo(
    () => ({ handoffApi, auditApi }),
    [handoffApi, auditApi],
  );

  const repo = useMemo(() => createHandoffRepository(hooks), [hooks]);
  const auditRepo = useMemo(() => createHandoffAuditRepository(hooks), [hooks]);

  return useMemo(() => ({ repo, auditRepo }), [repo, auditRepo]);
}
