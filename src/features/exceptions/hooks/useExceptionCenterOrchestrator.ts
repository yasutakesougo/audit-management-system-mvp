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
  detectAnalysisSetupExceptions,
  detectTransportSetupExceptions,
  aggregateExceptions,
  mapTriggeredToExceptionItems
} from '../domain/exceptionLogic';
import { buildExceptionCenterSummary } from '../domain/exceptionCenterSummary';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import type { IUserMaster } from '@/features/users/types';

export function useExceptionCenterOrchestrator() {
  const dataSources = useExceptionDataSources();
  const bridge = useBridgeExceptions();
  const { data: users = [] } = useUsersQuery();

  const allExceptions = useMemo(() => {
    if (dataSources.status === 'loading' && bridge.isLoading) return [];
    
    // 1. 既存の検出ロジック (L0/L1)
    const missingRecords = detectMissingRecords({
      expectedUsers: dataSources.expectedUsers,
      existingRecords: dataSources.todayRecords,
      targetDate: dataSources.today
    });
    const criticalHandoffs = detectCriticalHandoffs(dataSources.criticalHandoffs);
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);
    const dataOSItems = detectDataLayerExceptions(dataSources.dataOSResolutions);
    const setupIncomplete = detectAnalysisSetupExceptions(dataSources.userSummaries);
    const transportSetup = detectTransportSetupExceptions(dataSources.userSummaries);

    // 2. 新規 Bridge 検出ロジック (L2-ISP Integration)
    const bridgeItems = mapTriggeredToExceptionItems(bridge.exceptions, users as IUserMaster[]);

    // 3. 所有カテゴリを集約してソート
    return aggregateExceptions(
      missingRecords,
      criticalHandoffs, 
      attentionUsers,
      dataOSItems,
      bridgeItems,
      dataSources.integrityExceptions,
      setupIncomplete,
      transportSetup
    );
  }, [dataSources, bridge.exceptions, users]);

  // SSOT サマリの構築
  const summary = useMemo(() => buildExceptionCenterSummary(allExceptions), [allExceptions]);

  return {
    items: allExceptions,
    summary,
    isLoading: dataSources.status === 'loading' || bridge.isLoading,
    error: dataSources.error,
    refetch: () => {
      dataSources.refetchDailyRecords();
      bridge.refetch();
    }
  };
}
