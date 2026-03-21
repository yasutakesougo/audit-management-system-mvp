// ---------------------------------------------------------------------------
// summarizeEvidence — エビデンス要約関数
//
// SuggestionEvidence → 1行要約。
// Today / ExceptionCenter / 通知で統一的に使える。
// ---------------------------------------------------------------------------

import type { SuggestionEvidence } from './types';

/**
 * SuggestionEvidence を1行の日本語要約に変換する。
 *
 * UI のカード表示やログ出力で統一的に使える。
 *
 * @example
 * ```ts
 * summarizeEvidence(evidence)
 * // => '前週比 +150%（日平均 5.0 → 2.0）'
 * // => '実施率 52%（閾値 60%未満）'
 * // => '高強度行動 7日で4回'
 * // => '14時台に全体の75%が集中'
 * ```
 */
export function summarizeEvidence(evidence: SuggestionEvidence): string {
  const { metric, currentValue, threshold, metrics } = evidence;

  // metrics がある場合はリッチな要約を試みる
  if (metrics) {
    // 行動増加傾向
    if ('pctIncrease' in metrics && 'recentAvg' in metrics && 'previousAvg' in metrics) {
      return `前週比 +${metrics.pctIncrease}%（日平均 ${metrics.previousAvg} → ${metrics.recentAvg}）`;
    }

    // 手順実施率
    if ('completionRate' in metrics && 'completed' in metrics && 'total' in metrics) {
      return `実施率 ${metrics.completionRate}%（${metrics.completed}/${metrics.total}件完了）`;
    }

    // 高強度行動
    if ('count' in metrics && 'threshold' in metrics && evidence.period.includes('7日')) {
      return `高強度行動 7日で${metrics.count}回（閾値 ${metrics.threshold}回）`;
    }

    // 時間帯集中
    if ('peakHour' in metrics && 'concentration' in metrics) {
      const pct = Math.round(Number(metrics.concentration) * 100);
      return `${metrics.peakHour}時台に全体の${pct}%が集中`;
    }

    // BIP未作成
    if ('totalIncidents' in metrics && 'activeBipCount' in metrics) {
      return `行動 ${metrics.totalIncidents}件に対し BIP ${metrics.activeBipCount}件`;
    }

    // データ不足
    if ('daysSinceLastRecord' in metrics) {
      const days = Number(metrics.daysSinceLastRecord);
      const daysLabel = days < 0 ? '記録なし' : `${days}日未記録`;
      return `${evidence.period}: ${currentValue}件のみ（${daysLabel}）`;
    }
  }

  // フォールバック: 基本情報のみ
  return `${metric}: ${currentValue}（閾値: ${threshold}）`;
}
