import type { YearMonth } from './types';

export interface PlannedRowsOptions {
  /** 契約曜日: 0 (日) から 6 (土) の配列。未指定の場合は [1, 2, 3, 4, 5] (月〜金) */
  contractWeekdays?: number[];
  /** 祝日日付リスト: "YYYY-MM-DD" 形式の文字列配列 */
  holidays?: string[];
  /** 欠席承認済み日付リスト: "YYYY-MM-DD" 形式の文字列配列 */
  absences?: string[];
  /** 1日あたりの標準手順行数 (デフォルト: 17) */
  rowsPerDay?: number;
}

/**
 * 契約曜日、祝日、欠席日付を考慮して、対象月の正確な予定行数を計算する。
 * 後方互換性のため、オプションが未指定の場合は従来の「土日を除く全日数」での計算結果と一致させる。
 */
export function calculateDetailedPlannedRows(
  yearMonth: YearMonth,
  options: PlannedRowsOptions = {}
): number {
  const {
    contractWeekdays = [1, 2, 3, 4, 5],
    holidays = [],
    absences = [],
    rowsPerDay = 17,
  } = options;

  const [year, month] = yearMonth.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();

  let plannedDays = 0;

  for (let day = 1; day <= totalDays; day++) {
    const y = String(year);
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // 1. 契約曜日に入っているか
    if (!contractWeekdays.includes(dayOfWeek)) {
      continue;
    }

    // 2. 祝日に含まれるか
    if (holidays.includes(dateStr)) {
      continue;
    }

    // 3. 欠席日に含まれるか
    if (absences.includes(dateStr)) {
      continue;
    }

    plannedDays++;
  }

  return plannedDays * rowsPerDay;
}
