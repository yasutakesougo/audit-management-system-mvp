import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ABCRecord } from '@/domain/behavior';

const repo = {
  listByUser: vi.fn<(...args: unknown[]) => Promise<ABCRecord[]>>(),
  getByUser: vi.fn<(...args: unknown[]) => Promise<ABCRecord[]>>(),
  add: vi.fn<(...args: unknown[]) => Promise<ABCRecord>>(),
};

const mockGetABCRecordsForUser = vi.fn();
vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (userId: string) => mockGetABCRecordsForUser(userId),
}));

vi.mock('../infra/behaviorRepositoryFactory', () => ({
  getBehaviorRepository: () => repo,
  getInMemoryBehaviorRepository: () => null,
}));

import { useBehaviorStore } from '../stores/behaviorStore';

describe('useBehaviorStore', () => {
  beforeEach(() => {
    repo.listByUser.mockReset();
    repo.getByUser.mockReset();
    repo.add.mockReset();
  });

  it('fetchByUser returns 5 items sorted descending by recordedAt', async () => {
    const base = new Date('2025-01-01T09:00:00.000Z');
    const observations: ABCRecord[] = Array.from({ length: 7 }, (_, index) => ({
      id: `obs-${index}`,
      userId: 'U1',
      recordedAt: new Date(base.getTime() + index * 60_000).toISOString(),
      antecedent: '',
      antecedentTags: [],
      behavior: 'test',
      consequence: '',
      intensity: 1 as const,
    }));

    mockGetABCRecordsForUser.mockReturnValue([
      observations[2],
      observations[6],
      observations[1],
      observations[5],
      observations[0],
      observations[4],
      observations[3],
    ]);

    const { result } = renderHook(() => useBehaviorStore());

    await act(async () => {
      await result.current.fetchByUser('U1');
    });

    const { data } = result.current;
    expect(data).toHaveLength(5);
    expect(data[0]?.recordedAt).toBe(observations[6].recordedAt);
    for (let i = 0; i < data.length - 1; i += 1) {
      const current = new Date(data[i]!.recordedAt).getTime();
      const next = new Date(data[i + 1]!.recordedAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('add prepends the new record to the store data', async () => {
    const newRecord: ABCRecord = {
      id: 'new-1',
      userId: 'U1',
      recordedAt: new Date('2025-01-01T10:00:00.000Z').toISOString(),
      antecedent: '',
      antecedentTags: [],
      behavior: 'test',
      consequence: '',
      intensity: 2,
    };

    repo.add.mockResolvedValueOnce(newRecord);

    const { result } = renderHook(() => useBehaviorStore());

    await act(async () => {
      await result.current.add({
        userId: newRecord.userId,
        recordedAt: newRecord.recordedAt,
        antecedent: newRecord.antecedent,
        antecedentTags: newRecord.antecedentTags,
        behavior: newRecord.behavior,
        consequence: newRecord.consequence,
        intensity: newRecord.intensity,
      });
    });

    expect(result.current.data[0]).toEqual(newRecord);
  });

  it('fetchForAnalysis returns filtered and sorted items for the specified period', async () => {
    const now = new Date();
    const d1 = new Date(now); d1.setDate(now.getDate() - 35); // Out of range (30 days default)
    const d2 = new Date(now); d2.setDate(now.getDate() - 20); // In range
    const d3 = new Date(now); d3.setDate(now.getDate() - 5);  // In range (newer)
    
    const observations: ABCRecord[] = [
      { id: '1', userId: 'U1', recordedAt: d1.toISOString(), behavior: 'b1', intensity: 1, antecedent: '', consequence: '', antecedentTags: [] },
      { id: '2', userId: 'U1', recordedAt: d2.toISOString(), behavior: 'b2', intensity: 1, antecedent: '', consequence: '', antecedentTags: [] },
      { id: '3', userId: 'U1', recordedAt: d3.toISOString(), behavior: 'b3', intensity: 1, antecedent: '', consequence: '', antecedentTags: [] },
    ];

    mockGetABCRecordsForUser.mockReturnValue(observations);

    const { result } = renderHook(() => useBehaviorStore());

    await act(async () => {
      await result.current.fetchForAnalysis('U1', 30);
    });

    const { analysisData } = result.current;
    expect(analysisData).toHaveLength(2);
    expect(analysisData[0].id).toBe('2'); // Oldest first (asc)
    expect(analysisData[1].id).toBe('3');
  });
});
