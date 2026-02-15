/**
 * Schedules feature error classification and read-only fallback
 *
 * Classifies various error conditions into actionable categories with
 * user-facing messages and suggested actions.
 */

export type SchedulesErrorKind =
  | 'WRITE_DISABLED'
  | 'AUTH_REQUIRED'
  | 'LIST_MISSING'
  | 'CONTRACT_MISMATCH'
  | 'THROTTLED'
  | 'UNKNOWN';

export type SchedulesErrorInfo = {
  kind: SchedulesErrorKind;
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  details?: string[];
};

/**
 * Classify error into actionable category with user-facing info
 */
export function classifySchedulesError(error: unknown): SchedulesErrorInfo {
  // WriteDisabledError from repo guard
  if (error && typeof error === 'object' && 'code' in error && error.code === 'WRITE_DISABLED') {
    return {
      kind: 'WRITE_DISABLED',
      title: '閲覧専用モード',
      message: '現在、スケジュールの作成・編集・削除は無効になっています。',
      action: {
        label: '管理者に確認',
        href: undefined,
      },
      details: ['環境変数 VITE_WRITE_ENABLED が無効になっています。'],
    };
  }

  // HTTP 401/403 (auth)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      return {
        kind: 'AUTH_REQUIRED',
        title: '権限不足',
        message: 'SharePoint リストへのアクセス権限がありません。',
        action: {
          label: 'ログイン状態を確認',
          href: undefined,
        },
        details: [`HTTP ${status}: 認証が必要です。`],
      };
    }

    // HTTP 429/503 (throttle)
    if (status === 429 || status === 503) {
      return {
        kind: 'THROTTLED',
        title: 'サーバー混雑',
        message: 'SharePoint が混雑しています。しばらく待ってから再試行してください。',
        action: {
          label: '再読み込み',
          onClick: () => window.location.reload(),
        },
        details: [`HTTP ${status}: サーバー側の制限に達しました。`],
      };
    }

    // HTTP 404 (list missing)
    if (status === 404) {
      return {
        kind: 'LIST_MISSING',
        title: 'リストが見つかりません',
        message: 'SharePoint に ScheduleEvents リストが見つかりませんでした。',
        action: {
          label: '管理者に確認',
          href: undefined,
        },
        details: ['リストが削除されているか、名前が変更されている可能性があります。'],
      };
    }
  }

  // List not found (from diagnostic)
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message ?? '');
    if (message.includes('list-not-found') || message.includes('List not found')) {
      return {
        kind: 'LIST_MISSING',
        title: 'リストが見つかりません',
        message: 'SharePoint に ScheduleEvents リストが見つかりませんでした。',
        action: {
          label: '管理者に確認',
          href: undefined,
        },
        details: [message],
      };
    }
  }

  // Unknown/fallback
  return {
    kind: 'UNKNOWN',
    title: 'エラーが発生しました',
    message: error instanceof Error ? error.message : String(error),
    action: {
      label: '再読み込み',
      onClick: () => window.location.reload(),
    },
  };
}

/**
 * Check if error indicates read-only fallback should be enabled
 */
export function shouldFallbackToReadOnly(error: unknown): boolean {
  const info = classifySchedulesError(error);
  // AUTH_REQUIRED, LIST_MISSING, CONTRACT_MISMATCH should still allow reading
  // WRITE_DISABLED explicitly blocks writes
  // THROTTLED/UNKNOWN might be transient, don't automatically fallback
  return ['WRITE_DISABLED', 'AUTH_REQUIRED', 'LIST_MISSING', 'CONTRACT_MISMATCH'].includes(info.kind);
}
