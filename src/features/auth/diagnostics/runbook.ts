/**
 * Auth Diagnostics - Runbook Integration
 * Maps diagnostic reasons to troubleshooting documentation
 */

import type { AuthDiagnosticReason } from './collector';

/**
 * Runbook URL mapping
 * Links diagnostic reasons to internal documentation
 */
export const RUNBOOK_LINKS: Record<AuthDiagnosticReason, string> = {
  'account-mismatch': '/docs/ICEBERG_PDCA_RUNBOOK.md#account-mismatch',
  'login-failure': '/docs/ICEBERG_PDCA_RUNBOOK.md#login-failure',
  'token-expired': '/docs/ICEBERG_PDCA_RUNBOOK.md#token-expired',
  'list-not-found': '/docs/ICEBERG_PDCA_RUNBOOK.md#list-not-found',
  'list-check-pending': '/docs/ICEBERG_PDCA_RUNBOOK.md#list-check-pending',
  'network-error': '/docs/ICEBERG_PDCA_RUNBOOK.md#network-error',
  'popup-blocked': '/docs/ICEBERG_PDCA_RUNBOOK.md#popup-blocked',
  'unknown-error': '/docs/ICEBERG_PDCA_RUNBOOK.md#unknown-error',
};

/**
 * Get runbook URL for a diagnostic reason
 */
export function getRunbookLink(reason: AuthDiagnosticReason): string {
  return RUNBOOK_LINKS[reason] || '/docs/ICEBERG_PDCA_RUNBOOK.md#auth-general';
}

/**
 * Get user-friendly title for reason
 */
export function getReasonTitle(reason: AuthDiagnosticReason): string {
  const titles: Record<AuthDiagnosticReason, string> = {
    'account-mismatch': 'アカウント不一致',
    'login-failure': 'ログイン失敗',
    'token-expired': 'トークン期限切れ',
    'list-not-found': 'SharePointリスト未作成',
    'list-check-pending': 'リストチェック タイムアウト',
    'network-error': 'ネットワークエラー',
    'popup-blocked': 'Popupブロック',
    'unknown-error': '不明なエラー',
  };
  return titles[reason] || reason;
}
