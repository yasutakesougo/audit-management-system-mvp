/**
 * formatters.ts — Dashboard の表示用共通フォーマッタ
 */

/**
 * 割合をパーセンテージ表記にする（小数第1位まで）
 * @param rate 0.0 ~ 1.0 の実数
 * @returns '42.1%' などの文字列
 */
export function formatPercentage(rate: number): string {
  if (Number.isNaN(rate) || !isFinite(rate)) return '0.0%';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Uplift（変化量）を符号付きのパーセンテージ表記にする
 * @param uplift 変化量（例: 0.15 = 15.0pt）
 * @returns '+15.0pt', '-5.2pt', '0.0pt'
 */
export function formatUplift(uplift: number): string {
  if (Number.isNaN(uplift) || !isFinite(uplift)) return '0.0pt';
  const prefix = uplift > 0 ? '+' : '';
  return `${prefix}${(uplift * 100).toFixed(1)}pt`;
}

/**
 * ミリ秒を秒（s）表示にする（小数第2位まで）
 * @param ms ミリ秒
 * @returns '1.23s'
 */
export function formatLatencySec(ms: number | null): string {
  if (ms === null || Number.isNaN(ms) || !isFinite(ms)) return '-';
  return `${(ms / 1000).toFixed(2)}s`;
}
