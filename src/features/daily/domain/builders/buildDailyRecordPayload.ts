import type { SaveDailyRecordInput } from '../legacy/DailyRecordRepository';
import type { SharePointDailyRecordPayload } from '../schema';

/**
 * Table型の保存入力をSharePointリスト用の純粋なPayload（JSON）に変換する
 * 副作用を持たないBuilder
 */
export function buildDailyRecordPayload(input: SaveDailyRecordInput): SharePointDailyRecordPayload {
  let recordDateISO: string;
  try {
    recordDateISO = new Date(input.date).toISOString();
  } catch {
    // 万が一無効な日付文字列だった場合は当日を採用（SharePoint保存エラー回避）
    const now = new Date();
    // 日付補正だけ行い、時刻部分はそのまま
    recordDateISO = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();
  }

  // undefined や null などのクレンジング担保
  const userRows = input.userRows.map(row => ({
    ...row,
    amActivity: row.amActivity?.trim() ?? '',
    pmActivity: row.pmActivity?.trim() ?? '',
    lunchAmount: row.lunchAmount?.trim() ?? '',
    specialNotes: row.specialNotes?.trim() ?? '',
    behaviorTags: row.behaviorTags ?? [],
  }));

  const userRowsJSON = JSON.stringify(userRows);

  return {
    Title: input.date,
    RecordDate: recordDateISO,
    ReporterName: input.reporter?.name?.trim() || '不明', // 空文字時は不明を使用
    ReporterRole: input.reporter?.role?.trim() || '生活支援員', 
    UserRowsJSON: userRowsJSON,
    UserCount: userRows.length,
  };
}
