/**
 * @fileoverview 前回の午前活動・午後活動をユーザー別に保持する
 *
 * 保存処理後に呼び出して、各ユーザーの最新の活動内容を localStorage に保存。
 * 新しい行を作成する際に、前回の値をプリフィルするために使用する。
 */

const STORAGE_KEY = 'daily-table-record:lastActivities:v1';

export type LastActivities = {
  amActivity: string;
  pmActivity: string;
};

type LastActivitiesMap = Record<string, LastActivities>;

/**
 * 前回の活動データを取得する
 */
export function getLastActivities(): LastActivitiesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LastActivitiesMap;
  } catch {
    return {};
  }
}

/**
 * 指定ユーザーの前回活動データを取得する
 */
export function getLastActivitiesForUser(userId: string): LastActivities | null {
  const all = getLastActivities();
  return all[userId] ?? null;
}

/**
 * 保存成功時に呼び出し、各ユーザーの午前・午後活動を保存する。
 * 空文字の場合は上書きしない（前回の値を維持）。
 */
export function saveLastActivities(
  rows: Array<{ userId: string; amActivity: string; pmActivity: string }>,
): void {
  try {
    const existing = getLastActivities();

    for (const row of rows) {
      // 空の場合は前回値を維持
      if (row.amActivity.trim() || row.pmActivity.trim()) {
        existing[row.userId] = {
          amActivity: row.amActivity.trim() || existing[row.userId]?.amActivity || '',
          pmActivity: row.pmActivity.trim() || existing[row.userId]?.pmActivity || '',
        };
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('前回活動データの保存に失敗:', error);
  }
}
