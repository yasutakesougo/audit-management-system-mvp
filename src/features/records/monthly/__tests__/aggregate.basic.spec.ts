import { describe, expect, it } from 'vitest';
import {
    aggregateMonthlyKpi,
    aggregateMonthlySummary,
    aggregateMultipleUsers,
    calculateCompletionRate,
    getTotalDaysInMonth,
    getWorkingDaysInMonth
} from '../aggregate';
import type { DailyRecord, IsoDate, YearMonth } from '../types';

describe('aggregateMonthlyKpi - 基本集計テスト', () => {
  const createDailyRecord = (
    date: string,
    completed: boolean = true,
    hasSpecialNotes: boolean = false,
    hasIncidents: boolean = false,
    isEmpty: boolean = false
  ): DailyRecord => ({
    id: `record_${date}`,
    userId: 'USER001',
    userName: '山田太郎',
    recordDate: date as IsoDate,
    completed,
    hasSpecialNotes,
    hasIncidents,
    isEmpty
  });

  it('完全入力月（31件全完了）→ KPI計算確認', () => {
    // 2024年1月（31件の完了記録）
    const records: DailyRecord[] = [];
    for (let day = 1; day <= 31; day++) {
      const date = `2024-01-${day.toString().padStart(2, '0')}`;
      records.push(createDailyRecord(date, true, false, false, false));
    }

    const result = aggregateMonthlyKpi(records, '2024-01' as YearMonth);

    expect(result.totalDays).toBe(23); // 2024年1月の営業日数（土日除く）
    expect(result.plannedRows).toBe(23 * 19); // 営業日数 × 19行/日
    expect(result.completedRows).toBe(31); // 完了記録の件数
    expect(result.inProgressRows).toBe(0);
    expect(result.emptyRows).toBe(437 - 31); // plannedRows - completedRows - inProgressRows
    expect(result.specialNotes).toBe(0);
    expect(result.incidents).toBe(0);
  });

  it('部分完了月（完了5件・進行中3件・空2件）→ KPI分布確認', () => {
    const records: DailyRecord[] = [
      // 完了記録 5件
      createDailyRecord('2024-02-01', true),
      createDailyRecord('2024-02-02', true),
      createDailyRecord('2024-02-03', true),
      createDailyRecord('2024-02-05', true),
      createDailyRecord('2024-02-06', true),

      // 進行中記録 3件
      createDailyRecord('2024-02-07', false, false, false, false),
      createDailyRecord('2024-02-08', false, false, false, false),
      createDailyRecord('2024-02-09', false, false, false, false),

      // 空記録 2件
      createDailyRecord('2024-02-12', false, false, false, true),
      createDailyRecord('2024-02-13', false, false, false, true),
    ];

    const result = aggregateMonthlyKpi(records, '2024-02' as YearMonth);

    expect(result.totalDays).toBe(21); // 2024年2月の営業日数
    expect(result.plannedRows).toBe(21 * 19); // 営業日数 × 19行/日
    expect(result.completedRows).toBe(5);
    expect(result.inProgressRows).toBe(3);
    expect(result.emptyRows).toBe(399 - 5 - 3); // plannedRows - completedRows - inProgressRows
    expect(result.specialNotes).toBe(0);
    expect(result.incidents).toBe(0);
  });

  it('特記事項・事故ありケース → カウント確認', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-03-01', true, true, false, false), // 完了 + 特記
      createDailyRecord('2024-03-02', true, false, true, false), // 完了 + 事故
      createDailyRecord('2024-03-03', false, true, true, false), // 進行中 + 特記 + 事故
      createDailyRecord('2024-03-04', false, false, false, true), // 空
      createDailyRecord('2024-03-05', true, false, false, false)  // 完了のみ
    ];

    const result = aggregateMonthlyKpi(records, '2024-03' as YearMonth);

    expect(result.completedRows).toBe(3);
    expect(result.inProgressRows).toBe(1);
    expect(result.emptyRows).toBe(399 - 3 - 1); // plannedRows - completedRows - inProgressRows (2024年3月は21営業日 = 399行)
    expect(result.specialNotes).toBe(2); // 3/1, 3/3
    expect(result.incidents).toBe(2); // 3/2, 3/3
  });

  it('空データ → デフォルト値設定', () => {
    const records: DailyRecord[] = [];

    const result = aggregateMonthlyKpi(records, '2024-05' as YearMonth);

    expect(result.totalDays).toBe(23); // 2024年5月の営業日数
    expect(result.plannedRows).toBe(23 * 19); // 営業日数 × 19行/日
    expect(result.completedRows).toBe(0);
    expect(result.inProgressRows).toBe(0);
    expect(result.emptyRows).toBe(437); // plannedRows - completedRows - inProgressRows
    expect(result.specialNotes).toBe(0);
    expect(result.incidents).toBe(0);
  });
});

describe('calculateCompletionRate - 完了率計算テスト', () => {
  const mockKpi = (plannedRows: number, completedRows: number) => ({
    totalDays: 20,
    plannedRows,
    completedRows,
    inProgressRows: 0,
    emptyRows: 0,
    specialNotes: 0,
    incidents: 0,
  });

  it('正常ケース：完了率50% → 50.00%', () => {
    const kpi = mockKpi(100, 50);
    expect(calculateCompletionRate(kpi)).toBe(50.00);
  });

  it('100%完了 → 100.00%', () => {
    const kpi = mockKpi(200, 200);
    expect(calculateCompletionRate(kpi)).toBe(100.00);
  });

  it('予定0の場合 → 0%', () => {
    const kpi = mockKpi(0, 0);
    expect(calculateCompletionRate(kpi)).toBe(0.0);
  });

  it('部分完了 → 小数点2桁精度', () => {
    const kpi = mockKpi(37, 25); // 25/37 ≈ 67.57%
    expect(calculateCompletionRate(kpi)).toBeCloseTo(67.57, 2);
  });
});

describe('aggregateMonthlySummary - 月次サマリー生成テスト', () => {
  const createDailyRecord = (
    date: string,
    completed: boolean = true,
    hasSpecialNotes: boolean = false,
    hasIncidents: boolean = false,
    isEmpty: boolean = false
  ): DailyRecord => ({
    id: `record_${date}`,
    userId: 'USER001',
    userName: '山田太郎',
    recordDate: date,
    completed,
    hasSpecialNotes,
    hasIncidents,
    isEmpty
  });

  it('完全月次サマリー生成（完了率計算含む）', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-06-01', true, true, false, false), // 完了 + 特記
      createDailyRecord('2024-06-02', true, false, false, false), // 完了のみ
      createDailyRecord('2024-06-03', false, false, true, false), // 進行中 + 事故
      createDailyRecord('2024-06-04', false, false, false, true), // 空
    ];

    const summary = aggregateMonthlySummary(
      'USER001',
      '山田太郎',
      records,
      '2024-06' as YearMonth
    );

    expect(summary.userId).toBe('USER001');
    expect(summary.displayName).toBe('山田太郎');
    expect(summary.yearMonth).toBe('2024-06');
    expect(summary.kpi.completedRows).toBe(2);
    expect(summary.kpi.inProgressRows).toBe(1);
    expect(summary.kpi.emptyRows).toBe(380 - 2 - 1); // plannedRows - completedRows - inProgressRows (2024年6月は20営業日 = 380行)
    expect(summary.kpi.specialNotes).toBe(1);
    expect(summary.kpi.incidents).toBe(1);
    expect(summary.completionRate).toBeGreaterThan(0); // 完了率が計算されている
    expect(summary.lastUpdatedUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO形式
  });
});

describe('getWorkingDaysInMonth - 営業日数計算テスト', () => {
  it('2024年1月の営業日数 → 23日', () => {
    expect(getWorkingDaysInMonth('2024-01' as YearMonth)).toBe(23);
  });

  it('2024年2月（うるう年）の営業日数 → 21日', () => {
    expect(getWorkingDaysInMonth('2024-02' as YearMonth)).toBe(21);
  });

  it('2024年5月の営業日数 → 23日', () => {
    expect(getWorkingDaysInMonth('2024-05' as YearMonth)).toBe(23);
  });

  it('2024年6月の営業日数 → 20日', () => {
    expect(getWorkingDaysInMonth('2024-06' as YearMonth)).toBe(20);
  });
});

describe('getTotalDaysInMonth - 月総日数計算テスト', () => {
  it('2024年1月の総日数 → 31日', () => {
    expect(getTotalDaysInMonth('2024-01' as YearMonth)).toBe(31);
  });

  it('2024年2月（うるう年）の総日数 → 29日', () => {
    expect(getTotalDaysInMonth('2024-02' as YearMonth)).toBe(29);
  });

  it('2023年2月（平年）の総日数 → 28日', () => {
    expect(getTotalDaysInMonth('2023-02' as YearMonth)).toBe(28);
  });

  it('2024年4月の総日数 → 30日', () => {
    expect(getTotalDaysInMonth('2024-04' as YearMonth)).toBe(30);
  });
});

describe('aggregateMultipleUsers - 複数ユーザー集計テスト', () => {
  const createDailyRecord = (
    userId: string,
    date: string,
    completed: boolean = true,
    hasSpecialNotes: boolean = false,
    hasIncidents: boolean = false,
    isEmpty: boolean = false
  ): DailyRecord => ({
    id: `record_${userId}_${date}`,
    userId,
    userName: userId === 'USER001' ? '山田太郎' : '佐藤花子',
    recordDate: date,
    completed,
    hasSpecialNotes,
    hasIncidents,
    isEmpty
  });

  const createUserRecords = (userId: string, displayName: string, records: DailyRecord[]) => ({
    userId,
    displayName,
    dailyRecords: records
  });

  it('2ユーザーの2024年6月集計', () => {
    const userRecords = [
      createUserRecords('USER001', '山田太郎', [
        createDailyRecord('USER001', '2024-06-01', true, false, false, false),
        createDailyRecord('USER001', '2024-06-02', true, true, false, false), // 特記あり
        createDailyRecord('USER001', '2024-06-03', false, false, false, false), // 進行中
      ]),
      createUserRecords('USER002', '佐藤花子', [
        createDailyRecord('USER002', '2024-06-01', true, false, false, false),
        createDailyRecord('USER002', '2024-06-02', false, false, false, true), // 空記録
      ])
    ];

    const results = aggregateMultipleUsers(userRecords, '2024-06' as YearMonth);

    expect(results).toHaveLength(2);

    // USER001の検証
    const user001Result = results.find(r => r.summary.userId === 'USER001');
    expect(user001Result).toBeDefined();
    expect(user001Result!.summary.kpi.completedRows).toBe(2);
    expect(user001Result!.summary.kpi.inProgressRows).toBe(1);
    expect(user001Result!.summary.kpi.specialNotes).toBe(1);
    expect(user001Result!.processedRecords).toBe(3);
    expect(user001Result!.errors).toHaveLength(0);

    // USER002の検証
    const user002Result = results.find(r => r.summary.userId === 'USER002');
    expect(user002Result).toBeDefined();
    expect(user002Result!.summary.kpi.completedRows).toBe(1);
    expect(user002Result!.summary.kpi.emptyRows).toBe(380 - 1 - 0); // plannedRows - completedRows - inProgressRows (2024年6月は20営業日 = 380行)
    expect(user002Result!.processedRecords).toBe(2);
  });

  it('記録のないユーザー → 空のサマリー', () => {
    const userRecords = [
      createUserRecords('USER999', 'テスト太郎', [])
    ];

    const results = aggregateMultipleUsers(userRecords, '2024-07' as YearMonth);

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.summary.userId).toBe('USER999');
    expect(result.summary.kpi.completedRows).toBe(0);
    expect(result.summary.kpi.totalDays).toBe(23); // 2024年7月の営業日数
    expect(result.summary.completionRate).toBe(0);
    expect(result.processedRecords).toBe(0);
  });
});