/**
 * Proposal State Machine — 状態遷移ガード
 *
 * accepted / rejected は不可逆。deferred のみ再検討可能。
 *
 * @module features/support-plan-guide/domain/proposalStateMachine
 */

import type { ProposalStatus } from './proposalTypes';

/** 許可された遷移テーブル */
const ALLOWED_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  proposed: ['accepted', 'deferred', 'rejected'],
  deferred: ['proposed', 'accepted', 'rejected'],
  accepted: [],
  rejected: [],
} as const;

/**
 * from → to の状態遷移が許可されるかを判定する。
 */
export const canTransition = (from: ProposalStatus, to: ProposalStatus): boolean => {
  return ALLOWED_TRANSITIONS[from].includes(to);
};

/**
 * 状態遷移を実行する。不正な遷移の場合はエラーを返す。
 */
export const transition = (
  from: ProposalStatus,
  to: ProposalStatus,
): { ok: true; status: ProposalStatus } | { ok: false; error: string } => {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Invalid transition: ${from} → ${to}`,
    };
  }
  return { ok: true, status: to };
};
