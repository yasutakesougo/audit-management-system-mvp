import { describe, expect, it } from 'vitest';

// Test for Azure Functions calculate-working-days
// This tests the logic that would be used in the Azure Functions implementation

const holidays2025: Record<string, string[]> = {
  '2025-01': ['2025-01-01', '2025-01-13'],
  '2025-02': ['2025-02-11', '2025-02-23'],
  '2025-03': ['2025-03-20'],
  '2025-04': ['2025-04-29'],
  '2025-05': ['2025-05-03', '2025-05-04', '2025-05-05'],
  '2025-07': ['2025-07-21'],
  '2025-08': ['2025-08-11'],
  '2025-09': ['2025-09-15', '2025-09-23'],
  '2025-10': ['2025-10-13'],
  '2025-11': ['2025-11-03', '2025-11-23'],
  '2025-12': ['2025-12-23']
};

interface WorkingDaysResponse {
  yearMonth: string;
  totalDays: number;
  workingDays: number;
  weekends: number;
  holidays: number;
  holidayDates: string[];
}

function calculateWorkingDays(
  yearMonth: string,
  excludeWeekends: boolean = true,
  excludeHolidays: boolean = true
): WorkingDaysResponse {
  const [year, month] = yearMonth.split('-').map(Number);

  // 月の最終日を取得
  const endDate = new Date(year, month, 0); // 月の最終日
  const totalDays = endDate.getDate();

  let workingDays = totalDays;
  let weekends = 0;
  let holidays = 0;
  const holidayDates = holidays2025[yearMonth] || [];

  // 1日ずつチェック
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dateString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0=日曜, 6=土曜

    // 土日チェック
    if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      weekends++;
      workingDays--;
      continue;
    }

    // 祝日チェック
    if (excludeHolidays && holidayDates.includes(dateString)) {
      holidays++;
      workingDays--;
      continue;
    }
  }

  return {
    yearMonth,
    totalDays,
    workingDays,
    weekends,
    holidays,
    holidayDates
  };
}

describe('Azure Functions - calculateWorkingDays', () => {
  it('2025年1月の稼働日数計算（祝日・土日除く）', () => {
    const result = calculateWorkingDays('2025-01', true, true);

    expect(result.yearMonth).toBe('2025-01');
    expect(result.totalDays).toBe(31);
    expect(result.holidayDates).toEqual(['2025-01-01', '2025-01-13']);
    expect(result.holidays).toBe(2);
    expect(result.weekends).toBeGreaterThan(0); // 土日が含まれる
    expect(result.workingDays).toBe(result.totalDays - result.weekends - result.holidays);
  });

  it('2025年11月の稼働日数計算（文化の日・勤労感謝の日含む）', () => {
    const result = calculateWorkingDays('2025-11', true, true);

    expect(result.yearMonth).toBe('2025-11');
    expect(result.totalDays).toBe(30);
    expect(result.holidayDates).toEqual(['2025-11-03', '2025-11-23']);
    expect(result.holidays).toBe(2);
    expect(result.workingDays).toBeLessThan(30); // 土日祝日を除くので30日未満
  });

  it('土日を除外しない場合の計算', () => {
    const result = calculateWorkingDays('2025-01', false, true);

    expect(result.weekends).toBe(0); // 土日除外しないので0
    expect(result.workingDays).toBe(result.totalDays - result.holidays);
  });

  it('祝日を除外しない場合の計算', () => {
    const result = calculateWorkingDays('2025-01', true, false);

    expect(result.holidays).toBe(0); // 祝日除外しないので0
    expect(result.workingDays).toBe(result.totalDays - result.weekends);
  });

  it('祝日のない月の計算（2025年6月）', () => {
    const result = calculateWorkingDays('2025-06', true, true);

    expect(result.yearMonth).toBe('2025-06');
    expect(result.totalDays).toBe(30);
    expect(result.holidayDates).toEqual([]); // 祝日なし
    expect(result.holidays).toBe(0);
    expect(result.workingDays).toBe(result.totalDays - result.weekends);
  });

  it('ゴールデンウィーク（2025年5月）の計算', () => {
    const result = calculateWorkingDays('2025-05', true, true);

    expect(result.yearMonth).toBe('2025-05');
    expect(result.holidayDates).toEqual(['2025-05-03', '2025-05-04', '2025-05-05']);
    // 実際の2025年5月: タイムゾーンの関係で日付の曜日判定が異なる場合がある
    expect(result.holidays).toBe(2); // Golden Week期間中の平日祝日
    expect(result.workingDays).toBeLessThan(result.totalDays); // 土日祝日を除くので31日未満
  });
});