/**
 * useMeetingEvidenceDraft.spec — hook テスト
 *
 * 観点:
 * 1. userId が空 → 空ドラフトを返す
 * 2. 全ソースあり → 4セクションのドラフト
 * 3. 一部ソースのみ → 部分ドラフト
 * 4. データ取得エラー → null で続行（他ソースは生きる）
 * 5. userName / lookbackDays が変わると再計算
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useMeetingEvidenceDraft } from '../useMeetingEvidenceDraft';

import type { ABCRecord } from '@/domain/behavior/abc';
import type { DailyTableRecord, DateRange } from '@/features/daily/infra/dailyTableRepository';

// ── モックセットアップ ──────────────────────────────────────

const mockGetDailyTableRecords = vi.fn<(userId: string, range: DateRange) => DailyTableRecord[]>();
const mockGetABCRecordsForUser = vi.fn<(userId: string) => ABCRecord[]>();

vi.mock('@/features/daily/infra/dailyTableRepository', () => ({
  getDailyTableRecords: (...args: unknown[]) =>
    mockGetDailyTableRecords(args[0] as string, args[1] as DateRange),
}));

vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (...args: unknown[]) =>
    mockGetABCRecordsForUser(args[0] as string),
}));

// ── テストデータ ──────────────────────────────────────────

function makeDailyRecord(
  overrides: Partial<DailyTableRecord> = {},
): DailyTableRecord {
  return {
    userId: 'user-1',
    recordDate: '2026-03-01',
    activities: { am: '散歩', pm: '作業' },
    lunchIntake: 'full',
    problemBehaviors: [],
    submittedAt: '2026-03-01T12:00:00',
    ...overrides,
  };
}

function makeABCRecord(
  overrides: Partial<ABCRecord> = {},
): ABCRecord {
  return {
    id: 'abc-1',
    userId: 'user-1',
    recordedAt: '2026-03-01T10:00:00',
    antecedent: '要求却下',
    antecedentTags: [],
    behavior: '自傷(叩く)',
    consequence: '見守り',
    intensity: 4,
    ...overrides,
  };
}

// ── テスト ────────────────────────────────────────────────

describe('useMeetingEvidenceDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDailyTableRecords.mockReturnValue([]);
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  // ── 1. 基本ケース ──

  it('userId が空 → 空ドラフトを返す', () => {
    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('', '山田太郎'),
    );

    expect(result.current.draft.sourceCount).toBe(0);
    expect(result.current.draft.fullText).toBe('');
    expect(result.current.dailySummary).toBeNull();
    expect(result.current.alerts).toEqual([]);
    expect(result.current.abcPatterns).toBeNull();
    expect(result.current.strategyUsage).toBeNull();
  });

  it('userId が空の場合 リポジトリを呼ばない', () => {
    renderHook(() => useMeetingEvidenceDraft('', ''));

    expect(mockGetDailyTableRecords).not.toHaveBeenCalled();
    expect(mockGetABCRecordsForUser).not.toHaveBeenCalled();
  });

  // ── 2. 日次記録のみ ──

  it('日次記録のみ → daily セクションだけのドラフト', () => {
    mockGetDailyTableRecords.mockReturnValue([
      makeDailyRecord({ recordDate: '2026-02-01' }),
      makeDailyRecord({ recordDate: '2026-02-15' }),
      makeDailyRecord({ recordDate: '2026-03-01' }),
    ]);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    expect(result.current.draft.sourceCount).toBeGreaterThanOrEqual(1);
    expect(result.current.dailySummary).not.toBeNull();
    expect(result.current.dailyRecordCount).toBe(3);
    expect(result.current.draft.sections.some(s => s.source === 'daily')).toBe(true);
  });

  // ── 3. ABC レコードあり → alert + abc + strategy ──

  it('ABC レコードあり → alert/abc/strategy ソースが生成される', () => {
    const abcRecords = [
      makeABCRecord({
        id: 'abc-1',
        intensity: 4,
        antecedent: '要求却下',
        consequence: '見守り',
        estimatedFunction: 'demand',
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
        ],
      }),
      makeABCRecord({
        id: 'abc-2',
        intensity: 5,
        antecedent: '課題提示',
        consequence: '環境調整',
        estimatedFunction: 'escape',
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '代替行動指導', applied: true },
        ],
      }),
    ];
    mockGetABCRecordsForUser.mockReturnValue(abcRecords);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    expect(result.current.abcRecordCount).toBe(2);
    expect(result.current.abcPatterns).not.toBeNull();
    expect(result.current.abcPatterns!.totalRecords).toBe(2);
    expect(result.current.strategyUsage).not.toBeNull();
    expect(result.current.strategyUsage!.totalReferenced).toBe(2);
  });

  // ── 4. 全ソース結合 ──

  it('全ソースあり → 全セクションが含まれるドラフト', () => {
    mockGetDailyTableRecords.mockReturnValue([
      makeDailyRecord({ problemBehaviors: ['selfHarm'] }),
    ]);
    mockGetABCRecordsForUser.mockReturnValue([
      makeABCRecord({
        intensity: 5,
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '事前声かけ', applied: true },
        ],
      }),
    ]);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    // 少なくとも daily + abc + strategy は入る（alert は高強度閾値次第）
    expect(result.current.draft.sourceCount).toBeGreaterThanOrEqual(2);
    expect(result.current.draft.fullText).toContain('【会議資料ドラフト】山田太郎');
    expect(result.current.dailySummary).not.toBeNull();
    expect(result.current.abcPatterns).not.toBeNull();
    expect(result.current.strategyUsage).not.toBeNull();
  });

  // ── 5. 部分エラーに強い ──

  it('getDailyTableRecords が例外 → daily は null、他は生きる', () => {
    mockGetDailyTableRecords.mockImplementation(() => {
      throw new Error('localStorage 読み取りエラー');
    });
    mockGetABCRecordsForUser.mockReturnValue([
      makeABCRecord({ intensity: 3 }),
    ]);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    expect(result.current.dailySummary).toBeNull();
    expect(result.current.dailyRecordCount).toBe(0);
    // ABC 系は生きている
    expect(result.current.abcPatterns).not.toBeNull();
  });

  it('getABCRecordsForUser が例外 → abc/alert/strategy は null、daily は生きる', () => {
    mockGetDailyTableRecords.mockReturnValue([
      makeDailyRecord(),
    ]);
    mockGetABCRecordsForUser.mockImplementation(() => {
      throw new Error('Zustand エラー');
    });

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    expect(result.current.dailySummary).not.toBeNull();
    expect(result.current.alerts).toEqual([]);
    expect(result.current.abcPatterns).toBeNull();
    expect(result.current.strategyUsage).toBeNull();
    expect(result.current.abcRecordCount).toBe(0);
  });

  // ── 6. ABC取得は1回で使い回す ──

  it('ABC取得は1回だけ呼ばれる', () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeABCRecord(),
    ]);

    renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    // getABCRecordsForUser は 1回だけ呼ばれる（alert/abc/strategy で使い回し）
    expect(mockGetABCRecordsForUser).toHaveBeenCalledTimes(1);
    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('user-1');
  });

  // ── 7. userName が反映される ──

  it('userName がドラフトの fullText に反映される', () => {
    mockGetDailyTableRecords.mockReturnValue([makeDailyRecord()]);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '佐藤花子'),
    );

    expect(result.current.draft.fullText).toContain('佐藤花子');
  });

  // ── 8. 戦略なしの ABC レコード ──

  it('referencedStrategies なしの ABC → strategyUsage は null', () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeABCRecord({ referencedStrategies: undefined }),
    ]);

    const { result } = renderHook(() =>
      useMeetingEvidenceDraft('user-1', '山田太郎'),
    );

    expect(result.current.strategyUsage).toBeNull();
    // パターンは取れる
    expect(result.current.abcPatterns).not.toBeNull();
  });
});
