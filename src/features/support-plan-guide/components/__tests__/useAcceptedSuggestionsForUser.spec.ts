/**
 * useAcceptedSuggestionsForUser.spec.ts — 実データ hook のテスト
 *
 * Issue #10 Phase 3: acceptedSuggestions 実データ接続
 *
 * DailyRecordRepository.list() を mock し、
 * userId フィルタ / accept フィルタ / ソート / エラー処理を検証する。
 */

import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import {
  useAcceptedSuggestionsForUser,
  computeDateRange,
  LOOKBACK_DAYS,
} from '../../hooks/useAcceptedSuggestionsForUser';

import type { DailyRecordItem } from '@/features/daily/domain/DailyRecordRepository';

// ─── mock ────────────────────────────────────────────────

const mockList = vi.fn() as Mock;

vi.mock('@/features/daily/repositoryFactory', () => ({
  useDailyRecordRepository: () => ({
    list: mockList,
    load: vi.fn(),
    save: vi.fn(),
    approve: vi.fn(),
  }),
}));

// ─── helper ──────────────────────────────────────────────

function makeDailyRecord(
  date: string,
  userRows: DailyRecordItem['userRows'],
): DailyRecordItem {
  return {
    date,
    reporter: { name: 'テスト太郎', role: '支援員' },
    userRows,
  };
}

function makeSuggestionAction(
  overrides: Partial<{
    action: 'accept' | 'dismiss';
    ruleId: string;
    category: string;
    message: string;
    evidence: string;
    timestamp: string;
    userId: string;
  }> = {},
) {
  return {
    action: 'accept' as const,
    ruleId: 'rule-001',
    category: 'anxiety',
    message: '不安傾向が見られます',
    evidence: '不安: 3件',
    timestamp: '2026-03-10T10:00:00.000Z',
    userId: 'user-001',
    ...overrides,
  };
}

// ─── テスト ──────────────────────────────────────────────

describe('useAcceptedSuggestionsForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it('userId が一致する accept のみ返す', async () => {
    mockList.mockResolvedValue([
      makeDailyRecord('2026-03-10', [
        {
          userId: 'user-001',
          userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ userId: 'user-001', action: 'accept' }),
          ],
        },
        {
          userId: 'user-002',
          userName: '別ユーザー',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ userId: 'user-002', action: 'accept', ruleId: 'rule-other' }),
          ],
        },
      ]),
    ]);

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].ruleId).toBe('rule-001');
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe('sharepoint');
  });

  it('dismiss アクションは除外される', async () => {
    mockList.mockResolvedValue([
      makeDailyRecord('2026-03-10', [
        {
          userId: 'user-001', userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ action: 'accept', ruleId: 'rule-accepted' }),
            makeSuggestionAction({ action: 'dismiss', ruleId: 'rule-dismissed' }),
          ],
        },
      ]),
    ]);

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].ruleId).toBe('rule-accepted');
  });

  it('acceptedSuggestions が undefined の行があっても安全にスキップする', async () => {
    mockList.mockResolvedValue([
      makeDailyRecord('2026-03-10', [
        {
          userId: 'user-001', userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          // acceptedSuggestions がない
        },
      ]),
    ]);

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('複数レコード・複数日付から正しく集約できる', async () => {
    mockList.mockResolvedValue([
      makeDailyRecord('2026-03-10', [
        {
          userId: 'user-001', userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ ruleId: 'rule-day1', timestamp: '2026-03-10T10:00:00.000Z' }),
          ],
        },
      ]),
      makeDailyRecord('2026-03-11', [
        {
          userId: 'user-001', userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ ruleId: 'rule-day2', timestamp: '2026-03-11T10:00:00.000Z' }),
          ],
        },
      ]),
    ]);

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
  });

  it('新しい順（timestamp 降順）に並ぶ', async () => {
    mockList.mockResolvedValue([
      makeDailyRecord('2026-03-10', [
        {
          userId: 'user-001', userName: 'テスト太郎',
          amActivity: '', pmActivity: '', lunchAmount: '',
          problemBehavior: { selfHarm: false, otherInjury: false, loudVoice: false, pica: false, other: false },
          specialNotes: '', behaviorTags: [],
          acceptedSuggestions: [
            makeSuggestionAction({ ruleId: 'old', timestamp: '2026-03-08T10:00:00.000Z' }),
            makeSuggestionAction({ ruleId: 'new', timestamp: '2026-03-10T10:00:00.000Z' }),
            makeSuggestionAction({ ruleId: 'mid', timestamp: '2026-03-09T10:00:00.000Z' }),
          ],
        },
      ]),
    ]);

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items[0].ruleId).toBe('new');
    expect(result.current.items[1].ruleId).toBe('mid');
    expect(result.current.items[2].ruleId).toBe('old');
  });

  it('repository エラー時に error が返される', async () => {
    mockList.mockRejectedValue(new Error('SP 接続エラー'));

    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('SP 接続エラー');
  });

  it('userId が空文字なら空配列で isLoading: false', async () => {
    const { result } = renderHook(() => useAcceptedSuggestionsForUser(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    // list は呼ばれない
    expect(mockList).not.toHaveBeenCalled();
  });

  it('source が "sharepoint" になる', async () => {
    const { result } = renderHook(() => useAcceptedSuggestionsForUser('user-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.source).toBe('sharepoint');
  });
});

// ─── ユーティリティ関数のテスト ──────────────────────────

describe('computeDateRange', () => {
  it('LOOKBACK_DAYS 分の範囲を返す', () => {
    const range = computeDateRange(LOOKBACK_DAYS);
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.startDate < range.endDate).toBe(true);
  });

  it('0日なら startDate === endDate', () => {
    const range = computeDateRange(0);
    expect(range.startDate).toBe(range.endDate);
  });

  it('LOOKBACK_DAYS が 30 である', () => {
    // 30日の根拠をコードで明示
    expect(LOOKBACK_DAYS).toBe(30);
  });
});
