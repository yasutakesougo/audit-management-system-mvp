import { useState, useEffect, useCallback } from 'react';
import { getSpHealthSignal, subscribeSpHealthSignal, clearSpHealthSignal, type SpHealthReasonCode } from '../spHealthSignalStore';
import { isDemoModeEnabled } from '@/lib/env';
import { getAppConfig } from '@/lib/env';
import { auditLog } from '@/lib/debugLogger';
import { findListEntry } from '@/sharepoint/spListRegistry';

export type ConnectionStatusKind = 'connected' | 'demo' | 'degraded' | 'checking';
export type ConnectionReason = 
  | 'config_missing' 
  | 'auth_failed' 
  | 'list_unreachable' 
  | 'setup_required' 
  | 'readiness_failed'
  | null;

export interface ConnectionStatus {
  status: ConnectionStatusKind;
  reason: ConnectionReason;
  message: string | null;
  actionUrl: string | null;
  /** 手動でシグナルをクリアして再試行を促す */
  reset: () => void;
}

/**
 * useConnectionStatus — 現場ユーザーに「なぜデータが出ないか」を伝えるための統合状態取得 Hook
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const [healthSignal, setHealthSignal] = useState(getSpHealthSignal());
  const config = getAppConfig();

  useEffect(() => {
    return subscribeSpHealthSignal((signal) => {
      setHealthSignal(signal);
    });
  }, []);

  const reset = useCallback(() => {
    clearSpHealthSignal();
  }, []);

  // 1. デモモードなら安泰
  if (isDemoModeEnabled()) {
    return {
      status: 'demo',
      reason: null,
      message: 'デモモードで動作中です（合成データを使用）',
      actionUrl: null,
      reset,
    };
  }

  // 2. 設定不足チェック
  const isConfigMissing = !config.VITE_SP_RESOURCE || !config.VITE_SP_SITE_URL;
  if (isConfigMissing) {
    return {
      status: 'degraded',
      reason: 'config_missing',
      message: 'SharePoint の接続先設定（VITE_SP_RESOURCE）が未完了です。',
      actionUrl: '/admin/status',
      reset,
    };
  }

  // 3. リアルタイム異常（認証・疎通）のチェック
  if (healthSignal) {
    const reasonMap: Record<SpHealthReasonCode, ConnectionReason> = {
      sp_auth_failed: 'auth_failed',
      sp_list_unreachable: 'list_unreachable',
      sp_bootstrap_blocked: 'setup_required',
      sp_limit_reached: 'readiness_failed',
      sp_index_pressure: 'readiness_failed',
      sp_schema_drift: 'readiness_failed',
    };

    // 1) 診断系・観測系リスト（lifecycle: optional）の不具合
    // 2) 重要度が低い（warning以下）のシグナル
    // これらは業務継続に直結しないため、同期遅延バナー（degraded）の対象から外す。
    // ※ 内部的な観測は継続されるが、現場ユーザーに不要な混乱を与えないための意図的な抑制。
    // Degraded banner is reserved for end-user impacting states only;
    // diagnostic/optional resources and non-critical severities remain observable
    // internally but do not change user-facing sync status.
    const entry = healthSignal.listName ? findListEntry(healthSignal.listName) : undefined;
    const isOptionalResource = entry?.lifecycle === 'optional';
    
    const isNonCritical = 
      healthSignal.severity === 'watch' || 
      healthSignal.severity === 'warning';

    const isUserImpacting = !isOptionalResource && !isNonCritical;

    if (!isUserImpacting) {
      // 抑制されたシグナルをデバッグ用に記録
      auditLog.debug('sp:health', 'Suppressed non-critical signal from UI banner', {
        listName: healthSignal.listName,
        severity: healthSignal.severity,
        reason: healthSignal.reasonCode,
        lifecycle: entry?.lifecycle
      });

      return {
        status: 'connected',
        reason: null,
        message: null,
        actionUrl: null,
        reset,
      };
    }

    return {
      status: 'degraded',
      reason: reasonMap[healthSignal.reasonCode] || 'readiness_failed',
      message: healthSignal.message,
      actionUrl: healthSignal.actionUrl || '/admin/status',
      reset,
    };
  }

  // 4. デフォルト：接続済みとみなす
  return {
    status: 'connected',
    reason: null,
    message: null,
    actionUrl: null,
    reset,
  };
};
