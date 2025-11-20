/**
 * CSS クラス値を結合・正規化するユーティリティ型
 * - string: "btn primary"
 * - number: 42 (ただし 0 は除外)
 * - object: { active: condition, disabled: false }
 * - array: ["btn", { primary: true }]
 * - 再帰的にネスト可能
 */
type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | Record<string, boolean | null | undefined>
  | ClassValue[];

const flatten = (input: ClassValue): string[] => {
  // 早期リターン: falsy値をまず弾く
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.flatMap(flatten);
  }

  if (typeof input === 'number') {
    // 数字の 0 は Tailwind CSS で意味のないクラス名になるため除外
    if (input === 0) return [];
    return [String(input)];
  }

  if (typeof input === 'string') {
    const value = input.trim();
    return value ? [value] : [];
  }

  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, included]) => Boolean(included))
      .map(([key]) => key.trim())
      .filter((key) => key.length > 0);
  }

  return [];
};

/**
 * CSS クラス名を結合・正規化するユーティリティ関数
 *
 * @param values 結合したいクラス値（文字列、数値、オブジェクト、配列）
 * @returns 正規化された単一のクラス文字列（重複なし、スペース区切り）
 *
 * @example
 * ```typescript
 * // 基本的な使用法
 * cn('btn', 'primary') // "btn primary"
 * cn('btn', null, 'primary') // "btn primary"
 *
 * // 条件付きクラス
 * cn('btn', {
 *   'btn-primary': isPrimary,
 *   'btn-disabled': isDisabled
 * }) // "btn btn-primary" (isPrimary=true, isDisabled=false の場合)
 *
 * // 配列とネスト
 * cn(['btn', { primary: true }], 'lg') // "btn primary lg"
 *
 * // Tailwind CSS での典型的な使用
 * cn(
 *   'px-4 py-2 rounded',
 *   variant === 'primary' && 'bg-blue-500 text-white',
 *   variant === 'secondary' && 'bg-gray-200 text-gray-900',
 *   { 'opacity-50': disabled }
 * )
 * ```
 */
export function cn(...values: ClassValue[]): string {
  const classes = values.flatMap(flatten).filter(Boolean);
  return Array.from(new Set(classes)).join(' ');
}

export default cn;
