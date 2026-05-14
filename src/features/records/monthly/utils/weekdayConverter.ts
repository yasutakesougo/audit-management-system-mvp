const WEEKDAY_MAP: Record<string, number> = {
  '日': 0,
  '月': 1,
  '火': 2,
  '水': 3,
  '木': 4,
  '金': 5,
  '土': 6,
};

/**
 * 日本語曜日文字列の配列を、0（日）〜 6（土）の数値配列に変換する
 */
export function convertJapaneseWeekdaysToNumbers(days: string[]): number[] {
  if (!days || !Array.isArray(days)) return [];
  
  return days
    .map(day => {
      // "月曜日" などの表記に対応するため、先頭の1文字を抽出
      const char = day.trim().charAt(0);
      return WEEKDAY_MAP[char];
    })
    .filter((val): val is number => val !== undefined);
}
