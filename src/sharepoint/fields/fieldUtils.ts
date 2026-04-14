/**
 * SharePoint フィールド定義 — 共通ユーティリティ
 *
 * joinSelect:              OData $select 文字列ビルダー
 * buildSelectFieldsFromMap: テナント差分に耐える動的 $select ビルダー
 * SpFieldName / defineFieldMap / asField: Phase 2a branded 型強制（fail-open 維持）
 */

// ── Phase 2a: Branded SpFieldName ────────────────────────────────────────────
//
// Phase 2 の目的は「既知の SSOT フィールド参照を型で保護すること」であり、
// 「動的 drift 解決を早期に禁止すること」ではない。fail-open を維持したまま
// 段階的に brand 化を進め、動的解決サイトの audit 完了後にのみ strict narrow を
// 検討する（project_sp_drift_protection_completion / project_sp_query_next_steps）。

declare const spFieldBrand: unique symbol;

/**
 * SSOT 由来 or audit 済みの動的解決フィールド名を表す nominal 型。
 * ランタイムコストゼロ（型のみ）。
 */
export type SpFieldName = string & { readonly [spFieldBrand]: true };

/**
 * SSOT FIELD_MAP を branded 型付きで定義する helper。
 *
 * Before: `export const FIELD_MAP_X = { a: 'A' } as const;`
 * After:  `export const FIELD_MAP_X = defineFieldMap({ a: 'A' });`
 *
 * 呼出し側は一切変更不要（`FIELD_MAP_X.a` が `'A' & SpFieldName` になるだけ）。
 */
export const defineFieldMap = <T extends Record<string, string>>(
  m: T,
): { readonly [K in keyof T]: T[K] & SpFieldName } =>
  m as { readonly [K in keyof T]: T[K] & SpFieldName };

/**
 * 動的解決された field 名を SpFieldName として扱う escape hatch。
 *
 * 用途: drift tolerance のために実行時に probe した SP 内部名を
 *       builder に渡す場合（例: `buildEq(asField(this.mf(mapping, 'key')), v)`）。
 *
 * 濫用警告: SSOT 化すべき箇所で使わないこと。将来的に `// drift:` 等の
 *           コメント必須 lint ルールを検討中。
 */
export const asField = (s: string): SpFieldName => s as SpFieldName;

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
