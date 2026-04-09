/**
 * IBDページガード
 *
 * `/daily/support` は IBD対象者専用のブリッジUI。
 * URL直打ち・planningSheetId直渡しを含むあらゆる侵入経路で、
 * 非対象利用者を `/daily/table` へリダイレクトする。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md — IBD Mode
 * @see docs/navigation-structure.md — IBD対象者かどうかの分岐点
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type IbdGuardUser = {
  IsHighIntensitySupportTarget?: boolean | null;
};

export type IbdGuardStatus = 'loading' | 'allowed' | 'redirecting';

/**
 * IBDページガードの判定ロジック（純粋関数）
 *
 * @param userId    URL から渡された利用者ID（undefined = 未選択 = ウィザードStep1待ち）
 * @param users     利用者マスタ
 * @param usersReady 利用者マスタのロード完了フラグ
 * @returns 'loading' | 'allowed' | 'redirecting'
 */
export function resolveIbdGuardStatus(
  userId: string | undefined,
  users: IbdGuardUser[],
  usersReady: boolean,
): IbdGuardStatus {
  // userId未指定 = ウィザードStep1で利用者を選ぶ状態。UserSelectionStepが絞り込むためここでは許可
  if (!userId) return 'allowed';

  // ユーザーマスタ未ロード → 判定保留
  if (!usersReady || users.length === 0) return 'loading';

  // 利用者不明 → 侵入とみなしリダイレクト
  const user = (users as Array<IbdGuardUser & { UserID?: string; Id?: number }>).find(
    (u) => u.UserID === userId || String(u.Id) === userId,
  );
  if (!user) return 'redirecting';

  // IBD非対象 → リダイレクト
  return user.IsHighIntensitySupportTarget === true ? 'allowed' : 'redirecting';
}

/**
 * IBDページガードフック
 *
 * `userId` が指定されている場合、利用者マスタ照合で IBD 対象かどうかを確認する。
 * 非対象またはユーザー不明の場合は `/daily/table` へリダイレクトし `redirecting` を返す。
 *
 * @param userId     URLパラメータから取得した利用者ID（なければ undefined）
 * @param users      利用者マスタ配列
 * @param usersReady 利用者マスタのロード完了フラグ
 * @returns IbdGuardStatus — 'loading' 中はスピナー表示推奨
 */
export function useIbdPageGuard(
  userId: string | undefined,
  users: IbdGuardUser[],
  usersReady: boolean,
): IbdGuardStatus {
  const navigate = useNavigate();

  const status = resolveIbdGuardStatus(userId, users, usersReady);

  useEffect(() => {
    if (status === 'redirecting') {
      navigate('/daily/table', { replace: true });
    }
  }, [status, navigate]);

  return status;
}
