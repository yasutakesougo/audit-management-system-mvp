import { describe, expect, it } from 'vitest';
import type { ScoredActionItem } from '../models/queue.types';
import { sortActionQueue } from '../engine/sortActionQueue';

function item(overrides: Partial<ScoredActionItem>): ScoredActionItem {
  return {
    id: overrides.id ?? 'x',
    sourceType: overrides.sourceType ?? 'schedule',
    title: overrides.title ?? 'title',
    targetTime: overrides.targetTime,
    slaMinutes: overrides.slaMinutes,
    isCompleted: overrides.isCompleted ?? false,
    assignedStaffId: overrides.assignedStaffId,
    payload: overrides.payload ?? {},
    priority: overrides.priority ?? 'P2',
    urgencyScore: overrides.urgencyScore ?? 0,
    isOverdue: overrides.isOverdue ?? false,
  };
}

describe('sortActionQueue', () => {
  it('Priority が最優先される', () => {
    const result = sortActionQueue([
      item({ id: 'p2', priority: 'P2', urgencyScore: 999 }),
      item({ id: 'p0', priority: 'P0', urgencyScore: 1 }),
    ]);

    expect(result.map((x) => x.id)).toEqual(['p0', 'p2']);
  });

  it('同一Priorityでは urgencyScore 高い順', () => {
    const result = sortActionQueue([
      item({ id: 'a', priority: 'P2', urgencyScore: 10 }),
      item({ id: 'b', priority: 'P2', urgencyScore: 20 }),
    ]);

    expect(result.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('同点時は currentStaffId 一致を優先', () => {
    const result = sortActionQueue(
      [
        item({ id: 'other', priority: 'P2', urgencyScore: 10, assignedStaffId: 'staff-b' }),
        item({ id: 'mine', priority: 'P2', urgencyScore: 10, assignedStaffId: 'staff-a' }),
      ],
      'staff-a'
    );

    expect(result.map((x) => x.id)).toEqual(['mine', 'other']);
  });

  it('完全同点時は id 昇順で固定される', () => {
    const result = sortActionQueue([
      item({ id: 'b', priority: 'P2', urgencyScore: 10 }),
      item({ id: 'a', priority: 'P2', urgencyScore: 10 }),
    ]);

    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
