/**
 * @fileoverview useAdoptionMetrics のテスト
 *
 * Issue #11: Adoption Metrics
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ─── mock ────────────────────────────────────────────────

const mockRepository = {
  list: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
};

vi.mock('@/features/daily/repositories/repositoryFactory', () => ({
  useDailyRecordRepository: () => mockRepository,
}));

import { useAdoptionMetrics } from '../useAdoptionMetrics';

// ─── ヘルパー ────────────────────────────────────────────

function makeRecord(
  date: string,
  userRows: Array<{
    userId: string;
    acceptedSuggestions?: Array<{
      action: string;
      ruleId: string;
      category: string;
      message: string;
      evidence: string;
      timestamp: string;
      userId: string;
    }>;
  }>,
) {
  return {
    id: `rec-${date}`,
    date,
    reporter: { name: 'テスト', role: '職員' },
    userRows: userRows.map(row => ({
      userId: row.userId,
      userName: '',
      amActivity: '',
      pmActivity: '',
      lunchAmount: '',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
      },
      specialNotes: '',
      behaviorTags: [],
      acceptedSuggestions: row.acceptedSuggestions,
    })),
  };
}

// ─── テスト ──────────────────────────────────────────────

describe('useAdoptionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.list.mockResolvedValue([]);
  });

  it('空の userId で即座に null を返す', async () => {
    const { result } = renderHook(() => useAdoptionMetrics(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockRepository.list).not.toHaveBeenCalled();
  });

  it('アクションが0件の場合、ゼロの metrics を返す', async () => {
    mockRepository.list.mockResolvedValue([
      makeRecord('2026-03-10', [{ userId: 'user-01' }]),
    ]);

    const { result } = renderHook(() => useAdoptionMetrics('user-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).not.toBeNull();
    expect(result.current.metrics!.actionedCount).toBe(0);
    expect(result.current.metrics!.acceptRate).toBe(0);
  });

  it('accept / dismiss をカウントして集計する', async () => {
    mockRepository.list.mockResolvedValue([
      makeRecord('2026-03-10', [{
        userId: 'user-01',
        acceptedSuggestions: [
          { action: 'accept', ruleId: 'highCoOccurrence:panic', category: 'co-occurrence', message: 'A', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
          { action: 'accept', ruleId: 'slotBias', category: 'slot-bias', message: 'B', evidence: 'ev', timestamp: '2026-03-10T11:00:00Z', userId: 'user-01' },
          { action: 'dismiss', ruleId: 'tagDensityGap', category: 'tag-density', message: 'C', evidence: 'ev', timestamp: '2026-03-10T12:00:00Z', userId: 'user-01' },
        ],
      }]),
    ]);

    const { result } = renderHook(() => useAdoptionMetrics('user-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const m = result.current.metrics!;
    expect(m.acceptCount).toBe(2);
    expect(m.dismissCount).toBe(1);
    expect(m.actionedCount).toBe(3);
    expect(m.acceptRate).toBe(66.7);
    expect(m.dismissRate).toBe(33.3);
  });

  it('他ユーザーのアクションは除外する', async () => {
    mockRepository.list.mockResolvedValue([
      makeRecord('2026-03-10', [
        {
          userId: 'user-01',
          acceptedSuggestions: [
            { action: 'accept', ruleId: 'slotBias', category: 'slot-bias', message: 'A', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
          ],
        },
        {
          userId: 'user-02',
          acceptedSuggestions: [
            { action: 'accept', ruleId: 'slotBias', category: 'slot-bias', message: 'B', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-02' },
            { action: 'dismiss', ruleId: 'slotBias', category: 'slot-bias', message: 'C', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-02' },
          ],
        },
      ]),
    ]);

    const { result } = renderHook(() => useAdoptionMetrics('user-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics!.acceptCount).toBe(1);
    expect(result.current.metrics!.dismissCount).toBe(0);
    expect(result.current.metrics!.actionedCount).toBe(1);
  });

  it('ISP 反映率を正しく計算する', async () => {
    mockRepository.list.mockResolvedValue([
      makeRecord('2026-03-10', [{
        userId: 'user-01',
        acceptedSuggestions: [
          { action: 'accept', ruleId: 'highCoOccurrence:panic', category: 'co-occurrence', message: 'A', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
          { action: 'accept', ruleId: 'slotBias', category: 'slot-bias', message: 'B', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
        ],
      }]),
    ]);

    const ideas = '[source:rule=highCoOccurrence:panic user=user-01]';
    const { result } = renderHook(() => useAdoptionMetrics('user-01', ideas));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics!.ispImportCount).toBe(1);
    expect(result.current.metrics!.ispImportRate).toBe(50);
  });

  it('エラー時に error を返す', async () => {
    mockRepository.list.mockRejectedValue(new Error('SP接続エラー'));

    const { result } = renderHook(() => useAdoptionMetrics('user-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('SP接続エラー');
    expect(result.current.metrics).toBeNull();
  });

  it('ルール別集計が含まれる', async () => {
    mockRepository.list.mockResolvedValue([
      makeRecord('2026-03-10', [{
        userId: 'user-01',
        acceptedSuggestions: [
          { action: 'accept', ruleId: 'highCoOccurrence:panic', category: 'co-occurrence', message: 'A', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
          { action: 'dismiss', ruleId: 'highCoOccurrence:sensory', category: 'co-occurrence', message: 'B', evidence: 'ev', timestamp: '2026-03-10T10:00:00Z', userId: 'user-01' },
        ],
      }]),
    ]);

    const { result } = renderHook(() => useAdoptionMetrics('user-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const byRule = result.current.metrics!.byRule;
    expect(byRule).toHaveLength(1);
    expect(byRule[0].rulePrefix).toBe('highCoOccurrence');
    expect(byRule[0].acceptRate).toBe(50);
  });
});
