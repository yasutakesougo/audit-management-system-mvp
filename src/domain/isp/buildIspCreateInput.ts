/**
 * buildIspCreateInput — ISP 作成入力の組み立て関数
 *
 * フォーム値と利用者マスタから `IspCreateInput` を生成する純粋関数。
 * `useSupportPlanForm` をドラフト責務のまま保ち、
 * ISP 作成のビジネスロジック（スナップショット注入・バリデーション）をここに集約する。
 *
 * ## 設計原則
 *
 * 1. **Snapshot は create 時に固定** — update では再生成しない
 * 2. **利用者未解決ならエラー** — ISP は監査対象なので、サイレントに undefined にしない
 * 3. **純粋関数** — 副作用なし、テスタブル
 *
 * ## 使用例
 *
 * ```ts
 * const targetUser = userLookup.get(userId);
 * const input = buildIspCreateInput(formValues, targetUser);
 * await ispRepo.create(input);
 * ```
 *
 * @see src/domain/isp/port.ts — IspCreateInput
 * @see src/domain/user/userRelation.ts — toUserSnapshot
 */

import type { IspCreateInput } from './port';
import type { IspFormValues } from './schema';
import { buildRequiredUserSnapshot } from '@/domain/user/buildRequiredUserSnapshot';

// ─────────────────────────────────────────────
// 入力型
// ─────────────────────────────────────────────

/**
 * UserMasterLike — ISP 作成に必要な利用者マスタの最小インターフェース。
 *
 * `domain/user/userRelation.ts` と同一の形状だが、
 * ここでは ISP ドメイン側の契約として明示的に宣言する。
 */
export interface IspUserMasterLike {
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
// エラー
// ─────────────────────────────────────────────

/**
 * ISP 作成時に対象利用者が解決できなかった場合のエラー。
 * UI 側でキャッチして適切なエラー表示に使用する。
 */
export class UserNotResolvedError extends Error {
  readonly code = 'USER_NOT_RESOLVED' as const;

  constructor(userId?: string) {
    const msg = userId
      ? `ISP作成対象の利用者が解決できません (userId: ${userId})`
      : 'ISP作成対象の利用者が指定されていません';
    super(msg);
    this.name = 'UserNotResolvedError';
  }
}

// ─────────────────────────────────────────────
// メイン関数
// ─────────────────────────────────────────────

/**
 * ISP 作成入力を組み立てる。
 *
 * - フォーム値を IspCreateInput に変換
 * - 利用者マスタから UserSnapshot を生成して注入
 * - 利用者が未解決の場合は UserNotResolvedError を throw
 *
 * @param formValues - ISP フォームの入力値
 * @param targetUser - 対象利用者マスタ（未解決の場合は undefined/null）
 * @returns IspCreateInput — リポジトリの create() にそのまま渡せる
 * @throws UserNotResolvedError — 利用者が未解決の場合
 */
export function buildIspCreateInput(
  formValues: IspFormValues,
  targetUser: IspUserMasterLike | undefined | null,
): IspCreateInput {
  if (!targetUser) {
    throw new UserNotResolvedError(formValues.userId);
  }

  return {
    ...formValues,
    userSnapshot: buildRequiredUserSnapshot(targetUser, formValues.userId),
  };
}
