/**
 * ISP共通: JST日付ユーティリティ
 * YYYY-MM-DD をローカル日付として解釈（JSTズレ対策）
 */
export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}
