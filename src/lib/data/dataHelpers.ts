/**
 * SharePoint / DataProvider 用の共通ヘルパー
 */

/**
 * IDフィールドの揺れ（Id, id, ID）を吸収して数値として取得する。
 */
export function normalizeId(record: Record<string, unknown>, fallback: number = 0): number {
  if (!record) return fallback;
  
  const val = record['Id'] ?? record['id'] ?? record['ID'];
  if (val === undefined || val === null) return fallback;
  
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}
