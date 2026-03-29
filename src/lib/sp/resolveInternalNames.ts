/**
 * SharePoint 内部名の動적解決ユーティリティ
 */

/**
 * 解決結果の詳細情報
 */
export interface ResolutionResult<T extends string> {
  resolved: Record<T, string | undefined>;
  missing: T[];
  fieldStatus: Record<T, { resolvedName?: string; candidates: string[] }>;
}

/**
 * 実在するフィールド名 (available) の中から、候補 (candidates) に合致するものを詳細に解決する
 * 
 * @param available getListFieldInternalNames 等で取得した実在フィールド名のマッピング
 * @param candidates キーごとの候補配列 (優先順位順)
 */
export function resolveInternalNamesDetailed<T extends string>(
  available: Set<string>,
  candidates: Record<T, string[]>
): ResolutionResult<T> {
  const resolved = {} as Record<T, string | undefined>;
  const fieldStatus = {} as Record<T, { resolvedName?: string; candidates: string[] }>;
  const missing: T[] = [];
  
  for (const key in candidates) {
    if (Object.prototype.hasOwnProperty.call(candidates, key)) {
      const found = candidates[key].find(f => available.has(f));
      resolved[key] = found;
      fieldStatus[key] = {
        resolvedName: found,
        candidates: candidates[key]
      };
      if (!found) {
        missing.push(key);
      }
    }
  }
  
  return { resolved, missing, fieldStatus };
}

/**
 * 簡易版（既存互換用）
 * 解決された内部名のマッピング。見つからなかった場合は undefined。
 */
export function resolveInternalNames<T extends string>(
  available: Set<string>,
  candidates: Record<T, string[]>
): Record<T, string | undefined> {
  return resolveInternalNamesDetailed(available, candidates).resolved;
}

/**
 * 必須フィールドがすべて解決されているかチェックする
 */
export function areEssentialFieldsResolved<T extends string>(
  resolved: Record<T, string | undefined>,
  essentials: T[]
): boolean {
  return essentials.every(key => !!resolved[key]);
}
