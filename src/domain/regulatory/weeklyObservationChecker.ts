/**
 * 週次観察充足チェック — 純粋ドメイン関数
 *
 * 利用者ごとに直近の一定期間内に週次観察が実施されているかを判定する。
 * 「週次観察不足」の利用者 ID リストを返す。
 *
 * 判定ロジック:
 *   - 直近 lookbackDays（デフォルト30日）以内に1件以上の観察記録がなければ不足
 *   - 観察記録の構造上、userId フィールドで利用者を特定
 *
 * @see weeklyObservation.ts — WeeklyObservationRecord 型
 * @see severeAddonFindings.ts — usersWithoutWeeklyObservation フィールド
 */

// ---------------------------------------------------------------------------
// 最小インターフェース（OOM対策: 元の型をimportしない）
// ---------------------------------------------------------------------------

export interface ObservationRecordMinimal {
  userId: string;
  observationDate: string;
}

// ---------------------------------------------------------------------------
// Core Function
// ---------------------------------------------------------------------------

/**
 * 直近の観察が不足している利用者を特定する。
 *
 * @param targetUserIds — チェック対象の利用者ID一覧（加算候補者のみ渡せばよい）
 * @param observations — 全観察記録（listByUser で取得した結果をフラットにまとめたもの）
 * @param today — 基準日 (YYYY-MM-DD)
 * @param lookbackDays — 遡り日数（デフォルト30日。週1回要件なので30日あれば十分）
 */
export function findUsersWithoutRecentObservation(
  targetUserIds: string[],
  observations: ObservationRecordMinimal[],
  today: string,
  lookbackDays = 30,
): string[] {
  if (targetUserIds.length === 0) return [];

  const todayDate = new Date(today);
  const cutoffDate = new Date(todayDate);
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  // 利用者ごとに「cutoff 以降の観察があるか」を判定
  const usersWithObservation = new Set<string>();

  for (const obs of observations) {
    if (obs.observationDate >= cutoff && obs.observationDate <= today) {
      usersWithObservation.add(obs.userId);
    }
  }

  return targetUserIds.filter(id => !usersWithObservation.has(id));
}
