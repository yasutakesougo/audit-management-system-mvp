export type AuthBlockCode =
  | 'MSAL_IN_PROGRESS'
  | 'AUTH_LOADING'
  | 'NOT_AUTHENTICATED'
  | 'TOKEN_ACQUIRE_PENDING'
  | 'LIST_CHECK_PENDING'
  | 'LIST_NOT_FOUND'
  | 'FEATURE_DISABLED'
  | 'UNKNOWN';

export type AuthDiagInput = {
  inProgress: string;
  isAuthenticated: boolean;
  loading: boolean;
  tokenReady: boolean;
  listGate?: string;
  enabled?: boolean;
  accounts?: number;
  route?: string;
};

export type AuthDiagSummary = {
  code: AuthBlockCode;
  message: string;
  detail: Record<string, unknown>;
};

export const createAuthCorrId = (prefix: string = 'AUTH'): string => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}${time}-${random}`;
};

export const summarizeAuthBlockReason = (input: AuthDiagInput): AuthDiagSummary => {
  const { inProgress, isAuthenticated, loading, tokenReady, listGate, enabled, accounts, route } =
    input;

  const baseDetail: Record<string, unknown> = {
    inProgress,
    isAuthenticated,
    loading,
    tokenReady,
    listGate: listGate ?? null,
    enabled: enabled ?? null,
    accounts: accounts ?? null,
    route: route ?? null,
  };

  if (inProgress !== 'none' && inProgress !== 'None') {
    return { code: 'MSAL_IN_PROGRESS', message: 'サインイン処理中', detail: baseDetail };
  }
  if (loading) {
    return { code: 'AUTH_LOADING', message: '認証情報を確認中', detail: baseDetail };
  }
  if (!isAuthenticated) {
    return { code: 'NOT_AUTHENTICATED', message: '未サインイン', detail: baseDetail };
  }
  if (!tokenReady) {
    return { code: 'TOKEN_ACQUIRE_PENDING', message: '権限確認中', detail: baseDetail };
  }
  if (listGate === 'blocked') {
    return { code: 'LIST_NOT_FOUND', message: '必要なリストが見つかりません', detail: baseDetail };
  }
  if (listGate === 'checking' || listGate === 'idle') {
    return { code: 'LIST_CHECK_PENDING', message: 'リスト確認中', detail: baseDetail };
  }
  if (enabled === false) {
    return { code: 'FEATURE_DISABLED', message: '機能が無効です', detail: baseDetail };
  }

  return { code: 'UNKNOWN', message: '状態確認中', detail: baseDetail };
};
