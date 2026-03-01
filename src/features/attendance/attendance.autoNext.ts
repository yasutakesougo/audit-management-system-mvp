import type { AttendanceRowVM } from './types';

/**
 * checkInRun モードで検温保存後にスクロールする「次のターゲット行」を決定する純粋関数。
 *
 * 優先順位:
 *   ① 通所済み & 温度未入力（検温漏れを先に潰す）
 *   ② 未通所（canCheckIn = status === '未'）
 *   ③ なし → null
 */
export function getNextTargetUserCode(
  rows: ReadonlyArray<Pick<AttendanceRowVM, 'userCode' | 'status' | 'checkInAt'>>,
  tempByUser: Readonly<Record<string, number | undefined>>,
): string | null {
  // ① 通所済みで温度未入力
  for (const row of rows) {
    const isCheckedIn = row.status === '通所中' || row.status === '退所済';
    if (!isCheckedIn) continue;
    if (tempByUser[row.userCode] != null) continue;
    return row.userCode;
  }

  // ② 未通所
  for (const row of rows) {
    if (row.status === '未') return row.userCode;
  }

  // ③ なし
  return null;
}

/**
 * data-usercode 属性を持つ行要素へスムーズスクロール
 */
export function scrollToUserRow(userCode: string): void {
  const el = document.querySelector(`[data-usercode="${userCode}"]`);
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
