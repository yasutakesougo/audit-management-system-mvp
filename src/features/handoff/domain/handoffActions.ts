/**
 * 申し送りアクション判定 — Pure Functions
 *
 * meetingMode × status の組み合わせから、UI に表示すべきアクションボタンを導出する。
 * handoffStateMachine.getAllowedActions() を内部で使用し、
 * 遷移可能性のチェックと UI メタデータ（ラベル・色・アイコン）を一体化して返す。
 *
 * @example
 * const actions = getAvailableActions('未対応', 'evening');
 * // => [{ key: '確認済', label: '確認済', emoji: '✅', color: 'primary', nextStatus: '確認済' }, ...]
 *
 * @example
 * canTransition('未対応', '完了', 'morning');
 * // => true
 */

import { getAllowedActions } from '../handoffStateMachine';
import type { HandoffStatus, MeetingMode } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** UI が描画するアクションボタンの完全な記述子 */
export type HandoffActionButton = {
  /** 遷移先ステータス（一意キーとしても使用） */
  key: HandoffStatus;
  /** ボタンに表示するラベル */
  label: string;
  /** ボタンに付与する絵文字アイコン */
  emoji: string;
  /** MUI Button の color prop */
  color: 'primary' | 'warning' | 'success';
  /** 遷移先ステータス（key と同値。明示性のため別名を提供） */
  nextStatus: HandoffStatus;
};

// ────────────────────────────────────────────────────────────
// Action Metadata (internal)
// ────────────────────────────────────────────────────────────

/**
 * 遷移先ステータス → UI メタデータのマッピング
 * ここに定義されていないステータスは、アクションボタンとして表示されない。
 */
const ACTION_BUTTON_META: Partial<Record<HandoffStatus, Omit<HandoffActionButton, 'key' | 'nextStatus'>>> = {
  '確認済':    { label: '確認済', emoji: '✅', color: 'primary' },
  '明日へ持越': { label: '明日へ', emoji: '📅', color: 'warning' },
  '完了':      { label: '完了',   emoji: '🔒', color: 'success' },
  '対応済':    { label: '完了',   emoji: '✅', color: 'success' },
};

// ────────────────────────────────────────────────────────────
// Pure Functions
// ────────────────────────────────────────────────────────────

/**
 * 現在の status と meetingMode から、UI に表示すべきアクションボタン一覧を導出する。
 *
 * - 状態マシン (getAllowedActions) が許可した遷移のみ返す
 * - ACTION_BUTTON_META に定義がない遷移はフィルタアウトされる
 * - 返り値の順序は getAllowedActions の順序に従う
 *
 * @param status - 現在のステータス
 * @param meetingMode - 現在の会議モード
 * @returns アクションボタンの配列（空配列 = アクション不可）
 */
export function getAvailableActionButtons(
  status: HandoffStatus,
  meetingMode: MeetingMode,
): HandoffActionButton[] {
  const allowedStatuses = getAllowedActions(status, meetingMode);

  return allowedStatuses
    .map((nextStatus): HandoffActionButton | null => {
      const meta = ACTION_BUTTON_META[nextStatus];
      if (!meta) return null;
      return {
        key: nextStatus,
        nextStatus,
        ...meta,
      };
    })
    .filter((btn): btn is HandoffActionButton => btn !== null);
}

/**
 * 指定された遷移が許可されているかを判定する。
 *
 * @param currentStatus - 現在のステータス
 * @param nextStatus - 遷移先のステータス
 * @param meetingMode - 現在の会議モード
 * @returns true なら遷移可能
 */
export function canTransition(
  currentStatus: HandoffStatus,
  nextStatus: HandoffStatus,
  meetingMode: MeetingMode,
): boolean {
  return getAllowedActions(currentStatus, meetingMode).includes(nextStatus);
}

/**
 * 会議モード (evening/morning) でワークフローアクションを表示すべきかを判定する。
 *
 * normal モードでは従来の status toggle を使うため、ワークフローボタンは表示しない。
 *
 * @param meetingMode - 現在の会議モード
 * @param status - 現在のステータス
 * @returns true ならワークフローアクションボタンを表示する
 */
export function shouldShowWorkflowActions(
  meetingMode: MeetingMode,
  status: HandoffStatus,
): boolean {
  if (meetingMode === 'normal') return false;
  return getAvailableActionButtons(status, meetingMode).length > 0;
}
