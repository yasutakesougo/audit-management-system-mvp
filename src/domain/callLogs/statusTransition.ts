import type { CallLog, CallLogStatus, CreateCallLogInput } from './schema';

type CallbackRequirementInput = Pick<CreateCallLogInput, 'needCallback' | 'callbackDueAt'>;

export type CallLogStatusTransitionResult = {
  status: CallLogStatus;
  completedAt: string | undefined;
};

function hasCallbackDueAt(input: CallbackRequirementInput): boolean {
  return typeof input.callbackDueAt === 'string' && input.callbackDueAt.trim().length > 0;
}

/**
 * 新規作成時の初期ステータスを決定する。
 * 折返し要件がある場合は callback_pending、それ以外は new。
 */
export function deriveInitialCallLogStatus(input: CallbackRequirementInput): CallLogStatus {
  if (input.needCallback || hasCallbackDueAt(input)) {
    return 'callback_pending';
  }
  return 'new';
}

/**
 * ステータス遷移時の completedAt を正規化する。
 * - done            -> completedAt を付与（初回のみ）
 * - new / callback  -> completedAt をクリア
 */
export function applyCallLogStatusTransition(
  current: Pick<CallLog, 'status' | 'completedAt'>,
  nextStatus: CallLogStatus,
  now: Date = new Date(),
): CallLogStatusTransitionResult {
  if (nextStatus === 'done') {
    return {
      status: 'done',
      completedAt: current.completedAt ?? now.toISOString(),
    };
  }

  return {
    status: nextStatus,
    completedAt: undefined,
  };
}
