import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BehaviorObservation } from '../domain/daily/types';

const repo = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listByUser: vi.fn<any>(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByUser: vi.fn<any>(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add: vi.fn<any>(),
};

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

  it('fetchByUser returns 5 items sorted descending by timestamp', async () => {
    const base = new Date('2025-01-01T09:00:00.000Z');
    const observations: BehaviorObservation[] = Array.from({ length: 7 }, (_, index) => ({
      id: `obs-${index}`,
      userId: 'U1',
      timestamp: new Date(base.getTime() + index * 60_000).toISOString(),
      antecedent: null,
      behavior: 'test',
      consequence: null,
      intensity: 1,
    }));

    repo.listByUser.mockResolvedValueOnce([
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
    expect(data[0]?.timestamp).toBe(observations[6].timestamp);
    for (let i = 0; i < data.length - 1; i += 1) {
      const current = new Date(data[i]!.timestamp).getTime();
      const next = new Date(data[i + 1]!.timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('add prepends the new record to the store data', async () => {
    const newRecord: BehaviorObservation = {
      id: 'new-1',
      userId: 'U1',
      timestamp: new Date('2025-01-01T10:00:00.000Z').toISOString(),
      antecedent: null,
      behavior: 'test',
      consequence: null,
      intensity: 2,
    };

    repo.add.mockResolvedValueOnce(newRecord);

    const { result } = renderHook(() => useBehaviorStore());

    await act(async () => {
      await result.current.add({
        userId: newRecord.userId,
        timestamp: newRecord.timestamp,
        antecedent: newRecord.antecedent,
        behavior: newRecord.behavior,
        consequence: newRecord.consequence,
        intensity: newRecord.intensity,
      });
    });

    expect(result.current.data[0]).toEqual(newRecord);
  });
});
