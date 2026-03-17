/**
 * buildRequiredUserSnapshot — 監査保存用 Snapshot の必須生成
 *
 * 各ドメインの create 境界で散在していた
 * 「user 未解決チェック → toUserSnapshot()」パターンを共通化する。
 *
 * ## 設計原則
 *
 * 1. **null/undefined なら即エラー** — 監査対象レコードで user を欠くことは許容しない
 * 2. **Snapshot は create 時に固定** — update では再生成しない
 * 3. **各ドメインは wrap 可能** — RequiredUserNotResolvedError をキャッチして
 *    ドメイン固有エラー（UserNotResolvedError 等）に変換してよい
 *
 * @example
 * ```ts
 * // ISP create 境界
 * const snapshot = buildRequiredUserSnapshot(targetUser, formValues.userId);
 * return { ...formValues, userSnapshot: snapshot };
 *
 * // Incident create 境界
 * const snapshot = buildRequiredUserSnapshot(targetUser, draft.userId);
 * return { ...base, userSnapshot: snapshot };
 * ```
 *
 * @see src/domain/user/userRelation.ts — toUserSnapshot, toUserRef
 */

import {
  toUserSnapshot,
  toUserRef,
  type UserSnapshot,
  type UserRef,
} from './userRelation';

// ─────────────────────────────────────────────
// 共通基底エラー
// ─────────────────────────────────────────────

/**
 * 監査保存対象のレコード作成時に、対象利用者が解決できなかった場合の基底エラー。
 *
 * 各ドメインはこのエラーをそのまま使ってもよいし、
 * キャッチしてドメイン固有エラーに変換してもよい。
 */
export class RequiredUserNotResolvedError extends Error {
  readonly code = 'REQUIRED_USER_NOT_RESOLVED' as const;
  readonly userId?: string;

  constructor(userId?: string) {
    const msg = userId
      ? `対象利用者が解決できません (userId: ${userId})`
      : '対象利用者が指定されていません';
    super(msg);
    this.name = 'RequiredUserNotResolvedError';
    this.userId = userId;
  }
}

// ─────────────────────────────────────────────
// UserMaster 互換 最小型（userRelation と同一）
// ─────────────────────────────────────────────

interface UserMasterLike {
  readonly UserID: string;
  readonly FullName: string;
  readonly DisabilitySupportLevel?: string | null;
  readonly severeFlag?: boolean | null;
  readonly IsHighIntensitySupportTarget?: boolean | null;
  readonly RecipientCertNumber?: string | null;
  readonly RecipientCertExpiry?: string | null;
  readonly GrantPeriodStart?: string | null;
  readonly GrantPeriodEnd?: string | null;
  readonly GrantedDaysPerMonth?: string | null;
  readonly UsageStatus?: string | null;
}

// ─────────────────────────────────────────────
// Snapshot 版（ISP / Incident 等 監査重要度が高いドメイン向け）
// ─────────────────────────────────────────────

/**
 * 対象利用者の UserSnapshot を必須で生成する。
 * user が null/undefined なら RequiredUserNotResolvedError を throw。
 *
 * @param user - 対象利用者マスタ（lookup で O(1) 解決済み）
 * @param userId - エラーメッセージ用の ID（省略可）
 * @returns UserSnapshot — 監査保存用のスナップショット
 * @throws RequiredUserNotResolvedError — user が null/undefined の場合
 */
export function buildRequiredUserSnapshot(
  user: UserMasterLike | null | undefined,
  userId?: string,
): UserSnapshot {
  if (!user) {
    throw new RequiredUserNotResolvedError(userId);
  }
  return toUserSnapshot(user);
}

// ─────────────────────────────────────────────
// Ref 版（Daily 等 軽量参照ドメイン向け）
// ─────────────────────────────────────────────

/**
 * 対象利用者の UserRef を必須で生成する。
 * user が null/undefined なら RequiredUserNotResolvedError を throw。
 *
 * @param user - 対象利用者マスタ
 * @param userId - エラーメッセージ用の ID（省略可）
 * @returns UserRef — 最小参照（userId + userName）
 * @throws RequiredUserNotResolvedError — user が null/undefined の場合
 */
export function buildRequiredUserRef(
  user: UserMasterLike | null | undefined,
  userId?: string,
): UserRef {
  if (!user) {
    throw new RequiredUserNotResolvedError(userId);
  }
  return toUserRef(user);
}
