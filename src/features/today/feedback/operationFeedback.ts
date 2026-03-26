import type { ToastKind } from '@/hooks/useToast';

export type OperationFailureKind =
  | 'schedules:conflict-412'
  | 'transport:rollback'
  | 'transport:sync-non-blocking';

export type OperationFeedback = {
  kind: OperationFailureKind;
  title: string;
  userMessage: string;
  toastSeverity: ToastKind;
  toastMessage: string;
  followUpActionText: string;
};

type OperationFeedbackContext = {
  userName?: string;
};

const DEFAULT_TARGET_LABEL = '対象利用者';

const resolveTargetLabel = (userName?: string): string => {
  const trimmed = userName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TARGET_LABEL;
};

export function isSchedulesConflictError(error: unknown): boolean {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined;

  const message = (() => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message?: unknown }).message ?? '');
    }
    return String(error ?? '');
  })().toLowerCase();

  return (
    status === 409 ||
    status === 412 ||
    message.includes('412') ||
    message.includes('conflict') ||
    message.includes('version of the item')
  );
}

export function resolveOperationFailureFeedback(
  kind: OperationFailureKind,
  context: OperationFeedbackContext = {},
): OperationFeedback {
  if (kind === 'schedules:conflict-412') {
    return {
      kind,
      title: '更新が競合しました',
      userMessage:
        '別の担当者が先に更新しました。最新を読み込んでから、もう一度実行してください。',
      toastSeverity: 'warning',
      toastMessage: '更新が競合しました',
      followUpActionText: '最新を読み込む',
    };
  }

  const target = resolveTargetLabel(context.userName);

  if (kind === 'transport:rollback') {
    return {
      kind,
      title: '送迎ステータスの保存に失敗しました',
      userMessage: `${target}の送迎更新は保存できなかったため、画面表示を元に戻しました。`,
      toastSeverity: 'warning',
      toastMessage: `${target}の更新を保存できず、表示を元に戻しました`,
      followUpActionText: '通信状態を確認して再試行',
    };
  }

  return {
    kind: 'transport:sync-non-blocking',
    title: '出欠同期の一部失敗',
    userMessage: `${target}の送迎更新は完了しましたが、出欠同期に失敗しました。`,
    toastSeverity: 'warning',
    toastMessage: `${target}の送迎更新は完了、出欠同期は未反映です`,
    followUpActionText: '出欠画面で状態を確認',
  };
}
