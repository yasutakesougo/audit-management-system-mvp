import type { SafeError } from '@/lib/errors';

export type SpSyncErrorKind = 'auth' | 'network' | 'timeout' | 'server' | 'unknown';

export interface SpSyncErrorClassification {
  errorKind: SpSyncErrorKind;
  hint: string;
}

/**
 * Pure helper to classify SharePoint synchronization errors based on stable heuristics.
 * This is used to drive the Monitoring Hub UI hints and attributes.
 */
export function classifySpSyncError(err: SafeError | null | undefined): SpSyncErrorClassification {
  if (!err) {
    return { errorKind: 'unknown', hint: '不明なエラーが発生しました。' };
  }

  const message = (err.message || '').toLowerCase();
  const status = (err as Record<string, unknown>).status as number | undefined;
  const statusCode = (err as Record<string, unknown>).statusCode as number | undefined;
  const effectiveStatus = status ?? statusCode;

  // 1. Auth Errors (MSAL, 401, 403)
  if (
    effectiveStatus === 401 ||
    effectiveStatus === 403 ||
    message.includes('interaction_required') ||
    message.includes('login_required') ||
    message.includes('consent_required') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return {
      errorKind: 'auth',
      hint: '認証の有効期限が切れたか、権限がありません。ログインし直すか管理者に確認してください。',
    };
  }

  // 2. Timeout Errors
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline') ||
    effectiveStatus === 504
  ) {
    return {
      errorKind: 'timeout',
      hint: '通信がタイムアウトしました。しばらく待ってから再試行してください。',
    };
  }

  // 3. Network Errors (Fetch failures, DNS, Offline)
  if (
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connectivity') ||
    (typeof window !== 'undefined' && !window.navigator.onLine)
  ) {
    return {
      errorKind: 'network',
      hint: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    };
  }

  // 4. Server Errors (5xx)
  if (effectiveStatus && effectiveStatus >= 500) {
    return {
      errorKind: 'server',
      hint: 'SharePoint サーバー側でエラーが発生しています。システム管理者に連絡してください。',
    };
  }

  // Default
  return {
    errorKind: 'unknown',
    hint: '同期中に予期しないエラーが発生しました。時間を置いて再度お試しください。',
  };
}
