import { describe, expect, it } from 'vitest';
import {
    aggregateMonthlySummary,
    extractRecordDateRange,
    shouldUpdateSummary
} from '../aggregate';
import type { DailyRecord, MonthlySummary, YearMonth } from '../types';

describe('部分入力・未完了ケーステスト', () => {
  const createDailyRecord = (
    date: string,
    completed: boolean = false,
    hasSpecialNotes: boolean = false,
    hasIncidents: boolean = false,
    isEmpty: boolean = true
  ): DailyRecord => ({
    id: `record_${date}`,
    userId: 'USER001',
    userName: 'テスト太郎',
    recordDate: date,
    completed,
    hasSpecialNotes,
    hasIncidents,
    isEmpty
  });

  it('完全未入力月 → 全てemptyRows', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-09-01', false, false, false, true),
      createDailyRecord('2024-09-02', false, false, false, true),
      createDailyRecord('2024-09-03', false, false, false, true),
    ];

    const summary = aggregateMonthlySummary(
      'USER001',
      'テスト太郎',
      records,
      '2024-09' as YearMonth
    );

    expect(summary.kpi.completedRows).toBe(0);
    expect(summary.kpi.inProgressRows).toBe(0);
    expect(summary.kpi.emptyRows).toBe(3);
    expect(summary.completionRate).toBe(0); // 0%
    expect(summary.firstEntryDate).toBeUndefined(); // 空記録は除外
    expect(summary.lastEntryDate).toBeUndefined();
  });

  it('開始途中月 → 月の15日から開始', () => {
    const records: DailyRecord[] = [
      // 1-14日: 記録なし
      // 15日以降: 活動開始
      createDailyRecord('2024-10-15', true, false, false, false),
      createDailyRecord('2024-10-16', true, false, false, false),
      createDailyRecord('2024-10-17', false, false, false, false), // 進行中
      createDailyRecord('2024-10-18', true, true, false, false), // 完了 + 特記
    ];

    const summary = aggregateMonthlySummary(
      'USER001',
      'テスト太郎',
      records,
      '2024-10' as YearMonth
    );

    expect(summary.kpi.completedRows).toBe(3);
    expect(summary.kpi.inProgressRows).toBe(1);
    expect(summary.kpi.specialNotes).toBe(1);
    expect(summary.firstEntryDate).toBe('2024-10-15');
    expect(summary.lastEntryDate).toBe('2024-10-18');
    expect(summary.completionRate).toBeGreaterThan(0);
  });

  it('断続的記録 → 飛び飛びの日付', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-11-01', true, false, false, false), // 完了
      // 2-4日: 空白
      createDailyRecord('2024-11-05', false, false, false, false), // 進行中
      // 6-10日: 空白
      createDailyRecord('2024-11-11', true, false, true, false), // 完了 + 事故
      // 12-29日: 空白
      createDailyRecord('2024-11-30', false, false, false, true), // 空記録
    ];

    const summary = aggregateMonthlySummary(
      'USER001',
      'テスト太郎',
      records,
      '2024-11' as YearMonth
    );

    expect(summary.kpi.completedRows).toBe(2);
    expect(summary.kpi.inProgressRows).toBe(1);
    expect(summary.kpi.emptyRows).toBe(1);
    expect(summary.kpi.incidents).toBe(1);
    expect(summary.firstEntryDate).toBe('2024-11-01'); // 空記録除く
    expect(summary.lastEntryDate).toBe('2024-11-11'); // 空記録除く
  });

  it('月末追い込み → 最終日に集中記録', () => {
    const records: DailyRecord[] = [
      // 1-28日: 未入力
      createDailyRecord('2024-12-29', true, false, false, false), // 日曜日
      createDailyRecord('2024-12-30', true, true, false, false), // 月曜日 + 特記
      createDailyRecord('2024-12-31', true, false, false, false), // 火曜日
    ];

    const summary = aggregateMonthlySummary(
      'USER001',
      'テスト太郎',
      records,
      '2024-12' as YearMonth
    );

    expect(summary.kpi.completedRows).toBe(3);
    expect(summary.kpi.specialNotes).toBe(1);
    expect(summary.firstEntryDate).toBe('2024-12-29');
    expect(summary.lastEntryDate).toBe('2024-12-31');
    // 完了率は低い（月末だけなので）
    expect(summary.completionRate).toBeLessThan(50); // 50%未満
  });
});

describe('extractRecordDateRange - 記録日範囲抽出テスト', () => {
  const createDailyRecord = (date: string, isEmpty: boolean = false): DailyRecord => ({
    id: `record_${date}`,
    userId: 'USER001',
    userName: 'テスト太郎',
    recordDate: date,
    completed: !isEmpty,
    hasSpecialNotes: false,
    hasIncidents: false,
    isEmpty
  });

  it('正常ケース → 最初と最後の記録日を抽出', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-06-15'),
      createDailyRecord('2024-06-03'),
      createDailyRecord('2024-06-20'),
      createDailyRecord('2024-06-01'),
    ];

    const { firstEntryDate, lastEntryDate } = extractRecordDateRange(records);

    expect(firstEntryDate).toBe('2024-06-01'); // 最初
    expect(lastEntryDate).toBe('2024-06-20'); // 最後
  });

  it('空記録除外 → 実際の記録のみから抽出', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-07-01', true), // 空記録
      createDailyRecord('2024-07-05', false), // 実記録
      createDailyRecord('2024-07-10', false), // 実記録
      createDailyRecord('2024-07-31', true), // 空記録
    ];

    const { firstEntryDate, lastEntryDate } = extractRecordDateRange(records);

    expect(firstEntryDate).toBe('2024-07-05'); // 空記録除く
    expect(lastEntryDate).toBe('2024-07-10'); // 空記録除く
  });

  it('全て空記録 → undefined返却', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-08-01', true),
      createDailyRecord('2024-08-15', true),
    ];

    const { firstEntryDate, lastEntryDate } = extractRecordDateRange(records);

    expect(firstEntryDate).toBeUndefined();
    expect(lastEntryDate).toBeUndefined();
  });

  it('単一記録 → 同じ日付が返却', () => {
    const records: DailyRecord[] = [
      createDailyRecord('2024-09-15'),
    ];

    const { firstEntryDate, lastEntryDate } = extractRecordDateRange(records);

    expect(firstEntryDate).toBe('2024-09-15');
    expect(lastEntryDate).toBe('2024-09-15');
  });
});

describe('shouldUpdateSummary - 差分更新判定テスト', () => {
  const createBaseSummary = (): MonthlySummary => ({
    userId: 'USER001',
    yearMonth: '2024-11' as YearMonth,
    displayName: 'テスト太郎',
    lastUpdatedUtc: '2024-11-06T01:00:00Z',
    kpi: {
      totalDays: 21,
      plannedRows: 399,
      completedRows: 250,
      inProgressRows: 100,
      emptyRows: 49,
      specialNotes: 5,
      incidents: 2,
    },
    completionRate: 62.66,
    firstEntryDate: '2024-11-01',
    lastEntryDate: '2024-11-30',
  });

  it('KPI変更あり → 更新必要', () => {
    const existing = createBaseSummary();
    const updated = {
      ...existing,
      kpi: { ...existing.kpi, completedRows: 260 } // 完了行数増加
    };

    expect(shouldUpdateSummary(existing, updated)).toBe(true);
  });

  it('完了率変更あり → 更新必要', () => {
    const existing = createBaseSummary();
    const updated = {
      ...existing,
      completionRate: 65.15 // 2.49%の変化（0.01以上）
    };

    expect(shouldUpdateSummary(existing, updated)).toBe(true);
  });

  it('微小な完了率変化 → 現在の実装では更新される', () => {
    const existing = createBaseSummary();
    const updated = {
      ...existing,
      completionRate: 62.67 // 0.01%の変化
    };

    // 現在の実装: 0.01以上の差で更新が発生
    expect(shouldUpdateSummary(existing, updated)).toBe(true);
  });

  it('表示名・日付のみ変更 → 更新不要', () => {
    const existing = createBaseSummary();
    const updated = {
      ...existing,
      displayName: '変更太郎', // KPI以外の変更
      lastUpdatedUtc: '2024-11-06T02:00:00Z'
    };

    expect(shouldUpdateSummary(existing, updated)).toBe(false);
  });

  it('特記事項・事故件数変更 → 更新必要', () => {
    const existing = createBaseSummary();
    const updated = {
      ...existing,
      kpi: { ...existing.kpi, specialNotes: 7, incidents: 3 }
    };

    expect(shouldUpdateSummary(existing, updated)).toBe(true);
  });
});