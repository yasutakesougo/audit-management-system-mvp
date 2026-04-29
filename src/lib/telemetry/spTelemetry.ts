/**
 * SharePoint 連携層 Telemetry
 * 
 * 動作イベントを集中記録し、システムの健康状態を可視化する。
 * Firebase が設定されていなくても auditLog 経由で動作する。
 */
import { auditLog } from '@/lib/debugLogger';
import { isDevMode } from '@/lib/env';

export type SpEventName =
  | 'sp:list_resolved'
  | 'sp:list_missing_optional'
  | 'sp:list_missing_required'
  | 'sp:provision_success'
  | 'sp:provision_partial'
  | 'sp:provision_failed'
  | 'sp:guid_resolution'
  | 'sp:schema_mismatch'
  | 'sp:bootstrap_start'
  | 'sp:bootstrap_complete'
  | 'provider_selected'
  | 'provider_fallback_triggered'
  | 'provider_error'
  | 'provider_contract_violation'
  | 'sp:row_skipped'
  | 'sp:fetch_fallback_success'
  | 'sp:idempotency_fallback_used'
  | 'provisioning_executed'
  | 'sp:approval_log_created'
  | 'sp:approval_log_skipped'
  | 'sp:approval_log_failed'
  | 'sp:child_lists_provision_success'
  | 'sp:child_lists_provision_failed'
  | 'sp:index_pressure_detected'
  | 'sp:index_limit_reached'
  | 'sp:fail_open_triggered';

export interface SpEventPayload {
  key?: string;
  listName?: string;
  providerName?: string;
  error?: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

/**
 * SharePoint 関連のイベントを記録する
 */
export function trackSpEvent(event: SpEventName, payload: SpEventPayload = {}) {
  const { listName, key } = payload;
  
  // 1. 本番用 Telemetry (将来的に Firebase 等へ送信)
  // if (firebaseConfigured) { ... }
  
  // 2. 開発用 / 監査用 Audit Log への振替
  const level = event.includes('failed') || event.includes('required') ? 'error' : 
                event.includes('mismatch') || event.includes('missing') ? 'warn' : 'info';
                
  auditLog[level](event as string, `${event}: ${listName || key || ''}`, {
    ...payload,
    timestamp: new Date().toISOString()
  });

  // 3. コンソール出力 (デバッグ用)
  if (isDevMode()) {
    const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    // eslint-disable-next-line no-console
    console.log(`${icon} [SP Telemetry] ${event}`, payload);
  }
}

/**
 * GUID 解決イベントのショートカット
 */
export function trackGuidResolution(listTitle: string, resolvedPath: string) {
  if (listTitle.startsWith('guid:')) {
    trackSpEvent('sp:guid_resolution', {
      key: listTitle,
      details: { resolvedPath }
    });
  }
}
