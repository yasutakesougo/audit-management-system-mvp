import { describe, expect, it } from 'vitest';
import type { ActionCard } from '../domain/models/queue.types';
import { summarizeTodayQueue } from './summarizeTodayQueue';

describe('summarizeTodayQueue', () => {
  const baseCard: Omit<ActionCard, 'id' | 'title' | 'priority' | 'isOverdue' | 'requiresAttention'> = {
    contextMessage: '',
    actionType: 'ACKNOWLEDGE',
    payload: null,
  };

  it('summarizes an empty array correctly', () => {
    const timestamp = 1234567890;
    const result = summarizeTodayQueue([], timestamp);

    expect(result).toEqual({
      timestamp,
      queueSize: 0,
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      overdueCount: 0,
      requiresAttentionCount: 0,
    });
  });

  it('correctly counts priorities', () => {
    const items: ActionCard[] = [
      { ...baseCard, id: '1', title: 'A', priority: 'P0', isOverdue: false, requiresAttention: false },
      { ...baseCard, id: '2', title: 'B', priority: 'P0', isOverdue: false, requiresAttention: false },
      { ...baseCard, id: '3', title: 'C', priority: 'P1', isOverdue: false, requiresAttention: false },
      { ...baseCard, id: '4', title: 'D', priority: 'P2', isOverdue: false, requiresAttention: false },
      { ...baseCard, id: '5', title: 'E', priority: 'P3', isOverdue: false, requiresAttention: false },
    ];
    const timestamp = 1000;
    const result = summarizeTodayQueue(items, timestamp);

    expect(result.queueSize).toBe(5);
    expect(result.p0Count).toBe(2);
    expect(result.p1Count).toBe(1);
    expect(result.p2Count).toBe(1);
    expect(result.p3Count).toBe(1);
  });

  it('correctly counts overdue and requiresAttention independently of priority', () => {
    const items: ActionCard[] = [
      { ...baseCard, id: '1', title: 'A', priority: 'P2', isOverdue: true, requiresAttention: false },
      { ...baseCard, id: '2', title: 'B', priority: 'P3', isOverdue: false, requiresAttention: true },
      // Both overdue and requiresAttention
      { ...baseCard, id: '3', title: 'C', priority: 'P1', isOverdue: true, requiresAttention: true },
    ];
    const timestamp = 2000;
    const result = summarizeTodayQueue(items, timestamp);

    expect(result.overdueCount).toBe(2);
    expect(result.requiresAttentionCount).toBe(2);
    // Sanity check priorities
    expect(result.p1Count).toBe(1);
    expect(result.p2Count).toBe(1);
    expect(result.p3Count).toBe(1);
  });

  it('does not mutate the input array', () => {
    const items: ActionCard[] = [
      { ...baseCard, id: '1', title: 'A', priority: 'P0', isOverdue: true, requiresAttention: true },
    ];
    // Freeze the array and its objects to ensure no mutations happen internally
    Object.freeze(items[0]);
    Object.freeze(items);

    const timestamp = 3000;
    
    // If it mutates, this will throw an error in strict mode
    expect(() => summarizeTodayQueue(items as ActionCard[], timestamp)).not.toThrow();
  });

  it('preserves the provided timestamp exactly', () => {
    const items: ActionCard[] = [{ ...baseCard, id: '1', title: 'A', priority: 'P0', isOverdue: false, requiresAttention: false }];
    const timestamp = 999999999;
    const result = summarizeTodayQueue(items, timestamp);
    
    expect(result.timestamp).toBe(999999999);
  });
});
