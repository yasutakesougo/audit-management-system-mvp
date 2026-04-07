/**
 * @fileoverview Exception Center オーケストレーター
 * @description
 * 施設全体の横断監視を行うためのデータを統合・集約し、ExceptionCenterPage へ提供する。
 * Today は Execution (個人の行動) 、Exception Center は Oversight (全体の俯瞰) という役割分離を行う。
 */
import { useMemo } from 'react';
import { useExceptionDataSources } from './useExceptionDataSources';
import { useBridgeExceptions } from './useBridgeExceptions';
import { 
  detectMissingRecords, 
  detectCriticalHandoffs, 
  detectAttentionUsers, 
  detectDataLayerExceptions,
  aggregateExceptions,
  mapTriggeredToExceptionItems
} from '../domain/exceptionLogic';
import { buildExceptionCenterSummary } from '../domain/exceptionCenterSummary';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import type { IUserMaster } from '@/features/users/types';
import { usePersistentDrift } from '@/features/diagnostics/drift/hooks/usePersistentDrift';
import { getDriftRepairProposal } from '@/features/diagnostics/drift/domain/driftRepairProposal';
import type { DriftEvent } from '@/features/diagnostics/drift/domain/driftLogic';

export function useExceptionCenterOrchestrator() {
  const dataSources = useExceptionDataSources();
  const bridge = useBridgeExceptions();
  const { data: users = [] } = useUsersQuery();
  const { items: persistentDrifts, isLoading: driftLoading } = usePersistentDrift(3);

  const allExceptions = useMemo(() => {
    if ((dataSources.status === 'loading' || driftLoading) && bridge.isLoading) return [];
    
    // 1. 既存の検出ロジック (L0/L1)
    const missingRecords = detectMissingRecords({
      expectedUsers: dataSources.expectedUsers,
      existingRecords: dataSources.todayRecords,
      targetDate: dataSources.today
    });
    const criticalHandoffs = detectCriticalHandoffs(dataSources.criticalHandoffs);
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);
    const dataOSItems = detectDataLayerExceptions(dataSources.dataOSResolutions);

    // 2. Persistent Drift を例外に変換
    const persistentDriftItems = persistentDrifts.map((d: DriftEvent & { agingDays: number }) => {
      const proposal = getDriftRepairProposal(d.listName, d.fieldName, d.driftType);

      return {
        id: `drift-${d.id}`,
        category: 'integrity' as const,
        severity: 'high' as const,
        responsibilityScope: 'system' as const,
        title: `[⚠️ 持続的ドリフト] ${d.listName}`,
        description: `フィールド '${d.fieldName}' (${d.driftType}) の不整合が ${d.agingDays}日間 放置されています。`,
        updatedAt: d.detectedAt,
        actionLabel: '修復プランを表示',
        actionPath: proposal.actionPath,
        remediationProposal: {
          actionLabel: '修復を実行',
          impact: proposal.impact,
          requiresReview: proposal.requiresReview,
          actionPath: proposal.actionPath,
          actionKind: proposal.actionKind,
        },
      };
    });

    // 3. 新規 Bridge 検出ロジック (L2-ISP Integration)
    const bridgeItems = mapTriggeredToExceptionItems(bridge.exceptions, users as IUserMaster[]);

    // 4. 所有カテゴリを集約してソート
    return aggregateExceptions(
      missingRecords,
      criticalHandoffs, 
      attentionUsers,
      dataOSItems,
      persistentDriftItems,
      bridgeItems,
      dataSources.integrityExceptions
    );
  }, [dataSources, bridge.exceptions, users, persistentDrifts, driftLoading]);

  // SSOT サマリの構築
  const summary = useMemo(() => buildExceptionCenterSummary(allExceptions), [allExceptions]);

  return {
    items: allExceptions,
    summary,
    isLoading: dataSources.status === 'loading' || bridge.isLoading || driftLoading,
    error: dataSources.error,
    refetch: () => {
      dataSources.refetchDailyRecords();
      bridge.refetch();
    }
  };
}
