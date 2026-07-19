/**
 * @fileoverview Exception Center オーケストレーター
 * @description
 * 施設全体の横断監視を行うためのデータを統合・集約し、ExceptionCenterPage へ提供する。
 * Today は Execution (個人の行動) 、Exception Center は Oversight (全体の俯瞰) という役割分離を行う。
 */
import { useMemo } from 'react';
import { useExceptionDataSources } from './useExceptionDataSources';
import { useBridgeExceptions } from './useBridgeExceptions';
import { useDailyRecordExceptions } from './useDailyRecordExceptions';
import { useHandoffExceptions } from './useHandoffExceptions';
import { useCorrectiveActionExceptions } from './useCorrectiveActionExceptions';
import {
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
import type {
  ActionSuggestion,
  ActionSuggestionState,
} from '@/features/action-engine/domain/types';

export interface UseExceptionCenterOrchestratorOptions {
  correctiveSuggestions?: ActionSuggestion[];
  correctiveStates?: Record<string, ActionSuggestionState>;
}

export function useExceptionCenterOrchestrator({
  correctiveSuggestions = [],
  correctiveStates = {},
}: UseExceptionCenterOrchestratorOptions = {}) {
  const dataSources = useExceptionDataSources();
  const bridge = useBridgeExceptions();
  const { data: users = [] } = useUsersQuery();
  const { items: dailyRecordItems } = useDailyRecordExceptions({
    expectedUsers: dataSources.expectedUsers,
    existingRecords: dataSources.todayRecords,
    integrityExceptions: dataSources.integrityExceptions,
    targetDate: dataSources.today,
  });
  const { items: handoffItems } = useHandoffExceptions({
    handoffs: dataSources.criticalHandoffs,
  });
  const { items: correctiveActionItems } = useCorrectiveActionExceptions({
    suggestions: correctiveSuggestions,
    states: correctiveStates,
  });

  const allExceptions = useMemo(() => {
    if (dataSources.status === 'loading' && bridge.isLoading) return [];
    
    // 1. 既存の検出ロジック (L0/L1)
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);
    const dataOSItems = detectDataLayerExceptions(dataSources.dataOSResolutions);
    const setupIncomplete = detectAnalysisSetupExceptions(dataSources.userSummaries);
    const transportSetup = detectTransportSetupExceptions(dataSources.userSummaries);

    // 2. 新規 Bridge 検出ロジック (L2-ISP Integration)
    const bridgeItems = mapTriggeredToExceptionItems(bridge.exceptions, users as IUserMaster[]);

    // 3. 所有カテゴリを集約してソート
    return aggregateExceptions(
      dailyRecordItems,
      handoffItems,
      correctiveActionItems,
      attentionUsers,
      dataOSItems,
      bridgeItems,
      setupIncomplete,
      transportSetup
    );
  }, [
    dataSources,
    bridge.exceptions,
    users,
    dailyRecordItems,
    handoffItems,
    correctiveActionItems,
  ]);

  const evaluationItems = useMemo(
    () => allExceptions.filter(
      (item) => item.category !== 'corrective-action' || Boolean(item.stableId),
    ),
    [allExceptions],
  );

  // SSOT サマリの構築
  const summary = useMemo(
    () => buildExceptionCenterSummary(evaluationItems),
    [evaluationItems],
  );

  return {
    items: allExceptions,
    evaluationItems,
    summary,
    isLoading: dataSources.status === 'loading' || bridge.isLoading,
    error: dataSources.error,
    refetch: () => {
      dataSources.refetchDailyRecords();
      bridge.refetch();
    }
  };
}
