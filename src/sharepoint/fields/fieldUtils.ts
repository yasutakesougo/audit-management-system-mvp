/**
 * SharePoint フィールド定義 — 共通ユーティリティ
 *
 * joinSelect:              OData $select 文字列ビルダー
 * buildSelectFieldsFromMap: テナント差分に耐える動的 $select ビルダー
 */

/** readonly string[] を OData $select 文字列（カンマ区切り）に変換 */
export const joinSelect = (arr: readonly string[]) => arr.join(',');

/**
 * 汎用的な動的 $select ビルダー（テナント差分に耐える）
 * 存在するフィールドだけを $select に含めて 400 エラーを防ぐ
 */
export function buildSelectFieldsFromMap(
  fieldMap: Record<string, string>,
  existingInternalNames?: readonly string[],
  opts?: { alwaysInclude?: readonly string[]; fallback?: readonly string[] }
): readonly string[] {
  const alwaysInclude = (opts?.alwaysInclude ?? ['Id']).map((s) => String(s));
  const existing = new Set((existingInternalNames ?? []).map((x) => String(x).toLowerCase()));

  const candidates = Object.values(fieldMap)
    .map((v) => String(v))
    .filter(Boolean);

  // Fields API 取得失敗時は安全な fallback を返す（400 回避優先）
  if (existing.size === 0) {
    const fb = opts?.fallback ?? alwaysInclude;
    return Array.from(new Set(fb.map((x) => (x.toLowerCase() === 'id' ? 'Id' : x))));
  }

  const selected = candidates.filter((v) => existing.has(v.toLowerCase()));
  const merged = Array.from(
    new Set([...alwaysInclude, ...selected].map((x) => (x.toLowerCase() === 'id' ? 'Id' : x)))
  );

  return merged;
}
