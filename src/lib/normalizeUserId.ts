/**
 * UserID の正規化関数（共通ユーティリティ）
 *
 * SharePointやシステム間で `U-001`, `U001`, `u-001` など表記ゆれが発生するため、
 * 比較時は必ずこの関数を通す。
 *
 * 正規化ルール:
 *  1. 前後の空白を除去
 *  2. 大文字に統一
 *  3. 英数字以外（ハイフン等）を除去
 *
 * @example
 *   normalizeUserId('U-001')   // → 'U001'
 *   normalizeUserId('u001')    // → 'U001'
 *   normalizeUserId(' U-001 ') // → 'U001'
 */
export const normalizeUserId = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
