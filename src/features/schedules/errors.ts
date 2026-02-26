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
  | 'NETWORK_ERROR'
  | 'CONFLICT'
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
  // Extract message from various error shapes (Error instance, NoticedError object, or string)
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = String(error);
  }

  const lowerMessage = message.toLowerCase();

  // eslint-disable-next-line no-console
  console.log('[schedules] [classify] error message info:', { message, lowerMessage, onLine: typeof navigator !== 'undefined' ? navigator.onLine : 'N/A' });

  // Offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      kind: 'NETWORK_ERROR',
      title: 'ネットワークエラー',
      message: 'ネットワークエラーが発生しました',
      action: {
        label: '再試行',
        onClick: () => window.location.reload(),
      },
    };
  }

  // Network error keywords
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('abort') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('failed to fetch')
  ) {
    return {
      kind: 'NETWORK_ERROR',
      title: 'ネットワークエラー',
      message: 'ネットワークエラーが発生しました',
      action: {
        label: '再試行',
        onClick: () => window.location.reload(),
      },
    };
  }

  // WriteDisabledError from repo guard
  const code = (error && typeof error === 'object' && 'code' in error) ? String((error as { code: unknown }).code) : '';
  if (code === 'WRITE_DISABLED') {
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

  // HTTP status based classification
  const status = (error && typeof error === 'object' && 'status' in error) ? Number((error as { status: unknown }).status) : undefined;
  if (status !== undefined) {
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

    if (status === 412) {
      return {
        kind: 'CONFLICT',
        title: '更新が競合しました',
        message: '他のユーザーがこの予定を更新しました。最新の情報を読み込んでからもう一度お試しください。',
        action: {
          label: '詳細を見る',
          onClick: () => {
            /* Handled by UI components like ScheduleDialogManager */
          },
        },
        details: ['HTTP 412: Precondition Failed (ETag mismatch)'],
      };
    }
  }

  // Conflict keyword match
  if (lowerMessage.includes('412') || lowerMessage.includes('conflict') || lowerMessage.includes('version of the item')) {
    return {
      kind: 'CONFLICT',
      title: '更新が競合しました',
      message: '他のユーザーがこの予定を更新しました。',
      action: {
        label: '詳細を見る',
        onClick: () => {},
      },
      details: [message],
    };
  }

  // List not found string match
  if (lowerMessage.includes('list-not-found') || lowerMessage.includes('list not found')) {
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

  // Unknown/fallback
  return {
    kind: 'UNKNOWN',
    title: 'エラーが発生しました',
    message: message || 'Unknown error',
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
