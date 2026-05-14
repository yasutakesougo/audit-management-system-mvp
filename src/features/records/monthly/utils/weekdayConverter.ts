const WEEKDAY_MAP: Record<string, number> = {
  // 日本語
  '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6,
  // 数値（文字列）
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  // 英語頭文字 (Sun=S, Mon=M, Tue=T, Wed=W, Thu=T/H, Fri=F, Sat=S) - 重複注意
  // 英語略称を優先するために map 内での一文字処理は慎重に行う
};

const ENGLISH_WEEKDAY_MAP: Record<string, number> = {
  'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6,
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
};

/**
 * 曜日文字列の配列を、0（日）〜 6（土）の数値配列に変換する。
 * 日本語（月火水...）、英語（Mon, Tue...）、数値（1, 2, 3...）など、
 * 多様な表記揺れを可能な限り吸収する。
 */
export function convertJapaneseWeekdaysToNumbers(days: string[]): number[] {
  if (!days || !Array.isArray(days)) return [];
  
  const results = new Set<number>();
  
  days.forEach(day => {
    let raw = day.trim().toLowerCase();
    if (!raw) return;

    // 1. 英語略称・フルスペルの判定
    if (ENGLISH_WEEKDAY_MAP[raw] !== undefined) {
      results.add(ENGLISH_WEEKDAY_MAP[raw]);
      return;
    }

    // 日本語の「曜日」「曜」を除去して一文字ずつの判定へ (月曜日 -> 月, 月火 -> 月火)
    raw = raw.replace(/曜日/g, '').replace(/曜/g, '');

    // 2. 一文字ずつの判定 (日本語「月火水」や数値「123」に対応)
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charAt(i);
      const val = WEEKDAY_MAP[char];
      if (val !== undefined) {
        results.add(val);
      }
    }
  });
  
  return Array.from(results).sort((a, b) => a - b);
}
