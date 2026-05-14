import { describe, expect, it } from 'vitest';
import { calculateDetailedPlannedRows } from '../plannedRowsCalculator';
import { aggregateMonthlyKpi } from '../aggregate';
import type { YearMonth, DailyRecord, IsoDate } from '../types';

describe('calculateDetailedPlannedRows - 予定行数精密計算ヘルパー', () => {
  it('デフォルト設定（後方互換性）: 2026年5月の営業日数は21日 (土日を除く月〜金)', () => {
    // optionsが空の場合、土日を除く月〜金で計算される。2026年5月の営業日は21日
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth);
    expect(result).toBe(21 * 17);
  });

  it('契約曜日の変更: 2026年5月において、月・水・金のみ契約（週3日）', () => {
    // 2026年5月の月・水・金の日数は、月曜4日、水曜4日、金曜5日 = 計13日
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      contractWeekdays: [1, 3, 5], // 月(1), 水(3), 金(5)
      rowsPerDay: 17,
    });
    expect(result).toBe(13 * 17);
  });

  it('祝日がある場合: 2026年5月のゴールデンウィーク期間を祝日指定', () => {
    // 2026-05-04 (月), 2026-05-05 (火), 2026-05-06 (水) を祝日に指定。
    // 通常の月金営業日21日から3日引いて、18日になる。
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      holidays: ['2026-05-04', '2026-05-05', '2026-05-06'],
    });
    expect(result).toBe(18 * 17);
  });

  it('欠席承認日がある場合: 2026年5月中に欠席連絡2回', () => {
    // 通常の月金営業日21日から、2026-05-11 (月) と 2026-05-12 (火) の欠席2日を除外、19日。
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      absences: ['2026-05-11', '2026-05-12'],
    });
    expect(result).toBe(19 * 17);
  });

  it('複合ケース: 契約曜日(月火水木金)、祝日あり、欠席日あり、rowsPerDay=10', () => {
    // 2026年5月 (月金営業日21日)
    // 祝日: 2026-05-04 (月 - 営業日、除外対象)
    // 欠席: 2026-05-15 (金 - 営業日、除外対象), 2026-05-17 (日 - 契約曜日に含まれないため二重引算に影響しない)
    // 実質開所予定日数: 21 - 1 (祝日) - 1 (欠席金曜) = 19日
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      contractWeekdays: [1, 2, 3, 4, 5],
      holidays: ['2026-05-04'],
      absences: ['2026-05-15', '2026-05-17'],
      rowsPerDay: 10,
    });
    expect(result).toBe(19 * 10);
  });

  it('重複とエッジケースの処理: 同日の祝日と欠席、契約外の祝日など', () => {
    // 2026年5月 (月金営業日21日)
    // 1. 祝日と欠席が同日の場合 (二重に引かれないこと)
    // 2026-05-04 (月 - 祝日) かつ 欠席指定
    // 2. 祝日が契約外曜日の場合 (カウントに影響しないこと)
    // 2026-05-03 (日 - 祝日)
    // 3. 欠席が契約外曜日の場合 (カウントに影響しないこと)
    // 2026-05-02 (土 - 欠席)
    
    // 通常の月金21日 - 2026-05-04(祝) = 20日
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      contractWeekdays: [1, 2, 3, 4, 5],
      holidays: ['2026-05-04', '2026-05-03'], // 05-03は日曜日なので元々カウント外
      absences: ['2026-05-04', '2026-05-02'], // 05-04は祝日として既にスキップ、05-02は土曜日
    });
    expect(result).toBe(20 * 17);
  });

  it('べき等性の確認: 同じ日付が複数回指定されても正しく計算されること', () => {
    const result = calculateDetailedPlannedRows('2026-05' as YearMonth, {
      contractWeekdays: [1, 1, 1], // 月曜のみ、重複指定
      absences: ['2026-05-11', '2026-05-11'], // 同じ日の欠席、重複指定
    });
    // 2026年5月の月曜は 4, 11, 18, 25 の4日。
    // 11日を除いて 3日分。
    expect(result).toBe(3 * 17);
  });
});

describe('aggregateMonthlyKpi - 精密化予定行数の統合テスト', () => {
  const createDailyRecord = (date: string, completed: boolean = true): DailyRecord => ({
    id: `record_${date}`,
    userId: 'USER001',
    userName: 'テスト太郎',
    recordDate: date as IsoDate,
    completed,
    hasSpecialNotes: false,
    hasIncidents: false,
    isEmpty: false,
  });

  it('詳細オプション指定ありの場合、aggregateMonthlyKpiで精密計算したplannedRowsが反映されること', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2026-05-01', true),
    ];

    const result = aggregateMonthlyKpi(records, '2026-05' as YearMonth, {
      contractWeekdays: [1, 2, 3, 4, 5],
      holidays: ['2026-05-04', '2026-05-05'], // 営業日21日 - 2日 = 19日
      absences: ['2026-05-08'], // 19日 - 1日 = 18日
      rowsPerDay: 17,
    });

    expect(result.plannedRows).toBe(18 * 17);
    expect(result.completedRows).toBe(1);
    expect(result.emptyRows).toBe((18 * 17) - 1); // 進行中は0のため、plannedRows - completedRows - inProgressRows
  });
});
