/**
 * computeStatusDelta — 前日スナップショットとの差分を計算する純粋関数
 *
 * 入力: today と yesterday の同一メトリクスセット
 * 出力: 各メトリクスの差分（正=悪化, 負=改善）
 *
 * ⚠️ 前日データが存在しない場合は null を返す（UI側でdelta非表示にする）。
 * ⚠️ このモジュールには永続化/取得/保存ロジックを含まない。
 *    データの永続化は呼び出し元（hook）の責務。
 *
 * @see inferTodayStatusSummary.ts — この出力を消費する
 */

// ─── Types ───────────────────────────────────────────────────

/** 前日スナップショット — StatusSummaryInput と同じメトリクスの部分セット */
export type DaySnapshot = {
  /** 未完了の記録件数（records残 + case残） */
  pendingCount: number;
  /** 当日欠席数 */
  absenceCount: number;
  /** 発熱者数 */
  feverCount: number;
  /** 未対応件数（high例外 + critical例外） */
  urgentCount: number;
};

/** 差分結果 — 正=悪化, 負=改善, 0=変化なし */
export type StatusDelta = {
  /** 未完了記録の増減 */
  pendingDelta: number;
  /** 欠席の増減 */
  absenceDelta: number;
  /** 発熱者の増減 */
  feverDelta: number;
  /** 未対応件数の増減 */
  urgentDelta: number;
};

// ─── Logic ───────────────────────────────────────────────────

/**
 * 今日と前日のスナップショットから差分を計算する。
 *
 * @returns 差分オブジェクト。yesterdayが null/undefined の場合は null。
 */
export function computeStatusDelta(
  today: DaySnapshot,
  yesterday: DaySnapshot | null | undefined,
): StatusDelta | null {
  if (!yesterday) return null;

  return {
    pendingDelta: today.pendingCount - yesterday.pendingCount,
    absenceDelta: today.absenceCount - yesterday.absenceCount,
    feverDelta: today.feverCount - yesterday.feverCount,
    urgentDelta: today.urgentCount - yesterday.urgentCount,
  };
}

/**
 * StatusDelta から表示用のサマリー文字列を生成する。
 *
 * 表示ルール:
 * - 変化なし → null（非表示）
 * - 最も影響の大きい変化を1つだけ表示（情報量を増やしすぎない）
 * - 正値 = 悪化 → 「+N」(赤系)
 * - 負値 = 改善 → 「-N」(緑系)
 *
 * @returns 差分テキスト（例: "記録 +4", "欠席 -2"）。変化なしなら null。
 */
export function formatDeltaText(delta: StatusDelta | null | undefined): string | null {
  if (!delta) return null;

  // 影響度の大きい順にチェック（重要度順）
  const candidates: Array<{ label: string; value: number }> = [
    { label: '記録', value: delta.pendingDelta },
    { label: '欠席', value: delta.absenceDelta },
    { label: '発熱', value: delta.feverDelta },
    { label: '未対応', value: delta.urgentDelta },
  ];

  // 変化量の絶対値が最大のものを選択
  let best: { label: string; value: number } | null = null;

  for (const candidate of candidates) {
    if (candidate.value === 0) continue;
    if (!best || Math.abs(candidate.value) > Math.abs(best.value)) {
      best = candidate;
    }
  }

  if (!best) return null;

  const sign = best.value > 0 ? '+' : '';
  return `前日比 ${best.label}${sign}${best.value}`;
}
