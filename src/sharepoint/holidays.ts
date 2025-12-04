// 祝日・休業日などを表示するための簡易テーブル
// 必要に応じて SharePoint リストや外部APIに差し替えてください。
export const HOLIDAYS: Record<string, string> = {
  // '2025-01-01': '元日',
  // '2025-02-11': '建国記念の日',
};

export const getHolidayLabel = (isoDate: string): string | undefined => HOLIDAYS[isoDate];
