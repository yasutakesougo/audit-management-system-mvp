// 日次記録から月次KPIを算出する純関数集
// Power Automateとフロントエンドで共通利用可能

import type {
    DailyRecord,
    IsoDate,
    MonthlyAggregationResult,
    MonthlyKpi,
    MonthlySummary,
    YearMonth
} from './types';

/**
 * 日付から YearMonth 形式に変換
 */
export function toYearMonth(date: Date): YearMonth {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}` as YearMonth;
}

/**
 * YearMonth から月の営業日数を算出
 * TODO: 祝日マスタとの連携で精度向上
 */
export function getWorkingDaysInMonth(yearMonth: YearMonth): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  let workingDays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const current = new Date(year, month - 1, day);
    const dayOfWeek = current.getDay();
    // 土日を除外（祝日は将来対応）
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * 月の総日数を取得
 */
export function getTotalDaysInMonth(yearMonth: YearMonth): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * 日次記録から月次KPIを集計
 * emptyRows は整合性を保つため、plannedRows - completedRows - inProgressRows で計算
 */
export function aggregateMonthlyKpi(
  dailyRecords: DailyRecord[],
  yearMonth: YearMonth,
  options: {
    useWorkingDays?: boolean;
    rowsPerDay?: number;
  } = {}
): MonthlyKpi {
  const { useWorkingDays = true, rowsPerDay = 19 } = options;

  // 月内の基準日数
  const totalDays = useWorkingDays
    ? getWorkingDaysInMonth(yearMonth)
    : getTotalDaysInMonth(yearMonth);

  // 計画行数 = 基準日数 × 1日あたりの行数
  const plannedRows = totalDays * rowsPerDay;

  // 実績の集計
  const completedRows = dailyRecords.filter(r => r.completed).length;
  const inProgressRows = dailyRecords.filter(r => !r.completed && !r.isEmpty).length;
  const specialNotes = dailyRecords.filter(r => r.hasSpecialNotes).length;
  const incidents = dailyRecords.filter(r => r.hasIncidents).length;

  // emptyRows は整合性保証: plannedRows - completedRows - inProgressRows（負にならない）
  const emptyRows = Math.max(0, plannedRows - completedRows - inProgressRows);

  return {
    totalDays,
    plannedRows,
    completedRows,
    inProgressRows,
    emptyRows,
    specialNotes,
    incidents,
  };
}

/**
 * 完了率を計算（パーセンテージ: 0..100）
 */
export function calculateCompletionRate(kpi: MonthlyKpi): number {
  if (kpi.plannedRows === 0) return 0;
  return Math.round((kpi.completedRows / kpi.plannedRows) * 100 * 100) / 100; // 小数点2桁
}

/**
 * 日次記録から初回・最終記録日を抽出（IsoDate型）
 */
export function extractRecordDateRange(dailyRecords: DailyRecord[]): {
  firstEntryDate?: IsoDate;
  lastEntryDate?: IsoDate;
} {
  const nonEmptyRecords = dailyRecords
    .filter(r => !r.isEmpty)
    .map(r => r.recordDate)
    .sort();

  return {
    firstEntryDate: nonEmptyRecords[0],
    lastEntryDate: nonEmptyRecords[nonEmptyRecords.length - 1],
  };
}

/**
 * メイン集計関数: 日次記録配列から完全な月次サマリーを生成
 */
export function aggregateMonthlySummary(
  userId: string,
  displayName: string,
  dailyRecords: DailyRecord[],
  yearMonth: YearMonth,
  options?: {
    useWorkingDays?: boolean;
    rowsPerDay?: number;
  }
): MonthlySummary {
  // KPI集計
  const kpi = aggregateMonthlyKpi(dailyRecords, yearMonth, options);

  // 完了率計算
  const completionRate = calculateCompletionRate(kpi);

  // 記録日範囲
  const { firstEntryDate, lastEntryDate } = extractRecordDateRange(dailyRecords);

  return {
    userId,
    yearMonth,
    displayName,
    lastUpdatedUtc: new Date().toISOString(),
    kpi,
    completionRate,
    firstEntryDate,
    lastEntryDate,
  };
}

/**
 * 複数ユーザーの一括集計
 */
export function aggregateMultipleUsers(
  userRecords: Array<{
    userId: string;
    displayName: string;
    dailyRecords: DailyRecord[];
  }>,
  yearMonth: YearMonth,
  options?: {
    useWorkingDays?: boolean;
    rowsPerDay?: number;
  }
): MonthlyAggregationResult[] {
  return userRecords.map(({ userId, displayName, dailyRecords }) => {
    try {
      const summary = aggregateMonthlySummary(
        userId,
        displayName,
        dailyRecords,
        yearMonth,
        options
      );

      return {
        summary,
        processedRecords: dailyRecords.length,
        skippedRecords: 0,
        errors: [],
      };
    } catch (error) {
      return {
        summary: {
          userId,
          yearMonth,
          displayName,
          lastUpdatedUtc: new Date().toISOString(),
          kpi: {
            totalDays: 0,
            plannedRows: 0,
            completedRows: 0,
            inProgressRows: 0,
            emptyRows: 0,
            specialNotes: 0,
            incidents: 0,
          },
          completionRate: 0,
        },
        processedRecords: 0,
        skippedRecords: dailyRecords.length,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  });
}

/**
 * 月次サマリーの差分更新判定
 */
export function shouldUpdateSummary(
  existing: MonthlySummary,
  updated: MonthlySummary
): boolean {
  // 主要KPIに変更があるかチェック
  const kpiChanged =
    existing.kpi.completedRows !== updated.kpi.completedRows ||
    existing.kpi.inProgressRows !== updated.kpi.inProgressRows ||
    existing.kpi.emptyRows !== updated.kpi.emptyRows ||
    existing.kpi.specialNotes !== updated.kpi.specialNotes ||
    existing.kpi.incidents !== updated.kpi.incidents;

  // 完了率の変更（小数点2桁まで）
  const rateChanged = Math.abs(existing.completionRate - updated.completionRate) > 0.01;

  return kpiChanged || rateChanged;
}