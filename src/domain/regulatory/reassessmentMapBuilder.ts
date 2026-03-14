/**
 * 再評価日マップ構築 — 純粋ドメイン関数
 *
 * 利用者ごとの最終再評価日（reviewedAt）を PlanningSheetListItem から算出する。
 * hook から切り出すことで、テスト環境の OOM 問題を回避しつつ、
 * ドメインロジックを独立してテスト可能にする。
 *
 * @see useSevereAddonRealData.ts — この関数を使う hook
 * @see planningSheetReassessment.ts — 再評価ドメインロジック
 */

/**
 * 最小限の PlanningSheet 情報 — reviewedAt だけが必要
 *
 * PlanningSheetListItem の完全型を使わないことで、
 * テスト時に @/domain/isp/schema のインポートチェーンを避ける。
 */
export interface SheetWithReviewedAt {
  id: string;
  reviewedAt: string | null;
}

/**
 * 利用者ごとの最終再評価日を構築する。
 *
 * 1利用者が複数の PlanningSheet を持つ場合、最も新しい reviewedAt を採用する。
 */
export function buildLastReassessmentMap(
  sheetsByUser: Map<string, SheetWithReviewedAt[]>,
): Map<string, string | null> {
  const result = new Map<string, string | null>();

  for (const [userId, sheets] of sheetsByUser) {
    let latestReviewedAt: string | null = null;

    for (const sheet of sheets) {
      const reviewedAt = sheet.reviewedAt ?? null;
      if (reviewedAt !== null) {
        if (latestReviewedAt === null || reviewedAt > latestReviewedAt) {
          latestReviewedAt = reviewedAt;
        }
      }
    }

    result.set(userId, latestReviewedAt);
  }

  return result;
}

/**
 * 利用者ごとの PlanningSheet ID リストを構築する。
 */
export function buildPlanningSheetIdsByUser(
  sheetsByUser: Map<string, SheetWithReviewedAt[]>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [userId, sheets] of sheetsByUser) {
    result.set(userId, sheets.map(s => s.id));
  }

  return result;
}
