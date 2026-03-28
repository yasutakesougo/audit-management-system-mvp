import { describe, it, expect } from 'vitest';
import type { PersonDaily } from '@/domain/daily/types';
import { classifyQueueRecords } from '../legacy/classifyQueueRecords';

// ─── Factory ────────────────────────────────────────────────────

function makeRecord(
  overrides: Partial<PersonDaily> & { id: number; status: PersonDaily['status'] },
): PersonDaily {
  return {
    userId: String(overrides.id).padStart(3, '0'),
    userName: `User${overrides.id}`,
    date: '2026-03-19',
    reporter: { name: '職員A' },
    draft: { isDraft: overrides.status !== '完了' },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      mealAmount: '完食',
    },
    ...overrides,
  } as PersonDaily;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('classifyQueueRecords', () => {
  const records = [
    makeRecord({ id: 1, status: '完了' }),
    makeRecord({ id: 2, status: '作成中' }),
    makeRecord({ id: 3, status: '未作成' }),
    makeRecord({ id: 4, status: '未作成' }),
    makeRecord({ id: 5, status: '完了' }),
  ];

  it('heroRecordId を除外する', () => {
    const result = classifyQueueRecords(records, 2);
    // id=2（Hero）を除外 → 未完了は id=3, id=4 のみ
    expect(result.incomplete.map((r) => r.id)).toEqual([3, 4]);
    expect(result.incompleteCount).toBe(2);
    expect(result.completed.map((r) => r.id)).toEqual([1, 5]);
    expect(result.completedCount).toBe(2);
  });

  it('heroRecordId が null なら除外しない', () => {
    const result = classifyQueueRecords(records, null);
    // 作成中(id=2) → 未作成(id=3, id=4) の順
    expect(result.incomplete.map((r) => r.id)).toEqual([2, 3, 4]);
    expect(result.incompleteCount).toBe(3);
    expect(result.completedCount).toBe(2);
  });

  it('作成中 → 未作成 の順で並ぶ', () => {
    const mixed = [
      makeRecord({ id: 10, status: '未作成' }),
      makeRecord({ id: 11, status: '作成中' }),
      makeRecord({ id: 12, status: '未作成' }),
      makeRecord({ id: 13, status: '作成中' }),
    ];
    const result = classifyQueueRecords(mixed, null);
    // 作成中が先: 11, 13 → 未作成: 10, 12
    expect(result.incomplete.map((r) => r.id)).toEqual([11, 13, 10, 12]);
  });

  it('全件完了 + hero 除外なし → incomplete 空', () => {
    const allDone = [
      makeRecord({ id: 1, status: '完了' }),
      makeRecord({ id: 2, status: '完了' }),
    ];
    const result = classifyQueueRecords(allDone, null);
    expect(result.incompleteCount).toBe(0);
    expect(result.completedCount).toBe(2);
  });

  it('空配列 → 全て空', () => {
    const result = classifyQueueRecords([], null);
    expect(result.incompleteCount).toBe(0);
    expect(result.completedCount).toBe(0);
  });
});
