import { useMemo } from 'react';
import type { HubLaneModel, HubSyncStatus, SpLaneSource } from '../types/hub';
import { HUB_CONTRACT_VERSION, sourceLabelMap } from '../types/hub';

export function buildHubLaneModel(title: string, enabled: boolean, status: HubSyncStatus): HubLaneModel {
  const isSyncing = status.loading || status.isFetching;
  const hasError = !!status.error;
  const hasItems = (status.itemCount ?? 0) > 0;

  const state = !enabled ? 'disabled' : isSyncing ? 'idle' : hasError ? 'error' : hasItems ? 'active' : 'idle';

  const sourceLabel = status.source ? (sourceLabelMap[status.source as SpLaneSource] || status.source) : undefined;
  const itemCountLabel = status.itemCount !== undefined ? `${status.itemCount}件` : undefined;

  const subtitle = !enabled
    ? '連携が無効です'
    : isSyncing
    ? '同期中...'
    : hasError
    ? '同期エラー'
    : [sourceLabel, itemCountLabel].filter(Boolean).join(' / ') || 'データなし';

  return {
    version: HUB_CONTRACT_VERSION,
    state,
    title,
    subtitle,
    lastSyncAt: status.lastSyncAt,
    itemCount: status.itemCount,
    source: status.source as SpLaneSource | undefined,
    busy: status.loading || status.isFetching,
    onRetry: status.onRetry,
    canRetry: status.canRetry,
    cooldownUntil: status.cooldownUntil,
    failureCount: status.failureCount,
    retryAfter: status.retryAfter,
    details: {
      state,
      source: status.source as SpLaneSource | undefined,
      itemCount: status.itemCount,
      error: status.error instanceof Error ? status.error.message : typeof status.error === 'string' ? status.error : undefined,
      errorKind: status.errorKind,
      hint: status.hint,
    },
  };
}

export function useMonitoringHub(
  spSyncStatus: HubSyncStatus,
  presenceSyncStatus: HubSyncStatus,
  dailySyncStatus: HubSyncStatus,
  spEnabled: boolean
) {
  const spLane = useMemo(() => buildHubLaneModel('SharePoint 外部連携', spEnabled, spSyncStatus), [spEnabled, spSyncStatus]);
  const presenceLane = useMemo(() => buildHubLaneModel('利用者入退室', true, presenceSyncStatus), [presenceSyncStatus]);
  const dailyLane = useMemo(() => buildHubLaneModel('日次ケア記録', true, dailySyncStatus), [dailySyncStatus]);

  return {
    spLane,
    presenceLane,
    dailyLane,
  };
}
